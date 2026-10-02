'use strict';

/**
 * Startdaten: Standard-Kategorien (Spec 5.2).
 * Werden nur beim allerersten Start erzeugt. Danach wird die Liste
 * ausschließlich in data/categories.json gepflegt (bei gestopptem Server).
 */
const DEFAULT_CATEGORIES = {
  income: ['Gehalt', 'Nebeneinkünfte', 'Erstattungen', 'Geschenke', 'Sonstige Einnahmen'],
  expense: ['Wohnen', 'Energie', 'Lebensmittel', 'Haushalt', 'Mobilität', 'Versicherungen',
    'Internet & Telefon', 'Abos & Mitgliedschaften', 'Gesundheit', 'Kleidung', 'Freizeit',
    'Urlaub', 'Geschenke', 'Bildung', 'Sonstige Ausgaben'],
};

/** Standard-Kategorien, bei denen ein Geschäft angegeben werden muss („Einkauf“). */
const DEFAULT_SHOPPING = ['Lebensmittel', 'Haushalt', 'Kleidung', 'Geschenke'];

async function seed(storage) {
  if (storage.getMeta('categories_seeded_at')) return false;
  await storage.transaction(async () => {
    for (const [kind, names] of Object.entries(DEFAULT_CATEGORIES)) {
      for (const name of names) {
        await storage.insert('categories', {
          name, kind, owner_id: null, archived: false,
          merchant_required: kind === 'expense' && DEFAULT_SHOPPING.includes(name),
        });
      }
    }
    await storage.setMeta('categories_seeded_at', new Date().toISOString());
  });
  return true;
}

module.exports = { seed, DEFAULT_CATEGORIES, DEFAULT_SHOPPING };
