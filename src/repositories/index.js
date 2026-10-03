'use strict';

const { COLLECTIONS } = require('../storage');

/**
 * Ein Repository pro Entität. Routes und Services greifen nur hierüber
 * auf Daten zu, nie direkt auf den Speicher-Adapter (Spec 10.2).
 */
class Repository {
  constructor(storage, collection) {
    this.storage = storage;
    this.collection = collection;
  }

  findAll(filter) { return this.storage.findAll(this.collection, filter); }
  findById(id) { return this.storage.findById(this.collection, id); }
  insert(record) { return this.storage.insert(this.collection, record); }
  update(id, changes) { return this.storage.update(this.collection, id, changes); }
  remove(id) { return this.storage.remove(this.collection, id); }
}

function createRepositories(storage) {
  const repos = {
    transaction: (fn) => storage.transaction(() => fn(repos)),
    files: {
      save: (buffer, ext) => storage.saveFile(buffer, ext),
      path: (name) => storage.filePath(name),
      remove: (name) => storage.removeFile(name),
    },
  };
  for (const name of COLLECTIONS) {
    const key = name.replace(/_(\w)/g, (_, c) => c.toUpperCase()); // asset_values → assetValues
    repos[key] = new Repository(storage, name);
  }
  return repos;
}

module.exports = { createRepositories, Repository };
