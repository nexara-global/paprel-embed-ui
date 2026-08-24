import type { HttpClient } from "@paprel/embed-core";
import type { BankAccountDetail, BankAccountSummary, BankingListResult } from "../types.js";

export function createBankingResource(http: HttpClient) {
  return {
    async listBankAccounts(): Promise<BankingListResult> {
      const data = await http.request<unknown>("GET", "/v1/accounting/bank-accounts");
      return normalizeBankingList(data);
    },

    async getBankAccount(accountId: string): Promise<BankAccountDetail> {
      const data = await http.request<unknown>("GET", `/v1/accounting/accounts/${accountId}`);
      return mapBankAccountDetail(data);
    },
  };
}

function normalizeBankingList(data: unknown): BankingListResult {
  if (!data || typeof data !== "object") {
    return { accounts: [], balances: {} };
  }

  const obj = data as Record<string, unknown>;
  const accounts = Array.isArray(obj.accounts)
    ? obj.accounts.map(mapBankAccount)
    : Array.isArray(data)
      ? (data as unknown[]).map(mapBankAccount)
      : [];

  const balancesRaw = obj.balances;
  const balances =
    balancesRaw && typeof balancesRaw === "object"
      ? (balancesRaw as BankingListResult["balances"])
      : {};

  return { accounts, balances };
}

function mapBankAccount(raw: unknown): BankAccountSummary {
  const row = raw as Record<string, unknown>;
  return {
    ...(row as BankAccountSummary),
    id: String(row.id ?? ""),
    account: row.account != null ? String(row.account) : row.name != null ? String(row.name) : null,
    account_name:
      row.account_name != null
        ? String(row.account_name)
        : row.name != null
          ? String(row.name)
          : null,
    account_number: row.account_number != null ? String(row.account_number) : null,
    currency: row.currency != null ? String(row.currency) : null,
    kind: row.kind != null ? String(row.kind) : row.account_kind != null ? String(row.account_kind) : null,
    is_archived: Boolean(row.is_archived),
    uncategorized_count: Number(row.uncategorized_count ?? 0),
  };
}

function mapBankAccountDetail(raw: unknown): BankAccountDetail {
  const row = raw as Record<string, unknown>;
  const name = row.name != null ? String(row.name) : row.account_name != null ? String(row.account_name) : "";
  return {
    ...(row as BankAccountDetail),
    id: String(row.id ?? ""),
    name,
    account: row.account != null ? String(row.account) : name || null,
    account_name: name || null,
    account_number: row.account_number != null ? String(row.account_number) : null,
    account_kind: row.account_kind != null ? String(row.account_kind) : null,
    account_type: row.account_type != null ? String(row.account_type) : null,
    account_subtype: row.account_subtype != null ? String(row.account_subtype) : null,
    currency: row.currency != null ? String(row.currency) : null,
    description: row.description != null ? String(row.description) : null,
    is_archived: Boolean(row.is_archived),
    uncategorized_count: Number(row.uncategorized_count ?? 0),
    excluded_count: Number(row.excluded_count ?? 0),
    unreconciled_count: Number(row.unreconciled_count ?? 0),
    stats:
      row.stats && typeof row.stats === "object"
        ? (row.stats as BankAccountDetail["stats"])
        : undefined,
  };
}

export type BankingResource = ReturnType<typeof createBankingResource>;
