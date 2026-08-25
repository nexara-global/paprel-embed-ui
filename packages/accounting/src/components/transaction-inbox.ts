import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  formatJournalAmount,
  type BankingTransaction,
  type TransactionInbox,
} from "../headless.js";
import { getEmbedClient, getEmbedI18n } from "../context.js";
import { onEmbedLocaleChange } from "../locale-listener.js";
import sharedStyles from "@paprel/embed-ui/styles.css?inline";
import { dispatchPaprelResourceOpen, dispatchPaprelViewChange, type PaprelViewChangeReason } from "@paprel/embed-core";

const INBOX_VALUES: TransactionInbox[] = ["uncategorized", "categorized", "excluded"];

@customElement("paprel-transaction-inbox")
export class PaprelTransactionInbox extends LitElement {
  static styles = [
    css`${unsafeCSS(sharedStyles)}`,
    css`
      .inbox-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        margin-bottom: 0.75rem;
      }

      .inbox-tabs button {
        border: 1px solid var(--paprel-color-border, #e8e8e2);
        background: var(--paprel-color-surface, #fff);
        color: var(--paprel-color-text, #1c1c1a);
        border-radius: 999px;
        padding: 0.35rem 0.85rem;
        font-size: 0.8125rem;
        cursor: pointer;
      }

      .inbox-tabs button[aria-pressed="true"] {
        background: var(--paprel-color-primary-soft, #eef2ff);
        border-color: var(--paprel-color-primary, #4f46e5);
        color: var(--paprel-color-primary, #4f46e5);
        font-weight: 650;
      }

      .txn-table tbody tr {
        cursor: pointer;
      }

      .txn-table tbody tr:hover {
        background: var(--paprel-color-surface-muted, #f7f7f4);
      }

      .txn-table .col-date {
        width: 6.5rem;
        white-space: nowrap;
      }

      .txn-table .col-amount {
        text-align: right;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      .txn-type {
        display: inline-flex;
        padding: 0.1rem 0.45rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: capitalize;
      }

      .txn-type.deposit {
        background: #dcfce7;
        color: #166534;
      }

      .txn-type.withdrawal {
        background: #fee2e2;
        color: #991b1b;
      }
    `,
  ];

  @property({ type: String, attribute: "bank-account-id" }) bankAccountId = "";
  @property({ type: String }) inbox: TransactionInbox = "uncategorized";
  @property({ type: Number }) page = 1;
  @property({ type: Number, attribute: "page-size" }) pageSize = 25;
  @property({ type: String }) search = "";
  @property({ type: String }) currency = "";
  @property({ type: Boolean, attribute: "show-inbox-tabs" }) showInboxTabs = true;
  @state() private loading = true;
  @state() private error = "";
  @state() private rows: BankingTransaction[] = [];
  @state() private totalRecords = 0;
  @state() private searchDraft = "";

  private offLocaleChange?: () => void;
  private referenceDebounce?: ReturnType<typeof setTimeout>;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this.searchDraft = this.search;
    this.offLocaleChange = onEmbedLocaleChange(() => this.requestUpdate());
    await this.load();
  }

  disconnectedCallback(): void {
    this.offLocaleChange?.();
    if (this.referenceDebounce) clearTimeout(this.referenceDebounce);
    super.disconnectedCallback();
  }

  async updated(changed: Map<string, unknown>): Promise<void> {
    if (
      changed.has("bankAccountId") ||
      changed.has("inbox") ||
      changed.has("page") ||
      changed.has("pageSize") ||
      changed.has("search") ||
      changed.has("currency")
    ) {
      if (changed.has("search")) this.searchDraft = this.search;
      await this.load();
    }
  }

  async refresh(): Promise<void> {
    await this.load();
  }

  private inboxParams(): { posted?: boolean; excluded?: boolean } {
    if (this.inbox === "excluded") return { excluded: true };
    if (this.inbox === "categorized") return { posted: true, excluded: false };
    return { posted: false, excluded: false };
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      const { posted, excluded } = this.inboxParams();
      const result = await getEmbedClient().transactions.list({
        account: this.bankAccountId || undefined,
        posted,
        excluded,
        page: this.page,
        pageSize: this.pageSize,
        currency: this.currency || undefined,
        description: this.search.trim() || undefined,
      });
      this.rows = result.transactions;
      this.totalRecords = result.totalRecords ?? result.transactions.length;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load transactions";
      this.rows = [];
      this.totalRecords = 0;
    } finally {
      this.loading = false;
    }
  }

  private totalPages(): number {
    if (!this.pageSize) return 1;
    return Math.max(1, Math.ceil(this.totalRecords / this.pageSize));
  }

  private viewState() {
    return {
      page: this.page,
      pageSize: this.pageSize,
      search: this.search.trim(),
      tab: this.inbox,
    } as const;
  }

  private emitViewChange(reason: PaprelViewChangeReason): void {
    dispatchPaprelViewChange(this, {
      source: { component: this.localName },
      reason,
      state: this.viewState(),
    });
  }

  private goToPage(next: number): void {
    const page = Math.min(Math.max(1, next), this.totalPages());
    if (page === this.page) return;
    this.page = page;
    this.emitViewChange("page");
  }

  private setInbox(next: TransactionInbox): void {
    if (this.inbox === next) return;
    this.inbox = next;
    this.page = 1;
    this.emitViewChange("tab");
  }

  private open(row: BankingTransaction): void {
    const useDefault = dispatchPaprelResourceOpen(this, {
      source: { component: this.localName },
      resource: "transaction",
      id: row.id,
    });
    if (!useDefault) return;
    this.dispatchEvent(
      new CustomEvent("transaction-select", {
        detail: { transactionId: row.id, transaction: row },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private rowAmount(row: BankingTransaction): string {
    const raw = row.available_balance ?? row.amount ?? 0;
    const num = Math.abs(Number(raw));
    if (!num) return "—";
    const code = row.currency ?? this.currency ?? undefined;
    return formatJournalAmount(num, code ?? undefined);
  }

  private inboxLabel(inbox: TransactionInbox): string {
    const i18n = getEmbedI18n();
    if (inbox === "categorized") return i18n.t("inboxCategorized");
    if (inbox === "excluded") return i18n.t("inboxExcluded");
    return i18n.t("inboxUncategorized");
  }

  private typeLabel(type: string | undefined): string {
    const i18n = getEmbedI18n();
    if (type === "deposit") return i18n.t("txnDeposit");
    if (type === "withdrawal") return i18n.t("txnWithdrawal");
    return type ?? "";
  }

  render() {
    const i18n = getEmbedI18n();

    return html`
      <div class="ledger-report">
        ${this.showInboxTabs ? html`<div class="inbox-tabs" role="tablist" aria-label=${i18n.t("inboxFilter")}>
          ${INBOX_VALUES.map(
            (value) => html`<button
              type="button"
              role="tab"
              aria-pressed=${this.inbox === value ? "true" : "false"}
              @click=${() => this.setInbox(value)}
            >
              ${this.inboxLabel(value)}
            </button>`,
          )}
        </div>` : null}

        <div class="ledger-filters">
          <label class="field">
            <input
              type="search"
              .value=${this.searchDraft}
              placeholder=${i18n.t("description")}
              @input=${(e: Event) => {
                this.searchDraft = (e.target as HTMLInputElement).value;
                if (this.referenceDebounce) clearTimeout(this.referenceDebounce);
                this.referenceDebounce = setTimeout(() => {
                  this.page = 1;
                  this.search = this.searchDraft;
                  this.emitViewChange("search");
                }, 300);
              }}
            />
          </label>
          <div class="ledger-pagination">
            <button type="button" class="secondary" ?disabled=${this.page <= 1} @click=${() => this.goToPage(this.page - 1)}>
              ${i18n.t("previous")}
            </button>
            <span>${i18n.t("pageOf", { page: this.page })}</span>
            <button
              type="button"
              class="secondary"
              ?disabled=${this.page >= this.totalPages()}
              @click=${() => this.goToPage(this.page + 1)}
            >
              ${i18n.t("next")}
            </button>
          </div>
        </div>

        ${this.loading ? html`<div class="state-loading">${i18n.t("loadingTransactions")}</div>` : null}
        ${this.error ? html`<div class="ledger-error">${this.error}</div>` : null}

        ${!this.loading && !this.error
          ? html`
              <div class="ledger-toolbar">
                <span>${i18n.t("transactionCount", { count: this.totalRecords })}</span>
              </div>
              <div class="ledger-table-wrap">
                <table class="ledger-table txn-table">
                  <thead>
                    <tr>
                      <th class="col-date">${i18n.t("date")}</th>
                      <th>${i18n.t("description")}</th>
                      <th>${i18n.t("type")}</th>
                      <th class="col-amount">${i18n.t("amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.rows.length
                      ? this.rows.map(
                          (row) => html`<tr @click=${() => this.open(row)}>
                            <td class="col-date">${row.date ?? ""}</td>
                            <td>${row.description ?? ""}</td>
                            <td>
                              <span class="txn-type ${row.transaction_type ?? ""}">
                                ${this.typeLabel(row.transaction_type)}
                              </span>
                            </td>
                            <td class="col-amount">${this.rowAmount(row)}</td>
                          </tr>`,
                        )
                      : html`<tr>
                          <td colspan="4" class="ledger-empty">${i18n.t("noTransactions")}</td>
                        </tr>`}
                  </tbody>
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
    "paprel-transaction-inbox": PaprelTransactionInbox;
  }
}
