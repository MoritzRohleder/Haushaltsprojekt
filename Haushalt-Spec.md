# Haushalt-Spec

> Spezifikation für die Webanwendung **Haushaltsprojekt** zur Verwaltung der monatlichen Finanzen.
> Status: **v1.3** der Spezifikation – umgesetzt in Version 0.1.0 der Anwendung (noch nicht veröffentlicht; inkl. Betrieb mit Docker, eingebautem Handbuch, Geschäft/Kassenzettel/Artikel bei Ausgaben, Übersicht der regelmäßigen Buchungen).
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

Die Anwendung soll jedem Nutzer einen **Überblick über seine Finanzen** geben und das **Erfassen neuer Einnahmen, Ausgaben und Transfers** ermöglichen. Zusätzlich sollen **Anlagen** wie Fonds oder Bausparverträge mit ihrem aktuellen Stand erfasst werden, inklusive regelmäßiger Sparraten.

Kernfragen, die die Anwendung beantworten soll:

- Wie viel Geld liegt aktuell auf welchem meiner Konten?
- Was ist in einem Monat reingekommen, was ist rausgegangen – insgesamt und pro Konto?
- Wofür wurde das Geld ausgegeben (Kategorien)?
- Welches Geld wurde zwischen meinen Konten und Anlagen verschoben (Transfers)?
- Wie viel steckt in meinen Anlagen, und wie groß ist mein Gesamtvermögen?

## 2. Leitprinzipien

| # | Prinzip | Bedeutung |
|---|---------|-----------|
| P1 | **Generisch statt maßgeschneidert** | Die Software kennt keine konkreten Personen, Konten oder Kategorien. Die eigene Situation wird ausschließlich über das Anlegen von Daten (Nutzer, Konten, Anlagen, Kategorien, …) abgebildet. Die Standard-Kategorien werden beim ersten Start einmalig als Startdaten erzeugt und danach nur noch in der JSON-Datei gepflegt. |
| P2 | **Einfach bleiben** | Kleine, server-gerenderte Webanwendung. Kein SPA-Framework, kein Build-Schritt fürs Frontend. |
| P3 | **Nachvollziehbarkeit** | Kontostände und Anlagenwerte werden aus den gespeicherten Daten berechnet, nicht separat gespeichert. Jede Zahl in einer Übersicht lässt sich auf einzelne Buchungen bzw. Stände zurückführen. |
| P4 | **Korrekte Beträge** | Geldbeträge werden intern als ganze Zahlen in Cent gespeichert und berechnet, nie als Gleitkommazahl. **Angezeigt und eingegeben** werden sie immer in Euro (`1.234,56 €`). |
| P5 | **Daten gehören uns** | Selbst gehostet, Daten liegen lokal als JSON-Dateien, Export und Backup sind einfach. |
| P6 | **Austauschbare Datenhaltung** | Die Anwendung greift nie direkt auf Dateien zu, sondern nur über eine Speicherschicht. JSON-Dateien lassen sich später durch eine Datenbank ersetzen, ohne den Rest der Anwendung zu ändern (siehe [10.3](#103-speicherschicht)). |

## 3. Begriffe

| Begriff | Definition |
|---------|------------|
| **Nutzer** | Eine Person mit eigenem Login (Nutzername + Passwort). Nutzer registrieren sich selbst. |
| **Konto** | Ein Ort, an dem Geld liegt und gebucht wird: Girokonto, Sparkonto, Tagesgeld, Bargeld, Prepaid-Karte, … |
| **Kontoinhaber** | Zuordnung Konto ↔ Nutzer. Ein Konto hat **einen oder mehrere** Inhaber. Inhaber sehen das Konto vollständig und dürfen alles daran ändern. |
| **Gemeinschaftskonto** | Ein Konto mit mehreren Inhabern. Jeder Inhaber sieht es vollständig, und der **volle** Kontostand zählt zu seiner Gesamtübersicht. |
| **Buchung** | Eine einzelne Geldbewegung auf **genau einem Konto**. Arten: **Einnahme**, **Ausgabe**, **Transfer**. Eine Buchung gehört zu einem Konto, nicht zu einem Nutzer. |
| **Einnahme** | Geld kommt von außen auf ein Konto (Gehalt, Erstattung, …). |
| **Ausgabe** | Geld verlässt ein Konto nach außen (Miete, Einkauf, Überweisung an das Privatkonto des Partners, …). |
| **Transfer** | Geld wird zwischen **zwei Konten oder einem Konto und einer Anlage** verschoben, die der erfassende Nutzer **beide sieht**. Zwischen zwei Konten besteht ein Transfer aus **zwei verknüpften Buchungen** (eine pro Konto). |
| **Einzahlung / Auszahlung (Anlage)** | Ein Transfer zwischen einem Konto und einer Anlage, z. B. die monatliche Sparrate in einen Fonds. Auf dem Konto entsteht eine Buchung, der Wert der Anlage verändert sich um denselben Betrag. |
| **Kategorie** | Einordnung von Einnahmen/Ausgaben (z. B. „Lebensmittel“, „Gehalt“). Es gibt eine **Standard-Liste** für alle und **eigene Kategorien** je Nutzer. |
| **Wiederkehrende Buchung** | Eine Buchung (Einnahme, Ausgabe oder Transfer), die als „regelmäßig“ markiert ist und in einem Rhythmus automatisch gebucht wird. Der Rhythmus besteht aus **Anzahl** und **Einheit**, z. B. „alle 20 Tage“, „alle 3 Monate“, „alle 4 Jahre“. |
| **Anlage** | Ein Vermögenswert, der **nicht wie ein Konto** geführt wird: Fonds, Depot, Bausparvertrag, Versicherung mit Rückkaufswert, … Sein Wert ergibt sich aus dem zuletzt manuell eingetragenen **Stand** plus den Ein- und Auszahlungen danach. |
| **Stand (einer Anlage)** | Ein manuell eingetragener Gesamtwert zu einem Datum (z. B. „Fonds XY: 12.340,00 € am 01.10.2026“). Die Historie der Stände bleibt erhalten. |
| **Periode / Monat** | Die Standard-Betrachtungseinheit der Übersichten ist ein Kalendermonat. |

## 4. Sichtbarkeit und Berechtigungen

Jeder Nutzer sieht nach dem Login **seine eigene Sicht**. Es gibt keine nutzerübergreifende Gesamtsicht.

| Regel | Beschreibung |
|-------|--------------|
| S-01 | Ein Nutzer sieht genau die **Konten und Anlagen, deren Inhaber er ist**. |
| S-02 | Ein Nutzer sieht genau die **Buchungen auf seinen sichtbaren Konten**. |
| S-03 | **Alle Inhaber sind gleichberechtigt**: Jeder Inhaber eines Kontos oder einer Anlage darf sie bearbeiten, archivieren und löschen, Buchungen und Stände darauf anlegen, ändern und löschen sowie Inhaber hinzufügen und entfernen. Ein Konto/eine Anlage behält immer mindestens einen Inhaber. |
| S-04 | Als Inhaber hinzufügen kann man jeden registrierten Nutzer (Auswahl über den Nutzernamen). |
| S-05 | Beim Erfassen eines **Transfers** stehen als Quelle und Ziel **nur Konten und Anlagen zur Auswahl, die der Nutzer selbst sieht**. Geld an ein Konto, das man nicht sieht (z. B. das Privatkonto des Partners), wird als **Ausgabe** gebucht. |
| S-06 | Einen bestehenden Transfer darf jeder Inhaber **eines** der beteiligten Konten ändern oder löschen. Dabei werden immer beide Hälften geändert bzw. gelöscht. |
| S-07 | Sieht ein Nutzer nur **eine Hälfte** eines Transfers (weil er nur eines der beiden Konten sieht), ist sie für ihn **eine ganz normale Buchung**: Ein Eingang zählt als Einnahme, ein Abgang als Ausgabe. Vom anderen Konto sieht er nur den Namen (z. B. „Übertrag von Giro A“). |
| S-08 | **Standard-Kategorien** sieht jeder Nutzer. **Eigene Kategorien** sieht und verwendet nur der Nutzer, der sie angelegt hat. Ist eine Buchung auf einem Gemeinschaftskonto mit der eigenen Kategorie eines anderen Inhabers versehen, wird deren Name trotzdem angezeigt. |

### Beispiel

Nutzer **A** hat „Giro A“, Nutzer **B** hat „Giro B“, beide teilen sich „Gemeinsam“.
A überweist am 01.10. **500 €** von „Giro A“ auf „Gemeinsam“. A sieht beide Konten, also ist es ein Transfer mit zwei Buchungen:

| Buchung | Konto | Betrag |
|---------|-------|--------|
| Transfer-Abgang | Giro A | −500,00 € |
| Transfer-Eingang | Gemeinsam | +500,00 € |

| | Sicht von A | Sicht von B |
|---|---|---|
| Sichtbare Buchungen | beide Hälften | nur der Eingang auf „Gemeinsam“ |
| Was es für den Nutzer ist | ein **Transfer** zwischen eigenen Konten | eine **Einnahme** („Übertrag von Giro A“) |
| Monatsbilanz (Gesamtübersicht) | taucht nicht auf | **+500 €** bei den Einnahmen |
| Kontoübersicht „Gemeinsam“ | +500 € aufgelistet | +500 € aufgelistet |
| Gesamtvermögen | unverändert | +500 € |

B überweist dagegen 200 € von „Giro B“ auf das Privatkonto „Giro A“, das B nicht sieht: Das ist eine **Ausgabe** auf „Giro B“. Wenn A das Geld erfassen möchte, bucht A eine **Einnahme** auf „Giro A“.

## 5. Datenmodell

Das Modell ist unabhängig von der Speicherform beschrieben. Im JSON-Speicher entspricht jede Entität einer Sammlung (Datei), siehe [10.3](#103-speicherschicht).
IDs sind zufällige UUIDs (`crypto.randomUUID()`), damit sie unabhängig von der Speicherform eindeutig sind.

### 5.1 Überblick

Pfeile zeigen in Richtung des Verweises: `A ──► B` heißt „A speichert die ID von B“.

```
                 ┌──────────────────────────────────────────────────┐
                 │                      Nutzer                      │
                 └──────▲─────────────────▲─────────────────▲───────┘
                        │ owner_ids       │ owner_id        │ owner_ids
                        │ (1..n)          │ (0..1, leer =   │ (1..n)
                        │                 │  Standard)      │
                 ┌──────┴──────┐   ┌──────┴──────┐   ┌──────┴──────┐  asset_id  ┌──────────────┐
                 │    Konto    │   │  Kategorie  │   │   Anlage    │◄───────────┤ Anlage-Stand │
                 └──────▲──────┘   └──────▲──────┘   └──────▲──────┘            └──────────────┘
                        │ account_id      │ category_id     │ counter_asset_id
                        │ (genau 1)       │ (0..1)          │ (0..1, Ein-/Auszahlung)
                 ┌──────┴─────────────────┴─────────────────┴───────┐
                 │                     Buchung                      │
                 │ (Einnahme | Ausgabe | Transfer)                  │
                 │ + counter_account_id ──► Konto (Transfer)        │
                 └────────────────────────┬─────────────────────────┘
                                          │ recurring_id (0..1)
                                          ▼
                 ┌──────────────────────────────────────────────────┐
                 │              Wiederkehrende Buchung              │
                 │ ──► Konto, Kategorie, Ziel-Konto/-Anlage         │
                 └──────────────────────────────────────────────────┘
```

| Verweis | Von → Nach | Bedeutung |
|---------|-----------|-----------|
| `owner_ids` | Konto / Anlage → Nutzer | Inhaber (einer oder mehrere) |
| `owner_id` | Kategorie → Nutzer | Eigene Kategorie eines Nutzers; leer = Standard-Kategorie |
| `account_id` | Buchung → Konto | Das Konto, zu dem die Buchung gehört (immer genau eins) |
| `category_id` | Buchung → Kategorie | Einordnung der Einnahme/Ausgabe (optional, nicht bei Transfers) |
| `counter_account_id` | Buchung → Konto | Gegenkonto bei Transfer Konto↔Konto |
| `transfer_id` | Buchung ↔ Buchung | Verknüpft die zwei Hälften eines Transfers |
| `counter_asset_id` | Buchung → Anlage | Anlage bei Ein-/Auszahlung |
| `recurring_id` | Buchung → Wiederkehrende Buchung | Vorlage, aus der die Buchung erzeugt wurde |
| `asset_id` | Anlage-Stand → Anlage | Zu welcher Anlage der Stand gehört |

### 5.2 Entitäten

#### Nutzer (`users`)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | UUID | ja | |
| `username` | Text | ja | Login-Name, eindeutig, nicht case-sensitiv. Wird auch überall als Name angezeigt (kein separater Anzeigename) |
| `password_hash` | Text | ja | Gehashtes Passwort inkl. Salt – **nie** das Klartext-Passwort (siehe [10.4](#104-login-und-sitzungen)) |
| `theme` | Enum | ja | Darstellungsmodus: `auto` (wie System), `light`, `dark`. Default `auto` (F-06) |
| `hidden_category_ids` | Liste von UUIDs | ja | Für diesen Nutzer ausgeblendete Standard-Kategorien (F-15). Default leer |
| `created_at` | Zeitstempel | ja | |

#### Konto (`accounts`)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | UUID | ja | |
| `name` | Text | ja | z. B. „Girokonto Gemeinsam“ |
| `type` | Enum | ja | `giro`, `savings`, `cash`, `prepaid`, `other` |
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
| `merchant_required` | Boolean | ja | „Einkauf“: Bei Ausgaben dieser Kategorie ist das Geschäft Pflicht. Ab Werk bei Lebensmittel, Haushalt, Kleidung, Geschenke. Umschaltbar in der Oberfläche (bei Standard-Kategorien für alle Nutzer) |
| `owner_id` | UUID → users | nein | Leer = **Standard-Kategorie** (für alle sichtbar); gesetzt = eigene Kategorie dieses Nutzers |
| `archived` | Boolean | ja | |

**Standard-Kategorien (Startdaten):**

- Beim **ersten Start** (es gibt noch keine `categories.json`) erzeugt der Code die Standard-Liste und schreibt sie als Kategorien ohne `owner_id` in `data/categories.json`.
- Das passiert **nur einmal** (vermerkt in `meta.json`). Danach wird die Liste ausschließlich in der JSON-Datei gepflegt: umbenennen, ergänzen, entfernen. Gelöschte Standard-Kategorien werden nicht neu erzeugt.
- **Wichtig:** Weil die Anwendung alle Daten beim Start lädt und beim Speichern zurückschreibt, wird die Datei nur bei **gestopptem Server** bearbeitet; die Änderungen gelten nach dem nächsten Start.
- In der Oberfläche sind Standard-Kategorien nur lesbar.

Vorschlag für die erzeugte Liste:

| Art | Kategorien |
|-----|------------|
| Einnahmen | Gehalt, Nebeneinkünfte, Erstattungen, Geschenke, Sonstige Einnahmen |
| Ausgaben | Wohnen, Energie, Lebensmittel, Haushalt, Mobilität, Versicherungen, Internet & Telefon, Abos & Mitgliedschaften, Gesundheit, Kleidung, Freizeit, Urlaub, Geschenke, Bildung, Sonstige Ausgaben |

#### Buchung (`transactions`)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | UUID | ja | |
| `account_id` | UUID → accounts | ja | Das Konto, zu dem die Buchung gehört |
| `type` | Enum | ja | `income`, `expense`, `transfer` |
| `date` | Datum | ja | Buchungsdatum |
| `amount_cents` | Integer | ja | **Mit Vorzeichen** aus Sicht des Kontos: `+` = Geld kommt rein, `−` = Geld geht raus. Einnahme immer `> 0`, Ausgabe immer `< 0`, Transfer je nach Richtung |
| `transfer_id` | UUID | nur Transfer Konto↔Konto | Verknüpft die beiden Hälften (beide haben dieselbe `transfer_id`) |
| `counter_account_id` | UUID → accounts | nur Transfer Konto↔Konto | Das jeweils andere Konto |
| `counter_asset_id` | UUID → assets | nur Transfer Konto↔Anlage | Die Anlage, in die eingezahlt (Betrag `< 0`) bzw. aus der ausgezahlt (Betrag `> 0`) wird |
| `category_id` | UUID → categories | nein | Nicht bei Transfers |
| `description` | Text | ja | Kurzer Text, z. B. „Wocheneinkauf“ |
| `note` | Text | nein | Freitext |
| `recurring_id` | UUID → recurring | nein | Gesetzt, wenn aus einer wiederkehrenden Buchung erzeugt |
| `merchant` | Text | nur Ausgabe | Geschäft, z. B. „Edeka“ (max. 80 Zeichen). Pflicht, wenn die Kategorie `merchant_required` hat – außer bei automatisch erzeugten Buchungen |
| `items` | Liste | nur Ausgabe | Artikel: `{ name, quantity, unit_price_cents, total_cents }` mit `total_cents = round(quantity × unit_price_cents)`. Menge ist eine ganze Zahl ≥ 1 (Stückzahl), Stückpreis darf negativ sein (Pfand, Rabatt). Reine Aufstellung – der Betrag der Buchung wird nicht daraus berechnet; Abweichungen werden nur angezeigt |
| `receipt` | Objekt | nur Ausgabe | Kassenzettel: `{ file, mime, original_name, size }`; Datei in `data/uploads/` (siehe 10.3) |
| `created_by` | UUID → users | ja | Nur zur Information, wer die Buchung erfasst hat. Bestimmt **nicht**, wem sie gehört |
| `created_at`, `updated_at` | Zeitstempel | ja | |

Regeln für Transfers:

- Ein Transfer hat **entweder** ein Gegenkonto **oder** eine Gegen-Anlage, nie beides.
- Konto↔Konto wird immer **als Paar angelegt, geändert und gelöscht**. Beide Hälften haben dasselbe Datum, denselben Betrag mit umgekehrtem Vorzeichen und dieselbe Beschreibung.
- Konto↔Anlage ist **eine** Buchung auf dem Konto. Der Anlagenwert ergibt sich daraus rechnerisch (siehe [6.3](#63-wert-einer-anlage)); es wird kein Stand dafür gespeichert.
- Quelle ≠ Ziel; beim Anlegen muss der Nutzer beide Seiten sehen (S-05).

#### Wiederkehrende Buchung (`recurring`)

Entsteht, wenn beim Erfassen einer Buchung „regelmäßig“ angehakt wird. Sie ist die Vorlage für die Buchungen, die danach automatisch gebucht werden.

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | UUID | ja | |
| `type` | Enum | ja | `income`, `expense`, `transfer` |
| `account_id` | UUID | ja | Konto (bei Transfer: Quellkonto) |
| `to_account_id` | UUID | Transfer auf Konto | Zielkonto |
| `to_asset_id` | UUID | Transfer in Anlage | Ziel-Anlage (z. B. Sparplan) |
| `amount_cents` | Integer | ja | Betrag (positiv, Richtung ergibt sich aus `type`) |
| `category_id`, `merchant`, `description`, `note` | | | wie bei der Buchung (Artikel und Kassenzettel gibt es bei Vorlagen nicht) |
| `interval_unit` | Enum | ja | Einheit des Rhythmus: `day`, `week`, `month`, `year` |
| `interval_count` | Integer ≥ 1 | ja | Anzahl der Einheiten zwischen zwei Terminen, z. B. `20` + `day` = alle 20 Tage, `3` + `month` = vierteljährlich, `4` + `year` = alle 4 Jahre |
| `day_of_month` | Integer 1–31 | bei `month`/`year` | Fester Tag des Termins, z. B. `20` = „am 20.“. Leer = Tag des `start_date` |
| `month_of_year` | Integer 1–12 | bei `year` | Fester Monat des Termins, z. B. `10` mit Tag `1` = „am 01.10.“. Leer = Monat des `start_date` |
| `start_date` | Datum | ja | Startdatum („gültig ab“). Der erste Termin ist der erste passende Tag ab diesem Datum |
| `end_date` | Datum | nein | Letzte mögliche Ausführung |
| `active` | Boolean | ja | Pausieren ohne Löschen |
| `last_generated_date` | Datum | nein | Bis wohin bereits Buchungen erzeugt wurden |
| `created_by` | UUID → users | ja | |

Berechnung der Termine:

- **Tag / Woche:** ab `start_date` alle `interval_count` Tage bzw. Wochen.
- **Monat:** am `day_of_month` jedes `interval_count`-ten Monats. Erster Termin ist der erste solche Tag ≥ `start_date`. Beispiel: Start 25.10., „jeden Monat am 20.“ → 20.11., 20.12., …
- **Jahr:** am `day_of_month`.`month_of_year` jedes `interval_count`-ten Jahres. Beispiel: Start 25.10.2026, „jedes Jahr am 01.10.“ → 01.10.2027, 01.10.2028, …
- Der n-te Termin wird immer vom ersten Termin aus berechnet, damit sich nichts verschiebt.
- Gibt es den Tag im Monat nicht (z. B. 31. im April oder 29.02. außerhalb von Schaltjahren), wird für diesen Termin der letzte Tag des Monats verwendet. Ungültige Kombinationen wie 31.04. werden abgelehnt.
- **Rhythmus ändern:** Der neue Rhythmus gilt ab dem nächsten Termin nach altem Rhythmus (`start_date` wird entsprechend versetzt). So entsteht im laufenden Monat keine zweite Buchung.

#### Anlage (`assets`)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | UUID | ja | |
| `name` | Text | ja | z. B. „ETF-Sparplan“, „Bausparvertrag Wohnung“ |
| `type` | Enum | ja | `fund`, `depot`, `building_savings`, `insurance`, `other` |
| `owner_ids` | Liste von UUIDs | ja | Inhaber, mindestens einer – gleiche Regeln wie bei Konten |
| `provider` | Text | nein | z. B. Name der Bausparkasse |
| `note` | Text | nein | Freitext, z. B. Vertragsnummer, Zielsumme |
| `archived` | Boolean | ja | |
| `created_at`, `updated_at` | Zeitstempel | ja | |

#### Anlage-Stand (`asset_values`)

Nur **manuell** eingetragene Gesamtwerte. Ein- und Auszahlungen stehen als Buchungen in `transactions`.

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | UUID | ja | |
| `asset_id` | UUID → assets | ja | |
| `date` | Datum | ja | Stichtag des Standes |
| `value_cents` | Integer | ja | Gesamtwert zum Stichtag |
| `note` | Text | nein | z. B. „laut Depotauszug“ |
| `created_by` | UUID → users | ja | |

Beim Anlegen einer Anlage wird ihr aktueller Stand als erster manueller Stand mit erfasst. `date` eines manuellen Stands ist immer der Tag der Eingabe; der genaue Zeitpunkt steht in `created_at`.

## 6. Berechnungsregeln

Alle Berechnungen beziehen sich auf die **Sicht des angemeldeten Nutzers**, also nur auf seine sichtbaren Konten und Anlagen.

### 6.1 Kontostand

```
Kontostand(K, Stichtag) = Anfangssaldo(K) + Σ amount_cents aller Buchungen auf K mit Datum ≤ Stichtag
```

Weil Beträge ein Vorzeichen haben, gilt diese eine Formel für Einnahmen, Ausgaben und Transfers.
Buchungen vor dem `opening_date` eines Kontos sind nicht erlaubt.

### 6.2 Einordnung einer Buchung aus Sicht des Nutzers

Für die Monatsbilanz wird jede sichtbare Buchung so eingeordnet:

| Buchung | Gegenseite für den Nutzer sichtbar? | Einordnung |
|---------|-------------------------------------|------------|
| `income` | – | **Einnahme** |
| `expense` | – | **Ausgabe** |
| `transfer`, Betrag > 0 | nein | **Einnahme** (S-07) |
| `transfer`, Betrag < 0 | nein | **Ausgabe** (S-07) |
| `transfer` | ja (Konto oder Anlage) | **Transfer** – nicht in der Monatsbilanz |

Transfers ohne sichtbare Gegenseite haben keine Kategorie. Sie erscheinen in der Aufschlüsselung nach Kategorie unter **„Überträge“**.

### 6.3 Wert einer Anlage

**Ein manueller Stand hat immer Vorrang: Er ist der Stand zum Zeitpunkt der Eingabe.** Es gibt kein wählbares Datum; Datum ist der Tag der Eingabe. Der neue Stand ersetzt den bisher berechneten Wert inklusive aller bis dahin erfassten Ein- und Auszahlungen und ist der neue Ausgangspunkt. Ein- und Auszahlungen danach werden automatisch aufaddiert.

```
S = letzter manueller Stand der Anlage mit Datum ≤ Stichtag

Wert(Anlage, Stichtag) = S.value
                       + Σ Einzahlungen in die Anlage   mit S.date < Datum ≤ Stichtag
                       − Σ Auszahlungen aus der Anlage  mit S.date < Datum ≤ Stichtag
```

- **Am selben Tag** wie ein manueller Stand entscheidet die Reihenfolge der Erfassung: Eine Ein-/Auszahlung, die **nach** dem Stand erfasst wurde, wird aufaddiert (z. B. Anlage heute angelegt, danach heutige Sparrate gebucht). Eine **vorher** erfasste gilt als im Stand enthalten.
- Eine Ein-/Auszahlung, die **nach** dem Stand erfasst, aber auf einen Tag **vor** dem Stand datiert wird (nachgetragen), gilt als im Stand enthalten – der Stand beschreibt ja den Wert „jetzt“. Auf dem Konto wird sie trotzdem gebucht.
- Stände und Werte einer Anlage dürfen **negativ** sein (z. B. Bauspardarlehen). Einzahlungen verringern dann die Schulden.
- **Manuelle Korrektur**: Für jeden manuellen Stand wird angezeigt, um wie viel er vom bis dahin berechneten Wert abweicht (`Korrektur = manueller Stand − berechneter Wert unmittelbar davor`, inklusive vorher erfasster Ein-/Auszahlungen desselben Tages). Im Beispiel unten beträgt die Korrektur am 20.10. −50 €.
- Beispiel: Stand 01.09. = 10.000 €; Sparrate 15.09. = 200 € → Wert 10.200 €; Sparrate 15.10. = 200 € → Wert 10.400 €; am 20.10. wird laut Depotauszug ein Stand von 10.350 € eingetragen → Wert 10.350 €; Sparrate 15.11. → 10.550 €.
- Eine Ein-/Auszahlung zählt zum Anlagenwert, **auch wenn der jeweilige Nutzer das Konto nicht sieht**, von dem sie kam. Der Anlagenwert ist für alle Inhaber gleich.

### 6.4 Gesamtübersicht eines Nutzers

```
Summe Konten   = Σ Kontostand aller sichtbaren, nicht archivierten Konten   (Gemeinschaftskonten mit vollem Betrag)
Summe Anlagen  = Σ Wert aller sichtbaren, nicht archivierten Anlagen
Gesamtvermögen = Summe Konten + Summe Anlagen
```

Hinweis: Weil Gemeinschaftskonten bei jedem Inhaber voll zählen, ergibt die Summe der Gesamtvermögen mehrerer Nutzer **nicht** das Haushaltsvermögen. Das ist so gewollt.

### 6.5 Monatsbilanz

Für den gewählten Monat und die sichtbaren Konten, mit der Einordnung aus 6.2:

```
Einnahmen        = Σ Buchungen, eingeordnet als Einnahme
Ausgaben         = Σ Buchungen, eingeordnet als Ausgabe   (negativ)
Saldo des Monats = Einnahmen + Ausgaben
```

Transfers erscheinen **nicht** in der Monatsbilanz, aber in der Kontoübersicht des jeweiligen Kontos und in der Transfer-Liste des Monats.
Zur Information zeigt die Monatsübersicht zusätzlich **„In Anlagen gespart“** = Σ Einzahlungen − Σ Auszahlungen des Monats bei sichtbaren Anlagen.

Kontrollrechnung (für Tests):
`Veränderung Summe Konten im Monat = Saldo des Monats − In Anlagen gespart`

### 6.6 Beträge und Formate

- Speicherung und Berechnung in Cent (`Integer`). Cent-Werte sind ein reines Implementierungsdetail und tauchen in der Oberfläche **nie** auf.
- Anzeige immer in Euro mit zwei Nachkommastellen: `1.234,56 €`.
- Eingabe akzeptiert `1234,56`, `1.234,56`, `1.000` (Punkt als Tausendertrenner) und `1234.56`. Bei Buchungen wird der Betrag immer **positiv** eingegeben, das Vorzeichen ergibt sich aus der Buchungsart.
- Werte, die negativ sein können (Anfangssaldo eines Kontos, Startwert und Stand einer Anlage), haben zusätzlich eine Auswahl **Guthaben / Schulden**, da Handy-Zahlentastaturen oft kein Minus haben. Ein eingetipptes Minus gilt ebenfalls.
- Währung fest **EUR** (eine Währung pro Installation).
- Datumsanzeige `TT.MM.JJJJ`, intern ISO `JJJJ-MM-TT`.

### 6.7 Regelmäßige Buchungen pro Monat

Die Übersicht der regelmäßigen Buchungen (F-35) rechnet jeden Betrag auf einen **Durchschnittsmonat** um:

| Turnus | Betrag pro Monat |
|--------|------------------|
| alle n Tage | Betrag × 365,25 / 12 / n |
| alle n Wochen | Betrag × 365,25 / 7 / 12 / n |
| alle n Monate | Betrag / n |
| alle n Jahre | Betrag / 12 / n |

- Die Art (Einnahme, Ausgabe, Transfer) gilt aus Sicht des Nutzers wie bei Buchungen (6.2): Ein Transfer, dessen Gegenseite der Nutzer nicht sieht, zählt für ihn als Einnahme bzw. Ausgabe.
- Die Summen enthalten nur **laufende** Einträge (aktiv und mit künftigem Termin); pausierte und beendete werden angezeigt, zählen aber nicht mit. Sie beziehen sich auf die gefilterte Liste.
- **Saldo pro Monat** = Einnahmen − Ausgaben; Transfers werden getrennt ausgewiesen, davon gesondert die Einzahlungen in Anlagen.
- Sortieren nach Betrag nutzt den Betrag ohne Vorzeichen (größte Posten zuerst bei absteigender Reihenfolge); Einträge ohne nächsten Termin stehen beim Sortieren nach Termin immer am Ende.

## 7. Funktionale Anforderungen

Priorität: **M** = Muss (MVP), **S** = Soll (kurz nach MVP), **K** = Kann (später).

### 7.1 Konto und Login

| ID | Anforderung | Prio |
|----|-------------|------|
| F-01 | Registrieren mit Nutzername und Passwort (mit Wiederholung) | M |
| F-02 | Anmelden mit Nutzername und Passwort; Abmelden | M |
| F-03 | Alle Seiten außer Login/Registrierung nur angemeldet erreichbar | M |
| F-04 | Eigenes Passwort ändern | S |
| F-07 | **Handbuch in der Anwendung**: Seiten aus `docs/wiki` mit Kapitel-Navigation, Vor/Zurück, Suche und Stand-Vermerk; „?“-Knopf öffnet das passende Kapitel; ohne Anmeldung lesbar | S |
| F-06 | **Hell/Dunkel-Umschalter** in der Navigation; die Wahl (Automatisch, Hell, Dunkel) wird pro Nutzer gespeichert und gilt auf allen Geräten | M |

### 7.2 Stammdaten

| ID | Anforderung | Prio |
|----|-------------|------|
| F-10 | Konten anlegen, bearbeiten, archivieren, löschen (Name, Typ, Anfangssaldo, Stichtag) | M |
| F-11 | Inhaber eines Kontos verwalten: registrierte Nutzer hinzufügen und entfernen (S-03, S-04) | M |
| F-12 | Standard-Kategorien beim ersten Start als Startdaten erzeugen (siehe 5.2, Kategorie) | M |
| F-13 | Eigene Kategorien für Einnahmen und Ausgaben anlegen, bearbeiten, archivieren | M |
| F-14 | Löschen von Konten, Anlagen und Kategorien nur, wenn nichts mehr daran hängt (keine Buchungen/Stände) – sonst nur Archivieren | M |
| F-15 | Standard-Kategorien für sich selbst ausblenden | K |

### 7.3 Buchungen

| ID | Anforderung | Prio |
|----|-------------|------|
| F-20 | Einnahme erfassen (Datum, Betrag, Konto, Kategorie, Beschreibung, Notiz) | M |
| F-21 | Ausgabe erfassen (analog) | M |
| F-22 | Transfer zwischen zwei eigenen Konten erfassen (Datum, Betrag, Von, Nach, Beschreibung) – erzeugt beide Hälften | M |
| F-23 | Buchung bearbeiten und löschen (mit Bestätigung); bei Transfers immer beide Hälften | M |
| F-24 | Buchungsliste mit Filtern: Monat/Zeitraum, Konto, Kategorie, Art, Freitextsuche | M |
| F-25 | Schnelleingabe: Datum mit heute vorbelegt, zuletzt verwendetes Konto vorausgewählt; „Speichern & weitere erfassen“ | S |
| F-26 | Buchung duplizieren („nochmal buchen“) | K |
| F-27 | **Geschäft** bei Ausgaben; Pflicht bei Einkaufs-Kategorien (`merchant_required`), Vorschläge aus bisherigen Eingaben | S |
| F-28 | **Artikel** zu einer Ausgabe erfassen (Name, Menge, Stückpreis); Hinweis, wenn die Summe vom Betrag abweicht | S |
| F-29 | **Kassenzettel** (Foto JPG/PNG/WebP/HEIC oder PDF, max. 15 MB) an eine Ausgabe hängen, ansehen, ersetzen, entfernen | S |

### 7.4 Wiederkehrende Buchungen

| ID | Anforderung | Prio |
|----|-------------|------|
| F-30 | Beim Erfassen einer Einnahme, Ausgabe oder eines Transfers (auch in eine Anlage) die Option **„regelmäßig“** mit Rhythmus aus **Anzahl + Einheit** (z. B. alle 1 Monat, alle 20 Tage, alle 3 Monate, alle 4 Jahre), bei Monat/Jahr mit **festem Tag** bzw. **Tag und Monat** (z. B. „am 20.“, „am 01.10.“), und optionalem Enddatum | M |
| F-31 | Nach dem Anlegen werden alle fälligen Termine **automatisch gebucht** – ohne Bestätigung (siehe 8.4) | M |
| F-32 | Übersicht aller wiederkehrenden Buchungen auf den eigenen Konten; bearbeiten, pausieren, beenden | M |
| F-33 | Eine automatisch erzeugte Buchung kann einzeln geändert oder gelöscht werden, ohne die Vorlage zu ändern | M |
| F-34 | Änderungen an der Vorlage gelten nur für künftige Termine | M |
| F-35 | **Übersicht der regelmäßigen Buchungen**: Betrag umgerechnet auf einen Monat, Summen pro Monat (Einnahmen, Ausgaben, Saldo, Transfers, davon in Anlagen) über alle laufenden Einträge der gefilterten Liste; **filtern** nach Konto/Anlage, Turnus (Einheit), Art (aus Sicht des Nutzers, 6.2) und Status; **sortieren** nach Beschreibung, Konto, Turnus, nächstem Termin, Betrag und Betrag pro Monat (6.7) | S |

### 7.5 Anlagen

| ID | Anforderung | Prio |
|----|-------------|------|
| F-40 | Anlagen anlegen, bearbeiten, archivieren, löschen (Name, Typ, Anbieter, Inhaber, Notiz, Startwert) | M |
| F-41 | Neuen **Stand** manuell erfassen (aktueller Gesamtwert, Notiz; gilt immer für den Zeitpunkt der Eingabe und hat Vorrang, siehe 6.3) – schnell erreichbar direkt aus der Übersicht | M |
| F-42 | **Einzahlung** von einem eigenen Konto in eine Anlage und **Auszahlung** aus einer Anlage auf ein eigenes Konto als Transfer erfassen, auch regelmäßig (Sparrate) | M |
| F-43 | Anlagedetail: Verlauf aus manuellen Ständen und Ein-/Auszahlungen mit jeweils resultierendem Wert; manuelle Stände sind als **„manuell“** gekennzeichnet und zeigen ihre Korrektur (6.3) | M |
| F-46 | Anlagenübersicht und Dashboard zeigen je Anlage das **Datum der letzten manuellen Aktualisierung** und deren Korrektur (z. B. „manuell aktualisiert am 20.10.2026, −50,00 €“) | M |
| F-44 | Hinweis, wenn der letzte manuelle Stand einer Anlage älter als X Monate ist (X konfigurierbar) | K |
| F-45 | Wertverlauf als Diagramm | K |

### 7.6 Übersichten

| ID | Anforderung | Prio |
|----|-------------|------|
| F-50 | **Dashboard**: Kontostände aller sichtbaren Konten, Summe Konten, Anlagen mit aktuellem Wert, Gesamtvermögen | M |
| F-51 | **Monatsübersicht**: Einnahmen, Ausgaben, Saldo des Monats und „In Anlagen gespart“ (6.5); Blättern zwischen Monaten | M |
| F-52 | Monatsübersicht aufgeschlüsselt nach Kategorie (inkl. „Überträge“) | M |
| F-53 | Monatsübersicht aufgeschlüsselt nach Konto | M |
| F-54 | **Transfers des Monats** als eigene Liste (Von → Nach, Betrag) | M |
| F-55 | **Kontoübersicht**: alle Buchungen eines Kontos inkl. Transfers mit laufendem Saldo | M |
| F-56 | Vergleich über mehrere Monate (Tabelle: Monat × Einnahmen/Ausgaben/Saldo) | S |
| F-57 | Diagramme (Ausgaben nach Kategorie, Verlauf Gesamtvermögen) | K |
| F-58 | Monatsübersicht: **Ausgaben nach Geschäft**; Buchungsliste und CSV mit Filter/Spalte „Geschäft“, Suche auch in Artikeln | S |
| F-59 | Auswertung **Artikel**: Käufe, Menge, Ausgaben, Ø-/min./max. Stückpreis, letzter Kauf; mit Suche (negative Positionen wie Pfand zählen nicht) | K |

### 7.7 Daten

| ID | Anforderung | Prio |
|----|-------------|------|
| F-60 | Export der eigenen Buchungen als CSV | S |
| F-61 | Backup: Der Datenordner kann einfach kopiert werden; automatische Sicherungskopie vor jedem Schreiben | M |
| F-62 | CSV-Import von Kontoauszügen | K |

## 8. Abläufe

### 8.1 Registrierung und erste Schritte

1. Nicht angemeldet → Login-Seite mit Link „Registrieren“.
2. Registrieren: Nutzername, Passwort, Passwort wiederholen.
3. Nach der Registrierung ist der Nutzer angemeldet. Hat er noch keine Konten, zeigt das Dashboard einen Hinweis „Lege dein erstes Konto an“.
4. Konto anlegen: Name, Typ, Anfangssaldo und Stichtag (z. B. Kontostand laut Bank am 01. des Monats), optional weitere Inhaber.
5. Optional: Anlagen mit Startwert anlegen, eigene Kategorien ergänzen (die Standard-Kategorien sind bereits vorhanden).

### 8.2 Einnahme / Ausgabe erfassen

1. „+ Ausgabe“ bzw. „+ Einnahme“ – global in der Navigation erreichbar.
2. Formular: Datum (heute), Betrag, Konto (nur sichtbare), Kategorie (Standard + eigene, nur passende Art), Beschreibung, Notiz, ☐ regelmäßig (→ alle [Anzahl] [Tage/Wochen/Monate/Jahre], Enddatum).
3. Serverseitige Prüfung: Betrag > 0, Konto existiert, ist für den Nutzer sichtbar und nicht archiviert, Datum ≥ Stichtag des Kontos.
4. Speichern → Rückkehr zur vorherigen Seite mit Erfolgsmeldung.

### 8.3 Transfer erfassen

1. „⇄ Transfer“.
2. Formular: Datum, Betrag, Von, Nach, Beschreibung, ☐ regelmäßig.
   Für Von und Nach stehen **nur eigene Konten und Anlagen** zur Auswahl (S-05). Mindestens eine Seite muss ein Konto sein.
3. Prüfung: Von ≠ Nach, Betrag > 0, nichts archiviert, beide Seiten sichtbar.
4. Speichern:
   - Konto → Konto: **zwei Buchungen** mit gemeinsamer `transfer_id`.
   - Konto → Anlage (Einzahlung) oder Anlage → Konto (Auszahlung): **eine Buchung** auf dem Konto mit `counter_asset_id`; der Anlagenwert steigt bzw. sinkt entsprechend (6.3).
5. Ergebnis: Jeder Nutzer sieht die Hälfte(n) auf seinen Konten (siehe Beispiel in [Kapitel 4](#beispiel)).

### 8.4 Wiederkehrende Buchungen

1. Beim Speichern einer Buchung mit „regelmäßig“ wird die Vorlage angelegt **und sofort** jeder fällige Termin ab `start_date` bis heute gebucht (liegt `start_date` in der Vergangenheit, werden alle Termine nachgebucht).
2. Danach prüft die Anwendung beim Start und einmal täglich (bzw. beim ersten Seitenaufruf des Tages) alle aktiven Vorlagen und bucht neu fällige Termine automatisch – ohne Bestätigung. War die Anwendung länger aus, werden verpasste Termine nachgeholt.
3. Erzeugte Buchungen sind als „regelmäßig“ gekennzeichnet (mit Link zur Vorlage) und können einzeln angepasst oder gelöscht werden. Eine gelöschte Einzelbuchung wird nicht erneut erzeugt (`last_generated_date`).
4. Pausieren oder Beenden der Vorlage stoppt künftige Buchungen; bereits gebuchte bleiben bestehen.

### 8.5 Anlage pflegen

**Sparrate einrichten:** Transfer von einem eigenen Konto in die Anlage erfassen, ☐ regelmäßig, Rhythmus „alle 1 Monat“. Ab dann wird jeden Monat automatisch vom Konto abgebucht und auf den Anlagenwert aufaddiert.

**Stand aktualisieren** (z. B. weil sich der Fondskurs täglich ändert):
1. Im Dashboard oder in der Anlagenliste bei der Anlage auf „Stand aktualisieren“.
2. Formular: aktueller Gesamtwert (Guthaben/Schulden), Notiz. Kein Datum – der Stand gilt für jetzt.
3. Speichern → Der neue Stand ersetzt sofort den bisher berechneten Wert und ist Ausgangspunkt für künftige Sparraten. Frühere Stände und Einzahlungen bleiben im Verlauf sichtbar.
4. In Übersicht, Dashboard und Verlauf ist erkennbar, dass und wann (Datum und Uhrzeit) der Stand manuell geändert wurde und um wie viel (F-43, F-46).

## 9. Seiten und Navigation

| Seite | Route (Vorschlag) | Inhalt |
|-------|-------------------|--------|
| Login | `GET/POST /login` | |
| Registrieren | `GET/POST /registrieren` | |
| Abmelden | `POST /logout` | |
| Dashboard | `GET /` | Kontostände, Anlagen, Gesamtvermögen, Kurzbilanz aktueller Monat, letzte Buchungen |
| Monatsübersicht | `GET /monat/:jahr/:monat` | Bilanz, nach Kategorie, nach Konto, Transfers, In Anlagen gespart |
| Buchungen | `GET /buchungen` | Gefilterte Liste (Query-Parameter für Filter) |
| Neue Buchung | `GET/POST /buchungen/neu?typ=einnahme\|ausgabe\|transfer` | |
| Buchung bearbeiten | `GET/POST /buchungen/:id/bearbeiten` | |
| Buchung löschen | `POST /buchungen/:id/loeschen` | |
| Konten | `GET /konten` | Sichtbare Konten mit Saldo und Inhabern |
| Konto anlegen/bearbeiten | `GET/POST /konten/neu`, `/konten/:id/bearbeiten` | inkl. Inhaber |
| Kontoübersicht | `GET /konten/:id` | Buchungen inkl. Transfers mit laufendem Saldo |
| Anlagen | `GET /anlagen` | Sichtbare Anlagen mit aktuellem Wert |
| Anlage anlegen/bearbeiten | `GET/POST /anlagen/neu`, `/anlagen/:id/bearbeiten` | inkl. Inhaber, Startwert |
| Anlagedetail | `GET /anlagen/:id` | Verlauf aus Ständen und Ein-/Auszahlungen |
| Stand erfassen | `GET/POST /anlagen/:id/stand` | |
| Wiederkehrend | `GET /wiederkehrend?konto=&turnus=day\|week\|month\|year&art=income\|expense\|transfer&status=laufend\|pausiert\|beendet&sort=&dir=asc\|desc` | Übersicht mit Summen pro Monat, Filter und Sortierung; Vorlagen verwalten (F-32, F-35) |
| Kategorien | `GET /kategorien` | Standard-Kategorien (nur lesen) und eigene Kategorien |
| Auswertung | `GET /auswertung?monate=6\|12\|24` | Saldo je Monat, Verlauf Gesamtvermögen, Monatsvergleich (F-56, F-57) |
| Kassenzettel | `GET /buchungen/:id/beleg` | Datei zur Buchung (nur für Inhaber des Kontos) |
| CSV-Export | `GET /buchungen/export.csv` | Gefilterte Buchungen als CSV (gleiche Filter wie die Liste, `alle=1` = alle Monate) |
| Nochmal buchen | `GET /buchungen/neu?vorlage=:id` | Formular mit Werten einer bestehenden Buchung (F-26) |
| Profil | `GET/POST /profil` | Darstellungsmodus, Passwort ändern |
| Darstellung | `POST /einstellungen/darstellung` | Theme speichern (vom Umschalter per `fetch`, ohne JS als Formular) |
| Handbuch | `GET /handbuch`, `/handbuch/:seite`, `/handbuch?suche=…` | Handbuch aus `docs/wiki` (F-07), auch ohne Anmeldung |
| Health-Check | `GET /health` | `{"status":"ok"}` – für Docker/Monitoring, ohne Login |

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
| CSS | **Pico.css** (fertiges Stylesheet, über npm installiert) + eigene `theme.css` mit den Farben aus 10.7 | Ordentliche, responsive Oberfläche ohne Build-Schritt; später anpassbar |
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
 services/      ← Fachlogik: Salden, Anlagenwerte, Monatsbilanz, Transfers, Sichtbarkeit, wiederkehrende Buchungen
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
- Hochgeladene Dateien (Kassenzettel) liegen in `data/uploads/` unter zufälligen Namen (`<uuid>.<endung>`); die Speicherschicht bietet dafür `saveFile`, `filePath`, `removeFile`. Der Dateityp wird am Inhalt erkannt, nicht an Endung oder Browserangabe. Ausgeliefert werden Kassenzettel nur an Inhaber des Kontos (`GET /buchungen/:id/beleg`).
- **Migrationen** (`src/storage/migrations.js`) passen bestehende Daten beim Start einmalig an neue Felder an; erledigte Migrationen stehen in `meta.json` (`migrations_done`).
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
- Sitzungen werden in `data/sessions.json` gespeichert (eigener kleiner Store), damit man nach einem Neustart des Servers nicht abgemeldet ist. Gültigkeit: 30 Tage.
- Alle Formulare angemeldeter Nutzer tragen ein CSRF-Token (Formularfeld `_csrf` oder Header `X-CSRF-Token`).
- **Login-Bremse:** Nach 5 Fehlversuchen je IP-Adresse und Nutzername muss gewartet werden (30 s, danach jeweils verdoppelt, höchstens 15 min). Zusätzlich höchstens 30 Fehlversuche je IP-Adresse in 15 min. Antwort dann `429` mit Wartezeit.
- Fehlermeldung beim Login immer neutral: „Nutzername oder Passwort falsch“.
- **Sicherheits-Header** auf allen Seiten: strenge Content-Security-Policy (nur eigene Skripte, Styles und Bilder; keine Inline-Skripte oder -Styles), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`; bei `COOKIE_SECURE=true` zusätzlich HSTS.
- Rücksprungziele nach Formularen werden nur als interne Pfade akzeptiert (kein Open Redirect).
- CSV-Export entschärft Zellen, die wie Tabellenformeln beginnen (`=`, `+`, `-`, `@`).

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
│   │   ├── seed.js           ← Startdaten (Standard-Kategorien) beim ersten Start
│   │   └── json/             ← JSON-Adapter
│   ├── repositories/         ← users, accounts, transactions, recurring, assets, …
│   ├── services/             ← balances, assets, monthly, transfers, visibility, recurring, auth
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
│   ├── css/                  ← theme.css (Farben), eigene Ergänzungen
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
| `SESSION_SECRET` | zufällig, in `data/.session-secret` | Schlüssel zum Signieren des Session-Cookies. Ist er nicht gesetzt, wird beim ersten Start ein zufälliger Schlüssel im Datenordner abgelegt |
| `COOKIE_SECURE` | `false` | Auf `true` setzen, sobald die Seite über HTTPS läuft (aktiviert auch HSTS) |
| `TRUST_PROXY` | `false` | Hinter einem Reverse Proxy: Anzahl der Proxys (z. B. `1`) oder Adressbereiche. Nötig, damit die Login-Bremse die echte IP sieht |
| `ASSET_STALE_MONTHS` | `6` | Ab so vielen Monaten ohne manuellen Stand gilt eine Anlage als „veraltet“ (F-44) |
| `NODE_ENV` | – | `production` aktiviert Template-Cache und Browser-Caching statischer Dateien (im Docker-Image gesetzt) |
| `TZ` | Systemzeit | Zeitzone, z. B. `Europe/Berlin` – bestimmt, wann „heute“ ist (regelmäßige Buchungen) |

### 10.7 Gestaltung und Farben

- Grundlage ist **Pico.css** (klassenloses Stylesheet): Formulare, Tabellen und Navigation sehen ohne eigene CSS-Klassen ordentlich aus und sind responsive.
- Pico wird über npm installiert und von Express aus `node_modules` ausgeliefert (**kein CDN**, die Seite funktioniert auch ohne Internet).
- Alle Farben stehen als CSS-Variablen in **einer** Datei `public/css/theme.css`, die nach Pico geladen wird. Spätere Anpassungen passieren nur dort.
- Hell- und Dunkelmodus: Standard ist „Automatisch“ (folgt der Systemeinstellung). Über den Umschalter (☾/☀) in der Navigation wählt jeder Nutzer Hell oder Dunkel; die Wahl wird gespeichert (`users.theme`) und als `data-theme` am `<html>`-Element gesetzt. Für beide Modi ist jede Farbe festgelegt.
- **Diagramme** werden auf dem Server als SVG erzeugt (keine Bibliothek, kein Inline-Skript). Jedes Diagramm zeigt **eine** Datenreihe; Farbe kommt aus der Palette, Beschriftungen in Textfarbe, Werte zusätzlich per Tooltip und in einer Tabelle. Einnahmen/Ausgaben werden nicht als Rot/Grün-Paar gegenübergestellt (bei Rot-Grün-Sehschwäche nicht unterscheidbar); der Monatssaldo zeigt das Vorzeichen über die Lage zur Nulllinie.
- Farbe ist nie das einzige Merkmal: Beträge haben immer ein Vorzeichen (`+` / `−`), Buchungsarten zusätzlich ein Symbol oder Text.

**Farbpalette**

| Rolle | Variable | Hell | Dunkel | Verwendung |
|-------|----------|------|--------|------------|
| Primärfarbe | `--hh-primary` | `#0f766e` (Petrol) | `#2dd4bf` | Navigation, Buttons, Links (überschreibt `--pico-primary`) |
| Einnahme | `--hh-income` | `#15803d` (Grün) | `#4ade80` | Positive Beträge, Einnahmen |
| Ausgabe | `--hh-expense` | `#b91c1c` (Rot) | `#f87171` | Negative Beträge, Ausgaben |
| Transfer | `--hh-transfer` | `#475569` (Schiefergrau) | `#94a3b8` | Transfers zwischen eigenen Konten |
| Anlage | `--hh-asset` | `#6d28d9` (Violett) | `#a78bfa` | Anlagen, Sparraten, „In Anlagen gespart“ |
| Hinweis | `--hh-warning` | `#b45309` (Bernstein) | `#fbbf24` | Hinweise, z. B. veralteter Anlagenstand |

### 10.8 Betrieb mit Docker

- `Dockerfile`: Basis `node:24-alpine`, nur Produktionsabhängigkeiten (`npm ci --omit=dev`), läuft als unprivilegierter Nutzer `node` (UID 1000), `NODE_ENV=production`.
- Daten liegen im Volume `/app/data` (JSON-Dateien, Sicherungen, Sitzungen, Session-Schlüssel).
- Health-Check über `GET /health`.
- `docker-compose.yml` zieht das fertige Image `ghcr.io/moritzrohleder/haushaltsprojekt` (`pull_policy: always`, Version über `HAUSHALT_VERSION`), fester Projektname `haushaltsprojekt` für ein stabiles Volume, `restart: unless-stopped`, Einstellungen aus `.env` (Vorlage `.env.example`).
- Beim Stoppen (`SIGTERM`) nimmt der Server keine neuen Anfragen an, schließt laufende Schreibzugriffe ab und sichert die Sitzungen.
- HTTPS übernimmt ein vorgeschalteter Reverse Proxy (z. B. Caddy); dann `COOKIE_SECURE=true` und `TRUST_PROXY=1` setzen. Anleitung im README.

### 10.9 CI/CD

| Workflow | Auslöser | Inhalt |
|----------|----------|--------|
| `ci.yml` | jeder Push, Pull Requests auf `master` | `npm test` mit Node 22 und 24; Docker-Image bauen, Container starten, `/health` und `/handbuch` prüfen |
| `release.yml` | Release veröffentlicht | Tag `vX.Y.Z` muss zu `package.json` passen; Tests; Image für `linux/amd64` und `linux/arm64` bauen und nach ghcr.io laden mit Tags `X.Y.Z`, `X.Y`, `X` und `latest` (Vorabversionen ohne `latest`) |

- `master` wird per Ruleset geschützt: Änderungen nur per Pull Request, die CI-Checks müssen grün sein.
- Der Server aktualisiert sich über `docker compose up -d` (z. B. per Cron nachts und nach dem Neustart).

### 10.10 Handbuch

- Quelle ist `docs/wiki/` im Repository: eine Markdown-Datei pro Kapitel, `Handbuch.md` als Inhaltsseite, `_Sidebar.md` (Reihenfolge und Titel der Kapitel) und `_Footer.md` (Handbuch-Stand und passende App-Version).
- Die Anwendung liest diese Dateien direkt (Bibliothek `marked`), schreibt Wiki-Links (`Konten`, `Anlagen#abschnitt`) auf `/handbuch/…` um und erzeugt Anker wie GitHub. Die Navigationszeile am Seitenende der Wiki-Seiten ersetzt sie durch eigene Vor/Zurück-Knöpfe.
- Das GitHub-Wiki wird manuell aus `docs/wiki/` befüllt (Copy & Paste oder per Git). Abweichungen sind über den Handbuch-Stand im Fußtext erkennbar.
- Ein Test prüft, dass alle Kapitel existieren und alle internen Links auf vorhandene Seiten und Abschnitte zeigen.

## 11. Nicht-funktionale Anforderungen

| ID | Anforderung |
|----|-------------|
| N-01 | **Sprache** der Oberfläche: Deutsch. |
| N-02 | **Responsive**: auf dem Smartphone nutzbar, vor allem das Erfassen von Buchungen und Anlage-Ständen. |
| N-03 | **Sicherheit**: Ausgaben in EJS escaped (`<%= %>`, nie `<%- %>` für Nutzereingaben); serverseitige Validierung aller Formulare; Sichtbarkeit (Kapitel 4) wird bei **jedem** Zugriff im Server geprüft, nicht nur in der Oberfläche. |
| N-04 | **Datenkonsistenz**: Transfer-Paare und andere zusammengehörige Änderungen nur über `transaction()` der Speicherschicht; Verweise (z. B. `account_id`) werden vor dem Speichern geprüft. |
| N-05 | **Betrieb**: Start mit `npm start`; läuft lokal oder auf einem kleinen Server im Heimnetz (z. B. Raspberry Pi / NAS). Bei Erreichbarkeit aus dem Internet nur über HTTPS (z. B. per Reverse Proxy). Da die Registrierung dauerhaft offen ist, kann sich dann jeder ein Konto anlegen; er sieht aber nur seine eigenen Daten, die Standard-Kategorien und beim Hinzufügen von Inhabern die Liste der Nutzernamen. |
| N-06 | **Datensicherung**: Der Ordner `data/` ist das Einzige, was gesichert werden muss. |
| N-07 | **Performance**: Für Haushaltsgröße (einige tausend Buchungen pro Jahr) ausgelegt; Seitenaufbau < 500 ms. Dafür reicht es, alle Daten im Arbeitsspeicher zu halten. |
| N-08 | **Testbarkeit**: Berechnungsregeln (Kapitel 6), Sichtbarkeitsregeln (Kapitel 4), wiederkehrende Buchungen und der JSON-Adapter sind durch automatisierte Tests abgedeckt. |

## 12. Abgrenzung (nicht im ersten Release)

- Keine direkte Bankanbindung (FinTS/HBCI, PSD2-APIs), keine automatischen Kurse für Fonds.
- Keine Budgets/Sparziele (Kandidat für später).
- Keine Mehrwährungsfähigkeit.
- Keine Kreditkarten mit Abrechnung/Monatsausgleich. Prepaid-Karten werden als normales Konto (Typ `prepaid`) geführt.
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
| E-02 | Transfers | Ein Transfer zwischen zwei Konten besteht aus zwei verknüpften Buchungen, eine pro Konto. |
| E-03 | Transfers in der Bilanz | Sieht der Nutzer beide Seiten, zählt der Transfer nicht zur Monatsbilanz der Gesamtübersicht, steht aber in der Kontoübersicht. Sieht er nur eine Seite, ist es für ihn eine normale Buchung (Einnahme bzw. Ausgabe). |
| E-04 | Transfer-Ziel | Als Quelle und Ziel eines Transfers sind nur selbst sichtbare Konten/Anlagen wählbar. Alles andere ist eine Buchung (Ausgabe). |
| E-05 | Berechtigungen | Alle Inhaber eines Kontos/einer Anlage dürfen alles anlegen, ändern und löschen. |
| E-06 | Kategorien | Es gibt eine Standard-Liste für alle; zusätzlich kann jeder Nutzer eigene Kategorien anlegen. |
| E-07 | Wiederkehrende Buchungen | Beim Anlegen einer Buchung als „regelmäßig“ markierbar. Rhythmus = Anzahl + Einheit (Tag, Woche, Monat, Jahr), bei Monat/Jahr mit festem Tag bzw. Tag und Monat. Nach dem Anlegen wird automatisch gebucht, ohne Bestätigung. |
| E-08 | Anlagen | Fonds, Bausparverträge usw. werden als Anlagen ohne eigene Buchungen geführt. Einzahlungen (z. B. Sparrate) werden automatisch auf den letzten Stand aufaddiert; der Gesamtwert kann jederzeit manuell überschrieben werden. |
| E-09 | Gemeinschaftskonten | Alle Inhaber sehen das Konto vollständig; der volle Kontostand zählt zur Gesamtübersicht jedes Inhabers. |
| E-10 | Datenhaltung | Lokal als JSON-Dateien, keine Datenbank. Zugriff nur über eine austauschbare Speicherschicht. |
| E-11 | Versionen | Jeweils die aktuellen Versionen von Node.js (LTS), Express und EJS. |
| E-12 | Login | Einfacher Login mit Nutzername und Passwort; Nutzer registrieren sich selbst. |
| E-13 | Lizenz | GNU GPL v3. |
| E-14 | Standard-Kategorien | Werden beim ersten Start vom Code als Startdaten erzeugt und danach direkt in der JSON-Datei gepflegt. |
| E-15 | Kreditkarten | Vorerst nicht unterstützt; Prepaid-Karten sind normale Konten. |
| E-16 | Styling | Fertiges Stylesheet (Pico.css), später anpassbar; Grundfarben werden von Anfang an festgelegt (10.7). |
| E-17 | Registrierung | Dauerhaft offen. |
| E-18 | Farben | Die Farbpalette aus 10.7 ist bestätigt. |
| E-19 | Startliste Kategorien | Die vorgeschlagene Liste (5.2) wird übernommen. |
| E-20 | Anzeige von Beträgen | Immer in Euro; Cent nur intern. |
| E-21 | Nutzername | Kein Anzeigename; der Nutzername wird überall angezeigt. |
| E-22 | Anlagen | Manuelle Aktualisierungen des Stands sind in Übersicht und Verlauf sichtbar (Datum und Korrektur). |

### 13.2 Offene Fragen

Aktuell keine.

## 14. Meilensteine

| # | Meilenstein | Inhalt |
|---|-------------|--------|
| M0 | **Spezifikation** | Dieses Dokument abstimmen, offene Fragen klären. |
| M1 | **Grundgerüst** | `package.json`, Express + EJS, Pico.css + `theme.css`, Layout/Navigation, Konfiguration, Speicherschicht mit JSON-Adapter und Startdaten inkl. Tests, `npm start`. |
| M2 | **Login** | F-01 bis F-03: Registrieren, Anmelden, Abmelden, Seitenschutz. |
| M3 | **Stammdaten** | F-10 bis F-14: Konten mit Inhabern, Standard- und eigene Kategorien. Sichtbarkeitsregeln inkl. Tests. |
| M4 | **Buchungen** | F-20 bis F-24: Einnahmen, Ausgaben, Transfer-Paare erfassen, bearbeiten, listen. |
| M5 | **Übersichten** | F-50 bis F-55, F-61: Dashboard, Monatsbilanz, Kontoübersicht, Transfers. Tests der Berechnungsregeln. |
| M6 | **Wiederkehrend & Anlagen** | F-30 bis F-34, F-40 bis F-43, F-46: regelmäßige Buchungen, Anlagen mit Ständen und Sparraten. → **MVP fertig** |
| M7 | **Komfort & Sicherheit** | F-04, F-06, F-15, F-25, F-26, F-44, F-56, F-60, CSRF-Schutz, Login-Bremse, Sicherheits-Header. |
| M8 | **Betrieb & Auswertung** | Docker (10.8), Diagramme F-45/F-57, Health-Check. |
| M8.1 | **Handbuch** | F-07: Handbuch aus `docs/wiki` in der Anwendung. |
| M8.2 | **Einkäufe** | F-27 bis F-29, F-58, F-59: Geschäft, Kassenzettel, Artikel, Auswertungen. |
| M8.3 | **Fixkosten-Überblick** | F-35: Übersicht der regelmäßigen Buchungen mit Monatswerten, Filter und Sortierung; ganzzahlige Artikelmengen. |
| M9 | **Ausbau** | CSV-Import (F-62), Budgets, weitere Auswertungen nach Bedarf. |

**Stand Version 0.1.0** (noch kein Release): M0 bis M8.3 sind umgesetzt. Offen ist nur F-62 (CSV-Import, Priorität K).

Bekannte Einschränkungen:

- Bei einem bestehenden Transfer sind nur Datum, Betrag, Beschreibung und Notiz änderbar. Für andere Konten oder Anlagen wird er gelöscht und neu angelegt.
- Regelmäßige Transfers sind nur von einem Konto aus möglich (auf ein Konto oder in eine Anlage), nicht als regelmäßige Auszahlung aus einer Anlage.
- An einer regelmäßigen Buchung sind nachträglich Betrag, Beschreibung, Notiz, Rhythmus (inkl. Tag/Monat) und Enddatum änderbar, nicht aber Konten oder Kategorie.
- Der JSON-Speicher ist für **eine** laufende Instanz gedacht (kein gleichzeitiger Betrieb mehrerer Container auf denselben Daten).

## 15. Lizenz

Das Projekt steht unter der **GNU General Public License v3.0** (siehe [`LICENSE`](LICENSE)).
In der `package.json` wird entsprechend `"license": "GPL-3.0-or-later"` eingetragen. Die ISC-Angabe aus dem alten Projekt wird **nicht** übernommen.

## 16. Änderungshistorie

| Version | Änderungen |
|---------|------------|
| v0.1 | Erster Entwurf. |
| v0.2 | Buchungen gehören zu Konten, nicht zu Nutzern; Transfer = zwei verknüpfte Buchungen; Sichtbarkeit pro Nutzer und interne/externe Transfers (Kap. 4, 6.3); Login mit Registrierung; JSON-Speicher hinter austauschbarer Speicherschicht; Express 5; Gemeinschaftskonten zählen voll; „regelmäßig“-Option mit Rhythmus beim Erfassen; neue Entität **Anlagen** mit manuell gepflegtem Stand; offene Fragen aktualisiert. |
| v0.3 | Nur eine Transfer-Hälfte sichtbar → für den Nutzer eine normale Einnahme/Ausgabe; Transfers nur zwischen selbst sichtbaren Konten/Anlagen; alle Inhaber dürfen alles; Standard-Kategorien plus eigene Kategorien je Nutzer; wiederkehrende Buchungen werden automatisch gebucht; Ein-/Auszahlungen in Anlagen (Sparraten) werden auf den letzten manuellen Stand aufaddiert (Kap. 6.3); wiederkehrende Buchungen und Anlagen sind jetzt Teil des MVP. |
| v0.4 | Standard-Kategorien werden beim ersten Start als Startdaten erzeugt und danach in der JSON-Datei gepflegt (mit Vorschlag für die Liste); Kreditkarten gestrichen, neuer Kontotyp `prepaid`; Pico.css als Stylesheet mit festgelegter Farbpalette (neues Kap. 10.7); Registrierung dauerhaft offen (F-05 und `REGISTRATION_OPEN` entfallen); Farbpalette bestätigt. |
| v0.5 | Diagramm in 5.1 neu (Verweise klar erkennbar) plus Verweistabelle; Anzeige immer in Euro, Cent nur intern; Rhythmus als Anzahl + Einheit (`interval_count`, `interval_unit`); manuelle Anlagen-Stände in Übersicht und Verlauf mit Datum und Korrektur sichtbar (F-46); kein Anzeigename mehr; Startliste der Kategorien bestätigt; keine offenen Fragen. |
| v0.5.1 | Korrektur-Definition präzisiert (Ein-/Auszahlungen desselben Tages); `SESSION_SECRET`-Fallback und `COOKIE_SECURE` ergänzt; Stand und Einschränkungen des Prototyps in Kap. 14. |
| v0.6 | Regelmäßige Buchungen: fester Tag (Monat) bzw. Tag und Monat (Jahr) über `day_of_month`/`month_of_year`; `start_date` ist das „gültig ab“-Datum; Rhythmusänderung gilt ab dem nächsten Termin. |
| v1.0 | Hell/Dunkel-Umschalter pro Nutzer (F-06, `users.theme`); ausgeblendete Standard-Kategorien (`users.hidden_category_ids`); Auswertungsseite mit Diagrammen; CSV-Export; Nochmal buchen; veraltete Anlagenstände; Login-Bremse, Sicherheits-Header, `TRUST_PROXY`, `ASSET_STALE_MONTHS`, `TZ`; Betrieb mit Docker (10.8); Meilensteine aktualisiert. |
| v1.0.1 | Ein-/Auszahlungen am selben Tag wie ein manueller Stand: Reihenfolge der Erfassung entscheidet (vorher: immer „enthalten“); negative Anlagenwerte ausdrücklich erlaubt, Vorzeichen-Auswahl Guthaben/Schulden; `1.000` wird als Tausender gelesen; angemeldete Seiten mit `Cache-Control: no-store`. |
| v1.0.2 | Manueller Stand hat immer Vorrang und gilt für den Zeitpunkt der Eingabe: kein Datumsfeld mehr bei „Stand aktualisieren“ und beim Startwert; nachgetragene Ein-/Auszahlungen mit Datum vor dem Stand gelten als enthalten; Uhrzeit der Eingabe im Verlauf. |
| v1.1 | Handbuch in der Anwendung (F-07, Kap. 10.10): Quelle `docs/wiki`, Kapitel-Navigation, Suche, „?“-Knopf mit passendem Kapitel, Stand-Vermerk über `_Footer.md`. |
| v1.1.1 | CI/CD (Kap. 10.9): Tests und Docker-Build bei jedem Push/PR, Release-Workflow veröffentlicht das Image nach ghcr.io; `docker-compose.yml` nutzt das fertige Image mit `pull_policy: always` und festem Projektnamen. |
| v1.2 | Geschäft bei Ausgaben (Pflicht bei Einkaufs-Kategorien, `categories.merchant_required`), Artikel und Kassenzettel (`transactions.merchant/items/receipt`, Dateien in `data/uploads`), Auswertungen nach Geschäft und Artikel; Migrationen für bestehende Daten. |
| v1.3 | Artikelmengen nur noch ganzzahlig (Stückzahl); Übersicht der regelmäßigen Buchungen mit Umrechnung auf einen Monat, Summen, Filtern und Sortierung (F-35, 6.7). |
