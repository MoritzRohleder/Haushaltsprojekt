# Haushalt-Spec

> Spezifikation für die Webanwendung **Haushaltsprojekt** zur Verwaltung der monatlichen Finanzen.
> Status: **Entwurf v0.2** – Grundlage für die Planung, noch keine Implementierung.
> Getroffene Entscheidungen stehen in [Kapitel 13.1](#131-entscheidungen), offene Punkte in [Kapitel 13.2](#132-offene-fragen) (im Text mit `❓` markiert).

---

## Inhaltsverzeichnis

1. [Ziel und Zweck](#1-ziel-und-zweck)
2. [Leitprinzipien](#2-leitprinzipien)
3. [Begriffe](#3-begriffe)
4. [Sichtbarkeit und Berechtigungen](#4-sichtbarkeit-und-berechtigungen)
5. [Datenmodell](#5-datenmodell)
6. [Berechnungsregeln](#6-berechnungsregeln)
7. [Funktionale Anforderungen](#7-funktionale-anforderungen)
8. [Abläufe](#8-abläufe)
9. [Seiten und Navigation](#9-seiten-und-navigation)
10. [Technologie und Architektur](#10-technologie-und-architektur)
11. [Nicht-funktionale Anforderungen](#11-nicht-funktionale-anforderungen)
12. [Abgrenzung (nicht im ersten Release)](#12-abgrenzung-nicht-im-ersten-release)
13. [Entscheidungen und offene Fragen](#13-entscheidungen-und-offene-fragen)
14. [Meilensteine](#14-meilensteine)
15. [Lizenz](#15-lizenz)
16. [Änderungshistorie](#16-änderungshistorie)

---

## 1. Ziel und Zweck

Die Anwendung soll jedem Nutzer einen **Überblick über seine Finanzen** geben und das **Erfassen neuer Einnahmen, Ausgaben und Transfers** ermöglichen. Zusätzlich sollen **Anlagen** wie Fonds oder Bausparverträge mit ihrem aktuellen Stand grob mit erfasst werden.

Kernfragen, die die Anwendung beantworten soll:

- Wie viel Geld liegt aktuell auf welchem meiner Konten?
- Was ist in einem Monat reingekommen, was ist rausgegangen – insgesamt und pro Konto?
- Wofür wurde das Geld ausgegeben (Kategorien)?
- Welches Geld wurde zwischen Konten verschoben (Transfers)?
- Wie viel steckt in meinen Anlagen, und wie groß ist mein Gesamtvermögen?

## 2. Leitprinzipien

| # | Prinzip | Bedeutung |
|---|---------|-----------|
| P1 | **Generisch statt maßgeschneidert** | Die Software kennt keine konkreten Personen, Konten oder Kategorien. Die eigene Situation wird ausschließlich über das Anlegen von Daten (Nutzer, Konten, Anlagen, Kategorien, …) abgebildet. Nichts davon ist im Code fest verdrahtet. |
| P2 | **Einfach bleiben** | Kleine, server-gerenderte Webanwendung. Kein SPA-Framework, kein Build-Schritt fürs Frontend. |
| P3 | **Nachvollziehbarkeit** | Kontostände werden immer aus den Buchungen berechnet, nicht separat gespeichert. Jede Zahl in einer Übersicht lässt sich auf einzelne Buchungen zurückführen. |
| P4 | **Korrekte Beträge** | Geldbeträge werden als ganze Zahlen in Cent gespeichert, nie als Gleitkommazahl. |
| P5 | **Daten gehören uns** | Selbst gehostet, Daten liegen lokal als JSON-Dateien, Export und Backup sind einfach. |
| P6 | **Austauschbare Datenhaltung** | Die Anwendung greift nie direkt auf Dateien zu, sondern nur über eine Speicherschicht. JSON-Dateien lassen sich später durch eine Datenbank ersetzen, ohne den Rest der Anwendung zu ändern (siehe [10.3](#103-speicherschicht)). |

## 3. Begriffe

| Begriff | Definition |
|---------|------------|
| **Nutzer** | Eine Person mit eigenem Login (Nutzername + Passwort). Nutzer registrieren sich selbst. |
| **Konto** | Ein Ort, an dem Geld liegt und gebucht wird: Girokonto, Sparkonto, Tagesgeld, Bargeld, Kreditkarte, … |
| **Kontoinhaber** | Zuordnung Konto ↔ Nutzer. Ein Konto hat **einen oder mehrere** Inhaber. Inhaber sehen das Konto vollständig. |
| **Gemeinschaftskonto** | Ein Konto mit mehreren Inhabern. Jeder Inhaber sieht es vollständig, und der **volle** Kontostand zählt zu seiner Gesamtübersicht. |
| **Buchung** | Eine einzelne Geldbewegung auf **genau einem Konto**. Arten: **Einnahme**, **Ausgabe**, **Transfer**. Eine Buchung gehört zu einem Konto, nicht zu einem Nutzer. |
| **Einnahme** | Geld kommt von außen auf ein Konto (Gehalt, Erstattung, …). |
| **Ausgabe** | Geld verlässt ein Konto nach außen (Miete, Einkauf, …). |
| **Transfer** | Geld wird zwischen zwei Konten verschoben. Ein Transfer besteht aus **zwei verknüpften Buchungen**: einem Abgang auf dem Quellkonto und einem Eingang auf dem Zielkonto. |
| **Interner / externer Transfer** | Aus Sicht eines Nutzers ist ein Transfer **intern**, wenn er beide beteiligten Konten sieht, sonst **extern** (er sieht nur eine Hälfte). Siehe [6.3](#63-transfers-in-der-monatsbilanz). |
| **Kategorie** | Frei anlegbare Einordnung von Einnahmen/Ausgaben (z. B. „Lebensmittel“, „Gehalt“). |
| **Wiederkehrende Buchung** | Eine Buchung (Einnahme, Ausgabe oder Transfer), die als „regelmäßig“ markiert ist und in einem Rhythmus (z. B. monatlich, jährlich) wiederholt wird. |
| **Anlage** | Ein Vermögenswert, der **nicht wie ein Konto** geführt wird: Fonds, Depot, Bausparvertrag, Versicherung mit Rückkaufswert, … Er hat keine Buchungen, sondern einen **manuell gepflegten Stand**. |
| **Stand (einer Anlage)** | Ein Wert zu einem Datum, manuell eingetragen (z. B. „Fonds XY: 12.340,00 € am 01.10.2026“). Die Historie der Stände bleibt erhalten. |
| **Periode / Monat** | Die Standard-Betrachtungseinheit der Übersichten ist ein Kalendermonat. |

## 4. Sichtbarkeit und Berechtigungen

Jeder Nutzer sieht nach dem Login **seine eigene Sicht**. Es gibt keine nutzerübergreifende Gesamtsicht.

| Regel | Beschreibung |
|-------|--------------|
| S-01 | Ein Nutzer sieht genau die **Konten und Anlagen, deren Inhaber er ist**. |
| S-02 | Ein Nutzer sieht genau die **Buchungen auf seinen sichtbaren Konten**. Bei einem Transfer sieht er also nur die Hälfte(n) auf seinen Konten. |
| S-03 | Von der Gegenseite eines externen Transfers sieht er nur den **Namen** des anderen Kontos (z. B. „Transfer von: Girokonto A“), aber weder dessen Saldo noch dessen andere Buchungen. |
| S-04 | Jeder Inhaber eines Kontos oder einer Anlage darf sie **bearbeiten**, Buchungen darauf **erfassen, ändern und löschen** und **weitere Inhaber hinzufügen**. |
| S-05 | Als Inhaber hinzufügen kann man jeden registrierten Nutzer (Auswahl über den Nutzernamen). |
| S-06 | Ein Inhaber kann sich selbst entfernen, solange danach noch mindestens ein Inhaber übrig bleibt. |
| S-07 | **Kategorien** sind für alle Nutzer gemeinsam (eine Liste für die ganze Installation). ❓ Q-04 |
| S-08 | Als **Ziel eines Transfers** kann ein Nutzer auch Konten wählen, die er nicht sieht. Angezeigt wird dabei nur der Kontoname und der Inhaber, kein Saldo. ❓ Q-02 |

### Beispiel

Nutzer **A** hat „Giro A“, Nutzer **B** hat „Giro B“, beide teilen sich „Gemeinsam“.
A überweist am 01.10. **500 €** von „Giro A“ auf „Gemeinsam“. Es entstehen zwei Buchungen:

| Buchung | Konto | Betrag |
|---------|-------|--------|
| Transfer-Abgang | Giro A | −500,00 € |
| Transfer-Eingang | Gemeinsam | +500,00 € |

| | Sicht von A | Sicht von B |
|---|---|---|
| Sichtbare Buchungen | beide Hälften | nur der Eingang auf „Gemeinsam“ |
| Art des Transfers | **intern** (A sieht beide Konten) | **extern** (B sieht „Giro A“ nicht) |
| Wirkung auf die Monatsbilanz | keine | **+500 €** als „Transfer-Eingang von Giro A“ |
| Gesamtvermögen | unverändert | +500 € |

## 5. Datenmodell

Das Modell ist unabhängig von der Speicherform beschrieben. Im JSON-Speicher entspricht jede Entität einer Sammlung (Datei), siehe [10.3](#103-speicherschicht).
IDs sind zufällige UUIDs (`crypto.randomUUID()`), damit sie unabhängig von der Speicherform eindeutig sind.

### 5.1 Überblick

```
                 ┌─────────┐
                 │  Nutzer │
                 └────┬────┘
           Inhaber n:m│ n:m Inhaber
          ┌───────────┴───────────┐
          ▼                       ▼
     ┌─────────┐             ┌─────────┐ 1     n ┌──────────────┐
     │  Konto  │             │ Anlage  │─────────│ Anlage-Stand │
     └────┬────┘             └─────────┘         └──────────────┘
          │ 1
          │
          ▼ n
 ┌──────────────────────────────────┐ n    0..1 ┌───────────┐
 │             Buchung              │───────────│ Kategorie │
 │ (Einnahme | Ausgabe | Transfer)  │           └───────────┘
 └───────┬──────────────────────────┘
         │  Transfer: 2 Buchungen mit gleicher transfer_id
         │
         │ n   erzeugt aus (optional)   0..1 ┌───────────────────────────┐
         └───────────────────────────────────│  Wiederkehrende Buchung   │
                                             └───────────────────────────┘
```

### 5.2 Entitäten

#### Nutzer (`users`)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | UUID | ja | |
| `username` | Text | ja | Login-Name, eindeutig, nicht case-sensitiv |
| `display_name` | Text | ja | Anzeigename |
| `password_hash` | Text | ja | Gehashtes Passwort inkl. Salt – **nie** das Klartext-Passwort (siehe [10.4](#104-login-und-sitzungen)) |
| `created_at` | Zeitstempel | ja | |

#### Konto (`accounts`)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | UUID | ja | |
| `name` | Text | ja | z. B. „Girokonto Gemeinsam“ |
| `type` | Enum | ja | `giro`, `savings`, `cash`, `credit_card`, `other` |
| `owner_ids` | Liste von UUIDs | ja | Inhaber, mindestens einer |
| `iban` | Text | nein | Nur zur Information, keine Bankanbindung |
| `opening_balance_cents` | Integer | ja | Anfangssaldo zum Stichtag (Default 0) |
| `opening_date` | Datum | ja | Ab diesem Datum wird gerechnet |
| `archived` | Boolean | ja | Geschlossene Konten bleiben in der Historie sichtbar |
| `created_at`, `updated_at` | Zeitstempel | ja | |

#### Kategorie (`categories`)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | UUID | ja | |
| `name` | Text | ja | |
| `kind` | Enum | ja | `income` oder `expense` – steuert, bei welcher Buchungsart sie angeboten wird |
| `archived` | Boolean | ja | |

#### Buchung (`transactions`)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | UUID | ja | |
| `account_id` | UUID → accounts | ja | Das Konto, zu dem die Buchung gehört |
| `type` | Enum | ja | `income`, `expense`, `transfer` |
| `date` | Datum | ja | Buchungsdatum |
| `amount_cents` | Integer | ja | **Mit Vorzeichen** aus Sicht des Kontos: `+` = Geld kommt rein, `−` = Geld geht raus. Einnahme immer `> 0`, Ausgabe immer `< 0`, Transfer je nach Richtung |
| `transfer_id` | UUID | nur Transfer | Verknüpft die beiden Hälften eines Transfers (beide haben dieselbe `transfer_id`) |
| `counter_account_id` | UUID → accounts | nur Transfer | Das jeweils andere Konto des Transfers |
| `category_id` | UUID → categories | nein | Nicht bei Transfers |
| `description` | Text | ja | Kurzer Text, z. B. „Wocheneinkauf“ |
| `note` | Text | nein | Freitext |
| `recurring_id` | UUID → recurring | nein | Gesetzt, wenn aus einer wiederkehrenden Buchung erzeugt |
| `created_by` | UUID → users | ja | Nur zur Information, wer die Buchung erfasst hat. Bestimmt **nicht**, wem sie gehört |
| `created_at`, `updated_at` | Zeitstempel | ja | |

Regeln für Transfers:

- Ein Transfer wird immer **als Paar angelegt, geändert und gelöscht**. Es gibt nie nur eine Hälfte.
- Beide Hälften haben dasselbe Datum, denselben Betrag mit umgekehrtem Vorzeichen und dieselbe Beschreibung.
- Quellkonto ≠ Zielkonto.
- Ändern oder löschen darf ein Transfer jeder, der **mindestens eines** der beiden Konten sieht. ❓ Q-03

#### Wiederkehrende Buchung (`recurring`)

Entsteht, wenn beim Erfassen einer Buchung „regelmäßig“ angehakt wird. Sie ist die Vorlage für die künftigen Buchungen.

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | UUID | ja | |
| `type` | Enum | ja | `income`, `expense`, `transfer` |
| `account_id` | UUID | ja | Konto (bei Transfer: Quellkonto) |
| `to_account_id` | UUID | nur Transfer | Zielkonto |
| `amount_cents` | Integer | ja | Betrag (positiv, Richtung ergibt sich aus `type`) |
| `category_id`, `description`, `note` | | | wie bei der Buchung |
| `interval` | Enum | ja | `weekly`, `monthly`, `quarterly`, `half_yearly`, `yearly` |
| `start_date` | Datum | ja | Erste Ausführung. Bestimmt auch den Tag im Rhythmus (z. B. „jeden 15.“) |
| `end_date` | Datum | nein | Letzte mögliche Ausführung |
| `active` | Boolean | ja | Pausieren ohne Löschen |
| `last_generated_date` | Datum | nein | Bis wohin bereits Buchungen erzeugt wurden |
| `created_by` | UUID → users | ja | |

Fällt der Tag auf einen Tag, den der Monat nicht hat (z. B. 31.), wird der letzte Tag des Monats verwendet.

#### Anlage (`assets`)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | UUID | ja | |
| `name` | Text | ja | z. B. „ETF-Sparplan“, „Bausparvertrag Wohnung“ |
| `type` | Enum | ja | `fund`, `depot`, `building_savings`, `insurance`, `other` |
| `owner_ids` | Liste von UUIDs | ja | Inhaber, mindestens einer – gleiche Sichtbarkeitsregeln wie bei Konten |
| `provider` | Text | nein | z. B. Name der Bausparkasse |
| `note` | Text | nein | Freitext, z. B. Vertragsnummer, Zielsumme |
| `archived` | Boolean | ja | |
| `created_at`, `updated_at` | Zeitstempel | ja | |

#### Anlage-Stand (`asset_values`)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | UUID | ja | |
| `asset_id` | UUID → assets | ja | |
| `date` | Datum | ja | Stichtag des Standes |
| `value_cents` | Integer | ja | Wert zum Stichtag |
| `note` | Text | nein | z. B. „laut Jahreskontoauszug“ |
| `created_by` | UUID → users | ja | |

Der **aktuelle Stand** einer Anlage ist der Eintrag mit dem jüngsten Datum.

## 6. Berechnungsregeln

Alle Berechnungen beziehen sich auf die **Sicht des angemeldeten Nutzers**, also nur auf seine sichtbaren Konten und Anlagen.

### 6.1 Kontostand

```
Kontostand(K, Stichtag) = Anfangssaldo(K) + Σ amount_cents aller Buchungen auf K mit Datum ≤ Stichtag
```

Weil Beträge ein Vorzeichen haben, gilt diese eine Formel für Einnahmen, Ausgaben und beide Transfer-Hälften.
Buchungen vor dem `opening_date` eines Kontos sind nicht erlaubt.

### 6.2 Gesamtübersicht eines Nutzers

```
Summe Konten   = Σ Kontostand aller sichtbaren, nicht archivierten Konten   (Gemeinschaftskonten mit vollem Betrag)
Summe Anlagen  = Σ aktueller Stand aller sichtbaren, nicht archivierten Anlagen
Gesamtvermögen = Summe Konten + Summe Anlagen
```

Hinweis: Weil Gemeinschaftskonten bei jedem Inhaber voll zählen, ergibt die Summe der Gesamtvermögen mehrerer Nutzer **nicht** das Haushaltsvermögen. Das ist so gewollt.

### 6.3 Transfers in der Monatsbilanz

Für jede sichtbare Transfer-Hälfte wird geprüft, ob der Nutzer auch das Gegenkonto sieht:

| Fall | Einordnung | In der Monatsbilanz |
|------|------------|---------------------|
| Gegenkonto ist sichtbar | **interner Transfer** | Zählt nicht. Wird nur in der Transfer-Liste angezeigt. |
| Gegenkonto ist nicht sichtbar, Betrag > 0 | **externer Transfer-Eingang** | Zählt als Zufluss, eigene Zeile „Transfer-Eingänge“. |
| Gegenkonto ist nicht sichtbar, Betrag < 0 | **externer Transfer-Ausgang** | Zählt als Abfluss, eigene Zeile „Transfer-Ausgänge“. |

❓ Q-01: Bestätigen, dass externe Transfers im Saldo mitzählen (sie sind ja „echtes“ Geld, das aus Sicht des Nutzers rein- oder rausgeht), aber getrennt von Einnahmen/Ausgaben ausgewiesen werden.

### 6.4 Monatsbilanz

Für den gewählten Monat und die sichtbaren Konten:

```
Einnahmen          = Σ Buchungen vom Typ income
Ausgaben           = Σ Buchungen vom Typ expense                (negativ)
Transfer-Eingänge  = Σ externe Transfer-Hälften mit Betrag > 0
Transfer-Ausgänge  = Σ externe Transfer-Hälften mit Betrag < 0  (negativ)
Saldo des Monats   = Einnahmen + Ausgaben + Transfer-Eingänge + Transfer-Ausgänge
```

Der Saldo des Monats entspricht damit genau der Veränderung der Summe aller sichtbaren Kontostände in diesem Monat. Das ist eine gute Kontrollrechnung für Tests.

Anlagen gehen nicht in die Monatsbilanz ein, nur in die Gesamtübersicht.

### 6.5 Beträge und Formate

- Speicherung in Cent (`Integer`), Anzeige als `1.234,56 €`.
- Eingabe akzeptiert `1234,56`, `1.234,56` und `1234.56`. Im Formular wird der Betrag immer **positiv** eingegeben, das Vorzeichen ergibt sich aus der Buchungsart.
- Währung fest **EUR** (eine Währung pro Installation).
- Datumsanzeige `TT.MM.JJJJ`, intern ISO `JJJJ-MM-TT`.

## 7. Funktionale Anforderungen

Priorität: **M** = Muss (MVP), **S** = Soll (kurz nach MVP), **K** = Kann (später).

### 7.1 Konto und Login

| ID | Anforderung | Prio |
|----|-------------|------|
| F-01 | Registrieren mit Nutzername, Anzeigename und Passwort (mit Wiederholung) | M |
| F-02 | Anmelden mit Nutzername und Passwort; Abmelden | M |
| F-03 | Alle Seiten außer Login/Registrierung nur angemeldet erreichbar | M |
| F-04 | Eigenes Passwort und Anzeigenamen ändern | S |
| F-05 | Registrierung per Konfiguration abschaltbar (z. B. nachdem alle Haushaltsmitglieder angelegt sind) | S |

### 7.2 Stammdaten

| ID | Anforderung | Prio |
|----|-------------|------|
| F-10 | Konten anlegen, bearbeiten, archivieren (Name, Typ, Anfangssaldo, Stichtag) | M |
| F-11 | Inhaber eines Kontos verwalten: weitere registrierte Nutzer hinzufügen, sich selbst entfernen (S-04 bis S-06) | M |
| F-12 | Kategorien für Einnahmen und Ausgaben anlegen, bearbeiten, archivieren | M |
| F-13 | Löschen nur, wenn nichts mehr daran hängt (keine Buchungen/Stände) – sonst nur Archivieren | M |

### 7.3 Buchungen

| ID | Anforderung | Prio |
|----|-------------|------|
| F-20 | Einnahme erfassen (Datum, Betrag, Konto, Kategorie, Beschreibung, Notiz) | M |
| F-21 | Ausgabe erfassen (analog) | M |
| F-22 | Transfer erfassen (Datum, Betrag, Von-Konto, Nach-Konto, Beschreibung) – erzeugt beide Hälften | M |
| F-23 | Buchung bearbeiten und löschen (mit Bestätigung); bei Transfers immer beide Hälften | M |
| F-24 | Buchungsliste mit Filtern: Monat/Zeitraum, Konto, Kategorie, Art, Freitextsuche | M |
| F-25 | Schnelleingabe: Datum mit heute vorbelegt, zuletzt verwendetes Konto vorausgewählt; „Speichern & weitere erfassen“ | S |
| F-26 | Buchung duplizieren („nochmal buchen“) | K |

### 7.4 Wiederkehrende Buchungen

| ID | Anforderung | Prio |
|----|-------------|------|
| F-30 | Beim Erfassen einer Einnahme, Ausgabe oder eines Transfers die Option **„regelmäßig“** mit Rhythmus (wöchentlich, monatlich, vierteljährlich, halbjährlich, jährlich) und optionalem Enddatum | S |
| F-31 | Übersicht aller wiederkehrenden Buchungen des Nutzers (auf seinen Konten); bearbeiten, pausieren, beenden | S |
| F-32 | Fällige Buchungen werden erzeugt, sobald ihr Datum erreicht ist ❓ Q-05 (automatisch oder nach Bestätigung) | S |
| F-33 | Eine aus einer Vorlage erzeugte Buchung kann einzeln geändert werden, ohne die Vorlage zu ändern | S |

### 7.5 Anlagen

| ID | Anforderung | Prio |
|----|-------------|------|
| F-40 | Anlagen anlegen, bearbeiten, archivieren (Name, Typ, Anbieter, Inhaber, Notiz) | S |
| F-41 | Neuen **Stand** erfassen (Datum, Wert, Notiz) – schnell erreichbar direkt aus der Übersicht | S |
| F-42 | Historie der Stände einer Anlage anzeigen (Tabelle; Veränderung zum vorherigen Stand) | S |
| F-43 | Hinweis, wenn der letzte Stand einer Anlage älter als X Monate ist (X konfigurierbar) | K |
| F-44 | Verlauf als Diagramm | K |

### 7.6 Übersichten

| ID | Anforderung | Prio |
|----|-------------|------|
| F-50 | **Dashboard**: Kontostände aller sichtbaren Konten, Summe Konten, Anlagen mit aktuellem Stand, Gesamtvermögen | M |
| F-51 | **Monatsübersicht**: Einnahmen, Ausgaben, externe Transfers, Saldo des Monats (6.4); Blättern zwischen Monaten | M |
| F-52 | Monatsübersicht aufgeschlüsselt nach Kategorie | M |
| F-53 | Monatsübersicht aufgeschlüsselt nach Konto | M |
| F-54 | **Transfers des Monats** als eigene Liste: intern (Von → Nach) und extern (mit Name des Gegenkontos) | M |
| F-55 | **Kontodetail**: Buchungen eines Kontos mit laufendem Saldo | M |
| F-56 | Vergleich über mehrere Monate (Tabelle: Monat × Einnahmen/Ausgaben/Saldo) | S |
| F-57 | Diagramme (Ausgaben nach Kategorie, Verlauf Gesamtvermögen) | K |

### 7.7 Daten

| ID | Anforderung | Prio |
|----|-------------|------|
| F-60 | Export der eigenen Buchungen als CSV | S |
| F-61 | Backup: Der Datenordner kann einfach kopiert werden; automatische Sicherungskopie vor jedem Schreiben | M |
| F-62 | CSV-Import von Kontoauszügen | K |

## 8. Abläufe

### 8.1 Registrierung und erste Schritte

1. Nicht angemeldet → Login-Seite mit Link „Registrieren“.
2. Registrieren: Nutzername, Anzeigename, Passwort, Passwort wiederholen.
3. Nach der Registrierung ist der Nutzer angemeldet. Hat er noch keine Konten, zeigt das Dashboard einen Hinweis „Lege dein erstes Konto an“.
4. Konto anlegen: Name, Typ, Anfangssaldo und Stichtag (z. B. Kontostand laut Bank am 01. des Monats), optional weitere Inhaber.
5. Kategorien anlegen (bzw. vorhandene nutzen, falls schon ein anderer Nutzer welche angelegt hat).

### 8.2 Einnahme / Ausgabe erfassen

1. „+ Ausgabe“ bzw. „+ Einnahme“ – global in der Navigation erreichbar.
2. Formular: Datum (heute), Betrag, Konto (nur sichtbare), Kategorie (nur passende Art), Beschreibung, Notiz, ☐ regelmäßig (→ Rhythmus, Enddatum).
3. Serverseitige Prüfung: Betrag > 0, Konto existiert, ist für den Nutzer sichtbar und nicht archiviert, Datum ≥ Stichtag des Kontos.
4. Speichern → Rückkehr zur vorherigen Seite mit Erfolgsmeldung.

### 8.3 Transfer erfassen

1. „⇄ Transfer“.
2. Formular: Datum, Betrag, Von-Konto (nur eigene), Nach-Konto (eigene Konten oben, darunter Konten anderer Nutzer nur mit Name und Inhaber – S-08), Beschreibung, ☐ regelmäßig.
3. Prüfung: Von ≠ Nach, Betrag > 0, beide Konten nicht archiviert.
4. Speichern erzeugt **zwei Buchungen** mit gemeinsamer `transfer_id`.
5. Ergebnis: Jeder Nutzer sieht die Hälfte(n) auf seinen Konten (siehe Beispiel in [Kapitel 4](#beispiel)).

### 8.4 Wiederkehrende Buchungen ausführen

1. Beim Aufruf einer Seite (bzw. einmal täglich) prüft die Anwendung alle aktiven Vorlagen.
2. Für jedes fällige Datum seit `last_generated_date` bis heute wird eine Buchung erzeugt (bei Transfers ein Paar). Waren die Nutzer länger nicht in der App, werden verpasste Termine nachgeholt.
3. Erzeugte Buchungen sind als „regelmäßig“ gekennzeichnet und können einzeln angepasst werden (z. B. abweichender Betrag).
4. ❓ Q-05: Alternativ werden fällige Buchungen nicht automatisch gebucht, sondern als Vorschlag zur Bestätigung angezeigt.

### 8.5 Stand einer Anlage aktualisieren

1. Im Dashboard oder in der Anlagenliste bei der Anlage auf „Stand aktualisieren“.
2. Formular: Datum (heute), Wert, Notiz.
3. Speichern → Der neue Stand fließt sofort in Gesamtvermögen und Dashboard ein; der alte Stand bleibt in der Historie.

## 9. Seiten und Navigation

| Seite | Route (Vorschlag) | Inhalt |
|-------|-------------------|--------|
| Login | `GET/POST /login` | |
| Registrieren | `GET/POST /registrieren` | |
| Abmelden | `POST /logout` | |
| Dashboard | `GET /` | Kontostände, Anlagen, Gesamtvermögen, Kurzbilanz aktueller Monat, letzte Buchungen |
| Monatsübersicht | `GET /monat/:jahr/:monat` | Bilanz, nach Kategorie, nach Konto, Transfers |
| Buchungen | `GET /buchungen` | Gefilterte Liste (Query-Parameter für Filter) |
| Neue Buchung | `GET/POST /buchungen/neu?typ=einnahme\|ausgabe\|transfer` | |
| Buchung bearbeiten | `GET/POST /buchungen/:id/bearbeiten` | |
| Buchung löschen | `POST /buchungen/:id/loeschen` | |
| Konten | `GET /konten` | Sichtbare Konten mit Saldo und Inhabern |
| Konto anlegen/bearbeiten | `GET/POST /konten/neu`, `/konten/:id/bearbeiten` | inkl. Inhaber |
| Kontodetail | `GET /konten/:id` | Buchungen mit laufendem Saldo |
| Anlagen | `GET /anlagen` | Sichtbare Anlagen mit aktuellem Stand |
| Anlagedetail | `GET /anlagen/:id` | Historie der Stände |
| Stand erfassen | `GET/POST /anlagen/:id/stand` | |
| Wiederkehrend | `GET /wiederkehrend` | Vorlagen verwalten |
| Kategorien | `GET /kategorien` | |
| Profil | `GET/POST /profil` | Anzeigename, Passwort |

Da HTML-Formulare nur `GET` und `POST` kennen, werden Änderungen und Löschungen über `POST` umgesetzt (Muster *Post/Redirect/Get*).
Ruft ein Nutzer ein Konto, eine Anlage oder eine Buchung auf, die er nicht sehen darf, antwortet der Server mit **404** (nicht 403), damit nicht erkennbar ist, ob es den Datensatz gibt.

## 10. Technologie und Architektur

Aufbauend auf dem Stack aus dem früheren Projekt (`WebTechExam`): **Node.js + Express + EJS**, jeweils in der aktuellen Version.

### 10.1 Komponenten

| Baustein | Wahl | Zweck |
|----------|------|-------|
| Laufzeit | **Node.js**, aktuelle LTS-Version | Führt JavaScript auf dem Server aus |
| Web-Framework | **Express 5** (aktuelle Version) | Routing (URL → Funktion), Middleware, Formular-Verarbeitung |
| Template-Engine | **EJS** (aktuelle Version) | HTML-Seiten auf dem Server mit Daten befüllen (`<%= … %>`), Seitenteile per `include()` |
| Sitzungen | **express-session** | Merkt sich nach dem Login, wer angemeldet ist (Cookie) |
| Passwort-Hashing | **`crypto.scrypt`** aus Node.js | Sicheres Hashen ohne zusätzliches Paket |
| Datenhaltung | **JSON-Dateien** hinter einer Speicherschicht | Siehe 10.3 |
| CSS | Eigenes, schlankes CSS oder klassenloses Framework (Pico.css) ❓ Q-09 | Responsive Oberfläche ohne Build-Schritt |
| Client-JS | Nur wo nötig, Vanilla JS (z. B. Rhythmus-Felder ein-/ausblenden) | |
| Entwicklung | `node --watch` (in Node eingebaut) | Server bei Codeänderungen neu starten |
| Tests | `node:test` (in Node eingebaut) | Tests für Berechnungsregeln und Speicherschicht |

Zum alten Lockfile: Fast alle Einträge darin (`body-parser`, `accepts`, `send`, `qs`, …) sind **Unterpakete von Express**, `jake`, `chalk` usw. gehören zu EJS. Direkt genutzt wurden nur `express` und `ejs`. Die Versionen von 2022 werden nicht übernommen, sondern frisch in aktueller Version installiert.

### 10.2 Schichten

```
 Browser
    │  HTTP (Formulare, Links)
    ▼
 routes/        ← Express-Router: Eingaben lesen, prüfen, Service aufrufen, View rendern
    │
    ▼
 services/      ← Fachlogik: Salden, Monatsbilanz, Transfer-Paare, Sichtbarkeit, wiederkehrende Buchungen
    │
    ▼
 repositories/  ← Ein Repository pro Entität (users, accounts, transactions, …) mit festen Methoden
    │
    ▼
 storage/       ← Austauschbarer Adapter: heute JSON-Dateien, später z. B. SQLite
```

Regel: Nur `storage/` weiß, wie und wo Daten gespeichert sind. Routes und Services kennen nur die Repositories.

### 10.3 Speicherschicht

**Schnittstelle** (jede Methode gibt ein Promise zurück, damit später auch eine Datenbank passt):

| Methode | Zweck |
|---------|-------|
| `findAll(collection, filter?)` | Alle Datensätze, optional gefiltert |
| `findById(collection, id)` | Ein Datensatz oder `null` |
| `insert(collection, record)` | Anlegen (ID und Zeitstempel werden gesetzt) |
| `update(collection, id, changes)` | Ändern |
| `remove(collection, id)` | Löschen |
| `transaction(fn)` | Mehrere Änderungen gemeinsam oder gar nicht ausführen (z. B. beide Hälften eines Transfers) |

**JSON-Adapter (erste Umsetzung):**

- Ordner `data/` (Pfad konfigurierbar), eine Datei pro Sammlung: `users.json`, `accounts.json`, `categories.json`, `transactions.json`, `recurring.json`, `assets.json`, `asset_values.json`.
- Zusätzlich `meta.json` mit `schema_version` für spätere Umbauten am Datenformat (Migrationen).
- Beim Start werden alle Dateien in den Arbeitsspeicher geladen; gelesen wird aus dem Speicher.
- Schreibzugriffe laufen **nacheinander** (Warteschlange), damit sich zwei gleichzeitige Anfragen nicht gegenseitig überschreiben.
- Geschrieben wird **atomar**: erst in eine temporäre Datei, dann umbenennen. So ist eine Datei bei einem Absturz nie halb geschrieben.
- Vor dem Überschreiben wird die alte Version als Sicherung behalten (z. B. `data/backup/…`, die letzten N Stände).
- Der Ordner `data/` steht in `.gitignore`.

**Späterer Austausch:** Ein SQLite-Adapter würde dieselbe Schnittstelle umsetzen. Ein kleines Skript kopiert die JSON-Daten einmalig in die Datenbank.

### 10.4 Login und Sitzungen

- Passwörter werden mit `crypto.scrypt` und einem zufälligen Salt pro Nutzer gehasht und mit `crypto.timingSafeEqual` verglichen.
- Passwort-Mindestlänge: 8 Zeichen.
- Nach erfolgreichem Login wird die Session-ID erneuert (`req.session.regenerate`).
- Session-Cookie: `httpOnly`, `sameSite: 'lax'`, `secure` sobald HTTPS verwendet wird.
- Sitzungen werden in einer Datei gespeichert, damit man nach einem Neustart des Servers nicht abgemeldet ist. Ob dafür ein fertiges Paket oder ein kleiner eigener Store über die Speicherschicht genutzt wird, wird in M1 entschieden.
- Formulare erhalten ein CSRF-Token (S).
- Fehlgeschlagene Logins werden gebremst (z. B. kurze Wartezeit nach mehreren Fehlversuchen) (S).
- Fehlermeldung beim Login immer neutral: „Nutzername oder Passwort falsch“.

### 10.5 Projektstruktur (Vorschlag)

```
Haushaltsprojekt/
├── package.json
├── Haushalt-Spec.md          ← dieses Dokument
├── src/
│   ├── app.js                ← Express-Setup, Middleware, Start
│   ├── config.js             ← Umgebungsvariablen
│   ├── storage/
│   │   ├── index.js          ← wählt den Adapter
│   │   └── json/             ← JSON-Adapter
│   ├── repositories/         ← users, accounts, transactions, recurring, assets, …
│   ├── services/             ← balances, monthly, transfers, visibility, recurring, auth
│   ├── routes/               ← Express-Router je Bereich
│   ├── middleware/           ← requireLogin, csrf, Fehlerbehandlung
│   └── utils/                ← Geld- und Datumsformat, Validierung
├── views/
│   ├── partials/             ← header.ejs, nav.ejs, footer.ejs
│   ├── auth/
│   ├── dashboard.ejs
│   ├── month.ejs
│   ├── transactions/
│   ├── accounts/
│   ├── assets/
│   └── recurring/
├── public/
│   ├── css/
│   └── js/
├── data/                     ← JSON-Daten (nicht im Git!)
└── test/
```

### 10.6 Konfiguration

Über Umgebungsvariablen (bzw. `.env`, nicht eingecheckt):

| Variable | Default | Bedeutung |
|----------|---------|-----------|
| `PORT` | `3000` | HTTP-Port |
| `DATA_DIR` | `./data` | Ordner der JSON-Dateien |
| `STORAGE` | `json` | Gewählter Speicher-Adapter |
| `SESSION_SECRET` | – | Pflicht; Schlüssel zum Signieren des Session-Cookies |
| `REGISTRATION_OPEN` | `true` | Registrierung erlaubt (F-05) |

## 11. Nicht-funktionale Anforderungen

| ID | Anforderung |
|----|-------------|
| N-01 | **Sprache** der Oberfläche: Deutsch. |
| N-02 | **Responsive**: auf dem Smartphone nutzbar, vor allem das Erfassen von Buchungen und Anlage-Ständen. |
| N-03 | **Sicherheit**: Ausgaben in EJS escaped (`<%= %>`, nie `<%- %>` für Nutzereingaben); serverseitige Validierung aller Formulare; Sichtbarkeit (Kapitel 4) wird bei **jedem** Zugriff im Server geprüft, nicht nur in der Oberfläche. |
| N-04 | **Datenkonsistenz**: Transfer-Paare und andere zusammengehörige Änderungen nur über `transaction()` der Speicherschicht; Verweise (z. B. `account_id`) werden vor dem Speichern geprüft. |
| N-05 | **Betrieb**: Start mit `npm start`; läuft lokal oder auf einem kleinen Server im Heimnetz (z. B. Raspberry Pi / NAS). Bei Erreichbarkeit aus dem Internet nur über HTTPS (z. B. per Reverse Proxy). |
| N-06 | **Datensicherung**: Der Ordner `data/` ist das Einzige, was gesichert werden muss. |
| N-07 | **Performance**: Für Haushaltsgröße (einige tausend Buchungen pro Jahr) ausgelegt; Seitenaufbau < 500 ms. Dafür reicht es, alle Daten im Arbeitsspeicher zu halten. |
| N-08 | **Testbarkeit**: Berechnungsregeln (Kapitel 6), Sichtbarkeitsregeln (Kapitel 4) und der JSON-Adapter sind durch automatisierte Tests abgedeckt. |

## 12. Abgrenzung (nicht im ersten Release)

- Keine direkte Bankanbindung (FinTS/HBCI, PSD2-APIs), keine automatischen Kurse für Fonds.
- Keine Budgets/Sparziele (Kandidat für später).
- Keine Mehrwährungsfähigkeit.
- Keine Aufteilung einer Buchung auf mehrere Kategorien (Split-Buchungen).
- Keine nutzerübergreifende Haushalts-Gesamtsicht.
- Keine Rollen (Admin o. ä.) – alle Nutzer sind gleichberechtigt.
- Kein „Passwort vergessen“ per E-Mail.
- Keine mobile App – nur Webseite.

## 13. Entscheidungen und offene Fragen

### 13.1 Entscheidungen

| # | Thema | Entscheidung |
|---|-------|--------------|
| E-01 | Zugehörigkeit von Buchungen | Eine Buchung gehört zu genau einem Konto, nicht zu einem Nutzer. |
| E-02 | Transfers | Ein Transfer besteht aus zwei verknüpften Buchungen, eine pro Konto. |
| E-03 | Transfers in der Bilanz | Transfers zwischen Konten, die der Nutzer beide sieht, zählen nicht zur Monatsbilanz. Sieht er nur eine Seite, sieht er nur diese Hälfte (z. B. nur den Eingang). |
| E-04 | Datenhaltung | Lokal als JSON-Dateien, keine Datenbank. Zugriff nur über eine austauschbare Speicherschicht. |
| E-05 | Versionen | Jeweils die aktuellen Versionen von Node.js (LTS), Express und EJS. |
| E-06 | Login | Einfacher Login mit Nutzername und Passwort; Nutzer registrieren sich selbst. |
| E-07 | Gemeinschaftskonten | Alle Inhaber sehen das Konto vollständig; der volle Kontostand zählt zur Gesamtübersicht jedes Inhabers. |
| E-08 | Wiederkehrende Buchungen | Beim Anlegen einer Buchung als „regelmäßig“ markierbar, mit Rhythmus (wöchentlich bis jährlich). |
| E-09 | Anlagen | Fonds, Bausparverträge usw. werden als Anlagen ohne Buchungen geführt; ihr Stand wird manuell aktualisiert. |
| E-10 | Lizenz | GNU GPL v3. |

### 13.2 Offene Fragen

| # | Frage | Vorschlag |
|---|-------|-----------|
| Q-01 | Zählen **externe** Transfers (Nutzer sieht nur eine Hälfte) im Saldo der Monatsbilanz mit? | Ja, aber in eigenen Zeilen „Transfer-Eingänge/-Ausgänge“, getrennt von Einnahmen und Ausgaben (6.3). |
| Q-02 | Darf ein Nutzer als **Transfer-Ziel** ein Konto wählen, das er nicht sieht (z. B. Privatkonto des Partners)? | Ja, nur mit Name und Inhaber, ohne Saldo (S-08). Sonst müsste man so etwas als Ausgabe buchen und der Partner sähe den Eingang nicht. |
| Q-03 | Wer darf einen Transfer ändern/löschen, der zwischen „meinem“ und einem fremden Konto läuft? | Jeder, der eine der beiden Seiten sieht – sonst kann man eigene Fehleingaben nicht korrigieren. |
| Q-04 | **Kategorien** gemeinsam für alle Nutzer oder je Nutzer eigene? | Gemeinsam – einfacher, und im Haushalt meist ohnehin gleich. |
| Q-05 | Wiederkehrende Buchungen **automatisch** buchen oder als **Vorschlag** zur Bestätigung anzeigen? | Automatisch buchen (8.4), da einfacher in der Bedienung; Abweichungen werden nachträglich an der einzelnen Buchung korrigiert. |
| Q-06 | **Einzahlungen in Anlagen** (z. B. monatliche Sparrate vom Girokonto in den Bausparvertrag): wie buchen? | Im MVP als Ausgabe mit Kategorie „Sparen/Anlagen“; der Anlagenstand wird weiterhin manuell gepflegt. Später möglich: Anlage als Transfer-Ziel, das nicht in der Bilanz zählt. |
| Q-07 | **Kreditkarten**: als eigenes Konto mit negativem Saldo und Monatsausgleich per Transfer? | Ja – passt ohne Sonderlogik ins Modell. |
| Q-08 | **Bargeld**: als eigenes Konto führen? | Ja, Kontotyp `cash`. |
| Q-09 | **Styling**: eigenes CSS oder klassenloses Framework (Pico.css)? | Pico.css – sieht ohne Aufwand ordentlich aus, kein Build-Schritt. |
| Q-10 | **Registrierung**: dauerhaft offen lassen? | Offen für die Einrichtung, danach per `REGISTRATION_OPEN=false` schließen – besonders, wenn die Seite aus dem Internet erreichbar ist. |

## 14. Meilensteine

| # | Meilenstein | Inhalt |
|---|-------------|--------|
| M0 | **Spezifikation** | Dieses Dokument abstimmen, offene Fragen klären. |
| M1 | **Grundgerüst** | `package.json`, Express + EJS, Layout/Navigation, Konfiguration, Speicherschicht mit JSON-Adapter inkl. Tests, `npm start`. |
| M2 | **Login** | F-01 bis F-03: Registrieren, Anmelden, Abmelden, Seitenschutz. |
| M3 | **Stammdaten** | F-10 bis F-13: Konten mit Inhabern, Kategorien. Sichtbarkeitsregeln inkl. Tests. |
| M4 | **Buchungen** | F-20 bis F-24: Einnahmen, Ausgaben, Transfer-Paare erfassen, bearbeiten, listen. |
| M5 | **Übersichten** | F-50 bis F-55, F-61: Dashboard, Monatsbilanz, Kontodetail, Transfers. Tests der Berechnungsregeln. → **MVP fertig** |
| M6 | **Wiederkehrend & Anlagen** | F-30 bis F-33, F-40 bis F-42. |
| M7 | **Komfort & Sicherheit** | F-04, F-05, F-25, F-56, F-60, CSRF-Schutz, Login-Bremse. |
| M8 | **Ausbau** | Diagramme, Import, Budgets nach Bedarf. |

## 15. Lizenz

Das Projekt steht unter der **GNU General Public License v3.0** (siehe [`LICENSE`](LICENSE)).
In der `package.json` wird entsprechend `"license": "GPL-3.0-or-later"` eingetragen. Die ISC-Angabe aus dem alten Projekt wird **nicht** übernommen.

## 16. Änderungshistorie

| Version | Änderungen |
|---------|------------|
| v0.1 | Erster Entwurf. |
| v0.2 | Buchungen gehören zu Konten, nicht zu Nutzern; Transfer = zwei verknüpfte Buchungen; Sichtbarkeit pro Nutzer und interne/externe Transfers (Kap. 4, 6.3); Login mit Registrierung; JSON-Speicher hinter austauschbarer Speicherschicht; Express 5; Gemeinschaftskonten zählen voll; „regelmäßig“-Option mit Rhythmus beim Erfassen; neue Entität **Anlagen** mit manuell gepflegtem Stand; offene Fragen aktualisiert. |
