'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, user, account } = require('./helpers');
const recurring = require('../src/services/recurring');
const tx = require('../src/services/transactions');

const TODAY = '2026-11-19';

async function series(t) {
  const env = await setup();
  t.after(env.cleanup);
  const a = await user(env.repos, 'anna');
  const giro = await account(env.repos, 'Giro', [a.id], { opening_date: '2026-01-01' });
  // Miete jeden Monat am 1., ab 01.08.2026 (Samstag → 03.08.), 01.11.2026 ist ein Sonntag → 02.11.
  const { recurring: rec } = await recurring.createFromForm(env.repos, a.id, {
    type: 'expense', date: '2026-08-01', amount: '1000', description: 'Miete', account_id: giro.id,
    recurring: '1', interval_count: '1', interval_unit: 'month', day_of_month: '1', end_date: '',
  }, TODAY);
  const rows = async () => (await env.repos.transactions.findAll({ recurring_id: rec.id }))
    .sort((x, y) => x.date.localeCompare(y.date));
  const dates = async () => (await rows()).map((r) => r.date);
  const form = (overrides = {}) => ({
    amount: '1000', description: 'Miete', note: '', interval_count: '1', interval_unit: 'month',
    day_of_month: '1', month_of_year: '', end_date: '', start_date: '2026-08-01', ...overrides,
  });
  const update = (overrides) => recurring.updateRecurring(env.repos, a.id, rec.id, form(overrides), TODAY);
  return { ...env, a, giro, rec, rows, dates, update };
}

test('Erzeugte Buchungen merken sich ihren planmäßigen Termin', async (t) => {
  const s = await series(t);
  assert.deepEqual((await s.rows()).map((r) => [r.date, r.recurring_date]), [
    ['2026-08-03', '2026-08-01'], ['2026-09-01', '2026-09-01'], ['2026-10-01', '2026-10-01'], ['2026-11-02', '2026-11-01'],
  ]);
});

test('Startdatum später: Termine davor werden gelöscht', async (t) => {
  const s = await series(t);
  const saved = await s.update({ start_date: '2026-10-01' });
  assert.deepEqual(saved.rebuild, { removed: 2, created: 0, last: '2026-11-01' });
  assert.deepEqual(await s.dates(), ['2026-10-01', '2026-11-02']);
  assert.equal((await s.repos.recurring.findById(s.rec.id)).start_date, '2026-10-01');
  // Keine doppelte Buchung beim nächsten Lauf
  assert.equal(await recurring.generateDue(s.repos, TODAY), 0);
});

test('Startdatum früher: fehlende Termine werden nachgebucht', async (t) => {
  const s = await series(t);
  const saved = await s.update({ start_date: '2026-06-01' });
  assert.equal(saved.rebuild.created, 2);
  assert.deepEqual(await s.dates(), ['2026-06-01', '2026-07-01', '2026-08-03', '2026-09-01', '2026-10-01', '2026-11-02']);
});

test('Einzeln geänderte Buchung bleibt bei der Korrektur erhalten', async (t) => {
  const s = await series(t);
  const sept = (await s.rows()).find((r) => r.date === '2026-09-01');
  // Termin nachträglich einmalig ändern: Datum und Betrag – nur diese Buchung
  await tx.updateTransaction(s.repos, s.a.id, sept.id, { date: '2026-09-03', amount: '1100', description: 'Miete', account_id: s.giro.id });
  const changed = await s.repos.transactions.findById(sept.id);
  assert.equal(changed.recurring_changed, true);
  assert.equal(changed.amount_cents, -110000);
  assert.deepEqual((await s.rows()).filter((r) => r.id !== sept.id).map((r) => r.amount_cents), [-100000, -100000, -100000]);

  await s.update({ start_date: '2026-10-01' });
  assert.deepEqual(await s.dates(), ['2026-09-03', '2026-10-01', '2026-11-02']); // August gelöscht, September bleibt
});

test('Bewusst gelöschter Einzeltermin kommt bei der Korrektur nicht zurück', async (t) => {
  const s = await series(t);
  const oct = (await s.rows()).find((r) => r.date === '2026-10-01');
  await tx.deleteTransaction(s.repos, s.a.id, oct.id);
  await s.update({ start_date: '2026-07-01' });
  assert.deepEqual(await s.dates(), ['2026-07-01', '2026-08-03', '2026-09-01', '2026-11-02']);
});

test('Startdatum in der Zukunft: bisherige Termine weg, gebucht wird ab dem neuen Start', async (t) => {
  const s = await series(t);
  const saved = await s.update({ start_date: '2027-01-01' });
  assert.deepEqual(saved.rebuild, { removed: 4, created: 0, last: null });
  assert.deepEqual(await s.dates(), []);
  assert.equal(await recurring.generateDue(s.repos, '2026-12-31'), 0);
  assert.equal(await recurring.generateDue(s.repos, '2027-01-04'), 1); // 01.01. Neujahr → Montag 04.01.
  assert.deepEqual(await s.dates(), ['2027-01-04']);
});

test('Ältere Buchungen ohne gespeicherten Termin werden über den Rhythmus zugeordnet', async (t) => {
  const s = await series(t);
  for (const r of await s.rows()) await s.repos.transactions.update(r.id, { recurring_date: undefined });
  await s.update({ start_date: '2026-09-01' });
  assert.deepEqual(await s.dates(), ['2026-09-01', '2026-10-01', '2026-11-02']); // 03.08. als Termin 01.08. erkannt und gelöscht
});

test('Ungültiges Startdatum oder Ende vor Start wird abgelehnt', async (t) => {
  const s = await series(t);
  await assert.rejects(s.update({ start_date: 'gestern' }), /Startdatum/);
  await assert.rejects(s.update({ start_date: '2026-10-01', end_date: '2026-09-01' }), /Enddatum liegt vor dem Startdatum/);
  assert.equal((await s.dates()).length, 4); // nichts verändert
});
