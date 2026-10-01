'use strict';

const v = require('../utils/validate');
const { centsToInput } = require('../utils/money');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { INTERVAL_UNITS, nthOccurrence, addDays, today: todayIso } = require('../utils/dates');
const {
  prepareBooking, prepareTransfer, createBooking, createTransfer, parseEndpoint,
} = require('./transactions');
const { visibleAccounts, isOwner } = require('./visibility');

/** Wiederkehrende Buchungen (Spec 5.2, 8.4). */

const UNIT_LABELS = {
  day: ['Tag', 'Tage'], week: ['Woche', 'Wochen'], month: ['Monat', 'Monate'], year: ['Jahr', 'Jahre'],
};

function describeInterval(count, unit) {
  const [one, many] = UNIT_LABELS[unit] || [unit, unit];
  return count === 1 ? `jede(n) ${one}` : `alle ${count} ${many}`;
}

const MAX_ITERATIONS = 100000;

function readInterval(input, errors) {
  const interval_count = Number.parseInt(input.interval_count, 10);
  if (!Number.isInteger(interval_count) || interval_count < 1 || interval_count > 999) {
    errors.push('Der Rhythmus muss eine ganze Zahl zwischen 1 und 999 sein.');
  }
  const interval_unit = v.oneOf(input.interval_unit, INTERVAL_UNITS, 'Einheit des Rhythmus', errors);
  const end_date = v.date(input.end_date, 'Enddatum', errors, { required: false });
  return { interval_count, interval_unit, end_date };
}

/**
 * Prüft die Rhythmus-Angaben aus dem Buchungsformular, bevor irgendetwas gespeichert wird.
 * Gibt null zurück, wenn „regelmäßig“ nicht angehakt ist.
 */
function readRecurringOptions(input) {
  if (!input.recurring) return null;
  const errors = [];
  const interval = readInterval(input, errors);
  if (interval.end_date && input.date && interval.end_date < input.date) {
    errors.push('Das Enddatum liegt vor dem ersten Termin.');
  }
  if (input.type === 'transfer' && parseEndpoint(input.from)?.kind === 'asset') {
    errors.push('Regelmäßige Auszahlungen aus einer Anlage werden nicht unterstützt.');
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
  if (rec.type !== 'transfer') return { ...base, account_id: rec.account_id, category_id: rec.category_id };
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
    const date = nthOccurrence(rec.start_date, rec.interval_unit, rec.interval_count, n);
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

/** Änderungen gelten nur für künftige Termine (F-34). */
async function updateRecurring(repos, userId, id, input) {
  const rec = await getForUser(repos, userId, id);
  const errors = [];
  const amount_cents = v.positiveAmount(input.amount, 'Betrag', errors);
  const description = v.text(input.description, { label: 'Beschreibung', required: true, max: 120 }, errors);
  const note = v.text(input.note, { label: 'Notiz', max: 500 }, errors);
  const interval = readInterval(input, errors);
  if (errors.length) throw new ValidationError(errors);
  return repos.recurring.update(rec.id, { amount_cents, description, note, ...interval });
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
  UNIT_LABELS, describeInterval, readRecurringOptions, createFromForm, generateFor, generateDue,
  listForUser, getForUser, updateRecurring, setActive, deleteRecurring,
};
