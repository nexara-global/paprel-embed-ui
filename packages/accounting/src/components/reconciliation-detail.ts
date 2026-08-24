import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { formatJournalAmount, type ReconciliationRecord } from "../headless.js";
import { getEmbedClient, getEmbedI18n } from "../context.js";
import { onEmbedLocaleChange } from "../locale-listener.js";
import sharedStyles from "@paprel/ui/styles.css?inline";

@customElement("paprel-reconciliation-detail")
export class PaprelReconciliationDetail extends LitElement {
  static styles = [
    css`${unsafeCSS(sharedStyles)}`,
    css`
      .recon-header {
        display: grid;
        gap: 0.35rem;
        margin-bottom: 1rem;
      }

      .recon-header h2 {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 650;
      }

      .recon-meta-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
        gap: 0.75rem;
        margin-bottom: 1rem;
      }

      .recon-meta-item {
        display: grid;
        gap: 0.2rem;
      }

      .recon-meta-label {
        font-size: 0.6875rem;
        font-weight: 650;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--paprel-color-muted, #78786f);
      }

      .recon-meta-value {
        font-variant-numeric: tabular-nums;
      }

      .status-pill {
        display: inline-flex;
        padding: 0.1rem 0.45rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: capitalize;
      }

      .status-pill.draft {
        background: #eef2ff;
        color: #4338ca;
      }

      .status-pill.completed {
        background: #dcfce7;
        color: #166534;
      }

      .status-pill.voided {
        background: #fee2e2;
        color: #991b1b;
      }

      .ledger-section-title {
        margin: 1rem 0 0.5rem;
        font-size: 0.9375rem;
        font-weight: 650;
      }
    `,
  ];

  @property({ type: String, attribute: "reconciliation-id" }) reconciliationId = "";
  @property({ type: String }) currency = "";
  @property({ type: Boolean, attribute: "show-actions" }) showActions = true;
  @state() private loading = true;
  @state() private acting = false;
  @state() private error = "";
  @state() private actionError = "";
  @state() private record: ReconciliationRecord | null = null;

  private offLocaleChange?: () => void;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this.offLocaleChange = onEmbedLocaleChange(() => this.requestUpdate());
    if (this.reconciliationId) await this.load();
  }

  disconnectedCallback(): void {
    this.offLocaleChange?.();
    super.disconnectedCallback();
  }

  async updated(changed: Map<string, unknown>): Promise<void> {
    if (changed.has("reconciliationId") && this.reconciliationId) await this.load();
  }

  async refresh(): Promise<void> {
    if (this.reconciliationId) await this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      this.record = await getEmbedClient().reconciliations.getById(this.reconciliationId);
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load reconciliation";
      this.record = null;
    } finally {
      this.loading = false;
    }
  }

  private amount(value: unknown): string {
    const num = Number(value ?? 0);
    if (!num && value !== "0" && value !== 0) return "—";
    return formatJournalAmount(num, this.currency || undefined);
  }

  private statusLabel(status: string): string {
    const i18n = getEmbedI18n();
    if (status === "completed") return i18n.t("reconCompleted");
    if (status === "voided") return i18n.t("voided");
    if (status === "draft") return i18n.t("draft");
    return status;
  }

  private journalsPayload() {
    return (this.record?.lines ?? []).map((line) => ({
      journal_id: line.journal_id,
      journal_line_id: line.journal_line_id,
    }));
  }

  private async finalize(): Promise<void> {
    if (!this.record || this.acting) return;
    this.acting = true;
    this.actionError = "";
    try {
      await getEmbedClient().reconciliations.save(this.record.id, {
        closing_balance: String(this.record.closing_balance ?? ""),
        opening_balance: this.record.opening_balance != null ? String(this.record.opening_balance) : undefined,
        calculated_balance:
          this.record.calculated_balance != null ? String(this.record.calculated_balance) : undefined,
        diff: this.record.diff != null ? String(this.record.diff) : undefined,
        currency: this.currency || undefined,
        status: "completed",
        journals: this.journalsPayload(),
      });
      this.dispatchEvent(
        new CustomEvent("reconciliation-finalized", {
          detail: { reconciliationId: this.record.id },
          bubbles: true,
          composed: true,
        }),
      );
      await this.load();
    } catch (err) {
      this.actionError = err instanceof Error ? err.message : "Failed to finalize reconciliation";
    } finally {
      this.acting = false;
    }
  }

  private async voidReconciliation(): Promise<void> {
    if (!this.record || this.acting) return;
    const i18n = getEmbedI18n();
    const note = window.prompt(i18n.t("voidReconciliationPrompt")) ?? "";
    this.acting = true;
    this.actionError = "";
    try {
      await getEmbedClient().reconciliations.void(this.record.id, {
        note: note.trim() || undefined,
      });
      this.dispatchEvent(
        new CustomEvent("reconciliation-voided", {
          detail: { reconciliationId: this.record.id },
          bubbles: true,
          composed: true,
        }),
      );
      await this.load();
    } catch (err) {
      this.actionError = err instanceof Error ? err.message : "Failed to void reconciliation";
    } finally {
      this.acting = false;
    }
  }

  render() {
    const i18n = getEmbedI18n();

    if (!this.reconciliationId) {
      return html`<div class="ledger-empty">${i18n.t("selectReconciliation")}</div>`;
    }

    if (this.loading) {
      return html`<div class="state-loading">${i18n.t("loadingReconciliation")}</div>`;
    }

    if (this.error) {
      return html`<div class="ledger-error">${this.error}</div>`;
    }

    if (!this.record) {
      return html`<div class="ledger-empty">${i18n.t("reconciliationNotFound")}</div>`;
    }

    const lines = this.record.lines ?? [];
    const isDraft = this.record.status === "draft";
    const isCompleted = this.record.status === "completed";

    return html`
      <div class="recon-detail">
        <header class="recon-header">
          <h2>${this.record.start_date} – ${this.record.end_date}</h2>
          <span class="status-pill ${this.record.status}">${this.statusLabel(this.record.status)}</span>
        </header>

        <div class="recon-meta-grid">
          <div class="recon-meta-item">
            <span class="recon-meta-label">${i18n.t("openingBalance")}</span>
            <span class="recon-meta-value">${this.amount(this.record.opening_balance)}</span>
          </div>
          <div class="recon-meta-item">
            <span class="recon-meta-label">${i18n.t("closingBalance")}</span>
            <span class="recon-meta-value">${this.amount(this.record.closing_balance)}</span>
          </div>
          <div class="recon-meta-item">
            <span class="recon-meta-label">${i18n.t("ledgerBalance")}</span>
            <span class="recon-meta-value">${this.amount(this.record.calculated_balance)}</span>
          </div>
          <div class="recon-meta-item">
            <span class="recon-meta-label">${i18n.t("difference")}</span>
            <span class="recon-meta-value">${this.amount(this.record.diff)}</span>
          </div>
        </div>

        ${this.record.note
          ? html`<p class="ledger-note">${this.record.note}</p>`
          : null}

        ${this.actionError ? html`<div class="ledger-error">${this.actionError}</div>` : null}

        ${this.showActions
          ? html`<div class="ledger-actions">
              ${isDraft
                ? html`<button type="button" class="primary" ?disabled=${this.acting} @click=${() => this.finalize()}>
                    ${i18n.t("finalizeReconciliation")}
                  </button>`
                : null}
              ${isCompleted
                ? html`<button type="button" class="secondary" ?disabled=${this.acting} @click=${() => this.voidReconciliation()}>
                    ${i18n.t("voidReconciliation")}
                  </button>`
                : null}
            </div>`
          : null}

        <h3 class="ledger-section-title">${i18n.t("reconciliationLines")} (${lines.length})</h3>
        <div class="ledger-table-wrap">
          <table class="ledger-table">
            <thead>
              <tr>
                <th>${i18n.t("identifier")}</th>
                <th>${i18n.t("status")}</th>
              </tr>
            </thead>
            <tbody>
              ${lines.length
                ? lines.map(
                    (line) => html`<tr>
                      <td>${line.journal_id.slice(0, 8)}… / ${line.journal_line_id.slice(0, 8)}…</td>
                      <td>${line.is_reconciled ? i18n.t("reconCompleted") : i18n.t("draft")}</td>
                    </tr>`,
                  )
                : html`<tr>
                    <td colspan="2" class="ledger-empty">${i18n.t("noReconciliationLines")}</td>
                  </tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "paprel-reconciliation-detail": PaprelReconciliationDetail;
  }
}
