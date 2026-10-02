'use strict';

/**
 * Geometrie für einfache SVG-Diagramme (Spec F-45, F-56, F-57).
 * Berechnet nur Koordinaten; gezeichnet wird in views/partials/chart-*.ejs.
 * Farben kommen aus CSS-Variablen, damit Hell/Dunkel automatisch passen.
 */

const euroShort = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/** Achsenbeschriftung in ganzen Euro, z. B. 120000 Cent → "1.200 €". */
function axisLabel(cents) {
  const text = euroShort.format(Math.abs(cents) / 100);
  return cents < 0 ? `−${text}` : text;
}

/** Runde Achsenschritte (1, 2, 2,5, 5 × 10^n), die min und max umfassen. */
function niceTicks(min, max, target = 4) {
  if (min === max) {
    const pad = Math.abs(min) || 10000;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s >= raw);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const values = [];
  for (let v = start; v <= end + step / 2; v += step) values.push(Math.round(v));
  return values;
}

function scale(domainMin, domainMax, rangeMin, rangeMax) {
  const span = domainMax - domainMin || 1;
  return (v) => rangeMin + ((v - domainMin) / span) * (rangeMax - rangeMin);
}

const dayNumber = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000;

/**
 * Liniendiagramm.
 * points: [{ key, label, value, tooltip }] – key ist ein ISO-Datum (x nach Zeit)
 * oder ein beliebiger Wert (x gleichmäßig verteilt, xMode = 'index').
 */
function lineChart(points, { width = 720, height = 240, xMode = 'date', includeZero = false, step = false } = {}) {
  const pad = { top: 16, right: 40, bottom: 32, left: 76 };
  const values = points.map((p) => p.value);
  const yValues = niceTicks(Math.min(...values, ...(includeZero ? [0] : [])), Math.max(...values, ...(includeZero ? [0] : [])));
  const y = scale(yValues[0], yValues[yValues.length - 1], height - pad.bottom, pad.top);
  const xs = xMode === 'date' ? points.map((p) => dayNumber(p.key)) : points.map((_, i) => i);
  const x = scale(Math.min(...xs), Math.max(...xs), pad.left, width - pad.right);

  const coords = points.map((p, i) => ({ ...p, x: round(x(xs[i])), y: round(y(p.value)) }));
  // step: Wert bleibt bis zur nächsten Änderung gleich (Treppe), sonst gerade Verbindung
  const line = coords.map((c, i) => (i === 0 ? `M${c.x},${c.y}` : step ? `H${c.x} V${c.y}` : `L${c.x},${c.y}`)).join(' ');
  const baseY = round(y(Math.max(yValues[0], Math.min(0, yValues[yValues.length - 1]))));
  const area = coords.length > 1
    ? `${line} L${coords[coords.length - 1].x},${baseY} L${coords[0].x},${baseY} Z`
    : '';

  // höchstens ~6 x-Beschriftungen, erste und letzte immer
  const every = Math.max(1, Math.ceil(coords.length / 6));
  const xTicks = coords.filter((_, i) => i % every === 0 || i === coords.length - 1)
    .filter((c, i, list) => i === list.length - 1 || list[list.length - 1].x - c.x > 48);

  return {
    width, height, pad, line, area,
    points: coords,
    last: coords[coords.length - 1],
    yTicks: yValues.map((v) => ({ y: round(y(v)), label: axisLabel(v) })),
    xTicks: xTicks.map((c) => ({ x: c.x, label: c.label })),
  };
}

/**
 * Säulendiagramm mit Nulllinie: positive Werte nach oben, negative nach unten.
 * items: [{ label, value, tooltip }]
 */
function columnChart(items, { width = 720, height = 240 } = {}) {
  const pad = { top: 16, right: 16, bottom: 32, left: 76 };
  const values = items.map((i) => i.value);
  const yValues = niceTicks(Math.min(0, ...values), Math.max(0, ...values));
  const y = scale(yValues[0], yValues[yValues.length - 1], height - pad.bottom, pad.top);
  const zeroY = round(y(0));
  const band = (width - pad.left - pad.right) / Math.max(items.length, 1);
  const barWidth = Math.min(24, band * 0.6);

  const bars = items.map((item, i) => {
    const cx = pad.left + band * i + band / 2;
    const top = round(y(Math.max(item.value, 0)));
    const bottom = round(y(Math.min(item.value, 0)));
    return {
      ...item,
      x: round(cx - barWidth / 2), cx: round(cx), width: round(barWidth),
      y: top, height: Math.max(round(bottom - top), item.value === 0 ? 0 : 1),
      negative: item.value < 0,
      path: roundedBar(cx - barWidth / 2, barWidth, top, bottom, item.value < 0),
      hit: { x: round(pad.left + band * i), width: round(band) },
    };
  });

  const every = Math.max(1, Math.ceil(items.length / 12));
  return {
    width, height, pad, zeroY, bars,
    yTicks: yValues.map((v) => ({ y: round(y(v)), label: axisLabel(v) })),
    xTicks: bars.filter((_, i) => i % every === 0).map((b) => ({ x: b.cx, label: b.label })),
  };
}

/** Säule mit 4px-Rundung am Datenende, eckig an der Nulllinie. */
function roundedBar(x, w, top, bottom, negative) {
  const h = bottom - top;
  if (h <= 0) return '';
  const r = Math.min(4, h, w / 2);
  const [x0, x1] = [round(x), round(x + w)];
  if (!negative) {
    return `M${x0},${round(bottom)} V${round(top + r)} Q${x0},${round(top)} ${round(x0 + r)},${round(top)} `
      + `H${round(x1 - r)} Q${x1},${round(top)} ${x1},${round(top + r)} V${round(bottom)} Z`;
  }
  return `M${x0},${round(top)} V${round(bottom - r)} Q${x0},${round(bottom)} ${round(x0 + r)},${round(bottom)} `
    + `H${round(x1 - r)} Q${x1},${round(bottom)} ${x1},${round(bottom - r)} V${round(top)} Z`;
}

/** Waagerechte Balken (z. B. Ausgaben nach Kategorie): Breite relativ zum größten Wert. */
function barList(items, { width = 320 } = {}) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  return items.map((item) => {
    const w = Math.max(round((Math.abs(item.value) / max) * width), 2);
    return { ...item, width: w, path: horizontalBar(w) };
  });
}

function horizontalBar(w) {
  const h = 12;
  const r = Math.min(4, w / 2);
  return `M0,0 H${round(w - r)} Q${round(w)},0 ${round(w)},${r} V${h - r} Q${round(w)},${h} ${round(w - r)},${h} H0 Z`;
}

const round = (n) => Math.round(n * 10) / 10;

module.exports = { niceTicks, lineChart, columnChart, barList, axisLabel };
