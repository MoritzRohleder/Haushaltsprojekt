'use strict';

const express = require('express');
const { loadContext, totals, monthlySummary } = require('../services/overview');
const { parts, today } = require('../utils/dates');
const { sortByName, contextOptions } = require('./helpers');

module.exports = (repos) => {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const ctx = await loadContext(repos, req.session.user.id, contextOptions(req));
    const { year, month } = parts(today());
    const recent = ctx.rows.filter((t) => t.date <= ctx.today)
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
      .slice(0, 8);
    const planned = ctx.planned()
      .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
      .slice(0, 8);
    res.render('dashboard', {
      title: 'Übersicht',
      ctx,
      accounts: sortByName(ctx.accounts.filter((a) => !a.archived)),
      assets: sortByName(ctx.assets.filter((a) => !a.archived)),
      totals: totals(ctx),
      summary: monthlySummary(ctx, year, month),
      recent,
      planned,
    });
  });

  return router;
};
