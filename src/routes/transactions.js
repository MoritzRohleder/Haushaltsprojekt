'use strict';

const express = require('express');
const { loadContext } = require('../services/overview');
const { visibleCategories, getVisibleTransaction } = require('../services/visibility');
const tx = require('../services/transactions');
const recurring = require('../services/recurring');
const { flash } = require('../middleware');
const { centsToInput } = require('../utils/money');
const { today, parts, monthRange, formatDate, MONTH_NAMES } = require('../utils/dates');
const { toCsv, centsToCsv } = require('../utils/csv');
const { NotFoundError } = require('../utils/errors');
const { handleForm, sortByName, contextOptions } = require('./helpers');

const TYPES = { einnahme: 'income', ausgabe: 'expense', transfer: 'transfer' };
const TITLES = { income: 'Einnahme', expense: 'Ausgabe', transfer: 'Transfer' };

module.exports = (repos) => {
  const router = express.Router();

  /** Daten für das Buchungsformular. */
  async function formData(userId, type, { includeHidden = false } = {}) {
    const ctx = await loadContext(repos, userId);
    return {
      accounts: sortByName(ctx.accounts.filter((a) => !a.archived)),
      assets: sortByName(ctx.assets.filter((a) => !a.archived)),
      categories: type === 'transfer' ? [] : await visibleCategories(repos, userId, { kind: type, includeHidden }),
      unitLabels: recurring.UNIT_LABELS,
      monthNames: MONTH_NAMES,
    };
  }

  async function renderForm(req, res, { type, values, errors = [], editing = null }) {
    res.render('transactions/form', {
      title: `${TITLES[type]} ${editing ? 'bearbeiten' : 'erfassen'}`,
      type, values, errors, editing,
      ...(await formData(req.session.user.id, type, { includeHidden: Boolean(editing) })),
    });
  }

  // ---- Liste mit Filtern (F-24) ---------------------------------------------

  /** Filter aus der Adresszeile lesen und anwenden; `alle=1` hebt die Monatsgrenze auf. */
  function filterRows(ctx, query) {
    const filters = {
      monat: /^\d{4}-\d{2}$/.test(query.monat || '') ? query.monat : today().slice(0, 7),
      alle: query.alle === '1',
      konto: String(query.konto || ''),
      kategorie: String(query.kategorie || ''),
      art: String(query.art || ''),
      q: String(query.q || '').trim(),
    };
    const [y, m] = filters.monat.split('-').map(Number);
    const { from, to } = monthRange(y, m);
    const q = filters.q.toLowerCase();
    const rows = ctx.rows
      .filter((t) => filters.alle || (t.date >= from && t.date <= to))
      .filter((t) => !filters.konto || t.account_id === filters.konto)
      .filter((t) => !filters.kategorie || t.category_id === filters.kategorie)
      .filter((t) => !filters.art || ctx.classify(t) === filters.art)
      .filter((t) => !q || `${t.description} ${t.note} ${ctx.label(t)}`.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
    return { filters, rows };
  }

  router.get('/buchungen', async (req, res) => {
    const ctx = await loadContext(repos, req.session.user.id, contextOptions(req));
    const { filters, rows } = filterRows(ctx, req.query);
    res.render('transactions/list', {
      title: 'Buchungen', ctx, rows, filters,
      exportQuery: new URLSearchParams(Object.entries(req.query).filter(([k]) => ['monat', 'alle', 'konto', 'kategorie', 'art', 'q'].includes(k)).map(([k, v]) => [k, String(v)])).toString(),
      accounts: sortByName(ctx.accounts),
      categories: await visibleCategories(repos, req.session.user.id, { includeArchived: true, includeHidden: true }),
    });
  });

  /** CSV-Export der gefilterten Buchungen (F-60). */
  router.get('/buchungen/export.csv', async (req, res) => {
    const ctx = await loadContext(repos, req.session.user.id, contextOptions(req));
    const { filters, rows } = filterRows(ctx, req.query);
    const KIND = { income: 'Einnahme', expense: 'Ausgabe', transfer: 'Transfer' };
    const csv = toCsv(
      ['Datum', 'Konto', 'Art', 'Kategorie / Gegenseite', 'Beschreibung', 'Notiz', 'Betrag (EUR)', 'Regelmäßig'],
      [...rows].reverse().map((t) => [
        formatDate(t.date),
        ctx.accountsById.get(t.account_id)?.name ?? '',
        KIND[ctx.classify(t)],
        ctx.label(t),
        t.description,
        t.note,
        centsToCsv(t.amount_cents),
        t.recurring_id ? 'ja' : '',
      ]),
    );
    const name = filters.alle ? 'buchungen-alle' : `buchungen-${filters.monat}`;
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}.csv"`,
      'Cache-Control': 'no-store',
    });
    res.send(csv);
  });

  // ---- Neu ------------------------------------------------------------------

  router.get('/buchungen/neu', async (req, res) => {
    if (req.query.vorlage) return duplicateForm(req, res);
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

  /** „Nochmal buchen“ (F-26): Formular mit den Werten einer bestehenden Buchung, Datum heute. */
  async function duplicateForm(req, res) {
    const row = await getVisibleTransaction(repos, req.session.user.id, req.query.vorlage);
    const values = {
      date: today(),
      amount: centsToInput(Math.abs(row.amount_cents)),
      account_id: row.account_id,
      category_id: row.category_id || '',
      description: row.description,
      note: row.note,
      interval_count: '1',
      interval_unit: 'month',
    };
    if (row.type === 'transfer') {
      const here = `account:${row.account_id}`;
      const there = row.counter_asset_id ? `asset:${row.counter_asset_id}` : `account:${row.counter_account_id}`;
      Object.assign(values, row.amount_cents < 0 ? { from: here, to: there } : { from: there, to: here });
    }
    await renderForm(req, res, { type: row.type, values });
  }

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
    const ctx = await loadContext(repos, req.session.user.id, contextOptions(req));
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
      const ctx = await loadContext(repos, req.session.user.id, contextOptions(req));
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
