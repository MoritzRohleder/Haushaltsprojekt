'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createStorage } = require('../src/storage');
const { createRepositories } = require('../src/repositories');
const auth = require('../src/services/auth');

/** Frischer Speicher in einem temporären Ordner. */
async function setup() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'haushalt-test-'));
  const storage = await createStorage({ storage: 'json', dataDir: dir });
  const repos = createRepositories(storage);
  return { dir, storage, repos, cleanup: () => fs.rm(dir, { recursive: true, force: true }) };
}

async function user(repos, username) {
  return auth.register(repos, { username, password: 'geheim123', passwordRepeat: 'geheim123' });
}

async function account(repos, name, ownerIds, extra = {}) {
  return repos.accounts.insert({
    name, type: 'giro', iban: '', owner_ids: ownerIds,
    opening_balance_cents: 0, opening_date: '2026-01-01', archived: false, ...extra,
  });
}

module.exports = { setup, user, account };
