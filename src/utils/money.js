'use strict';

const formatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

/**
 * Wandelt eine Euro-Eingabe in Cent um.
 * Akzeptiert z. B. "1234,56", "1.234,56", "1234.56", "12", "12,5".
 * Gibt null zurück, wenn die Eingabe kein gültiger Betrag ist.
 */
function parseEuro(input) {
  if (input === undefined || input === null) return null;
  let text = String(input).replace(/[\s €]/g, '');
  if (text === '') return null;

  let negative = false;
  if (text.startsWith('-') || text.startsWith('−')) {
    negative = true;
    text = text.slice(1);
  }

  const hasComma = text.includes(',');
  const hasDot = text.includes('.');
  let intPart;
  let fracPart = '';

  if (hasComma) {
    // Komma ist Dezimaltrenner, Punkte sind Tausendertrenner.
    const parts = text.split(',');
    if (parts.length !== 2) return null;
    if (hasDot && !/^\d{1,3}(\.\d{3})*$/.test(parts[0])) return null;
    intPart = parts[0].replace(/\./g, '');
    fracPart = parts[1];
  } else if (hasDot) {
    // Nur Punkte: "1.000" und "1.234.567" sind Tausender (deutsche Schreibweise),
    // "1234.56" oder "12.5" ist ein Dezimalpunkt.
    if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
      intPart = text.replace(/\./g, '');
    } else {
      const parts = text.split('.');
      if (parts.length !== 2) return null;
      intPart = parts[0];
      fracPart = parts[1];
    }
  } else {
    intPart = text;
  }

  if (intPart === '') intPart = '0';
  if (!/^\d+$/.test(intPart) || !/^\d{0,2}$/.test(fracPart)) return null;

  const cents = Number(intPart) * 100 + Number(fracPart.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

/** Formatiert Cent als Euro-Betrag, z. B. 123456 → "1.234,56 €". */
function formatEuro(cents, { sign = false } = {}) {
  const text = formatter.format(Math.abs(cents) / 100);
  if (cents < 0) return '−' + text;
  if (sign && cents > 0) return '+' + text;
  return text;
}

/** Cent als Eingabewert für Formulare, z. B. 123456 → "1234,56". */
function centsToInput(cents) {
  if (cents === null || cents === undefined) return '';
  const abs = Math.abs(cents);
  const text = Math.floor(abs / 100) + ',' + String(abs % 100).padStart(2, '0');
  return cents < 0 ? '-' + text : text;
}

module.exports = { parseEuro, formatEuro, centsToInput };
