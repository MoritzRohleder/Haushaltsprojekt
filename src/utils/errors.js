'use strict';

/** Eingabefehler, der dem Nutzer im Formular angezeigt wird. */
class ValidationError extends Error {
  constructor(errors) {
    const list = Array.isArray(errors) ? errors : [errors];
    super(list.join(' '));
    this.errors = list;
  }
}

/** Datensatz existiert nicht oder ist für den Nutzer nicht sichtbar (→ 404). */
class NotFoundError extends Error {
  constructor(message = 'Nicht gefunden') {
    super(message);
  }
}

module.exports = { ValidationError, NotFoundError };
