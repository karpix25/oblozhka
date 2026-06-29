import type { UserProfile } from "@covers/domain";
import type { DbClient } from "./client.js";

export async function upsertTelegramUser(db: DbClient, profile: UserProfile) {
  return db.user.upsert({
    where: { telegramId: BigInt(profile.telegramId) },
    create: {
      telegramId: BigInt(profile.telegramId),
      username: profile.username,
      firstName: profile.firstName,
      languageCode: profile.languageCode
    },
    update: {
      username: profile.username,
      firstName: profile.firstName,
      languageCode: profile.languageCode
    }
  });
}

export async function findUserByTelegramId(db: DbClient, telegramId: number) {
  return db.user.findUnique({
    where: { telegramId: BigInt(telegramId) }
  });
}

export async function listUsers(db: DbClient) {
  return db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200
  });
}
