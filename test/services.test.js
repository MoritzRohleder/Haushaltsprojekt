'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, user, account } = require('./helpers');
const tx = require('../src/services/transactions');
const assets = require('../src/services/assets');
const recurring = require('../src/services/recurring');
const { loadContext, totals, monthlySummary } = require('../src/services/overview');
const { ValidationError, NotFoundError } = require('../src/utils/errors');

/** Kurz warten, damit Erfassungszeitpunkte (created_at, ms) sicher verschieden sind. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 3));

/** Haushalt aus dem Beispiel in Spec Kapitel 4. */
async function household(t) {
  const env = await setup();
  t.after(env.cleanup);
  const a = await user(env.repos, 'anna');
  const b = await user(env.repos, 'ben');
  const giroA = await account(env.repos, 'Giro A', [a.id], { opening_balance_cents: 100000 });
  const giroB = await account(env.repos, 'Giro B', [b.id], { opening_balance_cents: 50000 });
  const shared = await account(env.repos, 'Gemeinsam', [a.id, b.id]);
  return { ...env, a, b, giroA, giroB, shared };
}

test('Beispiel Spec Kap. 4: A sieht einen Transfer, B nur eine Einnahme', async (t) => {
  const h = await household(t);
  await tx.createTransfer(h.repos, { userId: h.a.id }, {
    date: '2026-10-01', amount: '500', description: 'Haushaltsgeld',
    from: `account:${h.giroA.id}`, to: `account:${h.shared.id}`,
  });

  const rows = await h.repos.transactions.findAll();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].transfer_id, rows[1].transfer_id);
  assert.deepEqual(rows.map((r) => r.amount_cents).sort((x, y) => x - y), [-50000, 50000]);

  const ctxA = await loadContext(h.repos, h.a.id);
  const monthA = monthlySummary(ctxA, 2026, 10);
  assert.equal(monthA.income, 0);
  assert.equal(monthA.expense, 0);
  assert.equal(monthA.transfers.length, 1);
  assert.equal(totals(ctxA).netWorth, 100000);

  const ctxB = await loadContext(h.repos, h.b.id);
  const monthB = monthlySummary(ctxB, 2026, 10);
  assert.equal(ctxB.rows.length, 1);
  assert.equal(monthB.income, 50000);
  assert.equal(monthB.transfers.length, 0);
  assert.deepEqual(monthB.incomeByCategory, [{ name: 'Überträge', sum: 50000 }]);
  assert.equal(ctxB.label(ctxB.rows[0]), 'Übertrag von Giro A');
  assert.equal(totals(ctxB).netWorth, 50000 + 50000);
});

test('Transfers nur zwischen selbst sichtbaren Konten (S-05)', async (t) => {
  const h = await household(t);
  await assert.rejects(tx.createTransfer(h.repos, { userId: h.b.id }, {
    date: '2026-10-02', amount: '200', description: 'An Anna',
    from: `account:${h.giroB.id}`, to: `account:${h.giroA.id}`,
  }), ValidationError);
});

test('Transfer ändern und löschen betrifft beide Hälften (S-06)', async (t) => {
  const h = await household(t);
  const out = await tx.createTransfer(h.repos, { userId: h.a.id }, {
    date: '2026-10-01', amount: '500', description: 'Haushaltsgeld',
    from: `account:${h.giroA.id}`, to: `account:${h.shared.id}`,
  });
  const incoming = (await h.repos.transactions.findAll()).find((r) => r.id !== out.id);

  // B sieht nur die eingehende Hälfte und darf sie trotzdem ändern.
  await tx.updateTransaction(h.repos, h.b.id, incoming.id, { date: '2026-10-03', amount: '450', description: 'Korrigiert' });
  const rows = await h.repos.transactions.findAll();
  assert.ok(rows.every((r) => r.date === '2026-10-03' && Math.abs(r.amount_cents) === 45000));

  await assert.rejects(tx.deleteTransaction(h.repos, h.b.id, out.id), NotFoundError); // Giro A sieht B nicht
  await tx.deleteTransaction(h.repos, h.b.id, incoming.id);
  assert.equal((await h.repos.transactions.findAll()).length, 0);
});

test('Buchungen werden geprüft', async (t) => {
  const h = await household(t);
  const base = { type: 'expense', date: '2026-10-05', amount: '10', description: 'Test', account_id: h.giroA.id };
  await assert.rejects(tx.createBooking(h.repos, { userId: h.b.id }, base), ValidationError); // fremdes Konto
  await assert.rejects(tx.createBooking(h.repos, { userId: h.a.id }, { ...base, date: '2025-12-31' }), /Stichtag/);
  await assert.rejects(tx.createBooking(h.repos, { userId: h.a.id }, { ...base, amount: '0' }), /größer als 0/);
  const income = (await h.repos.categories.findAll({ kind: 'income' }))[0];
  await assert.rejects(tx.createBooking(h.repos, { userId: h.a.id }, { ...base, category_id: income.id }), /Kategorie/);
  const ok = await tx.createBooking(h.repos, { userId: h.a.id }, base);
  assert.equal(ok.amount_cents, -1000);
});

test('Anlagenwert: Einzahlungen auf letzten manuellen Stand, Korrektur sichtbar (Spec 6.3)', async (t) => {
  const h = await household(t);
  const fund = await assets.createAsset(h.repos, h.a.id, {
    name: 'ETF', type: 'fund', owner_ids: [h.a.id], start_value: '10000', 
  }, { today: '2026-09-01' });
  const deposit = (date) => tx.createTransfer(h.repos, { userId: h.a.id }, {
    date, amount: '200', description: 'Sparrate', from: `account:${h.giroA.id}`, to: `asset:${fund.id}`,
  });
  await deposit('2026-09-15');
  await deposit('2026-10-15');
  let ctx = await loadContext(h.repos, h.a.id);
  assert.equal(ctx.assetSummary(fund).value_cents, 1040000);

  await assets.addValue(h.repos, h.a.id, fund.id, { value: '10350' }, { today: '2026-10-20' });
  await deposit('2026-11-15');
  ctx = await loadContext(h.repos, h.a.id);
  const summary = ctx.assetSummary(fund);
  assert.equal(summary.value_cents, 1055000);
  assert.equal(summary.last_manual_date, '2026-10-20');
  assert.equal(summary.last_manual_correction_cents, -5000);

  // Sparrate ist für A ein Transfer: nicht in der Bilanz, aber „In Anlagen gespart“.
  const month = monthlySummary(ctx, 2026, 11);
  assert.equal(month.expense, 0);
  assert.equal(month.savedInAssets, 20000);
  assert.equal(totals(ctx).netWorth, 100000 - 60000 + 1055000);
});

test('Einzahlung am selben Tag wie ein manueller Stand ist darin enthalten', async (t) => {
  const h = await household(t);
  const fund = await assets.createAsset(h.repos, h.a.id, {
    name: 'Bauspar', type: 'building_savings', owner_ids: [h.a.id], start_value: '1000', 
  }, { today: '2026-01-01' });
  await tx.createTransfer(h.repos, { userId: h.a.id }, {
    date: '2026-02-01', amount: '100', description: 'Rate', from: `account:${h.giroA.id}`, to: `asset:${fund.id}`,
  });
  await tick();
  await assets.addValue(h.repos, h.a.id, fund.id, { value: '1105' }, { today: '2026-02-01' });
  const ctx = await loadContext(h.repos, h.a.id);
  assert.equal(ctx.assetSummary(fund).value_cents, 110500);
  assert.equal(ctx.assetSummary(fund).last_manual_correction_cents, 500);
});

test('Einzahlung am selben Tag, aber nach dem Stand erfasst, wird aufaddiert (neue Anlage, heute)', async (t) => {
  const h = await household(t);
  const fund = await assets.createAsset(h.repos, h.a.id, {
    name: 'Bauspar', type: 'building_savings', owner_ids: [h.a.id],
    start_value: '5.000,00', start_value_sign: 'minus', 
  }, { today: '2026-10-01' });
  let ctx = await loadContext(h.repos, h.a.id);
  assert.equal(ctx.assetSummary(fund).value_cents, -500000);
  const before = totals(ctx);
  await tick();

  await tx.createTransfer(h.repos, { userId: h.a.id }, {
    date: '2026-10-01', amount: '200', description: 'Rate', from: `account:${h.giroA.id}`, to: `asset:${fund.id}`,
  });
  ctx = await loadContext(h.repos, h.a.id);
  const after = totals(ctx);
  assert.equal(ctx.assetSummary(fund).value_cents, -480000);
  assert.equal(after.accountsTotal, before.accountsTotal - 20000);
  assert.equal(after.assetsTotal, before.assetsTotal + 20000);
  assert.equal(after.netWorth, before.netWorth);
});

test('Manueller Stand gilt für jetzt: vorher Erfasstes ist enthalten, später Erfasstes kommt dazu', async (t) => {
  const h = await household(t);
  const fund = await assets.createAsset(h.repos, h.a.id, {
    name: 'ETF', type: 'fund', owner_ids: [h.a.id], start_value: '1000',
  }, { today: '2026-09-01' });
  const deposit = (date) => tx.createTransfer(h.repos, { userId: h.a.id }, {
    date, amount: '100', description: 'Rate', from: `account:${h.giroA.id}`, to: `asset:${fund.id}`,
  });
  await deposit('2026-09-15');
  await deposit('2026-10-05');
  await tick();
  // Am 15.10. wird der aktuelle Stand eingetragen: er enthält beide Einzahlungen
  await assets.addValue(h.repos, h.a.id, fund.id, { value: '1250' }, { today: '2026-10-15' });
  await tick();
  let ctx = await loadContext(h.repos, h.a.id);
  assert.equal(ctx.assetSummary(fund).value_cents, 125000);
  assert.equal(ctx.assetSummary(fund).last_manual_correction_cents, 5000);
  // Danach erfasst: rückdatiert (vor dem Stand) zählt nicht, heute und später schon
  await deposit('2026-10-10');
  await deposit('2026-10-15');
  await deposit('2026-11-15');
  ctx = await loadContext(h.repos, h.a.id);
  assert.equal(ctx.assetSummary(fund).value_cents, 125000 + 20000);
});

test('Negative Werte über Vorzeichen-Auswahl oder Minus', async (t) => {
  const h = await household(t);
  const fund = await assets.createAsset(h.repos, h.a.id, {
    name: 'Darlehen', type: 'building_savings', owner_ids: [h.a.id], start_value: '-1.000', 
  }, { today: '2026-01-01' });
  await assets.addValue(h.repos, h.a.id, fund.id, { value: '900', value_sign: 'minus' }, { today: '2026-02-01' });
  const ctx = await loadContext(h.repos, h.a.id);
  assert.equal(ctx.assetSummary(fund).value_cents, -90000);
  assert.equal(ctx.assetSummary(fund).last_manual_correction_cents, 10000);
});

test('Kontrollrechnung Spec 6.5: Veränderung Konten = Saldo − In Anlagen gespart', async (t) => {
  const h = await household(t);
  const fund = await assets.createAsset(h.repos, h.a.id, {
    name: 'ETF', type: 'fund', owner_ids: [h.a.id], start_value: '0', 
  }, { today: '2026-01-01' });
  const actor = { userId: h.a.id };
  const expenseCat = (await h.repos.categories.findAll({ kind: 'expense' }))[0];
  await tx.createBooking(h.repos, actor, { type: 'income', date: '2026-10-01', amount: '3000', description: 'Gehalt', account_id: h.giroA.id });
  await tx.createBooking(h.repos, actor, { type: 'expense', date: '2026-10-02', amount: '86,40', description: 'Einkauf', account_id: h.shared.id, category_id: expenseCat.id });
  await tx.createTransfer(h.repos, actor, { date: '2026-10-03', amount: '500', description: 'Umbuchung', from: `account:${h.giroA.id}`, to: `account:${h.shared.id}` });
  await tx.createTransfer(h.repos, actor, { date: '2026-10-04', amount: '200', description: 'Sparrate', from: `account:${h.giroA.id}`, to: `asset:${fund.id}` });
  // B bucht vom Gemeinschaftskonto auf sein Privatkonto: für A eine Ausgabe.
  await tx.createTransfer(h.repos, { userId: h.b.id }, { date: '2026-10-05', amount: '50', description: 'Taschengeld', from: `account:${h.shared.id}`, to: `account:${h.giroB.id}` });

  const ctx = await loadContext(h.repos, h.a.id);
  const m = monthlySummary(ctx, 2026, 10);
  const before = ctx.accounts.reduce((s, a) => s + ctx.balance(a, '2026-09-30'), 0);
  const after = ctx.accounts.reduce((s, a) => s + ctx.balance(a, '2026-10-31'), 0);
  assert.equal(m.income, 300000);
  assert.equal(m.expense, -8640 - 5000);
  assert.equal(m.savedInAssets, 20000);
  assert.equal(after - before, m.saldo - m.savedInAssets);
});

test('Regelmäßige Buchung: sofort und rückwirkend gebucht, dann täglich', async (t) => {
  const h = await household(t);
  const { recurring: rec } = await recurring.createFromForm(h.repos, h.a.id, {
    type: 'expense', date: '2026-07-31', amount: '9,99', description: 'Streaming', account_id: h.giroA.id,
    recurring: '1', interval_count: '1', interval_unit: 'month', end_date: '',
  }, '2026-10-01');
  let rows = await h.repos.transactions.findAll({ recurring_id: rec.id });
  assert.deepEqual(rows.map((r) => r.date).sort(), ['2026-07-31', '2026-08-31', '2026-09-30']);

  assert.equal(await recurring.generateDue(h.repos, '2026-10-30'), 0);
  assert.equal(await recurring.generateDue(h.repos, '2026-10-31'), 1);
  assert.equal(await recurring.generateDue(h.repos, '2026-10-31'), 0); // nicht doppelt

  // Gelöschte Einzelbuchung wird nicht neu erzeugt.
  rows = await h.repos.transactions.findAll({ recurring_id: rec.id });
  await tx.deleteTransaction(h.repos, h.a.id, rows.find((r) => r.date === '2026-08-31').id);
  assert.equal(await recurring.generateDue(h.repos, '2026-10-31'), 0);
  assert.equal((await h.repos.transactions.findAll({ recurring_id: rec.id })).length, 3);
});

test('Regelmäßige Buchung in der Zukunft bucht noch nichts; Enddatum wird beachtet', async (t) => {
  const h = await household(t);
  const { recurring: rec } = await recurring.createFromForm(h.repos, h.a.id, {
    type: 'transfer', date: '2026-10-15', amount: '200', description: 'Sparrate',
    from: `account:${h.giroA.id}`, to: `account:${h.shared.id}`,
    recurring: '1', interval_count: '20', interval_unit: 'day', end_date: '2026-11-30',
  }, '2026-10-01');
  assert.equal((await h.repos.transactions.findAll()).length, 0);
  await recurring.generateDue(h.repos, '2027-01-01');
  const dates = [...new Set((await h.repos.transactions.findAll({ recurring_id: rec.id })).map((r) => r.date))].sort();
  assert.deepEqual(dates, ['2026-10-15', '2026-11-04', '2026-11-24']);
  assert.equal((await h.repos.transactions.findAll()).length, 6); // je Termin zwei Hälften
});

test('Pausieren und Fortsetzen: keine Nachbuchung der Pause', async (t) => {
  const h = await household(t);
  const { recurring: rec } = await recurring.createFromForm(h.repos, h.a.id, {
    type: 'income', date: '2026-01-01', amount: '100', description: 'Miete Garage', account_id: h.giroA.id,
    recurring: '1', interval_count: '1', interval_unit: 'month',
  }, '2026-01-15');
  await recurring.setActive(h.repos, h.a.id, rec.id, false, '2026-01-20');
  await recurring.generateDue(h.repos, '2026-05-10');
  await recurring.setActive(h.repos, h.a.id, rec.id, true, '2026-06-01');
  const dates = (await h.repos.transactions.findAll({ recurring_id: rec.id })).map((r) => r.date).sort();
  assert.deepEqual(dates, ['2026-01-01', '2026-06-01']);
});

test('Ungültige Rhythmus-Angaben speichern nichts', async (t) => {
  const h = await household(t);
  await assert.rejects(recurring.createFromForm(h.repos, h.a.id, {
    type: 'expense', date: '2026-10-01', amount: '5', description: 'X', account_id: h.giroA.id,
    recurring: '1', interval_count: '0', interval_unit: 'month',
  }), ValidationError);
  assert.equal((await h.repos.transactions.findAll()).length, 0);
  assert.equal((await h.repos.recurring.findAll()).length, 0);
});

test('Regelmäßig am 20. des Monats bzw. jährlich am 01.10.', async (t) => {
  const h = await household(t);
  const { recurring: monthly } = await recurring.createFromForm(h.repos, h.a.id, {
    type: 'expense', date: '2026-09-01', amount: '50', description: 'Verein', account_id: h.giroA.id,
    recurring: '1', interval_count: '1', interval_unit: 'month', day_of_month: '20',
  }, '2026-10-25');
  assert.equal(recurring.describeInterval(monthly), 'jeden Monat am 20.');
  assert.deepEqual((await h.repos.transactions.findAll({ recurring_id: monthly.id })).map((r) => r.date).sort(),
    ['2026-09-20', '2026-10-20']);

  const { recurring: yearly } = await recurring.createFromForm(h.repos, h.a.id, {
    type: 'expense', date: '2026-01-01', amount: '120', description: 'Kfz-Versicherung', account_id: h.giroA.id,
    recurring: '1', interval_count: '1', interval_unit: 'year', day_of_month: '1', month_of_year: '10',
  }, '2026-10-25');
  assert.equal(recurring.describeInterval(yearly), 'jedes Jahr am 01.10.');
  assert.deepEqual((await h.repos.transactions.findAll({ recurring_id: yearly.id })).map((r) => r.date), ['2026-10-01']);
});

test('Ungültiger Tag/Monat wird abgelehnt', async (t) => {
  const h = await household(t);
  const base = {
    type: 'expense', date: '2026-01-01', amount: '1', description: 'X', account_id: h.giroA.id,
    recurring: '1', interval_count: '1',
  };
  await assert.rejects(recurring.createFromForm(h.repos, h.a.id, { ...base, interval_unit: 'year', day_of_month: '31', month_of_year: '4' }), /31\.04\./);
  await assert.rejects(recurring.createFromForm(h.repos, h.a.id, { ...base, interval_unit: 'month', day_of_month: '32' }), /Tag/);
  await recurring.createFromForm(h.repos, h.a.id, { ...base, interval_unit: 'year', day_of_month: '29', month_of_year: '2' }, '2026-01-02');
});

test('Rhythmus ändern gilt ab dem nächsten Termin – keine doppelte Buchung im Monat', async (t) => {
  const h = await household(t);
  const { recurring: rec } = await recurring.createFromForm(h.repos, h.a.id, {
    type: 'expense', date: '2026-10-05', amount: '30', description: 'Handy', account_id: h.giroA.id,
    recurring: '1', interval_count: '1', interval_unit: 'month', day_of_month: '5',
  }, '2026-10-10');
  await recurring.updateRecurring(h.repos, h.a.id, rec.id, {
    amount: '30', description: 'Handy', interval_count: '1', interval_unit: 'month', day_of_month: '20',
  });
  await recurring.generateDue(h.repos, '2026-11-25');
  const dates = (await h.repos.transactions.findAll({ recurring_id: rec.id })).map((r) => r.date).sort();
  assert.deepEqual(dates, ['2026-10-05', '2026-11-20']);
});
