import { css, html, LitElement, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  accountI18nKey,
  accountPickerMetaLabel,
  formatJournalAmount,
  type AccountTreeNode,
  type BankingAccount,
} from "../headless.js";
import { getEmbedClient, getEmbedI18n } from "../context.js";
import { onEmbedLocaleChange } from "../locale-listener.js";
import sharedStyles from "@paprel/ui/styles.css?inline";

@customElement("paprel-chart-of-accounts")
export class PaprelChartOfAccounts extends LitElement {
  static styles = [
    css`${unsafeCSS(sharedStyles)}`,
    css`
      .coa-table-wrap {
        overflow-x: auto;
        width: 100%;
      }

      .coa-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
        line-height: 1.45;
        table-layout: fixed;
      }

      .coa-table th,
      .coa-table td {
        padding: 0.8rem 0.875rem;
        border-bottom: 1px solid var(--paprel-color-border-subtle, #f0f0eb);
        text-align: left;
        vertical-align: middle;
      }

      .coa-table thead th {
        font-size: 0.6875rem;
        font-weight: 650;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--paprel-color-muted, #78786f);
        background: var(--paprel-color-surface-muted, #f7f7f4);
        border-bottom: 1px solid var(--paprel-color-border, #e8e8e2);
      }

      .coa-table .coa-num {
        width: 5.5rem;
        font-variant-numeric: tabular-nums;
        color: var(--paprel-color-muted, #78786f);
      }

      .coa-table .coa-name {
        width: auto;
        color: var(--paprel-color-text, #1c1c18);
        font-weight: 500;
      }

      .coa-table .coa-type {
        width: 28%;
        color: var(--paprel-color-muted, #78786f);
        font-size: 0.8125rem;
        text-align: right;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .coa-table tbody tr:hover td {
        background: color-mix(in srgb, var(--paprel-color-surface-muted, #f7f7f4) 72%, white);
      }

      .coa-table tbody tr { cursor: pointer; transition: background .14s ease; }
      .coa-table tbody tr:focus { outline: 2px solid var(--paprel-color-primary); outline-offset: -2px; }

      .coa-empty {
        padding: 1.5rem 0.75rem;
        color: var(--paprel-color-muted, #78786f);
        font-size: 0.875rem;
        border-bottom: 1px solid var(--paprel-color-border-subtle, #f0f0eb);
      }

      .coa-tree-wrap {
        overflow-x: auto;
      }

      .coa-tree-wrap table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
      }

      .coa-tree-wrap th,
      .coa-tree-wrap td {
        padding: 0.5625rem 0.75rem;
        border-bottom: 1px solid var(--paprel-color-border-subtle, #f0f0eb);
        text-align: left;
      }

      .coa-tree-wrap thead th {
        font-size: 0.6875rem;
        font-weight: 650;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--paprel-color-muted, #78786f);
        background: var(--paprel-color-surface-muted, #f7f7f4);
        border-bottom: 1px solid var(--paprel-color-border, #e8e8e2);
      }

      .coa-table .coa-balance {
        width: 8rem;
        text-align: right;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      .coa-toolbar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0;
      }

      @media (max-width: 520px) {
        .coa-table .coa-type-head,
        .coa-table .coa-type {
          display: none;
        }
      }
    `,
  ];

  /** Hierarchical tree instead of the default flat account grid. */
  @property({ type: Boolean, attribute: "tree" }) tree = false;

  /** Include archived accounts in list/tree queries. */
  @property({ type: Boolean, attribute: "show-archived" }) showArchived = false;

  /**
   * @deprecated Use default flat list or the `tree` attribute for hierarchy.
   */
  @property({ type: Boolean, attribute: "flat" }) flat = true;

  @state() private loading = true;
  @state() private error = "";
  @state() private treeNodes: AccountTreeNode[] = [];
  @state() private flatAccounts: BankingAccount[] = [];

  private offLocaleChange?: () => void;

  private get useFlatList(): boolean {
    if (this.tree) return false;
    return this.flat !== false;
  }

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
    if (changed.has("tree") || changed.has("flat") || changed.has("showArchived")) await this.load();
  }

  async refresh(): Promise<void> {
    getEmbedClient().refresh();
    await this.load();
  }

  private label(key: string): string {
    return getEmbedI18n().accountLabel(key);
  }

  private accountNumber(account: BankingAccount): string {
    return String(account.account_number ?? "").trim();
  }

  private sortedFlatAccounts(): BankingAccount[] {
    const i18n = getEmbedI18n();
    return [...this.flatAccounts].sort((a, b) => {
      const numCmp = this.accountNumber(a).localeCompare(this.accountNumber(b), undefined, { numeric: true });
      if (numCmp !== 0) return numCmp;
      return i18n.accountLabel(accountI18nKey(a)).localeCompare(i18n.accountLabel(accountI18nKey(b)), i18n.locale);
    });
  }

  private formatBalance(account: BankingAccount | Record<string, unknown>, currency?: string): string {
    const raw = (account as BankingAccount).balance;
    if (raw == null || raw === "") return "—";
    const balance = Number(raw);
    if (!Number.isFinite(balance)) return "—";
    return formatJournalAmount(balance, currency);
  }

  private balanceMap(nodes: AccountTreeNode[]): Map<string, string | number | null> {
    const balances = new Map<string, string | number | null>();
    for (const node of nodes) {
      for (const subtype of node.account_subtype ?? []) {
        for (const account of subtype.account ?? []) balances.set(account.id, account.balance ?? null);
      }
    }
    return balances;
  }

  private open(account: BankingAccount): void {
    this.dispatchEvent(new CustomEvent("account-select", {
      detail: { accountId: account.id, account },
      bubbles: true,
      composed: true,
    }));
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      const client = getEmbedClient();
      const params = { isArchived: this.showArchived ? undefined : false };
      if (this.useFlatList) {
        const [accounts, tree] = await Promise.all([
          client.accounts.list(params),
          client.accounts.tree(params),
        ]);
        const balances = this.balanceMap(tree);
        this.flatAccounts = accounts.map((account) => ({
          ...account,
          balance: account.balance ?? balances.get(account.id) ?? null,
        }));
      } else {
        this.treeNodes = await client.accounts.tree(params);
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load accounts";
    } finally {
      this.loading = false;
    }
  }

  private renderTree(nodes: AccountTreeNode[], depth = 0): unknown {
    const i18n = getEmbedI18n();
    return nodes.flatMap((node) => [
      html`<tr>
        <td style=${`padding-left:${depth * 16}px`}>${this.label(node.account_name)}</td>
        <td class="muted">${node.account_number ?? ""}</td>
        <td class="coa-balance">${node.total ? formatJournalAmount(Number(node.total)) : ""}</td>
      </tr>`,
      ...(node.account_subtype?.flatMap((sub) => [
        html`<tr>
          <td style=${`padding-left:${(depth + 1) * 16}px`}>${this.label(sub.account_name)}</td>
          <td class="muted"></td>
          <td class="coa-balance"></td>
        </tr>`,
        ...(sub.account ?? []).map(
          (acct) => html`<tr>
            <td style=${`padding-left:${(depth + 2) * 16}px`}>${i18n.accountLabel(accountI18nKey(acct))}</td>
            <td class="muted">${this.accountNumber(acct)}</td>
            <td class="coa-balance">${this.formatBalance(acct, String(acct.currency ?? ""))}</td>
          </tr>`,
        ),
      ]) ?? []),
    ]);
  }

  private renderFlatGrid() {
    const i18n = getEmbedI18n();
    const accounts = this.sortedFlatAccounts();

    if (!accounts.length) {
      return html`<div class="coa-empty">${i18n.t("noAccounts")}</div>`;
    }

    return html`
      <div class="ledger-table-wrap coa-table-wrap">
        <table class="coa-table">
          <thead>
            <tr>
              <th class="coa-num" scope="col">${i18n.t("number")}</th>
              <th class="coa-name" scope="col">${i18n.t("account")}</th>
              <th class="coa-type coa-type-head" scope="col">${i18n.t("type")}</th>
              <th class="coa-balance" scope="col">${i18n.t("balance")}</th>
            </tr>
          </thead>
          <tbody>
            ${accounts.map(
              (account) => html`
                <tr tabindex="0" @click=${() => this.open(account)} @keydown=${(event: KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") this.open(account); }}>
                  <td class="coa-num">${this.accountNumber(account)}</td>
                  <td class="coa-name">${i18n.accountLabel(accountI18nKey(account))}</td>
                  <td class="coa-type">${accountPickerMetaLabel(i18n, account)}</td>
                  <td class="coa-balance">${this.formatBalance(account, String(account.currency ?? ""))}</td>
                </tr>
              `,
            )}
          </tbody>
        </table>
      </div>
    `;
  }

  render() {
    const i18n = getEmbedI18n();
    if (this.loading) {
      return html`<div class="state-loading">${i18n.t("loadingCoa")}</div>`;
    }
    if (this.error) {
      return html`<div class="error">${this.error}</div>`;
    }

    return html`
      <section class="paprel-panel">
        <header class="paprel-panel-header">
          <div><h2 class="paprel-panel-title">Chart of accounts</h2><p class="paprel-panel-description">Your ledger structure, balances, and account classifications.</p></div>
          <div class="coa-toolbar">
            <label class="field checkbox-inline">
              <input
                type="checkbox"
                .checked=${this.showArchived}
                @change=${(e: Event) => {
                  this.showArchived = (e.target as HTMLInputElement).checked;
                }}
              />
              ${i18n.t("showArchived")}
            </label>
          </div>
        </header>
        ${this.useFlatList ? this.renderFlatGrid() : html`
        <div class="coa-tree-wrap">
        <table>
          <thead>
            <tr>
              <th>${i18n.t("name")}</th>
              <th>${i18n.t("number")}</th>
              <th class="coa-balance">${i18n.t("balance")}</th>
            </tr>
          </thead>
          <tbody>${this.renderTree(this.treeNodes)}</tbody>
        </table>
        </div>`}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "paprel-chart-of-accounts": PaprelChartOfAccounts;
  }
}
