# Release veröffentlichen

Checkliste für eine neue Version – am Beispiel **v1.1.0** (vorher: 1.0.0).
Für eine andere Version überall `1.1.0` durch die neue Nummer ersetzen.

## Welche Versionsnummer?

| Änderung | Beispiel | Neue Version |
|----------|----------|--------------|
| Nur Fehlerbehebungen | Rechenfehler, Darstellungsfehler | 1.0.**1** (`patch`) |
| Neue Funktionen, alte Daten laufen weiter | neue Auswertung, neuer Filter | 1.**1**.0 (`minor`) |
| Umbruch: alte Daten oder Abläufe passen nicht mehr ohne Zutun | Speicherformat ohne automatische Migration | **2**.0.0 (`major`) |

Wer auf dem Server `HAUSHALT_VERSION=1` gesetzt hat, bekommt 1.x automatisch, aber nie 2.0 – ein Major-Release also
nur, wenn es wirklich einen Umbruch gibt.

## 1. Vorbereiten (auf dem Branch, z. B. `claude-code`)

- [ ] Alle Änderungen für das Release sind committet.
- [ ] `npm test` ist grün.
- [ ] App einmal lokal starten (`npm start`) und die neuen Funktionen kurz durchklicken.

## 2. Version erhöhen

Die Version steht an diesen Stellen:

| Datei | Stelle | Pflicht? |
|-------|--------|----------|
| `package.json` | `"version": "1.1.0"` | **Ja** – der Release-Workflow bricht ab, wenn sie nicht zum Tag passt |
| `package-lock.json` | `"version"` **zweimal** (oben und unter `packages → ""`) | **Ja** – zusammen mit `package.json` |
| `docs/wiki/_Footer.md` | `Handbuch-Stand: TT.MM.JJJJ · passend zu Haushalt 1.1.0` | Ja – das Handbuch in der App zeigt daneben die echte App-Version; passen beide nicht zusammen, ist das sichtbar |
| `Haushalt-Spec.md` | Zeile 4: `Status: … umgesetzt in Version 1.1.0 der Anwendung …` | Ja |
| `Haushalt-Spec.md` | Kapitel 14 (Meilensteine): `**Stand Version 1.1.0**: …` | Ja |
| `Haushalt-Spec.md` | Kapitel 14: neue Meilenstein-Zeile, falls ein größeres Paket dazukam | optional |
| `Haushalt-Spec.md` | Kapitel 16 (Änderungshistorie): neue Zeile, wenn sich die **Spezifikation** geändert hat | nur bei Spec-Änderungen |

`package.json` und `package-lock.json` am einfachsten in einem Schritt:

```bash
npm version minor --no-git-tag-version    # 1.0.0 → 1.1.0
# npm version patch --no-git-tag-version  # 1.0.0 → 1.0.1
# npm version 1.1.0 --no-git-tag-version  # oder genau diese Nummer
```

`--no-git-tag-version` ist wichtig: Den Tag legt später GitHub beim Release an, nicht npm.

**Nicht** ändern müssen sich (das sind nur Beispiele oder werden automatisch abgeleitet):
`README.md`, `.env.example`, `docker-compose.yml`, `.github/workflows/*.yml`.

Kontrolle – zeigt alle Stellen mit der alten Version (die Spec-Historie und Beispiele im README dürfen bleiben):

```bash
grep -rn "1\.0\.0" --exclude-dir=node_modules --exclude-dir=.git --exclude=package-lock.json .
```

Dann committen und pushen:

```bash
npm test
git add -A
git commit -m "Release 1.1.0"
git push
```

## 3. Nach `master` bringen

- [ ] Auf GitHub einen **Pull Request** vom Branch nach `master` öffnen.
- [ ] Warten, bis die CI grün ist: **Tests (Node 22)**, **Tests (Node 24)**, **Docker-Image**.
- [ ] Pull Request mergen.

## 4. Release erstellen

- [ ] GitHub → **Releases** → **Draft a new release**
- [ ] **Choose a tag**: `v1.1.0` eintippen → *Create new tag: v1.1.0 on publish*
- [ ] **Target**: `master`
- [ ] **Release title**: `1.1.0`
- [ ] Beschreibung: *Generate release notes* klicken und bei Bedarf in eigenen Worten zusammenfassen, was neu ist
- [ ] *Set as a pre-release* nur anhaken, wenn es eine Testversion ist (bekommt dann **nicht** `latest`)
- [ ] **Publish release**

## 5. Image-Bau abwarten

- [ ] GitHub → **Actions** → Workflow **Release** wird grün (dauert einige Minuten, baut für amd64 und arm64).
- [ ] Unter **Packages → haushaltsprojekt** erscheinen die Tags `1.1.0`, `1.1`, `1` und `latest`.

**Schlägt „Release-Tag passt zur Version in package.json“ fehl:** Version in `package.json` stimmt nicht mit dem
Tag überein. Release und Tag auf GitHub löschen (*Releases* → Release → *Delete*, dann unter *Tags* den Tag löschen),
Version korrigieren, nach `master` bringen und das Release neu anlegen.

## 6. Auf den Server

Vorher eine **Sicherung** machen (Befehl im [README](../README.md#daten-sicherung-und-wiederherstellung)).

Je nach `HAUSHALT_VERSION` in der `.env` auf dem Server:

| Wert | Was passiert |
|------|--------------|
| `latest` oder `1` | Der nächtliche Cron holt 1.1.0 automatisch. Sofort: `cd /opt/haushalt && docker compose up -d` |
| `1.0` | 1.1.0 wird **nicht** geholt. In `.env` auf `1.1` (oder `1`) ändern, dann `docker compose up -d` |
| `1.0.0` | Feste Version. In `.env` auf `1.1.0` ändern, dann `docker compose up -d` |

Prüfen:

- [ ] `docker compose ps` → Status `healthy`
- [ ] App im Browser öffnen, anmelden, Übersicht sieht normal aus
- [ ] **Handbuch** (Knopf **?**) → unten steht `App-Version 1.1.0` und `passend zu Haushalt 1.1.0`

Zurück auf die alte Version, falls etwas nicht stimmt: in `.env` `HAUSHALT_VERSION=1.0.0` setzen und
`docker compose up -d`. Hat die neue Version die Daten bereits verändert, vorher die Sicherung zurückspielen.

## 7. Wiki aktualisieren (falls sich das Handbuch geändert hat)

Das GitHub-Wiki wird von Hand gepflegt – Befehle im [README](../README.md#handbuch):

```bash
git clone https://github.com/MoritzRohleder/Haushaltsprojekt.wiki.git
cp Haushaltsprojekt/docs/wiki/* Haushaltsprojekt.wiki/
cd Haushaltsprojekt.wiki && git add . && git commit -m "Handbuch 1.1.0" && git push
```
