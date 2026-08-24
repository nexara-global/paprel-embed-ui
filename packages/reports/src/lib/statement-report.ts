import { html, type TemplateResult } from "lit";
import {
  flattenStatementSections,
  formatJournalAmount,
  todayIsoDate,
  type EmbedI18n,
  type ReportDisplayRow,
} from "@paprel/accounting";

export function renderStatementTable(
  rows: ReportDisplayRow[],
  i18n: EmbedI18n,
  currency?: string,
): TemplateResult {
  if (!rows.length) {
    return html`<div class="ledger-empty">${i18n.t("noReportRows")}</div>`;
  }

  return html`
    <div class="ledger-table-wrap">
      <table class="ledger-table ledger-statement">
        <thead>
          <tr>
            <th>${i18n.t("account")}</th>
            <th class="numeric">${i18n.t("amount")}</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => {
            const pad = row.level * 0.85;
            const rowClass =
              row.kind === "section"
                ? "statement-section"
                : row.kind === "subtype"
                  ? "statement-subtype"
                  : "statement-account";
            return html`<tr class=${rowClass}>
              <td style=${`padding-left:${pad}rem`}>${row.label}</td>
              <td class="numeric">${formatAmount(row.amount, currency)}</td>
            </tr>`;
          })}
        </tbody>
      </table>
    </div>
  `;
}

export function flattenSections(sections: unknown[] | undefined, i18n: EmbedI18n): ReportDisplayRow[] {
  return flattenStatementSections(sections ?? [], i18n);
}

function formatAmount(value: number, currency?: string): string {
  if (!value) return "—";
  return formatJournalAmount(value, currency);
}

export function defaultDate(): string {
  return todayIsoDate();
}
