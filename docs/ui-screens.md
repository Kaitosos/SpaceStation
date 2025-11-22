# UI Screens

Dieses Dokument bietet einen schnellen Überblick über die vier wichtigsten Screens und nennt Einstiegspunkte in die UI-Logik, damit Änderungen an Navigation oder Widgets zielgerichtet erfolgen können. Der aktive Screen wird über `GameState.screen` gesteuert (`'mainMenu' | 'build' | 'personnel' | 'personDetail'`).【F:src/types.ts†L196-L211】 Die Umschaltung läuft zentral über die Menü- und Tab-Handler in `src/ui.ts` (z.B. `openMenu`, `resumeGame`, Tab-Klicks).【F:src/ui.ts†L1073-L1103】【F:src/ui.ts†L1149-L1233】

## Build-Screen
- **Zweck:** Module platzieren und den Stationsgrundriss verwalten.
- **Zentrale UI-Elemente:**
  - **Build-Menü** mit Typ-Filter und Auswahl-Buttons aus `renderBuildMenu`, das `BUILDING_TYPES` nutzt und die gewählte Bauoption in `game.selectedBuildingTypeId` hält.【F:src/ui.ts†L272-L384】 
  - **Grid** aus `renderGrid`, das den aktuellen `game.grid`-Zustand inklusive platzierter Module visualisiert.【F:src/ui.ts†L386-L446】
  - **Platzierung** via Grid-Click-Delegation, die `placeBuildingAt` aufruft, wenn `game.screen === 'build'`.【F:src/ui.ts†L1221-L1231】
- **Relevante Datenquellen:** `game.grid`, `game.modules`, `game.selectedBuildingTypeId`, `BUILDING_TYPES`.

## Personnel-Screen
- **Zweck:** Module und Personal im Überblick verwalten.
- **Zentrale UI-Elemente:**
  - **Modulliste** aus `renderModuleList`, inklusive Modus-Schalter (`moduleViewModeSelect` → `moduleListMode`) für Gruppierung nach Typen oder Aufgaben sowie Aktivieren/Deaktivieren von Modulen über `toggleModuleActive`.【F:src/ui.ts†L486-L520】【F:src/ui.ts†L660-L683】
  - **Personenliste** aus `renderPeopleList` mit Freitextfilter (`peopleFilterInput`), Umschalter „Unzugewiesen“ (`unassignedFilterBtn`) und Kontextaktionen wie Detailansicht oder Zuordnung zum ausgewählten Modul.【F:src/ui.ts†L689-L760】
- **Relevante Datenquellen:** `game.modules` (inkl. `selectedModuleId`), `game.people`, Filterzustände `peopleFilterTerm` und `showUnassignedOnly`.

## Personendetails
- **Zweck:** Einzelne Person inspizieren und Schulungen anstoßen.
- **Zentrale UI-Elemente:**
  - Detailpanel aus `renderPersonDetail`, das Status, Qualifikationen, persönliche Daten und laufende Schulungen rendert; Trainingsstart nutzt `startTraining` und respektiert verfügbare Qualifikationen.【F:src/ui.ts†L689-L760】【F:src/ui.ts†L860-L932】
  - Zurück-Navigation über den „Zurück“-Button (`personDetailBackBtn`), der `game.screen` auf `'personnel'` setzt.【F:src/ui.ts†L1199-L1214】
- **Relevante Datenquellen:** `game.selectedPersonId`, `game.people`, `game.qualifications`.

## Hauptmenü
- **Zweck:** Pause-Overlay für Spielstandsverwaltung und globale Aktionen.
- **Zentrale UI-Elemente:**
  - Menü-Overlay-Steuerung aus `renderMenuOverlay`, die UI-Inhalte sperrt, wenn `game.screen === 'mainMenu'` oder `game.paused` aktiv ist.【F:src/ui.ts†L1073-L1103】
  - Buttons zum Fortsetzen/Öffnen (`menuToggleBtn` → `resumeGame`/`openMenu`), Neuspiel (`startNewGame`), Laden/Speichern (Slot-Auswahl via `renderSaveSlots`) und noch nicht implementierte Optionen.【F:src/ui.ts†L1149-L1199】【F:src/ui.ts†L1004-L1072】
- **Relevante Datenquellen:** `game.screen`, `game.paused`, Speicher-Slots aus `storage.ts` (`getSaveSlotInfo`, `loadGameStateFromSlot`, `saveGameStateToSlot`).
