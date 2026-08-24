import type { EmbedAuth } from "./types.js";

let configuredAuth: EmbedAuth | null = null;

/** Register shared auth for Lit components (call once at app bootstrap). */
export function configureEmbedAuth(auth: EmbedAuth): void {
  configuredAuth = auth;
}

export function getConfiguredEmbedAuth(): EmbedAuth {
  if (!configuredAuth) {
    throw new Error("configureEmbedAuth() must be called before using Paprel domain components");
  }
  return configuredAuth;
}

export function clearConfiguredEmbedAuth(): void {
  configuredAuth = null;
}
