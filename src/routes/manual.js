'use strict';

const express = require('express');
const { NotFoundError } = require('../utils/errors');

/** Handbuch in der Anwendung (F-07) – auch ohne Anmeldung lesbar. */
module.exports = (manual) => {
  const router = express.Router();

  const render = (res, page, extra = {}) => res.render('manual', {
    title: page ? `${page.title} – Handbuch` : 'Handbuch',
    page, chapters: manual.chapters(), query: '', results: null, ...extra,
  });

  router.get('/handbuch', (req, res) => {
    const query = String(req.query.suche || '').trim().slice(0, 100);
    if (query) return render(res, null, { query, results: manual.search(query) });
    render(res, manual.render());
  });

  router.get('/handbuch/:seite', (req, res) => {
    if (req.params.seite === 'Home' || req.params.seite === 'Handbuch') return res.redirect('/handbuch');
    const page = manual.render(req.params.seite);
    if (!page) throw new NotFoundError('Handbuchseite nicht gefunden');
    render(res, page);
  });

  return router;
};
