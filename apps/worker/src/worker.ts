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
import { Worker } from "bullmq";
import { createPreview, normalizeFinal } from "./imageProcessing.js";
import { TelegramNotifier } from "./notifier.js";
import { prepareReferenceImageUrls } from "./referenceImages.js";

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

new Worker<GenerationJobData, void, string>(
  GENERATION_QUEUE,
  async (job) => {
    const generation = await findGeneration(prisma, job.data.generationId);
    if (!generation) {
      throw new Error(`Generation ${job.data.generationId} was not found.`);
    }

    await markGenerationProcessing(prisma, generation.id);
    const spec = getFormatSpec(generation.format);

    try {
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
        aspectRatio: spec.aspectRatio
      });
      await updateGenerationPrompt(prisma, generation.id, {
        prompt: plan.prompt,
        referenceAnalysis: plan.referenceAnalysis,
        providerMeta: { promptPlannerModel: plan.model }
      });

      const referenceUrls = await prepareReferenceImageUrls({
        generationId: generation.id,
        urls: [generation.referenceImageUrl, generation.guestReferenceImageUrl].filter((url): url is string => Boolean(url)),
        storage
      });

      const result = await imageClient.generate({
        prompt: plan.prompt,
        imageUrl: referenceUrls[0],
        imageUrls: referenceUrls,
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
        await notifier.sendGenerationFailure(job.data.userTelegramId);
      }
      throw error;
    }
  },
  { connection, concurrency: 2 }
);

new Worker<HookJobData, void, string>(
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
        templateTitle: project.selectedTemplate?.title,
        templateRules: project.selectedTemplate?.promptRules
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
  { connection, concurrency: 4 }
);

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
