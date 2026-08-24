import type { TtlCache } from "@paprel/embed-core";
import type { HttpClient } from "@paprel/embed-core";
import type {
  AccountForm,
  AccountSubtype,
  AccountTreeNode,
  AccountTreeParams,
  BankingAccount,
  ListAccountsParams,
} from "../types.js";

function accountsCacheKey(params: ListAccountsParams): string {
  return `accounts:${params.companyId ?? "jwt"}:${params.isArchived ?? false}`;
}

function treeCacheKey(params: AccountTreeParams): string {
  return `tree:${params.companyId ?? "jwt"}:${params.isArchived ?? false}`;
}

export function createAccountsResource(http: HttpClient, cache: TtlCache<unknown>) {
  return {
    async list(params: ListAccountsParams = {}): Promise<BankingAccount[]> {
      const key = accountsCacheKey(params);
      const cached = cache.get(key) as BankingAccount[] | undefined;
      if (cached) return cached;

      const data = await http.request<BankingAccount[]>("GET", "/v1/accounting/accounts", {
        query: {
          is_archived: params.isArchived,
        },
      });
      cache.set(key, data);
      return data;
    },

    async tree(params: AccountTreeParams = {}): Promise<AccountTreeNode[]> {
      const key = treeCacheKey(params);
      const cached = cache.get(key) as AccountTreeNode[] | undefined;
      if (cached) return cached;

      const data = await http.request<AccountTreeNode[]>("GET", "/v1/accounting/accounts-tree", {
        query: {
          is_archived: params.isArchived === undefined ? undefined : String(params.isArchived),
        },
      });
      cache.set(key, data);
      return data;
    },

    async getById(accountId: string): Promise<BankingAccount> {
      return http.request<BankingAccount>("GET", `/v1/accounting/accounts/${accountId}`);
    },

    async create(form: AccountForm): Promise<BankingAccount> {
      const data = await http.request<BankingAccount>("POST", "/v1/accounting/accounts", {
        body: form,
      });
      cache.clear();
      return data;
    },

    async update(accountId: string, form: AccountForm): Promise<BankingAccount> {
      const data = await http.request<BankingAccount>("PUT", `/v1/accounting/accounts/${accountId}`, {
        body: form,
      });
      cache.clear();
      return data;
    },

    async delete(accountId: string): Promise<void> {
      await http.request("DELETE", `/v1/accounting/accounts/${accountId}`);
      cache.clear();
    },

    async listSubtypes(): Promise<AccountSubtype[]> {
      const key = "subtypes";
      const cached = cache.get(key) as AccountSubtype[] | undefined;
      if (cached) return cached;

      const data = await http.request<unknown>("GET", "/v1/accounting/accounts/subtype");
      const rows = normalizeSubtypeList(data);
      cache.set(key, rows);
      return rows;
    },

    invalidateCache(): void {
      cache.clear();
    },
  };
}

function normalizeSubtypeList(data: unknown): AccountSubtype[] {
  if (Array.isArray(data)) {
    return data.map(mapSubtype);
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items.map(mapSubtype);
    if (Array.isArray(obj.subtypes)) return obj.subtypes.map(mapSubtype);
  }
  return [];
}

function mapSubtype(raw: unknown): AccountSubtype {
  const row = raw as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? row.account_name ?? ""),
    account_type: row.account_type != null ? String(row.account_type) : null,
    account_type_id: row.account_type_id != null ? String(row.account_type_id) : undefined,
    account_number: row.account_number != null ? String(row.account_number) : null,
  };
}

export type AccountsResource = ReturnType<typeof createAccountsResource>;
