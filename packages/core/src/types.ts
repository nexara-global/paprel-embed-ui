export type EmbedTokenSet = {
  accessToken: string;
  /** Unix epoch milliseconds */
  expiresAt: number;
  permissions?: string[];
  companyId?: string;
};

export type EmbedAuth = {
  getTokens: () => Promise<EmbedTokenSet>;
  onTokensUpdated?: (tokens: EmbedTokenSet) => void;
  onSessionExpired?: () => void;
  partnerDomain?: string;
};

export type EmbedClientOptions = {
  /** API origin, e.g. https://api.paprel.com. Empty string uses window.location.origin (same-origin proxy). */
  baseUrl: string;
  auth: EmbedAuth;
  /** Optional cache TTL consumed by domain clients. */
  cacheTtlMs?: number;
};
