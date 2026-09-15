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
import sharedStyles from "@paprel/embed-ui/styles.css?inline";

@customElement("paprel-journal-detail")
export class PaprelJournalDetail extends LitElement {
  static styles = [
    css`${unsafeCSS(sharedStyles)}`,
    css`
      .ledger-detail-top .ledger-meta-panel { margin-top: 0; }
      .ledger-detail-status { margin-top: 0.75rem; }
      .journal-history-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
      }
      .journal-history-bar label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
        font-weight: 650;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--paprel-color-muted, #78786f);
      }
      .journal-compare-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      .journal-compare-pane {
        border: 1px solid var(--paprel-color-border, #e8e8e2);
        border-radius: 0.75rem;
        overflow: hidden;
      }
      .journal-compare-pane.is-current .journal-compare-banner {
        background: #1f2933;
        color: #fff;
      }
      .journal-compare-pane.is-snapshot .journal-compare-banner {
        background: var(--paprel-color-surface-muted, #f7f7f4);
      }
      .journal-compare-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        min-height: 2.75rem;
        padding: 0.5rem 0.875rem;
        font-size: 0.6875rem;
        font-weight: 750;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .journal-compare-pane.is-snapshot .ledger-detail {
        opacity: 0.82;
        filter: grayscale(0.35);
      }
      @media (max-width: 767px) {
        .journal-compare-grid { display: block; }
        .journal-compare-pane.is-snapshot { display: none; }
        .journal-history-bar { display: none; }
      }
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
  @state() private compareJournal: JournalDetail | null = null;
  @state() private compareVersionId = "";
  @state() private compareLoading = false;
  @state() private accountLabels = new Map<string, string>();
  @state() private wideEnough = true;

  private offLocaleChange?: () => void;
  private onResize = (): void => {
    const next = typeof window === "undefined" || window.matchMedia("(min-width: 768px)").matches;
    if (next !== this.wideEnough) {
      this.wideEnough = next;
      if (!next) this.clearCompare();
    }
  };

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this.offLocaleChange = onEmbedLocaleChange(() => this.requestUpdate());
    this.onResize();
    window.addEventListener("resize", this.onResize);
    if (this.journalId) await this.load();
  }

  disconnectedCallback(): void {
    this.offLocaleChange?.();
    window.removeEventListener("resize", this.onResize);
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
    this.clearCompare();
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

  private clearCompare(): void {
    this.compareVersionId = "";
    this.compareJournal = null;
    this.compareLoading = false;
  }

  private versionHistory() {
    return this.journal?.version_history ?? [];
  }

  private async onHistoryChange(event: Event): Promise<void> {
    if (!this.wideEnough) return;
    const versionId = (event.target as HTMLSelectElement).value;
    if (!versionId || versionId === this.journal?.id) {
      this.clearCompare();
      return;
    }
    this.compareVersionId = versionId;
    this.compareLoading = true;
    this.compareJournal = null;
    try {
      const anchor = this.journal?.anchor_id || this.journalId;
      this.compareJournal = await getEmbedClient().journals.getById(anchor, versionId);
    } catch {
      this.compareJournal = null;
    } finally {
      this.compareLoading = false;
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

  private journalPane(journal: JournalDetail) {
    const i18n = getEmbedI18n();
    const lines = journal.lines ?? [];
    const { debit, credit } = computeJournalTotals(lines);
    const identifier = journal.identifier ?? journal.reference ?? journal.id;
    const showFx = journal.exchange_rate != null && String(journal.exchange_rate) !== "1";

    const metaRows: { label: string; value: string }[] = [
      { label: "Journal", value: `#${identifier}` },
    ];
    if (journal.description) {
      metaRows.push({ label: i18n.t("description"), value: journal.description });
    }
    if (journal.date) metaRows.push({ label: i18n.t("date"), value: journal.date });
    if (journal.reference) metaRows.push({ label: i18n.t("reference"), value: journal.reference });
    if (journal.currency) metaRows.push({ label: i18n.t("currency"), value: journal.currency });
    if (showFx) {
      metaRows.push({ label: i18n.t("exchangeRate"), value: String(journal.exchange_rate) });
    }

    return html`
      <div class="ledger-detail">
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
            <div class="ledger-detail-status">${this.statusPills(journal)}</div>

            ${journal.is_manual_override && journal.is_manual
              ? html`<div class="override-banner">
                  <strong>${i18n.t("manualOverride")}</strong>
                  ${journal.override_reason
                    ? html`<div style="margin-top:0.25rem;font-style:italic">${journal.override_reason}</div>`
                    : null}
                </div>`
              : null}
          </div>

          <div class="ledger-amount-panel">
            <span class="meta-label">${i18n.t("amount")}</span>
            <div class="ledger-amount-value">${formatJournalAmount(debit, journal.currency)}</div>
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
                  <td class="numeric">${debitAmt ? formatJournalAmount(debitAmt, journal.currency) : ""}</td>
                  <td class="numeric">${creditAmt ? formatJournalAmount(creditAmt, journal.currency) : ""}</td>
                </tr>`;
              })}
            </tbody>
            <tfoot>
              <tr>
                <td></td>
                <td>${i18n.t("total")}</td>
                <td class="numeric">${formatJournalAmount(debit, journal.currency)}</td>
                <td class="numeric">${formatJournalAmount(credit, journal.currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
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

    const history = this.versionHistory();
    const comparing = Boolean(this.compareVersionId) && this.wideEnough;

    return html`
      <div>
        ${this.actionBar(this.journal)}
        ${history.length > 1 && this.wideEnough
          ? html`
              <div class="journal-history-bar">
                <label>
                  ${i18n.t("versionHistory")}
                  <select .value=${this.compareVersionId || this.journal.id} @change=${this.onHistoryChange}>
                    ${history.map(
                      (version) => html`
                        <option value=${version.id} ?disabled=${version.is_current}>
                          v${version.version_number}
                          ${version.is_current ? i18n.t("currentVersion") : i18n.t("archivedVersion")}
                        </option>
                      `,
                    )}
                  </select>
                </label>
                ${comparing
                  ? html`<button type="button" class="secondary" @click=${this.clearCompare}>
                      ${i18n.t("closeComparison")}
                    </button>`
                  : null}
              </div>
            `
          : null}
        ${comparing
          ? html`
              <div class="journal-compare-grid">
                <div class="journal-compare-pane is-current">
                  <div class="journal-compare-banner">
                    ${i18n.t("currentVersion")} v${this.journal.version_number ?? ""}
                  </div>
                  ${this.journalPane(this.journal)}
                </div>
                <div class="journal-compare-pane is-snapshot">
                  <div class="journal-compare-banner">
                    ${i18n.t("snapshotVersion")}
                    ${this.compareJournal ? html`v${this.compareJournal.version_number ?? ""}` : null}
                  </div>
                  ${this.compareLoading
                    ? html`<div class="state-loading">${i18n.t("loadingJournal")}</div>`
                    : this.compareJournal
                      ? this.journalPane(this.compareJournal)
                      : html`<div class="ledger-empty">${i18n.t("journalNotFound")}</div>`}
                </div>
              </div>
            `
          : this.journalPane(this.journal)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "paprel-journal-detail": PaprelJournalDetail;
  }
}
