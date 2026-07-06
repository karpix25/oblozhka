import test from "node:test";
import assert from "node:assert/strict";
import { projectStatusAfterGeneration } from "../apps/worker/src/projectStatus.js";

test("generation result maps back to visible project status", () => {
  assert.equal(projectStatusAfterGeneration("SUCCEEDED"), "COMPLETED");
  assert.equal(projectStatusAfterGeneration("FAILED"), "FAILED");
});
