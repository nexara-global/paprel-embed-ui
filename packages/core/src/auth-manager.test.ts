import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TokenManager } from "./auth.js";

describe("TokenManager public contract", () => {
  it("deduplicates concurrent token requests and reuses a healthy token", async () => {
    let calls = 0;
    const updates: string[] = [];
    const manager = new TokenManager({
      getTokens: async () => {
        calls += 1;
        await Promise.resolve();
        return { accessToken: `token-${calls}`, expiresAt: Date.now() + 3_600_000 };
      },
      onTokensUpdated: (tokens) => updates.push(tokens.accessToken),
    });

    const [first, second] = await Promise.all([manager.getValidTokens(), manager.getValidTokens()]);
    const cached = await manager.getValidTokens();

    assert.equal(calls, 1);
    assert.equal(first, second);
    assert.equal(cached.accessToken, "token-1");
    assert.deepEqual(updates, ["token-1"]);
    manager.invalidate();
  });

  it("fetches a new token after invalidation", async () => {
    let calls = 0;
    const manager = new TokenManager({
      getTokens: async () => ({ accessToken: `token-${++calls}`, expiresAt: Date.now() + 3_600_000 }),
    });

    assert.equal((await manager.getValidTokens()).accessToken, "token-1");
    manager.invalidate();
    assert.equal((await manager.getValidTokens()).accessToken, "token-2");
    manager.invalidate();
  });
});
