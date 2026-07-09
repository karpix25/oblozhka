import {
  findGeneration,
  findProject,
  markGenerationFailed,
  markGenerationProcessing,
  markGenerationSucceeded,
  markProjectStatus,
  prisma,
  replaceProjectHooks,
  updateGenerationPrompt,
  upsertProjectTranscript
} from "@covers/db";
import {
  FACE_CARD_QUEUE,
  GENERATION_QUEUE,
  HOOK_QUEUE,
  getFormatSpec,
  type FaceCardJobData,
  type GenerationJobData,
  type HookJobData
} from "@covers/domain";
import { KieImageClient, OpenRouterPromptPlanner } from "@covers/generation-ai";
import { SourceIngestionService } from "@covers/media-source";
import { ObjectStorage } from "@covers/storage";
import { Worker } from "bullmq";
import { processFaceCardJob } from "./faceCardProcessor.js";
import { createPreview, normalizeFinal } from "./imageProcessing.js";
import { TelegramNotifier } from "./notifier.js";
import { projectStatusAfterGeneration } from "./projectStatus.js";
import { prepareReferenceImageUrls } from "./referenceImages.js";
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
    await markGenerationProcessing(prisma, generation.id);
    const spec = getFormatSpec(generation.format);

    try {
      await withJobDeadline("Generation job", positiveIntegerEnv("GENERATION_JOB_TIMEOUT_MS", 20 * 60 * 1000), async (signal) => {
        const templateReferenceUrl = await prepareTemplateReferenceUrl({
          generationId: generation.id,
          templateSlug: generation.template?.slug,
          storage
        });
        throwIfAborted(signal, "Generation job");
        const plan = await promptPlanner.plan({
          wizard: {
            format: generation.format,
            referenceMode: generation.referenceMode,
            referenceImageUrl: generation.referenceImageUrl ?? undefined,
            guestReferenceImageUrl: generation.guestReferenceImageUrl ?? undefined,
            topic: generation.topic,
            niche: generation.niche,
            hookText: generation.hookText ?? undefined,
            style: generation.style
          },
          formatDescription: spec.description,
          aspectRatio: spec.aspectRatio,
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
                imageUrl: generation.userStyleAsset.imageUrl ?? generation.userStyleAsset.sourceImageUrl
              }
            : undefined
        }, { signal });
        throwIfAborted(signal, "Generation job");
        await updateGenerationPrompt(prisma, generation.id, {
          prompt: plan.prompt,
          referenceAnalysis: plan.referenceAnalysis,
          providerMeta: {
            promptPlannerModel: plan.model,
            promptValidationIssues: plan.validationIssues,
            templateReferenceUrl
          }
        });

        const referenceUrls = await prepareReferenceImageUrls({
          generationId: generation.id,
          urls: [generation.referenceImageUrl, generation.guestReferenceImageUrl].filter((url): url is string => Boolean(url)),
          storage,
          signal
        });
        throwIfAborted(signal, "Generation job");
        const styleReferenceUrl = generation.userStyleAsset?.imageUrl ?? generation.userStyleAsset?.sourceImageUrl;
        const imageReferenceUrls = [
          ...referenceUrls,
          ...(templateReferenceUrl ? [templateReferenceUrl] : []),
          ...(styleReferenceUrl ? [styleReferenceUrl] : [])
        ];

        const result = await imageClient.generate({
          prompt: plan.prompt,
          imageUrl: imageReferenceUrls[0],
          imageUrls: imageReferenceUrls,
          aspectRatio: spec.aspectRatio,
          signal
        });
        throwIfAborted(signal, "Generation job");
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

        await markGenerationSucceeded(prisma, generation.id, {
          originalUrl,
          previewUrl,
          providerMeta: { imageModel: result.model, promptPlannerModel: plan.model, raw: result.raw }
        });
        persistedSuccess = true;
        if (generation.projectId) {
          await markProjectStatus(prisma, generation.projectId, projectStatusAfterGeneration("SUCCEEDED"));
        }
        await notifier.sendGenerationResult(job.data.userTelegramId, {
          generationId: generation.id,
          plan: generation.chargedPlan,
          previewUrl,
          originalUrl,
          previewBytes: preview,
          originalBytes: finalImage
        });
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
        await markGenerationFailed(prisma, generation.id, error instanceof Error ? error.message : "Unknown error");
        if (generation.projectId) {
          await markProjectStatus(prisma, generation.projectId, projectStatusAfterGeneration("FAILED"));
        }
        await notifier.sendGenerationFailure(job.data.userTelegramId);
      }
      throw error;
    }
  },
  buildWorkerOptions({
    concurrency: positiveIntegerEnv("GENERATION_WORKER_CONCURRENCY", 2),
    limiterMax: nonNegativeIntegerEnv("GENERATION_WORKER_LIMIT_MAX", 2),
    limiterDurationMs: positiveIntegerEnv("GENERATION_WORKER_LIMIT_DURATION_MS", 10000)
  })
);
attachWorkerLogging(GENERATION_QUEUE, generationWorker);

const hookWorker = new Worker<HookJobData, void, string>(
  HOOK_QUEUE,
  async (job) => {
    const project = await findProject(prisma, job.data.projectId);
    if (!project) {
      throw new Error(`Project ${job.data.projectId} was not found.`);
    }

    try {
      await withJobDeadline("Hook job", positiveIntegerEnv("HOOK_JOB_TIMEOUT_MS", 10 * 60 * 1000), async (signal) => {
        await markProjectStatus(prisma, project.id, "HOOKS_PENDING");
        const transcript = await ensureProjectTranscript(project, signal);
        throwIfAborted(signal, "Hook job");
        const textForHooks = transcript ?? "Пользователь загрузил видео без транскрипта.";
        const hooks = await promptPlanner.generateHooks({
          transcript: textForHooks,
          platform: project.platform ?? "YOUTUBE",
          templateTitle: project.selectedTemplate?.title ?? project.selectedUserStyleAsset?.title ?? undefined,
          templateRules: project.selectedTemplate?.promptRules ?? project.selectedUserStyleAsset?.promptRules ?? undefined
        }, { signal });
        throwIfAborted(signal, "Hook job");
        const savedHooks = await replaceProjectHooks(prisma, project.id, hooks);
        await markProjectStatus(prisma, project.id, "HOOKS_READY");
        await notifier.sendHookCandidates(job.data.userTelegramId, project.id, savedHooks);
      });
    } catch (error) {
      await markProjectStatus(prisma, project.id, "FAILED", error instanceof Error ? error.message : "Unknown error");
      await notifier.sendHookFailure(job.data.userTelegramId);
      throw error;
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

type WorkerGeneration = NonNullable<Awaited<ReturnType<typeof findGeneration>>>;
type DeliveredGeneration = WorkerGeneration & { status: "SUCCEEDED"; previewUrl: string; originalUrl: string };

function isDeliveredGeneration(generation: WorkerGeneration): generation is DeliveredGeneration {
  return generation.status === "SUCCEEDED" && Boolean(generation.previewUrl && generation.originalUrl);
}
