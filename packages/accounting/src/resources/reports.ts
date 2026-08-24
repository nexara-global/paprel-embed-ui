import type { HttpClient } from "@paprel/embed-core";
import type {
  BalanceSheetReport,
  CashFlowReport,
  GeneralLedgerParams,
  GeneralLedgerReport,
  IncomeStatementReport,
  ReportDateParams,
  TrialBalanceParams,
  TrialBalanceReport,
} from "../types.js";

export function createReportsResource(http: HttpClient) {
  return {
    async trialBalance(params: TrialBalanceParams = {}): Promise<TrialBalanceReport> {
      return http.request<TrialBalanceReport>("GET", "/v1/reports/trial-balance", {
        query: {
          date: params.date,
          currency: params.currency,
        },
      });
    },

    async balanceSheet(params: ReportDateParams = {}): Promise<BalanceSheetReport> {
      return http.request<BalanceSheetReport>("GET", "/v1/reports/balance-sheet", {
        query: {
          date: params.date,
          currency: params.currency,
        },
      });
    },

    async incomeStatement(params: ReportDateParams = {}): Promise<IncomeStatementReport> {
      return http.request<IncomeStatementReport>("GET", "/v1/reports/income-statement", {
        query: {
          date_range: params.dateRange,
          currency: params.currency,
        },
      });
    },

    async cashFlow(params: ReportDateParams = {}): Promise<CashFlowReport> {
      return http.request<CashFlowReport>("GET", "/v1/reports/cash-flow", {
        query: {
          date_range: params.dateRange,
          currency: params.currency,
        },
      });
    },

    async generalLedger(params: GeneralLedgerParams = {}): Promise<GeneralLedgerReport> {
      return http.request<GeneralLedgerReport>("GET", "/v1/reports/general-ledger", {
        query: {
          date_range: params.dateRange,
          currency: params.currency,
          account: params.accountId,
        },
      });
    },
  };
}

export type ReportsResource = ReturnType<typeof createReportsResource>;
