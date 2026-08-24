import type { HttpClient } from "@paprel/embed-core";
import type {
  ListTransactionLocksParams,
  TransactionLock,
  TransactionLockForm,
  TransactionLockLevel,
  TransactionLockListResult,
} from "../types.js";

function mapLock(raw: unknown): TransactionLock {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    ...(row as TransactionLock),
    id: String(row.id ?? ""),
    lock_label: String(row.lock_label ?? ""),
    module_scope: String(row.module_scope ?? "GLOBAL"),
    lock_level: String(row.lock_level ?? "SOFT"),
    lock_from_date: String(row.lock_from_date ?? ""),
    lock_to_date: row.lock_to_date == null ? null : String(row.lock_to_date),
    status: String(row.status ?? "ACTIVE"),
  };
}

export function normalizeTransactionLockListResponse(data: unknown): TransactionLockListResult {
  if (!data || typeof data !== "object") return { locks: [] };
  const row = data as Record<string, unknown>;
  const locks = Array.isArray(row.locks) ? row.locks.map(mapLock) : Array.isArray(data) ? data.map(mapLock) : [];
  return {
    locks,
    totalRecords: Number(row.total_records ?? row.totalRecords ?? locks.length),
    pageNumber: Number(row.page_number ?? row.pageNumber ?? 1),
    pageSize: Number(row.page_size ?? row.pageSize ?? locks.length),
  };
}

export function createTransactionLocksResource(http: HttpClient) {
  const base = "/v1/transactions-locking";
  return {
    async list(params: ListTransactionLocksParams = {}): Promise<TransactionLockListResult> {
      const data = await http.request<unknown>("GET", base, { query: {
        page: params.page, page_size: params.pageSize, label: params.label,
        identifier: params.identifier, reference: params.reference,
        module_scope: params.moduleScope, status: params.status,
        date_range: params.dateRange,
      }});
      return normalizeTransactionLockListResponse(data);
    },
    async getById(id: string): Promise<TransactionLock> {
      return mapLock(await http.request("GET", `${base}/${id}`));
    },
    async create(payload: TransactionLockForm): Promise<TransactionLock> {
      return mapLock(await http.request("POST", base, { body: payload }));
    },
    async release(id: string, reason: string): Promise<TransactionLock> {
      return mapLock(await http.request("PUT", `${base}/${id}/release`, { body: { reason } }));
    },
    async reactivate(id: string, reason: string): Promise<TransactionLock> {
      return mapLock(await http.request("PUT", `${base}/${id}/reactivate`, { body: { reason } }));
    },
    async void(id: string, reason: string): Promise<TransactionLock> {
      return mapLock(await http.request("PUT", `${base}/${id}/void`, { body: { reason } }));
    },
    async setLevel(id: string, lockLevel: TransactionLockLevel, reason: string): Promise<TransactionLock> {
      return mapLock(await http.request("PUT", `${base}/${id}/lock-level`, { body: { lock_level: lockLevel, reason } }));
    },
  };
}

export type TransactionLocksResource = ReturnType<typeof createTransactionLocksResource>;
