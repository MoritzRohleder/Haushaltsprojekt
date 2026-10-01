'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseEuro, formatEuro, centsToInput } = require('../src/utils/money');

test('parseEuro akzeptiert die Formate aus Spec 6.6', () => {
  assert.equal(parseEuro('1234,56'), 123456);
  assert.equal(parseEuro('1.234,56'), 123456);
  assert.equal(parseEuro('1234.56'), 123456);
  assert.equal(parseEuro('12'), 1200);
  assert.equal(parseEuro('12,5'), 1250);
  assert.equal(parseEuro(' 7,05 € '), 705);
  assert.equal(parseEuro('1.234.567'), 123456700);
  assert.equal(parseEuro('1.000'), 100000);
  assert.equal(parseEuro('-1.500'), -150000);
  assert.equal(parseEuro('12.5'), 1250);
  assert.equal(parseEuro('-3,10'), -310);
  assert.equal(parseEuro('0,1'), 10);
});

test('parseEuro lehnt ungültige Eingaben ab', () => {
  for (const bad of ['', 'abc', '1,234,5', '1,999', '12.345,6.7', '1.23.4', null, undefined]) {
    assert.equal(parseEuro(bad), null, String(bad));
  }
});

test('formatEuro zeigt Euro, nie Cent', () => {
  assert.equal(formatEuro(123456).replace(/\s/g, ' '), '1.234,56 €');
  assert.equal(formatEuro(-8640).replace(/\s/g, ' '), '−86,40 €');
  assert.equal(formatEuro(500, { sign: true }).replace(/\s/g, ' '), '+5,00 €');
  assert.equal(formatEuro(0, { sign: true }).replace(/\s/g, ' '), '0,00 €');
});

test('centsToInput erzeugt Formularwerte', () => {
  assert.equal(centsToInput(123456), '1234,56');
  assert.equal(centsToInput(5), '0,05');
  assert.equal(centsToInput(-100), '-1,00');
  assert.equal(parseEuro(centsToInput(98765)), 98765);
});
