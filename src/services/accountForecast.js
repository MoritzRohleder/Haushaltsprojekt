'use strict';

const { nextOccurrenceAfter, monthRange, parts, today: todayIso } = require('../utils/dates');
const { describe, monthlyCents } = require('./recurringOverview');

/**
 * Regelmäßige Buchungen aus Sicht eines Kontos und voraussichtlicher Kontostand am
 * Monatsende (Spec F-36, Kap. 6.8). Alles, was vom Konto abgeht – Ausgaben und
 * Transfers an andere Konten oder Anlagen –, ist ein Minus; alles, was ankommt, ein Plus.
 */

/** Noch nicht gebuchte Termine einer Vorlage bis einschließlich `until`. */
function pendingDates(rec, until) {
  const dates = [];
  let after = rec.last_generated_date;
  for (let i = 0; i < 400; i++) {
    const next = nextOccurrenceAfter(rec, after);
    if (!next || next > until) break;
    dates.push(next);
    after = next;
  }
  return dates;
}

/** Kommt das Geld der Vorlage auf diesem Konto an (+) oder geht es ab (−)? */
function directionFor(rec, accountId) {
  if (rec.type === 'income') return 'in';
  if (rec.type === 'expense') return 'out';
  return rec.to_account_id === accountId ? 'in' : 'out';
}

/**
 * Vorlagen, die das Konto betreffen, mit Vorzeichen aus Sicht des Kontos,
 * Monatswerten und den in diesem Monat noch ausstehenden Terminen.
 */
function accountRecurring(ctx, templates, account, { today = todayIso() } = {}) {
  const { year, month } = parts(today);
  const monthEnd = monthRange(year, month).to;

  const rows = templates
    .filter((r) => r.account_id === account.id || r.to_account_id === account.id)
    .map((rec) => {
      const row = describe(ctx, rec);
      const direction = directionFor(rec, account.id);
      const sign = direction === 'in' ? 1 : -1;
      const pending = row.status === 'laufend' ? pendingDates(rec, monthEnd) : [];
      return {
        ...row,
        direction,
        account_cents: sign * rec.amount_cents,
        account_monthly_cents: sign * monthlyCents(rec),
        pending_dates: pending,
        pending_cents: sign * rec.amount_cents * pending.length,
      };
    })
    .sort((a, b) => (a.next ?? '9999').localeCompare(b.next ?? '9999') || a.description.localeCompare(b.description, 'de'));

  const running = rows.filter((r) => r.status === 'laufend');
  const sum = (list, key) => list.reduce((s, r) => s + r[key], 0);
  const monthlyIn = sum(running.filter((r) => r.direction === 'in'), 'account_monthly_cents');
  const monthlyOut = sum(running.filter((r) => r.direction === 'out'), 'account_monthly_cents');
  const pendingIn = sum(rows.filter((r) => r.pending_cents > 0), 'pending_cents');
  const pendingOut = sum(rows.filter((r) => r.pending_cents < 0), 'pending_cents');
  // Stand am Monatsende: alle bis dahin erfassten Buchungen plus noch ausstehende Termine
  const bookedUntilMonthEnd = ctx.balance(account, monthEnd);

  return {
    rows,
    monthEnd,
    summary: {
      monthlyIn,
      monthlyOut,
      monthlyNet: monthlyIn + monthlyOut,
      pendingIn,
      pendingOut,
      bookedUntilMonthEnd,
      projected: bookedUntilMonthEnd + pendingIn + pendingOut,
    },
  };
}

/** Nur der voraussichtliche Stand am Monatsende je Konto (für die Kontenliste). */
function projectedBalances(ctx, templates, accounts, options) {
  return new Map(accounts.map((a) => [a.id, accountRecurring(ctx, templates, a, options).summary.projected]));
}

module.exports = { accountRecurring, projectedBalances, pendingDates, directionFor };
