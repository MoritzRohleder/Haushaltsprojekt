'use strict';

// Rhythmus-Felder nur zeigen, wenn „regelmäßig“ angehakt ist.
document.querySelectorAll('[data-toggle]').forEach((checkbox) => {
  const target = document.getElementById(checkbox.dataset.toggle);
  const update = () => { target.hidden = !checkbox.checked; };
  checkbox.addEventListener('change', update);
  update();
});

// Sicherheitsabfrage vor dem Löschen.
document.querySelectorAll('form[data-confirm]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
  });
});

// Tag/Monat nur bei passender Einheit zeigen (Monat: Tag, Jahr: Tag + Monat).
document.querySelectorAll('[data-interval-unit]').forEach((select) => {
  const form = select.form;
  const update = () => {
    form.querySelectorAll('[data-units]').forEach((field) => {
      field.hidden = !field.dataset.units.split(' ').includes(select.value);
    });
  };
  select.addEventListener('change', update);
  update();
});

// Hell/Dunkel-Umschalter: sofort umschalten und für den Nutzer speichern.
document.querySelectorAll('form[data-theme-toggle]').forEach((form) => {
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const effective = () => root.dataset.theme || (systemDark.matches ? 'dark' : 'light');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const next = effective() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    document.querySelector('meta[name=color-scheme]')?.setAttribute('content', next);
    form.elements.theme.value = next === 'dark' ? 'light' : 'dark';
    const body = new URLSearchParams(new FormData(form));
    body.set('theme', next);
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'x-requested-with': 'fetch', 'content-type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) throw new Error(res.statusText);
    } catch {
      form.submit(); // Fallback: normales Formular (lädt die Seite neu)
    }
  });
});

// Handbuch: Kapitelliste auf schmalen Bildschirmen eingeklappt starten.
const manualNav = document.querySelector('.manual-nav-details');
if (manualNav && window.matchMedia('(max-width: 1024px)').matches) manualNav.open = false;

// ---- Ausgaben: Geschäft (Pflicht bei Einkaufs-Kategorien) und Artikelliste ----

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

/** Euro-Eingabe in Cent (wie auf dem Server: „1.234,56“, „1234.56“, „12,5“). */
function parseEuro(text) {
  let t = String(text || '').replace(/[\s€]/g, '');
  if (!t) return null;
  const negative = /^[-−]/.test(t);
  t = t.replace(/^[-−]/, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  return negative ? -cents : cents;
}

function parseQty(text) {
  const t = String(text || '').trim().replace(',', '.');
  if (!t) return 1;
  return /^\d+(\.\d{1,3})?$/.test(t) && Number(t) > 0 ? Number(t) : null;
}

document.querySelectorAll('[data-category-select]').forEach((select) => {
  const field = select.form.querySelector('[data-merchant-field]');
  if (!field) return;
  const input = field.querySelector('input');
  const hint = field.querySelector('[data-merchant-hint]');
  const update = () => {
    const shopping = select.selectedOptions[0]?.hasAttribute('data-shopping');
    input.required = Boolean(shopping);
    hint.textContent = shopping ? '(Pflicht bei dieser Kategorie)' : '(optional)';
  };
  select.addEventListener('change', update);
  update();
});

document.querySelectorAll('[data-items]').forEach((box) => {
  const form = box.closest('form');
  const body = box.querySelector('[data-items-body]');
  const template = box.querySelector('[data-item-template]');
  const sumOut = box.querySelector('[data-items-sum]');
  const diffOut = box.querySelector('[data-items-diff]');
  const amountInput = form.querySelector('input[name=amount]');

  const recalc = () => {
    let sum = 0;
    let count = 0;
    body.querySelectorAll('[data-item-row]').forEach((row) => {
      const qty = parseQty(row.querySelector('[name=item_qty]').value);
      const price = parseEuro(row.querySelector('[name=item_price]').value);
      const out = row.querySelector('[data-item-total]');
      if (qty !== null && price !== null) {
        const total = Math.round(qty * price);
        out.textContent = euro.format(total / 100);
        sum += total;
        count += 1;
      } else {
        out.textContent = '';
      }
    });
    sumOut.textContent = count ? `Summe der Artikel: ${euro.format(sum / 100)}` : '';
    const amount = parseEuro(amountInput.value);
    diffOut.textContent = count && amount !== null && amount !== sum
      ? `⚠ weicht vom Betrag (${euro.format(amount / 100)}) um ${euro.format((sum - amount) / 100)} ab`
      : '';
  };

  box.querySelector('[data-add-item]').addEventListener('click', () => {
    body.append(template.content.cloneNode(true));
    body.lastElementChild.querySelector('[name=item_name]').focus();
    recalc();
  });
  body.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-item]');
    if (!button) return;
    const row = button.closest('[data-item-row]');
    if (body.querySelectorAll('[data-item-row]').length > 1) row.remove();
    else row.querySelectorAll('input').forEach((i) => { i.value = i.name === 'item_qty' ? '1' : ''; });
    recalc();
  });
  body.addEventListener('input', recalc);
  amountInput.addEventListener('input', recalc);
  recalc();
});
