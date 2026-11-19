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

/**
 * Nutzer, deren eigene Kategorien `userId` sieht (Spec 4, F-13a): er selbst und alle,
 * mit denen er mindestens ein Konto gemeinsam hat (Mitinhaber, auch bei archivierten Konten).
 */
async function categoryOwnerIds(repos, userId) {
  const ids = new Set([userId]);
  for (const account of await repos.accounts.findAll()) {
    if (isOwner(account, userId)) account.owner_ids.forEach((id) => ids.add(id));
  }
  return ids;
}

/** Darf `userId` diese Kategorie verwenden? Standard-, eigene und Kategorien von Mitinhabern. */
async function canUseCategory(repos, userId, category) {
  if (!category) return false;
  if (category.owner_id === null || category.owner_id === userId) return true;
  return (await categoryOwnerIds(repos, userId)).has(category.owner_id);
}

/**
 * Standard-Kategorien (ohne owner_id), die eigenen und die der Mitinhaber.
 * Kategorien anderer tragen `shared_by` (Name des Erstellers).
 * Vom Nutzer ausgeblendete Standard-Kategorien (F-15) fehlen, außer mit includeHidden.
 */
async function visibleCategories(repos, userId, { kind, includeArchived = false, includeHidden = false } = {}) {
  const [user, owners, users] = await Promise.all([
    repos.users.findById(userId), categoryOwnerIds(repos, userId), repos.users.findAll(),
  ]);
  const names = new Map(users.map((u) => [u.id, u.username]));
  const hidden = new Set(includeHidden ? [] : user?.hidden_category_ids || []);
  return (await repos.categories.findAll())
    .filter((c) => c.owner_id === null || owners.has(c.owner_id))
    .filter((c) => !hidden.has(c.id))
    .filter((c) => !kind || c.kind === kind)
    .filter((c) => includeArchived || !c.archived)
    .map((c) => (c.owner_id && c.owner_id !== userId ? { ...c, shared_by: names.get(c.owner_id) ?? '?' } : c))
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
  visibleCategories, categoryOwnerIds, canUseCategory, getVisibleTransaction,
};
