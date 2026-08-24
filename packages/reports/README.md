# @paprel/reports

The complete Paprel financial reports module: Trial Balance, Balance Sheet, Income Statement, Cash Flow, and General Ledger.

```ts
import { configureAccounting } from "@paprel/accounting";
import "@paprel/reports";
```

Configure accounting once, then mount any report:

```html
<paprel-trial-balance></paprel-trial-balance>
<paprel-balance-sheet></paprel-balance-sheet>
<paprel-income-statement></paprel-income-statement>
<paprel-cash-flow></paprel-cash-flow>
<paprel-general-ledger></paprel-general-ledger>
```

All five reports ship together. Components inherit the shared `--paprel-*` theme variables.
