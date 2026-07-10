import test from "node:test";
import assert from "node:assert/strict";
import { deriveDesignTextConstraints, designRequiresGuestFace } from "../packages/domain/src/designConstraints.js";
import { normalizeAndRankHooks } from "../packages/generation-ai/src/hookValidation.js";

const podcastRules = [
  "Hook mechanic: Two-person authority conversation with a bold extracted quote as the hook.",
  "Layout: Two large cropped speakers on left and right with a clean central text block.",
  "Text policy: Main hook carries the thumbnail; faces provide trust and emotion. Centered between faces, stacked in 2-3 lines. Extra-bold condensed sans, white uppercase, one yellow rectangle with black text.",
  "Max text words: 6"
].join("\n");

test("design constraints detect text limits and two-person templates", () => {
  const constraints = deriveDesignTextConstraints({
    slug: "podcast",
    title: "Podcast",
    promptRules: podcastRules
  });

  assert.equal(constraints.maxWords, 6);
  assert.equal(constraints.requiresGuestFace, true);
  assert.match(constraints.summary, /6 words maximum/i);
  assert.match(constraints.typography ?? "", /Extra-bold condensed sans/i);
});

test("guest face policy covers known two-person designs only", () => {
  assert.equal(designRequiresGuestFace({ slug: "podcast", promptRules: podcastRules }), true);
  assert.equal(designRequiresGuestFace({ slug: "podcast-countdown", promptRules: "" }), true);
  assert.equal(designRequiresGuestFace({ slug: "brain-rot-podcast", promptRules: "" }), true);
  assert.equal(designRequiresGuestFace({ slug: "center-stage", promptRules: "Single person centered at a desk." }), false);
});

test("hook ranking drops hooks that exceed design word limit", () => {
  const hooks = normalizeAndRankHooks(
    [
      { text: "Скрытая ошибка запуска", score: 70 },
      { text: "Почему эта длинная фраза полностью ломает референс дизайна", score: 100 }
    ],
    {
      context: { transcript: "", keywords: ["ошибка"], numbers: [] },
      maxWords: 3
    }
  );

  assert.deepEqual(hooks.map((hook) => hook.text), ["Скрытая ошибка запуска"]);
});
