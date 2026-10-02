'use strict';

const fs = require('node:fs');
const path = require('node:path');
const session = require('express-session');

const SAVE_DELAY_MS = 1000;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Minimaler Session-Store, der Sitzungen in data/sessions.json ablegt,
 * damit man nach einem Neustart des Servers angemeldet bleibt (Spec 10.4).
 * Läuft bewusst neben der Speicherschicht: Sitzungen sind keine Fachdaten.
 */
class JsonSessionStore extends session.Store {
  constructor({ dir }) {
    super();
    this.file = path.join(dir, 'sessions.json');
    this.sessions = {};
    this.timer = null;
    try {
      this.sessions = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn(`sessions.json unlesbar, starte ohne Sitzungen: ${err.message}`);
    }
    this.#prune();
  }

  get(sid, cb) {
    const entry = this.sessions[sid];
    if (!entry || entry.expires < Date.now()) return cb(null, null);
    cb(null, entry.data);
  }

  set(sid, data, cb) {
    this.sessions[sid] = { data, expires: expiry(data) };
    this.#scheduleSave();
    cb?.(null);
  }

  touch(sid, data, cb) {
    if (this.sessions[sid]) {
      this.sessions[sid].expires = expiry(data);
      this.#scheduleSave();
    }
    cb?.(null);
  }

  destroy(sid, cb) {
    delete this.sessions[sid];
    this.#scheduleSave();
    cb?.(null);
  }

  /** Sofort schreiben (z. B. beim Beenden des Servers). */
  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    this.#prune();
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.sessions), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }

  #scheduleSave() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      try { this.flush(); } catch (err) { console.error('Sitzungen konnten nicht gespeichert werden:', err); }
    }, SAVE_DELAY_MS);
    this.timer.unref();
  }

  #prune() {
    const now = Date.now();
    for (const [sid, entry] of Object.entries(this.sessions)) {
      if (entry.expires < now) delete this.sessions[sid];
    }
  }
}

function expiry(data) {
  const expires = data?.cookie?.expires ? new Date(data.cookie.expires).getTime() : NaN;
  return Number.isFinite(expires) ? expires : Date.now() + DEFAULT_MAX_AGE_MS;
}

module.exports = { JsonSessionStore };
