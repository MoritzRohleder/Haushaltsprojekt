'use strict';

const express = require('express');
const { multi, allows, toQuery } = require('../utils/filters');
const { loadContext } = require('../services/overview');
const { visibleCategories, getVisibleTransaction } = require('../services/visibility');
const tx = require('../services/transactions');
const recurring = require('../services/recurring');
const { flash } = require('../middleware');
const { centsToInput, formatEuro } = require('../utils/money');
const { today, parts, monthRange, formatDate, MONTH_NAMES } = require('../utils/dates');
const { toCsv, centsToCsv } = require('../utils/csv');
const { NotFoundError } = require('../utils/errors');
const purchase = require('../services/purchase');
const { handleForm, sortByName, contextOptions } = require('./helpers');

const TYPES = { einnahme: 'income', ausgabe: 'expense', transfer: 'transfer' };

/** Artikel einer Buchung als Formularwerte (parallele Listen). */
function itemValues(items = []) {
  return {
    item_name: items.map((i) => i.name),
    item_qty: items.map((i) => String(i.quantity).replace('.', ',')),
    item_price: items.map((i) => centsToInput(i.unit_price_cents)),
  };
}
const TITLES = { income: 'Einnahme', expense: 'Ausgabe', transfer: 'Transfer' };

module.exports = (repos) => {
  const router = express.Router();

  /** Erfolgsmeldung; mit Hinweis, wenn die Artikelsumme vom Betrag abweicht. */
  function savedMessage(req, booking, text) {
    const items = booking?.items || [];
    const sum = purchase.itemsTotal(items);
    if (items.length && booking.type === 'expense' && sum !== -booking.amount_cents) {
      flash(req, `${text} Hinweis: Die Artikel ergeben ${formatEuro(sum)}, der Betrag ist ${formatEuro(-booking.amount_cents)}.`, 'warning');
    } else {
      flash(req, text);
    }
  }

  /** Bisher verwendete Geschäfte, häufigste zuerst (Vorschläge beim Tippen). */
  function knownMerchants(ctx) {
    const counts = new Map();
    for (const t of ctx.rows) {
      if (t.merchant) counts.set(t.merchant, (counts.get(t.merchant) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de')).map(([m]) => m);
  }

  /** Daten für das Buchungsformular. */
  async function formData(userId, type, { includeHidden = false } = {}) {
    const ctx = await loadContext(repos, userId);
    return {
      merchants: knownMerchants(ctx),
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
      konto: multi(query.konto),
      kategorie: multi(query.kategorie),
      art: multi(query.art, ['income', 'expense', 'transfer']),
      geschaeft: multi(query.geschaeft),
      q: String(query.q || '').trim(),
    };
    const [y, m] = filters.monat.split('-').map(Number);
    const { from, to } = monthRange(y, m);
    const q = filters.q.toLowerCase();
    const rows = ctx.rows
      .filter((t) => filters.alle || (t.date >= from && t.date <= to))
      .filter((t) => allows(filters.konto, t.account_id))
      .filter((t) => allows(filters.kategorie, t.category_id))
      .filter((t) => allows(filters.art, ctx.classify(t)))
      .filter((t) => allows(filters.geschaeft, t.merchant))
      .filter((t) => !q || searchText(ctx, t).includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
    return { filters, rows };
  }

  /** Durchsuchbarer Text einer Buchung: Beschreibung, Notiz, Gegenseite, Geschäft, Artikel. */
  function searchText(ctx, t) {
    return [t.description, t.note, ctx.label(t), t.merchant, ...(t.items || []).map((i) => i.name)]
      .filter(Boolean).join(' ').toLowerCase();
  }

  router.get('/buchungen', async (req, res) => {
    const ctx = await loadContext(repos, req.session.user.id, contextOptions(req));
    const { filters, rows } = filterRows(ctx, req.query);
    res.render('transactions/list', {
      title: 'Buchungen', ctx, rows, filters,
      exportQuery: toQuery(filters, ['monat', 'alle', 'konto', 'kategorie', 'art', 'geschaeft', 'q']),
      merchants: knownMerchants(ctx).sort((a, b) => a.localeCompare(b, 'de')),
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
      ['Datum', 'Konto', 'Art', 'Kategorie / Gegenseite', 'Geschäft', 'Beschreibung', 'Notiz', 'Betrag (EUR)', 'Artikel', 'Kassenzettel', 'Regelmäßig'],
      [...rows].reverse().map((t) => [
        formatDate(t.date),
        ctx.accountsById.get(t.account_id)?.name ?? '',
        KIND[ctx.classify(t)],
        ctx.label(t),
        t.merchant || '',
        t.description,
        t.note,
        centsToCsv(t.amount_cents),
        (t.items || []).map((i) => `${i.name} (${String(i.quantity).replace('.', ',')} × ${centsToCsv(i.unit_price_cents)})`).join('; '),
        t.receipt ? 'ja' : '',
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
      merchant: row.merchant || '',
      ...itemValues(row.items),
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
    const input = { ...req.body, type, receiptUpload: req.file };
    await handleForm(res, async () => {
      const result = await recurring.createFromForm(repos, req.session.user.id, input);
      const accountId = type === 'transfer' ? tx.parseEndpoint(input.from)?.id : input.account_id;
      req.session.lastAccountId = accountId;
      if (result.recurring) {
        flash(req, `Regelmäßige Buchung „${result.recurring.description}“ angelegt (${recurring.describeInterval(result.recurring)}).`);
      } else {
        savedMessage(req, result.booking, 'Buchung gespeichert.');
      }
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
        merchant: row.merchant || '',
        ...itemValues(row.items),
      },
    });
  });

  router.post('/buchungen/:id/bearbeiten', async (req, res) => {
    const row = await getVisibleTransaction(repos, req.session.user.id, req.params.id);
    await handleForm(res, async () => {
      const updated = await tx.updateTransaction(repos, req.session.user.id, row.id, { ...req.body, receiptUpload: req.file });
      savedMessage(req, updated, 'Buchung geändert.');
      res.redirect(`/konten/${row.account_id}`);
    }, async (errors) => {
      const ctx = await loadContext(repos, req.session.user.id, contextOptions(req));
      await renderForm(req, res, {
        type: row.type, values: req.body, errors,
        editing: { ...row, label: ctx.label(row), accountName: ctx.accountsById.get(row.account_id)?.name },
      });
    });
  });

  /** Kassenzettel einer sichtbaren Buchung anzeigen (F-29). */
  router.get('/buchungen/:id/beleg', async (req, res) => {
    const row = await getVisibleTransaction(repos, req.session.user.id, req.params.id);
    if (!row.receipt?.file) throw new NotFoundError('Kein Kassenzettel vorhanden');
    const name = encodeURIComponent(row.receipt.original_name || `beleg.${row.receipt.file.split('.').pop()}`);
    res.set({
      'Content-Type': row.receipt.mime,
      'Content-Disposition': `${req.query.download ? 'attachment' : 'inline'}; filename*=UTF-8''${name}`,
      'Cache-Control': 'private, no-store',
    });
    res.sendFile(repos.files.path(row.receipt.file), (err) => {
      if (err && !res.headersSent) res.status(404).end();
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
