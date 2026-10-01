'use strict';

const express = require('express');
const auth = require('../services/auth');
const { flash } = require('../middleware');
const { handleForm } = require('./helpers');

module.exports = (repos) => {
  const router = express.Router();

  router.post('/logout', (req, res, next) => {
    req.session.destroy((err) => (err ? next(err) : res.redirect('/login')));
  });

  router.get('/profil', (req, res) => {
    res.render('profile', { title: 'Profil', errors: [] });
  });

  router.post('/profil', async (req, res) => {
    await handleForm(res, async () => {
      await auth.changePassword(repos, req.session.user.id, req.body);
      flash(req, 'Passwort geändert.');
      res.redirect('/profil');
    }, (errors) => res.render('profile', { title: 'Profil', errors }));
  });

  return router;
};
