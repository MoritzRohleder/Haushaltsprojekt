'use strict';

const { randomUUID } = require('node:crypto');
const v = require('../utils/validate');
const { ValidationError } = require('../utils/errors');
const { isOwner, getVisibleTransaction } = require('./visibility');

/**
 * Buchungen anlegen, ändern, löschen (Spec 5.2 „Buchung“).
 *
 * `userId` ist der handelnde Nutzer. Für automatisch erzeugte Buchungen
 * (wiederkehrend) wird `{ system: true }` übergeben: Dann wird die
 * Sichtbarkeit nicht geprüft, alle anderen Regeln aber schon.
 */

async function loadAccount(repos, id, actor, errors, label = 'Konto', { allowArchived = false } = {}) {
  const account = id ? await repos.accounts.findById(id) : null;
  if (!account || (!actor.system && !isOwner(account, actor.userId))) {
    errors.push(`${label} ist ungültig.`);
    return null;
  }
  if (account.archived && !allowArchived) errors.push(`${label} „${account.name}“ ist archiviert.`);
  return account;
}

async function loadAsset(repos, id, actor, errors, label = 'Anlage') {
  const asset = id ? await repos.assets.findById(id) : null;
  if (!asset || (!actor.system && !isOwner(asset, actor.userId))) {
    errors.push(`${label} ist ungültig.`);
    return null;
  }
  if (asset.archived) errors.push(`${label} „${asset.name}“ ist archiviert.`);
  return asset;
}

function checkOpeningDate(account, date, errors) {
  if (account && date && date < account.opening_date) {
    errors.push(`Das Datum liegt vor dem Stichtag des Kontos „${account.name}“.`);
  }
}

async function checkCategory(repos, categoryId, kind, actor, errors) {
  if (!categoryId) return null;
  const category = await repos.categories.findById(categoryId);
  const visible = category && (category.owner_id === null || actor.system || category.owner_id === actor.userId);
  if (!visible || category.kind !== kind) errors.push('Kategorie ist ungültig.');
  return categoryId;
}

function commonFields(input, errors) {
  return {
    date: v.date(input.date, 'Datum', errors),
    amount: v.positiveAmount(input.amount, 'Betrag', errors),
    description: v.text(input.description, { label: 'Beschreibung', required: true, max: 120 }, errors),
    note: v.text(input.note, { label: 'Notiz', max: 500 }, errors),
  };
}

/** Einnahme oder Ausgabe prüfen; gibt die zu speichernde Zeile zurück. */
async function prepareBooking(repos, actor, input) {
  const errors = [];
  const type = v.oneOf(input.type, ['income', 'expense'], 'Buchungsart', errors);
  const f = commonFields(input, errors);
  const account = await loadAccount(repos, input.account_id, actor, errors);
  const category_id = await checkCategory(repos, input.category_id, type, actor, errors);
  checkOpeningDate(account, f.date, errors);
  if (errors.length) throw new ValidationError(errors);

  return {
    account_id: account.id,
    type,
    date: f.date,
    amount_cents: type === 'income' ? f.amount : -f.amount,
    category_id,
    description: f.description,
    note: f.note,
    recurring_id: input.recurring_id || null,
    created_by: actor.userId,
  };
}

/** Einnahme oder Ausgabe anlegen. */
async function createBooking(repos, actor, input) {
  return repos.transactions.insert(await prepareBooking(repos, actor, input));
}

/** "account:<id>" bzw. "asset:<id>" aus dem Formular zerlegen. */
function parseEndpoint(value) {
  const [kind, id] = String(value || '').split(':');
  return (kind === 'account' || kind === 'asset') && id ? { kind, id } : null;
}

/**
 * Transfer prüfen (Spec 8.3); gibt die zu speichernden Zeilen zurück.
 * Konto → Konto: zwei Buchungen mit gemeinsamer transfer_id.
 * Konto ↔ Anlage: eine Buchung auf dem Konto mit counter_asset_id.
 */
async function prepareTransfer(repos, actor, input) {
  const errors = [];
  const f = commonFields(input, errors);
  const from = parseEndpoint(input.from);
  const to = parseEndpoint(input.to);

  if (!from) errors.push('„Von“ ist ungültig.');
  if (!to) errors.push('„Nach“ ist ungültig.');
  if (from && to) {
    if (from.kind === 'asset' && to.kind === 'asset') errors.push('Mindestens eine Seite muss ein Konto sein.');
    if (from.kind === to.kind && from.id === to.id) errors.push('„Von“ und „Nach“ müssen verschieden sein.');
  }
  if (errors.length) throw new ValidationError(errors);

  const load = (ep, label) => (ep.kind === 'account'
    ? loadAccount(repos, ep.id, actor, errors, label)
    : loadAsset(repos, ep.id, actor, errors, label));
  const source = await load(from, '„Von“');
  const target = await load(to, '„Nach“');
  if (from.kind === 'account') checkOpeningDate(source, f.date, errors);
  if (to.kind === 'account') checkOpeningDate(target, f.date, errors);
  if (errors.length) throw new ValidationError(errors);

  const base = {
    type: 'transfer',
    date: f.date,
    category_id: null,
    description: f.description,
    note: f.note,
    recurring_id: input.recurring_id || null,
    created_by: actor.userId,
  };

  if (from.kind === 'account' && to.kind === 'account') {
    const transfer_id = randomUUID();
    return [
      { ...base, account_id: source.id, amount_cents: -f.amount, counter_account_id: target.id, transfer_id },
      { ...base, account_id: target.id, amount_cents: f.amount, counter_account_id: source.id, transfer_id },
    ];
  }
  if (from.kind === 'account') { // Einzahlung in Anlage
    return [{ ...base, account_id: source.id, amount_cents: -f.amount, counter_asset_id: target.id }];
  }
  return [{ ...base, account_id: target.id, amount_cents: f.amount, counter_asset_id: source.id }]; // Auszahlung
}

/** Transfer anlegen; gibt die erste (bei Paaren die abgehende) Buchung zurück. */
async function createTransfer(repos, actor, input) {
  const rows = await prepareTransfer(repos, actor, input);
  return repos.transaction(async () => {
    const saved = [];
    for (const row of rows) saved.push(await repos.transactions.insert(row));
    return saved[0];
  });
}

/** Alle Zeilen, die zu einer Buchung gehören (bei Transfers beide Hälften). */
async function relatedRows(repos, row) {
  if (row.transfer_id) return repos.transactions.findAll({ transfer_id: row.transfer_id });
  return [row];
}

/**
 * Buchung ändern. Bei Transfers sind Datum, Betrag, Beschreibung und Notiz
 * änderbar (immer für beide Hälften); für andere Konten neu anlegen.
 */
async function updateTransaction(repos, userId, id, input) {
  const row = await getVisibleTransaction(repos, userId, id);
  const actor = { userId };
  const errors = [];
  const f = commonFields(input, errors);

  if (row.type === 'transfer') {
    const rows = await relatedRows(repos, row);
    for (const r of rows) {
      checkOpeningDate(await repos.accounts.findById(r.account_id), f.date, errors);
    }
    if (errors.length) throw new ValidationError(errors);
    return repos.transaction(async () => {
      for (const r of rows) {
        await repos.transactions.update(r.id, {
          date: f.date,
          amount_cents: Math.sign(r.amount_cents) * f.amount,
          description: f.description,
          note: f.note,
        });
      }
      return repos.transactions.findById(row.id);
    });
  }

  // Bestehende Buchungen auf einem archivierten Konto bleiben korrigierbar.
  const account = await loadAccount(repos, input.account_id, actor, errors, 'Konto', {
    allowArchived: input.account_id === row.account_id,
  });
  const category_id = await checkCategory(repos, input.category_id, row.type, actor, errors);
  checkOpeningDate(account, f.date, errors);
  if (errors.length) throw new ValidationError(errors);
  return repos.transactions.update(row.id, {
    account_id: account.id,
    date: f.date,
    amount_cents: row.type === 'income' ? f.amount : -f.amount,
    category_id,
    description: f.description,
    note: f.note,
  });
}

/** Buchung löschen; bei Transfers immer beide Hälften (S-06). */
async function deleteTransaction(repos, userId, id) {
  const row = await getVisibleTransaction(repos, userId, id);
  const rows = await relatedRows(repos, row);
  await repos.transaction(async () => {
    for (const r of rows) await repos.transactions.remove(r.id);
  });
}

module.exports = {
  prepareBooking, prepareTransfer, createBooking, createTransfer, updateTransaction, deleteTransaction, parseEndpoint,
};
