import { TtlCache, createHttpClient } from "@paprel/embed-core";
import { createAccountsResource } from "./resources/accounts.js";
import { createBankingResource } from "./resources/banking.js";
import { createJournalsResource } from "./resources/journals.js";
import { createReportsResource } from "./resources/reports.js";
import { createReconciliationsResource } from "./resources/reconciliations.js";
import { createTransactionsResource } from "./resources/transactions.js";
import { createTransactionLocksResource } from "./resources/transaction-locks.js";
import type { EmbedClientOptions } from "./types.js";

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

export function createAccountingClient(options: EmbedClientOptions) {
  const http = createHttpClient(options);
  const cache = new TtlCache<unknown>(options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS);

  const accounts = createAccountsResource(http, cache);
  const journals = createJournalsResource(http);
  const reports = createReportsResource(http);
  const banking = createBankingResource(http);
  const transactions = createTransactionsResource(http);
  const reconciliations = createReconciliationsResource(http);
  const transactionLocks = createTransactionLocksResource(http);

  return {
    accounts,
    journals,
    reports,
    banking,
    transactions,
    reconciliations,
    transactionLocks,
    /** Bust reference-data cache (accounts list/tree). */
    refresh(): void {
      accounts.invalidateCache();
    },
    /** Exchange for a fresh access token via auth.getTokens(). */
    refreshSession(): Promise<void> {
      return http.refreshSession();
    },
    /** Release renewal timers when replacing this client or unmounting the host. */
    dispose(): void {
      http.dispose();
      cache.clear();
    },
  };
}

export type AccountingClient = ReturnType<typeof createAccountingClient>;
