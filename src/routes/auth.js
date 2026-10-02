'use strict';

const express = require('express');
const auth = require('../services/auth');
const { handleForm } = require('./helpers');
const { describeWait } = require('../services/loginThrottle');

function login(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.user = user;
      resolve();
    });
  });
}

module.exports = (repos, throttle) => {
  const router = express.Router();

  router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('auth/login', { title: 'Anmelden', errors: [], values: {} });
  });

  router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const values = { username };
    const wait = throttle.retryAfter(req.ip, username);
    if (wait > 0) {
      res.set('Retry-After', String(Math.ceil(wait / 1000)));
      return res.status(429).render('auth/login', {
        title: 'Anmelden', values,
        errors: [`Zu viele Fehlversuche. Bitte warte ${describeWait(wait)} und versuche es dann erneut.`],
      });
    }
    const user = await auth.authenticate(repos, username, password);
    if (!user) {
      throttle.failure(req.ip, username);
      return res.status(401).render('auth/login', {
        title: 'Anmelden', errors: ['Nutzername oder Passwort falsch.'], values,
      });
    }
    throttle.success(req.ip, username);
    await login(req, user);
    res.redirect('/');
  });

  router.get('/registrieren', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('auth/register', { title: 'Registrieren', errors: [], values: {} });
  });

  router.post('/registrieren', async (req, res) => {
    await handleForm(res, async () => {
      const user = await auth.register(repos, req.body);
      await login(req, user);
      req.session.flash = { type: 'success', text: `Willkommen, ${user.username}! Lege als Erstes ein Konto an.` };
      res.redirect('/');
    }, (errors) => res.render('auth/register', {
      title: 'Registrieren', errors, values: { username: req.body.username },
    }));
  });

  return router;
};
