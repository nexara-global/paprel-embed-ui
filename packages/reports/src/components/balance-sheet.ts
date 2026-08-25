import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { formatJournalAmount, normalizeIsoDate, type ReportDisplayRow } from "@paprel/embed-accounting";
import { getEmbedClient, getEmbedI18n } from "@paprel/embed-accounting";
import { isoDateField } from "../lib/iso-date-field.js";
import { defaultDate, flattenSections, renderStatementTable } from "../lib/statement-report.js";
import { onEmbedLocaleChange } from "../locale-listener.js";
import sharedStyles from "@paprel/embed-ui/styles.css?inline";

@customElement("paprel-balance-sheet")
export class PaprelBalanceSheet extends LitElement {
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
      .ledger-summary {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
        margin-top: 1rem;
      }
      .ledger-summary-card {
        padding: 0.85rem 1rem;
        border: 1px solid var(--paprel-color-border-subtle, #f0f0eb);
        border-radius: 0.65rem;
        background: var(--paprel-color-surface-muted, #f7f7f4);
      }
      .ledger-summary-card strong {
        display: block;
        margin-top: 0.35rem;
        font-size: 1.125rem;
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  @property({ type: String, attribute: "as-of-date" }) asOfDate = "";
  @property({ type: String }) currency = "";
  @state() private loading = true;
  @state() private error = "";
  @state() private rows: ReportDisplayRow[] = [];
  @state() private assetTotal = 0;
  @state() private liabilityEquityTotal = 0;

  private offLocaleChange?: () => void;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this.offLocaleChange = onEmbedLocaleChange(() => this.requestUpdate());
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
      const report = await getEmbedClient().reports.balanceSheet({
        date: normalizeIsoDate(this.asOfDate) || defaultDate(),
        currency: this.currency || undefined,
      });
      this.rows = flattenSections(report.balance_sheet, i18n);
      this.assetTotal = Number(report.asset_total ?? 0);
      this.liabilityEquityTotal = Number(report.liability_equity_total ?? 0);
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load balance sheet";
      this.rows = [];
    } finally {
      this.loading = false;
    }
  }

  private onDateChange(value: string): void {
    this.asOfDate = value;
    void this.load();
  }

  render() {
    const i18n = getEmbedI18n();
    const dateValue = normalizeIsoDate(this.asOfDate || defaultDate());
    const fmt = (n: number) => formatJournalAmount(n, this.currency || undefined);

    return html`
      <div class="ledger-report">
        <div class="ledger-filters">
          <label class="field">${i18n.t("asOfDate")}
            ${isoDateField(dateValue, (value) => this.onDateChange(value))}
          </label>
        </div>
        ${this.loading ? html`<div class="state-loading">${i18n.t("loadingBalanceSheet")}</div>` : null}
        ${this.error ? html`<div class="ledger-error">${this.error}</div>` : null}
        ${!this.loading && !this.error ? renderStatementTable(this.rows, i18n, this.currency) : null}
        ${!this.loading && !this.error && (this.assetTotal || this.liabilityEquityTotal)
          ? html`<div class="ledger-summary">
              <div class="ledger-summary-card">
                <span class="meta-label">${i18n.t("totalAssets")}</span>
                <strong>${fmt(this.assetTotal)}</strong>
              </div>
              <div class="ledger-summary-card">
                <span class="meta-label">${i18n.t("totalLiabilitiesEquity")}</span>
                <strong>${fmt(this.liabilityEquityTotal)}</strong>
              </div>
            </div>`
          : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "paprel-balance-sheet": PaprelBalanceSheet;
  }
}
