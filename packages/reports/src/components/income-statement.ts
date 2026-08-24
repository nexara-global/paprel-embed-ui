import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  defaultYearToDateRange,
  formatJournalAmount,
  parseDateRangeParam,
  type ReportDisplayRow,
} from "@paprel/accounting";
import { getEmbedClient, getEmbedI18n } from "@paprel/accounting";
import { isoDateField } from "../lib/iso-date-field.js";
import { flattenSections, renderStatementTable } from "../lib/statement-report.js";
import { onEmbedLocaleChange } from "../locale-listener.js";
import sharedStyles from "@paprel/ui/styles.css?inline";

@customElement("paprel-income-statement")
export class PaprelIncomeStatement extends LitElement {
  static styles = [
    css`${unsafeCSS(sharedStyles)}`,
    css`
      .ledger-statement tr.statement-section td {
        font-weight: 650;
        background: var(--paprel-color-surface-muted, #f7f7f4);
      }
      .ledger-statement tr.statement-subtype td {
        font-weight: 600;
        color: var(--paprel-color-muted, #78786f);
      }
      .ledger-net-income {
        margin-top: 1rem;
        padding: 0.85rem 1rem;
        border: 1px solid var(--paprel-color-border, #e8e8e2);
        border-radius: 0.65rem;
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 1rem;
      }
      .ledger-net-income strong {
        font-size: 1.25rem;
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  @property({ type: String, attribute: "date-range" }) dateRange = "";
  @property({ type: String }) currency = "";
  @state() private loading = true;
  @state() private error = "";
  @state() private rows: ReportDisplayRow[] = [];
  @state() private netIncome = 0;
  @state() private status = "";
  @state() private rangeFrom = "";
  @state() private rangeTo = "";

  private offLocaleChange?: () => void;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this.offLocaleChange = onEmbedLocaleChange(() => this.requestUpdate());
    const ytd = defaultYearToDateRange();
    if (!this.dateRange) this.dateRange = ytd.param;
    this.rangeFrom = ytd.from;
    this.rangeTo = ytd.to;
    await this.load();
  }

  disconnectedCallback(): void {
    this.offLocaleChange?.();
    super.disconnectedCallback();
  }

  async refresh(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      const i18n = getEmbedI18n();
      const range = this.dateRange || defaultYearToDateRange().param;
      const report = await getEmbedClient().reports.incomeStatement({
        dateRange: range,
        currency: this.currency || undefined,
      });
      this.rows = flattenSections(report.income_statement, i18n);
      this.netIncome = Number(report.net_income ?? 0);
      this.status = String(report.status ?? "");
      const parsed = parseDateRangeParam(report.date_range ?? range);
      this.rangeFrom = parsed.from;
      this.rangeTo = parsed.to;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load income statement";
      this.rows = [];
    } finally {
      this.loading = false;
    }
  }

  private syncRange(): void {
    this.dateRange = `${this.rangeFrom},${this.rangeTo}`;
    void this.load();
  }

  render() {
    const i18n = getEmbedI18n();
    const fmt = (n: number) => formatJournalAmount(n, this.currency || undefined);

    return html`
      <div class="ledger-report">
        <div class="ledger-filters">
          <label class="field">${i18n.t("dateFrom")}
            ${isoDateField(this.rangeFrom, (value) => {
              this.rangeFrom = value;
              this.syncRange();
            })}
          </label>
          <label class="field">${i18n.t("dateTo")}
            ${isoDateField(this.rangeTo, (value) => {
              this.rangeTo = value;
              this.syncRange();
            })}
          </label>
        </div>
        ${this.loading ? html`<div class="state-loading">${i18n.t("loadingIncomeStatement")}</div>` : null}
        ${this.error ? html`<div class="ledger-error">${this.error}</div>` : null}
        ${!this.loading && !this.error ? renderStatementTable(this.rows, i18n, this.currency) : null}
        ${!this.loading && !this.error
          ? html`<div class="ledger-net-income">
              <span>${i18n.t("netIncome")} ${this.status ? html`(${this.status})` : null}</span>
              <strong>${fmt(this.netIncome)}</strong>
            </div>`
          : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "paprel-income-statement": PaprelIncomeStatement;
  }
}
