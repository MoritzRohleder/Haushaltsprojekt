'use strict';

const { DEFAULT_SHOPPING } = require('./seed');

/**
 * Anpassungen am Datenbestand zwischen Versionen. Jede Migration läuft genau
 * einmal (vermerkt in meta.json als migrations_done) und muss wiederholbar sein.
 */
const MIGRATIONS = [
  {
    id: '2026-10-categories-merchant-required',
    // Kategorien bekommen das Feld merchant_required („Einkauf“).
    async run(storage) {
      for (const c of await storage.findAll('categories')) {
        if (c.merchant_required !== undefined) continue;
        const shopping = c.owner_id === null && c.kind === 'expense' && DEFAULT_SHOPPING.includes(c.name);
        await storage.update('categories', c.id, { merchant_required: shopping });
      }
    },
  },
];

async function migrate(storage) {
  const done = new Set(storage.getMeta('migrations_done') || []);
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await storage.transaction(async () => {
      await m.run(storage);
      done.add(m.id);
      await storage.setMeta('migrations_done', [...done]);
    });
  }
}

module.exports = { migrate, MIGRATIONS };
