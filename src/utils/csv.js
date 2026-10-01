'use strict';

/**
 * CSV für Excel/LibreOffice im deutschen Format (F-60):
 * Semikolon als Trenner, Komma als Dezimaltrenner, UTF-8 mit BOM, CRLF.
 */
function cell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  // Formel-Injektion verhindern: Zellen, die wie Formeln beginnen, werden entschärft.
  const safe = /^[=+\-@\t\r]/.test(text) && !/^-?\d+(,\d+)?$/.test(text) ? `'${text}` : text;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function toCsv(header, rows) {
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

/** Cent als Dezimalzahl ohne Tausendertrenner, z. B. -8640 → "-86,40". */
function centsToCsv(cents) {
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

module.exports = { toCsv, centsToCsv, cell };
