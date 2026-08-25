import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { accountI18nKey, accountPickerMetaLabel, formatJournalAmount, type BankingAccount } from "../headless.js";
import { getEmbedClient, getEmbedI18n } from "../context.js";
import "./bank-account-detail.js";
import sharedStyles from "@paprel/embed-ui/styles.css?inline";

@customElement("paprel-account-detail")
export class PaprelAccountDetail extends LitElement {
  static styles = [
    css`${unsafeCSS(sharedStyles)}`,
    css`
      .account-page { display: grid; gap: 1rem; }
      .account-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
      .account-heading-copy { min-width: 0; }
      .account-kicker { margin: 0 0 .3rem; color: var(--paprel-color-muted); font-size: .6875rem; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
      .account-title { margin: 0; overflow: hidden; color: var(--paprel-color-text); font-size: clamp(1.35rem, 3vw, 1.75rem); font-weight: 680; letter-spacing: -.035em; text-overflow: ellipsis; white-space: nowrap; }
      .account-context { margin: .3rem 0 0; color: var(--paprel-color-muted); font-size: .875rem; }
      .account-heading-actions { display: flex; align-items: center; gap: .5rem; }
      .overview-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(18rem, .85fr); gap: 1rem; align-items: stretch; }
      .balance-card { position: relative; overflow: hidden; min-height: 18rem; padding: clamp(1.25rem, 4vw, 2rem); border: 1px solid var(--paprel-color-border); border-radius: var(--paprel-radius); background: var(--paprel-color-surface); box-shadow: var(--paprel-shadow-sm); }
      .balance-card::after { position: absolute; right: -5rem; bottom: -7rem; width: 15rem; height: 15rem; border-radius: 50%; background: color-mix(in srgb, var(--paprel-color-primary) 7%, transparent); content: ""; pointer-events: none; }
      .balance-label-row { display: flex; align-items: center; gap: .5rem; }
      .currency-badge { display: inline-flex; align-items: center; min-height: 1.6rem; padding: 0 .55rem; border: 1px solid var(--paprel-color-border-subtle); border-radius: 999px; background: var(--paprel-color-surface-muted); color: var(--paprel-color-text); font-size: .6875rem; font-weight: 700; }
      .balance-value { position: relative; z-index: 1; margin-top: 1rem; font-size: clamp(2.25rem, 6vw, 4rem); font-weight: 680; font-variant-numeric: tabular-nums; letter-spacing: -.055em; line-height: 1; }
      .balance-value.is-negative { color: var(--paprel-color-danger, #dc2626); }
      .balance-note { max-width: 34rem; margin: 1.75rem 0 0; padding: .8rem .9rem; border: 1px solid var(--paprel-color-border-subtle); border-radius: var(--paprel-radius-sm); background: var(--paprel-color-surface-muted); color: var(--paprel-color-muted); font-size: .75rem; line-height: 1.5; }
      .detail-card, .health-card { overflow: hidden; border: 1px solid var(--paprel-color-border); border-radius: var(--paprel-radius); background: var(--paprel-color-surface); box-shadow: var(--paprel-shadow-sm); }
      .section-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.1rem; border-bottom: 1px solid var(--paprel-color-border-subtle); background: var(--paprel-color-surface-muted); }
      .section-head h3 { margin: 0; font-size: .9375rem; font-weight: 680; letter-spacing: -.015em; }
      .section-mark { display: grid; width: 2rem; height: 2rem; place-items: center; border: 1px solid var(--paprel-color-border-subtle); border-radius: var(--paprel-radius-sm); background: var(--paprel-color-surface); color: var(--paprel-color-primary); font-size: .75rem; font-weight: 750; }
      .detail-list { margin: 0; }
      .detail-row { display: grid; grid-template-columns: minmax(7rem, .7fr) minmax(0, 1fr); gap: 1rem; padding: .78rem 1.1rem; border-bottom: 1px solid var(--paprel-color-border-subtle); }
      .detail-row:last-child { border-bottom: 0; }
      .detail-row dt { color: var(--paprel-color-muted); font-size: .6875rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
      .detail-row dd { min-width: 0; margin: 0; overflow-wrap: anywhere; text-align: right; color: var(--paprel-color-text); font-size: .8125rem; font-weight: 620; font-variant-numeric: tabular-nums; }
      .health-card { padding: 1.1rem; }
      .health-title { margin: 0 0 .85rem; color: var(--paprel-color-muted); font-size: .6875rem; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
      .health-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .65rem; }
      .health-item { padding: .8rem .9rem; border: 1px solid var(--paprel-color-border-subtle); border-radius: var(--paprel-radius-sm); background: var(--paprel-color-surface-muted); }
      .health-item span { display: block; color: var(--paprel-color-muted); font-size: .6875rem; }
      .health-item strong { display: block; margin-top: .25rem; font-size: .8125rem; }
      .state-active { color: var(--paprel-color-success, #059669); }
      @media (max-width: 760px) { .overview-grid { grid-template-columns: 1fr; } .balance-card { min-height: 15rem; } .health-grid { grid-template-columns: 1fr; } }
      @media (max-width: 480px) { .account-heading { flex-direction: column; } .account-heading-actions { width: 100%; justify-content: space-between; } .detail-row { grid-template-columns: 1fr; gap: .25rem; } .detail-row dd { text-align: left; } }
    `,
  ];

  @property({ type: String, attribute: "account-id" }) accountId = "";
  @property({ type: Boolean, attribute: "show-actions" }) showActions = true;
  @state() private loading = true;
  @state() private error = "";
  @state() private account: BankingAccount | null = null;
  @state() private isOperationalBankAccount = false;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    if (this.accountId) await this.load();
  }

  async updated(changed: Map<string, unknown>): Promise<void> {
    if (changed.has("accountId") && this.accountId) await this.load();
  }

  async refresh(): Promise<void> { await this.load(); }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      const client = getEmbedClient();
      const [account, banking] = await Promise.all([
        client.accounts.getById(this.accountId),
        client.banking.listBankAccounts().catch(() => ({ accounts: [] })),
      ]);
      this.account = account;
      this.isOperationalBankAccount = banking.accounts.some((candidate) => candidate.id === this.accountId);
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Failed to load account";
      this.account = null;
      this.isOperationalBankAccount = false;
    } finally {
      this.loading = false;
    }
  }

  private edit(): void {
    this.dispatchEvent(new CustomEvent("account-action", {
      detail: { action: "edit", accountId: this.accountId, account: this.account },
      bubbles: true,
      composed: true,
    }));
  }

  private accountBalance(account: BankingAccount): number | null {
    const stats = account.stats as { account_balance?: Array<{ available_balance?: string | number | null }> } | undefined;
    const raw = account.balance ?? account.available_balance ?? stats?.account_balance?.[0]?.available_balance;
    if (raw == null || raw === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  render() {
    const i18n = getEmbedI18n();
    if (this.loading) return html`<div class="state-loading">Loading account…</div>`;
    if (this.error) return html`<div class="error">${this.error}</div>`;
    if (!this.account) return null;
    if (this.isOperationalBankAccount) {
      return html`<paprel-bank-account-detail account-id=${this.accountId}></paprel-bank-account-detail>`;
    }
    const account = this.account;
    const name = i18n.accountLabel(accountI18nKey(account));
    const currency = String(account.currency || "—");
    const balance = this.accountBalance(account);
    const type = accountPickerMetaLabel(i18n, account) || String(account.account_type || "Ledger account");
    const description = String(account.description || "No description provided.");
    return html`
      <div class="account-page">
        <header class="account-heading">
          <div class="account-heading-copy">
            <p class="account-kicker">Account overview</p>
            <h2 class="account-title">${name}</h2>
            <p class="account-context">${type}</p>
          </div>
          <div class="account-heading-actions">
            <span class="status-pill ${account.is_archived ? "" : "posted"}">${account.is_archived ? "Archived" : "Active"}</span>
            ${this.showActions && !account.is_system_defined ? html`<button class="secondary" @click=${this.edit}>Edit account</button>` : null}
          </div>
        </header>

        <div class="overview-grid">
          <section class="balance-card">
            <div class="balance-label-row"><span class="meta-label">Ledger balance</span><span class="currency-badge">${currency}</span></div>
            <div class="balance-value ${balance != null && balance < 0 ? "is-negative" : ""}">${balance == null ? "—" : formatJournalAmount(balance, String(account.currency || ""))}</div>
            <p class="balance-note">This balance reflects posted ledger activity for the account. Draft and unposted entries are not included.</p>
          </section>

          <section class="detail-card">
            <header class="section-head"><div><span class="meta-label">Account details</span><h3>${String(account.kind || account.account_type || "Ledger account")}</h3></div><span class="section-mark">A</span></header>
            <dl class="detail-list">
              <div class="detail-row"><dt>Account name</dt><dd>${name}</dd></div>
              <div class="detail-row"><dt>Account number</dt><dd>${account.account_number || "—"}</dd></div>
              <div class="detail-row"><dt>Currency</dt><dd>${currency}</dd></div>
              <div class="detail-row"><dt>Classification</dt><dd>${type}</dd></div>
              <div class="detail-row"><dt>Description</dt><dd>${description}</dd></div>
              <div class="detail-row"><dt>Account ID</dt><dd>${account.id}</dd></div>
            </dl>
          </section>
        </div>

        <section class="health-card">
          <h3 class="health-title">Account health</h3>
          <div class="health-grid">
            <div class="health-item"><span>State</span><strong class=${account.is_archived ? "" : "state-active"}>${account.is_archived ? "Archived" : "Active"}</strong></div>
            <div class="health-item"><span>Control</span><strong>${account.is_system_defined ? "System · read only" : "Custom account"}</strong></div>
            <div class="health-item"><span>Balance behavior</span><strong>${account.is_contra ? "Contra account" : "Standard account"}</strong></div>
          </div>
        </section>
      </div>`;
  }
}

declare global { interface HTMLElementTagNameMap { "paprel-account-detail": PaprelAccountDetail; } }
