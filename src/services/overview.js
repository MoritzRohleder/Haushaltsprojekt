'use strict';

const { visibleAccounts, visibleAssets } = require('./visibility');
const { accountBalance, byDateThenCreated } = require('./balances');
const { assetSummary, assetHistory } = require('./assets');
const { monthRange, addMonths, parts, toIso, today: todayIso } = require('../utils/dates');

/**
 * Lädt alles, was für die Sicht eines Nutzers gebraucht wird (Spec Kapitel 4 und 6),
 * und stellt Hilfsfunktionen zur Einordnung und Beschriftung von Buchungen bereit.
 */
async function loadContext(repos, userId, { assetStaleMonths = 6, today = todayIso() } = {}) {
  const [accounts, assets, allAccounts, allAssets, categories, transactions, values] = await Promise.all([
    visibleAccounts(repos, userId),
    visibleAssets(repos, userId),
    repos.accounts.findAll(),
    repos.assets.findAll(),
    repos.categories.findAll(),
    repos.transactions.findAll(),
    repos.assetValues.findAll(),
  ]);

  const accountIds = new Set(accounts.map((a) => a.id));
  const assetIds = new Set(assets.map((a) => a.id));
  const accountsById = new Map(allAccounts.map((a) => [a.id, a]));
  const assetsById = new Map(allAssets.map((a) => [a.id, a]));
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const rows = transactions.filter((t) => accountIds.has(t.account_id));

  /**
   * Einordnung aus Sicht des Nutzers (Spec 6.2): Ein Transfer ist nur ein Transfer,
   * wenn der Nutzer die Gegenseite sieht – sonst eine normale Einnahme/Ausgabe.
   */
  function classify(t) {
    if (t.type !== 'transfer') return t.type;
    const counterVisible = t.counter_account_id
      ? accountIds.has(t.counter_account_id)
      : assetIds.has(t.counter_asset_id);
    if (counterVisible) return 'transfer';
    return t.amount_cents > 0 ? 'income' : 'expense';
  }

  function counterName(t) {
    if (t.counter_account_id) return accountsById.get(t.counter_account_id)?.name ?? 'unbekanntes Konto';
    if (t.counter_asset_id) return assetsById.get(t.counter_asset_id)?.name ?? 'unbekannte Anlage';
    return '';
  }

  /** Kurzer Text für die Spalte „Kategorie / Gegenseite“. */
  function label(t) {
    if (t.type !== 'transfer') return categoriesById.get(t.category_id)?.name ?? 'Ohne Kategorie';
    const name = counterName(t);
    if (t.counter_asset_id) return t.amount_cents < 0 ? `Einzahlung → ${name}` : `Auszahlung ← ${name}`;
    if (classify(t) === 'transfer') return t.amount_cents < 0 ? `Transfer → ${name}` : `Transfer ← ${name}`;
    return t.amount_cents > 0 ? `Übertrag von ${name}` : `Übertrag an ${name}`;
  }

  /** Name der Kategorie für Auswertungen; Transfers ohne sichtbare Gegenseite = „Überträge“. */
  function categoryName(t) {
    if (t.type === 'transfer') return 'Überträge';
    return categoriesById.get(t.category_id)?.name ?? 'Ohne Kategorie';
  }

  /** CSS-Klasse für Betragsfarbe: income, expense, transfer oder asset (Spec 10.7). */
  function kindClass(t) {
    const kind = classify(t);
    return kind === 'transfer' && t.counter_asset_id ? 'asset' : kind;
  }

  const staleBefore = addMonths(today, -assetStaleMonths);
  // Stand heute: Buchungen mit späterem Datum sind vorgemerkt und zählen noch nicht (Spec 6.1).
  const assetSummaries = new Map(assets.map((a) => [a.id, assetSummary(a, values, transactions, today, { staleBefore })]));

  return {
    userId, accounts, assets, rows, values, transactions, assetStaleMonths,
    accountIds, assetIds, accountsById, assetsById, categoriesById,
    classify, kindClass, label, categoryName, counterName,
    today,
    /** Kontostand am Stichtag – ohne Angabe heute, also ohne vorgemerkte Buchungen. */
    balance: (account, asOf = today) => accountBalance(account, rows, asOf),
    /** Vorgemerkte Buchungen (Datum nach heute), optional nur eines Kontos. */
    planned: (accountId = null) => rows.filter((t) => t.date > today && (!accountId || t.account_id === accountId)),
    assetSummary: (asset) => assetSummaries.get(asset.id),
  };
}

/** Gesamtübersicht (Spec 6.4). */
function totals(ctx) {
  const accountsTotal = ctx.accounts.filter((a) => !a.archived)
    .reduce((sum, a) => sum + ctx.balance(a), 0);
  const assetsTotal = ctx.assets.filter((a) => !a.archived)
    .reduce((sum, a) => sum + ctx.assetSummary(a).value_cents, 0);
  return { accountsTotal, assetsTotal, netWorth: accountsTotal + assetsTotal };
}

function sumBy(rows, keyFn) {
  const map = new Map();
  for (const r of rows) map.set(keyFn(r), (map.get(keyFn(r)) || 0) + r.amount_cents);
  return [...map.entries()].map(([name, sum]) => ({ name, sum })).sort((a, b) => Math.abs(b.sum) - Math.abs(a.sum));
}

/** Monatsbilanz (Spec 6.5). */
function monthlySummary(ctx, year, month) {
  const { from, to } = monthRange(year, month);
  const rows = ctx.rows.filter((t) => t.date >= from && t.date <= to).sort(byDateThenCreated);
  const incomeRows = rows.filter((t) => ctx.classify(t) === 'income');
  const expenseRows = rows.filter((t) => ctx.classify(t) === 'expense');
  const transferRows = rows.filter((t) => ctx.classify(t) === 'transfer');

  const income = incomeRows.reduce((s, t) => s + t.amount_cents, 0);
  const expense = expenseRows.reduce((s, t) => s + t.amount_cents, 0);
  const savedInAssets = transferRows.filter((t) => t.counter_asset_id)
    .reduce((s, t) => s - t.amount_cents, 0);

  // Transfers: Paare nur einmal aufführen (die abgehende Hälfte).
  const transfers = transferRows
    .filter((t) => t.counter_asset_id || t.amount_cents < 0)
    .map((t) => {
      const here = ctx.accountsById.get(t.account_id)?.name;
      const there = ctx.counterName(t);
      const outgoing = t.amount_cents < 0;
      return {
        id: t.id, date: t.date, description: t.description, amount_cents: Math.abs(t.amount_cents),
        from: outgoing ? here : there, to: outgoing ? there : here, asset: Boolean(t.counter_asset_id),
      };
    });

  const byAccount = ctx.accounts
    .map((a) => {
      const own = rows.filter((t) => t.account_id === a.id);
      const part = (kind) => own.filter((t) => ctx.classify(t) === kind).reduce((s, t) => s + t.amount_cents, 0);
      return {
        account: a,
        income: part('income'),
        expense: part('expense'),
        transfers: part('transfer'),
        change: own.reduce((s, t) => s + t.amount_cents, 0),
        count: own.length,
      };
    })
    .filter((x) => x.count > 0 || !x.account.archived);

  return {
    year, month, from, to, rows,
    income, expense, saldo: income + expense, savedInAssets,
    incomeByCategory: sumBy(incomeRows, ctx.categoryName),
    expenseByCategory: sumBy(expenseRows, ctx.categoryName),
    // Nur echte Ausgaben (keine Überträge); ohne Angabe gesammelt unter „Ohne Geschäft“
    expenseByMerchant: expenseRows.some((t) => t.merchant)
      ? sumBy(expenseRows.filter((t) => t.type === 'expense'), (t) => t.merchant || 'Ohne Geschäft')
      : [],
    transfers, byAccount,
  };
}

/**
 * Gesamtvermögen zu einem Stichtag (für den Verlauf): alle sichtbaren Konten,
 * die zu diesem Tag schon geführt wurden, plus Wert der sichtbaren Anlagen.
 */
function netWorthAt(ctx, date) {
  const accounts = ctx.accounts
    .filter((a) => a.opening_date <= date)
    .reduce((sum, a) => sum + ctx.balance(a, date), 0);
  const assets = ctx.assets.reduce((sum, a) => {
    const history = assetHistory(a, ctx.values, ctx.transactions, date);
    return sum + (history.length ? history[history.length - 1].value_cents : 0);
  }, 0);
  return { accounts, assets, total: accounts + assets };
}

/** Monatsvergleich (F-56): die letzten `count` Monate bis einschließlich des aktuellen. */
function monthlySeries(ctx, count, today = todayIso()) {
  const current = parts(today);
  const first = addMonths(toIso(current.year, current.month, 1), -(count - 1));
  return Array.from({ length: count }, (_, i) => {
    const { year, month } = parts(addMonths(first, i));
    const summary = monthlySummary(ctx, year, month);
    const end = summary.to < today ? summary.to : today;
    return {
      year, month,
      income: summary.income,
      expense: summary.expense,
      saldo: summary.saldo,
      savedInAssets: summary.savedInAssets,
      netWorth: netWorthAt(ctx, end),
      end,
    };
  });
}

module.exports = { loadContext, totals, monthlySummary, netWorthAt, monthlySeries };
