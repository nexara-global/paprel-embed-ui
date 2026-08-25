import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HttpClient } from "@paprel/embed-core";
import { createEmbedI18n } from "./i18n/index.js";
import { normalizeIsoDate, todayIsoDate } from "./iso-date.js";
import { computeJournalTotals, normalizeApiLinesToForm, validateJournalFormLines } from "./journal-lines.js";
import { buildConfirmMatchPayload } from "./match-confirm.js";
import { flattenStatementSections, parseDateRangeParam } from "./report-sections.js";
import { createReportsResource } from "./resources/reports.js";
import { normalizeReconciliationListResponse } from "./resources/reconciliations.js";
import { normalizeTransactionListResponse } from "./resources/transactions.js";
import type { BankingTransaction, TransactionMatch } from "./types.js";

describe("public accounting data contracts", () => {
  it("normalizes API journal lines and calculates balanced totals", () => {
    const lines = normalizeApiLinesToForm([
      { account_id: "cash", description: "Receipt", type: "debit", amount: "125.50" },
      { account_id: "sales", description: "Sale", type: "credit", amount: 125.5 },
    ]);
    assert.deepEqual(lines.map(({ debit, credit }) => ({ debit, credit })), [
      { debit: "125.50", credit: "" }, { debit: "", credit: "125.5" },
    ]);
    assert.deepEqual(computeJournalTotals(lines), { debit: 125.5, credit: 125.5 });
    assert.deepEqual(validateJournalFormLines(lines), {});
  });

  it("detects invalid journal line invariants", () => {
    assert.deepEqual(validateJournalFormLines([{ account_id: "cash", debit: "10", credit: "5" }]), {
      lines: "DEBIT_CREDIT_MISMATCH",
      lines_0_debit: "BOTH_DEBIT_CREDIT_SET",
      lines_0_credit: "BOTH_DEBIT_CREDIT_SET",
    });
  });

  it("normalizes browser and API date values", () => {
    assert.equal(todayIsoDate(new Date(2026, 7, 25)), "2026-08-25");
    assert.equal(normalizeIsoDate("2026-08-25T13:00:00Z"), "2026-08-25");
    assert.deepEqual(parseDateRangeParam("2026-01-01,2026-03-31"), { from: "2026-01-01", to: "2026-03-31" });
  });

  it("builds an exact transaction-match mutation payload", () => {
    const transaction = { id: "txn-1", amount: "92.95", currency: "USD" } as BankingTransaction;
    const match = { entity: "invoice", entity_id: "inv-1", doc_amount: "92.95", doc_exchange_rate: "1" } as TransactionMatch;
    assert.deepEqual(buildConfirmMatchPayload(transaction, match), {
      entity: "invoice", currency: "USD",
      mapping: [{
        transaction_id: "txn-1", entity_id: "inv-1", amount: "92.95", currency: "USD",
        original_amount: "92.95", original_currency: "USD", exchange_rate: "1",
      }],
    });
  });

  it("uses the submitted FX amount and bank fallback for match confirmation", () => {
    const transaction = { id: "txn-1", amount: "92.95", currency: "USD" } as BankingTransaction;
    const fxPayload = buildConfirmMatchPayload(transaction, {
      entity: "invoice", entity_id: "inv-fx", doc_amount: "100", doc_currency: "EUR", doc_exchange_rate: "1.10",
    } as TransactionMatch);
    assert.equal(fxPayload.mapping[0].amount, "110.00");
    assert.equal(fxPayload.currency, "USD");

    const fallbackPayload = buildConfirmMatchPayload(transaction, {
      entity: "invoice", entity_id: "inv-zero", doc_amount: "0", doc_currency: "USD", doc_exchange_rate: "1",
    } as TransactionMatch);
    assert.equal(fallbackPayload.mapping[0].amount, "92.95");
    assert.equal(fallbackPayload.mapping[0].original_amount, "92.95");
  });

  it("provides localized operation and confirmation messages", () => {
    for (const locale of ["en", "ko", "es", "ru"] as const) {
      const i18n = createEmbedI18n(locale);
      assert.equal(i18n.t("confirmMatchPrompt", { label: "INV-1", amount: "110.00 USD" }).includes("{amount}"), false);
      assert.ok(i18n.t("accountCreatedSuccess").length > 0);
      assert.ok(i18n.t("journalUpdatedSuccess").length > 0);
      assert.ok(i18n.t("reconciliationCreatedSuccess").length > 0);
      assert.ok(i18n.t("transactionLockCreatedSuccess").length > 0);
    }
  });

  it("normalizes transaction and reconciliation envelopes defensively", () => {
    const transactions = normalizeTransactionListResponse({
      transactions: [{ id: 7, description: 99, matches: [{ transaction_id: 8, entity_id: 9 }] }],
      total_records: "1", page_number: "2", page_size: "25",
    });
    assert.equal(transactions.transactions[0].id, "7");
    assert.equal(transactions.transactions[0].matches?.[0].entity_id, "9");
    assert.deepEqual([transactions.totalRecords, transactions.pageNumber, transactions.pageSize], [1, 2, 25]);

    const reconciliations = normalizeReconciliationListResponse({
      reconciliations: [{ id: 4, banking_account_id: 5, closing_balance: 10, lines: [{ id: 6, journal_id: 7, journal_line_id: 8 }] }],
    });
    assert.equal(reconciliations.reconciliations[0].banking_account_id, "5");
    assert.equal(reconciliations.reconciliations[0].lines[0].journal_line_id, "8");
  });

  it("flattens nested report sections while preserving hierarchy", () => {
    const rows = flattenStatementSections([{
      account_name: "Assets", total: "125",
      account_subtype: [{ account_name: "Cash", total: 125, account: [{ account_name: "Operating account", balance: "125" }] }],
    }], createEmbedI18n("en"));
    assert.deepEqual(rows.map(({ kind, amount, level }) => ({ kind, amount, level })), [
      { kind: "section", amount: 125, level: 0 },
      { kind: "subtype", amount: 125, level: 1 },
      { kind: "account", amount: 125, level: 2 },
    ]);
  });

  it("maps report filters to stable API query names", async () => {
    const calls: unknown[][] = [];
    const http = { request: async (...args: unknown[]) => { calls.push(args); return {}; } } as unknown as HttpClient;
    const reports = createReportsResource(http);
    await reports.generalLedger({ dateRange: "2026-01-01,2026-08-25", currency: "USD", accountId: "cash" });
    assert.deepEqual(calls[0], ["GET", "/v1/reports/general-ledger", { query: {
      date_range: "2026-01-01,2026-08-25", currency: "USD", account: "cash",
    } }]);
  });
});
