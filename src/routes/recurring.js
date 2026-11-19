'use strict';

const express = require('express');
const recurring = require('../services/recurring');
const recurringOverview = require('../services/recurringOverview');
const { loadContext } = require('../services/overview');
const { flash, backOr } = require('../middleware');
const { centsToInput } = require('../utils/money');
const { MONTH_NAMES } = require('../utils/dates');
const { handleForm, contextOptions } = require('./helpers');

module.exports = (repos) => {
  const router = express.Router();

  router.get('/wiederkehrend', async (req, res) => {
    const ctx = await loadContext(repos, req.session.user.id, contextOptions(req));
    const templates = await recurring.listForUser(repos, req.session.user.id);
    const overview = recurringOverview.buildOverview(ctx, templates, req.query);
    res.render('recurring/list', {
      title: 'Regelmäßige Buchungen', ...overview,
    });
  });

  /**
   * Bereits gebuchte Termine der Vorlage (je Transfer eine Zeile: die abgehende Seite,
   * sonst die sichtbare) – zum gezielten Ändern einzelner Termine (F-33).
   */
  function bookedRows(ctx, rec) {
    const seen = new Set();
    return ctx.rows
      .filter((t) => t.recurring_id === rec.id)
      .sort((a, b) => (a.amount_cents < 0 ? -1 : 1) - (b.amount_cents < 0 ? -1 : 1))
      .filter((t) => {
        const key = t.transfer_id || t.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async function renderForm(req, res, { rec, values, errors = [] }) {
    const ctx = await loadContext(repos, req.session.user.id, contextOptions(req));
    res.render('recurring/form', {
      title: 'Regelmäßige Buchung bearbeiten', rec: recurringOverview.describe(ctx, rec), values, errors,
      unitLabels: recurring.UNIT_LABELS, monthNames: MONTH_NAMES,
      booked: bookedRows(ctx, rec), ctx,
      selfUrl: `/wiederkehrend/${rec.id}/bearbeiten${req.back ? `?zurueck=${encodeURIComponent(req.back)}` : ''}`,
    });
  }

  router.get('/wiederkehrend/:id/bearbeiten', async (req, res) => {
    const rec = await recurring.getForUser(repos, req.session.user.id, req.params.id);
    await renderForm(req, res, {
      rec,
      values: {
        ...rec, amount: centsToInput(rec.amount_cents), end_date: rec.end_date || '', start_date: rec.start_date,
        day_of_month: rec.day_of_month ?? '', month_of_year: rec.month_of_year ?? '',
      },
    });
  });

  router.post('/wiederkehrend/:id/bearbeiten', async (req, res) => {
    const rec = await recurring.getForUser(repos, req.session.user.id, req.params.id);
    await handleForm(res, async () => {
      const saved = await recurring.updateRecurring(repos, req.session.user.id, rec.id, req.body);
      if (saved.rebuild) {
        const { created, removed } = saved.rebuild;
        const parts = [created && `${created} Termin${created === 1 ? '' : 'e'} nachgebucht`, removed && `${removed} Termin${removed === 1 ? '' : 'e'} vor dem neuen Start gelöscht`].filter(Boolean);
        flash(req, `Regelmäßige Buchung gespeichert. Startdatum geändert${parts.length ? `: ${parts.join(', ')}` : ''}.`);
      } else {
        flash(req, 'Regelmäßige Buchung gespeichert. Die Änderung gilt für künftige Termine.');
      }
      res.redirect(backOr(req, '/wiederkehrend'));
    }, (errors) => renderForm(req, res, { rec, values: req.body, errors }));
  });

  router.post('/wiederkehrend/:id/aktiv', async (req, res) => {
    const active = req.body.active === 'true';
    await recurring.setActive(repos, req.session.user.id, req.params.id, active);
    flash(req, active ? 'Regelmäßige Buchung fortgesetzt.' : 'Regelmäßige Buchung pausiert.');
    res.redirect(backOr(req, '/wiederkehrend'));
  });

  router.post('/wiederkehrend/:id/loeschen', async (req, res) => {
    await recurring.deleteRecurring(repos, req.session.user.id, req.params.id);
    flash(req, 'Regelmäßige Buchung gelöscht. Bereits gebuchte Termine bleiben erhalten.');
    res.redirect(backOr(req, '/wiederkehrend', { avoid: [`/wiederkehrend/${req.params.id}`] }));
  });

  return router;
};
