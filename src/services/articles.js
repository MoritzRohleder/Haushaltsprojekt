'use strict';

const { normalizeName } = require('./purchase');

/**
 * Artikel-Auswertung (F-59): Was wurde wie oft gekauft, zu welchem Preis, wo?
 * Grundlage sind die Artikellisten der sichtbaren Ausgaben im Zeitraum.
 * Gleichnamige Artikel werden zusammengefasst (Groß-/Kleinschreibung und
 * Leerzeichen spielen keine Rolle). Zeilen mit negativem Preis (Pfand, Rabatt)
 * sind keine Artikel und werden nicht ausgewertet.
 */
function articleStats(ctx, { from, to, query = '', limit = 30 } = {}) {
  const q = normalizeName(query);
  const groups = new Map();
  const rows = ctx.rows
    .filter((t) => t.type === 'expense' && t.items?.length && t.date >= from && t.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));

  for (const t of rows) {
    for (const item of t.items) {
      const key = normalizeName(item.name);
      if (!key || item.unit_price_cents < 0 || (q && !key.includes(q))) continue;
      const g = groups.get(key) || {
        key, name: item.name, purchases: 0, quantity: 0, total_cents: 0,
        min_unit_cents: Infinity, max_unit_cents: -Infinity, merchants: new Map(), last: null,
      };
      g.name = item.name; // zuletzt verwendete Schreibweise anzeigen
      g.purchases += 1;
      g.quantity += item.quantity;
      g.total_cents += item.total_cents;
      g.min_unit_cents = Math.min(g.min_unit_cents, item.unit_price_cents);
      g.max_unit_cents = Math.max(g.max_unit_cents, item.unit_price_cents);
      if (t.merchant) g.merchants.set(t.merchant, (g.merchants.get(t.merchant) || 0) + 1);
      g.last = { date: t.date, unit_price_cents: item.unit_price_cents, merchant: t.merchant || '', transaction_id: t.id };
      groups.set(key, g);
    }
  }

  const list = [...groups.values()].map((g) => ({
    name: g.name,
    purchases: g.purchases,
    quantity: Math.round(g.quantity * 1000) / 1000,
    total_cents: g.total_cents,
    avg_unit_cents: g.quantity ? Math.round(g.total_cents / g.quantity) : 0,
    min_unit_cents: g.min_unit_cents,
    max_unit_cents: g.max_unit_cents,
    merchants: [...g.merchants.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m),
    last: g.last,
  }));
  list.sort((a, b) => b.total_cents - a.total_cents || a.name.localeCompare(b.name, 'de'));
  return { total: list.length, items: list.slice(0, limit) };
}

module.exports = { articleStats };
