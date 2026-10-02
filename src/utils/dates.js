'use strict';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n) => String(n).padStart(2, '0');

function isValidDate(text) {
  const m = ISO_DATE.exec(text || '');
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

function parts(text) {
  const m = ISO_DATE.exec(text);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

function toIso(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Heutiges Datum in der lokalen Zeitzone des Servers als "JJJJ-MM-TT". */
function today(now = new Date()) {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function addDays(date, days) {
  const { year, month, day } = parts(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Monate addieren; ein Tag, den der Zielmonat nicht hat, wird auf den Monatsletzten gesetzt. */
function addMonths(date, months) {
  const { year, month, day } = parts(date);
  const index = year * 12 + (month - 1) + months;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return toIso(y, m, Math.min(day, daysInMonth(y, m)));
}

const INTERVAL_UNITS = ['day', 'week', 'month', 'year'];

/** n-ter Termin ab Startdatum (n = 0 ist der Start selbst). */
function nthOccurrence(startDate, unit, count, n) {
  switch (unit) {
    case 'day': return addDays(startDate, n * count);
    case 'week': return addDays(startDate, n * count * 7);
    case 'month': return addMonths(startDate, n * count);
    case 'year': return addMonths(startDate, n * count * 12);
    default: throw new Error(`Unbekannte Intervall-Einheit: ${unit}`);
  }
}

/** Datum mit Tag, der auf den Monatsletzten begrenzt wird (31. → 28./29./30.). */
function clampedDate(year, month, day) {
  return toIso(year, month, Math.min(day, daysInMonth(year, month)));
}

/**
 * Termine einer regelmäßigen Buchung (Spec 5.2, „Wiederkehrende Buchung“).
 *
 * rule: { start_date, interval_unit, interval_count, day_of_month?, month_of_year? }
 * - Monat: Termin am `day_of_month` (fehlt er, gilt der Tag des Startdatums).
 * - Jahr: Termin am `day_of_month`.`month_of_year` (fehlen sie, gilt das Startdatum).
 * - Tag/Woche: ab dem Startdatum.
 * Der erste Termin ist das früheste passende Datum ≥ start_date. Der n-te Termin wird
 * immer vom ersten aus berechnet, damit sich nichts verschiebt.
 */
function occurrence(rule, n) {
  const start = parts(rule.start_date);
  const count = rule.interval_count;

  if (rule.interval_unit === 'month') {
    const day = rule.day_of_month || start.day;
    let index = start.year * 12 + (start.month - 1);
    if (clampedDate(start.year, start.month, day) < rule.start_date) index += 1;
    index += n * count;
    return clampedDate(Math.floor(index / 12), (index % 12) + 1, day);
  }

  if (rule.interval_unit === 'year') {
    const day = rule.day_of_month || start.day;
    const month = rule.month_of_year || start.month;
    let year = start.year;
    if (clampedDate(year, month, day) < rule.start_date) year += 1;
    return clampedDate(year + n * count, month, day);
  }

  return nthOccurrence(rule.start_date, rule.interval_unit, count, n);
}

/** Erster Termin einer Regel, der nach `afterDate` liegt (oder null, wenn die Regel endet). */
function nextOccurrenceAfter(rule, afterDate, maxIterations = 100000) {
  for (let n = 0; n < maxIterations; n++) {
    const date = occurrence(rule, n);
    if (rule.end_date && date > rule.end_date) return null;
    if (!afterDate || date > afterDate) return date;
  }
  return null;
}

function monthRange(year, month) {
  return { from: toIso(year, month, 1), to: toIso(year, month, daysInMonth(year, month)) };
}

function formatDate(date) {
  if (!date) return '';
  const { year, month, day } = parts(date);
  return `${pad(day)}.${pad(month)}.${year}`;
}

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
  'August', 'September', 'Oktober', 'November', 'Dezember'];

function formatMonth(year, month) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

module.exports = {
  isValidDate, parts, toIso, daysInMonth, today, addDays, addMonths,
  INTERVAL_UNITS, nthOccurrence, clampedDate, occurrence, nextOccurrenceAfter, monthRange, formatDate, formatMonth,
  MONTH_NAMES,
};
