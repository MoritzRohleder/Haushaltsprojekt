'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const session = require('express-session');
const { setup } = require('./helpers');
const { createApp } = require('../src/app');
const { today } = require('../src/utils/dates');

/** Kleiner Browser-Ersatz: merkt sich das Session-Cookie und liest CSRF-Tokens aus. */
function client(base) {
  let cookie = '';
  async function request(path, { method = 'GET', form } = {}) {
    const res = await fetch(base + path, {
      method,
      redirect: 'manual',
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: res.status, location: res.headers.get('location'), html: await res.text() };
  }
  async function csrf(path) {
    const { html } = await request(path);
    return /name="_csrf" value="([^"]+)"/.exec(html)?.[1];
  }
  return { request, csrf, cookie: () => cookie };
}

async function start(t) {
  const env = await setup();
  const app = createApp({
    config: { sessionSecret: 'test', cookieSecure: false, dataDir: env.dir },
    repos: env.repos,
    sessionStore: new session.MemoryStore(),
  });
  const server = app.listen(0);
  t.after(() => { server.close(); return env.cleanup(); });
  return { ...env, base: `http://localhost:${server.address().port}` };
}

test('Kompletter Ablauf: Registrieren, Konto, Buchungen, Anlage, Übersicht', async (t) => {
  const { base, repos } = await start(t);
  const anna = client(base);

  assert.equal((await anna.request('/')).location, '/login');

  let res = await anna.request('/registrieren', { method: 'POST', form: { username: 'anna', password: 'geheim123', passwordRepeat: 'geheim123' } });
  assert.equal(res.status, 302);
  assert.match((await anna.request('/')).html, /Lege dein erstes Konto an/);

  // Konto anlegen
  const userId = (await repos.users.findAll())[0].id;
  res = await anna.request('/konten', {
    method: 'POST',
    form: { _csrf: await anna.csrf('/konten/neu'), name: 'Giro', type: 'giro', opening_balance: '1.000,00', opening_date: '2026-01-01', owner_ids: userId },
  });
  assert.equal(res.status, 302);
  const accountId = res.location.split('/').pop();

  // Ohne CSRF-Token wird nichts gespeichert
  res = await anna.request('/buchungen', { method: 'POST', form: { type: 'expense', date: '2026-01-02', amount: '5', description: 'X', account_id: accountId } });
  assert.equal(res.status, 403);

  // Ausgabe mit Fehler → Formular mit Meldung
  const token = await anna.csrf('/buchungen/neu?typ=ausgabe');
  res = await anna.request('/buchungen', { method: 'POST', form: { _csrf: token, type: 'expense', date: '2026-01-02', amount: 'abc', description: 'Einkauf', account_id: accountId } });
  assert.equal(res.status, 400);
  assert.match(res.html, /kein gültiger Betrag/);

  res = await anna.request('/buchungen', { method: 'POST', form: { _csrf: token, type: 'expense', date: '2026-01-02', amount: '86,40', description: 'Einkauf', account_id: accountId } });
  assert.equal(res.status, 302);

  // Anlage mit Startwert und Sparrate
  res = await anna.request('/anlagen', {
    method: 'POST',
    form: { _csrf: token, name: 'ETF', type: 'fund', start_value: '500', owner_ids: userId },
  });
  const assetId = res.location.split('/').pop();
  res = await anna.request('/buchungen', {
    method: 'POST',
    form: { _csrf: token, type: 'transfer', date: today(), amount: '100', description: 'Sparrate', from: `account:${accountId}`, to: `asset:${assetId}` },
  });
  assert.equal(res.status, 302);

  const konto = await anna.request(`/konten/${accountId}`);
  assert.match(konto.html, /813,60/); // 1.000 − 86,40 − 100
  const anlage = await anna.request(`/anlagen/${assetId}`);
  assert.match(anlage.html, /600,00/);
  assert.match(anlage.html, /Einzahlung/);

  // Stand manuell aktualisieren → Korrektur sichtbar
  await anna.request(`/anlagen/${assetId}/stand`, { method: 'POST', form: { _csrf: token, value: '590' } });
  const liste = await anna.request('/anlagen');
  const heute = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  assert.ok(liste.html.includes(heute));
  assert.match(liste.html, /Korrektur −10,00/);

  for (const page of ['/', '/monat/2026/1', '/buchungen?monat=2026-01', '/konten', '/wiederkehrend', '/kategorien', '/profil']) {
    assert.equal((await anna.request(page)).status, 200, page);
  }

  // Ein anderer Nutzer sieht Annas Konto nicht
  const ben = client(base);
  await ben.request('/registrieren', { method: 'POST', form: { username: 'ben', password: 'geheim123', passwordRepeat: 'geheim123' } });
  assert.equal((await ben.request(`/konten/${accountId}`)).status, 404);
  assert.equal((await ben.request(`/anlagen/${assetId}`)).status, 404);

  // Abmelden
  res = await anna.request('/logout', { method: 'POST', form: { _csrf: token } });
  assert.equal(res.location, '/login');
  assert.equal((await anna.request('/')).location, '/login');
});

test('Sicherheits-Header, Health-Check, Theme, Auswertung, Export, Nochmal buchen', async (t) => {
  const { base, repos } = await start(t);
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });
  const login = await fetch(`${base}/login`);
  assert.match(login.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(login.headers.get('x-frame-options'), 'DENY');

  const c = client(base);
  await c.request('/registrieren', { method: 'POST', form: { username: 'dora', password: 'geheim123', passwordRepeat: 'geheim123' } });
  const userId = (await repos.users.findAll())[0].id;
  const token = await c.csrf('/');

  // Theme umschalten (per fetch → 204) und wird beim nächsten Seitenaufruf gesetzt
  const res = await fetch(`${base}/einstellungen/darstellung`, {
    method: 'POST',
    headers: { cookie: c.cookie(), 'x-requested-with': 'fetch', 'x-csrf-token': token, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'theme=dark',
  });
  assert.equal(res.status, 204);
  assert.match((await c.request('/')).html, /<html lang="de" data-theme="dark">/);
  await c.request('/einstellungen/darstellung', { method: 'POST', form: { _csrf: token, theme: 'light', back: '//evil.example' } })
    .then((r) => assert.equal(r.location, '/profil')); // kein Open Redirect

  // Buchung, Export, Nochmal buchen
  const acc = await c.request('/konten', { method: 'POST', form: { _csrf: token, name: 'Giro', type: 'giro', opening_balance: '0', opening_date: '2026-01-01', owner_ids: userId } });
  const accountId = acc.location.split('/').pop();
  await c.request('/buchungen', { method: 'POST', form: { _csrf: token, type: 'expense', date: '2026-02-03', amount: '12,34', description: 'Bäcker; Brot', account_id: accountId } });
  const csv = await c.request('/buchungen/export.csv?alle=1');
  assert.match(csv.html, /03\.02\.2026;Giro;Ausgabe;Ohne Kategorie;;"Bäcker; Brot";;-12,34;;;/);
  const rowId = (await repos.transactions.findAll())[0].id;
  const dup = await c.request(`/buchungen/neu?vorlage=${rowId}`);
  assert.match(dup.html, /value="12,34"/);
  assert.match(dup.html, /Bäcker; Brot/);

  assert.match((await c.request(`/konten/${accountId}`)).html, /class="help-link"[^>]*|href="\/handbuch\/Konten"/);
  assert.match((await c.request('/anlagen')).html, /href="\/handbuch\/Anlagen" class="help-link"/);
  for (const page of ['/auswertung', '/auswertung?monate=24', '/monat/2026/2', `/konten/${accountId}`, '/kategorien']) {
    assert.equal((await c.request(page)).status, 200, page);
  }
});

test('Login-Bremse greift über HTTP', async (t) => {
  const { base } = await start(t);
  const c = client(base);
  for (let i = 0; i < 5; i++) await c.request('/login', { method: 'POST', form: { username: 'x', password: 'falsch' } });
  const res = await c.request('/login', { method: 'POST', form: { username: 'x', password: 'falsch' } });
  assert.equal(res.status, 429);
  assert.match(res.html, /Zu viele Fehlversuche/);
});

test('Login mit falschem Passwort zeigt neutrale Meldung', async (t) => {
  const { base } = await start(t);
  const c = client(base);
  await c.request('/registrieren', { method: 'POST', form: { username: 'carla', password: 'geheim123', passwordRepeat: 'geheim123' } });
  const other = client(base);
  const res = await other.request('/login', { method: 'POST', form: { username: 'carla', password: 'falsch' } });
  assert.equal(res.status, 401);
  assert.match(res.html, /Nutzername oder Passwort falsch/);
  const ok = await other.request('/login', { method: 'POST', form: { username: 'CARLA', password: 'geheim123' } });
  assert.equal(ok.location, '/');
});
