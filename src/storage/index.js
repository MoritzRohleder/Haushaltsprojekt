'use strict';

const { JsonStorage } = require('./json/JsonStorage');
const { seed } = require('./seed');

const COLLECTIONS = ['users', 'accounts', 'categories', 'transactions', 'recurring', 'assets', 'asset_values'];

/** Wählt den Speicher-Adapter (STORAGE) und erzeugt bei Bedarf die Startdaten. */
async function createStorage(config) {
  let storage;
  switch (config.storage) {
    case 'json':
      storage = new JsonStorage({ dir: config.dataDir, collections: COLLECTIONS });
      break;
    default:
      throw new Error(`Unbekannter Speicher-Adapter: ${config.storage}`);
  }
  await storage.init();
  await seed(storage);
  return storage;
}

module.exports = { createStorage, COLLECTIONS };
