import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { JournalDetail } from "../headless.js";
import {
  accountI18nKey,
  accountPickerOptionLabel,
  computeJournalTotals,
  formatJournalAmount,
  lineDisplayCredit,
  lineDisplayDebit,
} from "../headless.js";
import { getEmbedClient, getEmbedI18n } from "../context.js";
import { onEmbedLocaleChange } from "../locale-listener.js";
import sharedStyles from "@paprel/ui/styles.css?inline";

@customElement("paprel-journal-detail")
export class PaprelJournalDetail extends LitElement {
  static styles = [
    css`${unsafeCSS(sharedStyles)}`,
    css`
      .ledger-detail-top .ledger-meta-panel { margin-top: 0; }
      .ledger-detail-status { margin-top: 0.75rem; }
    `,
  ];

  @property({ type: String, attribute: "journal-id" }) journalId = "";
  /** When false, hides void/delete/edit action buttons (read-only embed). */
  @property({ type: Boolean, attribute: "show-actions" }) showActions = true;
  @state() private loading = true;
  @state() private error = "";
  @state() private actionError = "";
  @state() private acting = false;
  @state() private journal: JournalDetail | null = null;
  @state() private accountLabels = new Map<string, string>();

  private offLocaleChange?: () => void;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this.offLocaleChange = onEmbedLocaleChange(() => this.requestUpdate());
    if (this.journalId) await this.load();
  }

  disconnectedCallback(): void {
    this.offLocaleChange?.();
    super.disconnectedCallback();
  }

  async updated(changed: Map<string, unknown>): Promise<void> {
    if (changed.has("journalId") && this.journalId) await this.load();
  }

  async refresh(): Promise<void> {
    if (this.journalId) await this.load();
  }

  private async loadAccounts(): Promise<void> {
    const i18n = getEmbedI18n();
    try {
      const accounts = await getEmbedClient().accounts.list();
      const labels = new Map<string, string>();
      for (const account of accounts) {
        if (account.id) {
          labels.set(account.id, accountPickerOptionLabel(i18n, account));
        }
      }
      this.accountLabels = labels;
    } catch {
      this.accountLabels = new Map();
    }
  }

  private accountName(accountId: string): string {
    const mapped = this.accountLabels.get(accountId);
    if (mapped) return mapped;
    const i18n = getEmbedI18n();
    return i18n.accountLabel(accountI18nKey(accountId));
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      const [journal] = await Promise.all([
        getEmbedClient().journals.getById(this.journalId),
        this.loadAccounts(),
      ]);
      this.journal = journal;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load journal";
      this.journal = null;
    } finally {
      this.loading = false;
    }
  }

  private emitAction(action: "edit" | "copy" | "reverse"): void {
    if (!this.journalId) return;
    this.dispatchEvent(
      new CustomEvent("journal-action", {
        detail: { action, journalId: this.journalId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private canEdit(journal: JournalDetail): boolean {
    return !journal.is_voided && !Boolean(journal.posted ?? journal.is_posted);
  }

  private canVoid(journal: JournalDetail): boolean {
    return !journal.is_voided && Boolean(journal.posted ?? journal.is_posted);
  }

  private canDelete(journal: JournalDetail): boolean {
    return !journal.is_voided && !Boolean(journal.posted ?? journal.is_posted);
  }

  private async voidJournal(): Promise<void> {
    const i18n = getEmbedI18n();
    if (!this.journalId || !this.journal) return;
    if (!window.confirm(i18n.t("confirmVoidJournal"))) return;

    const reason = window.prompt(i18n.t("voidReason")) ?? undefined;
    this.acting = true;
    this.actionError = "";
    try {
      await getEmbedClient().journals.voidJournal({ journal_id: this.journalId, reason });
      this.dispatchEvent(
        new CustomEvent("journal-voided", {
          detail: { journalId: this.journalId },
          bubbles: true,
          composed: true,
        }),
      );
      await this.load();
    } catch (err) {
      this.actionError = err instanceof Error ? err.message : "Void failed";
    } finally {
      this.acting = false;
    }
  }

  private async deleteJournal(): Promise<void> {
    const i18n = getEmbedI18n();
    if (!this.journalId) return;
    if (!window.confirm(i18n.t("confirmDeleteJournal"))) return;

    this.acting = true;
    this.actionError = "";
    try {
      await getEmbedClient().journals.delete(this.journalId);
      this.dispatchEvent(
        new CustomEvent("journal-deleted", {
          detail: { journalId: this.journalId },
          bubbles: true,
          composed: true,
        }),
      );
      this.journal = null;
    } catch (err) {
      this.actionError = err instanceof Error ? err.message : "Delete failed";
    } finally {
      this.acting = false;
    }
  }

  private actionBar(journal: JournalDetail) {
    if (!this.showActions) return null;
    const i18n = getEmbedI18n();

    return html`
      <div class="ledger-action-bar">
        ${this.canEdit(journal)
          ? html`<button type="button" class="secondary" ?disabled=${this.acting} @click=${() => this.emitAction("edit")}>
              ${i18n.t("edit")}
            </button>`
          : null}
        ${this.canEdit(journal)
          ? html`<button type="button" class="secondary" ?disabled=${this.acting} @click=${() => this.emitAction("copy")}>
              ${i18n.t("copy")}
            </button>`
          : null}
        ${this.canEdit(journal)
          ? html`<button type="button" class="secondary" ?disabled=${this.acting} @click=${() => this.emitAction("reverse")}>
              ${i18n.t("reverse")}
            </button>`
          : null}
        ${this.canVoid(journal)
          ? html`<button type="button" class="secondary" ?disabled=${this.acting} @click=${this.voidJournal}>
              ${i18n.t("void")}
            </button>`
          : null}
        ${this.canDelete(journal)
          ? html`<button type="button" class="secondary" ?disabled=${this.acting} @click=${this.deleteJournal}>
              ${i18n.t("delete")}
            </button>`
          : null}
      </div>
      ${this.actionError ? html`<div class="ledger-error">${this.actionError}</div>` : null}
    `;
  }

  private statusPills(journal: JournalDetail) {
    const i18n = getEmbedI18n();
    const posted = Boolean(journal.posted ?? journal.is_posted);
    const voided = Boolean(journal.is_voided);
    const reversal = Boolean(journal.is_reversal);

    return html`
      <div class="status-row">
        ${voided
          ? html`<span class="status-pill voided">${i18n.t("voided")}</span>`
          : posted
            ? html`<span class="status-pill posted">${i18n.t("posted")}</span>`
            : html`<span class="status-pill draft">${i18n.t("draft")}</span>`}
        ${reversal ? html`<span class="status-pill reversal">${i18n.t("reversal")}</span>` : null}
      </div>
    `;
  }

  render() {
    const i18n = getEmbedI18n();
    if (!this.journalId) {
      return html`<div class="ledger-empty">${i18n.t("selectJournal")}</div>`;
    }
    if (this.loading) {
      return html`<div class="state-loading">${i18n.t("loadingJournal")}</div>`;
    }
    if (this.error) {
      return html`<div class="ledger-error">${this.error}</div>`;
    }
    if (!this.journal) {
      return html`<div class="ledger-empty">${i18n.t("journalNotFound")}</div>`;
    }

    const lines = this.journal.lines ?? [];
    const { debit, credit } = computeJournalTotals(lines);
    const identifier = this.journal.identifier ?? this.journal.reference ?? this.journal.id;
    const showFx =
      this.journal.exchange_rate != null && String(this.journal.exchange_rate) !== "1";

    const metaRows: { label: string; value: string }[] = [
      { label: "Journal", value: `#${identifier}` },
    ];
    if (this.journal.description) {
      metaRows.push({ label: i18n.t("description"), value: this.journal.description });
    }
    if (this.journal.date) metaRows.push({ label: i18n.t("date"), value: this.journal.date });
    if (this.journal.reference) metaRows.push({ label: i18n.t("reference"), value: this.journal.reference });
    if (this.journal.currency) metaRows.push({ label: i18n.t("currency"), value: this.journal.currency });
    if (showFx) {
      metaRows.push({ label: i18n.t("exchangeRate"), value: String(this.journal.exchange_rate) });
    }

    return html`
      <div class="ledger-detail">
        ${this.actionBar(this.journal)}
        <div class="ledger-detail-top">
          <div>
            ${metaRows.length
              ? html`
                  <div class="ledger-meta-panel">
                    ${metaRows.map(
                      (row) => html`
                        <div class="ledger-meta-row">
                          <span class="meta-label">${row.label}</span>
                          <span class="ledger-meta-value">${row.value}</span>
                        </div>
                      `,
                    )}
                  </div>
                `
              : null}
            <div class="ledger-detail-status">${this.statusPills(this.journal)}</div>

            ${this.journal.is_manual_override && this.journal.is_manual
              ? html`<div class="override-banner">
                  <strong>${i18n.t("manualOverride")}</strong>
                  ${this.journal.override_reason
                    ? html`<div style="margin-top:0.25rem;font-style:italic">${this.journal.override_reason}</div>`
                    : null}
                </div>`
              : null}
          </div>

          <div class="ledger-amount-panel">
            <span class="meta-label">${i18n.t("amount")}</span>
            <div class="ledger-amount-value">${formatJournalAmount(debit, this.journal.currency)}</div>
          </div>
        </div>

        <div class="ledger-table-wrap">
          <table class="ledger-table">
            <thead>
              <tr>
                <th>${i18n.t("account")}</th>
                <th>${i18n.t("description")}</th>
                <th class="numeric">${i18n.t("debit")}</th>
                <th class="numeric">${i18n.t("credit")}</th>
              </tr>
            </thead>
            <tbody>
              ${lines.map((line) => {
                const debitAmt = parseFloat(lineDisplayDebit(line)) || 0;
                const creditAmt = parseFloat(lineDisplayCredit(line)) || 0;
                return html`<tr>
                  <td>${this.accountName(line.account_id)}</td>
                  <td>${line.description || "—"}</td>
                  <td class="numeric">${debitAmt ? formatJournalAmount(debitAmt, this.journal?.currency) : ""}</td>
                  <td class="numeric">${creditAmt ? formatJournalAmount(creditAmt, this.journal?.currency) : ""}</td>
                </tr>`;
              })}
            </tbody>
            <tfoot>
              <tr>
                <td></td>
                <td>${i18n.t("total")}</td>
                <td class="numeric">${formatJournalAmount(debit, this.journal.currency)}</td>
                <td class="numeric">${formatJournalAmount(credit, this.journal.currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "paprel-journal-detail": PaprelJournalDetail;
  }
}
