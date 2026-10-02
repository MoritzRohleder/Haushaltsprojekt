'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const d = require('../src/utils/dates');

test('Monate addieren setzt fehlende Tage auf den Monatsletzten', () => {
  assert.equal(d.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(d.addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(d.addMonths('2026-12-15', 1), '2027-01-15');
  assert.equal(d.addMonths('2026-03-15', -3), '2025-12-15');
});

test('Termine werden immer vom Start aus berechnet (kein Verschieben)', () => {
  const dates = [0, 1, 2, 3].map((n) => d.nthOccurrence('2026-01-31', 'month', 1, n));
  assert.deepEqual(dates, ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
});

test('Rhythmus aus Anzahl und Einheit', () => {
  assert.equal(d.nthOccurrence('2026-01-01', 'day', 20, 1), '2026-01-21');
  assert.equal(d.nthOccurrence('2026-01-01', 'week', 2, 2), '2026-01-29');
  assert.equal(d.nthOccurrence('2026-01-15', 'month', 3, 1), '2026-04-15');
  assert.equal(d.nthOccurrence('2024-02-29', 'year', 4, 1), '2028-02-29');
  assert.equal(d.nthOccurrence('2024-02-29', 'year', 1, 1), '2025-02-28');
});

test('Datumsprüfung und Formatierung', () => {
  assert.equal(d.isValidDate('2026-02-29'), false);
  assert.equal(d.isValidDate('2028-02-29'), true);
  assert.equal(d.isValidDate('01.10.2026'), false);
  assert.equal(d.formatDate('2026-10-01'), '01.10.2026');
  assert.deepEqual(d.monthRange(2026, 2), { from: '2026-02-01', to: '2026-02-28' });
});

test('Monatlich an festem Tag: erster Termin ist der erste passende Tag ab Startdatum', () => {
  const rule = { start_date: '2026-10-25', interval_unit: 'month', interval_count: 1, day_of_month: 20 };
  assert.deepEqual([0, 1, 2].map((n) => d.occurrence(rule, n)), ['2026-11-20', '2026-12-20', '2027-01-20']);
  assert.equal(d.occurrence({ ...rule, start_date: '2026-10-20' }, 0), '2026-10-20');
  assert.deepEqual([0, 1].map((n) => d.occurrence({ ...rule, interval_count: 3 }, n)), ['2026-11-20', '2027-02-20']);
});

test('Monatlich am 31.: in kürzeren Monaten der Monatsletzte, danach wieder der 31.', () => {
  const rule = { start_date: '2026-11-01', interval_unit: 'month', interval_count: 1, day_of_month: 31 };
  assert.deepEqual([0, 1, 2, 3].map((n) => d.occurrence(rule, n)), ['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28']);
});

test('Jährlich an festem Tag und Monat', () => {
  const rule = { start_date: '2026-10-25', interval_unit: 'year', interval_count: 1, day_of_month: 1, month_of_year: 10 };
  assert.deepEqual([0, 1].map((n) => d.occurrence(rule, n)), ['2027-10-01', '2028-10-01']);
  assert.equal(d.occurrence({ ...rule, start_date: '2026-01-01' }, 0), '2026-10-01');
  const leap = { start_date: '2026-01-01', interval_unit: 'year', interval_count: 1, day_of_month: 29, month_of_year: 2 };
  assert.deepEqual([0, 1, 2].map((n) => d.occurrence(leap, n)), ['2026-02-28', '2027-02-28', '2028-02-29']);
});

test('Ohne festen Tag gilt das Startdatum (bisheriges Verhalten)', () => {
  const rule = { start_date: '2026-01-31', interval_unit: 'month', interval_count: 1 };
  assert.deepEqual([0, 1, 2].map((n) => d.occurrence(rule, n)), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.equal(d.nextOccurrenceAfter(rule, '2026-02-28'), '2026-03-31');
  assert.equal(d.nextOccurrenceAfter({ ...rule, end_date: '2026-03-30' }, '2026-02-28'), null);
});
