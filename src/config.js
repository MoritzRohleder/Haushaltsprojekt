'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

/** Konfiguration über Umgebungsvariablen (Spec 10.6). */
function loadConfig(env = process.env) {
  const dataDir = path.resolve(env.DATA_DIR || './data');
  return {
    port: Number(env.PORT) || 3000,
    dataDir,
    storage: env.STORAGE || 'json',
    sessionSecret: env.SESSION_SECRET || sessionSecretFromFile(dataDir),
    cookieSecure: env.COOKIE_SECURE === 'true',
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    assetStaleMonths: Number(env.ASSET_STALE_MONTHS) || 6,
  };
}

/**
 * TRUST_PROXY für den Betrieb hinter einem Reverse Proxy (z. B. Caddy, Traefik, nginx).
 * "true"/"false", eine Anzahl Proxys ("1") oder eine Liste wie "loopback, 10.0.0.0/8".
 */
function parseTrustProxy(value) {
  if (value === undefined || value === '' || value === 'false') return false;
  if (value === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

/**
 * Ist SESSION_SECRET nicht gesetzt, wird einmalig ein zufälliger Schlüssel im
 * Datenordner abgelegt, damit Logins einen Neustart überstehen.
 */
function sessionSecretFromFile(dataDir) {
  const file = path.join(dataDir, '.session-secret');
  fs.mkdirSync(dataDir, { recursive: true });
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(file, secret, { mode: 0o600 });
    console.warn(`SESSION_SECRET nicht gesetzt – zufälliger Schlüssel in ${file} abgelegt.`);
    return secret;
  }
}

module.exports = { loadConfig };
