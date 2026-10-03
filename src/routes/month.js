'use strict';

const express = require('express');
const { contextOptions } = require('./helpers');
const { loadContext, monthlySummary } = require('../services/overview');
const { parts, today, addMonths, toIso } = require('../utils/dates');
const { NotFoundError } = require('../utils/errors');
const { barList } = require('../utils/charts');

module.exports = (repos) => {
  const router = express.Router();

  router.get('/monat', (req, res) => {
    const { year, month } = parts(today());
    res.redirect(`/monat/${year}/${month}`);
  });

  router.get('/monat/:jahr/:monat', async (req, res) => {
    const year = Number(req.params.jahr);
    const month = Number(req.params.monat);
    if (!Number.isInteger(year) || year < 1900 || year > 2999 || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new NotFoundError();
    }
    const ctx = await loadContext(repos, req.session.user.id, contextOptions(req));
    const first = toIso(year, month, 1);
    const prev = parts(addMonths(first, -1));
    const next = parts(addMonths(first, 1));
    const summary = monthlySummary(ctx, year, month);
    const bars = (list) => barList(list.map((c) => ({ name: c.name, value: c.sum })));
    res.render('month', {
      title: 'Monatsübersicht',
      ctx,
      summary,
      incomeBars: bars(summary.incomeByCategory),
      expenseBars: bars(summary.expenseByCategory),
      merchantBars: bars(summary.expenseByMerchant),
      monthParam: `${year}-${String(month).padStart(2, '0')}`,
      prevUrl: `/monat/${prev.year}/${prev.month}`,
      nextUrl: `/monat/${next.year}/${next.month}`,
    });
  });

  return router;
};
