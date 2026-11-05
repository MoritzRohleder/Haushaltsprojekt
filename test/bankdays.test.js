'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { easterSunday, isBankDay, nextBankDay, nonBankDayReason } = require('../src/utils/bankdays');

test('Ostersonntag', () => {
  assert.equal(easterSunday(2024), '2024-03-31');
  assert.equal(easterSunday(2025), '2025-04-20');
  assert.equal(easterSunday(2026), '2026-04-05');
  assert.equal(easterSunday(2027), '2027-03-28');
  assert.equal(easterSunday(2038), '2038-04-25');
});

test('Banktage: Wochenende, bundesweite Feiertage, 24. und 31.12.', () => {
  assert.equal(isBankDay('2026-10-30'), true);           // Freitag
  assert.equal(nonBankDayReason('2026-10-31'), 'Samstag');
  assert.equal(nonBankDayReason('2026-11-01'), 'Sonntag');
  for (const [date, name] of [
    ['2026-01-01', 'Neujahr'], ['2026-04-03', 'Karfreitag'], ['2026-04-06', 'Ostermontag'],
    ['2026-05-01', 'Tag der Arbeit'], ['2026-05-14', 'Christi Himmelfahrt'], ['2026-05-25', 'Pfingstmontag'],
    ['2027-10-04', null], ['2028-10-03', 'Tag der Deutschen Einheit'],
    ['2026-12-24', 'Heiligabend'], ['2026-12-25', '1. Weihnachtstag'], ['2027-12-31', 'Silvester'],
  ]) assert.equal(nonBankDayReason(date), name, date);
  assert.equal(isBankDay('2026-06-04'), true);           // Fronleichnam ist regional → Banktag
});

test('Nächster Banktag', () => {
  assert.equal(nextBankDay('2026-11-02'), '2026-11-02'); // schon Banktag
  assert.equal(nextBankDay('2026-11-01'), '2026-11-02'); // Sonntag → Montag
  assert.equal(nextBankDay('2026-10-31'), '2026-11-02'); // Samstag → Montag
  assert.equal(nextBankDay('2026-12-24'), '2026-12-28'); // Heiligabend bis Sonntag → Montag
  assert.equal(nextBankDay('2026-12-31'), '2027-01-04'); // Silvester, Neujahr (Fr), Wochenende
  assert.equal(nextBankDay('2027-03-26'), '2027-03-30'); // Karfreitag bis Ostermontag
});
