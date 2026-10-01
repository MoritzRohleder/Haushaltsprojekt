'use strict';

const express = require('express');
const { loadContext, totals, monthlySummary } = require('../services/overview');
const { parts, today } = require('../utils/dates');
const { sortByName } = require('./helpers');

module.exports = (repos) => {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const ctx = await loadContext(repos, req.session.user.id);
    const { year, month } = parts(today());
    const recent = [...ctx.rows]
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
      .slice(0, 8);
    res.render('dashboard', {
      title: 'Übersicht',
      ctx,
      accounts: sortByName(ctx.accounts.filter((a) => !a.archived)),
      assets: sortByName(ctx.assets.filter((a) => !a.archived)),
      totals: totals(ctx),
      summary: monthlySummary(ctx, year, month),
      recent,
    });
  });

  return router;
};
