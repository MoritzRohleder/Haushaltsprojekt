'use strict';

const { parseEuro } = require('./money');
const { isValidDate } = require('./dates');

/** Kleine Helfer für die serverseitige Prüfung von Formularwerten. */

function text(value, { label, required = false, max = 200 }, errors) {
  const result = String(value ?? '').trim();
  if (required && !result) errors.push(`${label} fehlt.`);
  if (result.length > max) errors.push(`${label} darf höchstens ${max} Zeichen lang sein.`);
  return result;
}

function positiveAmount(value, label, errors) {
  const cents = parseEuro(value);
  if (cents === null) errors.push(`${label} ist kein gültiger Betrag (z. B. 12,50).`);
  else if (cents <= 0) errors.push(`${label} muss größer als 0 sein.`);
  return cents;
}

function amount(value, label, errors) {
  const cents = parseEuro(value);
  if (cents === null) errors.push(`${label} ist kein gültiger Betrag (z. B. 12,50).`);
  return cents;
}

/**
 * Betrag mit Vorzeichen-Auswahl (Guthaben/Schulden). Auf Handy-Zahlentastaturen
 * fehlt oft das Minus; daher kann das Vorzeichen auch über `<feld>_sign=minus`
 * gewählt werden. Ein eingetipptes Minus gilt ebenfalls.
 */
function signedAmount(value, sign, label, errors) {
  const cents = amount(value, label, errors);
  if (cents === null) return null;
  return sign === 'minus' ? -Math.abs(cents) : cents;
}

function date(value, label, errors, { required = true } = {}) {
  const result = String(value ?? '').trim();
  if (!result && !required) return null;
  if (!isValidDate(result)) errors.push(`${label} ist kein gültiges Datum.`);
  return result;
}

function oneOf(value, allowed, label, errors) {
  if (!allowed.includes(value)) errors.push(`${label} ist ungültig.`);
  return value;
}

/** Formularfelder mit Mehrfachauswahl kommen als String oder Array an. */
function list(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

module.exports = { text, positiveAmount, amount, signedAmount, date, oneOf, list };
