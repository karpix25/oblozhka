import { MODERNIZATION_ACTIONS, modernizationActionLabel, type PaidPlan } from "@covers/domain";
import { Bot, InputFile } from "grammy";

type GenerationDelivery = {
  generationId: string;
  plan?: PaidPlan | null;
  previewUrl: string;
  originalUrl: string;
  previewBytes?: Buffer;
  originalBytes?: Buffer;
};

export type GenerationProgressMessage = {
  chatId: number;
  messageId: number;
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
        inline_keyboard: generationResultKeyboard(delivery.generationId, delivery.plan)
      }
    });

    if (!hasPublicFinalUrl) {
      if (!delivery.originalBytes) {
        throw new Error("Original bytes are required when final URL is not public.");
      }
      await this.bot.api.sendDocument(chatId, new InputFile(delivery.originalBytes, "cover.png"));
    }
  }

  async sendGenerationProgress(chatId: number, text = generationProgressText("Анализирую референсы и дизайн")) {
    const message = await this.bot.api.sendMessage(chatId, text);
    return { chatId, messageId: message.message_id };
  }

  async updateGenerationProgress(progress: GenerationProgressMessage | undefined, stage: string) {
    if (!progress) return;
    await this.bot.api.editMessageText(progress.chatId, progress.messageId, generationProgressText(stage)).catch(() => undefined);
  }

  async finishGenerationProgress(progress: GenerationProgressMessage | undefined) {
    if (!progress) return;
    await this.bot.api.deleteMessage(progress.chatId, progress.messageId).catch(() => undefined);
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

function generationProgressText(stage: string) {
  return [
    "⏳ Обложка в работе",
    "",
    `Сейчас: ${stage}.`,
    "Я пришлю результат сюда, когда генерация завершится."
  ].join("\n");
}

export function generationResultKeyboard(generationId: string, plan?: PaidPlan | null) {
  return [
    ...MODERNIZATION_ACTIONS.map((action) => [
      { text: modernizationActionLabel(action, plan), callback_data: `modernize:${action.id}:${generationId}` }
    ]),
    [{ text: "Создать еще обложку", callback_data: "project:start" }],
    [{ text: "Поддержка", callback_data: "support" }]
  ];
}

function photoInput(delivery: GenerationDelivery) {
  if (isPublicHttpUrl(delivery.previewUrl)) return delivery.previewUrl;
  if (!delivery.previewBytes) {
    throw new Error("Preview bytes are required when preview URL is not public.");
  }
  return new InputFile(delivery.previewBytes, "preview.jpg");
}

function isPublicHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}
