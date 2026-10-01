'use strict';

const { ValidationError, NotFoundError } = require('../utils/errors');

/** Persönliche Einstellungen eines Nutzers (Darstellung, ausgeblendete Kategorien). */

const THEMES = { auto: 'Automatisch (wie System)', light: 'Hell', dark: 'Dunkel' };

async function setTheme(repos, userId, theme) {
  if (!Object.hasOwn(THEMES, theme)) throw new ValidationError('Unbekannter Darstellungsmodus.');
  await repos.users.update(userId, { theme });
  return theme;
}

/** Standard-Kategorie für sich selbst aus- oder einblenden (F-15). */
async function setCategoryHidden(repos, userId, categoryId, hidden) {
  const category = await repos.categories.findById(categoryId);
  if (!category || category.owner_id !== null) throw new NotFoundError('Kategorie nicht gefunden');
  const user = await repos.users.findById(userId);
  const ids = new Set(user.hidden_category_ids || []);
  if (hidden) ids.add(categoryId); else ids.delete(categoryId);
  await repos.users.update(userId, { hidden_category_ids: [...ids] });
}

module.exports = { THEMES, setTheme, setCategoryHidden };
