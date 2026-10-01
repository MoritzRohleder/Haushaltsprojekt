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
