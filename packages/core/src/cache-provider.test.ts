import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TtlCache } from "./cache.js";
import { clearConfiguredEmbedAuth, configureEmbedAuth, getConfiguredEmbedAuth } from "./provider.js";

describe("shared embed primitives", () => {
  it("stores, deletes, and clears cached values", () => {
    const cache = new TtlCache<number>(10_000);
    cache.set("balance", 42);
    assert.equal(cache.get("balance"), 42);
    cache.delete("balance");
    assert.equal(cache.get("balance"), undefined);
    cache.set("one", 1);
    cache.set("two", 2);
    cache.clear();
    assert.equal(cache.get("one"), undefined);
    assert.equal(cache.get("two"), undefined);
  });

  it("expires stale cache entries", () => {
    const cache = new TtlCache<string>(-1);
    cache.set("stale", "value");
    assert.equal(cache.get("stale"), undefined);
  });

  it("requires explicit auth configuration and supports cleanup", () => {
    clearConfiguredEmbedAuth();
    assert.throws(() => getConfiguredEmbedAuth(), /must be called/i);
    const auth = { getTokens: async () => ({ accessToken: "token", expiresAt: Date.now() + 60_000 }) };
    configureEmbedAuth(auth);
    assert.equal(getConfiguredEmbedAuth(), auth);
    clearConfiguredEmbedAuth();
    assert.throws(() => getConfiguredEmbedAuth(), /must be called/i);
  });
});
