import type { DbClient } from "./client.js";

export type HookCandidateInput = {
  text: string;
  angle?: string;
  score?: number;
};

export async function replaceProjectHooks(db: DbClient, projectId: string, hooks: HookCandidateInput[]) {
  return db.$transaction(async (tx) => {
    await tx.hookCandidate.deleteMany({ where: { projectId } });
    await tx.hookCandidate.createMany({
      data: hooks.map((hook) => ({
        projectId,
        text: hook.text,
        angle: hook.angle,
        score: hook.score ?? 0
      }))
    });
    return tx.hookCandidate.findMany({
      where: { projectId },
      orderBy: [{ score: "desc" }, { createdAt: "asc" }]
    });
  });
}

export async function listProjectHooks(db: DbClient, projectId: string) {
  return db.hookCandidate.findMany({
    where: { projectId },
    orderBy: [{ score: "desc" }, { createdAt: "asc" }]
  });
}
