# Prompt: Wire @paprel/embed-accounting widgets

Use when the **BFF already exists** (`/api/embed-token` returns `accessToken` + `expiresAt`).

---

## Task

Add Paprel embedded accounting widgets to my app.

**Stack:** {React | Vue 3 | vanilla TS | Next.js page | …}  
**Page/route:** {path or component name}  
**Widgets:** {e.g. paprel-journal-list, paprel-journal-detail, paprel-chart-of-accounts}

---

## Reference

- Configure pattern: `paprel-embed-ui-examples/apps/real-estate-accounting/src/session/session-manager.ts` (search `configureAccounting`)
- BFF contract: `paprel-embed/docs/partner-integration/bff-contract.md`
- Widget composition: `paprel-embed-ui-examples/apps/real-estate-accounting/src/pages/pages.ts`

---

## Requirements

1. Install: `npm install @paprel/embed-core @paprel/embed-accounting`
2. Import `configureAccounting` from `@paprel/embed-accounting`; the same import registers components and includes their styles
3. Call `configureAccounting` before mounting custom elements
4. `auth.getTokens()` → `fetch("/api/embed-token")` mapping per bff-contract.md
5. Set `auth.partnerDomain` to match App Connect client
6. Mount custom elements; handle events:
   - `journal-select` → navigate with `journalId`
   - `bank-account-select` → navigate with `accountId`
   - `transaction-select` → navigate with `transactionId`

---

## Widget attributes (common)

| Element | Key attributes |
|---------|----------------|
| `paprel-chart-of-accounts` | `tree`, `show-archived` |
| `paprel-journal-list` | `page`, `page-size` |
| `paprel-journal-detail` | `journal-id` |
| `paprel-journal-editor` | `journal-id`, `mode`, `currency` |
| `paprel-trial-balance` | `as-of-date` (YYYY-MM-DD) |
| `paprel-banking-list` | (none) |
| `paprel-transaction-inbox` | `bank-account-id`, `inbox` |

---

## React / Vue note

Web components work in any framework. Use refs or `@journal-select` listeners on the DOM element. Do not wrap with heavy adapters unless needed.

---

## Deliverables

- Page/component with working widgets
- `getTokens` wired to existing BFF
- Brief note on required App Connect scopes for chosen widgets
