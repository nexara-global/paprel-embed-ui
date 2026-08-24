export type { EmbedAuth, EmbedClientOptions, EmbedTokenSet } from "@paprel/embed-core";

export type BankingAccount = {
  id: string;
  account_code?: string;
  account_number?: string | null;
  /** i18n key for system accounts; custom accounts may be literal text. */
  account?: string | null;
  account_name?: string;
  account_type?: string;
  account_subtype?: string;
  account_subtype_id?: string | null;
  balance?: string | number | null;
  is_archived?: boolean;
  is_system_defined?: boolean;
  is_contra?: boolean;
  [key: string]: unknown;
};

export type AccountSubtype = {
  id: string;
  name: string;
  account_type?: string | null;
  account_type_id?: string;
  account_number?: string | null;
};

export type AccountTreeNode = {
  id: string;
  account_name: string;
  account_number?: string | null;
  account_subtype?: AccountTreeSubtype[];
  total?: string | null;
};

export type AccountTreeSubtype = {
  id: string;
  account_name: string;
  account?: BankingAccount[];
};

export type JournalLine = {
  account_id: string;
  description?: string;
  debit?: string | number;
  credit?: string | number;
  people_id?: string | null;
};

export type JournalForm = {
  date: string;
  reference?: string | null;
  currency: string;
  description?: string;
  exchange_rate?: string | number;
  override?: boolean;
  posted?: boolean;
  lines: JournalLine[];
  [key: string]: unknown;
};

export type JournalSummary = {
  id: string;
  /** Operator-visible journal number (e.g. JRN-00042). */
  identifier?: string | null;
  date?: string;
  reference?: string | null;
  description?: string;
  currency?: string;
  exchange_rate?: string | number;
  posted?: boolean;
  /** Core API field — mapped to `posted` in list normalization. */
  is_posted?: boolean;
  is_voided?: boolean;
  is_reversal?: boolean;
  is_locked?: boolean;
  is_manual?: boolean;
  is_manual_override?: boolean;
  override_reason?: string | null;
  reversal_of?: string | null;
  total_debit?: string;
  total_credit?: string;
  total_debit_fcy?: string | number | null;
  total_credit_fcy?: string | number | null;
  total_debit_bcy?: string | number | null;
  total_credit_bcy?: string | number | null;
  [key: string]: unknown;
};

export type JournalListResult = {
  journals: JournalSummary[];
  totalRecords?: number;
  pageNumber?: number;
  pageSize?: number;
};

export type JournalDetail = JournalSummary & {
  lines?: JournalLine[];
  version_number?: number;
};

export type Paginated<T> = {
  items: T[];
  page?: number;
  total?: number;
  [key: string]: unknown;
};

export type TransactionLockLevel = "SOFT" | "HARD";
export type TransactionLockScope = "GLOBAL" | "SALES" | "PURCHASES" | "GL";

export type TransactionLock = {
  id: string;
  lock_identifier?: string;
  lock_label: string;
  module_scope: TransactionLockScope | string;
  lock_level: TransactionLockLevel | string;
  lock_from_date: string;
  lock_to_date?: string | null;
  status: string;
  reason_text?: string | null;
  external_ref_id?: string | null;
  created_by?: string;
  created_at?: string;
  [key: string]: unknown;
};

export type TransactionLockListResult = {
  locks: TransactionLock[];
  totalRecords?: number;
  pageNumber?: number;
  pageSize?: number;
};

export type ListTransactionLocksParams = {
  page?: number;
  pageSize?: number;
  label?: string;
  identifier?: string;
  reference?: string;
  moduleScope?: string;
  status?: string;
  dateRange?: string;
};

export type TransactionLockForm = {
  lock_label: string;
  module_scope: TransactionLockScope | string;
  lock_level: TransactionLockLevel | string;
  lock_from_date: string;
  lock_to_date?: string | null;
  reason_text: string;
  external_ref_id?: string | null;
};

export type ListJournalsParams = {
  /** Optional cache partition; tenant scope comes from the access token JWT. */
  companyId?: string;
  page?: number;
  pageSize?: number;
  dateRange?: string;
  posted?: boolean;
  manual?: boolean;
  reference?: string;
  identifier?: string;
  voided?: boolean;
  reversed?: boolean;
};

export type AccountForm = {
  account?: string | null;
  account_number?: string | null;
  account_subtype?: string | null;
  currency?: string | null;
  description?: string | null;
  is_archived?: boolean | null;
  is_contra?: boolean;
  is_sub_account?: boolean | null;
  kind?: string | null;
  parent_id?: string | null;
  tag?: string[] | null;
  [key: string]: unknown;
};

export type ListAccountsParams = {
  /** Optional cache partition; tenant scope comes from the access token JWT. */
  companyId?: string;
  isArchived?: boolean;
};

export type AccountTreeParams = {
  /** Optional cache partition; tenant scope comes from the access token JWT. */
  companyId?: string;
  isArchived?: boolean;
};

export type TrialBalanceRow = {
  account_id?: string;
  account_name?: string;
  account_number?: string | null;
  debit?: string | number;
  credit?: string | number;
  balance?: string | number;
  [key: string]: unknown;
};

export type TrialBalanceReport = {
  as_of_date?: string;
  trial_balance?: TrialBalanceRow[];
  [key: string]: unknown;
};

export type TrialBalanceParams = {
  /** As-of date (YYYY-MM-DD). Defaults to today on the server. */
  date?: string;
  currency?: string;
};

export type ReportDateParams = {
  date?: string;
  dateRange?: string;
  currency?: string;
};

export type BalanceSheetReport = {
  as_of_date?: string;
  balance_sheet?: unknown[];
  asset_total?: string | number;
  liability_equity_total?: string | number;
  [key: string]: unknown;
};

export type IncomeStatementReport = {
  date_range?: string;
  income_statement?: unknown[];
  net_income?: string | number;
  status?: string;
  [key: string]: unknown;
};

export type CashFlowSummary = {
  cash_inflow?: string | number;
  cash_outflow?: string | number;
  net_cash_flow?: string | number;
  transaction_count?: number;
};

export type CashFlowReport = {
  date_range?: string;
  summary?: CashFlowSummary;
  [key: string]: unknown;
};

export type BankAccountSummary = {
  id: string;
  account?: string | null;
  account_name?: string | null;
  account_number?: string | null;
  currency?: string | null;
  kind?: string | null;
  is_archived?: boolean;
  uncategorized_count?: number;
  [key: string]: unknown;
};

export type BankAccountStats = {
  account_balance?: {
    account_id?: string;
    /** Legacy alias accepted during API rollout. */
    banking_account_id?: string;
    available_balance?: string | number;
    currency?: string;
    as_of_date?: string;
  }[];
  [key: string]: unknown;
};

export type BankAccountDetail = {
  id: string;
  name?: string;
  account?: string | null;
  account_name?: string | null;
  account_number?: string | null;
  account_kind?: string | null;
  account_type?: string | null;
  account_subtype?: string | null;
  currency?: string | null;
  description?: string | null;
  is_archived?: boolean;
  uncategorized_count?: number;
  excluded_count?: number;
  unreconciled_count?: number;
  stats?: BankAccountStats;
  [key: string]: unknown;
};

export type BankingListResult = {
  accounts: BankAccountSummary[];
  balances?: {
    account_balance?: { account_id?: string; banking_account_id?: string; available_balance?: string | number; currency?: string }[];
    [key: string]: unknown;
  };
};

export type GeneralLedgerRow = {
  id?: string;
  account?: string;
  account_number?: string | null;
  account_currency?: string;
  account_subtype?: string;
  account_type?: string;
  total_debit_fcy?: string | number;
  total_credit_fcy?: string | number;
  total_debit_bcy?: string | number;
  total_credit_bcy?: string | number;
  [key: string]: unknown;
};

export type GeneralLedgerReport = {
  ledger?: GeneralLedgerRow[];
  date_range?: string;
  [key: string]: unknown;
};

export type GeneralLedgerParams = {
  dateRange?: string;
  currency?: string;
  /** Filter to a single GL account id. */
  accountId?: string;
};

export type BankingTransaction = {
  id: string;
  banking_account_id?: string;
  date?: string;
  description?: string;
  amount?: string | number;
  available_balance?: string | number;
  transaction_type?: string;
  currency?: string | null;
  is_reconciled?: boolean | null;
  is_ignored?: boolean | null;
  transaction_identifier?: string | null;
  matches?: TransactionMatch[];
  [key: string]: unknown;
};

export type ListTransactionsParams = {
  /** Banking account id filter. */
  account?: string;
  dateRange?: string;
  currency?: string;
  description?: string;
  matchPolicyId?: string;
  /** Uncategorized inbox: false. Categorized: true. */
  posted?: boolean;
  /** Excluded inbox: true. */
  excluded?: boolean;
  page?: number;
  pageSize?: number;
};

export type TransactionMatch = {
  transaction_id?: string;
  entity?: string | null;
  entity_id?: string | null;
  amount?: string | number;
  currency?: string | null;
  date?: string | null;
  doc_amount?: string | number | null;
  doc_currency?: string | null;
  doc_date?: string | null;
  doc_description?: string | null;
  doc_number?: string | null;
  doc_reference?: string | null;
  doc_status?: string | null;
  doc_exchange_rate?: string | number | null;
  score?: string | number | null;
  confidence_tier?: string | null;
  match_reasons?: string[] | null;
  [key: string]: unknown;
};

export type TransactionMapping = {
  transaction_id: string;
  entity_id: string;
  amount: string;
  currency: string;
  original_amount?: string;
  original_currency?: string;
  exchange_rate?: string;
  notes?: string | null;
};

export type ConfirmMatchPayload = {
  entity: string;
  currency: string;
  mapping: TransactionMapping[];
};

export type ExcludeTransactionsPayload = {
  transactions: string[];
  reason?: string;
};

export type RestoreTransactionsPayload = {
  transactions: string[];
};

export type TransactionListResult = {
  transactions: BankingTransaction[];
  totalRecords?: number;
  pageNumber?: number;
  pageSize?: number;
  policyId?: string;
};

export type TransactionEntityMapping = {
  entity?: string | null;
  entity_id?: string | null;
  amount?: string | number;
  [key: string]: unknown;
};

export type TransactionDetail = BankingTransaction & {
  is_posted?: boolean;
  mapping?: TransactionEntityMapping[];
  matches?: TransactionMatch[];
  meta_data?: Record<string, unknown> | null;
  ignore_reason?: string | null;
};

export type ReconciliationLine = {
  id: string;
  reconciliation_id?: string;
  journal_id: string;
  journal_line_id: string;
  is_reconciled?: boolean;
  note?: string | null;
};

export type ReconciliationRecord = {
  id: string;
  banking_account_id: string;
  start_date: string;
  end_date: string;
  opening_balance?: string | number | null;
  closing_balance: string | number;
  calculated_balance?: string | number | null;
  diff?: string | number | null;
  status: string;
  note?: string | null;
  created_at?: string;
  reconciled_at?: string | null;
  lines?: ReconciliationLine[];
  [key: string]: unknown;
};

export type ReconciliationListResult = {
  reconciliations: ReconciliationRecord[];
  totalRecords?: number;
  pageNumber?: number;
  pageSize?: number;
};

export type ListReconciliationsParams = {
  account?: string;
  status?: string;
  dateRange?: string;
  page?: number;
  pageSize?: number;
};

export type ReconciliationFormPayload = {
  account: string;
  start_date: string;
  end_date: string;
  opening_balance?: string;
  closing_balance: string;
  calculated_balance?: string;
  diff?: string;
};

export type ReconciliationSavePayload = {
  closing_balance?: string;
  opening_balance?: string;
  calculated_balance?: string;
  diff?: string;
  currency?: string;
  status?: string;
  reconciliation_id?: string;
  journals?: { journal_id: string; journal_line_id: string }[];
};

export type ReconciliationVoidPayload = {
  note?: string;
};

export type TransactionInbox = "uncategorized" | "categorized" | "excluded";
