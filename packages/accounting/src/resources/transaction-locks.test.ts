import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTransactionLockListResponse } from "./transaction-locks.js";

test("normalizes transaction lock list envelopes", () => {
  const result = normalizeTransactionLockListResponse({
    total_records: 1,
    page_number: 2,
    page_size: 25,
    locks: [{
      id: "lock-1",
      lock_label: "FY close",
      module_scope: "GL",
      lock_level: "HARD",
      lock_from_date: "2026-01-01",
      lock_to_date: "2026-12-31",
      status: "ACTIVE",
    }],
  });

  assert.equal(result.totalRecords, 1);
  assert.equal(result.pageNumber, 2);
  assert.equal(result.locks[0]?.id, "lock-1");
  assert.equal(result.locks[0]?.lock_level, "HARD");
});

test("returns an empty list for malformed responses", () => {
  assert.deepEqual(normalizeTransactionLockListResponse(null), { locks: [] });
});
