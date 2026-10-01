'use strict';

const express = require('express');
const recurring = require('../services/recurring');
const { loadContext } = require('../services/overview');
const { flash } = require('../middleware');
const { centsToInput } = require('../utils/money');
const { nthOccurrence, today } = require('../utils/dates');
const { handleForm } = require('./helpers');

/** Nächster noch nicht gebuchter Termin einer Vorlage. */
function nextDate(rec) {
  if (!rec.active) return null;
  for (let n = 0; n < 100000; n++) {
    const date = nthOccurrence(rec.start_date, rec.interval_unit, rec.interval_count, n);
    if (rec.end_date && date > rec.end_date) return null;
    if (!rec.last_generated_date || date > rec.last_generated_date) return date;
  }
  return null;
}

module.exports = (repos) => {
  const router = express.Router();

  function describe(ctx, rec) {
    const from = ctx.accountsById.get(rec.account_id)?.name ?? '?';
    let target = '';
    if (rec.to_account_id) target = ctx.accountsById.get(rec.to_account_id)?.name ?? '?';
    if (rec.to_asset_id) target = ctx.assetsById.get(rec.to_asset_id)?.name ?? '?';
    return {
      ...rec,
      route: rec.type === 'transfer' ? `${from} → ${target}` : from,
      category: ctx.categoriesById.get(rec.category_id)?.name ?? '',
      rhythm: recurring.describeInterval(rec.interval_count, rec.interval_unit),
      next: nextDate(rec),
    };
  }

  router.get('/wiederkehrend', async (req, res) => {
    const ctx = await loadContext(repos, req.session.user.id);
    const list = (await recurring.listForUser(repos, req.session.user.id)).map((r) => describe(ctx, r));
    res.render('recurring/list', { title: 'Regelmäßige Buchungen', list, today: today() });
  });

  async function renderForm(req, res, { rec, values, errors = [] }) {
    const ctx = await loadContext(repos, req.session.user.id);
    res.render('recurring/form', {
      title: 'Regelmäßige Buchung bearbeiten', rec: describe(ctx, rec), values, errors, unitLabels: recurring.UNIT_LABELS,
    });
  }

  router.get('/wiederkehrend/:id/bearbeiten', async (req, res) => {
    const rec = await recurring.getForUser(repos, req.session.user.id, req.params.id);
    await renderForm(req, res, {
      rec, values: { ...rec, amount: centsToInput(rec.amount_cents), end_date: rec.end_date || '' },
    });
  });

  router.post('/wiederkehrend/:id/bearbeiten', async (req, res) => {
    const rec = await recurring.getForUser(repos, req.session.user.id, req.params.id);
    await handleForm(res, async () => {
      await recurring.updateRecurring(repos, req.session.user.id, rec.id, req.body);
      flash(req, 'Regelmäßige Buchung gespeichert. Die Änderung gilt für künftige Termine.');
      res.redirect('/wiederkehrend');
    }, (errors) => renderForm(req, res, { rec, values: req.body, errors }));
  });

  router.post('/wiederkehrend/:id/aktiv', async (req, res) => {
    const active = req.body.active === 'true';
    await recurring.setActive(repos, req.session.user.id, req.params.id, active);
    flash(req, active ? 'Regelmäßige Buchung fortgesetzt.' : 'Regelmäßige Buchung pausiert.');
    res.redirect('/wiederkehrend');
  });

  router.post('/wiederkehrend/:id/loeschen', async (req, res) => {
    await recurring.deleteRecurring(repos, req.session.user.id, req.params.id);
    flash(req, 'Regelmäßige Buchung gelöscht. Bereits gebuchte Termine bleiben erhalten.');
    res.redirect('/wiederkehrend');
  });

  return router;
};
