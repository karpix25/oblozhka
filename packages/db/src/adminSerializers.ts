type UserWithTelegramId = {
  telegramId: bigint;
};

export function serializeAdminUser<T extends UserWithTelegramId>(user: T) {
  return {
    ...user,
    telegramId: user.telegramId.toString()
  };
}
