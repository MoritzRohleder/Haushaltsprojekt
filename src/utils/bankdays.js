'use strict';

const { parts, toIso, addDays } = require('./dates');

/**
 * Bankarbeitstage wie bei Sparkassen und Volksbanken (Spec 6.9): alle Werktage außer
 * Samstag, den bundesweiten gesetzlichen Feiertagen sowie dem 24. und 31. Dezember.
 * Regionale Feiertage (z. B. Fronleichnam) zählen nicht, da sie je Bundesland abweichen.
 */

/** Ostersonntag nach dem gregorianischen Kalender (Algorithmus von Meeus/Jones/Butcher). */
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toIso(year, month, day);
}

const cache = new Map();

/** Bankfeiertage eines Jahres als Map Datum → Name. */
function bankHolidays(year) {
  if (cache.has(year)) return cache.get(year);
  const easter = easterSunday(year);
  const holidays = new Map([
    [toIso(year, 1, 1), 'Neujahr'],
    [addDays(easter, -2), 'Karfreitag'],
    [addDays(easter, 1), 'Ostermontag'],
    [toIso(year, 5, 1), 'Tag der Arbeit'],
    [addDays(easter, 39), 'Christi Himmelfahrt'],
    [addDays(easter, 50), 'Pfingstmontag'],
    [toIso(year, 10, 3), 'Tag der Deutschen Einheit'],
    [toIso(year, 12, 24), 'Heiligabend'],
    [toIso(year, 12, 25), '1. Weihnachtstag'],
    [toIso(year, 12, 26), '2. Weihnachtstag'],
    [toIso(year, 12, 31), 'Silvester'],
  ]);
  cache.set(year, holidays);
  return holidays;
}

/** Wochentag 0 = Sonntag … 6 = Samstag (unabhängig von der Zeitzone). */
function weekday(date) {
  const { year, month, day } = parts(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function isBankDay(date) {
  const wd = weekday(date);
  if (wd === 0 || wd === 6) return false;
  return !bankHolidays(parts(date).year).has(date);
}

/** Das Datum selbst, wenn es ein Banktag ist, sonst der nächste Banktag. */
function nextBankDay(date) {
  let d = date;
  while (!isBankDay(d)) d = addDays(d, 1);
  return d;
}

/** Grund, warum ein Datum kein Banktag ist (für Hinweise), sonst null. */
function nonBankDayReason(date) {
  const wd = weekday(date);
  if (wd === 6) return 'Samstag';
  if (wd === 0) return 'Sonntag';
  return bankHolidays(parts(date).year).get(date) ?? null;
}

module.exports = { easterSunday, bankHolidays, isBankDay, nextBankDay, nonBankDayReason, weekday };
