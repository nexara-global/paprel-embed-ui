import { accountI18nKey, type EmbedI18n } from "./i18n/index.js";
import { normalizeIsoDate, todayIsoDate } from "./iso-date.js";

export type ReportDisplayRow = {
  kind: "section" | "subtype" | "account";
  label: string;
  amount: number;
  level: number;
};

type StatementAccount = {
  account_name?: string;
  balance?: string | number;
  child_account?: StatementAccount[];
  [key: string]: unknown;
};

type StatementSubtype = {
  id?: string;
  account_name?: string;
  total?: string | number;
  account?: StatementAccount[];
  [key: string]: unknown;
};

type StatementSection = {
  account_name?: string;
  total?: string | number;
  account_subtype?: StatementSubtype[];
  [key: string]: unknown;
};

function addAccounts(
  rows: ReportDisplayRow[],
  accounts: StatementAccount[] | undefined,
  level: number,
  i18n: EmbedI18n,
): void {
  for (const account of accounts ?? []) {
    const label = i18n.accountLabel(accountI18nKey(String(account.account_name ?? "")));
    rows.push({
      kind: "account",
      label,
      amount: Number(account.balance ?? 0),
      level,
    });
    if (account.child_account?.length) {
      addAccounts(rows, account.child_account, level + 1, i18n);
    }
  }
}

/** Flatten balance sheet / income statement tree into indented table rows. */
export function flattenStatementSections(sections: unknown[], i18n: EmbedI18n): ReportDisplayRow[] {
  const rows: ReportDisplayRow[] = [];

  for (const raw of sections) {
    const section = raw as StatementSection;
    const sectionLabel = i18n.accountLabel(accountI18nKey(String(section.account_name ?? "")));
    rows.push({
      kind: "section",
      label: sectionLabel,
      amount: Number(section.total ?? 0),
      level: 0,
    });

    for (const subtype of section.account_subtype ?? []) {
      rows.push({
        kind: "subtype",
        label: i18n.accountLabel(accountI18nKey(String(subtype.account_name ?? ""))),
        amount: Number(subtype.total ?? 0),
        level: 1,
      });
      addAccounts(rows, subtype.account, 2, i18n);
    }
  }

  return rows;
}

export function defaultYearToDateRange(): { from: string; to: string; param: string } {
  const to = todayIsoDate();
  const from = `${new Date().getFullYear()}-01-01`;
  return { from, to, param: `${from},${to}` };
}

export function parseDateRangeParam(value: string | undefined): { from: string; to: string } {
  if (!value?.includes(",")) {
    const ytd = defaultYearToDateRange();
    return { from: ytd.from, to: ytd.to };
  }
  const [from, to] = value.split(",");
  return { from: normalizeIsoDate(from), to: normalizeIsoDate(to) };
}
