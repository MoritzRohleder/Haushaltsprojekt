'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');

const SCHEMA_VERSION = 1;
const BACKUPS_PER_COLLECTION = 5;

/**
 * Speicher-Adapter für JSON-Dateien (siehe Spec 10.3).
 *
 * - Eine Datei pro Sammlung im Datenordner, dazu meta.json.
 * - Alle Daten liegen im Arbeitsspeicher; gelesen wird nur von dort.
 * - Schreibzugriffe laufen nacheinander und werden atomar geschrieben
 *   (temporäre Datei + Umbenennen). Vorher wird eine Sicherung angelegt.
 */
class JsonStorage {
  constructor({ dir, collections }) {
    this.dir = dir;
    this.backupDir = path.join(dir, 'backup');
    this.collections = collections;
    this.data = new Map();
    this.meta = {};
    this.queue = Promise.resolve();
    this.txContext = new AsyncLocalStorage();
  }

  async init() {
    await fs.mkdir(this.backupDir, { recursive: true });
    for (const name of this.collections) {
      this.data.set(name, await this.#readFile(`${name}.json`, []));
    }
    this.meta = await this.#readFile('meta.json', null);
    if (!this.meta) {
      this.meta = { schema_version: SCHEMA_VERSION };
      await this.#writeFile('meta.json', this.meta);
    }
  }

  // ---- Lesen -------------------------------------------------------------

  async findAll(collection, filter = {}) {
    const entries = Object.entries(filter);
    return this.#rows(collection)
      .filter((row) => entries.every(([key, value]) => row[key] === value))
      .map((row) => structuredClone(row));
  }

  async findById(collection, id) {
    const row = this.#rows(collection).find((r) => r.id === id);
    return row ? structuredClone(row) : null;
  }

  getMeta(key) {
    return this.meta[key];
  }

  // ---- Schreiben ---------------------------------------------------------

  async insert(collection, record) {
    return this.#write([collection], () => {
      const now = new Date().toISOString();
      const row = { id: randomUUID(), ...structuredClone(record), created_at: now, updated_at: now };
      this.#rows(collection).push(row);
      return structuredClone(row);
    });
  }

  async update(collection, id, changes) {
    return this.#write([collection], () => {
      const row = this.#rows(collection).find((r) => r.id === id);
      if (!row) throw new Error(`${collection}/${id} existiert nicht`);
      const { id: _ignored, created_at: _created, ...rest } = structuredClone(changes);
      Object.assign(row, rest, { updated_at: new Date().toISOString() });
      return structuredClone(row);
    });
  }

  async remove(collection, id) {
    return this.#write([collection], () => {
      const rows = this.#rows(collection);
      const index = rows.findIndex((r) => r.id === id);
      if (index === -1) return false;
      rows.splice(index, 1);
      return true;
    });
  }

  async setMeta(key, value) {
    return this.#write(['meta'], () => {
      this.meta[key] = value;
    });
  }

  /**
   * Führt mehrere Änderungen gemeinsam aus. Wirft fn einen Fehler,
   * wird der Zustand vor der Transaktion wiederhergestellt und nichts geschrieben.
   */
  async transaction(fn) {
    const current = this.txContext.getStore();
    if (current) return fn(this); // verschachtelt: läuft in der äußeren Transaktion mit

    return this.#enqueue(async () => {
      const snapshot = { data: structuredClone(this.data), meta: structuredClone(this.meta) };
      const tx = { dirty: new Set() };
      try {
        const result = await this.txContext.run(tx, () => fn(this));
        await this.#persist(tx.dirty);
        return result;
      } catch (err) {
        this.data = snapshot.data;
        this.meta = snapshot.meta;
        throw err;
      }
    });
  }

  // ---- intern ------------------------------------------------------------

  #rows(collection) {
    const rows = this.data.get(collection);
    if (!rows) throw new Error(`Unbekannte Sammlung: ${collection}`);
    return rows;
  }

  async #write(names, mutate) {
    const tx = this.txContext.getStore();
    if (tx) {
      const result = mutate();
      names.forEach((n) => tx.dirty.add(n));
      return result;
    }
    return this.#enqueue(async () => {
      const snapshot = { data: structuredClone(this.data), meta: structuredClone(this.meta) };
      try {
        const result = mutate();
        await this.#persist(new Set(names));
        return result;
      } catch (err) {
        this.data = snapshot.data;
        this.meta = snapshot.meta;
        throw err;
      }
    });
  }

  #enqueue(job) {
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => {});
    return run;
  }

  async #persist(names) {
    for (const name of names) {
      if (name === 'meta') await this.#writeFile('meta.json', this.meta);
      else await this.#writeFile(`${name}.json`, this.#rows(name));
    }
  }

  async #readFile(file, fallback) {
    try {
      return JSON.parse(await fs.readFile(path.join(this.dir, file), 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return fallback;
      throw new Error(`Datei ${file} konnte nicht gelesen werden: ${err.message}`);
    }
  }

  async #writeFile(file, content) {
    const target = path.join(this.dir, file);
    await this.#backup(file);
    const tmp = `${target}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(content, null, 2) + '\n', 'utf8');
    await fs.rename(tmp, target);
  }

  async #backup(file) {
    const source = path.join(this.dir, file);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    try {
      await fs.copyFile(source, path.join(this.backupDir, `${file}.${stamp}`));
    } catch (err) {
      if (err.code === 'ENOENT') return; // noch keine Datei vorhanden
      throw err;
    }
    const old = (await fs.readdir(this.backupDir))
      .filter((f) => f.startsWith(`${file}.`))
      .sort()
      .slice(0, -BACKUPS_PER_COLLECTION);
    await Promise.all(old.map((f) => fs.rm(path.join(this.backupDir, f), { force: true })));
  }
}

module.exports = { JsonStorage, SCHEMA_VERSION };
