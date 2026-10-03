'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, user, account } = require('./helpers');
const recurring = require('../src/services/recurring');
const assets = require('../src/services/assets');
const tx = require('../src/services/transactions');
const { loadContext } = require('../src/services/overview');
const { accountRecurring, projectedBalances, pendingDates } = require('../src/services/accountForecast');

const TODAY = '2026-10-10';

async function household(t) {
  const env = await setup();
  t.after(env.cleanup);
  const a = await user(env.repos, 'anna');
  const giro = await account(env.repos, 'Giro', [a.id], { opening_balance_cents: 100000 });
  const joint = await account(env.repos, 'Gemeinsam', [a.id], { opening_balance_cents: 50000 });
  const fund = await assets.createAsset(env.repos, a.id, { name: 'ETF', type: 'fund', owner_ids: [a.id], start_value: '0' }, { today: TODAY });
  const cats = await env.repos.categories.findAll();
  const cat = (name) => cats.find((c) => c.name === name).id;
  const add = async (input) => (await recurring.createFromForm(env.repos, a.id, {
    recurring: '1', interval_count: '1', end_date: '', ...input,
  }, TODAY)).recurring;

  // Bereits gebucht (vor heute) und in diesem Monat noch ausstehend gemischt
  await add({ type: 'income', date: '2026-10-28', amount: '3000', description: 'Gehalt', account_id: giro.id, category_id: cat('Gehalt'), interval_unit: 'month' });
  await add({ type: 'expense', date: '2026-10-03', amount: '1000', description: 'Miete', account_id: giro.id, category_id: cat('Wohnen'), interval_unit: 'month' });
  await add({ type: 'expense', date: '2026-10-08', amount: '20', description: 'Markt', account_id: giro.id, category_id: cat('Lebensmittel'), merchant: 'Markt', interval_unit: 'week' });
  await add({ type: 'transfer', date: '2026-10-15', amount: '200', description: 'Sparrate', from: `account:${giro.id}`, to: `asset:${fund.id}`, interval_unit: 'month' });
  await add({ type: 'transfer', date: '2026-10-20', amount: '500', description: 'Haushaltsgeld', from: `account:${giro.id}`, to: `account:${joint.id}`, interval_unit: 'month' });
  await add({ type: 'expense', date: '2027-01-01', amount: '600', description: 'Versicherung', account_id: giro.id, category_id: cat('Versicherungen'), interval_unit: 'year' });
  const paused = await add({ type: 'expense', date: '2026-10-25', amount: '10', description: 'Streaming', account_id: giro.id, category_id: cat('Freizeit'), interval_unit: 'month' });
  await recurring.setActive(env.repos, a.id, paused.id, false, TODAY);

  const forecast = async (acc) => {
    const ctx = await loadContext(env.repos, a.id);
    return accountRecurring(ctx, await recurring.listForUser(env.repos, a.id), acc, { today: TODAY });
  };
  return { ...env, a, giro, joint, fund, forecast };
}

test('Noch ausstehende Termine bis Monatsende', () => {
  const rule = { start_date: '2026-10-08', interval_unit: 'week', interval_count: 1, last_generated_date: '2026-10-08' };
  assert.deepEqual(pendingDates(rule, '2026-10-31'), ['2026-10-15', '2026-10-22', '2026-10-29']);
  assert.deepEqual(pendingDates({ ...rule, end_date: '2026-10-20' }, '2026-10-31'), ['2026-10-15']);
  assert.deepEqual(pendingDates({ ...rule, last_generated_date: '2026-10-29' }, '2026-10-31'), []);
});

test('Konto: alles, was abgeht, ist ein Minus – auch Transfers', async (t) => {
  const h = await household(t);
  const f = await h.forecast(h.giro);
  const byName = Object.fromEntries(f.rows.map((r) => [r.description, r]));
  assert.equal(byName.Gehalt.account_cents, 300000);
  assert.equal(byName.Miete.account_cents, -100000);
  assert.equal(byName.Sparrate.account_cents, -20000);
  assert.equal(byName.Haushaltsgeld.account_cents, -50000);
  assert.equal(byName.Haushaltsgeld.direction, 'out');

  // Pro Monat (nur laufende; Streaming ist pausiert)
  assert.equal(f.summary.monthlyIn, 300000);
  assert.equal(f.summary.monthlyOut, -100000 - 8696 - 20000 - 50000 - 5000);
  assert.equal(f.summary.monthlyNet, f.summary.monthlyIn + f.summary.monthlyOut);

  // Noch in diesem Monat: Gehalt 28.10., Sparrate 15.10., Haushaltsgeld 20.10., Markt 15./22./29.10.
  // Miete (03.10.) und Markt 08.10. sind schon gebucht, Versicherung erst im Januar, Streaming pausiert.
  assert.deepEqual(byName.Markt.pending_dates, ['2026-10-15', '2026-10-22', '2026-10-29']);
  assert.deepEqual(byName.Miete.pending_dates, []);
  assert.deepEqual(byName.Versicherung.pending_dates, []);
  assert.deepEqual(byName.Streaming.pending_dates, []);
  assert.equal(f.summary.pendingIn, 300000);
  assert.equal(f.summary.pendingOut, -20000 - 50000 - 3 * 2000);

  // Gebucht: Anfangssaldo 1.000 − Miete 1.000 − Markt 20 = −20 €
  assert.equal(f.summary.bookedUntilMonthEnd, -2000);
  assert.equal(f.summary.projected, -2000 + 300000 - 76000);
});

test('Gegenkonto sieht den Transfer als Eingang; manuelle Buchung im Monat zählt mit', async (t) => {
  const h = await household(t);
  await tx.createBooking(h.repos, { userId: h.a.id }, { type: 'expense', date: '2026-10-30', amount: '50', description: 'Vorgemerkt', account_id: h.joint.id });
  const f = await h.forecast(h.joint);
  assert.deepEqual(f.rows.map((r) => [r.description, r.direction, r.account_cents]), [['Haushaltsgeld', 'in', 50000]]);
  assert.equal(f.summary.monthlyIn, 50000);
  assert.equal(f.summary.monthlyOut, 0);
  assert.equal(f.summary.bookedUntilMonthEnd, 50000 - 5000);
  assert.equal(f.summary.projected, 50000 - 5000 + 50000);

  const ctx = await loadContext(h.repos, h.a.id);
  const projected = projectedBalances(ctx, await recurring.listForUser(h.repos, h.a.id), [h.giro, h.joint], { today: TODAY });
  assert.equal(projected.get(h.joint.id), 95000);
  assert.equal(projected.get(h.giro.id), 222000);
});
