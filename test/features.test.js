'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { LoginThrottle, FREE_ATTEMPTS } = require('../src/services/loginThrottle');
const { toCsv, centsToCsv } = require('../src/utils/csv');
const { niceTicks, columnChart, lineChart } = require('../src/utils/charts');
const { setup, user, account } = require('./helpers');
const tx = require('../src/services/transactions');
const assets = require('../src/services/assets');
const preferences = require('../src/services/preferences');
const { visibleCategories } = require('../src/services/visibility');
const { loadContext, monthlySeries } = require('../src/services/overview');

test('Login-Bremse: Wartezeit nach mehreren Fehlversuchen, Erfolg setzt zurück', () => {
  let now = 0;
  const t = new LoginThrottle({ now: () => now });
  for (let i = 0; i < FREE_ATTEMPTS - 1; i++) t.failure('1.2.3.4', 'anna');
  assert.equal(t.retryAfter('1.2.3.4', 'anna'), 0);
  t.failure('1.2.3.4', 'Anna'); // Groß-/Kleinschreibung egal
  assert.equal(t.retryAfter('1.2.3.4', 'anna'), 30000);
  assert.equal(t.retryAfter('5.6.7.8', 'anna'), 0); // andere IP nicht betroffen
  now += 30000;
  assert.equal(t.retryAfter('1.2.3.4', 'anna'), 0);
  t.failure('1.2.3.4', 'anna');
  assert.equal(t.retryAfter('1.2.3.4', 'anna'), 60000); // verdoppelt
  t.success('1.2.3.4', 'anna');
  assert.equal(t.retryAfter('1.2.3.4', 'anna'), 0);
});

test('Login-Bremse: Limit pro IP über verschiedene Nutzernamen', () => {
  const t = new LoginThrottle({ now: () => 1000 });
  for (let i = 0; i < 30; i++) t.failure('9.9.9.9', `user${i}`);
  assert.ok(t.retryAfter('9.9.9.9', 'neu') > 0);
});

test('CSV im deutschen Format, mit Schutz vor Formeln', () => {
  const csv = toCsv(['Datum', 'Text', 'Betrag'], [['01.10.2026', 'Einkauf; "Rewe"', centsToCsv(-8640)], ['02.10.2026', '=HYPERLINK("x")', centsToCsv(123456)]]);
  assert.ok(csv.startsWith('﻿'));
  const lines = csv.slice(1).trim().split('\r\n');
  assert.equal(lines[0], 'Datum;Text;Betrag');
  assert.equal(lines[1], '01.10.2026;"Einkauf; ""Rewe""";-86,40');
  assert.equal(lines[2], '02.10.2026;"\'=HYPERLINK(""x"")";1234,56');
});

test('Diagramm-Achsen sind runde Werte und umfassen die Daten', () => {
  const ticks = niceTicks(-12345, 98765);
  assert.ok(ticks[0] <= -12345 && ticks.at(-1) >= 98765);
  assert.ok(ticks.includes(0));
  const columns = columnChart([{ label: 'a', value: 5000 }, { label: 'b', value: -2000 }]);
  assert.ok(columns.bars[0].y < columns.zeroY && columns.bars[1].y === columns.zeroY);
  const line = lineChart([{ key: '2026-01-01', label: 'a', value: 1 }, { key: '2026-02-01', label: 'b', value: 3 }]);
  assert.equal(line.points.length, 2);
  assert.ok(line.points[1].y < line.points[0].y);
});

test('Theme und ausgeblendete Kategorien werden pro Nutzer gespeichert', async (t) => {
  const env = await setup();
  t.after(env.cleanup);
  const anna = await user(env.repos, 'anna');
  const ben = await user(env.repos, 'ben');
  assert.equal((await env.repos.users.findById(anna.id)).theme, 'auto');
  await preferences.setTheme(env.repos, anna.id, 'dark');
  assert.equal((await env.repos.users.findById(anna.id)).theme, 'dark');
  assert.equal((await env.repos.users.findById(ben.id)).theme, 'auto');
  await assert.rejects(preferences.setTheme(env.repos, anna.id, 'pink'));

  const before = await visibleCategories(env.repos, anna.id, { kind: 'expense' });
  await preferences.setCategoryHidden(env.repos, anna.id, before[0].id, true);
  assert.equal((await visibleCategories(env.repos, anna.id, { kind: 'expense' })).length, before.length - 1);
  assert.equal((await visibleCategories(env.repos, ben.id, { kind: 'expense' })).length, before.length);
  assert.equal((await visibleCategories(env.repos, anna.id, { kind: 'expense', includeHidden: true })).length, before.length);
});

test('Monatsvergleich und Vermögensverlauf', async (t) => {
  const env = await setup();
  t.after(env.cleanup);
  const a = await user(env.repos, 'anna');
  const giro = await account(env.repos, 'Giro', [a.id], { opening_balance_cents: 100000, opening_date: '2026-08-01' });
  const fund = await assets.createAsset(env.repos, a.id, { name: 'ETF', type: 'fund', owner_ids: [a.id], start_value: '500' }, { today: '2026-08-01' });
  await tx.createBooking(env.repos, { userId: a.id }, { type: 'income', date: '2026-09-05', amount: '2000', description: 'Gehalt', account_id: giro.id });
  await tx.createTransfer(env.repos, { userId: a.id }, { date: '2026-09-10', amount: '100', description: 'Sparrate', from: `account:${giro.id}`, to: `asset:${fund.id}` });

  const ctx = await loadContext(env.repos, a.id, { today: '2026-10-15' });
  const series = monthlySeries(ctx, 3, '2026-10-15');
  assert.deepEqual(series.map((m) => `${m.year}-${m.month}`), ['2026-8', '2026-9', '2026-10']);
  assert.equal(series[1].saldo, 200000);
  assert.equal(series[1].savedInAssets, 10000);
  assert.equal(series[0].netWorth.total, 100000 + 50000);
  assert.equal(series[1].netWorth.total, 100000 + 200000 - 10000 + 60000);
  assert.equal(series[2].end, '2026-10-15');
});

test('Veralteter Anlagenstand wird erkannt', async (t) => {
  const env = await setup();
  t.after(env.cleanup);
  const a = await user(env.repos, 'anna');
  const fund = await assets.createAsset(env.repos, a.id, { name: 'Bauspar', type: 'building_savings', owner_ids: [a.id], start_value: '1000' }, { today: '2026-01-01' });
  assert.equal((await loadContext(env.repos, a.id, { today: '2026-06-30' })).assetSummary(fund).stale, false);
  assert.equal((await loadContext(env.repos, a.id, { today: '2026-07-02' })).assetSummary(fund).stale, true);
  assert.equal((await loadContext(env.repos, a.id, { today: '2026-07-02', assetStaleMonths: 12 })).assetSummary(fund).stale, false);
});
