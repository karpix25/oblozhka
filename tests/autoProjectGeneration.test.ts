import test from "node:test";
import assert from "node:assert/strict";
import { startProjectGenerationAfterHook } from "../apps/worker/src/autoProjectGeneration.js";

test("auto generation starts with the latest saved face after hook selection", async () => {
  const calls: string[] = [];
  const result = await startProjectGenerationAfterHook(
    { projectId: "project-1", userTelegramId: 123 },
    {
      findProject: async () => projectFixture(),
      listFaces: async () => [{ imageUrl: "https://cdn.example/face.png" }],
      createGeneration: async (_db, input) => {
        calls.push(`create:${input.referenceImageUrl}:${input.chargeCredits}:${input.requestKey}`);
        return generationFixture("generation-1");
      },
      enqueueGeneration: async (generation, userTelegramId) => {
        calls.push(`enqueue:${generation.id}:${userTelegramId}`);
      }
    } as never
  );

  assert.deepEqual(result, { status: "queued", hookText: "СКРЫТАЯ СЛЕЖКА", generationId: "generation-1" });
  assert.deepEqual(calls, [
    "create:https://cdn.example/face.png:true:auto-project:project-1:hook:hook-1",
    "enqueue:generation-1:123"
  ]);
});

test("auto generation asks for a reference when no saved face exists", async () => {
  const result = await startProjectGenerationAfterHook(
    { projectId: "project-1", userTelegramId: 123 },
    {
      findProject: async () => projectFixture(),
      listFaces: async () => [],
      createGeneration: async () => {
        throw new Error("should not create generation without reference");
      },
      enqueueGeneration: async () => {
        throw new Error("should not enqueue generation without reference");
      }
    } as never
  );

  assert.deepEqual(result, { status: "needs-reference", hookText: "СКРЫТАЯ СЛЕЖКА" });
});

test("auto generation can use a faceless source preview as reference", async () => {
  const result = await startProjectGenerationAfterHook(
    { projectId: "project-1", userTelegramId: 123 },
    {
      findProject: async () =>
        projectFixture({
          platform: "FACELESS",
          sourceAssets: [{ previewImageUrl: "https://cdn.example/preview.jpg" }]
        }),
      listFaces: async () => {
        throw new Error("faceless generation should not load face assets");
      },
      createGeneration: async (_db, input) => {
        assert.equal(input.referenceImageUrl, "https://cdn.example/preview.jpg");
        return generationFixture("generation-2");
      },
      enqueueGeneration: async () => undefined
    } as never
  );

  assert.deepEqual(result, { status: "queued", hookText: "СКРЫТАЯ СЛЕЖКА", generationId: "generation-2" });
});

function projectFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "project-1",
    userId: "user-1",
    platform: "YOUTUBE",
    selectedHook: { id: "hook-1", text: "СКРЫТАЯ СЛЕЖКА" },
    selectedTemplate: { id: "template-1" },
    selectedUserStyleAsset: null,
    sourceAssets: [],
    ...overrides
  };
}

function generationFixture(id: string) {
  return {
    id,
    queuePriority: 50,
    projectId: "project-1"
  };
}
