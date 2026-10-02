'use strict';

const v = require('../utils/validate');
const { centsToInput } = require('../utils/money');
const { ValidationError, NotFoundError } = require('../utils/errors');
const {
  INTERVAL_UNITS, occurrence, nextOccurrenceAfter, addDays, parts, daysInMonth, isValidDate, today: todayIso,
} = require('../utils/dates');
const {
  prepareBooking, prepareTransfer, createBooking, createTransfer, parseEndpoint,
} = require('./transactions');
const { visibleAccounts, isOwner } = require('./visibility');

/** Wiederkehrende Buchungen (Spec 5.2, 8.4). */

const UNIT_LABELS = {
  day: ['Tag', 'Tage'], week: ['Woche', 'Wochen'], month: ['Monat', 'Monate'], year: ['Jahr', 'Jahre'],
};

const EVERY = { day: 'jeden Tag', week: 'jede Woche', month: 'jeden Monat', year: 'jedes Jahr' };
const pad = (n) => String(n).padStart(2, '0');

/** Rhythmus als Text, z. B. „jeden Monat am 20.“ oder „alle 4 Jahre am 01.10.“. */
function describeInterval(rec) {
  const { interval_count: count, interval_unit: unit } = rec;
  const base = count === 1 ? EVERY[unit] : `alle ${count} ${UNIT_LABELS[unit][1]}`;
  const start = rec.start_date ? parts(rec.start_date) : null;
  if (unit === 'month') return `${base} am ${rec.day_of_month || start?.day}.`;
  if (unit === 'year') {
    return `${base} am ${pad(rec.day_of_month || start?.day)}.${pad(rec.month_of_year || start?.month)}.`;
  }
  return base;
}

const MAX_ITERATIONS = 100000;

function readInt(value, min, max) {
  const text = String(value ?? '').trim();
  if (!/^\d{1,4}$/.test(text)) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
}

/**
 * Rhythmus aus dem Formular lesen. Ohne Angabe von Tag/Monat gelten Tag und
 * Monat von `fallbackDate` (dem Startdatum).
 */
function readInterval(input, errors, fallbackDate) {
  const interval_count = readInt(input.interval_count, 1, 999);
  if (interval_count === null) errors.push('Der Rhythmus muss eine ganze Zahl zwischen 1 und 999 sein.');
  const interval_unit = v.oneOf(input.interval_unit, INTERVAL_UNITS, 'Einheit des Rhythmus', errors);
  const end_date = v.date(input.end_date, 'Enddatum', errors, { required: false });
  const fallback = isValidDate(fallbackDate) ? parts(fallbackDate) : null;

  let day_of_month = null;
  let month_of_year = null;
  if (interval_unit === 'month' || interval_unit === 'year') {
    const dayText = String(input.day_of_month ?? '').trim();
    day_of_month = dayText ? readInt(dayText, 1, 31) : fallback?.day ?? null;
    if (day_of_month === null) errors.push('Der Tag muss zwischen 1 und 31 liegen.');
  }
  if (interval_unit === 'year') {
    const monthText = String(input.month_of_year ?? '').trim();
    month_of_year = monthText ? readInt(monthText, 1, 12) : fallback?.month ?? null;
    if (month_of_year === null) errors.push('Der Monat ist ungültig.');
    // 29.02. ist erlaubt (in anderen Jahren der 28.02.), 31.04. nicht.
    else if (day_of_month !== null && day_of_month > daysInMonth(2028, month_of_year)) {
      errors.push(`Den ${day_of_month}.${pad(month_of_year)}. gibt es nicht.`);
    }
  }
  return { interval_count, interval_unit, day_of_month, month_of_year, end_date };
}

/**
 * Prüft die Rhythmus-Angaben aus dem Buchungsformular, bevor irgendetwas gespeichert wird.
 * Gibt null zurück, wenn „regelmäßig“ nicht angehakt ist.
 */
function readRecurringOptions(input) {
  if (!input.recurring) return null;
  const errors = [];
  const interval = readInterval(input, errors, input.date);
  if (interval.end_date && input.date && interval.end_date < input.date) {
    errors.push('Das Enddatum liegt vor dem ersten Termin.');
  }
  if (input.type === 'transfer' && parseEndpoint(input.from)?.kind === 'asset') {
    errors.push('Regelmäßige Auszahlungen aus einer Anlage werden nicht unterstützt.');
  }
  const hasItems = [].concat(input.item_name ?? []).some((n) => String(n).trim());
  if (hasItems || input.receiptUpload?.size) {
    errors.push('Artikel und Kassenzettel gehören zu einer einzelnen Buchung – bei regelmäßigen Buchungen bitte weglassen.');
  }
  if (errors.length) throw new ValidationError(errors);
  return interval;
}

/**
 * Buchung aus dem Formular anlegen – bei „regelmäßig“ mit Vorlage.
 * Die Vorlage bucht sofort alle Termine ab dem Startdatum bis heute (Spec 8.4).
 */
async function createFromForm(repos, userId, input, today = todayIso()) {
  const actor = { userId };
  const interval = readRecurringOptions(input);
  const create = input.type === 'transfer' ? createTransfer : createBooking;

  if (!interval) return { booking: await create(repos, actor, input), recurring: null };

  // Den ersten Termin vollständig prüfen (auch wenn er in der Zukunft liegt).
  const first = input.type === 'transfer'
    ? (await prepareTransfer(repos, actor, input))[0]
    : await prepareBooking(repos, actor, input);
  const to = parseEndpoint(input.to);

  return repos.transaction(async () => {
    const recurring = await repos.recurring.insert({
      type: input.type,
      account_id: input.type === 'transfer' ? parseEndpoint(input.from).id : first.account_id,
      to_account_id: input.type === 'transfer' && to.kind === 'account' ? to.id : null,
      to_asset_id: input.type === 'transfer' && to.kind === 'asset' ? to.id : null,
      amount_cents: Math.abs(first.amount_cents),
      category_id: first.category_id,
      merchant: first.merchant || '',
      description: first.description,
      note: first.note,
      ...interval,
      start_date: first.date,
      active: true,
      last_generated_date: null,
      created_by: userId,
    });
    await generateFor(repos, recurring, today);
    return { booking: null, recurring };
  });
}

/** Formularwerte für eine Buchung aus der Vorlage. */
function toInput(rec, date) {
  const base = {
    type: rec.type,
    date,
    amount: centsToInput(rec.amount_cents),
    description: rec.description,
    note: rec.note,
    recurring_id: rec.id,
  };
  if (rec.type !== 'transfer') {
    return { ...base, account_id: rec.account_id, category_id: rec.category_id, merchant: rec.merchant || '' };
  }
  return {
    ...base,
    from: `account:${rec.account_id}`,
    to: rec.to_asset_id ? `asset:${rec.to_asset_id}` : `account:${rec.to_account_id}`,
  };
}

/** Bucht alle fälligen Termine einer Vorlage bis einschließlich `today`. */
async function generateFor(repos, rec, today) {
  if (!rec.active) return 0;
  const until = rec.end_date && rec.end_date < today ? rec.end_date : today;
  const actor = { userId: rec.created_by, system: true };
  let created = 0;
  let last = rec.last_generated_date;

  for (let n = 0; n < MAX_ITERATIONS; n++) {
    const date = occurrence(rec, n);
    if (date > until) break;
    if (last && date <= last) continue;
    const create = rec.type === 'transfer' ? createTransfer : createBooking;
    try {
      await create(repos, actor, toInput(rec, date));
    } catch (err) {
      if (err instanceof ValidationError) {
        console.warn(`Regelmäßige Buchung „${rec.description}“ (${date}) übersprungen: ${err.message}`);
        break; // z. B. Konto archiviert – später erneut versuchen
      }
      throw err;
    }
    last = date;
    created++;
  }
  if (last !== rec.last_generated_date) await repos.recurring.update(rec.id, { last_generated_date: last });
  return created;
}

/** Alle aktiven Vorlagen prüfen und fällige Termine buchen (beim Start und täglich). */
async function generateDue(repos, today = todayIso()) {
  let created = 0;
  for (const rec of await repos.recurring.findAll({ active: true })) {
    created += await repos.transaction(() => generateFor(repos, rec, today));
  }
  return created;
}

/** Vorlagen, deren Quell- oder Zielkonto der Nutzer sieht. */
async function listForUser(repos, userId) {
  const ids = new Set((await visibleAccounts(repos, userId)).map((a) => a.id));
  return (await repos.recurring.findAll())
    .filter((r) => ids.has(r.account_id) || ids.has(r.to_account_id))
    .sort((a, b) => a.description.localeCompare(b.description, 'de'));
}

async function getForUser(repos, userId, id) {
  const rec = id ? await repos.recurring.findById(id) : null;
  if (!rec) throw new NotFoundError('Regelmäßige Buchung nicht gefunden');
  const accounts = await Promise.all([rec.account_id, rec.to_account_id].filter(Boolean).map((a) => repos.accounts.findById(a)));
  if (!accounts.some((a) => a && isOwner(a, userId))) throw new NotFoundError('Regelmäßige Buchung nicht gefunden');
  return rec;
}

const RHYTHM_FIELDS = ['interval_count', 'interval_unit', 'day_of_month', 'month_of_year'];

/**
 * Änderungen gelten nur für künftige Termine (F-34). Ändert sich der Rhythmus,
 * gilt der neue ab dem nächsten Termin nach altem Rhythmus – so entsteht im
 * laufenden Monat keine zweite Buchung.
 */
async function updateRecurring(repos, userId, id, input) {
  const rec = await getForUser(repos, userId, id);
  const errors = [];
  const amount_cents = v.positiveAmount(input.amount, 'Betrag', errors);
  const description = v.text(input.description, { label: 'Beschreibung', required: true, max: 120 }, errors);
  const note = v.text(input.note, { label: 'Notiz', max: 500 }, errors);
  const merchant = v.text(input.merchant, { label: 'Geschäft', max: 80 }, errors);
  const interval = readInterval(input, errors, rec.start_date);
  if (errors.length) throw new ValidationError(errors);

  const changes = { amount_cents, description, note, ...interval };
  if (rec.type === 'expense') changes.merchant = merchant;
  const rhythmChanged = RHYTHM_FIELDS.some((f) => (rec[f] ?? null) !== (interval[f] ?? null));
  if (rhythmChanged && rec.last_generated_date) {
    const next = nextOccurrenceAfter({ ...rec, end_date: null }, rec.last_generated_date);
    changes.start_date = next || addDays(rec.last_generated_date, 1);
  }
  return repos.recurring.update(rec.id, changes);
}

/**
 * Pausieren / Fortsetzen. Beim Fortsetzen werden Termine aus der Pause nicht
 * nachgebucht, der heutige Termin aber schon.
 */
async function setActive(repos, userId, id, active, today = todayIso()) {
  const rec = await getForUser(repos, userId, id);
  if (!active) return repos.recurring.update(rec.id, { active: false });
  const yesterday = addDays(today, -1);
  const last = rec.last_generated_date && rec.last_generated_date > yesterday ? rec.last_generated_date : yesterday;
  return repos.transaction(async () => {
    const updated = await repos.recurring.update(rec.id, { active: true, last_generated_date: last });
    await generateFor(repos, updated, today);
    return updated;
  });
}

/** Vorlage löschen; bereits gebuchte Termine bleiben bestehen. */
async function deleteRecurring(repos, userId, id) {
  const rec = await getForUser(repos, userId, id);
  await repos.recurring.remove(rec.id);
}

module.exports = {
  UNIT_LABELS, describeInterval, nextOccurrenceAfter, readRecurringOptions, createFromForm, generateFor, generateDue,
  listForUser, getForUser, updateRecurring, setActive, deleteRecurring,
};
