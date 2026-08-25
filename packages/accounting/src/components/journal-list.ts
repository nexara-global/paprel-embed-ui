import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { formatJournalAmount, type JournalSummary } from "../headless.js";
import { getEmbedClient, getEmbedI18n } from "../context.js";
import { onEmbedLocaleChange } from "../locale-listener.js";
import sharedStyles from "@paprel/embed-ui/styles.css?inline";
import { dispatchPaprelResourceOpen, dispatchPaprelViewChange, type PaprelViewChangeReason } from "@paprel/embed-core";

type JournalStatus = "posted" | "draft" | "voided" | "reversal";
type JournalAction = "edit" | "copy" | "reverse" | "void" | "delete";

@customElement("paprel-journal-list")
export class PaprelJournalList extends LitElement {
  static styles = [
    css`${unsafeCSS(sharedStyles)}`,
    css`
      .journal-table-wrap {
        overflow-x: auto;
        width: 100%;
      }

      .journal-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
        line-height: 1.45;
        table-layout: fixed;
      }

      .journal-table th,
      .journal-table td {
        padding: 0.8rem 0.875rem;
        border-bottom: 1px solid var(--paprel-color-border-subtle, #f0f0eb);
        text-align: left;
        vertical-align: middle;
      }

      .journal-table thead th {
        font-size: 0.6875rem;
        font-weight: 650;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--paprel-color-muted, #78786f);
        background: var(--paprel-color-surface-muted, #f7f7f4);
        border-bottom: 1px solid var(--paprel-color-border, #e8e8e2);
      }

      .journal-table .col-date {
        width: 12%;
        white-space: nowrap;
      }

      .journal-table .col-id {
        width: 16%;
        font-variant-numeric: tabular-nums;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.8125rem;
      }

      .journal-table .col-ref {
        width: 14%;
      }

      .journal-table .col-desc {
        width: 20%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .journal-table .col-status {
        width: 11%;
        text-align: center;
      }

      .journal-table .col-amount {
        width: 16%;
        text-align: right;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      .journal-table .col-actions { width: 11%; }

      .journal-table tbody tr {
        cursor: pointer;
        transition: background 0.12s ease;
      }

      .journal-table tbody tr:hover td {
        background: color-mix(in srgb, var(--paprel-color-surface-muted, #f7f7f4) 72%, white);
      }

      .journal-table tbody tr:focus-visible {
        outline: 2px solid var(--paprel-color-primary, #1c1c18);
        outline-offset: -2px;
      }

      .journal-table tbody tr.is-voided td {
        color: var(--paprel-color-muted, #78786f);
        opacity: 0.55;
        text-decoration: line-through;
        text-decoration-color: rgb(120 120 111 / 0.45);
      }

      .journal-table tbody tr.is-voided .status-pill {
        text-decoration: none;
        opacity: 1;
      }

      .journal-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin: 0 0 0.65rem;
        font-size: 0.8125rem;
        color: var(--paprel-color-muted, #78786f);
      }

      .journal-count {
        display: inline-flex;
        align-items: center;
        min-height: 1.75rem;
        padding: 0 0.65rem;
        border: 1px solid var(--paprel-color-border-subtle, #f0f0eb);
        border-radius: 999px;
        background: var(--paprel-color-surface-muted, #f7f7f4);
        font-weight: 650;
      }

      .journal-filter-bar {
        margin-bottom: 1rem;
        padding: 0.75rem;
        border: 1px solid var(--paprel-color-border-subtle, #f0f0eb);
        border-radius: var(--paprel-radius-sm, 10px);
        background: color-mix(in srgb, var(--paprel-color-surface-muted, #f7f7f4) 55%, white);
      }

      .journal-filter-bar .ledger-filters { margin: 0; }

      .journal-empty {
        padding: 1.5rem 0.75rem;
        color: var(--paprel-color-muted, #78786f);
        font-size: 0.875rem;
        border-bottom: 1px solid var(--paprel-color-border-subtle, #f0f0eb);
      }

      @media (max-width: 720px) {
        .journal-table .col-ref,
        .journal-table .col-amount,
        .journal-table .col-actions {
          display: none;
        }
        .journal-filter-bar .ledger-pagination { width: 100%; margin-left: 0; justify-content: space-between; }
      }
    `,
  ];

  @property({ type: Number, attribute: "page" }) page = 1;
  @property({ type: Number, attribute: "page-size" }) pageSize = 25;
  @property({ type: Boolean, attribute: "manual-only" }) manualOnly = false;
  @property({ type: String }) search = "";
  @property({ type: String }) status = "";
  @state() private loading = true;
  @state() private error = "";
  @state() private rows: JournalSummary[] = [];
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
      changed.has("page") ||
      changed.has("pageSize") ||
      changed.has("manualOnly") ||
      changed.has("search") ||
      changed.has("status")
    ) {
      if (changed.has("search")) this.searchDraft = this.search;
      await this.load();
    }
  }

  async refresh(): Promise<void> {
    await this.load();
  }

  private listParams() {
    const posted =
      this.status === "posted" ? true : this.status === "draft" ? false : undefined;

    return {
      page: this.page,
      pageSize: this.pageSize,
      manual: this.manualOnly ? true : undefined,
      reference: this.search.trim() || undefined,
      posted,
    };
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      const result = await getEmbedClient().journals.list(this.listParams());
      this.rows = result.journals;
      this.totalRecords = result.totalRecords ?? result.journals.length;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load journals";
    } finally {
      this.loading = false;
    }
  }

  private viewState() {
    return {
      page: this.page,
      pageSize: this.pageSize,
      manual: this.manualOnly,
      search: this.search.trim(),
      status: this.status,
    } as const;
  }

  private emitViewChange(reason: PaprelViewChangeReason): void {
    dispatchPaprelViewChange(this, {
      source: { component: this.localName },
      reason,
      state: this.viewState(),
    });
  }

  private applyFilters(reason: "filter" | "search"): void {
    this.page = 1;
    this.emitViewChange(reason);
  }

  private onReferenceInput(event: Event): void {
    this.searchDraft = (event.target as HTMLInputElement).value;
    if (this.referenceDebounce) clearTimeout(this.referenceDebounce);
    this.referenceDebounce = setTimeout(() => {
      this.search = this.searchDraft;
      this.applyFilters("search");
    }, 350);
  }

  private open(journalId: string): void {
    const useDefault = dispatchPaprelResourceOpen(this, {
      source: { component: this.localName },
      resource: "journal",
      id: journalId,
    });
    if (!useDefault) return;
    this.dispatchEvent(
      new CustomEvent("journal-select", {
        detail: { journalId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private emitAction(action: JournalAction, journalId: string, event: Event): void {
    event.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("journal-action", {
        detail: { action, journalId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private totalPages(): number {
    if (!this.pageSize) return 1;
    return Math.max(1, Math.ceil(this.totalRecords / this.pageSize));
  }

  private goToPage(next: number): void {
    const clamped = Math.min(Math.max(1, next), this.totalPages());
    if (clamped === this.page) return;
    this.page = clamped;
    this.emitViewChange("page");
  }

  private formatDate(value?: string): string {
    if (!value) return "";
    return value.slice(0, 10);
  }

  private rowAmount(row: JournalSummary): string {
    const fcy = Number(row.total_debit_fcy ?? row.total_credit_fcy ?? 0);
    const bcy = Number(row.total_debit_bcy ?? row.total_credit_bcy ?? row.total_debit ?? row.total_credit ?? 0);
    const amount = fcy || bcy;
    if (!amount) return "";
    return formatJournalAmount(amount, row.currency);
  }

  private rowStatus(row: JournalSummary): JournalStatus {
    if (row.is_voided) return "voided";
    if (row.is_reversal) return "reversal";
    if (row.posted) return "posted";
    return "draft";
  }

  private statusLabel(status: JournalStatus): string {
    const i18n = getEmbedI18n();
    switch (status) {
      case "voided":
        return i18n.t("voided");
      case "reversal":
        return i18n.t("reversal");
      case "posted":
        return i18n.t("posted");
      default:
        return i18n.t("draft");
    }
  }

  private canEdit(row: JournalSummary): boolean {
    return !row.is_voided && !Boolean(row.posted ?? row.is_posted);
  }

  private filters() {
    const i18n = getEmbedI18n();
    return html`
      <div class="ledger-filters">
        <label class="field">
          <select
            aria-label="Journal source"
            .value=${this.manualOnly ? "manual" : "all"}
            @change=${(e: Event) => {
              this.manualOnly = (e.target as HTMLSelectElement).value === "manual";
              this.applyFilters("filter");
            }}
          >
            <option value="all">${i18n.t("allJournals")}</option>
            <option value="manual">${i18n.t("manualJournals")}</option>
          </select>
        </label>
        <label class="field">
          <select
            aria-label="Journal status"
            .value=${this.status}
            @change=${(e: Event) => {
              this.status = (e.target as HTMLSelectElement).value;
              this.applyFilters("filter");
            }}
          >
            <option value="">${i18n.t("filterAll")}</option>
            <option value="posted">${i18n.t("filterPosted")}</option>
            <option value="draft">${i18n.t("filterDraft")}</option>
          </select>
        </label>
        <label class="field">
          <input
            type="search"
            aria-label=${i18n.t("reference")}
            .value=${this.searchDraft}
            placeholder=${i18n.t("reference")}
            @input=${this.onReferenceInput}
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
    `;
  }

  render() {
    const i18n = getEmbedI18n();
    return html`
      <section class="paprel-panel">
      <header class="paprel-panel-header">
        <div><h2 class="paprel-panel-title">Journals</h2><p class="paprel-panel-description">Review posted entries, drafts, references, and ledger adjustments.</p></div>
        ${!this.loading && !this.error ? html`<span class="journal-count">${i18n.t("journalCount", { count: this.totalRecords })}</span>` : null}
      </header>
      <div class="journal-filter-bar">${this.filters()}</div>
      ${this.loading ? html`<div class="state-loading">${i18n.t("loadingJournals")}</div>` : null}
      ${this.error ? html`<div class="error">${this.error}</div>` : null}
      ${!this.loading && !this.error && this.rows.length === 0 ? html`<div class="journal-empty">${i18n.t("noJournals")}</div>` : null}
      ${!this.loading && !this.error && this.rows.length ? html`
      <div class="journal-toolbar">
        <span>Entries are ordered by journal date.</span>
      </div>
      <div class="ledger-table-wrap journal-table-wrap">
        <table class="journal-table">
          <thead>
            <tr>
              <th class="col-date" scope="col">${i18n.t("date")}</th>
              <th class="col-id" scope="col">${i18n.t("identifier")}</th>
              <th class="col-ref" scope="col">${i18n.t("reference")}</th>
              <th class="col-desc" scope="col">${i18n.t("description")}</th>
              <th class="col-status" scope="col">${i18n.t("status")}</th>
              <th class="col-amount" scope="col">${i18n.t("amount")}</th>
              <th class="col-actions" scope="col">${i18n.t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            ${this.rows.map((row) => {
              const status = this.rowStatus(row);
              const editable = this.canEdit(row);
              return html`
                <tr
                  class=${row.is_voided ? "is-voided" : ""}
                  tabindex="0"
                  @click=${() => this.open(row.id)}
                  @keydown=${(event: KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") this.open(row.id); }}
                >
                  <td class="col-date">${this.formatDate(row.date)}</td>
                  <td class="col-id">${row.identifier ?? ""}</td>
                  <td class="col-ref">${row.reference ?? ""}</td>
                  <td class="col-desc" title=${row.description ?? ""}>${row.description ?? ""}</td>
                  <td class="col-status">
                    <span class="status-pill ${status}">${this.statusLabel(status)}</span>
                  </td>
                  <td class="col-amount">${this.rowAmount(row)}</td>
                  <td class="col-actions">
                    ${editable
                      ? html`<button
                            type="button"
                            class="secondary"
                            @click=${(e: Event) => this.emitAction("edit", row.id, e)}
                          >
                            ${i18n.t("edit")}
                          </button>`
                      : null}
                  </td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
      ` : null}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "paprel-journal-list": PaprelJournalList;
  }
}
