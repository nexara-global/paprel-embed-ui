import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Window } from "happy-dom";

const window = new Window({ url: "https://partner.example.test" });
Object.assign(globalThis, {
  window,
  document: window.document,
  customElements: window.customElements,
  HTMLElement: window.HTMLElement,
  Element: window.Element,
  Node: window.Node,
  ShadowRoot: window.ShadowRoot,
  Document: window.Document,
  CSSStyleSheet: window.CSSStyleSheet,
  MutationObserver: window.MutationObserver,
});

const accountingTags = [
  "paprel-chart-of-accounts",
  "paprel-account-select",
  "paprel-account-form",
  "paprel-account-detail",
  "paprel-journal-list",
  "paprel-journal-detail",
  "paprel-journal-editor",
  "paprel-banking-list",
  "paprel-transaction-inbox",
  "paprel-bank-account-detail",
  "paprel-transaction-detail",
  "paprel-transaction-match-sheet",
  "paprel-reconciliation-list",
  "paprel-reconciliation-detail",
  "paprel-reconciliation-form",
  "paprel-transaction-locks",
] as const;

const reportTags = [
  "paprel-trial-balance",
  "paprel-balance-sheet",
  "paprel-income-statement",
  "paprel-cash-flow",
  "paprel-general-ledger",
] as const;

describe("published Web Component registration", () => {
  it("registers every accounting element from the package entry point", async () => {
    await import("../packages/accounting/dist/index.js");
    for (const tag of accountingTags) {
      assert.ok(customElements.get(tag), `${tag} was not registered`);
      assert.ok(document.createElement(tag) instanceof HTMLElement);
    }
  });

  it("registers every report element from the package entry point", async () => {
    await import("../packages/reports/dist/index.js");
    for (const tag of reportTags) {
      assert.ok(customElements.get(tag), `${tag} was not registered`);
      assert.ok(document.createElement(tag) instanceof HTMLElement);
    }
  });
});
