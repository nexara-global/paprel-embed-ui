import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { formatJournalAmount, type TransactionDetail } from "../headless.js";
import { getEmbedClient, getEmbedI18n } from "../context.js";
import { onEmbedLocaleChange } from "../locale-listener.js";
import sharedStyles from "@paprel/embed-ui/styles.css?inline";

@customElement("paprel-transaction-detail")
export class PaprelTransactionDetail extends LitElement {
  static styles = [
    css`${unsafeCSS(sharedStyles)}`,
    css`
      .txn-header {
        display: grid;
        gap: 0.35rem;
        margin-bottom: 1rem;
      }

      .txn-header h2 {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 650;
      }

      .txn-amount {
        font-size: 1.5rem;
        font-variant-numeric: tabular-nums;
        font-weight: 650;
      }

      .txn-meta-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
        gap: 0.75rem;
        margin-bottom: 1rem;
      }

      .txn-meta-item {
        display: grid;
        gap: 0.2rem;
      }

      .txn-meta-label {
        font-size: 0.6875rem;
        font-weight: 650;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--paprel-color-muted, #78786f);
      }

      .mapping-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
      }

      .mapping-table th,
      .mapping-table td {
        padding: 0.5rem 0.65rem;
        border-bottom: 1px solid var(--paprel-color-border-subtle, #f0f0eb);
        text-align: left;
      }

      .mapping-table .numeric {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }

      .ledger-section-title {
        margin: 1rem 0 0.5rem;
        font-size: 0.875rem;
        font-weight: 650;
      }
    `,
  ];

  @property({ type: String, attribute: "transaction-id" }) transactionId = "";
  @property({ type: Boolean, attribute: "show-actions" }) showActions = true;
  @state() private loading = true;
  @state() private acting = false;
  @state() private actionError = "";
  @state() private error = "";
  @state() private transaction: TransactionDetail | null = null;

  private offLocaleChange?: () => void;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this.offLocaleChange = onEmbedLocaleChange(() => this.requestUpdate());
    if (this.transactionId) await this.load();
  }

  disconnectedCallback(): void {
    this.offLocaleChange?.();
    super.disconnectedCallback();
  }

  async updated(changed: Map<string, unknown>): Promise<void> {
    if (changed.has("transactionId") && this.transactionId) await this.load();
  }

  async refresh(): Promise<void> {
    if (this.transactionId) await this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      this.transaction = await getEmbedClient().transactions.getById(this.transactionId);
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load transaction";
      this.transaction = null;
    } finally {
      this.loading = false;
    }
  }

  private amount(): string {
    if (!this.transaction) return "—";
    const raw = this.transaction.available_balance ?? this.transaction.amount ?? 0;
    const num = Math.abs(Number(raw));
    if (!num) return "—";
    return formatJournalAmount(num, this.transaction.currency ?? undefined);
  }

  private statusLabel(): string {
    const i18n = getEmbedI18n();
    if (!this.transaction) return "";
    if (this.transaction.is_ignored) return i18n.t("inboxExcluded");
    if (this.transaction.is_posted) return i18n.t("inboxCategorized");
    return i18n.t("inboxUncategorized");
  }

  private typeLabel(): string {
    const i18n = getEmbedI18n();
    const type = this.transaction?.transaction_type;
    if (type === "deposit") return i18n.t("txnDeposit");
    if (type === "withdrawal") return i18n.t("txnWithdrawal");
    return type ?? "";
  }

  private canExclude(): boolean {
    return Boolean(this.transaction && !this.transaction.is_ignored && !this.transaction.is_posted);
  }

  private canRestore(): boolean {
    return Boolean(this.transaction?.is_ignored);
  }

  private async exclude(): Promise<void> {
    if (!this.transactionId || this.acting) return;
    const i18n = getEmbedI18n();
    const reason = window.prompt(i18n.t("excludeReasonPrompt")) ?? "";
    this.acting = true;
    this.actionError = "";
    try {
      await getEmbedClient().transactions.exclude({
        transactions: [this.transactionId],
        reason: reason.trim() || undefined,
      });
      this.dispatchEvent(
        new CustomEvent("transaction-excluded", {
          detail: { transactionId: this.transactionId },
          bubbles: true,
          composed: true,
        }),
      );
      await this.load();
    } catch (err) {
      this.actionError = err instanceof Error ? err.message : "Failed to exclude transaction";
    } finally {
      this.acting = false;
    }
  }

  private async restore(): Promise<void> {
    if (!this.transactionId || this.acting) return;
    this.acting = true;
    this.actionError = "";
    try {
      await getEmbedClient().transactions.restore({ transactions: [this.transactionId] });
      this.dispatchEvent(
        new CustomEvent("transaction-restored", {
          detail: { transactionId: this.transactionId },
          bubbles: true,
          composed: true,
        }),
      );
      await this.load();
    } catch (err) {
      this.actionError = err instanceof Error ? err.message : "Failed to restore transaction";
    } finally {
      this.acting = false;
    }
  }

  render() {
    const i18n = getEmbedI18n();

    if (!this.transactionId) {
      return html`<div class="ledger-empty">${i18n.t("selectTransaction")}</div>`;
    }

    if (this.loading) {
      return html`<div class="state-loading">${i18n.t("loadingTransaction")}</div>`;
    }

    if (this.error) {
      return html`<div class="ledger-error">${this.error}</div>`;
    }

    if (!this.transaction) {
      return html`<div class="ledger-empty">${i18n.t("transactionNotFound")}</div>`;
    }

    const mappings = this.transaction.mapping ?? [];

    return html`
      <div class="txn-detail">
        <header class="txn-header">
          <h2>${this.transaction.description ?? i18n.t("description")}</h2>
          <div class="txn-amount">${this.amount()}</div>
        </header>

        <div class="txn-meta-grid">
          <div class="txn-meta-item">
            <span class="txn-meta-label">${i18n.t("date")}</span>
            <span>${this.transaction.date ?? ""}</span>
          </div>
          <div class="txn-meta-item">
            <span class="txn-meta-label">${i18n.t("type")}</span>
            <span>${this.typeLabel()}</span>
          </div>
          <div class="txn-meta-item">
            <span class="txn-meta-label">${i18n.t("status")}</span>
            <span>${this.statusLabel()}</span>
          </div>
          ${this.transaction.transaction_identifier
            ? html`<div class="txn-meta-item">
                <span class="txn-meta-label">${i18n.t("reference")}</span>
                <span>${this.transaction.transaction_identifier}</span>
              </div>`
            : null}
          ${this.transaction.ignore_reason
            ? html`<div class="txn-meta-item">
                <span class="txn-meta-label">${i18n.t("excludeReason")}</span>
                <span>${this.transaction.ignore_reason}</span>
              </div>`
            : null}
        </div>

        ${this.actionError ? html`<div class="ledger-error">${this.actionError}</div>` : null}

        ${this.showActions && (this.canExclude() || this.canRestore())
          ? html`<div class="ledger-actions">
              ${this.canExclude()
                ? html`<button type="button" class="secondary" ?disabled=${this.acting} @click=${() => this.exclude()}>
                    ${i18n.t("excludeTransaction")}
                  </button>`
                : null}
              ${this.canRestore()
                ? html`<button type="button" class="secondary" ?disabled=${this.acting} @click=${() => this.restore()}>
                    ${i18n.t("restoreTransaction")}
                  </button>`
                : null}
            </div>`
          : null}

        ${mappings.length
          ? html`
              <h3 class="ledger-section-title">${i18n.t("entityMappings")}</h3>
              <div class="ledger-table-wrap">
                <table class="mapping-table">
                  <thead>
                    <tr>
                      <th>${i18n.t("type")}</th>
                      <th>${i18n.t("identifier")}</th>
                      <th class="numeric">${i18n.t("amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${mappings.map(
                      (row) => html`<tr>
                        <td>${row.entity ?? ""}</td>
                        <td>${row.entity_id ?? ""}</td>
                        <td class="numeric">${formatJournalAmount(Number(row.amount ?? 0), this.transaction?.currency ?? undefined)}</td>
                      </tr>`,
                    )}
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
    "paprel-transaction-detail": PaprelTransactionDetail;
  }
}
