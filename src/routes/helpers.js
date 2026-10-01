'use strict';

const { ValidationError } = require('../utils/errors');

/**
 * Führt eine Formular-Aktion aus. Bei Eingabefehlern wird das Formular mit
 * den eingegebenen Werten und den Fehlermeldungen erneut angezeigt.
 */
async function handleForm(res, action, renderOnError) {
  try {
    return await action();
  } catch (err) {
    if (!(err instanceof ValidationError)) throw err;
    res.status(400);
    await renderOnError(err.errors);
    return undefined;
  }
}

const sortByName = (list) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'de'));

module.exports = { handleForm, sortByName };
