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
