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

export class OpenRouterPromptPlanner {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: { apiKey?: string; model?: string } = {}) {
    this.apiKey = config.apiKey ?? process.env.OPENROUTER_API_KEY ?? "";
    this.model = config.model ?? process.env.OPENROUTER_MODEL ?? "google/gemini-3.1-flash-image-preview";
  }

  async plan(input: PromptPlanningInput): Promise<PromptPlan> {
    if (!this.apiKey) {
      return this.fallbackPlan(input);
    }

    const messages = this.messages(input);
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
    });

    if (!response.ok) {
      throw new Error(`OpenRouter prompt planning failed: ${response.status} ${await response.text()}`);
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
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
  }): Promise<HookCandidate[]> {
    const hookContext = buildHookContext({ transcript: input.transcript, theme: input.theme });
    const maxWords = deriveMaxHookWords(input.templateRules);

    if (!this.apiKey) {
      return this.fallbackHooks(hookContext, maxWords);
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
              "Текст ролика:",
              input.transcript.slice(0, 12000)
            ].join("\n")
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter hook generation failed: ${response.status} ${await response.text()}`);
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
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
          roleContract,
          `Текст на обложке: ${input.wizard.hookText || "без текста"}.`,
          input.wizard.guestReferenceImageUrl
            ? "Есть второй человек/гость. Используй его как отдельное лицо второго участника, особенно для podcast/podcast countdown композиций."
            : "Второго лица/гостя нет.",
          "Сохрани композиционный скелет выбранного шаблона: расположение лица/объекта, зоны текста, крупность, глубину, направление взгляда/объекта, цветовую иерархию и характер шрифта.",
          "Промпт должен явно описать layout zones, typography/font feel, text placement, subject/object placement, foreground/background depth, color accents.",
          "Не копируй чужой дизайн один-в-один. Бери только композицию, настроение, контраст и читаемость.",
          "Промпт должен требовать крупный фокусный объект, чистую композицию, русский текст без ошибок, коммерческий thumbnail-look.",
          "Запрещено менять выбранный шаблон на другой формат композиции."
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
      ? "Use the uploaded face photo as identity reference; keep the person recognizable, flattering and expressive."
      : "Create an original thumbnail composition; do not copy any third-party design exactly.";
    const templateRule = input.template?.promptRules
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
        faceRule,
        input.wizard.guestReferenceImageUrl ? "Use the second uploaded face as a separate guest/person in the composition." : "",
        input.wizard.hookText ? `Large readable Russian cover text: "${input.wizard.hookText}".` : "No unnecessary text.",
        "Bold focal subject, clean background, strong contrast, readable at small size, no watermarks."
      ].join("\n");
    return this.validatedPlan(prompt, input, undefined, "fallback");
  }

  private fallbackHooks(context: HookContext, maxWords?: number): HookCandidate[] {
    return buildFallbackHooks(context, maxWords);
  }

  private templateGuide(input: PromptPlanningInput) {
    const templateName = input.template?.title ?? input.wizard.style;
    const templateSlug = input.template?.slug ?? input.wizard.templateSlug ?? "unknown";
    const rules = input.template?.promptRules?.trim() || "No saved template rules. Infer from the selected style title.";

    return [
      `Выбранный шаблон: ${templateName}.`,
      `Slug шаблона: ${templateSlug}.`,
      `Обязательные правила шаблона:\n${rules}`,
      "Эти правила важнее общих эстетических пожеланий."
    ].join("\n");
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
