'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createStorage } = require('../src/storage');
const { DEFAULT_CATEGORIES } = require('../src/storage/seed');
const { setup } = require('./helpers');

test('Standard-Kategorien werden nur beim ersten Start erzeugt', async (t) => {
  const { dir, repos, cleanup } = await setup();
  t.after(cleanup);
  const expected = DEFAULT_CATEGORIES.income.length + DEFAULT_CATEGORIES.expense.length;
  assert.equal((await repos.categories.findAll()).length, expected);

  // Nutzer bearbeitet die Datei: eine Kategorie entfernen.
  const file = path.join(dir, 'categories.json');
  const list = JSON.parse(await fs.readFile(file, 'utf8'));
  await fs.writeFile(file, JSON.stringify(list.slice(1)));

  const again = await createStorage({ storage: 'json', dataDir: dir });
  assert.equal((await again.findAll('categories')).length, expected - 1);
});

test('Daten überstehen einen Neustart; Sicherungen werden angelegt', async (t) => {
  const { dir, storage, cleanup } = await setup();
  t.after(cleanup);
  const row = await storage.insert('users', { username: 'a', password_hash: 'x' });
  await storage.update('users', row.id, { username: 'b' });

  const again = await createStorage({ storage: 'json', dataDir: dir });
  assert.equal((await again.findById('users', row.id)).username, 'b');
  const backups = await fs.readdir(path.join(dir, 'backup'));
  assert.ok(backups.some((f) => f.startsWith('users.json.')));
});

test('Transaktion wird bei Fehler vollständig zurückgerollt', async (t) => {
  const { dir, storage, cleanup } = await setup();
  t.after(cleanup);
  await assert.rejects(storage.transaction(async () => {
    await storage.insert('accounts', { name: 'A' });
    await storage.insert('accounts', { name: 'B' });
    throw new Error('Abbruch');
  }), /Abbruch/);
  assert.equal((await storage.findAll('accounts')).length, 0);
  const again = await createStorage({ storage: 'json', dataDir: dir });
  assert.equal((await again.findAll('accounts')).length, 0);
});

test('Gleichzeitige Schreibzugriffe gehen nicht verloren', async (t) => {
  const { dir, storage, cleanup } = await setup();
  t.after(cleanup);
  await Promise.all(Array.from({ length: 25 }, (_, i) => storage.insert('assets', { name: `X${i}` })));
  const again = await createStorage({ storage: 'json', dataDir: dir });
  assert.equal((await again.findAll('assets')).length, 25);
});

test('Gelesene Daten sind Kopien', async (t) => {
  const { storage, cleanup } = await setup();
  t.after(cleanup);
  const row = await storage.insert('assets', { name: 'X', owner_ids: ['u'] });
  const copy = await storage.findById('assets', row.id);
  copy.owner_ids.push('hacker');
  assert.deepEqual((await storage.findById('assets', row.id)).owner_ids, ['u']);
});
