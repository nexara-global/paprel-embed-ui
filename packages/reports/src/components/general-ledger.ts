import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  accountI18nKey,
  defaultYearToDateRange,
  formatJournalAmount,
  parseDateRangeParam,
  type GeneralLedgerRow,
} from "@paprel/embed-accounting";
import { getEmbedClient, getEmbedI18n } from "@paprel/embed-accounting";
import { isoDateField } from "../lib/iso-date-field.js";
import { onEmbedLocaleChange } from "../locale-listener.js";
import sharedStyles from "@paprel/embed-ui/styles.css?inline";

@customElement("paprel-general-ledger")
export class PaprelGeneralLedger extends LitElement {
  static styles = [css`${unsafeCSS(sharedStyles)}`];

  @property({ type: String, attribute: "date-range" }) dateRange = "";
  @property({ type: String, attribute: "account-id" }) accountId = "";
  @property({ type: String }) currency = "";
  @state() private loading = true;
  @state() private error = "";
  @state() private rows: GeneralLedgerRow[] = [];
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

  async updated(changed: Map<string, unknown>): Promise<void> {
    if (changed.has("dateRange") || changed.has("accountId") || changed.has("currency")) {
      await this.load();
    }
  }

  async refresh(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      const range = this.dateRange || defaultYearToDateRange().param;
      const report = await getEmbedClient().reports.generalLedger({
        dateRange: range,
        currency: this.currency || undefined,
        accountId: this.accountId || undefined,
      });
      this.rows = report.ledger ?? [];
      const parsed = parseDateRangeParam(report.date_range ?? range);
      this.rangeFrom = parsed.from;
      this.rangeTo = parsed.to;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load general ledger";
      this.rows = [];
    } finally {
      this.loading = false;
    }
  }

  private syncRange(): void {
    this.dateRange = `${this.rangeFrom},${this.rangeTo}`;
    void this.load();
  }

  private accountLabel(row: GeneralLedgerRow): string {
    const i18n = getEmbedI18n();
    const key = row.account != null ? String(row.account) : "";
    return i18n.accountLabel(accountI18nKey(key));
  }

  private subtypeLabel(row: GeneralLedgerRow): string {
    const i18n = getEmbedI18n();
    return i18n.accountLabel(accountI18nKey(String(row.account_subtype ?? "")));
  }

  private displayCurrency(): string | undefined {
    if (this.currency) return this.currency;
    const code = this.rows[0]?.account_currency;
    return code != null && String(code).trim() ? String(code) : undefined;
  }

  private amount(value: unknown): string {
    const num = Number(value ?? 0);
    if (!num) return "—";
    return formatJournalAmount(num, this.displayCurrency());
  }

  private totals() {
    let debit = 0;
    let credit = 0;
    for (const row of this.rows) {
      debit += Number(row.total_debit_fcy ?? row.total_debit_bcy ?? 0);
      credit += Number(row.total_credit_fcy ?? row.total_credit_bcy ?? 0);
    }
    return { debit, credit };
  }

  render() {
    const i18n = getEmbedI18n();

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

        ${this.loading ? html`<div class="state-loading">${i18n.t("loadingGeneralLedger")}</div>` : null}
        ${this.error ? html`<div class="ledger-error">${this.error}</div>` : null}

        ${!this.loading && !this.error
          ? html`
              <div class="ledger-table-wrap">
                <table class="ledger-table">
                  <thead>
                    <tr>
                      <th>${i18n.t("account")}</th>
                      <th>${i18n.t("number")}</th>
                      <th>${i18n.t("subtype")}</th>
                      <th class="numeric">${i18n.t("debit")}</th>
                      <th class="numeric">${i18n.t("credit")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.rows.length
                      ? this.rows.map(
                          (row) => html`<tr>
                            <td>${this.accountLabel(row)}</td>
                            <td>${row.account_number ?? ""}</td>
                            <td>${this.subtypeLabel(row)}</td>
                            <td class="numeric">${this.amount(row.total_debit_fcy ?? row.total_debit_bcy)}</td>
                            <td class="numeric">${this.amount(row.total_credit_fcy ?? row.total_credit_bcy)}</td>
                          </tr>`,
                        )
                      : html`<tr>
                          <td colspan="5" class="ledger-empty">${i18n.t("noReportRows")}</td>
                        </tr>`}
                  </tbody>
                  ${this.rows.length
                    ? html`<tfoot>
                        <tr>
                          <td colspan="3">${i18n.t("total")}</td>
                          <td class="numeric">${this.amount(this.totals().debit)}</td>
                          <td class="numeric">${this.amount(this.totals().credit)}</td>
                        </tr>
                      </tfoot>`
                    : null}
                </table>
              </div>
            `
          : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "paprel-general-ledger": PaprelGeneralLedger;
  }
}
