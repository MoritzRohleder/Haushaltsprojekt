'use strict';

const { NotFoundError } = require('../utils/errors');

/** Sichtbarkeitsregeln (Spec Kapitel 4). */

const isOwner = (entity, userId) => Array.isArray(entity.owner_ids) && entity.owner_ids.includes(userId);

async function visibleAccounts(repos, userId) {
  return (await repos.accounts.findAll()).filter((a) => isOwner(a, userId));
}

async function visibleAssets(repos, userId) {
  return (await repos.assets.findAll()).filter((a) => isOwner(a, userId));
}

async function getVisibleAccount(repos, userId, id) {
  const account = id ? await repos.accounts.findById(id) : null;
  if (!account || !isOwner(account, userId)) throw new NotFoundError('Konto nicht gefunden');
  return account;
}

async function getVisibleAsset(repos, userId, id) {
  const asset = id ? await repos.assets.findById(id) : null;
  if (!asset || !isOwner(asset, userId)) throw new NotFoundError('Anlage nicht gefunden');
  return asset;
}

/** Standard-Kategorien (ohne owner_id) und die eigenen Kategorien des Nutzers. */
async function visibleCategories(repos, userId, { kind, includeArchived = false } = {}) {
  return (await repos.categories.findAll())
    .filter((c) => c.owner_id === null || c.owner_id === userId)
    .filter((c) => !kind || c.kind === kind)
    .filter((c) => includeArchived || !c.archived)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Eine Buchung ist sichtbar, wenn ihr Konto sichtbar ist (S-02). */
async function getVisibleTransaction(repos, userId, id) {
  const row = id ? await repos.transactions.findById(id) : null;
  if (!row) throw new NotFoundError('Buchung nicht gefunden');
  const account = await repos.accounts.findById(row.account_id);
  if (!account || !isOwner(account, userId)) throw new NotFoundError('Buchung nicht gefunden');
  return row;
}

module.exports = {
  isOwner, visibleAccounts, visibleAssets, getVisibleAccount, getVisibleAsset,
  visibleCategories, getVisibleTransaction,
};
