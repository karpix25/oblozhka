import { Bot } from "grammy";

export class TelegramNotifier {
  private readonly bot: Bot;

  constructor(token = process.env.BOT_TOKEN ?? "") {
    if (!token) {
      throw new Error("BOT_TOKEN is required for worker notifications.");
    }
    this.bot = new Bot(token);
  }

  async sendGenerationResult(chatId: number, previewUrl: string, originalUrl: string) {
    await this.bot.api.sendPhoto(chatId, previewUrl, {
      caption: [
        "Готово. Обложка сгенерирована.",
        "",
        `Финальный файл: ${originalUrl}`
      ].join("\n"),
      reply_markup: {
        inline_keyboard: [
          [{ text: "Сгенерировать еще", callback_data: "generate:start" }],
          [{ text: "Поддержка", callback_data: "support" }]
        ]
      }
    });
  }

  async sendGenerationFailure(chatId: number) {
    await this.bot.api.sendMessage(
      chatId,
      "Не получилось сгенерировать обложку. Кредит возвращен на баланс."
    );
  }

  async sendHookCandidates(chatId: number, projectId: string, hooks: Array<{ id: string; text: string }>) {
    await this.bot.api.sendMessage(chatId, "Выберите хук для обложки:", {
      reply_markup: {
        inline_keyboard: hooks.map((hook, index) => [
          { text: `${index + 1}. ${hook.text}`, callback_data: `hook:${projectId}:${hook.id}` }
        ])
      }
    });
  }

  async sendHookFailure(chatId: number) {
    await this.bot.api.sendMessage(chatId, "Не получилось подготовить хуки. Если это ссылка или видео, попробуйте вставить транскрипт вручную.");
  }
}
