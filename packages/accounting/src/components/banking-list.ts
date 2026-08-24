import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  accountI18nKey,
  formatJournalAmount,
  type BankAccountSummary,
  type BankingListResult,
} from "../headless.js";
import { getEmbedClient, getEmbedI18n } from "../context.js";
import { onEmbedLocaleChange } from "../locale-listener.js";
import sharedStyles from "@paprel/ui/styles.css?inline";

@customElement("paprel-banking-list")
export class PaprelBankingList extends LitElement {
  static styles = [
    css`${unsafeCSS(sharedStyles)}`,
    css`
      .banking-table .col-balance,
      .banking-table .col-inbox {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .banking-table .col-kind {
        width: 6rem;
        text-transform: capitalize;
      }
      .banking-badge {
        display: inline-flex;
        min-width: 1.5rem;
        justify-content: center;
        padding: 0.1rem 0.4rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 650;
        background: #fef3c7;
        color: #92400e;
      }
    `,
  ];

  @state() private loading = true;
  @state() private error = "";
  @state() private accounts: BankAccountSummary[] = [];
  @state() private balances: BankingListResult["balances"] = {};

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
      const result = await getEmbedClient().banking.listBankAccounts();
      this.accounts = result.accounts.filter((row) => !row.is_archived);
      this.balances = result.balances ?? {};
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load bank accounts";
      this.accounts = [];
    } finally {
      this.loading = false;
    }
  }

  private balanceFor(accountId: string): number {
    const entries = this.balances?.account_balance ?? [];
    const hit = entries.find((row) => (row.account_id ?? row.banking_account_id) === accountId);
    return Number(hit?.available_balance ?? 0);
  }

  private label(account: BankAccountSummary): string {
    const i18n = getEmbedI18n();
    const key = account.account ?? account.account_name ?? "";
    return i18n.accountLabel(accountI18nKey(String(key)));
  }

  private open(accountId: string): void {
    this.dispatchEvent(
      new CustomEvent("bank-account-select", {
        detail: { accountId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const i18n = getEmbedI18n();
    if (this.loading) return html`<div class="state-loading">${i18n.t("loadingBankAccounts")}</div>`;
    if (this.error) return html`<div class="ledger-error">${this.error}</div>`;
    if (!this.accounts.length) return html`<div class="ledger-empty">${i18n.t("noBankAccounts")}</div>`;

    return html`
      <div class="ledger-table-wrap">
        <table class="ledger-table banking-table">
          <thead>
            <tr>
              <th>${i18n.t("account")}</th>
              <th class="col-kind">${i18n.t("type")}</th>
              <th class="col-inbox">${i18n.t("uncategorized")}</th>
              <th class="col-balance">${i18n.t("balance")}</th>
            </tr>
          </thead>
          <tbody>
            ${this.accounts.map(
              (account) => html`<tr @click=${() => this.open(account.id)}>
                <td>${this.label(account)}</td>
                <td class="col-kind">${account.kind ?? ""}</td>
                <td class="col-inbox">
                  ${account.uncategorized_count
                    ? html`<span class="banking-badge">${account.uncategorized_count}</span>`
                    : "—"}
                </td>
                <td class="col-balance">
                  ${formatJournalAmount(this.balanceFor(account.id), account.currency ?? undefined)}
                </td>
              </tr>`,
            )}
          </tbody>
        </table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "paprel-banking-list": PaprelBankingList;
  }
}
