'use strict';

const express = require('express');
const auth = require('../services/auth');
const preferences = require('../services/preferences');
const { flash, safeBack } = require('../middleware');
const { handleForm } = require('./helpers');

module.exports = (repos) => {
  const router = express.Router();

  router.post('/logout', (req, res, next) => {
    req.session.destroy((err) => (err ? next(err) : res.redirect('/login')));
  });

  const render = (res, errors = []) => res.render('profile', { title: 'Profil', errors, themes: preferences.THEMES });

  router.get('/profil', (req, res) => render(res));

  router.post('/profil', async (req, res) => {
    await handleForm(res, async () => {
      await auth.changePassword(repos, req.session.user.id, req.body);
      flash(req, 'Passwort geändert.');
      res.redirect('/profil');
    }, (errors) => render(res, errors));
  });

  /**
   * Darstellungsmodus speichern. Der Umschalter in der Navigation ruft das per
   * fetch auf (Antwort 204); ohne JavaScript ist es ein normales Formular.
   */
  router.post('/einstellungen/darstellung', async (req, res) => {
    await preferences.setTheme(repos, req.session.user.id, req.body.theme);
    if (req.get('x-requested-with') === 'fetch') return res.status(204).end();
    res.redirect(safeBack(req.body.back, '/profil'));
  });

  return router;
};
