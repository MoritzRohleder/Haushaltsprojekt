'use strict';

const crypto = require('node:crypto');
const { formatEuro, centsToInput } = require('../utils/money');
const { formatDate, formatMonth, today } = require('../utils/dates');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { generateDue } = require('../services/recurring');

/**
 * Hilfsfunktionen und Nutzerdaten für alle Views. Der Nutzer wird bei jeder
 * Anfrage frisch geladen, damit Einstellungen wie das Theme sofort gelten und
 * gelöschte Nutzer abgemeldet werden.
 */
function locals(repos) {
  return async (req, res, next) => {
    let user = null;
    if (req.session.user) {
      user = await repos.users.findById(req.session.user.id);
      if (!user) delete req.session.user;
    }
    res.locals.currentUser = user ? { id: user.id, username: user.username } : null;
    res.locals.theme = user?.theme || 'auto';
    res.locals.hiddenCategoryIds = user?.hidden_category_ids || [];
    res.locals.euro = formatEuro;
    res.locals.inputEuro = centsToInput;
    res.locals.date = formatDate;
    res.locals.time = (iso) => (iso ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '');
    res.locals.monthName = formatMonth;
    res.locals.today = today();
    res.locals.path = req.path;
    res.locals.helpUrl = helpUrl(req.path);
    res.locals.flash = req.session.flash || null;
    delete req.session.flash;
    res.locals.csrfToken = req.session.csrfToken || '';
    next();
  };
}

/** Passendes Handbuch-Kapitel zur aktuellen Seite (für den „?“-Knopf). */
const HELP_PAGES = [
  ['/konten', 'Konten'],
  ['/anlagen', 'Anlagen'],
  ['/buchungen', 'Buchungen'],
  ['/wiederkehrend', 'Regelmäßige-Buchungen'],
  ['/kategorien', 'Kategorien'],
  ['/profil', 'Profil-und-Darstellung'],
  ['/monat', 'Übersicht-und-Auswertung'],
  ['/auswertung', 'Übersicht-und-Auswertung'],
];

function helpUrl(path) {
  if (path === '/') return `/handbuch/${encodeURIComponent('Übersicht-und-Auswertung')}`;
  const match = HELP_PAGES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return match ? `/handbuch/${encodeURIComponent(match[1])}` : '/handbuch';
}

/**
 * Sicherheits-Header. Die Content-Security-Policy erlaubt nur eigene Skripte,
 * Styles und Bilder – keine Inline-Skripte, keine fremden Quellen.
 */
function securityHeaders({ hsts = false } = {}) {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
  return (req, res, next) => {
    res.set({
      'Content-Security-Policy': csp,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    });
    if (hsts) res.set('Strict-Transport-Security', 'max-age=31536000');
    next();
  };
}

/**
 * Alle Seiten außer Login/Registrierung nur angemeldet (F-03).
 * Angemeldete Seiten werden nicht zwischengespeichert: Finanzdaten bleiben nicht
 * im Browser-Cache, und „Zurück“ zeigt nie einen veralteten Stand.
 */
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  res.set('Cache-Control', 'no-store');
  next();
}

/** CSRF-Schutz für alle Formulare angemeldeter Nutzer (Formularfeld oder Header). */
function csrf(req, res, next) {
  if (!req.session.user) return next();
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
    res.locals.csrfToken = req.session.csrfToken;
  }
  if (req.method !== 'POST') return next();
  const sent = Buffer.from(String(req.body?._csrf || req.get('x-csrf-token') || ''));
  const expected = Buffer.from(req.session.csrfToken);
  if (sent.length === expected.length && crypto.timingSafeEqual(sent, expected)) return next();
  res.status(403).render('error', { title: 'Abgelaufen', message: 'Das Formular ist abgelaufen. Bitte lade die Seite neu und versuche es noch einmal.' });
}

/** Fällige regelmäßige Buchungen einmal pro Tag erzeugen (Spec 8.4). */
function recurringDaily(repos) {
  let lastRun = null;
  let running = null;
  return async (req, res, next) => {
    const day = today();
    if (lastRun !== day) {
      running ??= generateDue(repos, day).then(() => { lastRun = day; }).finally(() => { running = null; });
      await running;
    }
    next();
  };
}

function flash(req, text, type = 'success') {
  req.session.flash = { type, text };
}

/** Nur interne Pfade als Rücksprungziel zulassen (kein Open Redirect). */
function safeBack(value, fallback = '/') {
  const text = String(value || '');
  return text.startsWith('/') && !text.startsWith('//') && !text.includes('\\') ? text : fallback;
}

function notFound(req, res) {
  res.status(404).render('error', { title: 'Nicht gefunden', message: 'Diese Seite gibt es nicht – oder du hast keinen Zugriff darauf.' });
}

function errorHandler(err, req, res, _next) {
  if (err instanceof NotFoundError) return notFound(req, res);
  if (err instanceof ValidationError) {
    return res.status(400).render('error', { title: 'Nicht möglich', message: err.errors.join(' ') });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).render('error', { title: 'Zu groß', message: 'Die gesendeten Daten sind zu groß.' });
  }
  console.error(err);
  res.status(500).render('error', { title: 'Fehler', message: 'Es ist ein unerwarteter Fehler aufgetreten.' });
}

module.exports = {
  locals, securityHeaders, requireLogin, csrf, recurringDaily, flash, safeBack, notFound, errorHandler,
};
