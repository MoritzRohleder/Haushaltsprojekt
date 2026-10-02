'use strict';

const path = require('node:path');
const express = require('express');
const session = require('express-session');
const { JsonSessionStore } = require('./storage/sessionStore');
const { LoginThrottle } = require('./services/loginThrottle');
const { Manual } = require('./services/manual');
const mw = require('./middleware');

const ROOT = path.join(__dirname, '..');

/** Baut die Express-App. Wird von server.js und den Tests verwendet. */
function createApp({ config, repos, sessionStore, loginThrottle = new LoginThrottle(), manual = new Manual() }) {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(ROOT, 'views'));
  app.set('trust proxy', config.trustProxy ?? false);
  app.set('config', config);
  app.disable('x-powered-by');

  // Für Docker-Healthcheck und Monitoring – ohne Sitzung.
  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use(mw.securityHeaders({ hsts: config.cookieSecure }));
  const staticOptions = { maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0 };
  app.use('/vendor/pico', express.static(path.join(ROOT, 'node_modules/@picocss/pico/css'), staticOptions));
  app.use(express.static(path.join(ROOT, 'public'), staticOptions));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(session({
    name: 'haushalt.sid',
    secret: config.sessionSecret,
    store: sessionStore || new JsonSessionStore({ dir: config.dataDir }),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, maxAge: 30 * 24 * 60 * 60 * 1000 },
  }));
  app.use(mw.locals(repos));

  // Öffentlich
  app.use(require('./routes/auth')(repos, loginThrottle));
  app.use(require('./routes/manual')(manual));

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
  app.use(require('./routes/reports')(repos));

  app.use(mw.notFound);
  app.use(mw.errorHandler);
  return app;
}

module.exports = { createApp };
