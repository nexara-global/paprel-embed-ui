import { TokenManager } from "./auth.js";
import { parseEnvelope, PaprelApiError } from "./errors.js";
import type { EmbedAuth, EmbedClientOptions } from "./types.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export class HttpClient {
  private readonly tokenManager: TokenManager;
  private resolvedBaseUrl: string | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly auth: EmbedAuth,
  ) {
    this.tokenManager = new TokenManager(auth);
  }

  /** Absolute origin for URL resolution; empty baseUrl => browser same-origin (Vite proxy). */
  private resolveBaseUrl(): string {
    if (this.resolvedBaseUrl) return this.resolvedBaseUrl;

    const trimmed = this.baseUrl.trim().replace(/\/$/, "");
    if (trimmed) {
      this.resolvedBaseUrl = `${trimmed}/`;
      return this.resolvedBaseUrl;
    }

    if (typeof globalThis !== "undefined" && "location" in globalThis) {
      const origin = (globalThis as Window & typeof globalThis).location?.origin;
      if (origin) {
        this.resolvedBaseUrl = `${origin}/`;
        return this.resolvedBaseUrl;
      }
    }

    throw new PaprelApiError("Invalid embed baseUrl — set baseUrl or run in a browser for same-origin proxy", {
      code: "INVALID_BASE_URL",
    });
  }

  async request<T>(
    method: HttpMethod,
    path: string,
    opts?: { query?: Record<string, string | number | boolean | undefined>; body?: unknown; retried?: boolean },
  ): Promise<T> {
    const tokens = await this.tokenManager.getValidTokens();
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(normalizedPath, this.resolveBaseUrl());
    if (opts?.query) {
      for (const [key, value] of Object.entries(opts.query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${tokens.accessToken}`,
    };
    if (this.auth.partnerDomain) {
      headers["x-partner-domain"] = this.auth.partnerDomain;
    }

    const init: RequestInit = { method, headers };
    if (opts?.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }

    const response = await fetch(url, init);
    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new PaprelApiError("Invalid JSON response", { code: "PARSE_ERROR", status: response.status, raw: text });
      }
    }

    if (response.status === 401 && !opts?.retried) {
      this.tokenManager.invalidate();
      try {
        await this.tokenManager.refresh();
      } catch (err) {
        throw err instanceof PaprelApiError
          ? err
          : new PaprelApiError("Session expired", { code: "SESSION_EXPIRED", status: 401 });
      }
      return this.request<T>(method, path, { ...opts, retried: true });
    }

    if (!response.ok) {
      try {
        parseEnvelope<T>(response.status, json);
      } catch (err) {
        if (err instanceof PaprelApiError) throw err;
      }
      throw new PaprelApiError(`HTTP ${response.status}`, { code: "HTTP_ERROR", status: response.status, raw: json });
    }

    return parseEnvelope<T>(response.status, json);
  }

  /** Force a new access token from auth.getTokens() (retries + proactive schedule). */
  async refreshSession(): Promise<void> {
    await this.tokenManager.refresh();
  }

  /** Stop proactive renewal when the owning domain client is replaced. */
  dispose(): void {
    this.tokenManager.invalidate();
  }
}

export function createHttpClient(options: EmbedClientOptions): HttpClient {
  return new HttpClient(options.baseUrl, options.auth);
}
