'use strict';

const express = require('express');
const { loadContext } = require('../services/overview');
const { visibleCategories, getVisibleTransaction } = require('../services/visibility');
const tx = require('../services/transactions');
const recurring = require('../services/recurring');
const { flash } = require('../middleware');
const { centsToInput } = require('../utils/money');
const { today, parts, monthRange, MONTH_NAMES } = require('../utils/dates');
const { NotFoundError } = require('../utils/errors');
const { handleForm, sortByName } = require('./helpers');

const TYPES = { einnahme: 'income', ausgabe: 'expense', transfer: 'transfer' };
const TITLES = { income: 'Einnahme', expense: 'Ausgabe', transfer: 'Transfer' };

module.exports = (repos) => {
  const router = express.Router();

  /** Daten für das Buchungsformular. */
  async function formData(userId, type) {
    const ctx = await loadContext(repos, userId);
    return {
      accounts: sortByName(ctx.accounts.filter((a) => !a.archived)),
      assets: sortByName(ctx.assets.filter((a) => !a.archived)),
      categories: type === 'transfer' ? [] : await visibleCategories(repos, userId, { kind: type }),
      unitLabels: recurring.UNIT_LABELS,
      monthNames: MONTH_NAMES,
    };
  }

  async function renderForm(req, res, { type, values, errors = [], editing = null }) {
    res.render('transactions/form', {
      title: `${TITLES[type]} ${editing ? 'bearbeiten' : 'erfassen'}`,
      type, values, errors, editing,
      ...(await formData(req.session.user.id, type)),
    });
  }

  // ---- Liste mit Filtern (F-24) ---------------------------------------------

  router.get('/buchungen', async (req, res) => {
    const ctx = await loadContext(repos, req.session.user.id);
    const filters = {
      monat: /^\d{4}-\d{2}$/.test(req.query.monat || '') ? req.query.monat : today().slice(0, 7),
      konto: req.query.konto || '',
      kategorie: req.query.kategorie || '',
      art: req.query.art || '',
      q: String(req.query.q || '').trim(),
    };
    const [y, m] = filters.monat.split('-').map(Number);
    const { from, to } = monthRange(y, m);
    const q = filters.q.toLowerCase();
    const rows = ctx.rows
      .filter((t) => t.date >= from && t.date <= to)
      .filter((t) => !filters.konto || t.account_id === filters.konto)
      .filter((t) => !filters.kategorie || t.category_id === filters.kategorie)
      .filter((t) => !filters.art || ctx.classify(t) === filters.art)
      .filter((t) => !q || `${t.description} ${t.note} ${ctx.label(t)}`.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
    res.render('transactions/list', {
      title: 'Buchungen', ctx, rows, filters,
      accounts: sortByName(ctx.accounts),
      categories: await visibleCategories(repos, req.session.user.id, { includeArchived: true }),
    });
  });

  // ---- Neu ------------------------------------------------------------------

  router.get('/buchungen/neu', async (req, res) => {
    const type = TYPES[req.query.typ] || 'expense';
    await renderForm(req, res, {
      type,
      values: {
        date: today(),
        account_id: req.query.konto || req.session.lastAccountId || '',
        from: req.query.von || (req.session.lastAccountId ? `account:${req.session.lastAccountId}` : ''),
        to: req.query.nach || '',
        interval_count: '1',
        interval_unit: 'month',
      },
    });
  });

  router.post('/buchungen', async (req, res) => {
    const type = TYPES[req.body.typ] ? TYPES[req.body.typ] : req.body.type;
    if (!TITLES[type]) throw new NotFoundError();
    const input = { ...req.body, type };
    await handleForm(res, async () => {
      const result = await recurring.createFromForm(repos, req.session.user.id, input);
      const accountId = type === 'transfer' ? tx.parseEndpoint(input.from)?.id : input.account_id;
      req.session.lastAccountId = accountId;
      flash(req, result.recurring
        ? `Regelmäßige Buchung „${result.recurring.description}“ angelegt (${recurring.describeInterval(result.recurring)}).`
        : 'Buchung gespeichert.');
      if (req.body.weitere) {
        const typ = Object.keys(TYPES).find((k) => TYPES[k] === type);
        return res.redirect(`/buchungen/neu?typ=${typ}`);
      }
      const { year, month } = parts(input.date);
      res.redirect(`/buchungen?monat=${year}-${String(month).padStart(2, '0')}`);
    }, (errors) => renderForm(req, res, { type, values: req.body, errors }));
  });

  // ---- Bearbeiten / Löschen -------------------------------------------------

  router.get('/buchungen/:id/bearbeiten', async (req, res) => {
    const row = await getVisibleTransaction(repos, req.session.user.id, req.params.id);
    const ctx = await loadContext(repos, req.session.user.id);
    await renderForm(req, res, {
      type: row.type,
      editing: { ...row, label: ctx.label(row), accountName: ctx.accountsById.get(row.account_id)?.name },
      values: {
        date: row.date,
        amount: centsToInput(Math.abs(row.amount_cents)),
        account_id: row.account_id,
        category_id: row.category_id || '',
        description: row.description,
        note: row.note,
      },
    });
  });

  router.post('/buchungen/:id/bearbeiten', async (req, res) => {
    const row = await getVisibleTransaction(repos, req.session.user.id, req.params.id);
    await handleForm(res, async () => {
      await tx.updateTransaction(repos, req.session.user.id, row.id, req.body);
      flash(req, 'Buchung geändert.');
      res.redirect(`/konten/${row.account_id}`);
    }, async (errors) => {
      const ctx = await loadContext(repos, req.session.user.id);
      await renderForm(req, res, {
        type: row.type, values: req.body, errors,
        editing: { ...row, label: ctx.label(row), accountName: ctx.accountsById.get(row.account_id)?.name },
      });
    });
  });

  router.post('/buchungen/:id/loeschen', async (req, res) => {
    const row = await getVisibleTransaction(repos, req.session.user.id, req.params.id);
    await tx.deleteTransaction(repos, req.session.user.id, row.id);
    flash(req, row.transfer_id ? 'Transfer gelöscht (beide Seiten).' : 'Buchung gelöscht.');
    res.redirect(`/konten/${row.account_id}`);
  });

  return router;
};
