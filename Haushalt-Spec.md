# Haushalt-Spec

> Spezifikation für die Webanwendung **Haushaltsprojekt** zur Verwaltung der monatlichen Finanzen.
> Status: **Entwurf v0.1** – Grundlage für die Planung, noch keine Implementierung.
> Offene Punkte sind in [Kapitel 12](#12-offene-fragen) gesammelt und mit `❓` markiert.

---

## Inhaltsverzeichnis

1. [Ziel und Zweck](#1-ziel-und-zweck)
2. [Leitprinzipien](#2-leitprinzipien)
3. [Begriffe](#3-begriffe)
4. [Datenmodell](#4-datenmodell)
5. [Berechnungsregeln](#5-berechnungsregeln)
6. [Funktionale Anforderungen](#6-funktionale-anforderungen)
7. [Abläufe](#7-abläufe)
8. [Seiten und Navigation](#8-seiten-und-navigation)
9. [Technologie-Stack](#9-technologie-stack)
10. [Nicht-funktionale Anforderungen](#10-nicht-funktionale-anforderungen)
11. [Abgrenzung (nicht im ersten Release)](#11-abgrenzung-nicht-im-ersten-release)
12. [Offene Fragen](#12-offene-fragen)
13. [Meilensteine](#13-meilensteine)
14. [Lizenz](#14-lizenz)

---

## 1. Ziel und Zweck

Die Anwendung soll einen **Überblick über alle Finanzen eines Haushalts** geben und das **Erfassen neuer Einnahmen, Ausgaben und Transfers** ermöglichen.

Kernfragen, die die Anwendung beantworten soll:

- Wie viel Geld liegt aktuell auf welchem Konto?
- Was ist in einem Monat reingekommen, was ist rausgegangen – insgesamt, pro Konto und pro Nutzer?
- Wofür wurde das Geld ausgegeben (Kategorien)?
- Welches Geld wurde zwischen den Konten verschoben (Transfers)?

## 2. Leitprinzipien

| # | Prinzip | Bedeutung |
|---|---------|-----------|
| P1 | **Generisch statt maßgeschneidert** | Die Software kennt keine konkreten Personen, Konten oder Kategorien. Die eigene Situation wird ausschließlich über das Anlegen von Daten (Nutzer, Konten, Kategorien, …) abgebildet. Nichts davon ist im Code fest verdrahtet. |
| P2 | **Einfach bleiben** | Kleine, server-gerenderte Webanwendung. Kein SPA-Framework, kein Build-Schritt fürs Frontend. |
| P3 | **Nachvollziehbarkeit** | Kontostände werden immer aus den Buchungen berechnet, nicht separat gespeichert. Jede Zahl in einer Übersicht lässt sich auf einzelne Buchungen zurückführen. |
| P4 | **Korrekte Beträge** | Geldbeträge werden als ganze Zahlen in Cent gespeichert, nie als Gleitkommazahl. |
| P5 | **Daten gehören uns** | Selbst gehostet (z. B. lokal oder im Heimnetz), Daten liegen in einer lokalen Datei/DB, Export ist möglich. |

## 3. Begriffe

| Begriff | Definition |
|---------|------------|
| **Nutzer** | Eine Person im Haushalt (z. B. zwei Partner). Nutzer haben eigene Einnahmen und Ausgaben. |
| **Konto** | Ein Ort, an dem Geld liegt: Girokonto, Sparkonto, Bargeld, Kreditkarte, Tagesgeld, … |
| **Kontoinhaber** | Zuordnung Konto ↔ Nutzer. Ein Konto hat **einen oder mehrere** Inhaber (Einzel- oder Gemeinschaftskonto). |
| **Buchung** | Eine einzelne Geldbewegung. Es gibt drei Arten: **Einnahme**, **Ausgabe**, **Transfer**. |
| **Einnahme** | Geld kommt von außen auf ein Konto (Gehalt, Erstattung, …). |
| **Ausgabe** | Geld verlässt den Haushalt von einem Konto (Miete, Einkauf, …). |
| **Transfer** | Geld wird zwischen zwei eigenen Konten verschoben. Verändert das Gesamtvermögen nicht. |
| **Kategorie** | Frei anlegbare Einordnung von Einnahmen/Ausgaben (z. B. „Lebensmittel“, „Gehalt“). |
| **Zugeordneter Nutzer** | Der Nutzer, dem eine Einnahme/Ausgabe *zugerechnet* wird (z. B. „wessen Ausgabe war das?“). Unabhängig davon, von welchem Konto bezahlt wurde. |
| **Wiederkehrende Buchung** | Vorlage für regelmäßige Buchungen (Gehalt, Miete, Abos, Daueraufträge). |
| **Periode / Monat** | Die Standard-Betrachtungseinheit der Übersichten ist ein Kalendermonat. |

## 4. Datenmodell

### 4.1 Überblick

```
 ┌─────────┐   n        m  ┌─────────┐
 │  Nutzer │──────────────│  Konto  │      (Kontoinhaber, n:m)
 └────┬────┘               └────┬────┘
      │ 0..1                    │ 1 (bzw. 2 bei Transfer)
      │  zugeordnet             │
      ▼  n                      ▼ n
 ┌──────────────────────────────────┐   n     0..1 ┌───────────┐
 │             Buchung              │──────────────│ Kategorie │
 │ (Einnahme | Ausgabe | Transfer)  │              └───────────┘
 └──────────────────────────────────┘
      ▲ n
      │ erzeugt aus (optional)
      │ 0..1
 ┌───────────────────────────┐
 │  Wiederkehrende Buchung   │
 └───────────────────────────┘
```

### 4.2 Entitäten

#### Nutzer (`users`)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | Integer | ja | Primärschlüssel |
| `name` | Text | ja | Anzeigename, eindeutig |
| `color` | Text | nein | Farbe für die Darstellung (Hex) |
| `archived` | Boolean | ja | Archivierte Nutzer erscheinen nicht mehr in Auswahllisten, ihre Buchungen bleiben erhalten |
| `created_at` | Zeitstempel | ja | |

#### Konto (`accounts`)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | Integer | ja | Primärschlüssel |
| `name` | Text | ja | z. B. „Girokonto Gemeinsam“ |
| `type` | Enum | ja | `giro`, `savings`, `cash`, `credit_card`, `other` |
| `iban` | Text | nein | Nur zur Information, keine Bankanbindung |
| `opening_balance_cents` | Integer | ja | Anfangssaldo zum Stichtag (Default 0) |
| `opening_date` | Datum | ja | Ab diesem Datum wird gerechnet |
| `archived` | Boolean | ja | Geschlossene Konten bleiben in der Historie sichtbar |
| `sort_order` | Integer | nein | Reihenfolge in Listen |

#### Kontoinhaber (`account_owners`)

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `account_id` | FK → accounts | |
| `user_id` | FK → users | |

Regel: Jedes Konto hat **mindestens einen** Inhaber.

#### Kategorie (`categories`)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | Integer | ja | |
| `name` | Text | ja | |
| `kind` | Enum | ja | `income` oder `expense` – steuert, bei welcher Buchungsart sie angeboten wird |
| `parent_id` | FK → categories | nein | Optional eine Ebene Unterkategorien (z. B. „Wohnen › Strom“) ❓ |
| `archived` | Boolean | ja | |

#### Buchung (`transactions`)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | Integer | ja | |
| `type` | Enum | ja | `income`, `expense`, `transfer` |
| `date` | Datum | ja | Buchungsdatum |
| `amount_cents` | Integer | ja | Immer **positiv**; die Richtung ergibt sich aus `type` |
| `account_id` | FK → accounts | ja | Bei Einnahme: Zielkonto. Bei Ausgabe: Quellkonto. Bei Transfer: **Quellkonto** |
| `to_account_id` | FK → accounts | nur Transfer | Zielkonto des Transfers; muss ≠ `account_id` sein |
| `user_id` | FK → users | nein* | Zugeordneter Nutzer. *Bei Einnahme/Ausgabe: entweder ein Nutzer oder leer = „gemeinsam“. Bei Transfer: optional, wer ihn ausgelöst hat |
| `category_id` | FK → categories | nein | Nicht bei Transfers |
| `description` | Text | ja | Kurzer Text, z. B. „Wocheneinkauf Rewe“ |
| `note` | Text | nein | Freitext |
| `recurring_id` | FK → recurring | nein | Gesetzt, wenn aus einer wiederkehrenden Buchung erzeugt |
| `created_at`, `updated_at` | Zeitstempel | ja | |

**Warum ein Transfer *eine* Buchung ist (und nicht zwei):** So kann ein Transfer nie „halb“ existieren, er lässt sich als Pfeil Konto A → Konto B darstellen und wird in Einnahme/Ausgabe-Summen sicher ausgeklammert.

#### Wiederkehrende Buchung (`recurring`)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | Integer | ja | |
| Alle inhaltlichen Felder einer Buchung | | | `type`, `amount_cents`, `account_id`, `to_account_id`, `user_id`, `category_id`, `description` |
| `interval` | Enum | ja | `monthly`, `quarterly`, `yearly` (MVP: `monthly`) |
| `day_of_month` | Integer 1–31 | ja | Bei kürzeren Monaten wird der letzte Tag des Monats verwendet |
| `start_date` | Datum | ja | |
| `end_date` | Datum | nein | |
| `active` | Boolean | ja | |

## 5. Berechnungsregeln

### 5.1 Kontostand

```
Kontostand(K, Stichtag) =
      Anfangssaldo(K)
    + Σ Einnahmen  auf K            (Datum ≤ Stichtag)
    − Σ Ausgaben   von K            (Datum ≤ Stichtag)
    + Σ Transfers  mit Ziel K       (Datum ≤ Stichtag)
    − Σ Transfers  mit Quelle K     (Datum ≤ Stichtag)
```

Buchungen vor dem `opening_date` eines Kontos sind nicht erlaubt.

### 5.2 Monatsbilanz

- **Einnahmen des Monats** = Σ aller Buchungen vom Typ `income` im Monat.
- **Ausgaben des Monats** = Σ aller Buchungen vom Typ `expense` im Monat.
- **Saldo des Monats** = Einnahmen − Ausgaben.
- **Transfers zählen nie** als Einnahme oder Ausgabe. Sie werden separat ausgewiesen.

### 5.3 Sicht pro Nutzer

Es gibt zwei unterschiedliche Fragen, die die Anwendung beide beantworten soll:

1. **„Wem gehört welches Geld?“** – über die Kontoinhaber.
   Gesamtvermögen eines Nutzers = Summe der Kontostände seiner Einzelkonten + **anteilig** die Gemeinschaftskonten (gleichmäßig auf die Inhaber verteilt). ❓ Anteil konfigurierbar?
2. **„Wer hat was eingenommen/ausgegeben?“** – über den **zugeordneten Nutzer** einer Buchung.
   Buchungen ohne zugeordneten Nutzer erscheinen als **„Gemeinsam“**.

Beispiel: Nutzer A bezahlt den Wocheneinkauf vom Gemeinschaftskonto → Konto = Gemeinschaftskonto, zugeordneter Nutzer = leer („Gemeinsam“). Nutzer A kauft sich privat Schuhe vom Gemeinschaftskonto → zugeordneter Nutzer = A.

### 5.4 Beträge und Formate

- Speicherung in Cent (`Integer`), Anzeige als `1.234,56 €`.
- Eingabe akzeptiert `1234,56`, `1.234,56` und `1234.56`.
- Währung im MVP fest **EUR** (eine Währung pro Installation).
- Datumsanzeige `TT.MM.JJJJ`, intern ISO `JJJJ-MM-TT`.

## 6. Funktionale Anforderungen

Priorität: **M** = Muss (MVP), **S** = Soll (kurz nach MVP), **K** = Kann (später).

### 6.1 Stammdaten / Konfiguration

| ID | Anforderung | Prio |
|----|-------------|------|
| F-01 | Nutzer anlegen, bearbeiten, archivieren | M |
| F-02 | Konten anlegen, bearbeiten, archivieren (Name, Typ, Anfangssaldo, Stichtag) | M |
| F-03 | Einem Konto einen oder mehrere Inhaber zuweisen | M |
| F-04 | Kategorien für Einnahmen und Ausgaben anlegen, bearbeiten, archivieren | M |
| F-05 | Löschen von Stammdaten nur, wenn keine Buchungen daran hängen – sonst nur Archivieren | M |
| F-06 | Beim allerersten Start: geführte Ersteinrichtung (Nutzer → Konten → Kategorien) | S |
| F-07 | Optional ein Satz Standard-Kategorien zum Übernehmen bei der Ersteinrichtung | K |

### 6.2 Buchungen

| ID | Anforderung | Prio |
|----|-------------|------|
| F-10 | Einnahme erfassen (Datum, Betrag, Konto, Nutzer/gemeinsam, Kategorie, Beschreibung) | M |
| F-11 | Ausgabe erfassen (analog) | M |
| F-12 | Transfer erfassen (Datum, Betrag, Von-Konto, Nach-Konto, Beschreibung) | M |
| F-13 | Buchung bearbeiten und löschen (mit Bestätigung) | M |
| F-14 | Buchungsliste mit Filtern: Zeitraum/Monat, Konto, Nutzer, Kategorie, Typ, Freitextsuche | M |
| F-15 | Schnelleingabe: Formular merkt sich zuletzt verwendetes Konto/Nutzer; Datum vorbelegt mit heute | S |
| F-16 | Buchung duplizieren („nochmal buchen“) | S |

### 6.3 Wiederkehrende Buchungen

| ID | Anforderung | Prio |
|----|-------------|------|
| F-20 | Wiederkehrende Buchungen anlegen, bearbeiten, pausieren, beenden | S |
| F-21 | Fällige wiederkehrende Buchungen werden für einen Monat als **Vorschlag** angezeigt und per Klick (einzeln oder alle) übernommen – keine automatische Buchung ohne Bestätigung ❓ | S |
| F-22 | Eine übernommene Buchung kann vor dem Speichern angepasst werden (z. B. abweichender Betrag) | S |

### 6.4 Übersichten

| ID | Anforderung | Prio |
|----|-------------|------|
| F-30 | **Dashboard**: aktuelle Kontostände aller Konten + Gesamtsumme | M |
| F-31 | **Monatsübersicht**: Einnahmen, Ausgaben, Saldo des gewählten Monats; Blättern zwischen Monaten | M |
| F-32 | Monatsübersicht aufgeschlüsselt nach Nutzer (inkl. „Gemeinsam“) | M |
| F-33 | Monatsübersicht aufgeschlüsselt nach Kategorie | M |
| F-34 | **Transfers des Monats** als eigene Liste/Übersicht (Von → Nach, Betrag) | M |
| F-35 | **Kontodetail**: Buchungen eines Kontos mit laufendem Saldo | M |
| F-36 | Vergleich über mehrere Monate (Tabelle: Monat × Einnahmen/Ausgaben/Saldo) | S |
| F-37 | Diagramme (Ausgaben nach Kategorie, Verlauf Kontostand) | K |
| F-38 | Darstellung der Transfers als Fluss-Diagramm zwischen Konten | K |

### 6.5 Daten

| ID | Anforderung | Prio |
|----|-------------|------|
| F-40 | Export aller Buchungen als CSV | S |
| F-41 | Vollständiges Backup/Restore (DB-Datei bzw. JSON) | S |
| F-42 | CSV-Import von Kontoauszügen | K |

### 6.6 Zugang

| ID | Anforderung | Prio |
|----|-------------|------|
| F-50 | Zugriffsschutz der Anwendung ❓ (siehe offene Fragen) | S |

## 7. Abläufe

### 7.1 Ersteinrichtung

1. Anwendung startet mit leerer Datenbank → Weiterleitung auf „Einrichtung“.
2. Nutzer anlegen (mind. 1).
3. Konten anlegen, je Konto: Name, Typ, Inhaber (Mehrfachauswahl), Anfangssaldo und Stichtag (z. B. Kontostand laut Bank am 01. des Monats).
4. Kategorien anlegen (oder Standard-Set übernehmen).
5. Weiter zum Dashboard.

Alles aus der Einrichtung ist später unter „Einstellungen“ änderbar.

### 7.2 Einnahme / Ausgabe erfassen

1. Klick auf „+ Ausgabe“ (bzw. „+ Einnahme“) – global in der Navigation erreichbar.
2. Formular: Datum (heute), Betrag, Konto, Nutzer (Auswahl der Nutzer + „Gemeinsam“), Kategorie (nur passende Art), Beschreibung, Notiz.
3. Validierung serverseitig: Betrag > 0, Konto existiert und ist nicht archiviert, Datum ≥ Stichtag des Kontos.
4. Speichern → Rückkehr zur vorherigen Seite mit Erfolgsmeldung; Option „Speichern & weitere erfassen“.

**Vorschlag:** Bei Wahl eines Kontos mit genau einem Inhaber wird dieser Nutzer vorausgewählt; bei Gemeinschaftskonten „Gemeinsam“.

### 7.3 Transfer erfassen

1. Klick auf „⇄ Transfer“.
2. Formular: Datum, Betrag, Von-Konto, Nach-Konto, Beschreibung.
3. Validierung: Von ≠ Nach, Betrag > 0.
4. Speichern. Der Transfer erscheint in beiden Kontodetails (einmal als Abgang, einmal als Zugang) und in der Transfer-Übersicht.

### 7.4 Monatsabschluss / Monatsbeginn (mit wiederkehrenden Buchungen)

1. Monatsübersicht öffnen.
2. Hinweis „X wiederkehrende Buchungen für diesen Monat noch nicht übernommen“.
3. Liste prüfen, ggf. Beträge anpassen, übernehmen.
4. Kontostände mit Bank vergleichen; Abweichungen durch Korrekturbuchung ausgleichen.

## 8. Seiten und Navigation

| Seite | Route (Vorschlag) | Inhalt |
|-------|-------------------|--------|
| Dashboard | `GET /` | Kontostände, Gesamtsumme, Kurzbilanz aktueller Monat, letzte Buchungen |
| Monatsübersicht | `GET /monat/:jahr-:monat` | Bilanz, nach Nutzer, nach Kategorie, Transfers, fällige wiederkehrende Buchungen |
| Buchungen | `GET /buchungen` | Gefilterte Liste (Query-Parameter für Filter) |
| Neue Buchung | `GET/POST /buchungen/neu?typ=…` | Formular für Einnahme / Ausgabe / Transfer |
| Buchung bearbeiten | `GET/POST /buchungen/:id/bearbeiten` | |
| Buchung löschen | `POST /buchungen/:id/loeschen` | |
| Konten | `GET /konten` | Liste aller Konten mit Saldo und Inhabern |
| Kontodetail | `GET /konten/:id` | Buchungen mit laufendem Saldo |
| Einstellungen | `GET /einstellungen/…` | Nutzer, Konten, Kategorien, wiederkehrende Buchungen, Export |
| Einrichtung | `GET /einrichtung` | Nur bei leerer DB |

Hinweis: Da HTML-Formulare nur `GET` und `POST` kennen, werden Änderungen/Löschungen über `POST` umgesetzt (Muster *Post/Redirect/Get*).

## 9. Technologie-Stack

Aufbauend auf dem Stack aus dem früheren Projekt (`WebTechExam`), der sich aus der `package.json` ergibt: **Node.js + Express + EJS**.

### 9.1 Komponenten

| Baustein | Wahl | Zweck | Herkunft |
|----------|------|-------|----------|
| Laufzeit | **Node.js** (aktuelle LTS-Version) | Führt JavaScript auf dem Server aus | wie bisher |
| Web-Framework | **Express** | Routing (URL → Funktion), Middleware, Formular-Verarbeitung | wie bisher (dort 4.17) ❓ Version |
| Template-Engine | **EJS** | HTML-Seiten auf dem Server mit Daten befüllen (`<%= … %>`) | wie bisher |
| Datenhaltung | **SQLite** über **`better-sqlite3`** (Vorschlag) | Eine einzige DB-Datei, kein separater DB-Server, ideal für Relationen wie Konto ↔ Nutzer | **neu** ❓ |
| Layouts/Partials | EJS `include()` (Header, Navigation, Footer) | Wiederverwendbare Seitenteile | wie bisher |
| CSS | Eigenes, schlankes CSS (optional ein klassenloses Framework wie Pico.css) | Lesbare, responsive Oberfläche ohne Build-Schritt | ❓ |
| Client-JS | Nur wo nötig, Vanilla JS (z. B. Vorauswahl Nutzer bei Kontowahl) | | |
| Entwicklung | `nodemon` (Dev-Dependency) | Server bei Codeänderungen neu starten | neu, optional |
| Tests | `node:test` (in Node eingebaut) | Tests für die Berechnungsregeln (Kapitel 5) | neu |

Was die Pakete im alten Lockfile waren: Fast alle Einträge (`body-parser`, `accepts`, `send`, `qs`, …) sind **Unterabhängigkeiten von Express**, `jake`, `chalk` usw. gehören zu EJS. Direkt genutzt wurden nur `express` und `ejs`. Die alten Versionen (Stand 2022) werden **nicht** übernommen, sondern aktuelle Versionen frisch installiert, da es seitdem Sicherheitsupdates gab.

### 9.2 Projektstruktur (Vorschlag)

```
Haushaltsprojekt/
├── package.json
├── Haushalt-Spec.md          ← dieses Dokument
├── src/
│   ├── app.js                ← Express-Setup, Middleware, Start
│   ├── db/
│   │   ├── index.js          ← DB-Verbindung
│   │   ├── schema.sql        ← Tabellen (Kapitel 4)
│   │   └── migrations/       ← spätere Schemaänderungen
│   ├── models/               ← Datenzugriff je Entität (users, accounts, …)
│   ├── services/             ← Berechnungen (Salden, Monatsbilanz)
│   ├── routes/               ← Express-Router je Bereich
│   └── utils/                ← Geldformat, Datumsformat, Validierung
├── views/
│   ├── partials/             ← header.ejs, nav.ejs, footer.ejs
│   ├── dashboard.ejs
│   ├── month.ejs
│   ├── transactions/
│   ├── accounts/
│   └── settings/
├── public/
│   ├── css/
│   └── js/
├── data/                     ← SQLite-Datei (in .gitignore!)
└── test/
```

### 9.3 Konfiguration

Über Umgebungsvariablen (bzw. `.env`, nicht eingecheckt):

| Variable | Default | Bedeutung |
|----------|---------|-----------|
| `PORT` | `3000` | HTTP-Port |
| `DB_PATH` | `./data/haushalt.db` | Pfad zur Datenbankdatei |
| `SESSION_SECRET` | – | Nur falls Login (F-50) umgesetzt wird |

## 10. Nicht-funktionale Anforderungen

| ID | Anforderung |
|----|-------------|
| N-01 | **Sprache** der Oberfläche: Deutsch. |
| N-02 | **Responsive**: auf dem Smartphone nutzbar, vor allem das Erfassen von Buchungen. |
| N-03 | **Sicherheit**: Alle Ausgaben in EJS escaped (`<%= %>`, nicht `<%- %>` für Nutzereingaben); SQL nur mit Prepared Statements; serverseitige Validierung aller Formulare. |
| N-04 | **Datenkonsistenz**: Fremdschlüssel aktiv (`PRAGMA foreign_keys = ON`); Mehrschritt-Änderungen in Transaktionen. |
| N-05 | **Betrieb**: Start mit `npm start`; läuft lokal oder auf einem kleinen Server im Heimnetz (z. B. Raspberry Pi / NAS). |
| N-06 | **Datensicherung**: Die DB-Datei ist das einzige, was gesichert werden muss. Sie liegt nicht im Git-Repository. |
| N-07 | **Performance**: Für Haushaltsgröße (einige tausend Buchungen pro Jahr) ausgelegt; Seitenaufbau < 500 ms. |
| N-08 | **Testbarkeit**: Die Berechnungsregeln aus Kapitel 5 sind durch automatisierte Tests abgedeckt. |

## 11. Abgrenzung (nicht im ersten Release)

- Keine direkte Bankanbindung (FinTS/HBCI, PSD2-APIs).
- Keine Budgets/Sparziele (Kandidat für später).
- Keine Mehrwährungsfähigkeit.
- Keine Aufteilung einer Buchung auf mehrere Kategorien/Nutzer (Split-Buchungen).
- Keine Ausgleichsrechnung „wer schuldet wem“ (Kandidat für später, siehe offene Fragen).
- Keine mobile App – nur Webseite.

## 12. Offene Fragen

| # | Frage | Vorschlag |
|---|-------|-----------|
| Q1 | **Datenhaltung**: SQLite oder eine einfache JSON-Datei? | SQLite (`better-sqlite3`): Relationen (Konto ↔ Nutzer), Filter und Summen lassen sich mit SQL deutlich einfacher und sicherer abbilden. |
| Q2 | **Express-Version**: bei 4.x bleiben oder auf Express 5 gehen? | Express 5 (aktuelle Hauptversion). Für dieses Projekt kaum Unterschiede zur gewohnten 4.x-Nutzung. |
| Q3 | **Login**: Braucht es eine Anmeldung? Falls ja: ein gemeinsames Passwort für den Haushalt oder ein Login je Nutzer? Hängt davon ab, ob die Seite nur im Heimnetz oder aus dem Internet erreichbar ist. | MVP ohne Login, nur im Heimnetz. Danach ein gemeinsames Passwort (Session-Cookie). Sobald die Seite aus dem Internet erreichbar ist, ist ein Login Pflicht. |
| Q4 | **Anteil an Gemeinschaftskonten**: immer gleichmäßig oder pro Inhaber konfigurierbar (z. B. 60/40)? | MVP: gleichmäßig. Feld `share_percent` in `account_owners` später nachrüstbar. |
| Q5 | **Wiederkehrende Buchungen**: nur Vorschlag mit Bestätigung oder automatisch buchen? | Vorschlag mit Bestätigung (F-21), weil Beträge oft leicht abweichen. |
| Q6 | **Unterkategorien**: nötig? | Eine Ebene optional (`parent_id`), im MVP nicht in der Oberfläche. |
| Q7 | **Kreditkarten**: als eigenes Konto mit negativem Saldo und Monatsausgleich per Transfer? | Ja – passt ohne Sonderlogik ins Modell. |
| Q8 | **Ausgleich zwischen Nutzern** („A hat für B bezahlt“): gewünscht? | Später; das Modell (Konto + zugeordneter Nutzer) liefert die Datenbasis bereits. |
| Q9 | **Bargeld**: als eigenes Konto pro Nutzer führen? | Ja, Typ `cash`. |
| Q10 | **Styling**: eigenes CSS oder klassenloses Framework (Pico.css)? | Pico.css – sieht ohne Aufwand ordentlich aus, kein Build-Schritt. |

## 13. Meilensteine

| # | Meilenstein | Inhalt |
|---|-------------|--------|
| M0 | **Spezifikation** | Dieses Dokument abstimmen, offene Fragen klären. |
| M1 | **Grundgerüst** | `package.json`, Express + EJS, Layout/Navigation, DB-Anbindung, Schema, `npm start`. |
| M2 | **Stammdaten** | F-01 bis F-05: Nutzer, Konten mit Inhabern, Kategorien. |
| M3 | **Buchungen** | F-10 bis F-14: Einnahmen, Ausgaben, Transfers erfassen, bearbeiten, listen. |
| M4 | **Übersichten** | F-30 bis F-35: Dashboard, Monatsübersicht, Kontodetail, Transfers. Tests der Berechnungsregeln. → **MVP fertig** |
| M5 | **Komfort** | F-06, F-15, F-16, F-20 bis F-22, F-36, F-40, F-41. |
| M6 | **Zugang & Ausbau** | F-50 Login, danach Diagramme, Import, Budgets nach Bedarf. |

## 14. Lizenz

Das Projekt steht unter der **GNU General Public License v3.0** (siehe [`LICENSE`](LICENSE)).
In der `package.json` wird entsprechend `"license": "GPL-3.0-or-later"` bzw. `"GPL-3.0-only"` eingetragen (die ISC-Angabe aus dem alten Projekt wird **nicht** übernommen).
