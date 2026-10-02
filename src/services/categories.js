'use strict';

const v = require('../utils/validate');
const { ValidationError, NotFoundError } = require('../utils/errors');

const KINDS = { income: 'Einnahme', expense: 'Ausgabe' };

/** Nur eigene Kategorien sind in der Oberfläche änderbar; Standard-Kategorien nur in der JSON-Datei. */
async function getOwnCategory(repos, userId, id) {
  const category = id ? await repos.categories.findById(id) : null;
  if (!category || category.owner_id !== userId) throw new NotFoundError('Kategorie nicht gefunden');
  return category;
}

async function createCategory(repos, userId, input) {
  const errors = [];
  const name = v.text(input.name, { label: 'Name', required: true, max: 60 }, errors);
  const kind = v.oneOf(input.kind, Object.keys(KINDS), 'Art', errors);
  if (errors.length) throw new ValidationError(errors);
  return repos.categories.insert({
    name, kind, owner_id: userId, archived: false,
    merchant_required: kind === 'expense' && Boolean(input.shopping),
  });
}

/**
 * „Einkauf“ ein-/ausschalten: Bei solchen Ausgaben-Kategorien ist das Geschäft Pflicht.
 * Geht bei eigenen und bei Standard-Kategorien (dort gilt es für alle Nutzer).
 */
async function setMerchantRequired(repos, userId, id, required) {
  const category = id ? await repos.categories.findById(id) : null;
  const allowed = category && (category.owner_id === null || category.owner_id === userId);
  if (!allowed) throw new NotFoundError('Kategorie nicht gefunden');
  if (category.kind !== 'expense') throw new ValidationError('Nur Ausgaben-Kategorien können als Einkauf markiert werden.');
  return repos.categories.update(category.id, { merchant_required: Boolean(required) });
}

async function renameCategory(repos, userId, id, input) {
  const category = await getOwnCategory(repos, userId, id);
  const errors = [];
  const name = v.text(input.name, { label: 'Name', required: true, max: 60 }, errors);
  if (errors.length) throw new ValidationError(errors);
  return repos.categories.update(category.id, { name });
}

async function setArchived(repos, userId, id, archived) {
  const category = await getOwnCategory(repos, userId, id);
  return repos.categories.update(category.id, { archived });
}

async function deleteCategory(repos, userId, id) {
  const category = await getOwnCategory(repos, userId, id);
  const used = (await repos.transactions.findAll({ category_id: category.id })).length > 0
    || (await repos.recurring.findAll({ category_id: category.id })).length > 0;
  if (used) throw new ValidationError('Die Kategorie wird verwendet und kann nur archiviert werden.');
  await repos.categories.remove(category.id);
}

module.exports = { KINDS, createCategory, renameCategory, setArchived, deleteCategory, setMerchantRequired };
