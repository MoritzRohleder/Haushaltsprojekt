# Handbuch

Dieses Handbuch beschreibt die Bedienung von **Haushalt** (Version 1.0.2): wie du Konten, Buchungen, regelmäßige Buchungen und Anlagen erfasst und wie die Übersichten zu lesen sind.

> Für die Installation und den Betrieb auf einem Server siehe das [README im Repository](https://github.com/MoritzRohleder/Haushaltsprojekt#readme).

## Inhalt

1. [Erste Schritte](#1-erste-schritte)
2. [Die Oberfläche](#2-die-oberfläche)
3. [Konten](#3-konten)
4. [Kategorien](#4-kategorien)
5. [Buchungen erfassen](#5-buchungen-erfassen)
6. [Transfers](#6-transfers)
7. [Regelmäßige Buchungen](#7-regelmäßige-buchungen)
8. [Anlagen](#8-anlagen)
9. [Übersicht, Monat und Auswertung](#9-übersicht-monat-und-auswertung)
10. [Buchungsliste und CSV-Export](#10-buchungsliste-und-csv-export)
11. [Profil und Darstellung](#11-profil-und-darstellung)
12. [Häufige Fragen](#12-häufige-fragen)
13. [Begriffe](#13-begriffe)

---

## 1. Erste Schritte

### Registrieren

1. Öffne die Adresse von Haushalt im Browser (z. B. `http://localhost:3000` oder die Adresse deines Servers).
2. Klicke auf **Registrieren**.
3. Wähle einen **Nutzernamen** (3–32 Zeichen: Buchstaben, Ziffern, Punkt, Unterstrich, Bindestrich) und ein **Passwort** mit mindestens 8 Zeichen.
4. Nach dem Registrieren bist du direkt angemeldet.

Jede Person im Haushalt legt sich einen eigenen Zugang an. Der Nutzername ist gleichzeitig der Name, der überall angezeigt wird.

### Anmelden und Abmelden

- **Anmelden** mit Nutzername und Passwort. Groß- und Kleinschreibung spielt beim Nutzernamen keine Rolle.
- Du bleibst 30 Tage angemeldet, auch wenn der Server neu startet.
- **Abmelden** über deinen Nutzernamen oben rechts → **Abmelden**.
- Nach mehreren falschen Passwörtern hintereinander musst du kurz warten, bevor du es erneut versuchen kannst. Die Wartezeit wird angezeigt.

### Die ersten drei Schritte

1. **Konto anlegen** – z. B. dein Girokonto mit dem aktuellen Kontostand (siehe [Konten](#3-konten)).
2. **Gemeinsame Konten** anlegen und die anderen Personen als Inhaber hinzufügen.
3. **Regelmäßige Buchungen** wie Gehalt, Miete und Sparraten einmal erfassen – danach bucht Haushalt sie automatisch (siehe [Regelmäßige Buchungen](#7-regelmäßige-buchungen)).

---

## 2. Die Oberfläche

Die Navigation oben enthält:

| Eintrag | Inhalt |
|---------|--------|
| **Übersicht** | Kontostände, Anlagen, Gesamtvermögen, aktueller Monat, letzte Buchungen |
| **Monat** | Monatsbilanz mit Aufteilung nach Kategorie und Konto, Transfers |
| **Buchungen** | Liste aller Buchungen mit Filtern und CSV-Export |
| **Konten** | Alle deine Konten mit Kontostand |
| **Anlagen** | Fonds, Bausparverträge usw. mit aktuellem Wert |
| **Auswertung** | Saldo je Monat, Verlauf des Gesamtvermögens, Monatsvergleich |
| ☾ / ☀ | Zwischen hellem und dunklem Modus umschalten |
| *dein Nutzername* | Regelmäßige Buchungen, Kategorien, Profil, Abmelden |

### Farben und Zeichen

| Farbe | Bedeutung |
|-------|-----------|
| Grün | Einnahmen |
| Rot | Ausgaben |
| Grau | Transfers zwischen deinen eigenen Konten |
| Violett | Anlagen, Sparraten, „In Anlagen gespart“ |
| Bernstein | Hinweise, z. B. „Stand veraltet“ |

Beträge haben immer ein Vorzeichen (`+` / `−`), die Farbe ist nur eine zusätzliche Hilfe. Der farbige Streifen am Anfang einer Tabellenzeile zeigt die Art der Buchung. Das Symbol **↻** markiert Buchungen, die aus einer regelmäßigen Buchung entstanden sind.

### Beträge eingeben

Beträge gibst du immer in Euro ein. Diese Schreibweisen funktionieren:

| Eingabe | Ergebnis |
|---------|----------|
| `12,50` | 12,50 € |
| `1.234,56` | 1.234,56 € |
| `1.000` | 1.000,00 € |
| `1234.56` | 1.234,56 € |

Bei Buchungen gibst du den Betrag immer **positiv** ein – ob er abgezogen oder gutgeschrieben wird, ergibt sich aus der Art (Einnahme, Ausgabe, Transfer). Bei Werten, die negativ sein können (Anfangssaldo, Anlagenstand), wählst du unter dem Feld **Guthaben** oder **Schulden** – praktisch auf dem Handy, wo die Zahlentastatur oft kein Minus hat.

---

## 3. Konten

Ein Konto ist ein Ort, an dem Geld liegt und auf den gebucht wird: Girokonto, Sparkonto, Tagesgeld, Bargeld, Prepaid-Karte oder Sonstiges.

### Konto anlegen

**Konten** → **+ Neues Konto** (oder in der Übersicht **+ Konto**):

| Feld | Bedeutung |
|------|-----------|
| Name | z. B. „Girokonto“, „Gemeinsames Konto“, „Bargeld“ |
| Typ | Girokonto, Sparkonto, Bargeld, Prepaid-Karte, Sonstiges |
| Anfangssaldo | Kontostand laut Bank zum Stichtag; mit **Guthaben** / **im Minus** |
| Stichtag | Ab diesem Tag rechnet Haushalt. Buchungen davor sind nicht möglich |
| IBAN | optional, nur zur Information |
| Inhaber | Wer das Konto sieht und bearbeiten darf |

**Tipp:** Nimm als Stichtag den Monatsersten und als Anfangssaldo den Kontostand laut Bank an diesem Tag. Danach erfasst du alle Buchungen ab diesem Datum.

### Gemeinschaftskonten und Inhaber

- Ein Konto kann **einen oder mehrere Inhaber** haben. Wähle beim Anlegen oder Bearbeiten unter **Inhaber** alle Personen aus.
- **Alle Inhaber sehen alles** auf dem Konto und dürfen alles ändern: Konto bearbeiten, Buchungen erfassen, ändern und löschen, Inhaber hinzufügen oder entfernen.
- Jeder Inhaber sieht den **vollen** Kontostand eines Gemeinschaftskontos in seiner Übersicht.
- Ein Konto, dessen Inhaber du nicht bist, siehst du gar nicht.

### Kontoansicht

Ein Klick auf den Kontonamen zeigt alle Buchungen des Kontos (inklusive Transfers) mit **laufendem Saldo**, also dem Kontostand nach jeder Buchung. Von hier kannst du direkt eine Einnahme, Ausgabe oder einen Transfer für dieses Konto erfassen.

### Archivieren und löschen

- **Archivieren** blendet ein Konto aus den Auswahllisten und der Übersicht aus, die Buchungen bleiben erhalten. Archivierte Konten findest du unter **Konten** → „Archivierte Konten“ und kannst sie dort **wiederherstellen**.
- **Löschen** geht nur, wenn auf dem Konto keine Buchungen und keine regelmäßigen Buchungen liegen. Sonst archiviere es.

---

## 4. Kategorien

Kategorien ordnen Einnahmen und Ausgaben ein, z. B. „Gehalt“, „Lebensmittel“, „Wohnen“. Du findest sie über deinen Nutzernamen → **Kategorien**.

- **Standard-Kategorien** gibt es für alle Nutzer. Brauchst du eine davon nicht, klicke auf **Ausblenden** – sie wird dir dann beim Erfassen nicht mehr angeboten. Mit **Einblenden** holst du sie zurück.
- **Eigene Kategorien** legst du unter „Eigene Kategorie anlegen“ an (Name und Art: Einnahme oder Ausgabe). Sie sind nur für dich sichtbar. Du kannst sie umbenennen, archivieren oder – wenn sie nicht verwendet werden – löschen.
- Transfers haben keine Kategorie.

---

## 5. Buchungen erfassen

Die Knöpfe **+ Einnahme**, **+ Ausgabe** und **⇄ Transfer** findest du in der Übersicht, in der Buchungsliste und in jeder Kontoansicht.

### Einnahme oder Ausgabe

| Feld | Bedeutung |
|------|-----------|
| Datum | Buchungsdatum (vorbelegt mit heute) |
| Betrag in € | immer positiv eingeben |
| Konto | eines deiner Konten (zuletzt verwendetes ist vorausgewählt) |
| Kategorie | passend zur Art; optional |
| Beschreibung | kurzer Text, z. B. „Wocheneinkauf“ |
| Notiz | optional |
| Regelmäßig | siehe [Regelmäßige Buchungen](#7-regelmäßige-buchungen) |

- **Speichern** speichert und zeigt die Buchungsliste des Monats.
- **Speichern & weitere erfassen** speichert und öffnet sofort ein leeres Formular – praktisch zum Nachtragen mehrerer Belege.

### Buchung bearbeiten oder löschen

Klicke in einer Buchungsliste auf **✎**. Dort kannst du alle Werte ändern oder die Buchung **löschen**.

### Nochmal buchen

Im Bearbeiten-Formular gibt es den Link **↻ Nochmal buchen**. Er öffnet ein neues Formular mit denselben Werten und dem heutigen Datum – ideal für Buchungen, die sich unregelmäßig wiederholen.

---

## 6. Transfers

Ein Transfer verschiebt Geld zwischen **deinen eigenen** Konten oder zwischen einem Konto und einer Anlage.

### Transfer erfassen

**⇄ Transfer** → Datum, Betrag, **Von** und **Nach**, Beschreibung. Zur Auswahl stehen nur Konten und Anlagen, die du selbst siehst.

- **Konto → Konto**: Auf beiden Konten entsteht je eine Buchung (Abgang und Eingang).
- **Konto → Anlage** (Einzahlung, z. B. Sparrate): Das Konto sinkt, der Wert der Anlage steigt.
- **Anlage → Konto** (Auszahlung): Der Wert der Anlage sinkt, das Konto steigt.

> **Geld an ein Konto, das du nicht siehst** (z. B. das Privatkonto deines Partners), erfasst du als **Ausgabe**. Die andere Person erfasst den Eingang bei sich als **Einnahme**.

### Transfer bearbeiten und löschen

- Bearbeiten und Löschen wirkt immer auf **beide Seiten** eines Transfers.
- Änderbar sind Datum, Betrag, Beschreibung und Notiz. Willst du ein anderes Konto oder eine andere Anlage, lösche den Transfer und lege ihn neu an.
- Jeder Inhaber eines der beiden Konten darf den Transfer ändern oder löschen.

### Wer sieht was?

Beispiel: Anna hat „Giro Anna“, Ben hat „Giro Ben“, beide teilen sich „Gemeinsam“. Anna überweist 500 € von „Giro Anna“ auf „Gemeinsam“.

| | Anna | Ben |
|---|---|---|
| Sieht | beide Seiten | nur den Eingang auf „Gemeinsam“ |
| Ist für sie/ihn | ein **Transfer** zwischen eigenen Konten | eine **Einnahme** („Übertrag von Giro Anna“) |
| Monatsbilanz | zählt nicht | +500 € bei den Einnahmen (Kategorie „Überträge“) |

---

## 7. Regelmäßige Buchungen

Gehalt, Miete, Abos, Versicherungen oder Sparraten erfasst du einmal als regelmäßige Buchung – Haushalt bucht sie danach **automatisch**, ohne Rückfrage.

### Anlegen

Erfasse eine Einnahme, Ausgabe oder einen Transfer wie gewohnt und schalte **Regelmäßig** ein:

| Feld | Bedeutung |
|------|-----------|
| Alle … | Anzahl, z. B. `1`, `3`, `20` |
| Einheit | Tage, Wochen, Monate oder Jahre |
| Am Tag | nur bei Monaten und Jahren: fester Tag, z. B. `20` für „am 20.“ |
| Im Monat | nur bei Jahren: fester Monat, z. B. Oktober für „am 01.10.“ |
| Enddatum | optional – danach wird nicht mehr gebucht |

Das **Datum** oben im Formular ist das **Startdatum**: Der erste Termin ist der erste passende Tag ab diesem Datum.

**Beispiele**

| Gewünscht | Einstellung |
|-----------|-------------|
| Miete jeden Monat am 3. | Alle `1` Monate, am Tag `3` |
| Gehalt jeden Monat am Monatsletzten | Alle `1` Monate, am Tag `31` |
| Versicherung vierteljährlich am 15. | Alle `3` Monate, am Tag `15` |
| Kfz-Versicherung jedes Jahr am 01.10. | Alle `1` Jahre, am Tag `1`, im Monat Oktober |
| Alle 20 Tage | Alle `20` Tage |

- Gibt es den Tag in einem Monat nicht (z. B. der 31. im April), wird der **Monatsletzte** genommen.
- Liegt das Startdatum in der Vergangenheit, werden alle bisherigen Termine sofort **rückwirkend** gebucht.
- Lässt du „Am Tag“ leer, gilt der Tag des Startdatums.

### Verwalten

Über deinen Nutzernamen → **Regelmäßige Buchungen** siehst du alle Vorlagen mit Rhythmus und **nächstem Termin**.

- **✎ Bearbeiten**: Betrag, Beschreibung, Notiz, Rhythmus und Enddatum ändern. Änderungen gelten **ab dem nächsten Termin** – bereits gebuchte Termine bleiben unverändert, und im laufenden Monat wird nichts doppelt gebucht.
- **Pausieren / Fortsetzen**: Während der Pause wird nichts gebucht. Beim Fortsetzen werden die Termine aus der Pause **nicht** nachgeholt.
- **Löschen** (im Bearbeiten-Formular): Die Vorlage verschwindet, bereits gebuchte Termine bleiben erhalten.
- Eine einzelne automatisch erzeugte Buchung kannst du wie jede andere Buchung ändern oder löschen, ohne die Vorlage zu verändern. Eine gelöschte Einzelbuchung wird nicht erneut erzeugt.

---

## 8. Anlagen

Anlagen sind Vermögenswerte, die nicht wie ein Konto geführt werden: **Fonds, Depot, Bausparvertrag, Versicherung** oder Sonstiges. Sie haben keine eigenen Buchungen, sondern einen **Stand**, den du von Zeit zu Zeit aktualisierst.

### Anlage anlegen

**Anlagen** → **+ Neue Anlage**: Name, Art, Anbieter (optional), **aktueller Stand**, Notiz und Inhaber.

- Der Stand kann **Guthaben** oder **Schulden** sein – z. B. ein Bauspardarlehen mit negativem Stand.
- Inhaber funktionieren wie bei Konten: Alle Inhaber sehen die Anlage und dürfen alles ändern.

### Wie der Wert berechnet wird

> **Ein manuell eingetragener Stand hat immer Vorrang. Er ist der Stand zum Zeitpunkt der Eingabe.**

- Wenn du einen Stand einträgst, ersetzt er sofort den bisher berechneten Wert – inklusive aller bis dahin erfassten Ein- und Auszahlungen.
- **Danach** erfasste Ein- und Auszahlungen (z. B. die monatliche Sparrate) werden automatisch auf den Stand aufaddiert bzw. abgezogen.
- Trägst du nach dem Stand eine Einzahlung nach, die auf einen Tag **vor** dem Stand datiert ist, gilt sie als schon im Stand enthalten. Auf dem Konto wird sie trotzdem gebucht.
- Bei negativem Stand (Schulden) verringern Einzahlungen die Schulden.

**Beispiel**

| Wann | Was | Wert der Anlage |
|------|-----|-----------------|
| 01.09. | Anlage angelegt mit Stand 10.000 € | 10.000 € |
| 15.09. | Sparrate 200 € (automatisch) | 10.200 € |
| 15.10. | Sparrate 200 € (automatisch) | 10.400 € |
| 20.10. | Stand laut Depot eingetragen: 10.350 € | **10.350 €** (Korrektur −50 €) |
| 15.11. | Sparrate 200 € (automatisch) | 10.550 € |

### Sparrate einrichten

Auf der Seite der Anlage → **Einzahlung / Sparrate** (oder **⇄ Transfer** mit der Anlage als „Nach“), **Regelmäßig** einschalten, z. B. alle 1 Monate am Tag 15. Ab dann wird jeden Monat automatisch vom Konto abgebucht und auf die Anlage aufaddiert.

### Stand aktualisieren

Gerade bei Fonds ändert sich der Wert ständig. Trage den aktuellen Wert ein, wann immer du ihn kennst:

1. In der Übersicht oder in der Anlagenliste **Stand aktualisieren** (oder auf der Seite der Anlage).
2. **Aktuellen Gesamtwert** eingeben, Guthaben oder Schulden wählen, optional eine Notiz (z. B. „laut Depotauszug“).
3. **Speichern** – fertig. Es gibt kein Datumsfeld: Der Stand gilt für jetzt.

### Anlage im Blick

- Die Übersicht und die Anlagenliste zeigen, **wann** der Stand zuletzt manuell eingetragen wurde und um wie viel er vom berechneten Wert abwich (**Korrektur**).
- Ist der letzte manuelle Stand älter als 6 Monate, erscheint der Hinweis **⚠ Stand veraltet** – Zeit, den aktuellen Wert einzutragen.
- Die Seite einer Anlage zeigt den **Wertverlauf** als Diagramm und eine Tabelle aller Stände (mit Datum und Uhrzeit) und Ein-/Auszahlungen. Manuelle Stände lassen sich dort mit **✕** löschen.

---

## 9. Übersicht, Monat und Auswertung

### Übersicht

| Bereich | Inhalt |
|---------|--------|
| Konten | Summe aller deiner Kontostände (Gemeinschaftskonten mit vollem Betrag) |
| Anlagen | Summe der aktuellen Werte deiner Anlagen |
| Gesamtvermögen | Konten + Anlagen |
| Aktueller Monat | Einnahmen, Ausgaben, Saldo, In Anlagen gespart |
| Letzte Buchungen | die zuletzt gebuchten Einträge |

Jede Person sieht nur ihre eigenen Konten und Anlagen. Weil Gemeinschaftskonten bei allen Inhabern voll zählen, ergibt die Summe der Gesamtvermögen mehrerer Personen **nicht** das Haushaltsvermögen.

### Monatsübersicht

**Monat** zeigt den aktuellen Monat; mit **← Vormonat** und **Folgemonat →** blätterst du.

| Wert | Bedeutung |
|------|-----------|
| Einnahmen | alle Einnahmen des Monats auf deinen Konten |
| Ausgaben | alle Ausgaben des Monats auf deinen Konten |
| Saldo | Einnahmen minus Ausgaben |
| In Anlagen gespart | Einzahlungen minus Auszahlungen bei deinen Anlagen |

**Was zählt zur Bilanz?**

- **Transfers zwischen deinen eigenen Konten und Anlagen zählen nicht** – das Geld bleibt ja bei dir. Sie stehen in der Liste „Transfers“.
- Siehst du von einem Transfer **nur eine Seite** (z. B. Eingang auf dem Gemeinschaftskonto vom Privatkonto deines Partners), zählt sie für dich als normale **Einnahme** bzw. **Ausgabe** und erscheint unter der Kategorie **„Überträge“**.

Darunter findest du die Aufteilung **nach Kategorie** (als Balken), **nach Konto** und alle Buchungen des Monats.

### Auswertung

**Auswertung** zeigt die letzten **6, 12 oder 24 Monate**:

- **Saldo je Monat**: Säulen über der Linie bedeuten Überschuss, darunter Defizit.
- **Gesamtvermögen**: Konten und Anlagen jeweils zum Monatsende.
- **Monatsvergleich**: Tabelle mit Einnahmen, Ausgaben, Saldo, In Anlagen gespart und Gesamtvermögen. Ein Klick auf den Monat öffnet die Monatsübersicht.

Fährst du mit der Maus über eine Säule oder einen Punkt im Diagramm, siehst du die genauen Werte.

---

## 10. Buchungsliste und CSV-Export

**Buchungen** zeigt die Buchungen eines Monats. Filter:

| Filter | Wirkung |
|--------|---------|
| Monat | welcher Monat angezeigt wird |
| Alle Monate | hebt die Monatsgrenze auf |
| Konto | nur Buchungen eines Kontos |
| Kategorie | nur Buchungen einer Kategorie |
| Art | Einnahmen, Ausgaben oder Transfers |
| Suche | sucht in Beschreibung, Notiz und Gegenseite |

**⤓ Als CSV exportieren** lädt genau die gefilterten Buchungen als CSV-Datei herunter. Die Datei öffnet sich direkt in Excel oder LibreOffice (Semikolon als Trenner, Komma als Dezimalzeichen). Spalten: Datum, Konto, Art, Kategorie / Gegenseite, Beschreibung, Notiz, Betrag, Regelmäßig.

---

## 11. Profil und Darstellung

### Hell- und Dunkelmodus

- Mit dem Knopf **☾ / ☀** in der Navigation wechselst du sofort zwischen hellem und dunklem Modus.
- Die Wahl wird für deinen Nutzer gespeichert und gilt auf allen Geräten.
- Unter **Profil** → **Darstellung** kannst du auch **Automatisch (wie System)** wählen – dann folgt Haushalt der Einstellung deines Geräts.

### Passwort ändern

Über deinen Nutzernamen → **Profil** → **Passwort ändern**: aktuelles Passwort und zweimal das neue (mindestens 8 Zeichen).

---

## 12. Häufige Fragen

**Mein Kontostand stimmt nicht mit der Bank überein.**
Prüfe Anfangssaldo und Stichtag des Kontos und ob alle Buchungen seit dem Stichtag erfasst sind. Eine Differenz kannst du mit einer Einnahme oder Ausgabe „Korrektur“ ausgleichen.

**Ich habe Geld an meinen Partner überwiesen. Warum kann ich sein Konto nicht als Ziel wählen?**
Transfers gehen nur zwischen Konten, die du selbst siehst. Erfasse die Überweisung als **Ausgabe**; dein Partner erfasst sie als **Einnahme**.

**Warum zählt ein Transfer bei meinem Partner als Einnahme?**
Sieht jemand nur eine Seite eines Transfers, ist es für ihn eine normale Buchung – das Geld kommt aus seiner Sicht ja von außen. Siehe [Wer sieht was?](#wer-sieht-was).

**Die Sparrate taucht nicht in meinen Ausgaben auf.**
Richtig – eine Einzahlung in eine eigene Anlage ist ein Transfer, kein Verbrauch. Sie steht in der Monatsübersicht unter **In Anlagen gespart**.

**Ich habe einen Stand eingetragen und danach eine ältere Sparrate nachgetragen – der Anlagenwert ändert sich nicht.**
Ein manueller Stand beschreibt den Wert zum Zeitpunkt der Eingabe; ältere Einzahlungen sind darin schon enthalten. Siehe [Wie der Wert berechnet wird](#wie-der-wert-berechnet-wird).

**Eine regelmäßige Buchung wurde nicht gebucht.**
Prüfe unter **Regelmäßige Buchungen**, ob sie pausiert ist oder ihr Enddatum erreicht hat. Ist das Konto archiviert, wird ebenfalls nicht gebucht.

**Wie lege ich eine Kreditkarte an?**
Kreditkarten mit monatlicher Abrechnung werden nicht unterstützt. Eine Prepaid-Karte legst du als Konto vom Typ „Prepaid-Karte“ an.

**Kann ich Kontoauszüge importieren?**
Noch nicht. Buchungen werden von Hand erfasst; regelmäßige Buchungen nehmen dir den größten Teil ab.

**„Das Formular ist abgelaufen.“**
Lade die Seite neu und sende das Formular erneut. Das passiert z. B., wenn du dich in der Zwischenzeit ab- und wieder angemeldet hast.

---

## 13. Begriffe

| Begriff | Bedeutung |
|---------|-----------|
| **Konto** | Ort, an dem Geld liegt und gebucht wird (Girokonto, Bargeld, …) |
| **Inhaber** | Person, die ein Konto oder eine Anlage sieht und bearbeiten darf |
| **Gemeinschaftskonto** | Konto mit mehreren Inhabern |
| **Buchung** | Eine Geldbewegung auf genau einem Konto: Einnahme, Ausgabe oder Transfer |
| **Transfer** | Geld zwischen eigenen Konten oder zwischen Konto und Anlage verschieben |
| **Übertrag** | Eine Transfer-Seite, deren Gegenseite du nicht siehst – zählt für dich als Einnahme bzw. Ausgabe |
| **Regelmäßige Buchung** | Vorlage, aus der Buchungen automatisch im eingestellten Rhythmus entstehen |
| **Anlage** | Fonds, Depot, Bausparvertrag usw. mit manuell gepflegtem Stand |
| **Stand** | Manuell eingetragener Gesamtwert einer Anlage, gilt für den Zeitpunkt der Eingabe |
| **Korrektur** | Abweichung eines neuen Stands vom bis dahin berechneten Wert |
| **Saldo** | Einnahmen minus Ausgaben eines Monats |
| **Gesamtvermögen** | Summe deiner Kontostände und Anlagenwerte |
| **Stichtag** | Tag, ab dem ein Konto geführt wird |
