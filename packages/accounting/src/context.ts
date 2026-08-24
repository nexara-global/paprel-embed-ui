import {
  configureEmbedAuth,
  type EmbedAuth,
} from "@paprel/embed-core";
import { createAccountingClient, type AccountingClient } from "./client.js";
import { createEmbedI18n, type EmbedI18n, type EmbedLocale } from "./i18n/index.js";

export type AccountingConfig = {
  baseUrl: string;
  auth: EmbedAuth;
  /** Account list/tree TTL in ms (default 5 min). Journals are always live-fetched. */
  cacheTtlMs?: number;
  /** Bundled Paprel account catalog (en, ko, es, ru). Default en. */
  locale?: EmbedLocale;
  /** Override bundled messages — e.g. wire vue-i18n t() from your app. */
  i18n?: EmbedI18n;
};

let client: AccountingClient | null = null;
let i18n: EmbedI18n = createEmbedI18n("en");

export function configureAccounting(config: AccountingConfig): AccountingClient {
  client?.dispose();
  configureEmbedAuth(config.auth);
  if (config.i18n) {
    i18n = config.i18n;
  } else if (config.locale) {
    i18n = createEmbedI18n(config.locale);
  }
  client = createAccountingClient({
    baseUrl: config.baseUrl,
    auth: config.auth,
    cacheTtlMs: config.cacheTtlMs,
  });
  return client;
}

/** @deprecated Use configureAccounting. Retained for pre-release migration compatibility. */
export const configureEmbedAccounting = configureAccounting;
/** @deprecated Use AccountingConfig. */
export type EmbedAccountingConfig = AccountingConfig;

export function setEmbedLocale(locale: EmbedLocale): void {
  i18n = createEmbedI18n(locale);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("paprel-embed-locale-change", { detail: { locale } }));
  }
}

export function getEmbedI18n(): EmbedI18n {
  return i18n;
}

export function getAccountingClient(): AccountingClient {
  if (!client) {
    throw new Error("configureAccounting({ baseUrl, auth }) required before mounting components");
  }
  return client;
}

/** @deprecated Use getAccountingClient. */
export const getEmbedClient = getAccountingClient;

/** Force token renewal and bust account caches — e.g. after auth recovery in the partner shell. */
export async function refreshEmbedSession(): Promise<void> {
  const embedClient = getAccountingClient();
  await embedClient.refreshSession();
  embedClient.refresh();
}
