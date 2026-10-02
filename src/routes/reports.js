'use strict';

const express = require('express');
const { contextOptions } = require('./helpers');
const { loadContext, monthlySeries } = require('../services/overview');
const { lineChart, columnChart } = require('../utils/charts');
const { formatEuro } = require('../utils/money');
const { formatMonth, formatDate } = require('../utils/dates');

const RANGES = [6, 12, 24];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const shortMonth = (year, month) => `${SHORT_MONTHS[month - 1]} ${String(year).slice(2)}`;

module.exports = (repos) => {
  const router = express.Router();

  /** Auswertung: Monatsvergleich und Verlauf des Gesamtvermögens (F-56, F-57). */
  router.get('/auswertung', async (req, res) => {
    const months = RANGES.includes(Number(req.query.monate)) ? Number(req.query.monate) : 12;
    const ctx = await loadContext(repos, req.session.user.id, contextOptions(req));
    const series = monthlySeries(ctx, months);

    const saldoChart = columnChart(series.map((m) => ({
      label: shortMonth(m.year, m.month),
      value: m.saldo,
      tooltip: `${formatMonth(m.year, m.month)}: Saldo ${formatEuro(m.saldo, { sign: true })} `
        + `(Einnahmen ${formatEuro(m.income)}, Ausgaben ${formatEuro(m.expense)})`,
    })));
    const worthChart = lineChart(series.map((m) => ({
      key: m.end,
      label: shortMonth(m.year, m.month),
      value: m.netWorth.total,
      tooltip: `${formatDate(m.end)}: Gesamtvermögen ${formatEuro(m.netWorth.total)} `
        + `(Konten ${formatEuro(m.netWorth.accounts)}, Anlagen ${formatEuro(m.netWorth.assets)})`,
    })), { xMode: 'index' });

    res.render('reports', {
      title: 'Auswertung', months, ranges: RANGES, series: [...series].reverse(), saldoChart, worthChart,
      hasData: ctx.accounts.length > 0 || ctx.assets.length > 0,
    });
  });

  return router;
};
