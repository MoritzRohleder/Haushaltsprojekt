# Haushaltsprojekt

Eine Webanwendung, um die monatlichen Finanzen eines Haushalts im Blick zu behalten:
Konten (auch gemeinsame), Einnahmen, Ausgaben, Transfers, regelmäßige Buchungen, Anlagen wie Fonds oder Bausparverträge,
Monatsübersichten, Auswertungen mit Diagrammen und CSV-Export. Hell- und Dunkelmodus wählt jeder Nutzer selbst.

Planung und Anforderungen stehen in der [Haushalt-Spec](Haushalt-Spec.md).

- [Auf einem Server mit Docker betreiben](#auf-einem-server-mit-docker-betreiben)
- [Lokal starten (Entwicklung)](#lokal-starten-entwicklung)
- [Konfiguration](#konfiguration)
- [Daten, Sicherung und Wiederherstellung](#daten-sicherung-und-wiederherstellung)

## Auf einem Server mit Docker betreiben

Voraussetzung: Docker mit Docker Compose auf dem Server. Das Repository wird dort **nicht** gebraucht – zu jedem
[Release](https://github.com/MoritzRohleder/Haushaltsprojekt/releases) entsteht automatisch ein fertiges Image
`ghcr.io/moritzrohleder/haushaltsprojekt` (für amd64 und arm64, also auch Raspberry Pi).

```bash
mkdir haushalt && cd haushalt
curl -fsSLO https://raw.githubusercontent.com/MoritzRohleder/Haushaltsprojekt/master/docker-compose.yml
curl -fsSL -o .env https://raw.githubusercontent.com/MoritzRohleder/Haushaltsprojekt/master/.env.example
# .env anpassen (siehe Konfiguration), dann:
docker compose up -d
```

Die App läuft dann auf `http://<server>:3000`. Beim ersten Aufruf über „Registrieren“ einen Nutzer anlegen.

| Befehl | Zweck |
|--------|-------|
| `docker compose up -d` | Starten **und aktualisieren**: zieht immer das neueste Image und startet nur neu, wenn es sich geändert hat |
| `docker compose logs -f` | Logs ansehen |
| `docker compose ps` | Status inkl. Health-Check |
| `docker compose down` | Stoppen (Daten bleiben im Volume erhalten) |

### Automatisch aktualisieren

Die `docker-compose.yml` nutzt `pull_policy: always`: Jedes `docker compose up -d` holt das neueste Image.
`docker restart` oder ein Neustart des Servers zieht dagegen **kein** neues Image.

Am einfachsten läuft das Update regelmäßig per Cron, z. B. jede Nacht um 4 Uhr und nach jedem Neustart des Servers
(`crontab -e`, Pfad anpassen):

```
0 4 * * *  cd /opt/haushalt && docker compose up -d --quiet-pull >/dev/null 2>&1
@reboot    sleep 60 && cd /opt/haushalt && docker compose up -d --quiet-pull >/dev/null 2>&1
```

Welche Versionen gezogen werden, steuert `HAUSHALT_VERSION` in `.env`:

| Wert | Bedeutung |
|------|-----------|
| `latest` | immer die neueste veröffentlichte Version (Standard) |
| `1` | neueste Version 1.x – keine Sprünge auf 2.0 |
| `1.0` | neueste Version 1.0.x – nur Fehlerbehebungen, keine Sprünge auf 1.1 |
| `1.0.0` | genau diese Version (kein automatisches Update) |

Vor einem größeren Update lohnt sich eine [Sicherung](#daten-sicherung-und-wiederherstellung).

### HTTPS mit einem Reverse Proxy

Ist die App aus dem Internet erreichbar, gehört ein Reverse Proxy mit HTTPS davor. Mit [Caddy](https://caddyserver.com)
geht das mit wenigen Zeilen (Zertifikat von Let's Encrypt automatisch). Beispiel als Ergänzung in `docker-compose.yml`:

```yaml
services:
  haushalt:
    # … wie bisher, aber ohne "ports:" – nur Caddy ist von außen erreichbar
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    command: caddy reverse-proxy --from haushalt.example.de --to haushalt:3000
    volumes: [caddy-data:/data]

volumes:
  haushalt-data:
  caddy-data:
```

Dann in `.env` setzen:

```
COOKIE_SECURE=true
TRUST_PROXY=1
```

`TRUST_PROXY=1` sorgt dafür, dass die App die echte IP-Adresse der Besucher sieht (wichtig für die Login-Bremse).

## Neue Version veröffentlichen

Ausführliche Checkliste mit allen Stellen, an denen die Version steht: [docs/RELEASE.md](docs/RELEASE.md).

1. Version in `package.json` erhöhen, z. B. `npm version minor --no-git-tag-version` (1.0.0 → 1.1.0), und in
   `docs/wiki/_Footer.md` Handbuch-Stand und Version anpassen.
2. Änderungen per Pull Request nach `master` bringen (die Tests müssen grün sein).
3. Auf GitHub unter **Releases → Draft a new release** einen Tag `v1.1.0` auf `master` anlegen und veröffentlichen.
   Der Tag muss zur Version in `package.json` passen, sonst bricht der Release-Workflow ab.
4. Der Workflow **Release** testet, baut das Image und lädt es als `1.1.0`, `1.1`, `1` und `latest` hoch.
   Ein als *pre-release* markiertes Release bekommt nur seinen eigenen Tag, nicht `latest`.

Für das **erste Release** steht die Version bereits auf `1.0.0` – Schritt 1 entfällt, der Tag heißt `v1.0.0`.

Beim allerersten Release ist das Paket auf ghcr.io eventuell noch **privat**. Dann einmalig auf GitHub unter
**Packages → haushaltsprojekt → Package settings → Change visibility** auf **Public** stellen, damit der Server
es ohne Anmeldung ziehen kann.

## Tests und CI

Der Workflow **CI** (`.github/workflows/ci.yml`) läuft bei jedem Push und bei jedem Pull Request auf `master`:

- **Tests (Node 22)** und **Tests (Node 24)**: `npm test`
- **Docker-Image**: baut das Image und prüft, ob der Container startet und gesund wird

Damit nichts ungetestet in `master` landet, unter **Settings → Rules → Rulesets → New branch ruleset**:

- *Target branches*: `master` (Default branch)
- **Require a pull request before merging**
- **Require status checks to pass** → die drei Checks oben hinzufügen (sie erscheinen in der Auswahl, sobald die CI einmal gelaufen ist)
- **Block force pushes**

## Lokal starten (Entwicklung)

Voraussetzung: Node.js 22 oder neuer (empfohlen: aktuelle LTS-Version).

```bash
npm install
npm start          # http://localhost:3000
npm run dev        # startet bei Codeänderungen automatisch neu
npm test           # automatische Tests
```

## Konfiguration

Umgebungsvariablen (lokal direkt, bei Docker über `.env`):

| Variable | Standard | Bedeutung |
|----------|----------|-----------|
| `PORT` | `3000` | HTTP-Port im Container bzw. lokal |
| `HAUSHALT_VERSION` | `latest` | Nur Docker Compose: welche Image-Version gezogen wird |
| `HOST_PORT` | `3000` | Nur Docker Compose: Port auf dem Server |
| `DATA_DIR` | `./data` (Docker: `/app/data`) | Ordner für die Daten |
| `SESSION_SECRET` | zufällig, in `data/.session-secret` | Schlüssel für das Login-Cookie |
| `COOKIE_SECURE` | `false` | `true`, sobald die App über HTTPS läuft (aktiviert auch HSTS) |
| `TRUST_PROXY` | `false` | Hinter einem Reverse Proxy: Anzahl der Proxys, z. B. `1` |
| `ASSET_STALE_MONTHS` | `6` | Hinweis „Stand veraltet“ bei Anlagen nach so vielen Monaten |
| `TZ` | Systemzeit (Docker: `Europe/Berlin`) | Zeitzone; bestimmt, wann regelmäßige Buchungen fällig sind |

## Daten, Sicherung und Wiederherstellung

Alle Daten liegen als JSON-Dateien im Datenordner (lokal `data/`, bei Docker im Volume `haushalt-data`).
Vor jedem Schreiben legt die Anwendung zusätzlich eine Sicherung in `backup/` an.
Kassenzettel (Fotos/PDFs) liegen in `uploads/` – sie sind in Sicherung und Kopie automatisch enthalten. Bei vielen Fotos kann der Ordner einige hundert MB groß werden.

**Sicherung bei Docker** (erzeugt `haushalt-backup.tar.gz` im aktuellen Ordner):

```bash
docker run --rm -v haushaltsprojekt_haushalt-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/haushalt-backup.tar.gz -C /data .
```

**Wiederherstellen** (App vorher stoppen):

```bash
docker compose down
docker run --rm -v haushaltsprojekt_haushalt-data:/data -v "$PWD":/backup alpine \
  sh -c "rm -rf /data/* /data/.session-secret && tar xzf /backup/haushalt-backup.tar.gz -C /data && chown -R 1000:1000 /data"
docker compose up -d
```

Das Volume heißt immer `haushaltsprojekt_haushalt-data` (fester Projektname in der `docker-compose.yml`).

> **Umstieg von einer älteren Installation** (mit `git clone` und `--build` in einem Ordner mit anderem Namen als
> `Haushaltsprojekt`): Prüfe mit `docker volume ls`, wie dein bisheriges Volume heißt, und kopiere die Daten
> mit den Befehlen oben (Sicherung aus dem alten, Wiederherstellung ins neue Volume).

Die Standard-Kategorien werden beim ersten Start in `categories.json` erzeugt und können danach dort angepasst werden.
Bearbeite die Dateien nur bei **gestopptem** Server, sonst überschreibt die laufende Anwendung deine Änderungen.

## Handbuch

Das Nutzerhandbuch liegt in [`docs/wiki/`](docs/wiki) – eine Datei pro Kapitel. Die Anwendung zeigt es unter `/handbuch` an (Knopf **?** in der Navigation); im GitHub-Wiki wird es manuell gepflegt.

- Reihenfolge und Titel der Kapitel: `docs/wiki/_Sidebar.md`
- Stand des Handbuchs: `docs/wiki/_Footer.md` – bei Änderungen Datum und Version anpassen
- Links zwischen Seiten im Wiki-Format: `[Text](Konten)` oder `[Text](Anlagen#wie-der-wert-berechnet-wird)`
- `npm test` prüft, dass alle Links im Handbuch auf vorhandene Seiten und Abschnitte zeigen

Ins Wiki übertragen (einmalig im Wiki eine erste Seite anlegen, damit das Wiki-Repository existiert):

```bash
git clone https://github.com/MoritzRohleder/Haushaltsprojekt.wiki.git
cp Haushaltsprojekt/docs/wiki/* Haushaltsprojekt.wiki/
cd Haushaltsprojekt.wiki && git add . && git commit -m "Handbuch aktualisiert" && git push
```

## Aufbau

```
src/
  app.js, server.js   Express-App und Start
  routes/             Seiten und Formulare
  services/           Fachlogik (Salden, Monatsbilanz, Transfers, Anlagen, regelmäßige Buchungen, Login-Bremse)
  repositories/       Zugriff auf die Daten je Entität
  storage/            austauschbarer Speicher (heute JSON-Dateien)
  utils/              Geld, Datum, Diagramme, CSV
docs/wiki/            Nutzerhandbuch (in der App unter /handbuch, gespiegelt ins GitHub-Wiki)
views/                EJS-Templates
public/               CSS (Farben in theme.css) und JavaScript
test/                 Tests (node:test)
Dockerfile, docker-compose.yml, .env.example
.github/workflows/    CI (Tests, Docker-Build) und Release (Image nach ghcr.io)
```

## Lizenz

GNU General Public License v3.0 – siehe [LICENSE](LICENSE).
