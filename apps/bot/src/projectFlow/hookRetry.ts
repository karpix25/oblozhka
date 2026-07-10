type HookJob = {
  getState(): Promise<string>;
  remove(): Promise<void>;
};

type HookQueueLookup = {
  getJob(id: string): Promise<HookJob | null | undefined>;
};

const RUNNING_STATES = new Set(["active", "waiting", "delayed"]);

export async function prepareHookJob(queue: HookQueueLookup, jobId: string) {
  const oldJob = await queue.getJob(jobId);
  if (!oldJob) return "ready" as const;

  const state = await oldJob.getState();
  if (RUNNING_STATES.has(state)) return "already-running" as const;

  await oldJob.remove();
  const lingeringJob = await queue.getJob(jobId);
  if (lingeringJob) throw new Error("Terminal hook job still exists after removal.");
  return "ready" as const;
}
