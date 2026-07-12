import {
  createGenerationFromProject,
  findProject,
  listUserFaceAssets,
  markGenerationFailed,
  markProjectStatus,
  prisma,
  type DbClient
} from "@covers/db";
import { GENERATION_QUEUE, generationJobId, type GenerationJobData } from "@covers/domain";
import { Queue } from "bullmq";
import { workerConnection } from "./workerRuntime.js";

type ProjectForAutoGeneration = NonNullable<Awaited<ReturnType<typeof findProject>>>;
type GenerationForQueue = Awaited<ReturnType<typeof createGenerationFromProject>>;

type AutoGenerationDeps = {
  findProject: typeof findProject;
  listFaces: typeof listUserFaceAssets;
  createGeneration: typeof createGenerationFromProject;
  enqueueGeneration: (generation: GenerationForQueue, userTelegramId: number) => Promise<void>;
};

export type AutoGenerationResult =
  | { status: "queued"; hookText?: string | null; generationId: string }
  | { status: "needs-reference"; hookText?: string | null }
  | { status: "not-ready"; hookText?: string | null; reason: string };

let generationQueue: Queue<GenerationJobData, void, string> | undefined;

export async function startProjectGenerationAfterHook(
  input: { projectId: string; userTelegramId: number },
  deps: AutoGenerationDeps = defaultDeps()
): Promise<AutoGenerationResult> {
  const project = await deps.findProject(prisma, input.projectId);
  if (!project) return { status: "not-ready", reason: "project_not_found" };
  if (!project.selectedHook) return { status: "not-ready", reason: "missing_selected_hook" };
  if (!project.platform || (!project.selectedTemplate && !project.selectedUserStyleAsset)) {
    return { status: "not-ready", hookText: project.selectedHook.text, reason: "missing_project_settings" };
  }

  const referenceImageUrl = await resolveAutoReference(project, deps);
  if (!referenceImageUrl) {
    return { status: "needs-reference", hookText: project.selectedHook.text };
  }

  const generation = await deps.createGeneration(prisma, {
    projectId: project.id,
    userId: project.userId,
    referenceImageUrl,
    chargeCredits: true,
    requestKey: autoGenerationRequestKey(project)
  });
  await deps.enqueueGeneration(generation, input.userTelegramId);
  return { status: "queued", hookText: project.selectedHook.text, generationId: generation.id };
}

async function resolveAutoReference(project: ProjectForAutoGeneration, deps: AutoGenerationDeps) {
  if (project.platform === "FACELESS") {
    return project.sourceAssets.find((asset) => asset.previewImageUrl)?.previewImageUrl;
  }

  const [face] = await deps.listFaces(prisma, project.userId, 1);
  return face?.imageUrl;
}

function autoGenerationRequestKey(project: ProjectForAutoGeneration) {
  return `auto-project:${project.id}:hook:${project.selectedHook?.id ?? "none"}`;
}

function defaultDeps(): AutoGenerationDeps {
  return {
    findProject,
    listFaces: listUserFaceAssets,
    createGeneration: createGenerationFromProject,
    enqueueGeneration: enqueueGenerationFromWorker
  };
}

async function enqueueGenerationFromWorker(generation: GenerationForQueue, userTelegramId: number) {
  try {
    await getGenerationQueue().add(
      "generate-cover",
      { generationId: generation.id, userTelegramId },
      {
        jobId: generationJobId(generation.id),
        priority: generation.queuePriority,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
        removeOnFail: { age: 7 * 24 * 60 * 60, count: 5000 },
        keepLogs: 25,
        stackTraceLimit: 10
      }
    );
  } catch (error) {
    await compensateAutoGenerationEnqueueFailure(generation, error, prisma);
  }
}

function getGenerationQueue() {
  generationQueue ??= new Queue<GenerationJobData, void, string>(GENERATION_QUEUE, {
    connection: workerConnection
  });
  return generationQueue;
}

async function compensateAutoGenerationEnqueueFailure(generation: GenerationForQueue, error: unknown, db: DbClient) {
  const message = `Generation queue enqueue failed: ${error instanceof Error ? error.message : "Unknown enqueue error"}`;
  await markGenerationFailed(db, generation.id, message);
  if (generation.projectId) {
    await markProjectStatus(db, generation.projectId, "FAILED", message);
  }
  throw new Error(message);
}
