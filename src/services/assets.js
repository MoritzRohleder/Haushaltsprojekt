'use strict';

const v = require('../utils/validate');
const { ValidationError } = require('../utils/errors');
const { getVisibleAsset } = require('./visibility');
const { checkOwners } = require('./accounts');
const { today: todayIso } = require('../utils/dates');

const ASSET_TYPES = {
  fund: 'Fonds',
  depot: 'Depot',
  building_savings: 'Bausparvertrag',
  insurance: 'Versicherung',
  other: 'Sonstiges',
};

// ---- Berechnung (Spec 6.3) -------------------------------------------------

const byDateThenCreated = (a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at);

/**
 * Verlauf einer Anlage: manuelle Stände und Ein-/Auszahlungen mit dem jeweils
 * resultierenden Wert, sortiert nach Datum. Am selben Tag entscheidet die
 * Reihenfolge der Erfassung: Eine Einzahlung, die nach einem manuellen Stand
 * erfasst wurde, wird aufaddiert; eine vorher erfasste gilt als im Stand enthalten.
 * Für manuelle Stände wird die Korrektur gegenüber dem berechneten Wert angegeben.
 */
function assetHistory(asset, values, transactions, asOf = null) {
  const events = [
    ...values.filter((s) => s.asset_id === asset.id).map((s) => ({ kind: 'manual', row: s, date: s.date })),
    ...transactions.filter((t) => t.counter_asset_id === asset.id)
      .map((t) => ({ kind: t.amount_cents < 0 ? 'deposit' : 'withdrawal', row: t, date: t.date })),
  ]
    .filter((e) => asOf === null || e.date <= asOf)
    // Bei exakt gleichem Erfassungszeitpunkt zuerst die Buchung (gilt dann als im Stand enthalten).
    .sort((a, b) => byDateThenCreated(a.row, b.row) || (a.kind === 'manual') - (b.kind === 'manual'));

  let value = 0;
  let hasManual = false;
  return events.map((e) => {
    if (e.kind === 'manual') {
      const correction = hasManual ? e.row.value_cents - value : null; // erster Stand = Startwert
      value = e.row.value_cents;
      hasManual = true;
      return { ...e, change_cents: correction, value_cents: value };
    }
    const change = -e.row.amount_cents; // Konto −200 → Anlage +200
    value += change;
    return { ...e, change_cents: change, value_cents: value };
  });
}

/** Aktueller Wert und letzte manuelle Aktualisierung (für Übersicht/Dashboard, F-46). */
function assetSummary(asset, values, transactions, asOf = null, { staleBefore = null } = {}) {
  const history = assetHistory(asset, values, transactions, asOf);
  const lastManual = [...history].reverse().find((e) => e.kind === 'manual') || null;
  return {
    value_cents: history.length ? history[history.length - 1].value_cents : 0,
    last_manual_date: lastManual ? lastManual.date : null,
    last_manual_correction_cents: lastManual ? lastManual.change_cents : null,
    // F-44: letzter manueller Stand älter als die konfigurierte Anzahl Monate
    stale: Boolean(staleBefore && lastManual && lastManual.date < staleBefore),
  };
}

// ---- Pflege ------------------------------------------------------------------

async function readForm(repos, input, errors) {
  return {
    name: v.text(input.name, { label: 'Name', required: true, max: 80 }, errors),
    type: v.oneOf(input.type, Object.keys(ASSET_TYPES), 'Art der Anlage', errors),
    provider: v.text(input.provider, { label: 'Anbieter', max: 80 }, errors),
    note: v.text(input.note, { label: 'Notiz', max: 500 }, errors),
    owner_ids: await checkOwners(repos, input.owner_ids, errors),
  };
}

/** Anlage anlegen. Der Startwert ist ein manueller Stand und gilt ab jetzt (Datum = heute). */
async function createAsset(repos, userId, input, { today = todayIso() } = {}) {
  const errors = [];
  const fields = await readForm(repos, input, errors);
  const start = v.signedAmount(input.start_value, input.start_value_sign, 'Startwert', errors);
  const date = today;
  if (!fields.owner_ids.includes(userId)) errors.push('Du musst selbst Inhaber der neuen Anlage sein.');
  if (errors.length) throw new ValidationError(errors);

  return repos.transaction(async () => {
    const asset = await repos.assets.insert({ ...fields, archived: false });
    await repos.assetValues.insert({ asset_id: asset.id, date, value_cents: start, note: 'Startwert', created_by: userId });
    return asset;
  });
}

async function updateAsset(repos, userId, id, input) {
  const asset = await getVisibleAsset(repos, userId, id);
  const errors = [];
  const fields = await readForm(repos, input, errors);
  if (errors.length) throw new ValidationError(errors);
  return repos.assets.update(asset.id, fields);
}

async function setArchived(repos, userId, id, archived) {
  const asset = await getVisibleAsset(repos, userId, id);
  return repos.assets.update(asset.id, { archived });
}

/**
 * Manuellen Stand erfassen (F-41). Ein manueller Stand ist immer der Stand zum
 * Zeitpunkt der Eingabe: Datum = heute, er ersetzt den bisher berechneten Wert
 * und enthält alles bis jetzt Erfasste. Nur spätere Ein-/Auszahlungen kommen dazu.
 */
async function addValue(repos, userId, id, input, { today = todayIso() } = {}) {
  const asset = await getVisibleAsset(repos, userId, id);
  const errors = [];
  const date = today;
  const value = v.signedAmount(input.value, input.value_sign, 'Wert', errors);
  const note = v.text(input.note, { label: 'Notiz', max: 200 }, errors);
  if (errors.length) throw new ValidationError(errors);
  return repos.assetValues.insert({ asset_id: asset.id, date, value_cents: value, note, created_by: userId });
}

async function deleteValue(repos, userId, assetId, valueId) {
  const asset = await getVisibleAsset(repos, userId, assetId);
  const values = await repos.assetValues.findAll({ asset_id: asset.id });
  if (!values.some((s) => s.id === valueId)) throw new ValidationError('Stand nicht gefunden.');
  if (values.length === 1) throw new ValidationError('Der letzte verbleibende Stand kann nicht gelöscht werden.');
  await repos.assetValues.remove(valueId);
}

/** Löschen nur ohne Ein-/Auszahlungen; die Stände werden mit gelöscht. */
async function deleteAsset(repos, userId, id) {
  const asset = await getVisibleAsset(repos, userId, id);
  const used = (await repos.transactions.findAll({ counter_asset_id: asset.id })).length > 0
    || (await repos.recurring.findAll({ to_asset_id: asset.id })).length > 0;
  if (used) throw new ValidationError('Die Anlage hat Ein-/Auszahlungen und kann nur archiviert werden.');
  await repos.transaction(async () => {
    for (const s of await repos.assetValues.findAll({ asset_id: asset.id })) await repos.assetValues.remove(s.id);
    await repos.assets.remove(asset.id);
  });
}

module.exports = {
  ASSET_TYPES, assetHistory, assetSummary,
  createAsset, updateAsset, setArchived, addValue, deleteValue, deleteAsset,
};
