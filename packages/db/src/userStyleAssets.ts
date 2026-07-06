import type { UserStyleAssetStatus } from "@covers/domain";
import type { DbClient } from "./client.js";

export type CreateUserStyleAssetInput = {
  userId: string;
  sourceImageUrl: string;
  title?: string;
  promptRules?: string;
  status?: UserStyleAssetStatus;
  metadata?: object;
};

export async function createUserStyleAsset(db: DbClient, input: CreateUserStyleAssetInput) {
  return db.userStyleAsset.create({
    data: {
      userId: input.userId,
      sourceImageUrl: input.sourceImageUrl,
      imageUrl: input.sourceImageUrl,
      title: input.title,
      promptRules: input.promptRules,
      status: input.status,
      metadata: input.metadata
    }
  });
}

export async function listUserStyleAssets(
  db: DbClient,
  input: { userId: string; statuses?: UserStyleAssetStatus[]; take?: number }
) {
  return db.userStyleAsset.findMany({
    where: {
      userId: input.userId,
      status: input.statuses ? { in: input.statuses } : undefined
    },
    orderBy: { createdAt: "desc" },
    take: input.take
  });
}

export async function findUserStyleAsset(db: DbClient, input: { id: string; userId: string }) {
  return db.userStyleAsset.findFirst({
    where: { id: input.id, userId: input.userId }
  });
}

export async function markUserStyleAssetReady(
  db: DbClient,
  input: { id: string; userId: string; imageUrl: string; promptRules?: string; metadata?: object }
) {
  await assertUserStyleAssetOwner(db, input);
  return db.userStyleAsset.update({
    where: { id: input.id },
    data: {
      status: "READY",
      imageUrl: input.imageUrl,
      promptRules: input.promptRules,
      errorMessage: null,
      rejectionReason: null,
      metadata: input.metadata
    }
  });
}

export async function markUserStyleAssetFailed(
  db: DbClient,
  input: { id: string; userId: string; status?: Extract<UserStyleAssetStatus, "REJECTED" | "FAILED">; reason: string }
) {
  await assertUserStyleAssetOwner(db, input);
  const status = input.status ?? "FAILED";
  return db.userStyleAsset.update({
    where: { id: input.id },
    data: {
      status,
      errorMessage: status === "FAILED" ? input.reason : null,
      rejectionReason: status === "REJECTED" ? input.reason : null
    }
  });
}

export async function deleteUserStyleAsset(db: DbClient, input: { id: string; userId: string }) {
  await assertUserStyleAssetOwner(db, input);
  return db.userStyleAsset.delete({
    where: { id: input.id }
  });
}

async function assertUserStyleAssetOwner(db: DbClient, input: { id: string; userId: string }) {
  const style = await findUserStyleAsset(db, input);
  if (!style) {
    throw new Error("User style asset was not found.");
  }
}
