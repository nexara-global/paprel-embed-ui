import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { formatJournalAmount, type ReconciliationRecord } from "../headless.js";
import { getEmbedClient, getEmbedI18n } from "../context.js";
import { onEmbedLocaleChange } from "../locale-listener.js";
import sharedStyles from "@paprel/ui/styles.css?inline";

type StatusFilter = "all" | "draft" | "completed" | "voided";
const STATUS_FILTERS: StatusFilter[] = ["all", "draft", "completed", "voided"];

@customElement("paprel-reconciliation-list")
export class PaprelReconciliationList extends LitElement {
  static styles = [
    css`${unsafeCSS(sharedStyles)}`,
    css`
      .status-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        margin-bottom: 0.75rem;
      }

      .status-tabs button {
        border: 1px solid var(--paprel-color-border, #e8e8e2);
        background: var(--paprel-color-surface, #fff);
        border-radius: 999px;
        padding: 0.35rem 0.85rem;
        font-size: 0.8125rem;
        cursor: pointer;
      }

      .status-tabs button[aria-pressed="true"] {
        background: var(--paprel-color-primary-soft, #eef2ff);
        border-color: var(--paprel-color-primary, #4f46e5);
        color: var(--paprel-color-primary, #4f46e5);
        font-weight: 650;
      }

      .recon-table tbody tr {
        cursor: pointer;
      }

      .recon-table tbody tr:hover {
        background: var(--paprel-color-surface-muted, #f7f7f4);
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
    `,
  ];

  @property({ type: String, attribute: "bank-account-id" }) bankAccountId = "";
  @property({ type: String }) status: StatusFilter = "all";
  @property({ type: Number }) page = 1;
  @property({ type: Number, attribute: "page-size" }) pageSize = 25;
  @property({ type: String }) currency = "";
  @state() private loading = true;
  @state() private error = "";
  @state() private rows: ReconciliationRecord[] = [];
  @state() private totalRecords = 0;

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
    if (
      changed.has("bankAccountId") ||
      changed.has("status") ||
      changed.has("page") ||
      changed.has("pageSize")
    ) {
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
      const result = await getEmbedClient().reconciliations.list({
        account: this.bankAccountId || undefined,
        status: this.status,
        page: this.page,
        pageSize: this.pageSize,
      });
      this.rows = result.reconciliations;
      this.totalRecords = result.totalRecords ?? result.reconciliations.length;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load reconciliations";
      this.rows = [];
      this.totalRecords = 0;
    } finally {
      this.loading = false;
    }
  }

  private setStatus(next: StatusFilter): void {
    if (this.status === next) return;
    this.status = next;
    this.page = 1;
  }

  private totalPages(): number {
    if (!this.pageSize) return 1;
    return Math.max(1, Math.ceil(this.totalRecords / this.pageSize));
  }

  private goToPage(next: number): void {
    this.page = Math.min(Math.max(1, next), this.totalPages());
  }

  private open(row: ReconciliationRecord): void {
    this.dispatchEvent(
      new CustomEvent("reconciliation-select", {
        detail: { reconciliationId: row.id, reconciliation: row },
        bubbles: true,
        composed: true,
      }),
    );
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

  private filterLabel(filter: StatusFilter): string {
    const i18n = getEmbedI18n();
    if (filter === "all") return i18n.t("filterAll");
    if (filter === "completed") return i18n.t("reconCompleted");
    if (filter === "voided") return i18n.t("voided");
    return i18n.t("draft");
  }

  render() {
    const i18n = getEmbedI18n();

    return html`
      <div class="ledger-report">
        <div class="status-tabs" role="tablist">
          ${STATUS_FILTERS.map(
            (value) => html`<button
              type="button"
              role="tab"
              aria-pressed=${this.status === value ? "true" : "false"}
              @click=${() => this.setStatus(value)}
            >
              ${this.filterLabel(value)}
            </button>`,
          )}
        </div>

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

        ${this.loading ? html`<div class="state-loading">${i18n.t("loadingReconciliations")}</div>` : null}
        ${this.error ? html`<div class="ledger-error">${this.error}</div>` : null}

        ${!this.loading && !this.error
          ? html`
              <div class="ledger-toolbar">
                <span>${i18n.t("reconciliationCount", { count: this.totalRecords })}</span>
              </div>
              <div class="ledger-table-wrap">
                <table class="ledger-table recon-table">
                  <thead>
                    <tr>
                      <th>${i18n.t("period")}</th>
                      <th>${i18n.t("status")}</th>
                      <th class="numeric">${i18n.t("closingBalance")}</th>
                      <th class="numeric">${i18n.t("difference")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.rows.length
                      ? this.rows.map(
                          (row) => html`<tr @click=${() => this.open(row)}>
                            <td>${row.start_date} – ${row.end_date}</td>
                            <td><span class="status-pill ${row.status}">${this.statusLabel(row.status)}</span></td>
                            <td class="numeric">${this.amount(row.closing_balance)}</td>
                            <td class="numeric">${this.amount(row.diff)}</td>
                          </tr>`,
                        )
                      : html`<tr>
                          <td colspan="4" class="ledger-empty">${i18n.t("noReconciliations")}</td>
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
    "paprel-reconciliation-list": PaprelReconciliationList;
  }
}
