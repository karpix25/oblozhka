import { Bot, InputFile } from "grammy";

type GenerationDelivery = {
  previewUrl: string;
  originalUrl: string;
  previewBytes: Buffer;
  originalBytes: Buffer;
};

export class TelegramNotifier {
  private readonly bot: Bot;

  constructor(token = process.env.BOT_TOKEN ?? "") {
    if (!token) {
      throw new Error("BOT_TOKEN is required for worker notifications.");
    }
    this.bot = new Bot(token);
  }

  async sendGenerationResult(chatId: number, delivery: GenerationDelivery) {
    const hasPublicFinalUrl = isPublicHttpUrl(delivery.originalUrl);
    await this.bot.api.sendPhoto(chatId, photoInput(delivery), {
      caption: [
        "Готово. Обложка сгенерирована.",
        "",
        hasPublicFinalUrl ? `Финальный файл: ${delivery.originalUrl}` : "Финальный PNG отправляю следующим сообщением."
      ].join("\n"),
      reply_markup: {
        inline_keyboard: [
          [{ text: "Создать еще обложку", callback_data: "project:start" }],
          [{ text: "Поддержка", callback_data: "support" }]
        ]
      }
    });

    if (!hasPublicFinalUrl) {
      await this.bot.api.sendDocument(chatId, new InputFile(delivery.originalBytes, "cover.png"));
    }
  }

  async sendGenerationFailure(chatId: number) {
    await this.bot.api.sendMessage(
      chatId,
      "Не получилось сгенерировать обложку. Баланс возвращен."
    );
  }

  async sendHookCandidates(chatId: number, projectId: string, hooks: Array<{ id: string; text: string }>) {
    await this.bot.api.sendMessage(chatId, "Я подготовил варианты текста для обложки. Можно выбрать вручную или доверить лучший мне.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Выбрать лучший автоматически", callback_data: `hook:auto:${projectId}` }],
          ...hooks.map((hook, index) => [
            { text: `${index + 1}. ${hook.text}`, callback_data: `hook:${projectId}:${hook.id}` }
          ])
        ]
      }
    });
  }

  async sendHookFailure(chatId: number) {
    await this.bot.api.sendMessage(chatId, "Не получилось подготовить текст для обложки. Если это ссылка или видео, попробуйте вставить текст ролика вручную.");
  }
}

function photoInput(delivery: GenerationDelivery) {
  if (isPublicHttpUrl(delivery.previewUrl)) return delivery.previewUrl;
  return new InputFile(delivery.previewBytes, "preview.jpg");
}

function isPublicHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}
