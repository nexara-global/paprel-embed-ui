const EMBED_LOCALE_CHANGE = "paprel-embed-locale-change";

export function onEmbedLocaleChange(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EMBED_LOCALE_CHANGE, listener);
  return () => window.removeEventListener(EMBED_LOCALE_CHANGE, listener);
}
