import type { BankingAccount } from "./types.js";
import type { EmbedI18n } from "./index.js";
import { accountI18nKey } from "./index.js";

const ACCOUNT_TYPE_ORDER = ["asset", "liability", "equity", "revenue", "expense"];

export type AccountPickerGroup = {
  groupKey: string;
  groupLabel: string;
  typeKey: string;
  subtypeKey: string;
  accounts: BankingAccount[];
};

/** Group label: translated account type and subtype. */
export function accountPickerGroupLabel(i18n: EmbedI18n, account: BankingAccount): string {
  const typeKey = String(account.account_type ?? "").trim();
  const subtypeKey = String(account.account_subtype ?? "").trim();
  const typeLabel = typeKey ? i18n.accountLabel(typeKey) : "";
  const subtypeLabel = subtypeKey ? i18n.accountLabel(subtypeKey) : "";

  if (typeLabel && subtypeLabel) return `${typeLabel} · ${subtypeLabel}`;
  return typeLabel || subtypeLabel || i18n.t("account");
}

/** Primary line: translated account name (no code prefix — native select option text). */
export function accountPickerOptionLabel(i18n: EmbedI18n, account: BankingAccount): string {
  return i18n.accountLabel(accountI18nKey(account));
}

/** Secondary line: translated subtype and account type. */
export function accountPickerMetaLabel(i18n: EmbedI18n, account: BankingAccount): string {
  const typeKey = String(account.account_type ?? "").trim();
  const subtypeKey = String(account.account_subtype ?? "").trim();
  const parts: string[] = [];
  if (subtypeKey) parts.push(i18n.accountLabel(subtypeKey));
  if (typeKey) parts.push(i18n.accountLabel(typeKey));
  return parts.join(" · ");
}

export function groupAccountsForPicker(accounts: BankingAccount[], i18n: EmbedI18n): AccountPickerGroup[] {
  const map = new Map<string, AccountPickerGroup>();

  for (const account of accounts) {
    const typeKey = String(account.account_type ?? "other").trim() || "other";
    const subtypeKey = String(account.account_subtype ?? "").trim();
    const groupKey = `${typeKey}::${subtypeKey}`;
    const existing = map.get(groupKey);
    if (existing) {
      existing.accounts.push(account);
    } else {
      map.set(groupKey, {
        groupKey,
        groupLabel: accountPickerGroupLabel(i18n, account),
        typeKey,
        subtypeKey,
        accounts: [account],
      });
    }
  }

  return [...map.values()]
    .sort((a, b) => {
      const ai = ACCOUNT_TYPE_ORDER.indexOf(a.typeKey);
      const bi = ACCOUNT_TYPE_ORDER.indexOf(b.typeKey);
      const typeCmp = (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      if (typeCmp !== 0) return typeCmp;
      return a.groupLabel.localeCompare(b.groupLabel, i18n.locale);
    })
    .map((group) => ({
      ...group,
      accounts: [...group.accounts].sort((a, b) => {
        const codeCmp = String(a.account_code ?? "").localeCompare(String(b.account_code ?? ""), undefined, {
          numeric: true,
        });
        if (codeCmp !== 0) return codeCmp;
        return accountPickerOptionLabel(i18n, a).localeCompare(accountPickerOptionLabel(i18n, b), i18n.locale);
      }),
    }));
}

export function filterAccountPickerGroups(
  groups: AccountPickerGroup[],
  filter: string,
  i18n: EmbedI18n,
): AccountPickerGroup[] {
  const q = filter.trim().toLowerCase();
  if (!q) return groups;

  return groups
    .map((group) => ({
      ...group,
      accounts: group.accounts.filter((account) => accountMatchesFilter(account, group, q, i18n)),
    }))
    .filter((group) => group.accounts.length > 0);
}

function accountMatchesFilter(
  account: BankingAccount,
  group: AccountPickerGroup,
  q: string,
  i18n: EmbedI18n,
): boolean {
  const haystack = [
    account.account_code,
    account.account_number,
    accountI18nKey(account),
    account.account_type,
    account.account_subtype,
    accountPickerOptionLabel(i18n, account),
    accountPickerMetaLabel(i18n, account),
    group.groupLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}
