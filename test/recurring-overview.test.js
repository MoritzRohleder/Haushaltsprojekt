'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, user, account } = require('./helpers');
const recurring = require('../src/services/recurring');
const assets = require('../src/services/assets');
const { loadContext } = require('../src/services/overview');
const { buildOverview, monthlyCents, readFilters } = require('../src/services/recurringOverview');

const TODAY = '2026-10-01';

async function plan(t) {
  const env = await setup();
  t.after(env.cleanup);
  const a = await user(env.repos, 'anna');
  const b = await user(env.repos, 'ben');
  const giro = await account(env.repos, 'Giro', [a.id]);
  const joint = await account(env.repos, 'Gemeinsam', [a.id, b.id]);
  const fund = await assets.createAsset(env.repos, a.id, {
    name: 'ETF', type: 'fund', owner_ids: [a.id], start_value: '0',
  }, { today: TODAY });
  const cats = await env.repos.categories.findAll();
  const cat = (name) => cats.find((c) => c.name === name).id;
  const add = (input) => recurring.createFromForm(env.repos, a.id, {
    date: '2026-10-15', recurring: '1', interval_count: '1', end_date: '', ...input,
  }, TODAY);

  await add({ type: 'income', amount: '3000', description: 'Gehalt', account_id: giro.id, category_id: cat('Gehalt'), interval_unit: 'month' });
  await add({ type: 'expense', amount: '1200', description: 'Miete', account_id: joint.id, category_id: cat('Wohnen'), interval_unit: 'month' });
  await add({ type: 'expense', amount: '600', description: 'Versicherung', account_id: giro.id, category_id: cat('Versicherungen'), interval_unit: 'year' });
  await add({ type: 'expense', amount: '30', description: 'Wochenmarkt', account_id: giro.id, category_id: cat('Lebensmittel'), merchant: 'Markt', interval_unit: 'week' });
  await add({ type: 'transfer', amount: '200', description: 'Sparrate', from: `account:${giro.id}`, to: `asset:${fund.id}`, interval_unit: 'month' });
  await add({ type: 'transfer', amount: '500', description: 'Haushaltsgeld', from: `account:${giro.id}`, to: `account:${joint.id}`, interval_unit: 'month', interval_count: '3' });
  const paused = (await add({ type: 'expense', amount: '10', description: 'Streaming', account_id: giro.id, category_id: cat('Freizeit'), interval_unit: 'month' })).recurring;
  await recurring.setActive(env.repos, a.id, paused.id, false, TODAY);

  const overview = async (userId, query) => {
    const ctx = await loadContext(env.repos, userId);
    return buildOverview(ctx, await recurring.listForUser(env.repos, userId), query);
  };
  return { ...env, a, b, giro, joint, fund, overview };
}

test('Umrechnung auf einen Monat je Turnus', () => {
  const rec = (amount_cents, interval_unit, interval_count = 1) => ({ amount_cents, interval_unit, interval_count });
  assert.equal(monthlyCents(rec(120000, 'month')), 120000);
  assert.equal(monthlyCents(rec(60000, 'year')), 5000);
  assert.equal(monthlyCents(rec(50000, 'month', 3)), 16667);
  assert.equal(monthlyCents(rec(3000, 'week')), 13045); // 30 € × 52,18 Wochen / 12
  assert.equal(monthlyCents(rec(100, 'day')), 3044);
});

test('Filter aus der Adresszeile: Unbekanntes wird ignoriert', () => {
  assert.deepEqual(readFilters({ turnus: 'quarter', art: 'x', sort: 'drop', dir: 'up', status: 'laufend' }),
    { konto: '', turnus: '', art: '', status: 'laufend', sort: 'beschreibung', dir: 'asc' });
});

test('Übersicht: Arten, Summen pro Monat und Status', async (t) => {
  const p = await plan(t);
  const o = await p.overview(p.a.id);
  assert.equal(o.total, 7);
  const byName = Object.fromEntries(o.rows.map((r) => [r.description, r]));
  assert.equal(byName.Gehalt.kind, 'income');
  assert.equal(byName.Miete.monthly_cents, -120000);
  assert.equal(byName.Sparrate.kind, 'transfer');
  assert.equal(byName.Sparrate.kindClass, 'asset');
  assert.equal(byName.Streaming.status, 'pausiert');
  assert.equal(byName.Gehalt.next, '2026-10-15');

  // Pausierte zählen nicht mit
  assert.equal(o.summary.running, 6);
  assert.equal(o.summary.income, 300000);
  assert.equal(o.summary.expense, -120000 - 5000 - 13045);
  assert.equal(o.summary.net, 300000 - 120000 - 5000 - 13045 - 20000); // Sparrate in Anlage mindert den Saldo
  assert.equal(o.summary.transfer, 20000 + 16667);
  assert.equal(o.summary.toAssets, 20000);
  assert.deepEqual(o.options.accounts.map((a) => a.name), ['Gemeinsam', 'Giro']);
  assert.deepEqual(o.options.assets.map((a) => a.name), ['ETF']);
});

test('Übersicht aus Sicht des Mitinhabers: Transfer ohne sichtbare Gegenseite ist Einnahme', async (t) => {
  const p = await plan(t);
  const o = await p.overview(p.b.id);
  assert.deepEqual(o.rows.map((r) => [r.description, r.kind]), [['Haushaltsgeld', 'income'], ['Miete', 'expense']]);
  assert.equal(o.summary.income, 16667);
  assert.equal(o.summary.transfer, 0);
});

test('Übersicht filtern nach Konto, Turnus, Art und Status', async (t) => {
  const p = await plan(t);
  const names = async (query) => (await p.overview(p.a.id, query)).rows.map((r) => r.description);
  assert.deepEqual(await names({ konto: p.joint.id }), ['Haushaltsgeld', 'Miete']);
  assert.deepEqual(await names({ konto: p.fund.id }), ['Sparrate']);
  assert.deepEqual(await names({ turnus: 'year' }), ['Versicherung']);
  assert.deepEqual(await names({ art: 'transfer' }), ['Haushaltsgeld', 'Sparrate']);
  assert.deepEqual(await names({ art: 'expense', status: 'laufend' }), ['Miete', 'Versicherung', 'Wochenmarkt']);
  assert.deepEqual(await names({ turnus: 'month', art: 'expense', konto: p.giro.id }), ['Streaming']);

  // Summen beziehen sich auf die gefilterte Liste
  const o = await p.overview(p.a.id, { art: 'expense' });
  assert.equal(o.summary.income, 0);
  assert.equal(o.summary.expense, -138045);
});

test('Übersicht sortieren', async (t) => {
  const p = await plan(t);
  const names = async (query) => (await p.overview(p.a.id, query)).rows.map((r) => r.description);
  assert.deepEqual(await names({ sort: 'monat', dir: 'desc' }),
    ['Gehalt', 'Miete', 'Sparrate', 'Haushaltsgeld', 'Wochenmarkt', 'Versicherung', 'Streaming']);
  assert.deepEqual(await names({ sort: 'betrag', dir: 'desc' }),
    ['Gehalt', 'Miete', 'Versicherung', 'Haushaltsgeld', 'Sparrate', 'Wochenmarkt', 'Streaming']);
  assert.deepEqual(await names({ sort: 'turnus' }),
    ['Wochenmarkt', 'Gehalt', 'Miete', 'Sparrate', 'Streaming', 'Haushaltsgeld', 'Versicherung']);
  // Ohne nächsten Termin (pausiert) immer am Ende, auch absteigend
  const next = await names({ sort: 'naechster', dir: 'desc' });
  assert.equal(next.at(-1), 'Streaming');
});
