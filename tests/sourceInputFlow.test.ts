import test from "node:test";
import assert from "node:assert/strict";
import {
  canAcceptVideoSource,
  classifyTextSource,
  sourceStepForType
} from "../apps/bot/src/projectFlow/sourceInputFlow.js";

test("source input recognizes links and treats other messages as transcript text", () => {
  assert.deepEqual(classifyTextSource(" https://youtube.com/watch?v=123 "), {
    sourceType: "LINK",
    source: { url: "https://youtube.com/watch?v=123" }
  });
  assert.deepEqual(classifyTextSource("Короткое описание будущего ролика"), {
    sourceType: "TRANSCRIPT",
    source: { text: "Короткое описание будущего ролика" }
  });
  assert.equal(classifyTextSource("   "), null);
});

test("automatic source input accepts video without a preliminary button", () => {
  assert.equal(canAcceptVideoSource("sourceInput"), true);
  assert.equal(canAcceptVideoSource("sourceVideo"), true);
  assert.equal(canAcceptVideoSource("idle"), false);
});

test("legacy source buttons still map to their dedicated steps", () => {
  assert.equal(sourceStepForType("LINK"), "sourceLink");
  assert.equal(sourceStepForType("VIDEO"), "sourceVideo");
  assert.equal(sourceStepForType("TRANSCRIPT"), "sourceTranscript");
});
