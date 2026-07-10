import {
  chargeGenerationCreditOnSuccess,
  findGeneration,
  findProject,
  markGenerationFailed,
  markGenerationProcessing,
  markGenerationSucceeded,
  markProjectStatus,
  prisma,
  recordProductEvent,
  replaceProjectHooks,
  selectBestProjectHook,
  updateGenerationPrompt,
  upsertProjectTranscript
} from "@covers/db";
import {
  FACE_CARD_QUEUE,
  GENERATION_QUEUE,
  HOOK_QUEUE,
  deriveDesignTextConstraints,
  getFormatSpec,
  type FaceCardJobData,
  type GenerationJobData,
  type HookJobData
} from "@covers/domain";
import { KieImageClient, OpenRouterPromptPlanner, resolveContentLanguage } from "@covers/generation-ai";
import { SourceIngestionService } from "@covers/media-source";
import { ObjectStorage } from "@covers/storage";
import { Worker } from "bullmq";
import { processFaceCardJob } from "./faceCardProcessor.js";
import { prepareGenerationReferences } from "./generationReferences.js";
import { createPreview, normalizeFinal } from "./imageProcessing.js";
import { TelegramNotifier } from "./notifier.js";
import { projectStatusAfterGeneration } from "./projectStatus.js";
import { prepareTemplateReferenceUrl } from "./templateReference.js";
import {
  attachWorkerLogging,
  buildWorkerOptions,
  isFinalAttempt,
  nonNegativeIntegerEnv,
  positiveIntegerEnv,
  throwIfAborted,
  withJobDeadline
} from "./workerRuntime.js";

const imageClient = new KieImageClient();
const promptPlanner = new OpenRouterPromptPlanner();
const sourceIngestion = new SourceIngestionService();
const storage = new ObjectStorage();
const notifier = new TelegramNotifier();

const faceCardWorker = new Worker<FaceCardJobData, void, string>(
  FACE_CARD_QUEUE,
  async (job) => {
    await withJobDeadline("Face card job", positiveIntegerEnv("FACE_CARD_JOB_TIMEOUT_MS", 5 * 60 * 1000), async (signal) => {
      await processFaceCardJob(job.data, { signal });
    });
  },
  buildWorkerOptions({
    concurrency: positiveIntegerEnv("FACE_CARD_WORKER_CONCURRENCY", 2),
    limiterMax: nonNegativeIntegerEnv("FACE_CARD_WORKER_LIMIT_MAX", 2),
    limiterDurationMs: positiveIntegerEnv("FACE_CARD_WORKER_LIMIT_DURATION_MS", 10000)
  })
);
attachWorkerLogging(FACE_CARD_QUEUE, faceCardWorker);

const generationWorker = new Worker<GenerationJobData, void, string>(
  GENERATION_QUEUE,
  async (job) => {
    const generation = await findGeneration(prisma, job.data.generationId);
    if (!generation) {
      throw new Error(`Generation ${job.data.generationId} was not found.`);
    }

    if (isDeliveredGeneration(generation)) {
      await notifier.sendGenerationResult(job.data.userTelegramId, {
        generationId: generation.id,
        plan: generation.chargedPlan,
        previewUrl: generation.previewUrl,
        originalUrl: generation.originalUrl
      });
      return;
    }

    let persistedSuccess = false;
    let generationProgressCompleted = false;
    await markGenerationProcessing(prisma, generation.id);
    await trackProductEvent({
      name: "generation_started",
      userId: generation.userId,
      projectId: generation.projectId ?? undefined,
      generationId: generation.id
    });
    const progress = await notifier.sendGenerationProgress(job.data.userTelegramId).catch(() => undefined);
    const spec = getFormatSpec(generation.format);
    const modernization = modernizationMeta(generation.providerMeta);
    const sourceTranscript = generation.project?.transcripts[0];
    const contentLanguage = resolveContentLanguage(
      sourceTranscript?.language,
      [sourceTranscript?.cleanText, sourceTranscript?.rawText, generation.topic, generation.hookText]
        .filter(Boolean)
        .join("\n")
    );

    try {
      await withJobDeadline("Generation job", positiveIntegerEnv("GENERATION_JOB_TIMEOUT_MS", 20 * 60 * 1000), async (signal) => {
        const styleReferenceSource = generation.userStyleAsset?.imageUrl ?? generation.userStyleAsset?.sourceImageUrl;
        const references = await prepareGenerationReferences({
          generationId: generation.id,
          primaryUrl: generation.referenceImageUrl ?? undefined,
          guestUrl: generation.guestReferenceImageUrl ?? undefined,
          styleUrl: styleReferenceSource ?? undefined,
          storage,
          signal
        });
        throwIfAborted(signal, "Generation job");
        const templateReferenceUrl = await prepareTemplateReferenceUrl({
          generationId: generation.id,
          templateSlug: generation.template?.slug,
          storage
        });
        throwIfAborted(signal, "Generation job");
        const designText = deriveDesignTextConstraints(generation.template ?? generation.userStyleAsset ?? undefined);
        await notifier.updateGenerationProgress(progress, "prompt");
        const plan = await promptPlanner.plan({
          wizard: {
            format: generation.format,
            referenceMode: generation.referenceMode,
            referenceImageUrl: references.primary,
            guestReferenceImageUrl: references.guest,
            topic: generation.topic,
            niche: generation.niche,
            hookText: generation.hookText ?? undefined,
            style: generation.style
          },
          formatDescription: spec.description,
          aspectRatio: spec.aspectRatio,
          contentLanguage,
          template: generation.template
            ? {
                slug: generation.template.slug,
                title: generation.template.title,
                promptRules: generation.template.promptRules
              }
            : undefined,
          templateReferenceImageUrl: templateReferenceUrl,
          userStyle: generation.userStyleAsset
            ? {
                title: generation.userStyleAsset.title,
                promptRules: generation.userStyleAsset.promptRules,
                imageUrl: references.style
              }
            : undefined,
          designText
        }, { signal });
        throwIfAborted(signal, "Generation job");
        await updateGenerationPrompt(prisma, generation.id, {
          prompt: plan.prompt,
          referenceAnalysis: plan.referenceAnalysis,
          providerMeta: {
            ...(modernization ? { modernization } : {}),
            promptPlannerModel: plan.model,
            promptValidationIssues: plan.validationIssues,
            templateReferenceUrl
          }
        });

        const imageReferenceUrls = [
          ...(references.primary ? [references.primary] : []),
          ...(references.guest ? [references.guest] : []),
          ...(templateReferenceUrl ? [templateReferenceUrl] : []),
          ...(references.style ? [references.style] : [])
        ];

        await notifier.updateGenerationProgress(progress, "generation");
        const result = await imageClient.generate({
          prompt: plan.prompt,
          imageUrl: imageReferenceUrls[0],
          imageUrls: imageReferenceUrls,
          aspectRatio: spec.aspectRatio,
          signal
        });
        throwIfAborted(signal, "Generation job");
        await notifier.updateGenerationProgress(progress, "processing");
        const finalImage = await normalizeFinal(result.bytes, spec.width, spec.height);
        throwIfAborted(signal, "Generation job");
        const preview = await createPreview(finalImage, Math.round(spec.width / 2), Math.round(spec.height / 2));
        throwIfAborted(signal, "Generation job");
        const baseKey = `generations/${generation.id}`;
        const originalUrl = await storage.uploadBuffer({
          key: `${baseKey}/final.png`,
          body: finalImage,
          contentType: "image/png"
        });
        throwIfAborted(signal, "Generation job");
        const previewUrl = await storage.uploadBuffer({
          key: `${baseKey}/preview.jpg`,
          body: preview,
          contentType: "image/jpeg"
        });
        throwIfAborted(signal, "Generation job");

        const chargedGeneration = modernization?.chargeOnSuccess
          ? await chargeGenerationCreditOnSuccess(prisma, generation.id, `Image edit: ${modernization.actionId}`)
          : generation;
        throwIfAborted(signal, "Generation job");
        await markGenerationSucceeded(prisma, generation.id, {
          originalUrl,
          previewUrl,
          providerMeta: {
            ...(modernization ? { modernization } : {}),
            imageModel: result.model,
            promptPlannerModel: plan.model,
            raw: result.raw
          }
        });
        await trackProductEvent({
          name: "generation_succeeded",
          userId: generation.userId,
          projectId: generation.projectId ?? undefined,
          generationId: generation.id
        });
        persistedSuccess = true;
        if (generation.projectId) {
          await markProjectStatus(prisma, generation.projectId, projectStatusAfterGeneration("SUCCEEDED"));
        }
        await notifier.updateGenerationProgress(progress, "delivery");
        await notifier.sendGenerationResult(job.data.userTelegramId, {
          generationId: generation.id,
          plan: chargedGeneration.chargedPlan,
          previewUrl,
          originalUrl,
          previewBytes: preview,
          originalBytes: finalImage
        });
        await notifier.updateGenerationProgress(progress, "ready");
        generationProgressCompleted = true;
      });
    } catch (error) {
      console.error("Generation job failed", {
        generationId: generation.id,
        attemptsMade: job.attemptsMade,
        attempts: job.opts.attempts,
        error
      });
      if (persistedSuccess) {
        throw error;
      }
      if (isFinalAttempt(job)) {
        const failedGeneration = await markGenerationFailed(
          prisma,
          generation.id,
          error instanceof Error ? error.message : "Unknown error"
        );
        await trackProductEvent({
          name: "generation_failed",
          userId: generation.userId,
          projectId: generation.projectId ?? undefined,
          generationId: generation.id,
          metadata: { stage: "generation" }
        });
        if (generation.projectId) {
          await markProjectStatus(prisma, generation.projectId, projectStatusAfterGeneration("FAILED"));
        }
        await notifier.sendGenerationFailure(
          job.data.userTelegramId,
          generation.projectId,
          failedGeneration.creditCost > 0
        );
      }
      throw error;
    } finally {
      await notifier.finishGenerationProgress(progress, generationProgressCompleted);
    }
  },
  buildWorkerOptions({
    concurrency: positiveIntegerEnv("GENERATION_WORKER_CONCURRENCY", 2),
    limiterMax: nonNegativeIntegerEnv("GENERATION_WORKER_LIMIT_MAX", 2),
    limiterDurationMs: positiveIntegerEnv("GENERATION_WORKER_LIMIT_DURATION_MS", 10000)
  })
);
attachWorkerLogging(GENERATION_QUEUE, generationWorker);

function modernizationMeta(value: unknown) {
  if (!value || typeof value !== "object" || !("modernization" in value)) {
    return undefined;
  }
  const meta = (value as { modernization?: unknown }).modernization;
  if (!meta || typeof meta !== "object") {
    return undefined;
  }
  const record = meta as Record<string, unknown>;
  return {
    sourceGenerationId: typeof record.sourceGenerationId === "string" ? record.sourceGenerationId : undefined,
    actionId: typeof record.actionId === "string" ? record.actionId : "custom_edit",
    userInstruction: typeof record.userInstruction === "string" ? record.userInstruction : undefined,
    chargeOnSuccess: record.chargeOnSuccess === true
  };
}

const hookWorker = new Worker<HookJobData, void, string>(
  HOOK_QUEUE,
  async (job) => {
    const project = await findProject(prisma, job.data.projectId);
    if (!project) {
      throw new Error(`Project ${job.data.projectId} was not found.`);
    }

    const progress = await notifier.sendHookProgress(job.data.userTelegramId).catch(() => undefined);
    let hookProgressCompleted = false;
    try {
      await withJobDeadline("Hook job", positiveIntegerEnv("HOOK_JOB_TIMEOUT_MS", 10 * 60 * 1000), async (signal) => {
        await markProjectStatus(prisma, project.id, "HOOKS_PENDING");
        const transcript = await ensureProjectTranscriptSafely(project, signal);
        throwIfAborted(signal, "Hook job");
        const textForHooks = transcript ?? project.topicSummary ?? "видео";
        const contentLanguage = resolveContentLanguage(project.transcripts[0]?.language, textForHooks);
        const designText = deriveDesignTextConstraints(project.selectedTemplate ?? project.selectedUserStyleAsset ?? undefined);
        await notifier.updateHookProgress(progress, "generation");
        const hooks = await promptPlanner.generateHooks({
          transcript: textForHooks,
          platform: project.platform ?? "YOUTUBE",
          contentLanguage,
          theme: project.topicSummary ?? project.transcripts[0]?.cleanText?.slice(0, 300) ?? undefined,
          sourceTitle: project.topicSummary ?? undefined,
          templateTitle: project.selectedTemplate?.title ?? project.selectedUserStyleAsset?.title ?? undefined,
          templateRules: project.selectedTemplate?.promptRules ?? project.selectedUserStyleAsset?.promptRules ?? undefined,
          designText
        }, { signal });
        throwIfAborted(signal, "Hook job");
        await notifier.updateHookProgress(progress, "selection");
        const savedHooks = await replaceProjectHooks(prisma, project.id, hooks);
        const selectedProject = await selectBestProjectHook(prisma, project.id);
        await markProjectStatus(prisma, project.id, "HOOKS_READY");
        await trackProductEvent({
          name: "hooks_ready",
          userId: project.userId,
          projectId: project.id,
          metadata: { candidateCount: savedHooks.length }
        });
        await trackProductEvent({
          name: "hook_selected",
          userId: project.userId,
          projectId: project.id,
          metadata: { mode: "auto_worker", hookId: selectedProject.selectedHook?.id }
        });
        await notifier.updateHookProgress(progress, "ready");
        await notifier.sendAutoHookReady(job.data.userTelegramId, project.id, selectedProject.selectedHook?.text);
        hookProgressCompleted = true;
      });
    } catch (error) {
      if (isFinalAttempt(job)) {
        await markProjectStatus(prisma, project.id, "FAILED", error instanceof Error ? error.message : "Unknown error");
        await notifier.sendHookFailure(job.data.userTelegramId, project.id);
      }
      throw error;
    } finally {
      await notifier.finishHookProgress(progress, hookProgressCompleted);
    }
  },
  buildWorkerOptions({
    concurrency: positiveIntegerEnv("HOOK_WORKER_CONCURRENCY", 4),
    limiterMax: nonNegativeIntegerEnv("HOOK_WORKER_LIMIT_MAX", 8),
    limiterDurationMs: positiveIntegerEnv("HOOK_WORKER_LIMIT_DURATION_MS", 10000)
  })
);
attachWorkerLogging(HOOK_QUEUE, hookWorker);

async function ensureProjectTranscript(project: NonNullable<Awaited<ReturnType<typeof findProject>>>, signal: AbortSignal) {
  const existing = project.transcripts[0]?.cleanText ?? project.transcripts[0]?.rawText;
  if (existing) return existing;

  const source = project.sourceAssets[0];
  if (!source) return undefined;

  await markProjectStatus(prisma, project.id, "SOURCE_PROCESSING");
  const result = await sourceIngestion.resolveTranscript({
    sourceType: source.type,
    url: source.url ?? undefined,
    text: source.text ?? undefined
  }, { signal });
  throwIfAborted(signal, "Hook job");
  if (!result?.text) {
    await markProjectStatus(prisma, project.id, "SOURCE_FAILED", "Transcript was not found.");
    return undefined;
  }

  await upsertProjectTranscript(prisma, {
    projectId: project.id,
    rawText: result.text,
    cleanText: result.text,
    language: result.language,
    providerMeta: { provider: result.provider, raw: result.raw }
  });

  await markProjectStatus(prisma, project.id, "SOURCE_READY");
  return result.text;
}

async function ensureProjectTranscriptSafely(
  project: NonNullable<Awaited<ReturnType<typeof findProject>>>,
  signal: AbortSignal
) {
  try {
    return await ensureProjectTranscript(project, signal);
  } catch (error) {
    throwIfAborted(signal, "Hook job");
    console.warn("Transcript resolution failed; continuing with fallback hook context", {
      projectId: project.id,
      error
    });
    return undefined;
  }
}

async function trackProductEvent(input: Parameters<typeof recordProductEvent>[1]) {
  await recordProductEvent(prisma, input).catch((error) => {
    console.warn("Product analytics event was not recorded", { name: input.name, error });
  });
}

type WorkerGeneration = NonNullable<Awaited<ReturnType<typeof findGeneration>>>;
type DeliveredGeneration = WorkerGeneration & { status: "SUCCEEDED"; previewUrl: string; originalUrl: string };

function isDeliveredGeneration(generation: WorkerGeneration): generation is DeliveredGeneration {
  return generation.status === "SUCCEEDED" && Boolean(generation.previewUrl && generation.originalUrl);
}
