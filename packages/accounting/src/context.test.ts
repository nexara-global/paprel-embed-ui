import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getEmbedClient } from "./context.js";

describe("getEmbedClient", () => {
  it("throws when configure was not called", () => {
    assert.throws(() => getEmbedClient(), /configureAccounting/);
  });
});
