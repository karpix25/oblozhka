import test from "node:test";
import assert from "node:assert/strict";
import { serializeAdminUser } from "../packages/db/src/adminSerializers.js";

test("admin user serialization converts telegram BigInt ids to strings", () => {
  const user = serializeAdminUser({
    id: "user_1",
    telegramId: 1234567890123456789n,
    username: "creator"
  });

  assert.equal(user.telegramId, "1234567890123456789");
  assert.doesNotThrow(() => JSON.stringify(user));
});
