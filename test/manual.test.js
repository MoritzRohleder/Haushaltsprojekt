'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const session = require('express-session');
const { Manual } = require('../src/services/manual');
const { createApp } = require('../src/app');
const { setup } = require('./helpers');

const manual = new Manual();

test('Handbuch: alle Kapitel aus der Seitenleiste existieren', () => {
  const chapters = manual.chapters();
  assert.ok(chapters.length >= 10);
  for (const c of chapters) assert.ok(manual.render(c.name), c.name);
  assert.equal(chapters[0].title, 'Erste Schritte');
});

test('Handbuch: alle internen Links zeigen auf existierende Seiten und Abschnitte', () => {
  const ids = new Map();
  const pages = ['Handbuch', ...manual.chapters().map((c) => c.name)];
  for (const name of pages) {
    const page = manual.render(name);
    ids.set(name === 'Handbuch' ? '/handbuch' : `/handbuch/${encodeURIComponent(name)}`,
      new Set([...page.html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1])));
  }
  const broken = [];
  for (const name of pages) {
    const { html } = manual.render(name);
    assert.ok(!html.includes('<span>'), `${name}: Link auf unbekannte Seite`);
    for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
      if (/^https?:/.test(href)) continue;
      const [url, anchor] = href.replace(/&amp;/g, '&').split('#');
      const target = url === '' ? ids.get(name === 'Handbuch' ? '/handbuch' : `/handbuch/${encodeURIComponent(name)}`) : ids.get(url);
      if (!target || (anchor && !target.has(anchor))) broken.push(`${name} → ${href}`);
    }
  }
  assert.deepEqual(broken, []);
});

test('Handbuch: Navigation, Wiki-Fußzeile entfernt, Stand vorhanden', () => {
  const page = manual.render('Konten');
  assert.equal(page.prev.title, 'Bedienung');
  assert.equal(page.next.title, 'Kategorien');
  assert.ok(!page.html.includes('[Inhalt]') && !page.html.includes('Inhalt</a>'));
  assert.match(page.footer, /Handbuch-Stand/);
  assert.equal(manual.render('Handbuch').prev, null);
  assert.equal(manual.render('Begriffe').next, null);
});

test('Handbuch: Suche findet Seiten und ignoriert leere Anfragen', () => {
  assert.deepEqual(manual.search(''), []);
  const titles = manual.search('Sparrate').map((r) => r.title);
  assert.ok(titles.includes('Anlagen'));
  assert.ok(manual.search('sparrate stand').every((r) => /sparrate/i.test(r.snippet) || r.title));
  assert.deepEqual(manual.search('xyzunbekannt'), []);
});

test('Handbuch über HTTP: öffentlich, 404 für Unbekanntes, kein Zugriff außerhalb', async (t) => {
  const env = await setup();
  const app = createApp({
    config: { sessionSecret: 'test', cookieSecure: false, dataDir: env.dir },
    repos: env.repos, sessionStore: new session.MemoryStore(),
  });
  const server = app.listen(0);
  t.after(() => { server.close(); return env.cleanup(); });
  const base = `http://localhost:${server.address().port}`;

  const start = await fetch(`${base}/handbuch`);
  assert.equal(start.status, 200);
  const html = await start.text();
  assert.match(html, /Erste Schritte/);
  assert.match(html, /App-Version/);

  const page = await fetch(`${base}/handbuch/${encodeURIComponent('Regelmäßige-Buchungen')}`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /id="anlegen"/);

  assert.equal((await fetch(`${base}/handbuch/Gibts-nicht`)).status, 404);
  assert.equal((await fetch(`${base}/handbuch/_Sidebar`)).status, 404);
  assert.equal((await fetch(`${base}/handbuch/..%2F..%2Fpackage`)).status, 404);
  assert.equal((await fetch(`${base}/handbuch/Home`, { redirect: 'manual' })).headers.get('location'), '/handbuch');

  const search = await (await fetch(`${base}/handbuch?suche=Bauspar`)).text();
  assert.match(search, /Anlagen/);
  assert.match(search, /Seite(n)? gefunden/);

  assert.match(await (await fetch(`${base}/login`)).text(), /href="\/handbuch"/);
});
