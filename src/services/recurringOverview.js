'use strict';

const { INTERVAL_UNITS, nextOccurrenceAfter } = require('../utils/dates');
const { describeInterval } = require('./recurring');

/**
 * Übersicht der regelmäßigen Buchungen (Spec F-35, Kap. 6.7): Einordnung aus Sicht
 * des Nutzers, Umrechnung auf einen Monat, Filter, Sortierung und Summen.
 */

/** Durchschnittliche Anzahl Termine pro Monat bei „jede(n) <Einheit>“. */
const PER_MONTH = { day: 365.25 / 12, week: 365.25 / 7 / 12, month: 1, year: 1 / 12 };
/** Ungefähre Länge eines Turnus in Tagen – nur zum Sortieren. */
const DAYS = { day: 1, week: 7, month: 30.44, year: 365.25 };

const KINDS = ['income', 'expense', 'transfer'];
const STATUSES = ['laufend', 'pausiert', 'beendet'];
const SORT_KEYS = ['beschreibung', 'konto', 'turnus', 'naechster', 'betrag', 'monat'];

/** Betrag umgerechnet auf einen Durchschnittsmonat (in Cent, gerundet). */
function monthlyCents(rec) {
  const count = rec.interval_count || 1;
  return Math.round((rec.amount_cents * (PER_MONTH[rec.interval_unit] ?? 0)) / count);
}

/**
 * Art aus Sicht des Nutzers (wie bei Buchungen, Spec 6.2): Ein Transfer, dessen
 * Gegenseite der Nutzer nicht sieht, ist für ihn eine Einnahme bzw. Ausgabe.
 */
function kindFor(ctx, rec) {
  if (rec.type !== 'transfer') return rec.type;
  const fromVisible = ctx.accountIds.has(rec.account_id);
  const toVisible = rec.to_asset_id ? ctx.assetIds.has(rec.to_asset_id) : ctx.accountIds.has(rec.to_account_id);
  if (fromVisible && toVisible) return 'transfer';
  return fromVisible ? 'expense' : 'income';
}

function statusOf(rec) {
  if (!rec.active) return 'pausiert';
  return nextOccurrenceAfter(rec, rec.last_generated_date) ? 'laufend' : 'beendet';
}

/** Eine Vorlage mit allen Angaben für Tabelle, Filter und Summen. */
function describe(ctx, rec) {
  const from = ctx.accountsById.get(rec.account_id)?.name ?? '?';
  let target = '';
  if (rec.to_account_id) target = ctx.accountsById.get(rec.to_account_id)?.name ?? '?';
  if (rec.to_asset_id) target = ctx.assetsById.get(rec.to_asset_id)?.name ?? '?';
  const kind = kindFor(ctx, rec);
  const status = statusOf(rec);
  const sign = kind === 'expense' ? -1 : 1;
  return {
    ...rec,
    kind,
    kindClass: kind === 'transfer' && rec.to_asset_id ? 'asset' : kind,
    route: rec.type === 'transfer' ? `${from} → ${target}` : from,
    category: ctx.categoriesById.get(rec.category_id)?.name ?? (rec.type === 'transfer' && kind !== 'transfer' ? 'Übertrag' : ''),
    rhythm: describeInterval(rec),
    status,
    next: status === 'laufend' ? nextOccurrenceAfter(rec, rec.last_generated_date) : null,
    signed_cents: sign * rec.amount_cents,
    monthly_cents: sign * monthlyCents(rec),
  };
}

/** Filter aus der Adresszeile lesen; Unbekanntes wird ignoriert. */
function readFilters(query) {
  const pick = (value, allowed) => (allowed.includes(value) ? value : '');
  return {
    konto: typeof query.konto === 'string' ? query.konto : '',
    turnus: pick(query.turnus, INTERVAL_UNITS),
    art: pick(query.art, KINDS),
    status: pick(query.status, STATUSES),
    sort: pick(query.sort, SORT_KEYS) || 'beschreibung',
    dir: query.dir === 'desc' ? 'desc' : 'asc',
  };
}

function matches(row, f) {
  if (f.konto && ![row.account_id, row.to_account_id, row.to_asset_id].includes(f.konto)) return false;
  if (f.turnus && row.interval_unit !== f.turnus) return false;
  if (f.art && row.kind !== f.art) return false;
  if (f.status && row.status !== f.status) return false;
  return true;
}

const collator = new Intl.Collator('de');
const COMPARE = {
  beschreibung: (a, b) => collator.compare(a.description, b.description),
  konto: (a, b) => collator.compare(a.route, b.route),
  turnus: (a, b) => (DAYS[a.interval_unit] * (a.interval_count || 1)) - (DAYS[b.interval_unit] * (b.interval_count || 1))
    || (a.month_of_year ?? 0) - (b.month_of_year ?? 0) || (a.day_of_month ?? 0) - (b.day_of_month ?? 0),
  // Ohne nächsten Termin (pausiert, beendet) immer ans Ende – unabhängig von der Richtung.
  naechster: (a, b) => (a.next ?? '').localeCompare(b.next ?? ''),
  betrag: (a, b) => Math.abs(a.amount_cents) - Math.abs(b.amount_cents),
  monat: (a, b) => Math.abs(a.monthly_cents) - Math.abs(b.monthly_cents),
};

function sortRows(rows, { sort, dir }) {
  const factor = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    if (sort === 'naechster' && !a.next !== !b.next) return a.next ? -1 : 1;
    return factor * COMPARE[sort](a, b) || COMPARE.beschreibung(a, b);
  });
}

/** Summen pro Monat über alle laufenden Einträge der (gefilterten) Liste. */
function summarize(rows) {
  const running = rows.filter((r) => r.status === 'laufend');
  const sum = (list) => list.reduce((s, r) => s + r.monthly_cents, 0);
  const income = sum(running.filter((r) => r.kind === 'income'));
  const expense = sum(running.filter((r) => r.kind === 'expense'));
  const transfers = running.filter((r) => r.kind === 'transfer');
  const toAssets = sum(transfers.filter((r) => r.to_asset_id));
  return {
    running: running.length,
    income,
    expense,
    // Geld, das in Anlagen fließt, ist nicht mehr frei verfügbar – es mindert den Saldo.
    net: income + expense - toAssets,
    transfer: sum(transfers),
    toAssets,
  };
}

/**
 * Komplette Übersicht: alle Vorlagen beschreiben, filtern, sortieren und summieren.
 * `options` enthält Konten und Anlagen, die in der Liste vorkommen (für den Kontofilter).
 */
function buildOverview(ctx, templates, query = {}) {
  const filters = readFilters(query);
  const all = templates.map((rec) => describe(ctx, rec));
  const rows = sortRows(all.filter((r) => matches(r, filters)), filters);
  const used = new Set(all.flatMap((r) => [r.account_id, r.to_account_id, r.to_asset_id]).filter(Boolean));
  const byName = (a, b) => collator.compare(a.name, b.name);
  return {
    filters,
    rows,
    total: all.length,
    summary: summarize(rows),
    options: {
      accounts: ctx.accounts.filter((a) => used.has(a.id)).sort(byName),
      assets: ctx.assets.filter((a) => used.has(a.id)).sort(byName),
    },
  };
}

module.exports = { buildOverview, describe, monthlyCents, kindFor, readFilters, sortRows, summarize, SORT_KEYS };
