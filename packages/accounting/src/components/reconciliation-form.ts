import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getEmbedClient, getEmbedI18n } from "../context.js";
import { PaprelApiError } from "../headless.js";
import { hasUnmappedValidation, validationMessages, withoutValidationField } from "../lib/form-validation.js";
import { isoDateField } from "../lib/iso-date-field.js";
import { onEmbedLocaleChange } from "../locale-listener.js";
import sharedStyles from "@paprel/embed-ui/styles.css?inline";
import { dispatchPaprelOperationSuccess } from "@paprel/embed-core";

@customElement("paprel-reconciliation-form")
export class PaprelReconciliationForm extends LitElement {
  static styles = [css`${unsafeCSS(sharedStyles)}`];

  @property({ type: String, attribute: "bank-account-id" }) bankAccountId = "";
  @property({ type: String }) currency = "";
  @state() private saving = false;
  @state() private error = "";
  @state() private success = "";
  @state() private fieldErrors: Record<string, string[]> = {};
  @state() private startDate = "";
  @state() private endDate = "";
  @state() private openingBalance = "";
  @state() private closingBalance = "";

  private offLocaleChange?: () => void;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this.offLocaleChange = onEmbedLocaleChange(() => this.requestUpdate());
  }

  disconnectedCallback(): void {
    this.offLocaleChange?.();
    super.disconnectedCallback();
  }

  private errorsFor(field: string): string[] {
    return validationMessages(this.fieldErrors, field);
  }

  private fieldFeedback(field: string) {
    const messages = this.errorsFor(field);
    return messages.length ? html`<span class="control-error" role="alert">${messages.join(" ")}</span>` : null;
  }

  private clearFieldError(field: string): void {
    this.fieldErrors = withoutValidationField(this.fieldErrors, field);
  }

  private async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.bankAccountId || this.saving) return;

    this.saving = true;
    this.error = "";
    this.success = "";
    this.fieldErrors = {};
    try {
      const record = await getEmbedClient().reconciliations.create({
        account: this.bankAccountId,
        start_date: this.startDate,
        end_date: this.endDate,
        opening_balance: this.openingBalance || undefined,
        closing_balance: this.closingBalance,
      });
      this.success = getEmbedI18n().t("reconciliationCreatedSuccess");
      dispatchPaprelOperationSuccess(this, {
        source: { component: "paprel-reconciliation-form" },
        action: "reconciliation.created",
        message: this.success,
        resource: { type: "reconciliation", id: record.id ? String(record.id) : undefined },
      });
      this.dispatchEvent(
        new CustomEvent("reconciliation-created", {
          detail: { reconciliationId: record.id, reconciliation: record },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (err) {
      if (err instanceof PaprelApiError) {
        this.fieldErrors = err.fieldErrors;
        const inlineFields = new Set(["account", "start_date", "end_date", "opening_balance", "closing_balance"]);
        this.error = !Object.keys(err.fieldErrors).length || hasUnmappedValidation(err.fieldErrors, (field) => inlineFields.has(field))
          ? err.message
          : "";
      } else {
        this.error = err instanceof Error ? err.message : "Failed to create reconciliation";
      }
    } finally {
      this.saving = false;
    }
  }

  render() {
    const i18n = getEmbedI18n();

    if (!this.bankAccountId) {
      return html`<div class="ledger-empty">${i18n.t("selectBankAccount")}</div>`;
    }

    return html`
      <form class="ledger-form" @submit=${this.submit}>
        <div class="ledger-filters">
          <label class="field">${i18n.t("dateFrom")}
            ${isoDateField(this.startDate, (value) => {
              this.startDate = value;
              this.success = "";
              this.clearFieldError("start_date");
            }, { required: true })}
            ${this.fieldFeedback("start_date")}
          </label>
          <label class="field">${i18n.t("dateTo")}
            ${isoDateField(this.endDate, (value) => {
              this.endDate = value;
              this.success = "";
              this.clearFieldError("end_date");
            }, { required: true })}
            ${this.fieldFeedback("end_date")}
          </label>
          <label class="field">${i18n.t("openingBalance")}
            <input aria-invalid=${this.errorsFor("opening_balance").length ? "true" : "false"} type="text" inputmode="decimal" .value=${this.openingBalance} @input=${(e: Event) => {
              this.openingBalance = (e.target as HTMLInputElement).value;
              this.success = "";
              this.clearFieldError("opening_balance");
            }} />
            ${this.fieldFeedback("opening_balance")}
          </label>
          <label class="field">${i18n.t("closingBalance")}
            <input aria-invalid=${this.errorsFor("closing_balance").length ? "true" : "false"} type="text" inputmode="decimal" required .value=${this.closingBalance} @input=${(e: Event) => {
              this.closingBalance = (e.target as HTMLInputElement).value;
              this.success = "";
              this.clearFieldError("closing_balance");
            }} />
            ${this.fieldFeedback("closing_balance")}
          </label>
        </div>

        ${this.error ? html`<div class="ledger-error">${this.error}</div>` : null}
        ${this.success ? html`<div class="ledger-success" role="status">${this.success}</div>` : null}

        <div class="ledger-actions">
          <button type="submit" class="primary" ?disabled=${this.saving}>
            ${i18n.t("createReconciliation")}
          </button>
        </div>
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "paprel-reconciliation-form": PaprelReconciliationForm;
  }
}
