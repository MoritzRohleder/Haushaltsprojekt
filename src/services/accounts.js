'use strict';

const v = require('../utils/validate');
const { ValidationError } = require('../utils/errors');
const { getVisibleAccount } = require('./visibility');

const ACCOUNT_TYPES = {
  giro: 'Girokonto',
  savings: 'Sparkonto',
  cash: 'Bargeld',
  prepaid: 'Prepaid-Karte',
  other: 'Sonstiges',
};

/** Inhaber prüfen: mindestens einer, alle müssen registrierte Nutzer sein (S-03, S-04). */
async function checkOwners(repos, ownerIds, errors) {
  const ids = [...new Set(v.list(ownerIds))];
  if (ids.length === 0) errors.push('Es muss mindestens einen Inhaber geben.');
  const users = await repos.users.findAll();
  if (ids.some((id) => !users.some((u) => u.id === id))) errors.push('Unbekannter Inhaber.');
  return ids;
}

async function readForm(repos, input, errors) {
  return {
    name: v.text(input.name, { label: 'Name', required: true, max: 80 }, errors),
    type: v.oneOf(input.type, Object.keys(ACCOUNT_TYPES), 'Kontotyp', errors),
    iban: v.text(input.iban, { label: 'IBAN', max: 40 }, errors),
    owner_ids: await checkOwners(repos, input.owner_ids, errors),
  };
}

async function createAccount(repos, userId, input) {
  const errors = [];
  const fields = await readForm(repos, input, errors);
  const opening_balance_cents = v.signedAmount(input.opening_balance || '0', input.opening_balance_sign, 'Anfangssaldo', errors);
  const opening_date = v.date(input.opening_date, 'Stichtag', errors);
  if (!fields.owner_ids.includes(userId)) errors.push('Du musst selbst Inhaber des neuen Kontos sein.');
  if (errors.length) throw new ValidationError(errors);
  return repos.accounts.insert({ ...fields, opening_balance_cents, opening_date, archived: false });
}

async function updateAccount(repos, userId, id, input) {
  const account = await getVisibleAccount(repos, userId, id);
  const errors = [];
  const fields = await readForm(repos, input, errors);
  const opening_balance_cents = v.signedAmount(input.opening_balance || '0', input.opening_balance_sign, 'Anfangssaldo', errors);
  const opening_date = v.date(input.opening_date, 'Stichtag', errors);
  if (!errors.length) {
    const earliest = (await repos.transactions.findAll({ account_id: account.id }))
      .reduce((min, t) => (min === null || t.date < min ? t.date : min), null);
    if (earliest && opening_date > earliest) {
      errors.push('Der Stichtag darf nicht nach der ersten Buchung des Kontos liegen.');
    }
  }
  if (errors.length) throw new ValidationError(errors);
  return repos.accounts.update(account.id, { ...fields, opening_balance_cents, opening_date });
}

async function setArchived(repos, userId, id, archived) {
  const account = await getVisibleAccount(repos, userId, id);
  return repos.accounts.update(account.id, { archived });
}

/** Löschen nur, wenn keine Buchungen und Vorlagen mehr daran hängen (F-14). */
async function deleteAccount(repos, userId, id) {
  const account = await getVisibleAccount(repos, userId, id);
  const used = (await repos.transactions.findAll()).some(
    (t) => t.account_id === account.id || t.counter_account_id === account.id,
  ) || (await repos.recurring.findAll()).some(
    (r) => r.account_id === account.id || r.to_account_id === account.id,
  );
  if (used) throw new ValidationError('Das Konto hat Buchungen oder regelmäßige Buchungen und kann nur archiviert werden.');
  await repos.accounts.remove(account.id);
}

module.exports = { ACCOUNT_TYPES, createAccount, updateAccount, setArchived, deleteAccount, checkOwners };
