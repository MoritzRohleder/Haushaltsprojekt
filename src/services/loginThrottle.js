'use strict';

/**
 * Bremse gegen das Durchprobieren von Passwörtern (Spec 10.4).
 *
 * Fehlversuche werden je Kombination aus IP-Adresse und Nutzername gezählt.
 * Ab FREE_ATTEMPTS Fehlversuchen wird eine Wartezeit verhängt, die sich mit
 * jedem weiteren Fehlversuch verdoppelt (höchstens MAX_LOCK_MS). Zusätzlich
 * gilt ein grobes Limit pro IP-Adresse über alle Nutzernamen.
 */
const FREE_ATTEMPTS = 5;
const BASE_LOCK_MS = 30 * 1000;
const MAX_LOCK_MS = 15 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const IP_LIMIT = 30;

class LoginThrottle {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.byKey = new Map(); // ip|user → { failures, lockedUntil, last }
    this.byIp = new Map(); // ip → [Zeitstempel der Fehlversuche]
  }

  /** Millisekunden, die noch gewartet werden muss (0 = Versuch erlaubt). */
  retryAfter(ip, username) {
    this.#cleanup();
    const now = this.now();
    const entry = this.byKey.get(key(ip, username));
    const keyWait = entry && entry.lockedUntil > now ? entry.lockedUntil - now : 0;
    const recent = (this.byIp.get(ip) || []).filter((t) => t > now - WINDOW_MS);
    const ipWait = recent.length >= IP_LIMIT ? recent[0] + WINDOW_MS - now : 0;
    return Math.max(keyWait, ipWait);
  }

  failure(ip, username) {
    const now = this.now();
    const k = key(ip, username);
    const entry = this.byKey.get(k) || { failures: 0, lockedUntil: 0, last: now };
    entry.failures += 1;
    entry.last = now;
    if (entry.failures >= FREE_ATTEMPTS) {
      entry.lockedUntil = now + Math.min(BASE_LOCK_MS * 2 ** (entry.failures - FREE_ATTEMPTS), MAX_LOCK_MS);
    }
    this.byKey.set(k, entry);
    this.byIp.set(ip, [...(this.byIp.get(ip) || []), now].filter((t) => t > now - WINDOW_MS));
  }

  success(ip, username) {
    this.byKey.delete(key(ip, username));
  }

  #cleanup() {
    const cutoff = this.now() - WINDOW_MS;
    for (const [k, entry] of this.byKey) {
      if (entry.last < cutoff && entry.lockedUntil < this.now()) this.byKey.delete(k);
    }
    for (const [ip, times] of this.byIp) {
      const recent = times.filter((t) => t > cutoff);
      if (recent.length) this.byIp.set(ip, recent); else this.byIp.delete(ip);
    }
  }
}

const key = (ip, username) => `${ip}|${String(username || '').trim().toLowerCase()}`;

/** Wartezeit lesbar, z. B. „2 Minuten“ oder „30 Sekunden“. */
function describeWait(ms) {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} Sekunden`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? '1 Minute' : `${minutes} Minuten`;
}

module.exports = { LoginThrottle, describeWait, FREE_ATTEMPTS };
