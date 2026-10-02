Die Knöpfe **+ Einnahme**, **+ Ausgabe** und **⇄ Transfer** findest du in der Übersicht, in der Buchungsliste und in jeder Kontoansicht.

## Einnahme oder Ausgabe

| Feld | Bedeutung |
|------|-----------|
| Datum | Buchungsdatum (vorbelegt mit heute) |
| Betrag in € | immer positiv eingeben |
| Konto | eines deiner Konten (zuletzt verwendetes ist vorausgewählt) |
| Kategorie | passend zur Art; optional. Kategorien mit 🛒 sind [Einkaufs-Kategorien](Kategorien#einkaufs-kategorien) |
| Geschäft | nur bei Ausgaben: wo eingekauft wurde, z. B. „Edeka“, „Hagebaumarkt“, „C&A“. **Pflicht bei 🛒-Kategorien**, sonst optional |
| Beschreibung | kurzer Text, z. B. „Wocheneinkauf“ |
| Notiz | optional |
| Kassenzettel und Artikel | nur bei Ausgaben, optional – siehe unten |
| Regelmäßig | siehe [Regelmäßige Buchungen](Regelmäßige-Buchungen) |

Beim Tippen ins Feld **Geschäft** schlägt Haushalt die Geschäfte vor, die du schon einmal eingetragen hast – so bleibt die Schreibweise einheitlich und die Auswertung nach Geschäft stimmt.

- **Speichern** speichert und zeigt die Buchungsliste des Monats.
- **Speichern & weitere erfassen** speichert und öffnet sofort ein leeres Formular – praktisch zum Nachtragen mehrerer Belege.

## Kassenzettel und Artikel

Unter **Kassenzettel und Artikel** (aufklappen) kannst du zu einer Ausgabe festhalten, was genau gekauft wurde. Beides ist optional und lässt sich kombinieren.

**Kassenzettel**

- Ein Foto (JPG, PNG, WebP, HEIC) oder ein PDF, höchstens 15 MB. Auf dem Handy kannst du direkt die Kamera wählen.
- In der Buchungsliste zeigt **🧾** an, dass ein Kassenzettel vorhanden ist – ein Klick öffnet ihn.
- Beim Bearbeiten ersetzt eine neue Datei den bisherigen Kassenzettel; mit **Kassenzettel entfernen** löschst du ihn.
- Kassenzettel sehen nur die Inhaber des Kontos. Sie werden mit der Buchung gelöscht.

**Artikel**

| Spalte | Bedeutung |
|--------|-----------|
| Artikel | Name, z. B. „Milch 1,5 %“ |
| Menge | Stückzahl als ganze Zahl, z. B. `2` (leer = 1) |
| Stückpreis € | Preis pro Stück |
| Summe | wird berechnet: Menge × Stückpreis |

- Mit **+ Artikel** fügst du eine Zeile hinzu, mit **✕** entfernst du sie.
- **Pfand oder Rabatt** trägst du als eigene Zeile mit negativem Preis ein, z. B. „Pfand“ mit `-0,25`.
- Der **Betrag** der Ausgabe wird nicht automatisch geändert. Weicht die Summe der Artikel davon ab, zeigt Haushalt einen Hinweis – praktisch zum Kontrollieren.
- Wie oft du einen Artikel gekauft hast und zu welchem Preis, siehst du in der [Auswertung](Übersicht-und-Auswertung#artikel).

Bei **regelmäßigen** Buchungen gibt es keine Kassenzettel und Artikel, weil sie zu einem einzelnen Einkauf gehören. Das Geschäft wird dagegen übernommen.

## Buchung bearbeiten oder löschen

Klicke in einer Buchungsliste auf **✎**. Dort kannst du alle Werte ändern oder die Buchung **löschen**.

## Nochmal buchen

Im Bearbeiten-Formular gibt es den Link **↻ Nochmal buchen**. Er öffnet ein neues Formular mit denselben Werten (inklusive Geschäft und Artikeln, ohne Kassenzettel) und dem heutigen Datum – ideal für Buchungen, die sich unregelmäßig wiederholen.

## Buchungsliste und Filter

Unter **Buchungen** in der Navigation findest du die Buchungen eines Monats. Filter:

| Filter | Wirkung |
|--------|---------|
| Monat | welcher Monat angezeigt wird |
| Alle Monate | hebt die Monatsgrenze auf |
| Konto | nur Buchungen eines Kontos |
| Kategorie | nur Buchungen einer Kategorie |
| Art | Einnahmen, Ausgaben oder Transfers |
| Geschäft | nur Ausgaben bei einem bestimmten Geschäft |
| Suche | sucht in Beschreibung, Notiz, Gegenseite, Geschäft und Artikeln |

## CSV-Export

**⤓ Als CSV exportieren** lädt genau die gefilterten Buchungen als CSV-Datei herunter. Die Datei öffnet sich direkt in Excel oder LibreOffice (Semikolon als Trenner, Komma als Dezimalzeichen). Spalten: Datum, Konto, Art, Kategorie / Gegenseite, Geschäft, Beschreibung, Notiz, Betrag, Artikel, Kassenzettel (ja/nein), Regelmäßig.

---

[← Kategorien](Kategorien) · [Inhalt](Handbuch) · [Transfers →](Transfers)
