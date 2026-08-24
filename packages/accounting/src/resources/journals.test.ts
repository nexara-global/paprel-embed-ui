import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeJournalMutationResponse } from "./journals.js";

describe("normalizeJournalMutationResponse", () => {
  it("unwraps the singular journal response", () => {
    assert.deepEqual(normalizeJournalMutationResponse({ journal: { id: "journal-1" } }), {
      id: "journal-1",
    });
  });

  it("accepts the legacy one-item array during rollout", () => {
    assert.deepEqual(normalizeJournalMutationResponse({ journals: [{ id: "journal-1" }] }), {
      id: "journal-1",
    });
  });
});
