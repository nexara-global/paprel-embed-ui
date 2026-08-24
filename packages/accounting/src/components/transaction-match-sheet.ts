import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  buildConfirmMatchPayload,
  formatJournalAmount,
  type BankingTransaction,
  type TransactionMatch,
} from "../headless.js";
import { getEmbedClient, getEmbedI18n } from "../context.js";
import { onEmbedLocaleChange } from "../locale-listener.js";
import sharedStyles from "@paprel/ui/styles.css?inline";

@customElement("paprel-transaction-match-sheet")
export class PaprelTransactionMatchSheet extends LitElement {
  static styles = [
    css`${unsafeCSS(sharedStyles)}`,
    css`
      .match-list {
        display: grid;
        gap: 0.75rem;
      }

      .match-card {
        border: 1px solid var(--paprel-color-border, #e8e8e2);
        border-radius: 0.65rem;
        padding: 0.85rem 1rem;
        background: var(--paprel-color-surface, #fff);
      }

      .match-card.is-best {
        border-color: var(--paprel-color-primary, #4f46e5);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--paprel-color-primary, #4f46e5) 15%, transparent);
      }

      .match-card-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.75rem;
      }

      .match-entity {
        display: inline-flex;
        padding: 0.1rem 0.45rem;
        border-radius: 999px;
        font-size: 0.6875rem;
        font-weight: 650;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        background: var(--paprel-color-primary-soft, #eef2ff);
        color: var(--paprel-color-primary, #4f46e5);
      }

      .match-title {
        margin: 0.35rem 0 0;
        font-size: 0.9375rem;
        font-weight: 650;
      }

      .match-meta {
        margin-top: 0.35rem;
        font-size: 0.8125rem;
        color: var(--paprel-color-muted, #78786f);
      }

      .match-amount {
        font-size: 1.0625rem;
        font-variant-numeric: tabular-nums;
        font-weight: 650;
      }

      .match-score {
        margin-top: 0.5rem;
        font-size: 0.75rem;
        color: var(--paprel-color-muted, #78786f);
      }
    `,
  ];

  @property({ type: String, attribute: "transaction-id" }) transactionId = "";
  @state() private loading = true;
  @state() private confirming = false;
  @state() private error = "";
  @state() private actionError = "";
  @state() private transaction: BankingTransaction | null = null;
  @state() private matchRows: TransactionMatch[] = [];

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
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = "";
    this.actionError = "";
    try {
      const detail = await getEmbedClient().transactions.getById(this.transactionId);
      this.transaction = detail;
      let rows = detail.matches ?? [];
      if (!rows.length && detail.banking_account_id) {
        const list = await getEmbedClient().transactions.list({
          account: detail.banking_account_id,
          posted: false,
          excluded: false,
          page: 1,
          pageSize: 100,
        });
        const hit = list.transactions.find((row) => row.id === this.transactionId);
        rows = hit?.matches ?? [];
      }
      this.matchRows = rows;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load matches";
      this.transaction = null;
      this.matchRows = [];
    } finally {
      this.loading = false;
    }
  }

  private isBestMatch(match: TransactionMatch, index: number): boolean {
    if (index !== 0) return false;
    const tier = String(match.confidence_tier ?? "").toLowerCase();
    if (tier === "high") return true;
    return Number(match.score ?? 0) >= 80;
  }

  private matchLabel(match: TransactionMatch): string {
    return match.doc_description ?? match.doc_number ?? match.doc_reference ?? match.entity ?? "";
  }

  private matchAmount(match: TransactionMatch): string {
    const currency = match.doc_currency ?? this.transaction?.currency ?? undefined;
    const amount = Math.abs(Number(match.doc_amount ?? match.amount ?? 0));
    if (!amount) return "—";
    return formatJournalAmount(amount, currency ?? undefined);
  }

  private async confirm(match: TransactionMatch): Promise<void> {
    if (!this.transaction || this.confirming) return;
    this.confirming = true;
    this.actionError = "";
    try {
      const payload = buildConfirmMatchPayload(this.transaction, match);
      await getEmbedClient().transactions.confirmMatch(payload);
      this.dispatchEvent(
        new CustomEvent("transaction-matched", {
          detail: { transactionId: this.transactionId, match },
          bubbles: true,
          composed: true,
        }),
      );
      await this.load();
    } catch (err) {
      this.actionError = err instanceof Error ? err.message : "Failed to confirm match";
    } finally {
      this.confirming = false;
    }
  }

  render() {
    const i18n = getEmbedI18n();

    if (!this.transactionId) {
      return html`<div class="ledger-empty">${i18n.t("selectTransaction")}</div>`;
    }

    if (this.loading) {
      return html`<div class="state-loading">${i18n.t("loadingMatches")}</div>`;
    }

    if (this.error) {
      return html`<div class="ledger-error">${this.error}</div>`;
    }

    if (!this.matchRows.length) {
      return html`<div class="ledger-empty">${i18n.t("noSuggestedMatches")}</div>`;
    }

    return html`
      <div class="match-sheet">
        ${this.actionError ? html`<div class="ledger-error">${this.actionError}</div>` : null}
        <div class="match-list">
          ${this.matchRows.map(
            (match, index) => html`<article class="match-card ${this.isBestMatch(match, index) ? "is-best" : ""}">
              <div class="match-card-head">
                <div>
                  <span class="match-entity">${match.entity ?? ""}</span>
                  <p class="match-title">${this.matchLabel(match)}</p>
                  <div class="match-meta">
                    ${match.doc_date ?? match.date ?? ""}
                    ${match.doc_status ? html` · ${match.doc_status}` : null}
                  </div>
                </div>
                <div class="match-amount">${this.matchAmount(match)}</div>
              </div>
              ${match.score || match.confidence_tier
                ? html`<div class="match-score">
                    ${match.confidence_tier ? html`${match.confidence_tier}` : null}
                    ${match.score ? html`${match.confidence_tier ? " · " : ""}${i18n.t("matchScore", { score: match.score })}` : null}
                  </div>`
                : null}
              <div class="ledger-actions" style="margin-top: 0.75rem">
                <button
                  type="button"
                  class="primary"
                  ?disabled=${this.confirming}
                  @click=${() => this.confirm(match)}
                >
                  ${i18n.t("confirmMatch")}
                </button>
              </div>
            </article>`,
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "paprel-transaction-match-sheet": PaprelTransactionMatchSheet;
  }
}
