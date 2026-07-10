import { MODERNIZATION_ACTIONS, modernizationActionLabel, type PaidPlan } from "@covers/domain";
import { Bot, InputFile } from "grammy";
import { generationProgressText, type GenerationProgressStage } from "./generationProgress.js";
import { hookProgressText, type HookProgressStage } from "./hookProgress.js";
import { ProgressAnimator, type ProgressMessage } from "./progressAnimator.js";

type GenerationDelivery = {
  generationId: string;
  plan?: PaidPlan | null;
  previewUrl: string;
  originalUrl: string;
  previewBytes?: Buffer;
  originalBytes?: Buffer;
};

export type GenerationProgressMessage = ProgressMessage;

export class TelegramNotifier {
  private readonly bot: Bot;
  private readonly progressAnimator: ProgressAnimator;

  constructor(token = process.env.BOT_TOKEN ?? "") {
    if (!token) {
      throw new Error("BOT_TOKEN is required for worker notifications.");
    }
    this.bot = new Bot(token);
    this.progressAnimator = new ProgressAnimator(async (progress, text) => {
      await this.bot.api.editMessageText(progress.chatId, progress.messageId, text);
    });
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

  async sendGenerationProgress(chatId: number) {
    const message = await this.bot.api.sendMessage(chatId, generationProgressText("references"));
    const progress = { chatId, messageId: message.message_id };
    this.progressAnimator.start(progress, (frame) => generationProgressText("references", frame));
    return progress;
  }

  async updateGenerationProgress(progress: GenerationProgressMessage | undefined, stage: GenerationProgressStage) {
    if (!progress) return;
    if (stage === "ready") {
      await this.progressAnimator.stop(progress);
      await this.editProgressMessage(progress, generationProgressText(stage));
      return;
    }
    await this.progressAnimator.update(progress, (frame) => generationProgressText(stage, frame));
  }

  async finishGenerationProgress(progress: GenerationProgressMessage | undefined, completed = false) {
    if (!progress) return;
    await this.progressAnimator.stop(progress);
    if (completed) return;
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

  async sendAutoHookReady(chatId: number, projectId: string, hookText?: string | null) {
    await this.bot.api.sendMessage(chatId, [
      "Текст для обложки выбран автоматически.",
      hookText ? `Хук: ${hookText}` : "Я взял самый сильный CTR-вариант под выбранный шаблон.",
      "",
      "Теперь выберите сохранённое лицо или загрузите новое фото — после этого сразу начну генерацию."
    ].join("\n"), {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Перейти к фото · 1 генерация", callback_data: `referenceface:choose:${projectId}` }],
          [{ text: "⬅️ Выбрать другой шаблон", callback_data: `project:change-template:${projectId}` }]
        ]
      }
    });
  }

  async sendHookProgress(chatId: number) {
    const message = await this.bot.api.sendMessage(chatId, hookProgressText("source"));
    const progress = { chatId, messageId: message.message_id };
    this.progressAnimator.start(progress, (frame) => hookProgressText("source", frame));
    return progress;
  }

  async updateHookProgress(progress: GenerationProgressMessage | undefined, stage: HookProgressStage) {
    if (!progress) return;
    if (stage === "ready") {
      await this.progressAnimator.stop(progress);
      await this.editProgressMessage(progress, hookProgressText(stage));
      return;
    }
    await this.progressAnimator.update(progress, (frame) => hookProgressText(stage, frame));
  }

  async finishHookProgress(progress: GenerationProgressMessage | undefined, completed: boolean) {
    if (completed) return;
    await this.finishGenerationProgress(progress, false);
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

  private async editProgressMessage(progress: ProgressMessage, text: string) {
    await this.bot.api.editMessageText(progress.chatId, progress.messageId, text).catch(() => undefined);
  }
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
