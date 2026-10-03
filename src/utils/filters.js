'use strict';

/**
 * Mehrfachauswahl aus der Adresszeile lesen: `?konto=a&konto=b` ergibt ['a', 'b'].
 * Leere und doppelte Werte fallen weg; mit `allowed` nur bekannte Werte.
 */
function multi(value, allowed = null) {
  const list = [].concat(value ?? []).filter((v) => typeof v === 'string' && v !== '');
  return [...new Set(allowed ? list.filter((v) => allowed.includes(v)) : list)];
}

/** Trifft ein Wert auf die Auswahl zu? Keine Auswahl heißt „alle“. */
const allows = (selected, value) => !selected.length || selected.includes(value);

/** Filter als Query-String (Listen als wiederholte Parameter), leere Werte weggelassen. */
function toQuery(filters, keys) {
  const q = new URLSearchParams();
  for (const key of keys) {
    for (const v of [].concat(filters[key] ?? [])) {
      if (v !== '' && v !== false && v !== null && v !== undefined) q.append(key, v === true ? '1' : String(v));
    }
  }
  return q.toString();
}

module.exports = { multi, allows, toQuery };
