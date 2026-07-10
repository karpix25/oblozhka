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

  async sendGenerationFailure(chatId: number, projectId?: string | null, creditRefunded = true) {
    await this.bot.api.sendMessage(chatId, [
      "Не получилось сгенерировать обложку.",
      creditRefunded
        ? "Генерация возвращена на баланс. Проект и выбранные настройки сохранены."
        : "Проект и выбранные настройки сохранены — списания не было."
    ].join("\n\n"), {
      reply_markup: {
        inline_keyboard: recoveryKeyboard(projectId)
      }
    });
  }

  async sendHookCandidates(chatId: number, projectId: string, hooks: Array<{ id: string; text: string }>) {
    await this.bot.api.sendMessage(chatId, "Текст готов. Первый вариант лучше всего подходит выбранному шаблону — можно взять его или выбрать другой.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "✓ Использовать рекомендованный", callback_data: `hook:auto:${projectId}` }],
          ...hooks.map((hook, index) => [
            { text: `${index + 1}. ${hook.text}`, callback_data: `hook:${projectId}:${hook.id}` }
          ])
        ]
      }
    });
  }

  async sendHookProgress(chatId: number) {
    const message = await this.bot.api.sendMessage(chatId, projectProgressText("Изучаю ролик и выделяю главную мысль"));
    return { chatId, messageId: message.message_id };
  }

  async updateHookProgress(progress: GenerationProgressMessage | undefined, stage: string) {
    if (!progress) return;
    await this.bot.api.editMessageText(progress.chatId, progress.messageId, projectProgressText(stage)).catch(() => undefined);
  }

  async finishHookProgress(progress: GenerationProgressMessage | undefined) {
    await this.finishGenerationProgress(progress);
  }

  async sendHookFailure(chatId: number, projectId: string) {
    await this.bot.api.sendMessage(chatId, [
      "Не получилось подготовить текст для обложки.",
      "Проект сохранён. Можно повторить анализ или продолжить и выбрать другой способ."
    ].join("\n\n"), {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Повторить анализ", callback_data: `project:retry-hooks:${projectId}` }],
          [{ text: "Продолжить проект", callback_data: `project:resume:${projectId}` }],
          [{ text: "Поддержка", callback_data: "support" }]
        ]
      }
    });
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

function projectProgressText(stage: string) {
  return [
    "⏳ Готовлю текст для обложки",
    "",
    `Сейчас: ${stage}.`,
    "Можно закрыть Telegram — я пришлю варианты сюда."
  ].join("\n");
}

function recoveryKeyboard(projectId?: string | null) {
  return [
    ...(projectId ? [[{ text: "Продолжить проект", callback_data: `project:resume:${projectId}` }]] : []),
    [{ text: "Создать новую обложку", callback_data: "project:start" }],
    [{ text: "Поддержка", callback_data: "support" }]
  ];
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
