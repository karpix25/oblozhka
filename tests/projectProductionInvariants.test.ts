import test from "node:test";
import assert from "node:assert/strict";
import {
  ProjectTemplateCompatibilityError,
  assertTemplateCompatibleWithPlatform,
  recommendTemplates,
  type TemplateDefinition
} from "../packages/domain/src/index.js";
import { createGenerationFromProject } from "../packages/db/src/projectGenerations.js";
import { setProjectPlatform, setProjectTemplate } from "../packages/db/src/projects.js";

const templates: TemplateDefinition[] = [
  {
    slug: "youtube-generic",
    title: "Generic",
    platform: "YOUTUBE",
    promptRules: "single person composition",
    sortOrder: 20
  },
  {
    slug: "youtube-podcast",
    title: "Podcast",
    platform: "YOUTUBE",
    promptRules: "two speakers in a podcast studio",
    sortOrder: 10
  },
  {
    slug: "youtube-explainer",
    title: "Explainer",
    platform: "YOUTUBE",
    promptRules: "educational technology explanation",
    sortOrder: 30
  },
  {
    slug: "vertical-podcast",
    title: "Vertical podcast",
    platform: "INSTAGRAM_TIKTOK",
    promptRules: "podcast",
    sortOrder: 1
  }
];

test("template compatibility is an exact platform invariant", () => {
  assert.doesNotThrow(() => assertTemplateCompatibleWithPlatform("YOUTUBE", templates[0]!));
  assert.throws(
    () => assertTemplateCompatibleWithPlatform("INSTAGRAM_TIKTOK", templates[0]!),
    (error) => error instanceof ProjectTemplateCompatibilityError && error.code === "PROJECT_TEMPLATE_PLATFORM_MISMATCH"
  );
});

test("template recommendations filter platform, prefer topic matches and remain deterministic", () => {
  const first = recommendTemplates(templates, {
    platform: "YOUTUBE",
    topicText: "Technology explainer",
    guestFaceAvailable: false
  });
  const second = recommendTemplates([...templates].reverse(), {
    platform: "YOUTUBE",
    topicText: "Technology explainer",
    guestFaceAvailable: false
  });

  assert.deepEqual(first.map(({ template }) => template.slug), [
    "youtube-explainer",
    "youtube-generic",
    "youtube-podcast"
  ]);
  assert.deepEqual(second.map(({ template }) => template.slug), first.map(({ template }) => template.slug));
  assert.ok(first.every(({ template }) => template.platform === "YOUTUBE"));
});

test("setProjectTemplate rejects an inactive or platform-mismatched template before updating", async () => {
  let updateCalled = false;
  const tx = {
    project: {
      findUniqueOrThrow: async () => ({ platform: "YOUTUBE" }),
      update: async () => {
        updateCalled = true;
      }
    },
    template: {
      findUniqueOrThrow: async () => ({
        id: "vertical-1",
        slug: "vertical",
        platform: "INSTAGRAM_TIKTOK",
        isActive: true
      })
    }
  };
  const db = { $transaction: async (operation: (client: typeof tx) => unknown) => operation(tx) };

  await assert.rejects(
    () => setProjectTemplate(db as never, "project-1", "vertical-1"),
    (error) =>
      error instanceof Error &&
      error.name === "ProjectTemplateCompatibilityError" &&
      "code" in error &&
      error.code === "PROJECT_TEMPLATE_PLATFORM_MISMATCH"
  );
  assert.equal(updateCalled, false);
});

test("changing project format clears incompatible downstream choices", async () => {
  let deletedHooks = false;
  let updateData: Record<string, unknown> | undefined;
  const tx = {
    project: {
      findUniqueOrThrow: async () => ({ platform: "YOUTUBE" }),
      update: async (input: { data: Record<string, unknown> }) => {
        updateData = input.data;
        return input.data;
      }
    },
    hookCandidate: {
      deleteMany: async () => {
        deletedHooks = true;
      }
    }
  };
  const db = { $transaction: async (operation: (client: typeof tx) => unknown) => operation(tx) };

  await setProjectPlatform(db as never, "project-1", "INSTAGRAM_TIKTOK");

  assert.equal(deletedHooks, true);
  assert.deepEqual(updateData, {
    platform: "INSTAGRAM_TIKTOK",
    status: "SOURCE_READY",
    selectedTemplateId: null,
    selectedUserStyleAssetId: null,
    selectedHookId: null,
    guestFaceAssetId: null,
    errorMessage: null
  });
});

test("createGenerationFromProject returns the active primary generation without charging twice", async () => {
  let createCalled = false;
  const activeGeneration = {
    id: "generation-1",
    projectId: "project-1",
    userId: "user-1",
    status: "QUEUED",
    providerMeta: null,
    queuePriority: 50,
    createdAt: new Date("2026-01-01")
  };
  const tx = {
    project: {
      findUniqueOrThrow: async () => ({
        id: "project-1",
        userId: "user-1",
        platform: "YOUTUBE",
        selectedHook: { id: "hook-1", text: "Hook" },
        selectedTemplate: {
          id: "template-1",
          slug: "youtube-generic",
          title: "Generic",
          platform: "YOUTUBE",
          promptRules: "single person"
        },
        selectedUserStyleAsset: null,
        guestFaceAsset: null,
        transcripts: [],
        sourceAssets: []
      }),
      update: async () => ({})
    },
    generation: {
      findMany: async () => [activeGeneration],
      create: async () => {
        createCalled = true;
        return {};
      }
    }
  };
  const db = {
    $transaction: async (operation: (client: typeof tx) => unknown) => operation(tx)
  };

  const generation = await createGenerationFromProject(db as never, {
    projectId: "project-1",
    userId: "user-1",
    referenceImageUrl: "https://example.com/face.jpg",
    chargeCredits: true
  });

  assert.equal(generation, activeGeneration);
  assert.equal(createCalled, false);
});

test("createGenerationFromProject resolves a concurrent duplicate by request key", async () => {
  const existing = {
    id: "generation-existing",
    userId: "user-1",
    projectId: "project-1",
    requestKey: "callback:telegram-update-1"
  };
  const conflict = Object.assign(new Error("Unique constraint"), { code: "P2002" });
  const db = {
    $transaction: async () => {
      throw conflict;
    },
    generation: {
      findUnique: async () => existing
    }
  };

  const result = await createGenerationFromProject(db as never, {
    projectId: "project-1",
    userId: "user-1",
    referenceImageUrl: "https://example.com/face.jpg",
    chargeCredits: true,
    requestKey: "callback:telegram-update-1"
  });

  assert.equal(result.id, existing.id);
});
