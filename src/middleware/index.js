'use strict';

const crypto = require('node:crypto');
const { formatEuro, centsToInput } = require('../utils/money');
const { formatDate, formatMonth, today } = require('../utils/dates');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { generateDue } = require('../services/recurring');

/** Hilfsfunktionen und Nutzerdaten für alle Views. */
function locals(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  res.locals.euro = formatEuro;
  res.locals.inputEuro = centsToInput;
  res.locals.date = formatDate;
  res.locals.monthName = formatMonth;
  res.locals.today = today();
  res.locals.path = req.path;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.csrfToken = req.session.csrfToken || '';
  next();
}

/** Alle Seiten außer Login/Registrierung nur angemeldet (F-03). */
function requireLogin(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

/** CSRF-Schutz für alle Formulare angemeldeter Nutzer. */
function csrf(req, res, next) {
  if (!req.session.user) return next();
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
    res.locals.csrfToken = req.session.csrfToken;
  }
  if (req.method !== 'POST') return next();
  const sent = Buffer.from(String(req.body?._csrf || ''));
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

function notFound(req, res) {
  res.status(404).render('error', { title: 'Nicht gefunden', message: 'Diese Seite gibt es nicht – oder du hast keinen Zugriff darauf.' });
}

function errorHandler(err, req, res, _next) {
  if (err instanceof NotFoundError) return notFound(req, res);
  if (err instanceof ValidationError) {
    return res.status(400).render('error', { title: 'Nicht möglich', message: err.errors.join(' ') });
  }
  console.error(err);
  res.status(500).render('error', { title: 'Fehler', message: 'Es ist ein unerwarteter Fehler aufgetreten.' });
}

module.exports = { locals, requireLogin, csrf, recurringDaily, flash, notFound, errorHandler };
