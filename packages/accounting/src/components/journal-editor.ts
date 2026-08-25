import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { JournalForm, JournalLine } from "../headless.js";
import {
  PaprelApiError,
  computeJournalTotals,
  formatJournalAmount,
  normalizeApiLinesToForm,
  normalizeIsoDate,
  todayIsoDate,
  validateJournalFormLines,
} from "../headless.js";
import { getEmbedClient, getEmbedI18n } from "../context.js";
import { isoDateField } from "../lib/iso-date-field.js";
import { hasUnmappedValidation, validationMessages, withoutValidationField } from "../lib/form-validation.js";
import { onEmbedLocaleChange } from "../locale-listener.js";
import sharedStyles from "@paprel/embed-ui/styles.css?inline";
import { dispatchPaprelOperationSuccess } from "@paprel/embed-core";

@customElement("paprel-journal-editor")
export class PaprelJournalEditor extends LitElement {
  static styles = [
    css`${unsafeCSS(sharedStyles)}`,
    css`
      .line-table-actions {
        display: flex;
        justify-content: flex-start;
        margin-top: 0.625rem;
      }

      .line-table-actions button::before {
        content: "+";
        margin-right: 0.35rem;
        font-size: 1rem;
        line-height: 1;
      }

      .line-field {
        min-width: 0;
      }
    `,
  ];

  @property({ type: String, attribute: "journal-id" }) journalId = "";
  @property({ type: String }) mode: "create" | "edit" | "copy" | "reverse" = "create";
  @property({ type: String, attribute: "currency" }) currency = "USD";
  @state() private saving = false;
  @state() private loading = false;
  @state() private error = "";
  @state() private success = "";
  @state() private clientErrors: Record<string, string> = {};
  @state() private fieldErrors: Record<string, string[]> = {};
  @state() private versionNumber?: number;
  @state() private isPosted = false;
  @state() private form: JournalForm = {
    date: todayIsoDate(),
    currency: "USD",
    description: "",
    reference: "",
    posted: false,
    exchange_rate: "1",
    lines: [
      { account_id: "", debit: "", credit: "", description: "" },
      { account_id: "", debit: "", credit: "", description: "" },
    ],
  };

  private offLocaleChange?: () => void;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this.offLocaleChange = onEmbedLocaleChange(() => this.requestUpdate());
    this.form.currency = this.currency;
    if (this.journalId) await this.loadExisting();
  }

  disconnectedCallback(): void {
    this.offLocaleChange?.();
    super.disconnectedCallback();
  }

  async updated(changed: Map<string, unknown>): Promise<void> {
    if ((changed.has("journalId") || changed.has("mode")) && this.journalId) await this.loadExisting();
    if (changed.has("currency") && !this.journalId && this.mode === "create") {
      this.form = { ...this.form, currency: this.currency };
    }
  }

  private effectiveMode(): "create" | "edit" | "copy" | "reverse" {
    if (!this.journalId) return "create";
    return this.mode === "edit" ? "edit" : this.mode;
  }

  private async loadExisting(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      const detail = await getEmbedClient().journals.getById(this.journalId);
      const mode = this.effectiveMode();
      let lines = normalizeApiLinesToForm(detail.lines);

      if (mode === "reverse") {
        lines = lines.map((line) => ({
          ...line,
          debit: line.credit != null ? String(line.credit) : "",
          credit: line.debit != null ? String(line.debit) : "",
        }));
      }

      if (mode === "edit") {
        this.versionNumber = detail.version_number;
        this.isPosted = Boolean(detail.posted ?? detail.is_posted);
      } else {
        this.versionNumber = undefined;
        this.isPosted = false;
      }

      this.form = {
        date: normalizeIsoDate(detail.date) || this.form.date,
        currency: detail.currency ?? this.currency,
        description: detail.description ?? "",
        reference: mode === "copy" || mode === "reverse" ? "" : (detail.reference ?? ""),
        posted: mode === "edit" ? this.isPosted : false,
        exchange_rate: detail.exchange_rate != null ? String(detail.exchange_rate) : "1",
        lines,
      };
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load journal";
    } finally {
      this.loading = false;
    }
  }

  private validationMessage(code: string): string {
    const i18n = getEmbedI18n();
    switch (code) {
      case "INVALID_JOURNAL_ENTRY":
        return i18n.t("validationInvalidJournalEntry");
      case "DEBIT_CREDIT_MISMATCH":
        return i18n.t("validationDebitCreditMismatch");
      case "BOTH_DEBIT_CREDIT_SET":
        return i18n.t("validationBothDebitCredit");
      default:
        return code.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()) + ".";
    }
  }

  private errorsFor(field: string): string[] {
    return validationMessages(this.fieldErrors, field).map((message, index) => {
      const code = this.fieldErrors[field]?.[index];
      return code?.startsWith("INVALID_JOURNAL") || code?.startsWith("DEBIT_CREDIT") || code === "BOTH_DEBIT_CREDIT_SET"
        ? this.validationMessage(code)
        : message;
    });
  }

  private isInlineField(field: string): boolean {
    return ["date", "reference", "currency", "description", "exchange_rate"].includes(field)
      || /^lines_\d+_(description|account_id|debit|credit)$/.test(field);
  }

  private clearFieldError(field: string): void {
    if (!this.fieldErrors[field]) return;
    const remaining = withoutValidationField(this.fieldErrors, field);
    this.fieldErrors = remaining;
    if (!Object.keys(remaining).length && this.error === "Request failed") this.error = "";
  }

  private fieldFeedback(field: string) {
    const messages = this.errorsFor(field);
    return messages.length
      ? html`<span class="control-error" role="alert">${messages.join(" ")}</span>`
      : null;
  }

  private updateLine(index: number, patch: Partial<JournalLine>): void {
    const lines = [...this.form.lines];
    lines[index] = { ...lines[index], ...patch };
    this.form = { ...this.form, lines };
    this.success = "";
    for (const field of Object.keys(patch)) this.clearFieldError(`lines_${index}_${field}`);
  }

  private setDebit(index: number, value: string): void {
    this.updateLine(index, { debit: value, credit: value.trim() ? "" : "" });
  }

  private setCredit(index: number, value: string): void {
    this.updateLine(index, { credit: value, debit: value.trim() ? "" : "" });
  }

  private addLine(): void {
    this.form = {
      ...this.form,
      lines: [...this.form.lines, { account_id: "", debit: "", credit: "", description: "" }],
    };
  }

  private removeLine(index: number): void {
    if (this.form.lines.length <= 2) return;
    const lines = this.form.lines.filter((_, i) => i !== index);
    this.form = { ...this.form, lines };
  }

  private totals() {
    return computeJournalTotals(this.form.lines);
  }

  private async save(): Promise<void> {
    this.saving = true;
    this.error = "";
    this.success = "";
    this.clientErrors = {};
    this.fieldErrors = {};

    const validation = validateJournalFormLines(this.form.lines);
    if (Object.keys(validation).length) {
      this.clientErrors = validation;
      this.saving = false;
      return;
    }

    try {
      const client = getEmbedClient();
      const payload: JournalForm = {
        ...this.form,
        ...(this.versionNumber != null ? { version_number: this.versionNumber } : {}),
      };
      const result = this.effectiveMode() === "edit" && this.journalId
        ? await client.journals.update(this.journalId, payload)
        : await client.journals.create(payload);
      this.success = this.effectiveMode() === "edit" ? "Journal updated successfully." : "Journal created successfully.";
      dispatchPaprelOperationSuccess(this, {
        source: { component: "paprel-journal-editor" },
        action: this.effectiveMode() === "edit" ? "journal.updated" : "journal.created",
        message: this.success,
        resource: { type: "journal", id: result.id ? String(result.id) : undefined },
      });
      this.dispatchEvent(
        new CustomEvent("journal-saved", { detail: { journal: result }, bubbles: true, composed: true }),
      );
    } catch (err) {
      if (err instanceof PaprelApiError) {
        this.fieldErrors = err.fieldErrors;
        this.error = !Object.keys(err.fieldErrors).length || hasUnmappedValidation(err.fieldErrors, (field) => this.isInlineField(field))
          ? err.message
          : "";
      } else {
        this.error = err instanceof Error ? err.message : "Save failed";
      }
    } finally {
      this.saving = false;
    }
  }

  render() {
    const i18n = getEmbedI18n();
    if (this.loading) {
      return html`<div class="state-loading">${i18n.t("loadingJournal")}</div>`;
    }

    const { debit, credit } = this.totals();
    const diff = Math.abs(debit - credit);
    const balanced = diff <= 0.00001;
    const showFx = String(this.form.exchange_rate ?? "1") !== "1";

    return html`
      <div class="ledger-editor">
        <div class="ledger-editor-head">
          <h3 class="ledger-editor-title">${i18n.t("saveJournal")}</h3>
          ${this.isPosted
            ? html`<span class="status-pill posted">${i18n.t("posted")}</span>`
            : html`<span class="status-pill draft">${i18n.t("draft")}</span>`}
        </div>

        ${this.error ? html`<div class="ledger-error">${this.error}</div>` : null}
        ${this.success ? html`<div class="ledger-success" role="status">${this.success}</div>` : null}
        ${Object.keys(this.clientErrors).length
          ? html`<div class="ledger-field-errors">
              ${Object.values(this.clientErrors).map((code) => html`<div>${this.validationMessage(code)}</div>`)}
            </div>`
          : null}

        <div class="field-grid">
          <label class="field">${i18n.t("date")}
            ${isoDateField(this.form.date, (value) => {
              this.form = { ...this.form, date: value };
              this.clearFieldError("date");
            })}
            ${this.fieldFeedback("date")}
          </label>
          <label class="field">${i18n.t("reference")}
            <input aria-invalid=${this.errorsFor("reference").length ? "true" : "false"} .value=${this.form.reference ?? ""} @input=${(e: Event) => {
              this.form = { ...this.form, reference: (e.target as HTMLInputElement).value };
              this.clearFieldError("reference");
            }} />
            ${this.fieldFeedback("reference")}
          </label>
          <label class="field">${i18n.t("currency")}
            <input aria-invalid=${this.errorsFor("currency").length ? "true" : "false"} .value=${this.form.currency} @input=${(e: Event) => {
              this.form = { ...this.form, currency: (e.target as HTMLInputElement).value };
              this.clearFieldError("currency");
            }} />
            ${this.fieldFeedback("currency")}
          </label>
          ${showFx
            ? html`<label class="field">${i18n.t("exchangeRate")}
                <input .value=${String(this.form.exchange_rate ?? "1")} @input=${(e: Event) => {
                  this.form = { ...this.form, exchange_rate: (e.target as HTMLInputElement).value };
                }} />
              </label>`
            : null}
        </div>

        <label class="field">${i18n.t("description")}
          <textarea aria-invalid=${this.errorsFor("description").length ? "true" : "false"} rows="2" .value=${this.form.description ?? ""} @input=${(e: Event) => {
            this.form = { ...this.form, description: (e.target as HTMLTextAreaElement).value };
            this.clearFieldError("description");
          }}></textarea>
          ${this.fieldFeedback("description")}
        </label>

        ${!this.isPosted
          ? html`<label class="field checkbox-inline">
              <input
                type="checkbox"
                .checked=${Boolean(this.form.posted)}
                @change=${(e: Event) => {
                  this.form = { ...this.form, posted: (e.target as HTMLInputElement).checked };
                }}
              />
              ${i18n.t("postOnSave")}
            </label>`
          : null}

        <div class="ledger-table-wrap" style="margin-top:1rem">
          <table class="ledger-table">
            <thead>
              <tr>
                <th>${i18n.t("description")}</th>
                <th>${i18n.t("account")}</th>
                <th class="numeric">${i18n.t("debit")}</th>
                <th class="numeric">${i18n.t("credit")}</th>
                <th class="line-actions"></th>
              </tr>
            </thead>
            <tbody>
              ${this.form.lines.map((line, index) => {
                const hasDebit = Boolean(String(line.debit ?? "").trim());
                const hasCredit = Boolean(String(line.credit ?? "").trim());
                return html`<tr>
                  <td class="line-field">
                    <input
                      aria-invalid=${this.errorsFor(`lines_${index}_description`).length ? "true" : "false"}
                      .value=${line.description ?? ""}
                      @input=${(e: Event) =>
                        this.updateLine(index, { description: (e.target as HTMLInputElement).value })}
                    />
                    ${this.fieldFeedback(`lines_${index}_description`)}
                  </td>
                  <td class="line-field">
                    <div class=${this.errorsFor(`lines_${index}_account_id`).length ? "account-select-invalid" : ""}>
                      <paprel-account-select
                      label=""
                      .value=${line.account_id}
                      @account-change=${(e: CustomEvent<{ accountId: string }>) =>
                        this.updateLine(index, { account_id: e.detail.accountId })}
                      ></paprel-account-select>
                    </div>
                    ${this.fieldFeedback(`lines_${index}_account_id`)}
                  </td>
                  <td class="numeric">
                    <input
                      aria-invalid=${this.errorsFor(`lines_${index}_debit`).length ? "true" : "false"}
                      .value=${String(line.debit ?? "")}
                      ?readonly=${hasCredit}
                      @input=${(e: Event) => this.setDebit(index, (e.target as HTMLInputElement).value)}
                    />
                    ${this.fieldFeedback(`lines_${index}_debit`)}
                  </td>
                  <td class="numeric">
                    <input
                      aria-invalid=${this.errorsFor(`lines_${index}_credit`).length ? "true" : "false"}
                      .value=${String(line.credit ?? "")}
                      ?readonly=${hasDebit}
                      @input=${(e: Event) => this.setCredit(index, (e.target as HTMLInputElement).value)}
                    />
                    ${this.fieldFeedback(`lines_${index}_credit`)}
                  </td>
                  <td class="line-actions">
                    <button
                      type="button"
                      class="btn-icon"
                      title=${i18n.t("removeLine")}
                      ?disabled=${this.form.lines.length <= 2}
                      @click=${() => this.removeLine(index)}
                    >
                      ×
                    </button>
                  </td>
                </tr>`;
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2">${i18n.t("total")}</td>
                <td class="numeric">${formatJournalAmount(debit, this.form.currency)}</td>
                <td class="numeric">${formatJournalAmount(credit, this.form.currency)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="line-table-actions">
          <button type="button" class="secondary" ?disabled=${this.isPosted} @click=${this.addLine}>
            ${i18n.t("addLine")}
          </button>
        </div>

        <div class=${balanced ? "balance-ok ledger-balance" : "balance-bad ledger-balance"}>
          ${balanced
            ? i18n.t("balanced")
            : `${i18n.t("difference")}: ${formatJournalAmount(diff, this.form.currency)}`}
        </div>

        <div class="ledger-form-actions">
          <button type="button" class="primary" ?disabled=${this.saving || this.isPosted} @click=${this.save}>
            ${this.saving ? "…" : i18n.t("saveJournal")}
          </button>
        </div>

      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "paprel-journal-editor": PaprelJournalEditor;
  }
}
