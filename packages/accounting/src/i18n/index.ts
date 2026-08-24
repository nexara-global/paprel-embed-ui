import { EMBED_LOCALE_MESSAGES, type EmbedLocale } from "./messages.generated.js";

export type { EmbedLocale };

export type EmbedUiKey = keyof (typeof EMBED_LOCALE_MESSAGES)["en"]["embed"];

export type EmbedI18n = {
  locale: EmbedLocale;
  t(key: EmbedUiKey, params?: Record<string, string | number>): string;
  accountLabel(key: string | null | undefined): string;
};

function nestedGet(obj: Record<string, string>, key: string): string | undefined {
  return obj[key];
}

/** Extract the i18n key Paprel stores for an account row (tree leaf, list item, or raw string). */
export function accountI18nKey(source: Record<string, unknown> | string | null | undefined): string {
  if (source == null) return "";
  if (typeof source === "string") return source.trim();
  return String(source.account_name ?? source.account ?? source.name ?? source.label ?? "").trim();
}

export function createEmbedI18n(locale: EmbedLocale = "en"): EmbedI18n {
  const messages = EMBED_LOCALE_MESSAGES[locale] ?? EMBED_LOCALE_MESSAGES.en;

  return {
    locale,
    t(key: EmbedUiKey, params) {
      let text: string = messages.embed[key] ?? EMBED_LOCALE_MESSAGES.en.embed[key] ?? String(key);
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          text = text.replace(`{${name}}`, String(value));
        }
      }
      return text;
    },
    accountLabel(key) {
      const raw = key?.trim();
      if (!raw) return messages.embed.unknownAccount;

      const preDefined = nestedGet(messages.preDefinedAccounts, raw);
      if (preDefined) return preDefined;

      const accountType = nestedGet(messages.accountType, raw);
      if (accountType) return accountType;

      // Custom / operator-defined names pass through unchanged.
      return raw;
    },
  };
}

export const EMBED_LOCALES: { id: EmbedLocale; label: string }[] = [
  { id: "en", label: "English" },
  { id: "ko", label: "한국어" },
  { id: "es", label: "Español" },
  { id: "ru", label: "Русский" },
];
