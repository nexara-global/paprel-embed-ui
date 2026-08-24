import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  accountI18nKey,
  formatJournalAmount,
  normalizeIsoDate,
  todayIsoDate,
  type TrialBalanceRow,
} from "@paprel/accounting";
import { getEmbedClient, getEmbedI18n } from "@paprel/accounting";
import { isoDateField } from "../lib/iso-date-field.js";
import { onEmbedLocaleChange } from "../locale-listener.js";
import sharedStyles from "@paprel/ui/styles.css?inline";

@customElement("paprel-trial-balance")
export class PaprelTrialBalance extends LitElement {
  static styles = [css`${unsafeCSS(sharedStyles)}`];

  @property({ type: String, attribute: "as-of-date" }) asOfDate = "";
  @property({ type: String }) currency = "";
  @state() private loading = true;
  @state() private error = "";
  @state() private rows: TrialBalanceRow[] = [];
  @state() private reportDate = "";

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

  async updated(changed: Map<string, unknown>): Promise<void> {
    if (changed.has("asOfDate") || changed.has("currency")) await this.load();
  }

  async refresh(): Promise<void> {
    await this.load();
  }

  private defaultDate(): string {
    return todayIsoDate();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      const report = await getEmbedClient().reports.trialBalance({
        date: normalizeIsoDate(this.asOfDate) || this.defaultDate(),
        currency: this.currency || undefined,
      });
      this.rows = report.trial_balance ?? [];
      this.reportDate = normalizeIsoDate(report.as_of_date) || (normalizeIsoDate(this.asOfDate) || this.defaultDate());
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load trial balance";
      this.rows = [];
    } finally {
      this.loading = false;
    }
  }

  private onDateChange(value: string): void {
    this.asOfDate = value;
    void this.load();
  }

  private accountLabel(row: TrialBalanceRow): string {
    const i18n = getEmbedI18n();
    const key = row.account_name != null ? String(row.account_name) : "";
    return i18n.accountLabel(accountI18nKey(key));
  }

  private amount(value: unknown): string {
    const num = Number(value ?? 0);
    if (!num) return "—";
    return formatJournalAmount(num, this.currency || undefined);
  }

  private totals() {
    let debit = 0;
    let credit = 0;
    for (const row of this.rows) {
      debit += Number(row.debit ?? 0);
      credit += Number(row.credit ?? 0);
    }
    return { debit, credit };
  }

  render() {
    const i18n = getEmbedI18n();
    const dateValue = normalizeIsoDate(this.asOfDate || this.reportDate || this.defaultDate());

    return html`
      <div class="ledger-report">
        <div class="ledger-filters">
          <label class="field">${i18n.t("asOfDate")}
            ${isoDateField(dateValue, (value) => this.onDateChange(value))}
          </label>
        </div>

        ${this.loading ? html`<div class="state-loading">${i18n.t("loadingTrialBalance")}</div>` : null}
        ${this.error ? html`<div class="ledger-error">${this.error}</div>` : null}

        ${!this.loading && !this.error
          ? html`
              <div class="ledger-table-wrap">
                <table class="ledger-table">
                  <thead>
                    <tr>
                      <th>${i18n.t("account")}</th>
                      <th>${i18n.t("number")}</th>
                      <th class="numeric">${i18n.t("netDebit")}</th>
                      <th class="numeric">${i18n.t("netCredit")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.rows.length
                      ? this.rows.map(
                          (row) => html`<tr>
                            <td>${this.accountLabel(row)}</td>
                            <td>${row.account_number ?? ""}</td>
                            <td class="numeric">${this.amount(row.debit)}</td>
                            <td class="numeric">${this.amount(row.credit)}</td>
                          </tr>`,
                        )
                      : html`<tr>
                          <td colspan="4" class="ledger-empty">${i18n.t("noReportRows")}</td>
                        </tr>`}
                  </tbody>
                  ${this.rows.length
                    ? html`<tfoot>
                        <tr>
                          <td colspan="2">${i18n.t("total")}</td>
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
    "paprel-trial-balance": PaprelTrialBalance;
  }
}
