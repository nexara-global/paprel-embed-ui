import type { JournalLine } from "./types.js";

/** API detail lines use `type` + `amount`; forms use split debit/credit columns. */
export type ApiJournalLine = JournalLine & {
  type?: "debit" | "credit";
  amount?: string | number;
  currency?: string;
};

export function normalizeApiLineToForm(line: ApiJournalLine): JournalLine {
  if (line.debit != null && String(line.debit).trim() !== "") {
    return {
      account_id: line.account_id,
      description: line.description ?? "",
      debit: String(line.debit),
      credit: line.credit != null ? String(line.credit) : "",
      people_id: line.people_id ?? null,
    };
  }
  if (line.credit != null && String(line.credit).trim() !== "") {
    return {
      account_id: line.account_id,
      description: line.description ?? "",
      debit: "",
      credit: String(line.credit),
      people_id: line.people_id ?? null,
    };
  }

  const amount = line.amount != null ? String(line.amount) : "";
  const debit = line.type === "debit" ? amount : "";
  const credit = line.type === "credit" ? amount : "";

  return {
    account_id: line.account_id,
    description: line.description ?? "",
    debit,
    credit,
    people_id: line.people_id ?? null,
  };
}

export function normalizeApiLinesToForm(lines: ApiJournalLine[] | undefined): JournalLine[] {
  if (!lines?.length) {
    return [
      { account_id: "", debit: "", credit: "", description: "" },
      { account_id: "", debit: "", credit: "", description: "" },
    ];
  }
  return lines.map(normalizeApiLineToForm);
}

export function lineDisplayDebit(line: ApiJournalLine): string {
  if (line.debit != null && String(line.debit).trim() !== "") return String(line.debit);
  if (line.type === "debit" && line.amount != null) return String(line.amount);
  return "";
}

export function lineDisplayCredit(line: ApiJournalLine): string {
  if (line.credit != null && String(line.credit).trim() !== "") return String(line.credit);
  if (line.type === "credit" && line.amount != null) return String(line.amount);
  return "";
}

export function computeJournalTotals(lines: ApiJournalLine[]): { debit: number; credit: number } {
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    debit += parseFloat(lineDisplayDebit(line)) || 0;
    credit += parseFloat(lineDisplayCredit(line)) || 0;
  }
  return { debit, credit };
}

const BALANCE_TOLERANCE = 0.00001;

/** Client-side validation for journal line invariants. */
export function validateJournalFormLines(lines: JournalLine[]): Record<string, string> {
  const errors: Record<string, string> = {};

  if (lines.length < 2) {
    errors.lines = "INVALID_JOURNAL_ENTRY";
  }

  let totalDebit = 0;
  let totalCredit = 0;

  lines.forEach((line, index) => {
    const debit = parseFloat(String(line.debit ?? "")) || 0;
    const credit = parseFloat(String(line.credit ?? "")) || 0;

    if (debit > 0 && credit > 0) {
      errors[`lines_${index}_debit`] = "BOTH_DEBIT_CREDIT_SET";
      errors[`lines_${index}_credit`] = "BOTH_DEBIT_CREDIT_SET";
    }

    totalDebit += debit;
    totalCredit += credit;
  });

  if (Math.abs(totalDebit - totalCredit) > BALANCE_TOLERANCE) {
    errors.lines = "DEBIT_CREDIT_MISMATCH";
  }

  return errors;
}

export function formatJournalAmount(value: number, currency?: string): string {
  if (!Number.isFinite(value)) return "";
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${formatted} ${currency}` : formatted;
}
