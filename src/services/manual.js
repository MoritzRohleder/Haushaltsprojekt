'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Marked } = require('marked');
const { version } = require('../../package.json');

const DEFAULT_DIR = path.join(__dirname, '..', '..', 'docs', 'wiki');
const START_PAGE = 'Handbuch';

/**
 * Nutzerhandbuch in der Anwendung (Spec F-07).
 *
 * Quelle sind die Markdown-Dateien in docs/wiki – dieselben Seiten, die
 * (per Copy & Paste) im GitHub-Wiki gepflegt werden. Reihenfolge und Titel
 * der Kapitel kommen aus _Sidebar.md, der Stand aus _Footer.md.
 * Links im Wiki-Format („Konten“, „Anlagen#abschnitt“) werden auf
 * /handbuch/... umgeschrieben. Der Inhalt stammt aus dem Repository und gilt
 * als vertrauenswürdig.
 */
class Manual {
  constructor({ dir = DEFAULT_DIR, reload = process.env.NODE_ENV !== 'production' } = {}) {
    this.dir = dir;
    this.reload = reload;
    this.data = null;
  }

  /** Alle Seiten laden (in Produktion einmal, sonst bei jedem Aufruf – für Änderungen ohne Neustart). */
  #load() {
    if (this.data && !this.reload) return this.data;
    const files = fs.readdirSync(this.dir).filter((f) => f.endsWith('.md'));
    const read = (name) => fs.readFileSync(path.join(this.dir, `${name}.md`), 'utf8');
    const pages = new Map();
    for (const file of files) {
      const name = file.slice(0, -3).normalize('NFC');
      if (name.startsWith('_') || name === 'Home') continue;
      pages.set(name, { name, title: name.replace(/-/g, ' '), markdown: stripWikiNav(read(file.slice(0, -3))) });
    }
    if (pages.has(START_PAGE)) pages.get(START_PAGE).title = 'Handbuch';

    // Reihenfolge und Titel aus der Seitenleiste
    const order = [];
    const sidebar = files.includes('_Sidebar.md') ? read('_Sidebar') : '';
    for (const [, title, target] of sidebar.matchAll(/^\s*\d+\.\s*\[([^\]]+)\]\(([^)#]+)\)/gm)) {
      const name = target.normalize('NFC');
      if (pages.has(name) && !order.includes(name)) {
        pages.get(name).title = title;
        order.push(name);
      }
    }
    for (const name of [...pages.keys()].sort()) {
      if (name !== START_PAGE && !order.includes(name)) order.push(name);
    }

    const footer = files.includes('_Footer.md') ? read('_Footer').trim() : '';
    this.data = { pages, order, footer };
    return this.data;
  }

  /** Kapitel in der Reihenfolge der Seitenleiste. */
  chapters() {
    const { pages, order } = this.#load();
    return order.map((name) => ({ name, title: pages.get(name).title, url: pageUrl(name) }));
  }

  has(name) {
    return this.#load().pages.has(String(name).normalize('NFC'));
  }

  /** Eine Seite als HTML mit Inhaltsverzeichnis und Vor/Zurück. */
  render(name = START_PAGE) {
    const { pages, order, footer } = this.#load();
    const page = pages.get(String(name).normalize('NFC'));
    if (!page) return null;
    const known = new Set(pages.keys());
    const headings = [];
    const html = createRenderer(known, headings).parse(page.markdown);
    const index = order.indexOf(page.name);
    const neighbour = (i) => (i >= 0 && i < order.length ? { title: pages.get(order[i]).title, url: pageUrl(order[i]) } : null);
    return {
      name: page.name,
      title: page.title,
      html,
      toc: headings.filter((h) => h.depth === 2),
      chapter: index >= 0 ? index + 1 : null,
      prev: page.name === START_PAGE ? null : (index > 0 ? neighbour(index - 1) : { title: 'Handbuch', url: pageUrl(START_PAGE) }),
      next: page.name === START_PAGE ? neighbour(0) : neighbour(index + 1),
      footer: footer ? createRenderer(known, []).parseInline(footer) : '',
      appVersion: version,
    };
  }

  /** Volltextsuche: alle Begriffe müssen auf der Seite vorkommen. */
  search(query) {
    const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
    if (!terms.length) return [];
    const { pages, order } = this.#load();
    return order.filter((n) => pages.has(n)).flatMap((name) => {
      const page = pages.get(name);
      const text = plainText(page.markdown);
      const lower = text.toLowerCase();
      if (!terms.every((t) => lower.includes(t))) return [];
      const hits = (re) => [...lower.matchAll(re)].length;
      const score = terms.reduce((sum, t) => sum + hits(new RegExp(escapeRegExp(t), 'g')), 0);
      return [{ name, title: page.title, url: pageUrl(name), score, snippet: snippet(text, terms) }];
    }).sort((a, b) => b.score - a.score);
  }
}

/** Die Zeile „← Zurück · Inhalt · Weiter →“ am Seitenende ersetzt die App durch eigene Knöpfe. */
function stripWikiNav(markdown) {
  return markdown.replace(/\n-{3,}\s*\n+\[←[^\n]*\]\([^)]*\)[^\n]*\s*$/, '\n');
}

function pageUrl(name) {
  return name === START_PAGE ? '/handbuch' : `/handbuch/${encodeURIComponent(name)}`;
}

/** Anker wie bei GitHub: klein, ohne Satzzeichen, Leerzeichen → Bindestrich. */
function slug(text) {
  return text.toLowerCase().trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function plainText(markdown) {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '')
    .replace(/^\|?[\s|:-]+\|?$/gm, ' ')
    .replace(/[#>*_`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Textausschnitt um den ersten Treffer, an Wortgrenzen geschnitten.
 * Rückgabe als Teile [{ text, hit }], damit die View Treffer hervorheben kann.
 */
function snippet(text, terms) {
  const lower = text.toLowerCase();
  const at = lower.indexOf(terms[0]);
  let start = Math.max(0, at - 80);
  let end = Math.min(text.length, at + 160);
  if (start > 0) start = text.indexOf(' ', start) + 1 || start;
  if (end < text.length) end = text.lastIndexOf(' ', end) > at ? text.lastIndexOf(' ', end) : end;
  const excerpt = text.slice(start, end);
  const pattern = terms.map(escapeRegExp).join('|');
  const isHit = new RegExp(`^(?:${pattern})$`, 'i');
  const parts = excerpt.split(new RegExp(`(${pattern})`, 'gi')).filter(Boolean)
    .map((part) => ({ text: part, hit: isHit.test(part) }));
  if (start > 0) parts.unshift({ text: '… ', hit: false });
  if (end < text.length) parts.push({ text: ' …', hit: false });
  return parts;
}

const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function createRenderer(knownPages, headings) {
  const marked = new Marked({ gfm: true });
  const used = new Map();
  marked.use({
    renderer: {
      heading({ tokens, depth, text }) {
        const plain = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '');
        let id = slug(plain);
        const count = used.get(id) || 0;
        used.set(id, count + 1);
        if (count) id = `${id}-${count}`;
        headings.push({ depth, id, text: plain });
        return `<h${depth} id="${escapeAttr(id)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const inner = this.parser.parseInline(tokens);
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
        if (/^(https?:)?\/\//i.test(href) || /^mailto:/i.test(href)) {
          return `<a href="${escapeAttr(href)}"${titleAttr} target="_blank" rel="noopener noreferrer">${inner}</a>`;
        }
        if (href.startsWith('#')) return `<a href="${escapeAttr(href)}"${titleAttr}>${inner}</a>`;
        const [page, anchor] = href.split('#');
        const name = decodeURIComponent(page).normalize('NFC');
        const target = name === 'Home' || name === START_PAGE ? '/handbuch'
          : knownPages.has(name) ? pageUrl(name) : null;
        if (!target) return `<span>${inner}</span>`; // unbekannte Seite: kein toter Link
        return `<a href="${escapeAttr(target + (anchor ? `#${anchor}` : ''))}"${titleAttr}>${inner}</a>`;
      },
    },
  });
  return marked;
}

module.exports = { Manual, slug, START_PAGE };
