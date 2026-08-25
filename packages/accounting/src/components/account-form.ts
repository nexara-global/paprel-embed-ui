import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { AccountForm, AccountSubtype, BankingAccount } from "../headless.js";
import { PaprelApiError } from "../headless.js";
import { getEmbedClient, getEmbedI18n } from "../context.js";
import { onEmbedLocaleChange } from "../locale-listener.js";
import { hasUnmappedValidation, validationMessages, withoutValidationField } from "../lib/form-validation.js";
import sharedStyles from "@paprel/embed-ui/styles.css?inline";

@customElement("paprel-account-form")
export class PaprelAccountForm extends LitElement {
  static styles = [css`${unsafeCSS(sharedStyles)}`];

  @property({ type: String, attribute: "account-id" }) accountId = "";
  @property({ type: String, attribute: "currency" }) currency = "USD";
  @state() private loading = false;
  @state() private saving = false;
  @state() private error = "";
  @state() private fieldErrors: Record<string, string[]> = {};
  @state() private isSystemDefined = false;
  @state() private subtypes: AccountSubtype[] = [];
  @state() private form: AccountForm = {
    account: "",
    account_number: "",
    account_subtype: "",
    currency: "USD",
    description: "",
    is_archived: false,
    is_contra: false,
  };

  private offLocaleChange?: () => void;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this.offLocaleChange = onEmbedLocaleChange(() => this.requestUpdate());
    this.form = { ...this.form, currency: this.currency };
    await this.loadSubtypes();
    if (this.accountId) await this.loadExisting();
  }

  disconnectedCallback(): void {
    this.offLocaleChange?.();
    super.disconnectedCallback();
  }

  async updated(changed: Map<string, unknown>): Promise<void> {
    if (changed.has("accountId") && this.accountId) await this.loadExisting();
  }

  private async loadSubtypes(): Promise<void> {
    try {
      this.subtypes = await getEmbedClient().accounts.listSubtypes();
    } catch {
      this.subtypes = [];
    }
  }

  private async loadExisting(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      const account = await getEmbedClient().accounts.getById(this.accountId);
      this.applyAccount(account);
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load account";
    } finally {
      this.loading = false;
    }
  }

  private applyAccount(account: BankingAccount): void {
    this.isSystemDefined = Boolean(account.is_system_defined);
    this.form = {
      account: String(account.account ?? account.account_name ?? ""),
      account_number: account.account_number != null ? String(account.account_number) : "",
      account_subtype: String(account.account_subtype_id ?? account.account_subtype ?? ""),
      currency: String(account.currency ?? this.currency),
      description: account.description != null ? String(account.description) : "",
      is_archived: Boolean(account.is_archived),
      is_contra: Boolean(account.is_contra),
    };
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

  private updateForm<K extends keyof AccountForm>(field: K, value: AccountForm[K]): void {
    this.form = { ...this.form, [field]: value };
    this.clearFieldError(String(field));
  }

  private async save(): Promise<void> {
    if (this.isSystemDefined) return;

    this.saving = true;
    this.error = "";
    this.fieldErrors = {};

    try {
      const client = getEmbedClient();
      const result = this.accountId
        ? await client.accounts.update(this.accountId, this.form)
        : await client.accounts.create(this.form);
      client.refresh();
      this.dispatchEvent(
        new CustomEvent("account-saved", { detail: { account: result }, bubbles: true, composed: true }),
      );
    } catch (err) {
      if (err instanceof PaprelApiError) {
        this.fieldErrors = err.fieldErrors;
        const inlineFields = new Set(["account", "account_number", "account_subtype", "currency", "description", "is_archived", "is_contra"]);
        this.error = !Object.keys(err.fieldErrors).length || hasUnmappedValidation(err.fieldErrors, (field) => inlineFields.has(field))
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
      return html`<div class="state-loading">${i18n.t("loadingAccount")}</div>`;
    }

    const readOnly = this.isSystemDefined;

    return html`
      <div class="ledger-editor">
        <div class="ledger-editor-head">
          <h3 class="ledger-editor-title">${this.accountId ? i18n.t("editAccount") : i18n.t("newAccount")}</h3>
          <p class="ledger-editor-subtitle">Define how this account appears and behaves across the ledger.</p>
        </div>

        ${readOnly
          ? html`<div class="ledger-error">${i18n.t("systemAccountReadOnly")}</div>`
          : null}
        ${this.error ? html`<div class="ledger-error">${this.error}</div>` : null}

        <section class="ledger-form-section">
        <h4 class="ledger-form-section-title">Account details</h4>
        <div class="field-grid">
          <label class="field">${i18n.t("account")}
            <input
              aria-invalid=${this.errorsFor("account").length ? "true" : "false"}
              .value=${String(this.form.account ?? "")}
              ?readonly=${readOnly}
              @input=${(e: Event) => {
                this.updateForm("account", (e.target as HTMLInputElement).value);
              }}
            />
            ${this.fieldFeedback("account")}
          </label>
          <label class="field">${i18n.t("number")}
            <input
              aria-invalid=${this.errorsFor("account_number").length ? "true" : "false"}
              .value=${String(this.form.account_number ?? "")}
              ?readonly=${readOnly}
              @input=${(e: Event) => {
                this.updateForm("account_number", (e.target as HTMLInputElement).value);
              }}
            />
            ${this.fieldFeedback("account_number")}
          </label>
          <label class="field">${i18n.t("type")}
            <select
              aria-invalid=${this.errorsFor("account_subtype").length ? "true" : "false"}
              .value=${String(this.form.account_subtype ?? "")}
              ?disabled=${readOnly}
              @change=${(e: Event) => {
                this.updateForm("account_subtype", (e.target as HTMLSelectElement).value);
              }}
            >
              <option value="">${i18n.t("selectAccount")}</option>
              ${this.subtypes.map(
                (subtype) => html`
                  <option value=${subtype.id}>
                    ${subtype.account_type ? `${subtype.account_type} · ` : ""}${subtype.name}
                  </option>
                `,
              )}
            </select>
            ${this.fieldFeedback("account_subtype")}
          </label>
          <label class="field">${i18n.t("currency")}
            <input
              aria-invalid=${this.errorsFor("currency").length ? "true" : "false"}
              .value=${String(this.form.currency ?? this.currency)}
              ?readonly=${readOnly}
              @input=${(e: Event) => {
                this.updateForm("currency", (e.target as HTMLInputElement).value);
              }}
            />
            ${this.fieldFeedback("currency")}
          </label>
        </div>

        <label class="field">${i18n.t("description")}
          <textarea
            aria-invalid=${this.errorsFor("description").length ? "true" : "false"}
            rows="2"
            .value=${String(this.form.description ?? "")}
            ?readonly=${readOnly}
            @input=${(e: Event) => {
              this.updateForm("description", (e.target as HTMLTextAreaElement).value);
            }}
          ></textarea>
          ${this.fieldFeedback("description")}
        </label>
        </section>

        <section class="ledger-form-section">
        <h4 class="ledger-form-section-title">Account behavior</h4>
        <label class="field checkbox-inline">
          <input
            type="checkbox"
            .checked=${Boolean(this.form.is_archived)}
            ?disabled=${readOnly}
            @change=${(e: Event) => {
              this.updateForm("is_archived", (e.target as HTMLInputElement).checked);
            }}
          />
          ${i18n.t("archived")}
        </label>

        <label class="field checkbox-inline">
          <input
            type="checkbox"
            .checked=${Boolean(this.form.is_contra)}
            ?disabled=${readOnly}
            @change=${(e: Event) => {
              this.updateForm("is_contra", (e.target as HTMLInputElement).checked);
            }}
          />
          ${i18n.t("contraAccount")}
        </label>
        </section>

        <div class="ledger-form-actions">
          <button type="button" class="primary" ?disabled=${this.saving || readOnly} @click=${this.save}>
            ${this.saving ? "…" : i18n.t("saveAccount")}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "paprel-account-form": PaprelAccountForm;
  }
}
