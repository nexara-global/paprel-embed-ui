import type { HttpClient } from "@paprel/embed-core";
import type {
  ListReconciliationsParams,
  ReconciliationFormPayload,
  ReconciliationListResult,
  ReconciliationRecord,
  ReconciliationSavePayload,
  ReconciliationVoidPayload,
} from "../types.js";

function mapReconciliation(raw: unknown): ReconciliationRecord {
  const row = raw as Record<string, unknown>;
  const lines = Array.isArray(row.lines)
    ? row.lines.map((line) => {
        const entry = line as Record<string, unknown>;
        return {
          id: String(entry.id ?? ""),
          reconciliation_id: entry.reconciliation_id != null ? String(entry.reconciliation_id) : undefined,
          journal_id: String(entry.journal_id ?? ""),
          journal_line_id: String(entry.journal_line_id ?? ""),
          is_reconciled: Boolean(entry.is_reconciled),
          note: entry.note != null ? String(entry.note) : null,
        };
      })
    : [];
  return {
    ...(row as ReconciliationRecord),
    id: String(row.id ?? ""),
    banking_account_id: String(row.banking_account_id ?? ""),
    start_date: String(row.start_date ?? ""),
    end_date: String(row.end_date ?? ""),
    closing_balance: row.closing_balance != null ? (row.closing_balance as string | number) : "0",
    status: String(row.status ?? ""),
    lines,
  };
}

export function normalizeReconciliationListResponse(data: unknown): ReconciliationListResult {
  if (!data || typeof data !== "object") {
    return { reconciliations: [] };
  }

  const obj = data as Record<string, unknown>;
  const reconciliations = Array.isArray(obj.reconciliations)
    ? obj.reconciliations.map(mapReconciliation)
    : Array.isArray(data)
      ? (data as unknown[]).map(mapReconciliation)
      : [];

  return {
    reconciliations,
    totalRecords: Number(obj.total_records ?? obj.totalRecords ?? 0),
    pageNumber: Number(obj.page_number ?? obj.pageNumber ?? 1),
    pageSize: Number(obj.page_size ?? obj.pageSize ?? 0),
  };
}

export function createReconciliationsResource(http: HttpClient) {
  return {
    async list(params: ListReconciliationsParams = {}): Promise<ReconciliationListResult> {
      const data = await http.request<unknown>("GET", "/v1/accounting/reconciliations", {
        query: {
          account: params.account,
          status: params.status && params.status !== "all" ? params.status : undefined,
          date_range: params.dateRange,
          page: params.page,
          page_size: params.pageSize,
        },
      });
      return normalizeReconciliationListResponse(data);
    },

    async getById(reconciliationId: string): Promise<ReconciliationRecord> {
      const data = await http.request<unknown>(
        "GET",
        `/v1/accounting/reconciliations/${reconciliationId}`,
      );
      return mapReconciliation(data);
    },

    async create(payload: ReconciliationFormPayload): Promise<ReconciliationRecord> {
      const data = await http.request<unknown>("POST", "/v1/accounting/reconciliations", {
        body: payload,
      });
      return mapReconciliation(data);
    },

    async save(reconciliationId: string, payload: ReconciliationSavePayload): Promise<unknown> {
      return http.request("PUT", `/v1/accounting/reconciliations/${reconciliationId}/save`, {
        body: { ...payload, reconciliation_id: reconciliationId },
      });
    },

    async void(reconciliationId: string, payload: ReconciliationVoidPayload = {}): Promise<unknown> {
      return http.request("PUT", `/v1/accounting/reconciliations/${reconciliationId}/void`, {
        body: payload,
      });
    },
  };
}

export type ReconciliationsResource = ReturnType<typeof createReconciliationsResource>;
