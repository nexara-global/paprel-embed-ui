import type { HttpClient } from "@paprel/embed-core";
import type {
  BankingTransaction,
  ConfirmMatchPayload,
  ExcludeTransactionsPayload,
  ListTransactionsParams,
  RestoreTransactionsPayload,
  TransactionDetail,
  TransactionEntityMapping,
  TransactionListResult,
  TransactionMatch,
} from "../types.js";

function mapMatch(raw: unknown): TransactionMatch {
  const row = raw as Record<string, unknown>;
  return {
    ...(row as TransactionMatch),
    transaction_id: row.transaction_id != null ? String(row.transaction_id) : undefined,
    entity: row.entity != null ? String(row.entity) : null,
    entity_id: row.entity_id != null ? String(row.entity_id) : null,
  };
}

function mapTransaction(raw: unknown): BankingTransaction {
  const row = raw as Record<string, unknown>;
  const matches = Array.isArray(row.matches) ? row.matches.map(mapMatch) : undefined;
  return {
    ...(row as BankingTransaction),
    id: String(row.id ?? ""),
    banking_account_id: row.banking_account_id != null ? String(row.banking_account_id) : undefined,
    description: row.description != null ? String(row.description) : undefined,
    transaction_type: row.transaction_type != null ? String(row.transaction_type) : undefined,
    transaction_identifier:
      row.transaction_identifier != null ? String(row.transaction_identifier) : null,
    matches,
  };
}

export function normalizeTransactionListResponse(data: unknown): TransactionListResult {
  if (!data || typeof data !== "object") {
    return { transactions: [] };
  }

  const obj = data as Record<string, unknown>;
  const transactions = Array.isArray(obj.transactions)
    ? obj.transactions.map(mapTransaction)
    : Array.isArray(data)
      ? (data as unknown[]).map(mapTransaction)
      : [];

  return {
    transactions,
    totalRecords: Number(obj.total_records ?? obj.totalRecords ?? 0),
    pageNumber: Number(obj.page_number ?? obj.pageNumber ?? 1),
    pageSize: Number(obj.page_size ?? obj.pageSize ?? 0),
    policyId: obj.policy_id != null ? String(obj.policy_id) : undefined,
  };
}

export function createTransactionsResource(http: HttpClient) {
  return {
    async list(params: ListTransactionsParams = {}): Promise<TransactionListResult> {
      const data = await http.request<unknown>("GET", "/v1/accounting/transactions", {
        query: {
          account: params.account,
          date_range: params.dateRange,
          currency: params.currency,
          description: params.description,
          match_policy_id: params.matchPolicyId,
          posted: params.posted,
          excluded: params.excluded,
          page: params.page,
          page_size: params.pageSize,
        },
      });
      return normalizeTransactionListResponse(data);
    },

    async getById(transactionId: string): Promise<TransactionDetail> {
      const data = await http.request<unknown>("GET", `/v1/accounting/transactions/${transactionId}`);
      return mapTransactionDetail(data);
    },

    async confirmMatch(payload: ConfirmMatchPayload): Promise<unknown> {
      return http.request("POST", "/v1/accounting/transactions/confirm-match", {
        body: payload,
      });
    },

    async exclude(payload: ExcludeTransactionsPayload): Promise<unknown> {
      return http.request("POST", "/v1/accounting/transactions/exclude", {
        body: payload,
      });
    },

    async restore(payload: RestoreTransactionsPayload): Promise<unknown> {
      return http.request("POST", "/v1/accounting/transactions/restore", {
        body: payload,
      });
    },
  };
}

function mapTransactionDetail(raw: unknown): TransactionDetail {
  const base = mapTransaction(raw);
  const row = raw as Record<string, unknown>;
  const mapping: TransactionEntityMapping[] = Array.isArray(row.mapping)
    ? row.mapping.map((item) => {
        const entry = item as Record<string, unknown>;
        return {
          entity: entry.entity != null ? String(entry.entity) : null,
          entity_id: entry.entity_id != null ? String(entry.entity_id) : null,
          amount: entry.amount as string | number | undefined,
        };
      })
    : [];
  return {
    ...base,
    is_posted: Boolean(row.is_posted),
    mapping,
    matches: base.matches,
    meta_data:
      row.meta_data && typeof row.meta_data === "object"
        ? (row.meta_data as Record<string, unknown>)
        : null,
    ignore_reason: row.ignore_reason != null ? String(row.ignore_reason) : null,
  };
}

export type TransactionsResource = ReturnType<typeof createTransactionsResource>;
