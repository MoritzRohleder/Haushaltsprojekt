'use strict';

const path = require('node:path');
const express = require('express');
const session = require('express-session');
const { JsonSessionStore } = require('./storage/sessionStore');
const mw = require('./middleware');

const ROOT = path.join(__dirname, '..');

/** Baut die Express-App. Wird von server.js und den Tests verwendet. */
function createApp({ config, repos, sessionStore }) {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(ROOT, 'views'));
  app.disable('x-powered-by');

  app.use('/vendor/pico', express.static(path.join(ROOT, 'node_modules/@picocss/pico/css')));
  app.use(express.static(path.join(ROOT, 'public')));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(session({
    name: 'haushalt.sid',
    secret: config.sessionSecret,
    store: sessionStore || new JsonSessionStore({ dir: config.dataDir }),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, maxAge: 30 * 24 * 60 * 60 * 1000 },
  }));
  app.use(mw.locals);

  // Öffentlich
  app.use(require('./routes/auth')(repos));

  // Ab hier nur angemeldet
  app.use(mw.requireLogin, mw.csrf, mw.recurringDaily(repos));
  app.use(require('./routes/dashboard')(repos));
  app.use(require('./routes/month')(repos));
  app.use(require('./routes/transactions')(repos));
  app.use(require('./routes/accounts')(repos));
  app.use(require('./routes/assets')(repos));
  app.use(require('./routes/recurring')(repos));
  app.use(require('./routes/categories')(repos));
  app.use(require('./routes/profile')(repos));

  app.use(mw.notFound);
  app.use(mw.errorHandler);
  return app;
}

module.exports = { createApp };
