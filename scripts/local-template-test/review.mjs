export async function reviewPair(input) {
  if (!process.env.OPENROUTER_API_KEY) return { score: null, notes: "OPENROUTER_API_KEY is missing." };

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "content-type": "application/json",
      "http-referer": process.env.OPENROUTER_SITE_URL ?? "",
      "x-title": process.env.OPENROUTER_APP_NAME ?? "Cover Bot Local Test"
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "google/gemini-3.1-flash-image-preview",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a strict YouTube thumbnail art director. Compare the generated image to the template reference."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Return JSON: {\"score\":0-100,\"composition\":\"...\",\"typography\":\"...\",\"subject\":\"...\",\"fix\":\"...\"}.",
                `Template: ${input.template.title}.`,
                `Expected rules:\n${input.template.promptRules}`,
                `Hook text: ${input.hook}`,
                "Image 1 is the template reference. Image 2 is the generated cover."
              ].join("\n")
            },
            { type: "image_url", image_url: { url: input.templateUrl } },
            { type: "image_url", image_url: { url: input.generatedUrl } }
          ]
        }
      ]
    })
  });

  if (!response.ok) return { score: null, notes: `Review failed: ${response.status}` };

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  try {
    return JSON.parse(content);
  } catch {
    return { score: null, notes: content ?? "Empty review." };
  }
}
