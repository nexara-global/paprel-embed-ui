import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renewalBufferMs, scheduleRenewalAt, validateEmbedTokenSet } from "./auth.js";
import { parseEnvelope, PaprelApiError } from "./errors.js";

describe("renewalBufferMs", () => {
  it("uses 60s minimum for short TTL", () => {
    const now = Date.now();
    const expiresAt = now + 120_000;
    assert.equal(renewalBufferMs(expiresAt, now), 60_000);
  });

  it("caps at 15 minutes", () => {
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000;
    assert.equal(renewalBufferMs(expiresAt, now), 15 * 60 * 1000);
  });
});

describe("scheduleRenewalAt", () => {
  it("renews before expiry", () => {
    const now = 1_000_000;
    const expiresAt = now + 600_000;
    assert.ok(scheduleRenewalAt(expiresAt, now) < expiresAt);
  });
});

describe("validateEmbedTokenSet", () => {
  it("accepts a non-empty future token", () => {
    assert.doesNotThrow(() => validateEmbedTokenSet({ accessToken: "token", expiresAt: 2_000 }, 1_000));
  });

  it("rejects missing and expired token data", () => {
    assert.throws(() => validateEmbedTokenSet({ accessToken: "", expiresAt: 2_000 }, 1_000), /accessToken/);
    assert.throws(() => validateEmbedTokenSet({ accessToken: "token", expiresAt: 1_000 }, 1_000), /expiresAt/);
  });
});

describe("parseEnvelope", () => {
  it("unwraps data", () => {
    assert.deepEqual(parseEnvelope(200, { data: { ok: true } }), { ok: true });
  });

  it("throws PaprelApiError on validation", () => {
    assert.throws(
      () =>
        parseEnvelope(400, {
          error: {
            message: "VALIDATION_FAILED",
            validation: [{ field: "date", message: "required" }],
          },
        }),
      (err: unknown) => {
        assert.ok(err instanceof PaprelApiError);
        assert.deepEqual((err as PaprelApiError).fieldErrors, { date: ["required"] });
        return true;
      },
    );
  });

  it("normalizes validation fields returned directly under error", () => {
    assert.throws(
      () =>
        parseEnvelope(422, {
          error: {
            description: ["LENGTH_3_TO_200"],
            lines_0_account_id: ["INVALID_VALUE"],
          },
        }),
      (err: unknown) => {
        assert.ok(err instanceof PaprelApiError);
        assert.deepEqual(err.fieldErrors, {
          description: ["LENGTH_3_TO_200"],
          lines_0_account_id: ["INVALID_VALUE"],
        });
        return true;
      },
    );
  });
});
