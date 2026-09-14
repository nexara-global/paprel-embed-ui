import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { journalAnchorId, normalizeJournalMutationResponse } from "./journals.js";

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

describe("journalAnchorId", () => {
  it("prefers anchor_id over the version-row id", () => {
    assert.equal(journalAnchorId({ id: "version-row", anchor_id: "anchor" }), "anchor");
  });

  it("falls back to id when anchor_id is missing", () => {
    assert.equal(journalAnchorId({ id: "version-row" }), "version-row");
  });
});
