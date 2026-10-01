# Haushaltsprojekt

Eine kleine Webanwendung, um die monatlichen Finanzen eines Haushalts im Blick zu behalten:
Konten (auch gemeinsame), Einnahmen, Ausgaben, Transfers, regelmäßige Buchungen und Anlagen wie Fonds oder Bausparverträge.

Planung und Anforderungen stehen in der [Haushalt-Spec](Haushalt-Spec.md).

## Starten

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
npm start          # http://localhost:3000
```

Für die Entwicklung startet `npm run dev` den Server bei Codeänderungen automatisch neu.
Beim ersten Aufruf registrierst du dich unter „Registrieren“ und legst danach dein erstes Konto an.

## Tests

```bash
npm test
```

## Konfiguration

| Variable | Standard | Bedeutung |
|----------|----------|-----------|
| `PORT` | `3000` | HTTP-Port |
| `DATA_DIR` | `./data` | Ordner für die JSON-Daten |
| `STORAGE` | `json` | Speicher-Adapter |
| `SESSION_SECRET` | zufällig, in `data/.session-secret` | Schlüssel für das Login-Cookie |
| `COOKIE_SECURE` | `false` | `true`, sobald die Seite über HTTPS läuft |

## Daten

Alle Daten liegen als JSON-Dateien in `data/` (nicht im Git). Zum Sichern genügt es, diesen Ordner zu kopieren.
Vor jedem Schreiben legt die Anwendung zusätzlich eine Sicherung in `data/backup/` an.

Die Standard-Kategorien werden beim ersten Start in `data/categories.json` erzeugt und können danach dort angepasst werden.
Bearbeite die Dateien nur bei **gestopptem** Server, sonst überschreibt die laufende Anwendung deine Änderungen.

## Aufbau

```
src/
  app.js, server.js   Express-App und Start
  routes/             Seiten und Formulare
  services/           Fachlogik (Salden, Monatsbilanz, Transfers, Anlagen, regelmäßige Buchungen)
  repositories/       Zugriff auf die Daten je Entität
  storage/            austauschbarer Speicher (heute JSON-Dateien)
views/                EJS-Templates
public/               CSS (Farben in theme.css) und JavaScript
test/                 Tests (node:test)
```

## Lizenz

GNU General Public License v3.0 – siehe [LICENSE](LICENSE).
