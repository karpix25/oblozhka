import { buildFallbackHooks } from "./hookFallback.js";
import { buildHookContext } from "./hookContext.js";
import { deriveMaxHookWords } from "./hookText.js";
import type { HookCandidate, HookContext } from "./hookTypes.js";
import { normalizeAndRankHooks } from "./hookValidation.js";
import { repairImagePrompt, validateImagePrompt } from "./promptValidator.js";
import { referenceRoleContract } from "./referenceContract.js";
import type { PromptPlan, PromptPlanningInput } from "./types.js";

type OpenRouterMessage = {
  role: "system" | "user";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
};

type OpenRouterRequestOptions = {
  signal?: AbortSignal;
};

export class OpenRouterPromptPlanner {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config: { apiKey?: string; model?: string; timeoutMs?: number } = {}) {
    this.apiKey = config.apiKey ?? process.env.OPENROUTER_API_KEY ?? "";
    this.model = config.model ?? process.env.OPENROUTER_MODEL ?? "google/gemini-3.1-flash-image-preview";
    this.timeoutMs = config.timeoutMs ?? positiveNumber(process.env.OPENROUTER_TIMEOUT_MS, 120000);
  }

  async plan(input: PromptPlanningInput, options: OpenRouterRequestOptions = {}): Promise<PromptPlan> {
    if (!this.apiKey) {
      return this.fallbackPlan(input);
    }

    const messages = this.messages(input);
    const response = await fetchOpenRouterText(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
          "http-referer": process.env.OPENROUTER_SITE_URL ?? "",
          "x-title": process.env.OPENROUTER_APP_NAME ?? "Cover Bot"
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.35,
          response_format: { type: "json_object" }
        })
      },
      {
        description: "OpenRouter prompt planning",
        signal: options.signal,
        timeoutMs: this.timeoutMs
      }
    );

    if (!response.ok) {
      throw new Error(`OpenRouter prompt planning failed: ${response.status} ${response.text}`);
    }

    const json = JSON.parse(response.text) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenRouter returned an empty prompt plan.");
    }

    return this.parsePlan(content, input);
  }

  async generateHooks(input: {
    transcript: string;
    platform: string;
    theme?: string;
    templateTitle?: string;
    templateRules?: string;
    designText?: {
      maxWords?: number;
      textPlacement?: string;
      typography?: string;
      summary: string;
    };
  }, options: OpenRouterRequestOptions = {}): Promise<HookCandidate[]> {
    const hookContext = buildHookContext({ transcript: input.transcript, theme: input.theme });
    const maxWords = input.designText?.maxWords ?? deriveMaxHookWords(input.templateRules);

    if (!this.apiKey) {
      return this.fallbackHooks(hookContext, maxWords);
    }

    const response = await fetchOpenRouterText(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
          "http-referer": process.env.OPENROUTER_SITE_URL ?? "",
          "x-title": process.env.OPENROUTER_APP_NAME ?? "Cover Bot"
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.55,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "Ты редактор viral thumbnails. Пишешь короткие CTR-хуки для текста на обложке, не кликбейт-обман."
            },
            {
              role: "user",
              content: [
                "Верни JSON: {\"hooks\":[{\"text\":\"...\",\"angle\":\"...\",\"score\":90}]}",
                "Нужно 5 коротких русских hook-текстов для обложки.",
                "До 5 слов, крупно читается в превью, усиливает конфликт/интригу.",
                "Каждый хук должен опираться на конкретику из ролика: объект, цифру, цену, ошибку, контраст, результат или скрытую причину.",
                "Не используй общие фразы без смысла: Я НЕ ОЖИДАЛ, ТАК НЕЛЬЗЯ, ВСЁ ИЗМЕНИЛОСЬ, ЭТО ВАЖНО, СМОТРИ ДО КОНЦА.",
                "Подбирай CTR-механику под шаблон: contrast, mistake, hidden reason, deadline/countdown, metric, transformation, object proof.",
                `Платформа: ${input.platform}.`,
                `Тема: ${input.theme ?? "не указана"}.`,
                `Шаблон: ${input.templateTitle ?? "не выбран"}.`,
                `Правила шаблона: ${input.templateRules ?? "нет"}.`,
                input.designText?.summary ? `Ограничения дизайна для текста: ${input.designText.summary}` : "",
                input.designText?.maxWords ? `Жёсткий лимит: максимум ${input.designText.maxWords} слов в хуке.` : "",
                input.designText?.textPlacement ? `Зона текста: ${input.designText.textPlacement}.` : "",
                input.designText?.typography ? `Типографика референса: ${input.designText.typography}.` : "",
                "Не предлагай хук, который не поместится в выбранный дизайн или сломает композицию.",
                "Текст ролика:",
                input.transcript.slice(0, 12000)
              ].join("\n")
            }
          ]
        })
      },
      {
        description: "OpenRouter hook generation",
        signal: options.signal,
        timeoutMs: this.timeoutMs
      }
    );

    if (!response.ok) {
      throw new Error(`OpenRouter hook generation failed: ${response.status} ${response.text}`);
    }

    const json = JSON.parse(response.text) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return this.fallbackHooks(hookContext, maxWords);

    try {
      const parsed = JSON.parse(content) as { hooks?: Array<{ text?: string; angle?: string; score?: number }> };
      const rawHooks = parsed.hooks
        ?.filter((hook) => hook.text)
        .map((hook) => ({ text: hook.text!, angle: hook.angle, score: hook.score ?? 0 }));
      const hooks = normalizeAndRankHooks(rawHooks ?? [], { context: hookContext, maxWords });
      return hooks.length ? hooks : this.fallbackHooks(hookContext, maxWords);
    } catch {
      return this.fallbackHooks(hookContext, maxWords);
    }
  }

  private messages(input: PromptPlanningInput): OpenRouterMessage[] {
    const templateGuide = this.templateGuide(input);
    const roleContract = referenceRoleContract(input);
    const userContent: OpenRouterMessage["content"] = [
      {
        type: "text",
        text: [
          "Собери production-ready prompt для генератора YouTube/vertical thumbnail.",
          "Ответ строго JSON: {\"referenceAnalysis\":\"...\",\"prompt\":\"...\"}.",
          `Формат: ${input.formatDescription}, ${input.aspectRatio}.`,
          `Режим референса: ${input.wizard.referenceMode}.`,
          `Тема: ${input.wizard.topic}.`,
          `Ниша: ${input.wizard.niche}.`,
          `Стиль: ${input.wizard.style}.`,
          templateGuide,
          this.designTextGuide(input),
          roleContract,
          `Текст на обложке: ${input.wizard.hookText || "без текста"}.`,
          input.wizard.guestReferenceImageUrl
            ? "Есть второй человек/гость. Используй его как отдельное лицо второго участника, особенно для podcast/podcast countdown композиций."
            : "Второго лица/гостя нет.",
          input.wizard.referenceMode === "FACE"
            ? "Главное лицо должно быть максимально похоже на Image 1: тот же человек, узнаваемая геометрия лица, тон кожи, глаза, нос, рот, линия волос и пропорции. Не делай усреднённое похожее лицо."
            : "Если лица пользователя нет, не выдумывай сходство с человеком из шаблона.",
          "Сохрани композиционный скелет выбранного шаблона или пользовательского стиля: расположение лица/объекта, зоны текста, крупность, глубину, направление взгляда/объекта, цветовую иерархию и характер шрифта.",
          "Шаблон и пользовательский стиль не являются источником личности: нельзя брать с них черты лица, волосы, возраст, выражение, этничность или персональное сходство.",
          "Промпт должен явно описать layout zones, typography/font feel, text placement, subject/object placement, foreground/background depth, color accents.",
          "Не копируй чужой дизайн один-в-один. Бери только композицию, настроение, контраст и читаемость.",
          "Промпт должен требовать крупный фокусный объект, чистую композицию, русский текст без ошибок, коммерческий thumbnail-look.",
          "Запрещено менять выбранный стиль на другой формат композиции."
        ].join("\n")
      }
    ];

    if (input.wizard.referenceImageUrl) {
      userContent.push({ type: "image_url", image_url: { url: input.wizard.referenceImageUrl } });
    }
    if (input.wizard.guestReferenceImageUrl) {
      userContent.push({ type: "image_url", image_url: { url: input.wizard.guestReferenceImageUrl } });
    }
    if (input.templateReferenceImageUrl) {
      userContent.push({ type: "image_url", image_url: { url: input.templateReferenceImageUrl } });
    }
    if (input.userStyle?.imageUrl) {
      userContent.push({ type: "image_url", image_url: { url: input.userStyle.imageUrl } });
    }

    return [
      {
        role: "system",
        content: "Ты арт-директор YouTube thumbnails. Пишешь лаконичные, управляемые промпты для image-to-image генерации."
      },
      { role: "user", content: userContent }
    ];
  }

  private parsePlan(content: string, input: PromptPlanningInput): PromptPlan {
    try {
      const parsed = JSON.parse(content) as { prompt?: string; referenceAnalysis?: string };
      if (parsed.prompt) {
        return this.validatedPlan(parsed.prompt, input, parsed.referenceAnalysis, this.model);
      }
    } catch {
      return this.validatedPlan(content, input, undefined, this.model);
    }
    return this.fallbackPlan(input);
  }

  private fallbackPlan(input: PromptPlanningInput): PromptPlan {
    const faceRule = input.wizard.referenceMode === "FACE"
      ? "Use Image 1 as the strict identity source of truth; keep the same person highly recognizable with matching facial geometry, skin tone, eyes, nose, mouth, hairline and proportions. Do not create a generic similar face."
      : "Create an original thumbnail composition; do not copy any third-party design exactly.";
    const templateRule = input.userStyle?.promptRules
      ? [
          `Mandatory custom user style: ${input.userStyle.title ?? input.wizard.style}.`,
          `Custom style rules: ${input.userStyle.promptRules}.`,
          "Use the custom style reference as style only: composition rhythm, colors, typography feel and text zones. Do not copy exact content, faces, hair, expressions or personal likeness."
        ].join(" ")
      : input.template?.promptRules
      ? [
          `Mandatory template: ${input.template.title ?? input.wizard.style}.`,
          `Template rules: ${input.template.promptRules}.`,
          "Preserve the template skeleton: text zones, font character, subject/object positions, scale, depth, color hierarchy and visual rhythm."
        ].join(" ")
      : `Style: ${input.wizard.style}.`;

    const prompt = [
        `Create a high-converting ${input.formatDescription} thumbnail, aspect ratio ${input.aspectRatio}.`,
        `Topic: ${input.wizard.topic}. Niche: ${input.wizard.niche}. ${templateRule}`,
        referenceRoleContract(input),
        input.designText?.summary ? `Design text contract: ${input.designText.summary}` : "",
        faceRule,
        input.wizard.guestReferenceImageUrl ? "Use the second uploaded face as a separate guest/person in the composition." : "",
        "Template/style references control layout and design only; do not borrow facial features from them.",
        input.wizard.hookText ? `Large readable Russian cover text: "${input.wizard.hookText}".` : "No unnecessary text.",
        "Bold focal subject, clean background, strong contrast, readable at small size, no watermarks."
      ].join("\n");
    return this.validatedPlan(prompt, input, undefined, "fallback");
  }

  private fallbackHooks(context: HookContext, maxWords?: number): HookCandidate[] {
    return buildFallbackHooks(context, maxWords);
  }

  private templateGuide(input: PromptPlanningInput) {
    if (input.userStyle) {
      return [
        `Выбран пользовательский стиль: ${input.userStyle.title ?? input.wizard.style}.`,
        `Правила пользовательского стиля:\n${input.userStyle.promptRules ?? "Use the uploaded style reference as a style guide."}`,
        "Картинка пользовательского стиля является style reference: брать композиционный ритм, контраст, цветовую палитру, характер типографики и зоны текста.",
        "Не копировать точный контент, лица, черты лица, волосы, выражение, бренды, логотипы и текст из style reference."
      ].join("\n");
    }

    const templateName = input.template?.title ?? input.wizard.style;
    const templateSlug = input.template?.slug ?? input.wizard.templateSlug ?? "unknown";
    const rules = input.template?.promptRules?.trim() || "No saved template rules. Infer from the selected style title.";

    return [
      `Выбранный шаблон: ${templateName}.`,
      `Slug шаблона: ${templateSlug}.`,
      `Обязательные правила шаблона:\n${rules}`,
      "Шаблон не является face reference: не брать с него черты лица, волосы, выражение, возраст, этничность или персональное сходство.",
      "Эти правила важнее общих эстетических пожеланий."
    ].join("\n");
  }

  private designTextGuide(input: PromptPlanningInput) {
    if (!input.designText?.summary) return "";
    return [
      "Typography and hook-fit contract:",
      input.designText.summary,
      input.designText.maxWords ? `Do not exceed ${input.designText.maxWords} words for the main cover text.` : "",
      input.designText.textPlacement ? `Keep text inside this zone: ${input.designText.textPlacement}.` : "",
      input.designText.typography ? `Match this typography mechanic: ${input.designText.typography}.` : "",
      "When a template preview or user style image is attached, visually inspect its typography: font family feel, weight, casing, line breaks, outline, shadow, fill color, stroke color, spacing and text block proportions.",
      "Preserve the reference's font weight, casing, line count, outline/shadow feel, color hierarchy and text block scale."
    ].filter(Boolean).join("\n");
  }

  private validatedPlan(prompt: string, input: PromptPlanningInput, referenceAnalysis: string | undefined, model: string): PromptPlan {
    const validation = validateImagePrompt(prompt, input);
    const finalPrompt = validation.ok ? prompt : repairImagePrompt(prompt, input, validation.issues);
    return {
      prompt: finalPrompt,
      referenceAnalysis,
      model,
      validationIssues: validation.issues.length ? validation.issues : undefined
    };
  }
}

async function fetchOpenRouterText(
  url: string,
  init: RequestInit,
  options: { description: string; signal?: AbortSignal; timeoutMs: number }
): Promise<{ ok: boolean; status: number; text: string }> {
  let lastResponse: { ok: boolean; status: number; text: string } | undefined;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetchTextWithTimeout(url, init, options);
      if (response.ok || !isRetryableStatus(response.status) || attempt === 2) {
        return response;
      }
      lastResponse = response;
    } catch (error) {
      lastError = error;
      if (options.signal?.aborted || isAbortError(error) || isTimeoutError(error) || attempt === 2) {
        throw error;
      }
    }
    await sleep(attempt * 250, options.signal);
  }
  if (lastResponse) return lastResponse;
  throw lastError instanceof Error ? lastError : new Error(`${options.description} failed.`);
}

async function fetchTextWithTimeout(
  url: string,
  init: RequestInit,
  options: { description: string; signal?: AbortSignal; timeoutMs: number }
): Promise<{ ok: boolean; status: number; text: string }> {
  return withTimeoutSignal(options, async (signal) => {
    const response = await fetch(url, { ...init, signal });
    return {
      ok: response.ok,
      status: response.status,
      text: await response.text()
    };
  });
}

async function withTimeoutSignal<T>(
  options: { description: string; signal?: AbortSignal; timeoutMs: number },
  action: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs);
  const abortFromParent = () => controller.abort(options.signal?.reason);

  if (options.signal?.aborted) {
    abortFromParent();
  } else {
    options.signal?.addEventListener("abort", abortFromParent, { once: true });
  }

  try {
    return await action(controller.signal);
  } catch (error) {
    if (timedOut) {
      throw new Error(`${options.description} timed out after ${options.timeoutMs}ms.`, { cause: error });
    }
    if (isAbortError(error) || options.signal?.aborted) {
      throw new Error(`${options.description} was aborted.`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromParent);
  }
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message.includes(" timed out after ");
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new Error("OpenRouter request was aborted."));
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener("abort", abort);
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error("OpenRouter request was aborted."));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}
