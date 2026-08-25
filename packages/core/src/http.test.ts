import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { HttpClient } from "./http.js";
import { PaprelApiError } from "./errors.js";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe("HttpClient browser boundary", () => {
  it("adds auth, partner, query, and JSON body without exposing credentials", async () => {
    let request: { url: string; init?: RequestInit } | undefined;
    globalThis.fetch = async (input, init) => {
      request = { url: String(input), init };
      return new Response(JSON.stringify({ data: { ok: true } }), { status: 200 });
    };
    const client = new HttpClient("https://api.example.test/", {
      partnerDomain: "partner.example.test",
      getTokens: async () => ({ accessToken: "browser-token", expiresAt: Date.now() + 3_600_000 }),
    });

    const result = await client.request<{ ok: boolean }>("POST", "v1/items", {
      query: { page: 2, archived: false, omitted: undefined },
      body: { name: "Ledger" },
    });

    assert.deepEqual(result, { ok: true });
    assert.equal(request?.url, "https://api.example.test/v1/items?page=2&archived=false");
    const headers = request?.init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer browser-token");
    assert.equal(headers["x-partner-domain"], "partner.example.test");
    assert.equal(request?.init?.body, JSON.stringify({ name: "Ledger" }));
    assert.equal(JSON.stringify(request).includes("clientSecret"), false);
    client.dispose();
  });

  it("renews once and retries a 401 request", async () => {
    let tokenCalls = 0;
    const authorizations: string[] = [];
    globalThis.fetch = async (_input, init) => {
      authorizations.push((init?.headers as Record<string, string>).Authorization);
      return authorizations.length === 1
        ? new Response(JSON.stringify({ error: { message: "UNAUTHORIZED" } }), { status: 401 })
        : new Response(JSON.stringify({ data: { recovered: true } }), { status: 200 });
    };
    const client = new HttpClient("https://api.example.test", {
      getTokens: async () => ({ accessToken: `token-${++tokenCalls}`, expiresAt: Date.now() + 3_600_000 }),
    });

    assert.deepEqual(await client.request("GET", "/v1/company"), { recovered: true });
    assert.deepEqual(authorizations, ["Bearer token-1", "Bearer token-2"]);
    client.dispose();
  });

  it("returns field-aware API errors", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({
      error: { message: "VALIDATION_FAILED", description: ["LENGTH_3_TO_200"] },
    }), { status: 422 });
    const client = new HttpClient("https://api.example.test", {
      getTokens: async () => ({ accessToken: "token", expiresAt: Date.now() + 3_600_000 }),
    });

    await assert.rejects(
      client.request("POST", "/v1/accounting/journals", { body: {} }),
      (error: unknown) => error instanceof PaprelApiError
        && error.status === 422
        && error.fieldErrors.description?.[0] === "LENGTH_3_TO_200",
    );
    client.dispose();
  });

  it("rejects invalid JSON with a stable parse error", async () => {
    globalThis.fetch = async () => new Response("not-json", { status: 502 });
    const client = new HttpClient("https://api.example.test", {
      getTokens: async () => ({ accessToken: "token", expiresAt: Date.now() + 3_600_000 }),
    });

    await assert.rejects(client.request("GET", "/v1/company"), (error: unknown) => (
      error instanceof PaprelApiError && error.code === "PARSE_ERROR" && error.status === 502
    ));
    client.dispose();
  });
});
