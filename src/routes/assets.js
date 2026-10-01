'use strict';

const express = require('express');
const assets = require('../services/assets');
const { loadContext } = require('../services/overview');
const { getVisibleAsset } = require('../services/visibility');
const { flash } = require('../middleware');
const { centsToInput } = require('../utils/money');
const { today, formatDate } = require('../utils/dates');
const { lineChart } = require('../utils/charts');
const { formatEuro } = require('../utils/money');
const { handleForm, sortByName, contextOptions } = require('./helpers');

/** Wertverlauf (F-45): ein Punkt je Tag mit Änderung, verlängert bis heute. */
function valueChart(history) {
  const byDate = new Map();
  for (const e of history) byDate.set(e.date, e.value_cents);
  const now = today();
  if (byDate.size && [...byDate.keys()].at(-1) < now) byDate.set(now, [...byDate.values()].at(-1));
  if (byDate.size < 2) return null;
  return lineChart([...byDate].map(([date, value]) => ({
    key: date, label: formatDate(date).slice(0, 6) + date.slice(2, 4), value,
    tooltip: `${formatDate(date)}: ${formatEuro(value)}`,
  })), { step: true });
}

module.exports = (repos) => {
  const router = express.Router();

  const allUsers = async () => (await repos.users.findAll())
    .map((u) => ({ id: u.id, username: u.username }))
    .sort((a, b) => a.username.localeCompare(b.username, 'de'));

  async function renderForm(req, res, { values, errors = [], asset = null }) {
    res.render('assets/form', {
      title: asset ? 'Anlage bearbeiten' : 'Neue Anlage',
      values, errors, asset, users: await allUsers(), types: assets.ASSET_TYPES,
    });
  }

  router.get('/anlagen', async (req, res) => {
    const ctx = await loadContext(repos, req.session.user.id, contextOptions(req));
    res.render('assets/list', {
      title: 'Anlagen', ctx, types: assets.ASSET_TYPES,
      active: sortByName(ctx.assets.filter((a) => !a.archived)),
      archived: sortByName(ctx.assets.filter((a) => a.archived)),
    });
  });

  router.get('/anlagen/neu', async (req, res) => {
    await renderForm(req, res, {
      values: { type: 'fund', start_value: '0,00', start_date: today(), owner_ids: [req.session.user.id] },
    });
  });

  router.post('/anlagen', async (req, res) => {
    await handleForm(res, async () => {
      const asset = await assets.createAsset(repos, req.session.user.id, req.body);
      flash(req, `Anlage „${asset.name}“ angelegt.`);
      res.redirect(`/anlagen/${asset.id}`);
    }, (errors) => renderForm(req, res, { values: req.body, errors }));
  });

  router.get('/anlagen/:id', async (req, res) => {
    const asset = await getVisibleAsset(repos, req.session.user.id, req.params.id);
    const ctx = await loadContext(repos, req.session.user.id, contextOptions(req));
    const usersById = new Map((await allUsers()).map((u) => [u.id, u.username]));
    const history = assets.assetHistory(asset, ctx.values, ctx.transactions);
    res.render('assets/detail', {
      title: asset.name, ctx, asset, usersById, types: assets.ASSET_TYPES,
      summary: ctx.assetSummary(asset),
      history: [...history].reverse(),
      chart: valueChart(history),
    });
  });

  router.get('/anlagen/:id/bearbeiten', async (req, res) => {
    const asset = await getVisibleAsset(repos, req.session.user.id, req.params.id);
    await renderForm(req, res, { asset, values: asset });
  });

  router.post('/anlagen/:id/bearbeiten', async (req, res) => {
    const asset = await getVisibleAsset(repos, req.session.user.id, req.params.id);
    await handleForm(res, async () => {
      const updated = await assets.updateAsset(repos, req.session.user.id, asset.id, req.body);
      flash(req, 'Anlage gespeichert.');
      res.redirect(updated.owner_ids.includes(req.session.user.id) ? `/anlagen/${asset.id}` : '/anlagen');
    }, (errors) => renderForm(req, res, { asset, values: req.body, errors }));
  });

  // ---- Stand manuell aktualisieren (F-41) ------------------------------------

  async function renderValueForm(req, res, { asset, values, errors = [] }) {
    const ctx = await loadContext(repos, req.session.user.id, contextOptions(req));
    res.render('assets/value', {
      title: `Stand aktualisieren: ${asset.name}`, asset, values, errors, summary: ctx.assetSummary(asset),
    });
  }

  router.get('/anlagen/:id/stand', async (req, res) => {
    const asset = await getVisibleAsset(repos, req.session.user.id, req.params.id);
    const ctx = await loadContext(repos, req.session.user.id, contextOptions(req));
    await renderValueForm(req, res, {
      asset, values: { date: today(), value: centsToInput(ctx.assetSummary(asset).value_cents) },
    });
  });

  router.post('/anlagen/:id/stand', async (req, res) => {
    const asset = await getVisibleAsset(repos, req.session.user.id, req.params.id);
    await handleForm(res, async () => {
      await assets.addValue(repos, req.session.user.id, asset.id, req.body);
      flash(req, 'Stand gespeichert.');
      res.redirect(`/anlagen/${asset.id}`);
    }, (errors) => renderValueForm(req, res, { asset, values: req.body, errors }));
  });

  router.post('/anlagen/:id/staende/:valueId/loeschen', async (req, res) => {
    await assets.deleteValue(repos, req.session.user.id, req.params.id, req.params.valueId);
    flash(req, 'Stand gelöscht.');
    res.redirect(`/anlagen/${req.params.id}`);
  });

  router.post('/anlagen/:id/archivieren', async (req, res) => {
    const archived = req.body.archived === 'true';
    await assets.setArchived(repos, req.session.user.id, req.params.id, archived);
    flash(req, archived ? 'Anlage archiviert.' : 'Anlage wiederhergestellt.');
    res.redirect(`/anlagen/${req.params.id}`);
  });

  router.post('/anlagen/:id/loeschen', async (req, res) => {
    await assets.deleteAsset(repos, req.session.user.id, req.params.id);
    flash(req, 'Anlage gelöscht.');
    res.redirect('/anlagen');
  });

  return router;
};
