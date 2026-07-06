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
import { GENERATION_QUEUE, HOOK_QUEUE, getFormatSpec, type GenerationJobData, type HookJobData } from "@covers/domain";
import { KieImageClient, OpenRouterPromptPlanner } from "@covers/generation-ai";
import { SourceIngestionService } from "@covers/media-source";
import { ObjectStorage } from "@covers/storage";
import { Worker, type WorkerOptions } from "bullmq";
import { createPreview, normalizeFinal } from "./imageProcessing.js";
import { TelegramNotifier } from "./notifier.js";
import { projectStatusAfterGeneration } from "./projectStatus.js";
import { prepareReferenceImageUrls } from "./referenceImages.js";
import { prepareTemplateReferenceUrl } from "./templateReference.js";

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null
};

const imageClient = new KieImageClient();
const promptPlanner = new OpenRouterPromptPlanner();
const sourceIngestion = new SourceIngestionService();
const storage = new ObjectStorage();
const notifier = new TelegramNotifier();

const generationWorker = new Worker<GenerationJobData, void, string>(
  GENERATION_QUEUE,
  async (job) => {
    const generation = await findGeneration(prisma, job.data.generationId);
    if (!generation) {
      throw new Error(`Generation ${job.data.generationId} was not found.`);
    }

    await markGenerationProcessing(prisma, generation.id);
    const spec = getFormatSpec(generation.format);

    try {
      const templateReferenceUrl = await prepareTemplateReferenceUrl({
        generationId: generation.id,
        templateSlug: generation.template?.slug,
        storage
      });
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
      });
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
        storage
      });
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
        aspectRatio: spec.aspectRatio
      });
      const finalImage = await normalizeFinal(result.bytes, spec.width, spec.height);
      const preview = await createPreview(finalImage, Math.round(spec.width / 2), Math.round(spec.height / 2));
      const baseKey = `generations/${generation.id}`;
      const originalUrl = await storage.uploadBuffer({
        key: `${baseKey}/final.png`,
        body: finalImage,
        contentType: "image/png"
      });
      const previewUrl = await storage.uploadBuffer({
        key: `${baseKey}/preview.jpg`,
        body: preview,
        contentType: "image/jpeg"
      });

      await markGenerationSucceeded(prisma, generation.id, {
        originalUrl,
        previewUrl,
        providerMeta: { imageModel: result.model, promptPlannerModel: plan.model, raw: result.raw }
      });
      if (generation.projectId) {
        await markProjectStatus(prisma, generation.projectId, projectStatusAfterGeneration("SUCCEEDED"));
      }
      await notifier.sendGenerationResult(job.data.userTelegramId, {
        previewUrl,
        originalUrl,
        previewBytes: preview,
        originalBytes: finalImage
      });
    } catch (error) {
      console.error("Generation job failed", {
        generationId: generation.id,
        attemptsMade: job.attemptsMade,
        attempts: job.opts.attempts,
        error
      });
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
      await markProjectStatus(prisma, project.id, "HOOKS_PENDING");
      const transcript = await ensureProjectTranscript(project);
      const textForHooks = transcript ?? "Пользователь загрузил видео без транскрипта.";
      const hooks = await promptPlanner.generateHooks({
        transcript: textForHooks,
        platform: project.platform ?? "YOUTUBE",
        templateTitle: project.selectedTemplate?.title ?? project.selectedUserStyleAsset?.title ?? undefined,
        templateRules: project.selectedTemplate?.promptRules ?? project.selectedUserStyleAsset?.promptRules ?? undefined
      });
      const savedHooks = await replaceProjectHooks(prisma, project.id, hooks);
      await markProjectStatus(prisma, project.id, "HOOKS_READY");
      await notifier.sendHookCandidates(job.data.userTelegramId, project.id, savedHooks);
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

async function ensureProjectTranscript(project: NonNullable<Awaited<ReturnType<typeof findProject>>>) {
  const existing = project.transcripts[0]?.cleanText ?? project.transcripts[0]?.rawText;
  if (existing) return existing;

  const source = project.sourceAssets[0];
  if (!source) return undefined;

  await markProjectStatus(prisma, project.id, "SOURCE_PROCESSING");
  const result = await sourceIngestion.resolveTranscript({
    sourceType: source.type,
    url: source.url ?? undefined,
    text: source.text ?? undefined
  });
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

function isFinalAttempt(job: { attemptsMade: number; opts: { attempts?: number } }) {
  return job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
}

function buildWorkerOptions(input: { concurrency: number; limiterMax: number; limiterDurationMs: number }): WorkerOptions {
  return {
    connection,
    concurrency: input.concurrency,
    limiter: input.limiterMax > 0 ? { max: input.limiterMax, duration: input.limiterDurationMs } : undefined,
    lockDuration: positiveIntegerEnv("WORKER_LOCK_DURATION_MS", 10 * 60 * 1000),
    maxStalledCount: positiveIntegerEnv("WORKER_MAX_STALLED_COUNT", 1),
    stalledInterval: positiveIntegerEnv("WORKER_STALLED_INTERVAL_MS", 30 * 1000)
  };
}

function attachWorkerLogging<DataType, ResultType, NameType extends string>(
  queueName: string,
  worker: Worker<DataType, ResultType, NameType>
) {
  worker.on("completed", (job) => {
    console.info("Worker job completed", {
      queueName,
      jobId: job.id,
      jobName: job.name,
      attemptsMade: job.attemptsMade,
      durationMs: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : undefined
    });
  });

  worker.on("failed", (job, error, previousState) => {
    console.error("Worker job failed", {
      queueName,
      jobId: job?.id,
      jobName: job?.name,
      previousState,
      attemptsMade: job?.attemptsMade,
      attempts: job?.opts.attempts,
      error: formatError(error)
    });
  });

  worker.on("stalled", (jobId, previousState) => {
    console.warn("Worker job stalled", { queueName, jobId, previousState });
  });

  worker.on("error", (error) => {
    console.error("Worker runtime error", { queueName, error: formatError(error) });
  });
}

function positiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeIntegerEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function formatError(error: Error) {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
}
