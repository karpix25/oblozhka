import type { DbClient } from "./client.js";

export async function createUserFaceAsset(
  db: DbClient,
  input: { userId: string; imageUrl: string; telegramFileId?: string; title?: string; metadata?: object }
) {
  return db.userFaceAsset.create({
    data: {
      userId: input.userId,
      imageUrl: input.imageUrl,
      telegramFileId: input.telegramFileId,
      title: input.title,
      metadata: input.metadata
    }
  });
}

export async function listUserFaceAssets(db: DbClient, userId: string, take = 6) {
  return db.userFaceAsset.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    take
  });
}

export async function findUserFaceAsset(db: DbClient, id: string, userId: string) {
  return db.userFaceAsset.findFirst({ where: { id, userId } });
}

export async function updateUserFaceAssetUrl(db: DbClient, id: string, imageUrl: string, metadata?: object) {
  return db.userFaceAsset.update({
    where: { id },
    data: { imageUrl, metadata }
  });
}
