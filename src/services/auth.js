'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { ValidationError } = require('../utils/errors');

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const normalize = (username) => String(username || '').trim();

async function findByUsername(repos, username) {
  const wanted = normalize(username).toLowerCase();
  return (await repos.users.findAll()).find((u) => u.username.toLowerCase() === wanted) || null;
}

function checkNewPassword(password, passwordRepeat, errors) {
  if (String(password || '').length < MIN_PASSWORD_LENGTH) {
    errors.push(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`);
  } else if (password !== passwordRepeat) {
    errors.push('Die Passwörter stimmen nicht überein.');
  }
}

async function register(repos, { username, password, passwordRepeat }) {
  const name = normalize(username);
  const errors = [];
  if (!USERNAME_PATTERN.test(name)) {
    errors.push('Der Nutzername muss 3–32 Zeichen lang sein (Buchstaben, Ziffern, . _ -).');
  } else if (await findByUsername(repos, name)) {
    errors.push('Dieser Nutzername ist bereits vergeben.');
  }
  checkNewPassword(password, passwordRepeat, errors);
  if (errors.length) throw new ValidationError(errors);

  const user = await repos.users.insert({ username: name, password_hash: await hashPassword(password) });
  return publicUser(user);
}

/** Gibt den Nutzer zurück oder null – ohne zu verraten, was falsch war. */
async function authenticate(repos, username, password) {
  const user = await findByUsername(repos, username);
  if (!user) {
    await hashPassword(String(password || '')); // gleiche Laufzeit wie bei existierendem Nutzer
    return null;
  }
  return (await verifyPassword(String(password || ''), user.password_hash)) ? publicUser(user) : null;
}

async function changePassword(repos, userId, { currentPassword, password, passwordRepeat }) {
  const user = await repos.users.findById(userId);
  const errors = [];
  if (!user || !(await verifyPassword(String(currentPassword || ''), user.password_hash))) {
    errors.push('Das aktuelle Passwort ist falsch.');
  }
  checkNewPassword(password, passwordRepeat, errors);
  if (errors.length) throw new ValidationError(errors);
  await repos.users.update(userId, { password_hash: await hashPassword(password) });
}

const publicUser = (user) => ({ id: user.id, username: user.username });

module.exports = { hashPassword, verifyPassword, register, authenticate, changePassword, findByUsername };
