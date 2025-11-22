# SpaceStation Config Editor (Dev Only)

This standalone editor is only intended for development. It reuses the game's existing `src/config.ts` and `src/types.ts` and does not ship in the production build.

## Build
1. Install dependencies once (if not already):
   ```bash
   npm install
   ```
2. Build the editor bundle (outputs to `devtools/config-editor/dist/`):
   ```bash
   npm run build:devtool
   ```

## Run locally
Open `devtools/config-editor/index.html` in your browser after building. The page loads `dist/configEditor.js` generated in the build step.

> Tip: If you prefer a local server, `npx http-server devtools/config-editor` (or any static server) works; the editor remains dev-only and separate from the production game build.

## Bedienung
Die Oberfläche ist in fünf Tabs gegliedert: **Ressourcen**, **Gebäude**, **Qualifikationen**, **Events** und **Übersetzungen**. Jeder Tab zeigt die jeweils relevanten Datensätze in Tabellenform; Detailfelder erscheinen in der rechten Spalte, sobald ein Eintrag gewählt oder angelegt wird.

### Clone-/Save-Flow
- **Clone** dupliziert den aktuell ausgewählten Datensatz innerhalb des aktiven Tabs inklusive aller Felder.
- **Save** schreibt Änderungen zurück in die Arbeitskopie der Konfiguration und stößt sofort die Validierung an.
- Änderungen sind erst persistent, nachdem die finale Konfigurationsdatei exportiert oder committet wurde; bis dahin kann jederzeit weiter editiert werden.

### Validierung und Quickfixes
- Nach jedem Speichern läuft eine Validierung, die Warnungen in einer Liste unterhalb der Editorfläche anzeigt.
- Wo möglich werden **Quickfix**-Buttons eingeblendet, die den markierten Datensatz oder eine Referenz automatisch korrigieren (z. B. fehlende Übersetzungsschlüssel anlegen oder ungültige Verweise entfernen).
- Warnungen lassen sich anklicken, um direkt zum betroffenen Datensatz zu springen.

### Schrittfolgen
- **Neue Ressource anlegen:** Im Tab *Ressourcen* auf **Add** klicken, ID und Anzeige-Name eintragen, Speicherort/Startwerte setzen, dann **Save** drücken. Fehlende Übersetzungsschlüssel lassen sich über angebotene Quickfixes sofort ergänzen.
- **Neues Gebäude anlegen:** Im Tab *Gebäude* **Add** wählen, Basisdaten (ID, Name, Kosten, Output) ausfüllen und mit **Save** sichern. Ressourcenreferenzen sollten mit bestehenden IDs übereinstimmen, sonst meldet die Validierung eine Warnung mit Quickfix-Vorschlag.
- **Bedingung setzen (Condition Wizard):** In Tabs mit Bedingungen (z. B. Gebäude oder Events) das Bedingungsfeld öffnen, **Condition Wizard** wählen und die gewünschte Bedingungsart (Ressourcen, Qualifikationen oder Event-Status) konfigurieren. Speichern schließt den Wizard und übernimmt die strukturierte Bedingung in den Datensatz.
- **Validierungswarnung beheben:** Auf die Warnung klicken, um den betroffenen Datensatz zu öffnen. Entweder manuell korrigieren oder, falls vorhanden, den zugehörigen **Quickfix** nutzen (z. B. fehlenden Übersetzungseintrag automatisch erzeugen). Anschließend erneut **Save** ausführen, um sicherzustellen, dass die Warnung verschwindet.
