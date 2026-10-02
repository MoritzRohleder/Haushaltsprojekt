'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const session = require('express-session');
const { setup, user, account } = require('./helpers');
const tx = require('../src/services/transactions');
const recurring = require('../src/services/recurring');
const categories = require('../src/services/categories');
const { loadContext, monthlySummary } = require('../src/services/overview');
const { articleStats } = require('../src/services/articles');
const { migrate } = require('../src/storage/migrations');
const { createStorage } = require('../src/storage');
const { ValidationError } = require('../src/utils/errors');
const { createApp } = require('../src/app');

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
const upload = (buffer = JPEG, name = 'kassenzettel.jpg') => ({ buffer, size: buffer.length, originalname: name });

async function shop(t) {
  const env = await setup();
  t.after(env.cleanup);
  const a = await user(env.repos, 'anna');
  const b = await user(env.repos, 'ben');
  const giro = await account(env.repos, 'Giro', [a.id], { opening_balance_cents: 100000 });
  const cats = await env.repos.categories.findAll({ kind: 'expense' });
  const food = cats.find((c) => c.name === 'Lebensmittel');
  const rent = cats.find((c) => c.name === 'Wohnen');
  const base = { type: 'expense', date: '2026-10-02', amount: '23,47', description: 'Wocheneinkauf', account_id: giro.id };
  return { ...env, a, b, giro, food, rent, base };
}

test('Standard-Kategorien: Lebensmittel ist Einkauf, Wohnen nicht', async (t) => {
  const s = await shop(t);
  assert.equal(s.food.merchant_required, true);
  assert.equal(s.rent.merchant_required, false);
});

test('Geschäft ist Pflicht nur bei Einkaufs-Kategorien', async (t) => {
  const s = await shop(t);
  const actor = { userId: s.a.id };
  await assert.rejects(tx.createBooking(s.repos, actor, { ...s.base, category_id: s.food.id }), /Geschäft/);
  const ok = await tx.createBooking(s.repos, actor, { ...s.base, category_id: s.food.id, merchant: '  Edeka   Markt ' });
  assert.equal(ok.merchant, 'Edeka Markt');
  const rent = await tx.createBooking(s.repos, actor, { ...s.base, category_id: s.rent.id });
  assert.equal(rent.merchant, '');
  // Automatisch erzeugte (regelmäßige) Buchungen scheitern nicht am fehlenden Geschäft
  await tx.createBooking(s.repos, { userId: s.a.id, system: true }, { ...s.base, category_id: s.food.id });
  // Einnahmen haben kein Geschäft
  const income = await tx.createBooking(s.repos, actor, { ...s.base, type: 'income', merchant: 'X' });
  assert.equal(income.merchant, undefined);
});

test('Einkaufs-Einstellung umschalten (eigene und Standard-Kategorien)', async (t) => {
  const s = await shop(t);
  await categories.setMerchantRequired(s.repos, s.a.id, s.rent.id, true);
  assert.equal((await s.repos.categories.findById(s.rent.id)).merchant_required, true);
  const own = await categories.createCategory(s.repos, s.a.id, { name: 'Baumarkt', kind: 'expense', shopping: '1' });
  assert.equal(own.merchant_required, true);
  await assert.rejects(categories.setMerchantRequired(s.repos, s.b.id, own.id, false)); // fremde eigene Kategorie
  const income = (await s.repos.categories.findAll({ kind: 'income' }))[0];
  await assert.rejects(categories.setMerchantRequired(s.repos, s.a.id, income.id, true), ValidationError);
});

test('Artikel werden gespeichert; Betrag bleibt wie eingegeben', async (t) => {
  const s = await shop(t);
  const row = await tx.createBooking(s.repos, { userId: s.a.id }, {
    ...s.base, merchant: 'Edeka',
    item_name: ['Milch', 'Butter', 'Pfand', ''], item_qty: ['2', '1', '1', '1'], item_price: ['1,19', '2,49', '-0,25', ''],
  });
  assert.equal(row.amount_cents, -2347);
  assert.deepEqual(row.items.map((i) => [i.name, i.quantity, i.unit_price_cents, i.total_cents]),
    [['Milch', 2, 119, 238], ['Butter', 1, 249, 249], ['Pfand', 1, -25, -25]]);
  await assert.rejects(tx.createBooking(s.repos, { userId: s.a.id }, { ...s.base, item_name: ['Käse'], item_qty: ['x'], item_price: ['1'] }), /Menge/);
  await assert.rejects(tx.createBooking(s.repos, { userId: s.a.id }, { ...s.base, item_name: [''], item_qty: ['1'], item_price: ['1'] }), /Name fehlt/);
});

test('Kassenzettel: speichern, ersetzen, entfernen, mit Buchung löschen', async (t) => {
  const s = await shop(t);
  const files = () => fs.readdirSync(path.join(s.dir, 'uploads'));
  const row = await tx.createBooking(s.repos, { userId: s.a.id }, { ...s.base, receiptUpload: upload() });
  assert.equal(row.receipt.mime, 'image/jpeg');
  assert.equal(row.receipt.original_name, 'kassenzettel.jpg');
  assert.deepEqual(files(), [row.receipt.file]);

  await assert.rejects(tx.createBooking(s.repos, { userId: s.a.id }, { ...s.base, receiptUpload: upload(Buffer.from('<script>alert(1)</script>')) }), /Foto/);
  assert.equal(files().length, 1);

  const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(100, 32)]);
  const replaced = await tx.updateTransaction(s.repos, s.a.id, row.id, { ...s.base, receiptUpload: upload(pdf, 'beleg.pdf') });
  assert.equal(replaced.receipt.mime, 'application/pdf');
  assert.deepEqual(files(), [replaced.receipt.file]);

  const kept = await tx.updateTransaction(s.repos, s.a.id, row.id, { ...s.base, description: 'neu' });
  assert.equal(kept.receipt.file, replaced.receipt.file); // ohne neue Datei bleibt der Beleg

  const removed = await tx.updateTransaction(s.repos, s.a.id, row.id, { ...s.base, remove_receipt: '1' });
  assert.equal(removed.receipt, null);
  assert.deepEqual(files(), []);

  const again = await tx.createBooking(s.repos, { userId: s.a.id }, { ...s.base, receiptUpload: upload() });
  await tx.deleteTransaction(s.repos, s.a.id, again.id);
  assert.deepEqual(files(), []);
});

test('Regelmäßige Buchung: Geschäft wird übernommen, Artikel/Beleg nicht erlaubt', async (t) => {
  const s = await shop(t);
  const form = { ...s.base, category_id: s.food.id, merchant: 'Bäckerei', recurring: '1', interval_count: '1', interval_unit: 'week' };
  await assert.rejects(recurring.createFromForm(s.repos, s.a.id, { ...form, item_name: ['Brot'], item_qty: ['1'], item_price: ['3'] }), /Artikel und Kassenzettel/);
  await assert.rejects(recurring.createFromForm(s.repos, s.a.id, { ...form, receiptUpload: upload() }), /Artikel und Kassenzettel/);
  const { recurring: rec } = await recurring.createFromForm(s.repos, s.a.id, form, '2026-10-16');
  assert.equal(rec.merchant, 'Bäckerei');
  const rows = await s.repos.transactions.findAll({ recurring_id: rec.id });
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.merchant === 'Bäckerei'));
});

test('Migration ergänzt merchant_required bei bestehenden Kategorien', async (t) => {
  const s = await shop(t);
  for (const c of await s.repos.categories.findAll()) {
    await s.storage.update('categories', c.id, { merchant_required: undefined });
  }
  await s.storage.setMeta('migrations_done', []);
  const reloaded = await createStorage({ storage: 'json', dataDir: s.dir });
  const food = await reloaded.findById('categories', s.food.id);
  assert.equal(food.merchant_required, true);
  assert.equal((await reloaded.findById('categories', s.rent.id)).merchant_required, false);
  await migrate(reloaded); // erneut ausführen ändert nichts
});

test('Auswertungen: Ausgaben nach Geschäft und Artikel', async (t) => {
  const s = await shop(t);
  const actor = { userId: s.a.id };
  const buy = (date, merchant, amount, items) => tx.createBooking(s.repos, actor, {
    ...s.base, date, merchant, amount,
    item_name: items.map((i) => i[0]), item_qty: items.map((i) => i[1]), item_price: items.map((i) => i[2]),
  });
  await buy('2026-10-01', 'Edeka', '5', [['Milch', '2', '1,19'], ['Brot', '1', '2,50']]);
  await buy('2026-10-08', 'Aldi', '3', [['milch ', '3', '0,99']]);
  await buy('2026-10-09', '', '7', []);

  const ctx = await loadContext(s.repos, s.a.id);
  const month = monthlySummary(ctx, 2026, 10);
  assert.deepEqual(month.expenseByMerchant.map((m) => [m.name, m.sum]), [['Ohne Geschäft', -700], ['Edeka', -500], ['Aldi', -300]]);

  const stats = articleStats(ctx, { from: '2026-10-01', to: '2026-10-31' });
  const milk = stats.items.find((i) => i.name.trim() === 'milch');
  assert.equal(milk.purchases, 2);
  assert.equal(milk.quantity, 5);
  assert.equal(milk.total_cents, 238 + 297);
  assert.equal(milk.avg_unit_cents, Math.round(535 / 5));
  assert.deepEqual([milk.min_unit_cents, milk.max_unit_cents], [99, 119]);
  assert.equal(milk.last.merchant, 'Aldi');
  assert.deepEqual(milk.merchants.sort(), ['Aldi', 'Edeka']);
  assert.equal(articleStats(ctx, { from: '2026-10-01', to: '2026-10-31', query: 'BROT' }).items.length, 1);
});

test('HTTP: Ausgabe mit Kassenzettel hochladen, ansehen, Zugriffsschutz', async (t) => {
  const s = await shop(t);
  const app = createApp({ config: { sessionSecret: 'test', cookieSecure: false, dataDir: s.dir }, repos: s.repos, sessionStore: new session.MemoryStore() });
  const server = app.listen(0);
  t.after(() => server.close());
  const base = `http://localhost:${server.address().port}`;

  const login = async (username) => {
    const res = await fetch(`${base}/login`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `username=${username}&password=geheim123` });
    const cookie = res.headers.get('set-cookie').split(';')[0];
    const html = await (await fetch(`${base}/buchungen/neu?typ=ausgabe`, { headers: { cookie } })).text();
    return { cookie, csrf: /name="_csrf" value="([^"]+)"/.exec(html)[1], html };
  };
  const anna = await login('anna');
  assert.match(anna.html, /enctype="multipart\/form-data"/);
  assert.match(anna.html, /data-shopping/);

  const form = new FormData();
  for (const [k, v] of Object.entries({ _csrf: anna.csrf, type: 'expense', date: '2026-10-02', amount: '4,99', description: 'Einkauf', account_id: s.giro.id, category_id: s.food.id, merchant: 'Edeka' })) form.append(k, v);
  form.append('item_name', 'Milch'); form.append('item_qty', '1'); form.append('item_price', '1,19');
  form.append('item_name', 'Käse'); form.append('item_qty', '1'); form.append('item_price', '3,80');
  form.append('receipt', new Blob([JPEG], { type: 'image/jpeg' }), 'bon.jpg');
  const res = await fetch(`${base}/buchungen`, { method: 'POST', body: form, redirect: 'manual', headers: { cookie: anna.cookie } });
  assert.equal(res.status, 302);

  const row = (await s.repos.transactions.findAll())[0];
  assert.equal(row.merchant, 'Edeka');
  assert.equal(row.items.length, 2);
  const receipt = await fetch(`${base}/buchungen/${row.id}/beleg`, { headers: { cookie: anna.cookie } });
  assert.equal(receipt.status, 200);
  assert.equal(receipt.headers.get('content-type'), 'image/jpeg');
  assert.equal(receipt.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(Buffer.from(await receipt.arrayBuffer()).length, JPEG.length);

  const ben = await login('ben');
  assert.equal((await fetch(`${base}/buchungen/${row.id}/beleg`, { headers: { cookie: ben.cookie } })).status, 404);
  assert.equal((await fetch(`${base}/buchungen/${row.id}/beleg`, { redirect: 'manual' })).headers.get('location'), '/login'); // nicht angemeldet → Login

  // Ohne CSRF-Token wird auch ein Upload abgelehnt
  const noCsrf = new FormData();
  noCsrf.append('type', 'expense');
  noCsrf.append('receipt', new Blob([JPEG]), 'x.jpg');
  assert.equal((await fetch(`${base}/buchungen`, { method: 'POST', body: noCsrf, headers: { cookie: anna.cookie } })).status, 403);

  const list = await (await fetch(`${base}/buchungen?monat=2026-10&geschaeft=Edeka`, { headers: { cookie: anna.cookie } })).text();
  assert.match(list, /🧾/);
  assert.match(list, /2 Artikel/);
  const csv = await (await fetch(`${base}/buchungen/export.csv?alle=1`, { headers: { cookie: anna.cookie } })).text();
  assert.match(csv, /;Lebensmittel;Edeka;Einkauf;;-4,99;"Milch \(1 × 1,19\); Käse \(1 × 3,80\)";ja;/);
  const month = await (await fetch(`${base}/monat/2026/10`, { headers: { cookie: anna.cookie } })).text();
  assert.match(month, /Ausgaben nach Geschäft/);
  const report = await (await fetch(`${base}/auswertung?artikel=milch`, { headers: { cookie: anna.cookie } })).text();
  assert.match(report, /Milch/);
});
