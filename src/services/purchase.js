'use strict';

const v = require('../utils/validate');
const { parseEuro } = require('../utils/money');

/**
 * Einkaufsdetails einer Ausgabe (Spec 5.2 „Buchung“, F-27 bis F-29):
 * Geschäft, Artikelliste und Kassenzettel (Foto oder PDF).
 */

const MAX_ITEMS = 200;
const MAX_RECEIPT_BYTES = 15 * 1024 * 1024;

/** Formularfelder mit Mehrfachwerten (item_name, item_qty, item_price) als Liste. */
const asList = (value) => (value === undefined ? [] : [].concat(value));

/** Menge mit Komma oder Punkt, bis 3 Nachkommastellen, z. B. „1“, „0,5“, „2.25“. */
function parseQuantity(text) {
  const t = String(text ?? '').trim().replace(',', '.');
  if (t === '') return 1;
  if (!/^\d{1,6}(\.\d{1,3})?$/.test(t)) return null;
  const q = Number(t);
  return q > 0 ? q : null;
}

/**
 * Artikelliste aus dem Formular lesen. Leere Zeilen werden ignoriert.
 * Stückpreise dürfen negativ sein (Rabatt, Pfandbon).
 */
function readItems(input, errors) {
  const names = asList(input.item_name);
  const quantities = asList(input.item_qty);
  const prices = asList(input.item_price);
  const rows = Math.max(names.length, quantities.length, prices.length);
  const items = [];
  for (let i = 0; i < rows; i++) {
    const name = String(names[i] ?? '').trim();
    const qtyText = String(quantities[i] ?? '').trim();
    const priceText = String(prices[i] ?? '').trim();
    if (!name && !priceText && (!qtyText || qtyText === '1')) continue;
    const label = `Artikel ${items.length + 1}`;
    if (!name) errors.push(`${label}: Name fehlt.`);
    if (name.length > 80) errors.push(`${label}: Name darf höchstens 80 Zeichen lang sein.`);
    const quantity = parseQuantity(qtyText);
    if (quantity === null) errors.push(`${label}: Menge ist ungültig (z. B. 2 oder 0,5).`);
    const unit = parseEuro(priceText);
    if (unit === null) errors.push(`${label}: Stückpreis ist kein gültiger Betrag.`);
    if (quantity !== null && unit !== null) {
      items.push({ name, quantity, unit_price_cents: unit, total_cents: Math.round(quantity * unit) });
    } else {
      items.push({ name, quantity: quantity ?? 1, unit_price_cents: unit ?? 0, total_cents: 0 });
    }
  }
  if (items.length > MAX_ITEMS) errors.push(`Höchstens ${MAX_ITEMS} Artikel pro Buchung.`);
  return items;
}

const itemsTotal = (items) => (items || []).reduce((sum, i) => sum + i.total_cents, 0);

/** Geschäft lesen; Pflicht, wenn die Kategorie als „Einkauf“ markiert ist (außer bei Automatik). */
function readMerchant(input, category, actor, errors) {
  const merchant = v.text(input.merchant, { label: 'Geschäft', max: 80 }, errors).replace(/\s+/g, ' ');
  if (!merchant && category?.merchant_required && !actor.system) {
    errors.push(`Bitte das Geschäft angeben – bei der Kategorie „${category.name}“ ist es Pflicht.`);
  }
  return merchant;
}

/** Erlaubte Belegdateien, erkannt am Inhalt (nicht an Endung oder Angabe des Browsers). */
const FILE_TYPES = [
  { ext: 'jpg', mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', mime: 'image/png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'webp', mime: 'image/webp', test: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  { ext: 'gif', mime: 'image/gif', test: (b) => b.toString('ascii', 0, 4) === 'GIF8' },
  { ext: 'heic', mime: 'image/heic', test: (b) => b.toString('ascii', 4, 8) === 'ftyp' && /^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(b.toString('ascii', 8, 12)) },
  { ext: 'pdf', mime: 'application/pdf', test: (b) => b.toString('ascii', 0, 5) === '%PDF-' },
];

function detectFileType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  return FILE_TYPES.find((t) => t.test(buffer)) || null;
}

/** Hochgeladenen Kassenzettel prüfen. Gibt { buffer, type, original_name, size } oder null zurück. */
function readReceipt(upload, errors) {
  if (!upload || !upload.buffer || upload.size === 0) return null;
  if (upload.size > MAX_RECEIPT_BYTES) {
    errors.push('Der Kassenzettel ist zu groß (höchstens 15 MB).');
    return null;
  }
  const type = detectFileType(upload.buffer);
  if (!type) {
    errors.push('Der Kassenzettel muss ein Foto (JPG, PNG, WebP, HEIC) oder ein PDF sein.');
    return null;
  }
  const original = String(upload.originalname || 'beleg').replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 100);
  return { buffer: upload.buffer, type, original_name: original, size: upload.size };
}

/** Kann der Browser die Datei direkt anzeigen (als Bild)? */
const isDisplayableImage = (receipt) => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(receipt?.mime);

/** Artikelnamen zum Gruppieren vereinheitlichen. */
const normalizeName = (name) => String(name).trim().toLowerCase().replace(/\s+/g, ' ');

module.exports = {
  MAX_RECEIPT_BYTES, readItems, itemsTotal, readMerchant, readReceipt, detectFileType,
  isDisplayableImage, normalizeName, parseQuantity, asList,
};
