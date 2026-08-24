import type { EmbedAuth, EmbedTokenSet } from "./types.js";

/** Renewal buffer: min(15m, max(60s, TTL × 5%)). */
export function renewalBufferMs(expiresAt: number, now = Date.now()): number {
  const ttlMs = Math.max(0, expiresAt - now);
  const fivePercent = ttlMs * 0.05;
  const capped = Math.min(15 * 60 * 1000, Math.max(60_000, fivePercent));
  return capped;
}

export function scheduleRenewalAt(expiresAt: number, now = Date.now()): number {
  return expiresAt - renewalBufferMs(expiresAt, now);
}

const REFRESH_ATTEMPTS = 3;
const REFRESH_RETRY_BASE_MS = 800;

export function validateEmbedTokenSet(tokens: EmbedTokenSet, now = Date.now()): void {
  if (!tokens.accessToken?.trim()) {
    throw new Error("Embed token response is missing accessToken");
  }
  if (!Number.isFinite(tokens.expiresAt) || tokens.expiresAt <= now) {
    throw new Error("Embed token response has an invalid or expired expiresAt");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TokenManager {
  private cached: EmbedTokenSet | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private refreshPromise: Promise<EmbedTokenSet> | null = null;

  constructor(private readonly auth: EmbedAuth) {}

  async getValidTokens(): Promise<EmbedTokenSet> {
    const now = Date.now();
    if (this.cached && this.cached.expiresAt - renewalBufferMs(this.cached.expiresAt, now) > now) {
      return this.cached;
    }
    return this.refresh();
  }

  async refresh(): Promise<EmbedTokenSet> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshWithRetry().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  invalidate(): void {
    this.cached = null;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async refreshWithRetry(): Promise<EmbedTokenSet> {
    let lastError: unknown;

    for (let attempt = 0; attempt < REFRESH_ATTEMPTS; attempt++) {
      try {
        const tokens = await this.auth.getTokens();
        validateEmbedTokenSet(tokens);
        this.cached = tokens;
        this.auth.onTokensUpdated?.(tokens);
        this.schedule(tokens);
        return tokens;
      } catch (err) {
        lastError = err;
        if (attempt < REFRESH_ATTEMPTS - 1) {
          await sleep(REFRESH_RETRY_BASE_MS * (attempt + 1));
        }
      }
    }

    this.invalidate();
    this.auth.onSessionExpired?.();
    throw lastError instanceof Error ? lastError : new Error("Token refresh failed");
  }

  private schedule(tokens: EmbedTokenSet): void {
    if (this.timer) clearTimeout(this.timer);
    const delay = Math.max(0, scheduleRenewalAt(tokens.expiresAt) - Date.now());
    this.timer = setTimeout(() => {
      // refreshWithRetry notifies onSessionExpired; consume the scheduled
      // rejection so browsers do not also receive an unhandled promise event.
      void this.refresh().catch(() => undefined);
    }, delay);
  }
}
