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

Voraussetzung: Docker mit Docker Compose auf dem Server.

```bash
git clone https://github.com/MoritzRohleder/Haushaltsprojekt.git
cd Haushaltsprojekt
cp .env.example .env        # Einstellungen anpassen (siehe unten)
docker compose up -d --build
```

Die App läuft dann auf `http://<server>:3000`. Beim ersten Aufruf über „Registrieren“ einen Nutzer anlegen.

| Befehl | Zweck |
|--------|-------|
| `docker compose logs -f` | Logs ansehen |
| `docker compose ps` | Status inkl. Health-Check |
| `docker compose down` | Stoppen (Daten bleiben im Volume erhalten) |
| `git pull && docker compose up -d --build` | Auf neue Version aktualisieren |

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

Den genauen Volume-Namen zeigt `docker volume ls` (Compose stellt den Ordnernamen voran).

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
```

## Lizenz

GNU General Public License v3.0 – siehe [LICENSE](LICENSE).
