import { createPromptPreset, listPromptPresets, prisma, updatePromptPreset, type PromptPresetInput } from "@covers/db";
import type { FastifyInstance } from "fastify";

export async function presetRoutes(app: FastifyInstance) {
  app.get("/presets", async () => listPromptPresets(prisma));

  app.post<{ Body: PromptPresetInput }>("/presets", async (request, reply) => {
    const body = request.body;
    if (!body.slug || !body.title || !body.niche || !body.style || !body.promptTemplate) {
      return reply.code(400).send({ error: "slug, title, niche, style and promptTemplate are required" });
    }
    return createPromptPreset(prisma, body);
  });

  app.patch<{ Body: Partial<PromptPresetInput>; Params: { id: string } }>(
    "/presets/:id",
    async (request) => updatePromptPreset(prisma, request.params.id, request.body)
  );
}
