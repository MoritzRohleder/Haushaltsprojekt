'use strict';

/** Kontostand (Spec 6.1): Anfangssaldo + Summe aller Buchungen bis zum Stichtag. */
function accountBalance(account, transactions, asOf = null) {
  return transactions
    .filter((t) => t.account_id === account.id && (asOf === null || t.date <= asOf))
    .reduce((sum, t) => sum + t.amount_cents, account.opening_balance_cents);
}

/** Buchungen eines Kontos chronologisch mit laufendem Saldo. */
function ledger(account, transactions) {
  let balance = account.opening_balance_cents;
  return transactions
    .filter((t) => t.account_id === account.id)
    .sort(byDateThenCreated)
    .map((t) => {
      balance += t.amount_cents;
      return { ...t, balance_cents: balance };
    });
}

function byDateThenCreated(a, b) {
  return a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at);
}

module.exports = { accountBalance, ledger, byDateThenCreated };
