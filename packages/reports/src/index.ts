import "./components/trial-balance.js";
import "./components/balance-sheet.js";
import "./components/income-statement.js";
import "./components/cash-flow.js";
import "./components/general-ledger.js";

export { PaprelTrialBalance } from "./components/trial-balance.js";
export { PaprelBalanceSheet } from "./components/balance-sheet.js";
export { PaprelIncomeStatement } from "./components/income-statement.js";
export { PaprelCashFlow } from "./components/cash-flow.js";
export { PaprelGeneralLedger } from "./components/general-ledger.js";
export {
  createReportsResource,
  type ReportsResource,
  type TrialBalanceParams,
  type TrialBalanceReport,
  type TrialBalanceRow,
  type ReportDateParams,
  type BalanceSheetReport,
  type IncomeStatementReport,
  type CashFlowReport,
  type GeneralLedgerParams,
  type GeneralLedgerReport,
  type GeneralLedgerRow,
} from "@paprel/embed-accounting";
