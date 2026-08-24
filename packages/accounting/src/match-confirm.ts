import type { BankingTransaction, ConfirmMatchPayload, TransactionMatch } from "./types.js";

/** Build confirm-match body from a suggested match row and its bank transaction. */
export function buildConfirmMatchPayload(
  transaction: BankingTransaction,
  match: TransactionMatch,
): ConfirmMatchPayload {
  const txnId = transaction.id;
  const currency = String(transaction.currency ?? match.currency ?? "USD");
  const docAmount = Math.abs(Number(match.doc_amount ?? 0));
  const exchangeRate = Number(match.doc_exchange_rate ?? 1) || 1;
  const allocated = docAmount ? (docAmount * exchangeRate).toFixed(2) : String(Math.abs(Number(transaction.available_balance ?? transaction.amount ?? 0)));

  return {
    entity: String(match.entity ?? ""),
    currency,
    mapping: [
      {
        transaction_id: txnId,
        entity_id: String(match.entity_id ?? ""),
        amount: allocated,
        currency,
        original_amount: docAmount ? String(docAmount) : allocated,
        original_currency: match.doc_currency ?? currency,
        exchange_rate: String(exchangeRate),
      },
    ],
  };
}
