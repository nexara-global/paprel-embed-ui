import { css, html, LitElement, nothing, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  accountPickerOptionLabel,
  filterAccountPickerGroups,
  groupAccountsForPicker,
  type BankingAccount,
} from "../headless.js";
import { getEmbedClient, getEmbedI18n } from "../context.js";
import { onEmbedLocaleChange } from "../locale-listener.js";
import sharedStyles from "@paprel/ui/styles.css?inline";

@customElement("paprel-account-select")
export class PaprelAccountSelect extends LitElement {
  static styles = [
    css`${unsafeCSS(sharedStyles)}`,
    css`
      .account-combobox {
        position: relative;
      }

      .account-combobox-list {
        position: absolute;
        z-index: 20;
        left: 0;
        right: 0;
        top: calc(100% + 0.25rem);
        max-height: 14rem;
        overflow: auto;
        margin: 0;
        padding: 0.25rem 0;
        list-style: none;
        border: 1px solid var(--paprel-color-border, #e8e8e2);
        border-radius: 0.5rem;
        background: var(--paprel-color-surface, #ffffff);
        box-shadow: 0 8px 24px rgb(28 28 24 / 0.08);
      }

      .account-combobox-group {
        padding: 0.35rem 0.75rem 0.15rem;
        font-size: 0.6875rem;
        font-weight: 650;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--paprel-color-muted, #78786f);
      }

      .account-combobox-option {
        padding: 0.45rem 0.75rem;
        cursor: pointer;
        font-size: 0.875rem;
      }

      .account-combobox-option:hover,
      .account-combobox-option.is-active {
        background: var(--paprel-color-surface-muted, #f7f7f4);
      }

      .account-combobox-empty {
        padding: 0.65rem 0.75rem;
        font-size: 0.8125rem;
        color: var(--paprel-color-muted, #78786f);
      }
    `,
  ];

  @property({ type: String }) value = "";
  @property({ type: String }) label = "Account";
  @property({ type: Boolean, reflect: true }) compact = false;
  @state() private accounts: BankingAccount[] = [];
  @state() private loading = true;
  @state() private error = "";
  @state() private query = "";
  @state() private open = false;

  private offLocaleChange?: () => void;

  private get isCompact(): boolean {
    return this.compact || this.label.trim() === "";
  }

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this.offLocaleChange = onEmbedLocaleChange(() => this.requestUpdate());
    await this.load();
    this.syncQueryFromValue();
  }

  disconnectedCallback(): void {
    this.offLocaleChange?.();
    super.disconnectedCallback();
  }

  async updated(changed: Map<string, unknown>): Promise<void> {
    if (changed.has("value") && !this.open) this.syncQueryFromValue();
  }

  async refresh(): Promise<void> {
    await this.load();
    this.syncQueryFromValue();
  }

  private syncQueryFromValue(): void {
    const i18n = getEmbedI18n();
    const account = this.accounts.find((row) => row.id === this.value);
    this.query = account ? accountPickerOptionLabel(i18n, account) : "";
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      this.accounts = await getEmbedClient().accounts.list();
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load accounts";
    } finally {
      this.loading = false;
    }
  }

  private filteredGroups() {
    const i18n = getEmbedI18n();
    const groups = groupAccountsForPicker(this.accounts, i18n);
    return filterAccountPickerGroups(groups, this.query, i18n);
  }

  private selectAccount(accountId: string, label: string): void {
    this.value = accountId;
    this.query = label;
    this.open = false;
    this.dispatchEvent(
      new CustomEvent("account-change", {
        detail: { accountId: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onInput(event: Event): void {
    this.query = (event.target as HTMLInputElement).value;
    this.open = true;
    if (!this.query.trim()) {
      this.value = "";
      this.dispatchEvent(
        new CustomEvent("account-change", {
          detail: { accountId: "" },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private onFocus(): void {
    this.open = true;
  }

  private onBlur(): void {
    window.setTimeout(() => {
      this.open = false;
      this.syncQueryFromValue();
    }, 120);
  }

  render() {
    const i18n = getEmbedI18n();
    const fieldLabel = this.label.trim();

    if (this.loading) {
      return html`<div class="state-loading">${fieldLabel ? fieldLabel : i18n.t("selectAccount")}</div>`;
    }
    if (this.error) return html`<div class="error">${this.error}</div>`;

    const groups = this.filteredGroups();
    const hasResults = groups.some((group) => group.accounts.length > 0);

    return html`
      ${fieldLabel && !this.isCompact
        ? html`<span class="field-label">${fieldLabel}</span>`
        : nothing}
      <div class="account-combobox">
        <input
          type="search"
          class=${this.isCompact ? "is-compact" : ""}
          .value=${this.query}
          placeholder=${i18n.t("searchAccounts")}
          @input=${this.onInput}
          @focus=${this.onFocus}
          @blur=${this.onBlur}
        />
        ${this.open
          ? html`<ul class="account-combobox-list" role="listbox">
              ${hasResults
                ? groups.map(
                    (group) => html`
                      <li class="account-combobox-group" role="presentation">${group.groupLabel}</li>
                      ${group.accounts.map(
                        (account) => html`
                          <li
                            role="option"
                            class="account-combobox-option ${account.id === this.value ? "is-active" : ""}"
                            @mousedown=${(e: Event) => {
                              e.preventDefault();
                              this.selectAccount(account.id, accountPickerOptionLabel(i18n, account));
                            }}
                          >
                            ${accountPickerOptionLabel(i18n, account)}
                          </li>
                        `,
                      )}
                    `,
                  )
                : html`<li class="account-combobox-empty">${i18n.t("noMatchingAccounts")}</li>`}
            </ul>`
          : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "paprel-account-select": PaprelAccountSelect;
  }
}
