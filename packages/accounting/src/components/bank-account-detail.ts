import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  accountI18nKey,
  formatJournalAmount,
  type BankAccountDetail,
  type TransactionInbox,
} from "../headless.js";
import { getEmbedClient, getEmbedI18n } from "../context.js";
import { onEmbedLocaleChange } from "../locale-listener.js";
import "./transaction-inbox.js";
import "./transaction-detail.js";
import "./transaction-match-sheet.js";
import "./reconciliation-list.js";
import "./reconciliation-detail.js";
import "./reconciliation-form.js";
import sharedStyles from "@paprel/embed-ui/styles.css?inline";

@customElement("paprel-bank-account-detail")
export class PaprelBankAccountDetail extends LitElement {
  static styles = [
    css`${unsafeCSS(sharedStyles)}`,
    css`
      .bank-hub-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:.85rem; }

      .bank-hub-header h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 650;
      }

      .bank-hub-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem 1rem;
        color: var(--paprel-color-muted, #78786f);
        font-size: 0.875rem;
      }
      .bank-title-row { display:flex; align-items:center; gap:.55rem; }

      .overview-content { display:grid; gap:1rem; }
      .overview-grid { display:grid; grid-template-columns:minmax(0,1.15fr) minmax(18rem,.85fr); gap:1rem; }
      .overview-card { overflow:hidden; border:1px solid var(--paprel-color-border,#e8e8e2); border-radius:var(--paprel-radius,10px); background:var(--paprel-color-surface,#fff); }
      .overview-card-head { padding:.85rem 1rem; border-bottom:1px solid var(--paprel-color-border-subtle,#efefe9); background:var(--paprel-color-surface-muted,#f7f7f4); }
      .overview-card-head span { display:block; color:var(--paprel-color-muted,#78786f); font-size:.68rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
      .overview-card-head strong { display:block; margin-top:.2rem; font-size:.95rem; }
      .overview-balance { min-height:12rem; padding:1.25rem; }
      .overview-balance span { color:var(--paprel-color-muted,#78786f); font-size:.7rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
      .overview-balance strong { display:block; margin-top:.6rem; font-size:clamp(2rem,5vw,3.25rem); font-variant-numeric:tabular-nums; letter-spacing:-.045em; }
      .overview-balance p { max-width:32rem; margin:1.4rem 0 0; padding:.7rem .8rem; border-radius:var(--paprel-radius-sm,7px); background:var(--paprel-color-surface-muted,#f7f7f4); color:var(--paprel-color-muted,#78786f); font-size:.75rem; }
      .overview-details { margin:0; }
      .overview-detail { display:grid; grid-template-columns:minmax(7rem,.7fr) minmax(0,1fr); gap:1rem; padding:.7rem 1rem; border-bottom:1px solid var(--paprel-color-border-subtle,#efefe9); }
      .overview-detail:last-child { border-bottom:0; }
      .overview-detail dt { color:var(--paprel-color-muted,#78786f); font-size:.68rem; font-weight:700; letter-spacing:.05em; text-transform:uppercase; }
      .overview-detail dd { margin:0; overflow-wrap:anywhere; text-align:right; font-size:.8rem; font-weight:620; }
      .overview-health { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.65rem; padding:1rem; }
      .overview-health div { padding:.75rem .85rem; border-radius:var(--paprel-radius-sm,7px); background:var(--paprel-color-surface-muted,#f7f7f4); }
      .overview-health span { display:block; color:var(--paprel-color-muted,#78786f); font-size:.68rem; }
      .overview-health strong { display:block; margin-top:.2rem; font-size:.8rem; }

      .account-tabs { display:flex; gap:0; margin:0 -1.5rem 1rem; padding:0 1.5rem; overflow-x:auto; border-top:1px solid var(--paprel-color-border-subtle,#efefe9); border-bottom:1px solid var(--paprel-color-border-subtle,#efefe9); background:var(--paprel-color-surface-muted,#f7f7f4); }
      .account-tabs button { position:relative; min-height:38px; border:0; border-radius:0; background:transparent; color:var(--paprel-color-muted,#78786f); padding:0 .85rem; white-space:nowrap; cursor:pointer; font-size:.72rem; font-weight:680; letter-spacing:.025em; text-transform:uppercase; }
      .account-tabs button:hover { color:var(--paprel-color-text,#1c1c18); }
      .account-tabs button[aria-selected="true"] { color:var(--paprel-color-primary,#4f46e5); background:var(--paprel-color-surface,#fff); }
      .account-tabs button[aria-selected="true"]::after { position:absolute; right:.7rem; bottom:-1px; left:.7rem; height:2px; border-radius:2px 2px 0 0; background:var(--paprel-color-primary,#4f46e5); content:""; }
      .tab-count { display:inline-grid; min-width:1.2rem; height:1.2rem; margin-left:.35rem; place-items:center; border-radius:999px; background:var(--paprel-color-border,#e5e5df); color:var(--paprel-color-text,#1c1c18); font-size:.62rem; }
      .account-tabs button[aria-selected="true"] .tab-count { background:var(--paprel-color-primary,#4f46e5); color:var(--paprel-color-primary-text,#fff); }
      .reconciliation-head { display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:.75rem; }
      .reconciliation-head h3 { margin:0; font-size:1rem; }
      .transaction-workbench { display:grid; gap:1rem; }
      .transaction-workbench-head { display:flex; justify-content:space-between; align-items:center; gap:1rem; }
      .transaction-workbench-head h3 { margin:0; font-size:1rem; }
      .matching-layout { display:grid; grid-template-columns:minmax(18rem,.8fr) minmax(22rem,1.2fr); gap:1rem; align-items:start; }
      .matching-panel { padding:1rem; border:1px solid var(--paprel-color-border,#e8e8e2); border-radius:var(--paprel-radius,10px); background:var(--paprel-color-surface,#fff); }
      .matching-panel h4 { margin:0 0 .75rem; font-size:.875rem; }
      @media(max-width:850px) { .matching-layout,.overview-grid { grid-template-columns:1fr; } }
      @media(max-width:600px) { .overview-health { grid-template-columns:1fr; } .overview-detail { grid-template-columns:1fr; gap:.2rem; } .overview-detail dd { text-align:left; } }
    `,
  ];

  @property({ type: String, attribute: "account-id" }) accountId = "";
  @property({ type: String }) inbox: TransactionInbox = "uncategorized";
  @state() private loading = true;
  @state() private error = "";
  @state() private account: BankAccountDetail | null = null;
  @state() private activeSection: "overview" | TransactionInbox | "reconciliation" = "uncategorized";
  @state() private reconciliationMode: "list" | "create" | "detail" = "list";
  @state() private selectedReconciliationId = "";
  @state() private selectedTransactionId = "";

  private offLocaleChange?: () => void;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this.offLocaleChange = onEmbedLocaleChange(() => this.requestUpdate());
    if (this.accountId) await this.load();
  }

  disconnectedCallback(): void {
    this.offLocaleChange?.();
    super.disconnectedCallback();
  }

  async updated(changed: Map<string, unknown>): Promise<void> {
    if (changed.has("accountId") && this.accountId) await this.load();
  }

  async refresh(): Promise<void> {
    await this.load();
    const inbox = this.renderRoot.querySelector("paprel-transaction-inbox") as
      | { refresh?: () => Promise<void> }
      | null;
    await inbox?.refresh?.();
  }

  private async load(): Promise<void> {
    if (!this.accountId) return;
    this.loading = true;
    this.error = "";
    try {
      this.account = await getEmbedClient().banking.getBankAccount(this.accountId);
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load bank account";
      this.account = null;
    } finally {
      this.loading = false;
    }
  }

  private accountTitle(): string {
    const i18n = getEmbedI18n();
    if (!this.account) return "";
    const key = this.account.name ?? this.account.account_name ?? this.account.account ?? "";
    return i18n.accountLabel(accountI18nKey(String(key)));
  }

  private balance(): string {
    const entry = this.account?.stats?.account_balance?.[0];
    const account = this.account as (BankAccountDetail & { balance?: string | number | null; available_balance?: string | number | null }) | null;
    const raw = entry?.available_balance ?? account?.available_balance ?? account?.balance;
    if (raw == null || raw === "") return "—";
    const num = Number(raw);
    if (!Number.isFinite(num)) return "—";
    const currency = entry?.currency ?? this.account?.currency ?? undefined;
    return formatJournalAmount(num, currency ?? undefined);
  }

  private forwardTransactionSelect(event: Event): void {
    event.stopPropagation();
    this.selectedTransactionId = String((event as CustomEvent<{ transactionId: string }>).detail.transactionId);
    this.dispatchEvent(
      new CustomEvent("transaction-select", {
        detail: (event as CustomEvent).detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async closeTransaction(refresh = false): Promise<void> {
    this.selectedTransactionId = "";
    if (refresh) await this.refresh();
  }

  private selectSection(section: "overview" | TransactionInbox | "reconciliation"): void {
    this.activeSection = section;
    this.selectedTransactionId = "";
    if (section === "reconciliation") this.reconciliationMode = "list";
  }

  private isBankOrCreditCard(): boolean {
    const kind = String(this.account?.account_kind ?? this.account?.kind ?? "").toLowerCase();
    return kind === "bank" || kind === "cc" || kind === "credit_card" || kind === "credit card";
  }

  private openReconciliation(event: Event): void {
    this.selectedReconciliationId = String((event as CustomEvent<{ reconciliationId: string }>).detail.reconciliationId);
    this.reconciliationMode = "detail";
  }

  private renderOverview() {
    if (!this.account) return null;
    const account = this.account;
    return html`<div class="overview-content">
      <div class="overview-grid">
        <section class="overview-card overview-balance"><span>Ledger balance · ${account.currency || "—"}</span><strong>${this.balance()}</strong><p>Reflects posted ledger activity. Draft and unposted entries are not included.</p></section>
        <section class="overview-card"><header class="overview-card-head"><span>Account details</span><strong>${account.account_type || account.account_kind || "Bank account"}</strong></header><dl class="overview-details">
          <div class="overview-detail"><dt>Account name</dt><dd>${this.accountTitle()}</dd></div>
          <div class="overview-detail"><dt>Account number</dt><dd>${account.account_number || "—"}</dd></div>
          <div class="overview-detail"><dt>Currency</dt><dd>${account.currency || "—"}</dd></div>
          <div class="overview-detail"><dt>Classification</dt><dd>${account.account_subtype || account.account_type || "—"}</dd></div>
          <div class="overview-detail"><dt>Description</dt><dd>${account.description || "No description provided."}</dd></div>
          <div class="overview-detail"><dt>Account ID</dt><dd>${account.id}</dd></div>
        </dl></section>
      </div>
      <section class="overview-card"><header class="overview-card-head"><span>Account health</span><strong>Operational status</strong></header><div class="overview-health">
        <div><span>State</span><strong>${account.is_archived ? "Archived" : "Active"}</strong></div>
        <div><span>Account type</span><strong>${account.account_kind === "cc" ? "Credit card" : "Bank account"}</strong></div>
        <div><span>Reconciliation</span><strong>${account.unreconciled_count ? "Needs attention" : "Up to date"}</strong></div>
      </div></section>
    </div>`;
  }

  render() {
    const i18n = getEmbedI18n();

    if (!this.accountId) {
      return html`<div class="ledger-empty">${i18n.t("selectBankAccount")}</div>`;
    }

    if (this.loading) {
      return html`<div class="state-loading">${i18n.t("loadingBankAccount")}</div>`;
    }

    if (this.error) {
      return html`<div class="ledger-error">${this.error}</div>`;
    }

    if (!this.account) {
      return html`<div class="ledger-empty">${i18n.t("bankAccountNotFound")}</div>`;
    }

    return html`
      <div class="bank-hub">
        <header class="bank-hub-header">
          <div><div class="bank-title-row"><h2>${this.accountTitle()}</h2><span class="status-pill ${this.account.is_archived ? "" : "posted"}">${this.account.is_archived ? "Archived" : "Active"}</span></div>
          <div class="bank-hub-meta">
            ${this.account.account_kind
              ? html`<span>${i18n.t("type")}: ${this.account.account_kind}</span>`
              : null}
            ${this.account.account_number
              ? html`<span>${i18n.t("number")}: ${this.account.account_number}</span>`
              : null}
            ${this.account.currency ? html`<span>${this.account.currency}</span>` : null}
          </div></div>
        </header>

        ${this.isBankOrCreditCard() ? html`<nav class="account-tabs" aria-label="Bank account activity">
          <button aria-selected=${this.activeSection === "overview"} @click=${() => this.selectSection("overview")}>Overview</button>
          <button aria-selected=${this.activeSection === "uncategorized"} @click=${() => this.selectSection("uncategorized")}>Uncategorized <span class="tab-count">${this.account.uncategorized_count ?? 0}</span></button>
          <button aria-selected=${this.activeSection === "categorized"} @click=${() => this.selectSection("categorized")}>Categorized</button>
          <button aria-selected=${this.activeSection === "excluded"} @click=${() => this.selectSection("excluded")}>Excluded <span class="tab-count">${this.account.excluded_count ?? 0}</span></button>
          <button aria-selected=${this.activeSection === "reconciliation"} @click=${() => this.selectSection("reconciliation")}>Reconciliation <span class="tab-count">${this.account.unreconciled_count ?? 0}</span></button>
        </nav>` : null}

        ${this.activeSection === "reconciliation" && this.isBankOrCreditCard()
          ? html`<section>
              <div class="reconciliation-head"><h3>Reconciliation history</h3>${this.reconciliationMode === "list" ? html`<button class="primary" @click=${() => this.reconciliationMode = "create"}>New reconciliation</button>` : html`<button class="secondary" @click=${() => this.reconciliationMode = "list"}>← History</button>`}</div>
              ${this.reconciliationMode === "create" ? html`<paprel-reconciliation-form bank-account-id=${this.accountId} @reconciliation-created=${() => this.reconciliationMode = "list"}></paprel-reconciliation-form>` : null}
              ${this.reconciliationMode === "detail" ? html`<paprel-reconciliation-detail reconciliation-id=${this.selectedReconciliationId}></paprel-reconciliation-detail>` : null}
              ${this.reconciliationMode === "list" ? html`<paprel-reconciliation-list bank-account-id=${this.accountId} status="all" @reconciliation-select=${this.openReconciliation}></paprel-reconciliation-list>` : null}
            </section>`
          : this.selectedTransactionId
            ? html`<section class="transaction-workbench">
                <div class="transaction-workbench-head"><h3>Review and match transaction</h3><button class="secondary" @click=${() => this.closeTransaction()}>← Transactions</button></div>
                <div class="matching-layout">
                  <div class="matching-panel"><h4>Bank transaction</h4><paprel-transaction-detail transaction-id=${this.selectedTransactionId} @transaction-excluded=${() => this.closeTransaction(true)} @transaction-restored=${() => this.closeTransaction(true)}></paprel-transaction-detail></div>
                  <div class="matching-panel"><h4>Suggested matches</h4><paprel-transaction-match-sheet transaction-id=${this.selectedTransactionId} @transaction-matched=${() => this.closeTransaction(true)}></paprel-transaction-match-sheet></div>
                </div>
              </section>`
            : this.activeSection === "overview"
              ? this.renderOverview()
              : html`<paprel-transaction-inbox bank-account-id=${this.accountId} .inbox=${this.activeSection as TransactionInbox} .currency=${this.account.currency ?? ""} .showInboxTabs=${false} @transaction-select=${this.forwardTransactionSelect}></paprel-transaction-inbox>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "paprel-bank-account-detail": PaprelBankAccountDetail;
  }
}
