import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { defaultYearToDateRange, formatJournalAmount, parseDateRangeParam } from "@paprel/accounting";
import { getEmbedClient, getEmbedI18n } from "@paprel/accounting";
import { isoDateField } from "../lib/iso-date-field.js";
import { onEmbedLocaleChange } from "../locale-listener.js";
import sharedStyles from "@paprel/ui/styles.css?inline";

@customElement("paprel-cash-flow")
export class PaprelCashFlow extends LitElement {
  static styles = [
    css`${unsafeCSS(sharedStyles)}`,
    css`
      .cash-flow-grid {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      }
      .cash-flow-card {
        padding: 1rem 1.1rem;
        border: 1px solid var(--paprel-color-border-subtle, #f0f0eb);
        border-radius: 0.65rem;
        background: var(--paprel-color-surface-muted, #f7f7f4);
      }
      .cash-flow-card strong {
        display: block;
        margin-top: 0.4rem;
        font-size: 1.35rem;
        font-variant-numeric: tabular-nums;
      }
      .cash-flow-card.is-negative strong {
        color: var(--paprel-color-danger, #dc2626);
      }
      .cash-flow-foot {
        margin-top: 1rem;
        font-size: 0.8125rem;
        color: var(--paprel-color-muted, #78786f);
      }
    `,
  ];

  @property({ type: String, attribute: "date-range" }) dateRange = "";
  @property({ type: String }) currency = "";
  @state() private loading = true;
  @state() private error = "";
  @state() private inflow = 0;
  @state() private outflow = 0;
  @state() private net = 0;
  @state() private transactionCount = 0;
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
      const range = this.dateRange || defaultYearToDateRange().param;
      const report = await getEmbedClient().reports.cashFlow({
        dateRange: range,
        currency: this.currency || undefined,
      });
      const summary = report.summary ?? {};
      this.inflow = Number(summary.cash_inflow ?? 0);
      this.outflow = Number(summary.cash_outflow ?? 0);
      this.net = Number(summary.net_cash_flow ?? 0);
      this.transactionCount = Number(summary.transaction_count ?? 0);
      const parsed = parseDateRangeParam(report.date_range ?? range);
      this.rangeFrom = parsed.from;
      this.rangeTo = parsed.to;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load cash flow";
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
        ${this.loading ? html`<div class="state-loading">${i18n.t("loadingCashFlow")}</div>` : null}
        ${this.error ? html`<div class="ledger-error">${this.error}</div>` : null}
        ${!this.loading && !this.error
          ? html`
              <div class="cash-flow-grid">
                <div class="cash-flow-card">
                  <span class="meta-label">${i18n.t("cashInflow")}</span>
                  <strong>${fmt(this.inflow)}</strong>
                </div>
                <div class="cash-flow-card">
                  <span class="meta-label">${i18n.t("cashOutflow")}</span>
                  <strong>${fmt(this.outflow)}</strong>
                </div>
                <div class="cash-flow-card ${this.net < 0 ? "is-negative" : ""}">
                  <span class="meta-label">${i18n.t("netCashFlow")}</span>
                  <strong>${fmt(this.net)}</strong>
                </div>
              </div>
              <div class="cash-flow-foot">
                ${i18n.t("postedJournalEntries", { count: this.transactionCount })}
              </div>
            `
          : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "paprel-cash-flow": PaprelCashFlow;
  }
}
