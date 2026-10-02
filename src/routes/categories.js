'use strict';

const express = require('express');
const categories = require('../services/categories');
const preferences = require('../services/preferences');
const { visibleCategories } = require('../services/visibility');
const { flash } = require('../middleware');
const { handleForm } = require('./helpers');

module.exports = (repos) => {
  const router = express.Router();

  async function render(req, res, { errors = [], values = {} } = {}) {
    const all = await visibleCategories(repos, req.session.user.id, { includeArchived: true, includeHidden: true });
    res.render('categories', {
      title: 'Kategorien', errors, values, kinds: categories.KINDS,
      standard: all.filter((c) => c.owner_id === null && !c.archived),
      own: all.filter((c) => c.owner_id !== null),
    });
  }

  router.get('/kategorien', (req, res) => render(req, res, { values: { kind: 'expense' } }));

  router.post('/kategorien', async (req, res) => {
    await handleForm(res, async () => {
      const category = await categories.createCategory(repos, req.session.user.id, req.body);
      flash(req, `Kategorie „${category.name}“ angelegt.`);
      res.redirect('/kategorien');
    }, (errors) => render(req, res, { errors, values: req.body }));
  });

  router.post('/kategorien/:id/umbenennen', async (req, res) => {
    await handleForm(res, async () => {
      await categories.renameCategory(repos, req.session.user.id, req.params.id, req.body);
      flash(req, 'Kategorie umbenannt.');
      res.redirect('/kategorien');
    }, (errors) => render(req, res, { errors, values: { kind: 'expense' } }));
  });

  /** Standard-Kategorie für sich selbst aus-/einblenden (F-15). */
  router.post('/kategorien/:id/ausblenden', async (req, res) => {
    const hidden = req.body.hidden === 'true';
    await preferences.setCategoryHidden(repos, req.session.user.id, req.params.id, hidden);
    flash(req, hidden ? 'Kategorie ausgeblendet. Sie wird bei neuen Buchungen nicht mehr angeboten.' : 'Kategorie wieder eingeblendet.');
    res.redirect('/kategorien');
  });

  router.post('/kategorien/:id/archivieren', async (req, res) => {
    const archived = req.body.archived === 'true';
    await categories.setArchived(repos, req.session.user.id, req.params.id, archived);
    flash(req, archived ? 'Kategorie archiviert.' : 'Kategorie wiederhergestellt.');
    res.redirect('/kategorien');
  });

  router.post('/kategorien/:id/loeschen', async (req, res) => {
    await categories.deleteCategory(repos, req.session.user.id, req.params.id);
    flash(req, 'Kategorie gelöscht.');
    res.redirect('/kategorien');
  });

  return router;
};
