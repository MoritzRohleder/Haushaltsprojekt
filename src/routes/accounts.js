'use strict';

const express = require('express');
const accounts = require('../services/accounts');
const { loadContext } = require('../services/overview');
const { getVisibleAccount } = require('../services/visibility');
const { ledger } = require('../services/balances');
const { flash } = require('../middleware');
const { centsToInput } = require('../utils/money');
const { today } = require('../utils/dates');
const { handleForm, sortByName, contextOptions } = require('./helpers');

module.exports = (repos) => {
  const router = express.Router();

  const allUsers = async () => (await repos.users.findAll())
    .map((u) => ({ id: u.id, username: u.username }))
    .sort((a, b) => a.username.localeCompare(b.username, 'de'));

  async function renderForm(req, res, { values, errors = [], account = null }) {
    res.render('accounts/form', {
      title: account ? 'Konto bearbeiten' : 'Neues Konto',
      values, errors, account, users: await allUsers(), types: accounts.ACCOUNT_TYPES,
    });
  }

  router.get('/konten', async (req, res) => {
    const ctx = await loadContext(repos, req.session.user.id, contextOptions(req));
    const usersById = new Map((await allUsers()).map((u) => [u.id, u.username]));
    res.render('accounts/list', {
      title: 'Konten', ctx, usersById, types: accounts.ACCOUNT_TYPES,
      active: sortByName(ctx.accounts.filter((a) => !a.archived)),
      archived: sortByName(ctx.accounts.filter((a) => a.archived)),
    });
  });

  router.get('/konten/neu', async (req, res) => {
    await renderForm(req, res, {
      values: { type: 'giro', opening_balance: '0,00', opening_date: today(), owner_ids: [req.session.user.id] },
    });
  });

  router.post('/konten', async (req, res) => {
    await handleForm(res, async () => {
      const account = await accounts.createAccount(repos, req.session.user.id, req.body);
      flash(req, `Konto „${account.name}“ angelegt.`);
      res.redirect(`/konten/${account.id}`);
    }, (errors) => renderForm(req, res, { values: req.body, errors }));
  });

  router.get('/konten/:id', async (req, res) => {
    const account = await getVisibleAccount(repos, req.session.user.id, req.params.id);
    const ctx = await loadContext(repos, req.session.user.id, contextOptions(req));
    const usersById = new Map((await allUsers()).map((u) => [u.id, u.username]));
    res.render('accounts/detail', {
      title: account.name, ctx, account, usersById, types: accounts.ACCOUNT_TYPES,
      rows: ledger(account, ctx.rows).reverse(),
      balance: ctx.balance(account),
    });
  });

  router.get('/konten/:id/bearbeiten', async (req, res) => {
    const account = await getVisibleAccount(repos, req.session.user.id, req.params.id);
    await renderForm(req, res, {
      account,
      values: {
        ...account,
        opening_balance: centsToInput(Math.abs(account.opening_balance_cents)),
        opening_balance_sign: account.opening_balance_cents < 0 ? 'minus' : 'plus',
      },
    });
  });

  router.post('/konten/:id/bearbeiten', async (req, res) => {
    const account = await getVisibleAccount(repos, req.session.user.id, req.params.id);
    await handleForm(res, async () => {
      const updated = await accounts.updateAccount(repos, req.session.user.id, account.id, req.body);
      flash(req, 'Konto gespeichert.');
      res.redirect(updated.owner_ids.includes(req.session.user.id) ? `/konten/${account.id}` : '/konten');
    }, (errors) => renderForm(req, res, { account, values: req.body, errors }));
  });

  router.post('/konten/:id/archivieren', async (req, res) => {
    const archived = req.body.archived === 'true';
    await accounts.setArchived(repos, req.session.user.id, req.params.id, archived);
    flash(req, archived ? 'Konto archiviert.' : 'Konto wiederhergestellt.');
    res.redirect(`/konten/${req.params.id}`);
  });

  router.post('/konten/:id/loeschen', async (req, res) => {
    await accounts.deleteAccount(repos, req.session.user.id, req.params.id);
    flash(req, 'Konto gelöscht.');
    res.redirect('/konten');
  });

  return router;
};
