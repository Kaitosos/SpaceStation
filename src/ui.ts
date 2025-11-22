// src/ui.ts
import { createInitialGameState } from './core.js';
import { DataPoint, EventOption, GameState, ResourceDelta, ModuleState, Person } from './types.js';
import { BUILDING_TYPES } from './config.js';
import { placeBuildingAt, toggleModuleActive, getModuleById, rebuildGridFromModules } from './buildings.js';
import { assignPersonToModule, hasRequiredQualifications, removePersonFromModule, startTraining } from './workforce.js';
import { translateValue } from './translationTables.js';
import { loadGameStateFromSlot, saveGameStateToSlot, getSaveSlotInfo, SaveSlotInfo } from './storage.js';
import { recalcResourceMaximums } from './resources.js';

let hudEl: HTMLElement;
let mainEl: HTMLElement;
let resourcesEl: HTMLElement;
let timeDisplayEl: HTMLElement;
let buildMenuEl: HTMLElement;
let gridEl: HTMLElement;
let logEl: HTMLElement;
let popupEl: HTMLElement;
let popupTitleEl: HTMLElement;
let popupMessageEl: HTMLElement;
let popupOptionsEl: HTMLElement;
let moduleCardsEl: HTMLElement;
let peopleCardsEl: HTMLElement;
let buildScreenEl: HTMLElement;
let personnelScreenEl: HTMLElement;
let personDetailScreenEl: HTMLElement;
let tabBuildBtn: HTMLButtonElement;
let tabPersonnelBtn: HTMLButtonElement;
let menuToggleBtn: HTMLButtonElement;
let menuOverlayEl: HTMLElement;
let menuResumeBtn: HTMLButtonElement;
let menuNewBtn: HTMLButtonElement;
let menuLoadBtn: HTMLButtonElement;
let menuSaveBtn: HTMLButtonElement;
let menuOptionsBtn: HTMLButtonElement;
let slotSelectEl: HTMLSelectElement;
let slotListEl: HTMLElement;
let slotTimestampEl: HTMLElement;
let peopleFilterInput: HTMLInputElement;
let unassignedFilterBtn: HTMLButtonElement;
let moduleViewModeSelect: HTMLSelectElement;
let personDetailHeaderEl: HTMLElement;
let personDetailBodyEl: HTMLElement;
let personDetailBackBtn: HTMLButtonElement;
let onChooseEventOption: ((option: EventOption) => void) | null = null;
let selectedBuildTypeFilter: string | 'all' = 'all';
let lastTimeDisplay = '';
let peopleFilterTerm = '';
let moduleListMode: 'modules' | 'tasks' = 'modules';
let showUnassignedOnly = false;
let lastGameplayScreen: Exclude<GameState['screen'], 'mainMenu'> = 'build';
const SAVE_SLOT_IDS = ['slot-1', 'slot-2', 'slot-3'];
let selectedSaveSlot = SAVE_SLOT_IDS[0];
let slotLoadErrorLogged = false;
const resourceRows = new Map<
  string,
  {
    container: HTMLElement;
    nameSpan: HTMLElement;
    valueSpan: HTMLElement;
    deltaSpan: HTMLElement;
    lastValueText: string;
    lastDeltaText: string;
  }
>();
let lastBuildMenuState: string | null = null;
let lastPopupState: string | null = null;
let lastGridSize: { width: number; height: number } | null = null;
const gridCellEls = new Map<string, HTMLElement>();
const buildingTypeMap = new Map(BUILDING_TYPES.map((b) => [b.id, b]));

function resetUiCaches(): void {
  resourceRows.clear();
  resourcesEl.innerHTML = '';
  buildMenuEl.innerHTML = '';
  gridEl.innerHTML = '';
  moduleCardsEl.innerHTML = '';
  peopleCardsEl.innerHTML = '';
  personDetailBodyEl.innerHTML = '';
  lastBuildMenuState = null;
  lastPopupState = null;
  lastGridSize = null;
  lastTimeDisplay = '';
  gridCellEls.clear();
}

function formatTimestamp(ms: number | null): string {
  if (!ms) return 'Leer';
  const date = new Date(ms);
  return date.toLocaleString('de-DE');
}

function applyNewGameState(game: GameState, nextState: GameState): void {
  resetUiCaches();
  selectedBuildTypeFilter = 'all';
  showUnassignedOnly = false;
  peopleFilterTerm = '';
  moduleListMode = 'modules';
  if (peopleFilterInput) {
    peopleFilterInput.value = '';
  }
  if (unassignedFilterBtn) {
    unassignedFilterBtn.classList.remove('active');
  }
  if (moduleViewModeSelect) {
    moduleViewModeSelect.value = moduleListMode;
  }
  Object.assign(game, nextState);
  rebuildGridFromModules(game);
  recalcResourceMaximums(game);
  lastGameplayScreen = game.screen === 'mainMenu' ? 'build' : game.screen;
  game.screen = lastGameplayScreen;
  game.paused = false;
}

function openMenu(game: GameState): void {
  if (game.screen !== 'mainMenu' && game.screen !== undefined) {
    if (game.screen === 'build' || game.screen === 'personnel' || game.screen === 'personDetail') {
      lastGameplayScreen = game.screen;
    }
  }
  game.screen = 'mainMenu';
  game.paused = true;
}

function resumeGame(game: GameState): void {
  game.paused = false;
  game.screen = lastGameplayScreen;
}

function startNewGame(game: GameState): void {
  const fresh = createInitialGameState();
  applyNewGameState(game, fresh);
  game.messages.push('Neues Spiel gestartet.');
}

function saveCurrentSlot(game: GameState): void {
  try {
    saveGameStateToSlot(selectedSaveSlot, game);
    const info = getSaveSlotInfo(selectedSaveSlot);
    game.messages.push(
      `Spielstand in ${slotLabel(selectedSaveSlot)} gespeichert (${formatTimestamp(info.savedAt ?? null)}).`,
    );
  } catch (error) {
    console.error('Speichern fehlgeschlagen:', error);
    game.messages.push('Speichern fehlgeschlagen. Siehe Konsole für Details.');
  }
  renderAll(game);
}

function loadSelectedSlot(game: GameState): void {
  try {
    const loaded = loadGameStateFromSlot(selectedSaveSlot);
    if (!loaded) {
      game.messages.push(`${slotLabel(selectedSaveSlot)} ist leer oder konnte nicht gelesen werden.`);
      renderAll(game);
      return;
    }
    applyNewGameState(game, loaded);
    const info = getSaveSlotInfo(selectedSaveSlot);
    const timeLabel = formatTimestamp(info.savedAt ?? null);
    game.messages.push(`Spielstand aus ${slotLabel(selectedSaveSlot)} geladen (${timeLabel}).`);
  } catch (error) {
    console.error('Laden fehlgeschlagen:', error);
    game.messages.push('Laden fehlgeschlagen. Siehe Konsole für Details.');
  }
  renderAll(game);
}

function formatDelta(d: number): string {
  if (!d) return '±0/Tick';
  const sign = d > 0 ? '+' : '';
  const abs = Math.abs(d);
  const rounded = abs < 0.1 ? d.toFixed(2) : d.toFixed(1);
  return `${sign}${rounded}/Tick`;
}

function formatResourceDeltaList(deltas: ResourceDelta[]): string {
  if (!deltas.length) return 'Keine direkten Änderungen';
  return deltas
    .map((d) => {
      const sign = d.amount > 0 ? '+' : '';
      return `${sign}${d.amount} ${d.resource}`;
    })
    .join(', ');
}

function qualificationTitle(game: GameState, code: string): string {
  return game.qualifications.find((q) => q.code === code)?.title || code;
}

function renderResources(game: GameState): void {
  const seen = new Set<string>();
  for (const name in game.resources) {
    const r = game.resources[name];
    const existing = resourceRows.get(name);

    if (!r.enabled) {
      if (existing) {
        resourcesEl.removeChild(existing.container);
        resourceRows.delete(name);
      }
      continue;
    }

    const valueText = r.max !== undefined ? `${r.current.toFixed(0)} / ${r.max.toFixed(0)}` : r.current.toFixed(0);
    const deltaText = `(${formatDelta(r.deltaPerTick)})`;
    let row = existing;

    if (!row) {
      const div = document.createElement('div');
      div.className = 'resource';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'resource-name';
      nameSpan.textContent = name.toUpperCase();

      const valueSpan = document.createElement('span');
      valueSpan.className = 'resource-value';
      valueSpan.textContent = valueText;

      const deltaSpan = document.createElement('span');
      deltaSpan.className = 'resource-delta';
      deltaSpan.textContent = deltaText;
      if (r.deltaPerTick > 0.001) deltaSpan.classList.add('delta-positive');
      else if (r.deltaPerTick < -0.001) deltaSpan.classList.add('delta-negative');

      div.appendChild(nameSpan);
      div.appendChild(valueSpan);
      div.appendChild(deltaSpan);
      resourcesEl.appendChild(div);

      row = {
        container: div,
        nameSpan,
        valueSpan,
        deltaSpan,
        lastValueText: valueText,
        lastDeltaText: deltaText,
      };
      resourceRows.set(name, row);
    } else {
      if (row.lastValueText !== valueText) {
        row.valueSpan.textContent = valueText;
        row.lastValueText = valueText;
      }
      if (row.lastDeltaText !== deltaText) {
        row.deltaSpan.textContent = deltaText;
        row.deltaSpan.classList.toggle('delta-positive', r.deltaPerTick > 0.001);
        row.deltaSpan.classList.toggle('delta-negative', r.deltaPerTick < -0.001);
        row.lastDeltaText = deltaText;
      }
    }

    seen.add(name);
  }

  for (const [name, row] of resourceRows.entries()) {
    if (!seen.has(name)) {
      resourcesEl.removeChild(row.container);
      resourceRows.delete(name);
    }
  }

  const timeText = `Ticks: ${game.ticks} | Tage: ${game.days}`;
  if (lastTimeDisplay !== timeText) {
    timeDisplayEl.textContent = timeText;
    lastTimeDisplay = timeText;
  }
}

function renderBuildMenu(game: GameState): void {
  const availableTypes = BUILDING_TYPES.filter((t) => t.enabled);
  const typeFilters = Array.from(new Set(availableTypes.map((t) => t.type))).sort();
  if (selectedBuildTypeFilter !== 'all' && !typeFilters.includes(selectedBuildTypeFilter)) {
    selectedBuildTypeFilter = 'all';
  }

  const filterBar = document.createElement('div');
  filterBar.className = 'build-filter';
  const filterLabel = document.createElement('label');
  filterLabel.textContent = 'Typ:';
  const filterSelect = document.createElement('select');
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'Alle';
  filterSelect.appendChild(allOption);
  for (const t of typeFilters) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    filterSelect.appendChild(opt);
  }
  filterSelect.value = selectedBuildTypeFilter;
  filterSelect.addEventListener('change', (ev) => {
    selectedBuildTypeFilter = (ev.target as HTMLSelectElement).value as typeof selectedBuildTypeFilter;
    if (
      selectedBuildTypeFilter !== 'all' &&
      game.selectedBuildingTypeId &&
      BUILDING_TYPES.find((b) => b.id === game.selectedBuildingTypeId && b.type === selectedBuildTypeFilter)
    ) {
      renderBuildMenu(game);
      return;
    }
    if (selectedBuildTypeFilter !== 'all' && game.selectedBuildingTypeId) {
      game.selectedBuildingTypeId = null;
    }
    renderBuildMenu(game);
  });
  filterLabel.appendChild(filterSelect);
  filterBar.appendChild(filterLabel);

  const filteredTypes = availableTypes.filter(
    (t) => selectedBuildTypeFilter === 'all' || t.type === selectedBuildTypeFilter,
  );

  const buildMenuState = JSON.stringify({
    selectedBuildTypeFilter,
    selectedBuildingTypeId: game.selectedBuildingTypeId,
    availableTypes: availableTypes.map((t) => t.id).sort(),
    filteredTypes: filteredTypes.map((t) => t.id).sort(),
  });

  if (buildMenuState === lastBuildMenuState) {
    return;
  }

  lastBuildMenuState = buildMenuState;

  buildMenuEl.innerHTML = '';
  const header = document.createElement('h2');
  header.textContent = 'Module';
  buildMenuEl.appendChild(header);

  buildMenuEl.appendChild(filterBar);

  for (const type of filteredTypes) {
    const btn = document.createElement('button');
    btn.className = 'card card--clickable build-card';
    if (game.selectedBuildingTypeId === type.id) {
      btn.classList.add('card--active');
    }

    const nameDiv = document.createElement('h3');
    nameDiv.className = 'card__title';
    nameDiv.textContent = type.name;

    const metaDiv = document.createElement('div');
    metaDiv.className = 'card__meta';
    metaDiv.textContent = `Typ: ${type.type} • Größe: ${type.size.width}x${type.size.height}`;

    const costDiv = document.createElement('div');
    costDiv.className = 'card__meta';
    costDiv.textContent =
      'Kosten: ' +
      (type.cost.length
        ? type.cost.map((c) => `${c.amount} ${c.resource}`).join(', ')
        : 'keine');

    const descDiv = document.createElement('div');
    descDiv.className = 'card__meta build-desc';
    descDiv.textContent = type.description;

    const imageDiv = document.createElement('div');
    imageDiv.className = 'build-image';
    if (type.image) {
      imageDiv.style.backgroundImage = `url(${type.image})`;
    }

    btn.appendChild(nameDiv);
    btn.appendChild(metaDiv);
    btn.appendChild(costDiv);
    btn.appendChild(descDiv);
    btn.appendChild(imageDiv);

    btn.addEventListener('click', () => {
      game.selectedBuildingTypeId =
        game.selectedBuildingTypeId === type.id ? null : type.id;
      renderBuildMenu(game);
    });

    buildMenuEl.appendChild(btn);
  }
}

function renderGrid(game: GameState): void {
  const grid = game.grid;
  const sizeChanged =
    !lastGridSize || lastGridSize.width !== grid.width || lastGridSize.height !== grid.height;

  if (sizeChanged) {
    gridEl.innerHTML = '';
    gridCellEls.clear();
    lastGridSize = { width: grid.width, height: grid.height };
    (gridEl as HTMLElement).style.gridTemplateColumns = `repeat(${grid.width}, 26px)`;
  }

  for (const cell of grid.cells) {
    const key = `${cell.x},${cell.y}`;
    let div = gridCellEls.get(key);

    if (!div) {
      div = document.createElement('div');
      div.dataset.x = String(cell.x);
      div.dataset.y = String(cell.y);
      gridCellEls.set(key, div);
      gridEl.appendChild(div);
    }

    const prevTypeId = div.dataset.buildingTypeId || null;
    const prevIsRoot = div.dataset.isRoot === 'true';
    const changed = prevTypeId !== (cell.buildingTypeId || null) || prevIsRoot !== !!cell.isRoot;

    if (changed || sizeChanged) {
      const classes = ['cell'];
      if (!cell.buildingTypeId) {
        classes.push('empty');
      } else {
        classes.push(`building-${cell.buildingTypeId}`);
      }
      div.className = classes.join(' ');
      div.dataset.buildingTypeId = cell.buildingTypeId || '';
      div.dataset.isRoot = cell.isRoot ? 'true' : 'false';

      if (cell.buildingTypeId) {
        const type = BUILDING_TYPES.find((t) => t.id === cell.buildingTypeId);
        if (type) {
          div.textContent = cell.isRoot ? type.shortName : '';
          if (type.image) {
            div.style.backgroundImage = `url(${type.image})`;
            div.style.backgroundSize = 'cover';
            div.style.backgroundPosition = 'center';
            div.style.backgroundRepeat = 'no-repeat';
          }
        } else {
          div.textContent = '?';
          div.style.backgroundImage = '';
        }
      } else {
        div.textContent = '';
        div.style.backgroundImage = '';
      }
    }
  }
}

function renderScreenTabs(game: GameState, menuActive: boolean): void {
  const isBuild = game.screen === 'build';
  const isPersonnel = game.screen === 'personnel';
  const isPersonDetail = game.screen === 'personDetail';

  if (menuActive) {
    buildScreenEl.classList.remove('active');
    personnelScreenEl.classList.remove('active');
    personDetailScreenEl.classList.remove('active');
  } else {
    buildScreenEl.classList.toggle('active', isBuild);
    personnelScreenEl.classList.toggle('active', isPersonnel);
    personDetailScreenEl.classList.toggle('active', isPersonDetail);
  }

  tabBuildBtn.classList.toggle('active', isBuild && !menuActive);
  tabPersonnelBtn.classList.toggle('active', (isPersonnel || isPersonDetail) && !menuActive);
  tabBuildBtn.disabled = menuActive;
  tabPersonnelBtn.disabled = menuActive;
}

function personCanWorkInModule(person: Person, module: ModuleState): boolean {
  return person.unavailableFor <= 0 && hasRequiredQualifications(person, module);
}

function personMatchesFilter(person: Person, filter: string, game: GameState): boolean {
  const query = filter.trim().toLowerCase();
  if (!query) return true;

  const module = person.work ? getModuleById(game, person.work) : null;
  const moduleName = module ? buildingTypeMap.get(module.typeId)?.name || module.typeId : '';
  const qualificationTitles = person.qualifications.map((code) => qualificationTitle(game, code));
  return (
    person.name.toLowerCase().includes(query) ||
    moduleName.toLowerCase().includes(query) ||
    qualificationTitles.some((t) => t.toLowerCase().includes(query))
  );
}

function renderModuleList(game: GameState): void {
  moduleCardsEl.innerHTML = '';
  if (moduleViewModeSelect && moduleViewModeSelect.value !== moduleListMode) {
    moduleViewModeSelect.value = moduleListMode;
  }
  if (!game.modules.length) {
    const empty = document.createElement('div');
    empty.className = 'card card__meta';
    empty.textContent = 'Noch keine Module gebaut.';
    moduleCardsEl.appendChild(empty);
    return;
  }

  if (moduleListMode === 'tasks') {
    renderModuleTaskList(game);
    return;
  }

  const groups = new Map<string, ModuleState[]>();
  for (const mod of game.modules) {
    const arr = groups.get(mod.typeId) || [];
    arr.push(mod);
    groups.set(mod.typeId, arr);
  }

  if (!game.selectedModuleId && game.modules.length) {
    game.selectedModuleId = game.modules[0].id;
  }

  const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
    const typeA = buildingTypeMap.get(a[0])?.name || a[0];
    const typeB = buildingTypeMap.get(b[0])?.name || b[0];
    return typeA.localeCompare(typeB);
  });

  for (const [typeId, mods] of sortedGroups) {
    const type = buildingTypeMap.get(typeId);
    const card = document.createElement('div');
    card.className = 'card module-card module-group';
    const header = document.createElement('div');
    header.className = 'card__header';
    header.textContent = `${type?.name || typeId} (${mods.length})`;

    const activeCount = mods.filter((m) => m.active).length;
    const slotTotal = mods.reduce((sum, m) => sum + (m.workerMax ?? 0), 0);
    const usedSlots = mods.reduce((sum, m) => sum + m.workers.length, 0);
    const status = document.createElement('span');
    status.className = 'card__meta';
    status.textContent = `${activeCount}/${mods.length} aktiv • Slots: ${usedSlots}/${slotTotal}`;
    header.appendChild(status);
    card.appendChild(header);

    const rows = document.createElement('div');
    rows.className = 'module-group-rows';

    for (const mod of mods) {
      const row = document.createElement('div');
      row.className = 'module-row';
      row.classList.toggle('card--active', game.selectedModuleId === mod.id);
      row.classList.toggle('inactive', !mod.active);

      const title = document.createElement('div');
      title.className = 'module-row-title';
      title.textContent = `#${mod.id} • Position ${mod.x}/${mod.y}`;

      const workerMeta = document.createElement('div');
      workerMeta.className = 'card__meta';
      const workerNames = mod.workers
        .map((id) => game.people.find((p) => p.id === id)?.name)
        .filter(Boolean);
      const qualBadges = [...mod.requiredQualifications, ...mod.bonusQualifications].map(
        (code) => qualificationTitle(game, code),
      );
      const qualText = qualBadges.length ? ` • ${qualBadges.join(', ')}` : '';
      workerMeta.textContent = `Slots: ${mod.workers.length}/${mod.workerMax ?? 0}${qualText}`;

      const workerLine = document.createElement('div');
      workerLine.className = 'card__meta';
      workerLine.textContent = workerNames.length ? `Arbeiter: ${workerNames.join(', ')}` : 'Keine zugewiesen';

      const actions = document.createElement('div');
      actions.className = 'card__actions module-row-actions';

      const selectBtn = document.createElement('button');
      selectBtn.className = 'btn btn--ghost';
      selectBtn.textContent = 'Wählen';
      selectBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        game.selectedModuleId = mod.id;
        renderAll(game);
      });

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'btn btn--ghost';
      toggleBtn.textContent = mod.active ? 'Deaktivieren' : 'Aktivieren';
      toggleBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        toggleModuleActive(game, mod.id);
        renderAll(game);
      });

      actions.appendChild(selectBtn);
      actions.appendChild(toggleBtn);

      row.appendChild(title);
      row.appendChild(workerMeta);
      row.appendChild(workerLine);
      row.appendChild(actions);

      row.addEventListener('click', () => {
        game.selectedModuleId = mod.id;
        renderAll(game);
      });

      rows.appendChild(row);
    }

    card.appendChild(rows);
    moduleCardsEl.appendChild(card);
  }
}

function renderModuleTaskList(game: GameState): void {
  const modules = [...game.modules].sort((a, b) => {
    const typeA = buildingTypeMap.get(a.typeId)?.name || a.typeId;
    const typeB = buildingTypeMap.get(b.typeId)?.name || b.typeId;
    const typeCompare = typeA.localeCompare(typeB);
    if (typeCompare !== 0) return typeCompare;
    return a.id.localeCompare(b.id);
  });

  for (const mod of modules) {
    const type = buildingTypeMap.get(mod.typeId);
    const card = document.createElement('div');
    card.className = 'card card--clickable module-card module-task-card';
    card.classList.toggle('card--active', game.selectedModuleId === mod.id);
    card.classList.toggle('inactive', !mod.active);

    const header = document.createElement('div');
    header.className = 'card__header';
    header.textContent = `${type?.name || mod.typeId} (#${mod.id})`;

    const status = document.createElement('span');
    status.className = 'card__meta';
    const freeSlots = Math.max((mod.workerMax ?? 0) - mod.workers.length, 0);
    status.textContent = `${mod.active ? 'Aktiv' : 'Inaktiv'} • Freie Slots: ${freeSlots}/${mod.workerMax}`;
    header.appendChild(status);
    card.appendChild(header);

    const location = document.createElement('div');
    location.className = 'card__meta';
    location.textContent = `Position: ${mod.x}/${mod.y}`;
    card.appendChild(location);

    if (mod.requiredQualifications.length || mod.bonusQualifications.length) {
      const qualRow = document.createElement('div');
      qualRow.className = 'badge-row';
      for (const code of [...mod.requiredQualifications, ...mod.bonusQualifications]) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = qualificationTitle(game, code);
        qualRow.appendChild(badge);
      }
      card.appendChild(qualRow);
    }

    const workerLine = document.createElement('div');
    workerLine.className = 'card__meta';
    const workerNames = mod.workers
      .map((id) => game.people.find((p) => p.id === id)?.name)
      .filter(Boolean);
    workerLine.textContent = workerNames.length
      ? `Arbeiter: ${workerNames.join(', ')}`
      : 'Keine Personen zugewiesen';
    card.appendChild(workerLine);

    const actions = document.createElement('div');
    actions.className = 'card__actions module-row-actions';
    const selectBtn = document.createElement('button');
    selectBtn.className = 'btn btn--ghost';
    selectBtn.textContent = 'Auswählen';
    selectBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      game.selectedModuleId = mod.id;
      renderAll(game);
    });
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn btn--ghost';
    toggleBtn.textContent = mod.active ? 'Deaktivieren' : 'Aktivieren';
    toggleBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleModuleActive(game, mod.id);
      renderAll(game);
    });
    actions.appendChild(selectBtn);
    actions.appendChild(toggleBtn);
    card.appendChild(actions);

    card.addEventListener('click', () => {
      game.selectedModuleId = mod.id;
      renderAll(game);
    });

    moduleCardsEl.appendChild(card);
  }
}

function renderPeopleList(game: GameState): void {
  peopleCardsEl.innerHTML = '';
  if (unassignedFilterBtn) {
    unassignedFilterBtn.classList.toggle('active', showUnassignedOnly);
  }
  const selectedModule = game.modules.find((m) => m.id === game.selectedModuleId) || null;

  const filteredPeople = game.people
    .filter((p) => personMatchesFilter(p, peopleFilterTerm, game))
    .filter((p) => !showUnassignedOnly || !p.work);
  if (!filteredPeople.length) {
    const empty = document.createElement('div');
    empty.className = 'card card__meta';
    empty.textContent = 'Keine Personen passend zum Filter.';
    peopleCardsEl.appendChild(empty);
    return;
  }

  for (const person of filteredPeople) {
    const card = document.createElement('div');
    card.className = 'card card--clickable person-card';
    card.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).tagName.toLowerCase() === 'button') return;
      game.selectedPersonId = person.id;
      game.screen = 'personDetail';
      lastGameplayScreen = 'personDetail';
      renderAll(game);
    });

    const header = document.createElement('div');
    header.className = 'card__header';
    header.textContent = person.name;
    const status = document.createElement('span');
    status.className = 'person-status';
    if (person.training) {
      status.textContent = `Schulung (${person.training.remainingTicks} Ticks)`;
    } else if (person.unavailableFor > 0) {
      status.textContent = `verhindert (${person.unavailableFor} Ticks)`;
    } else if (person.work) {
      const module = game.modules.find((m) => m.id === person.work);
      const type = module ? buildingTypeMap.get(module.typeId) : null;
      status.textContent = `arbeitet in ${type?.name || module?.typeId || 'unbekannt'}`;
    } else {
      status.textContent = 'nicht zugewiesen';
    }
    header.appendChild(status);
    card.appendChild(header);

    if (person.qualifications.length) {
      const qualRow = document.createElement('div');
      qualRow.className = 'badge-row';
      for (const code of person.qualifications) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = qualificationTitle(game, code);
        qualRow.appendChild(badge);
      }
      card.appendChild(qualRow);
    }

    const needs = document.createElement('div');
    needs.className = 'card__meta';
    needs.textContent = `Bedarf: ${formatResourceDeltaList(person.needsPerTick)} | Einkommen: ${formatResourceDeltaList(
      person.incomePerTick,
    )}`;
    card.appendChild(needs);

    const detailBtn = document.createElement('button');
    detailBtn.className = 'btn btn--ghost';
    detailBtn.textContent = 'Details';
    detailBtn.addEventListener('click', () => {
      game.selectedPersonId = person.id;
      game.screen = 'personDetail';
      lastGameplayScreen = 'personDetail';
      renderAll(game);
    });
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'card__actions';
    actionsContainer.appendChild(detailBtn);

    const actionBtn = document.createElement('button');
    actionBtn.className = 'btn btn--ghost';

    if (!selectedModule) {
      actionBtn.textContent = 'Modul wählen';
      actionBtn.disabled = true;
    } else if (person.work === selectedModule.id) {
      actionBtn.textContent = 'Abziehen';
      actionBtn.addEventListener('click', () => {
        removePersonFromModule(game, person.id, selectedModule.id);
        renderAll(game);
      });
    } else {
      const canWork = personCanWorkInModule(person, selectedModule);
      const slotFree =
        selectedModule.workerMax === 0 ||
        selectedModule.workers.length < selectedModule.workerMax ||
        selectedModule.workers.includes(person.id);
      const disabled = !canWork || !slotFree;
      actionBtn.textContent = `Zu ${buildingTypeMap.get(selectedModule.typeId)?.shortName || 'Modul'}`;
      actionBtn.disabled = disabled;
      if (disabled) {
        actionBtn.title = !canWork ? 'Qualifikationen fehlen oder verhindert' : 'Keine freien Slots';
      }
      actionBtn.addEventListener('click', () => {
        const err = assignPersonToModule(game, person.id, selectedModule.id);
        if (err) {
          game.messages.push(err);
        }
        renderAll(game);
      });
    }

    actionsContainer.appendChild(actionBtn);
    card.appendChild(actionsContainer);
    peopleCardsEl.appendChild(card);
  }
}

function renderPersonDetail(game: GameState): void {
  personDetailBodyEl.innerHTML = '';
  if (!game.selectedPersonId) {
    personDetailHeaderEl.textContent = 'Keine Person ausgewählt';
    const info = document.createElement('div');
    info.className = 'card__meta';
    info.textContent = 'Wähle eine Person aus der Liste aus, um Details zu sehen.';
    personDetailBodyEl.appendChild(info);
    return;
  }

  const person = game.people.find((p) => p.id === game.selectedPersonId);
  if (!person) {
    personDetailHeaderEl.textContent = 'Unbekannte Person';
    return;
  }

  personDetailHeaderEl.textContent = person.name;

  const status = document.createElement('div');
  status.className = 'card__meta';
  const module = person.work ? getModuleById(game, person.work) : null;
  const moduleName = module ? buildingTypeMap.get(module.typeId)?.name || module.typeId : 'kein Modul';
  const statusText = person.training
    ? `In Schulung (${person.training.remainingTicks} Ticks)`
    : person.unavailableFor > 0
      ? `Verhindert (${person.unavailableFor} Ticks)`
      : person.work
        ? `Aktiv in ${moduleName}`
        : 'Nicht zugewiesen';
  status.textContent = statusText;
  personDetailBodyEl.appendChild(status);

  const balance = document.createElement('div');
  balance.className = 'card__meta';
  balance.textContent = `Bedarf: ${formatResourceDeltaList(person.needsPerTick)} | Einkommen: ${formatResourceDeltaList(
    person.incomePerTick,
  )}`;
  personDetailBodyEl.appendChild(balance);

  const dataHeader = document.createElement('div');
  dataHeader.className = 'card__meta';
  dataHeader.textContent = 'Persönliche Daten:';
  personDetailBodyEl.appendChild(dataHeader);

  const dataList = document.createElement('div');
  dataList.className = 'card';
  dataList.classList.add('card__meta');

  const renderDataPoint = (dataPoint: DataPoint): HTMLElement => {
    const row = document.createElement('div');
    row.className = 'card__meta';
    const translated = dataPoint.translationTable
      ? translateValue(dataPoint.translationTable, dataPoint.value)
      : null;
    const valueText = translated ? `${translated} (${dataPoint.value})` : String(dataPoint.value);
    row.textContent = `${dataPoint.name}: ${valueText}`;
    return row;
  };

  if (person.personalData.length) {
    person.personalData.forEach((point) => dataList.appendChild(renderDataPoint(point)));
  } else {
    const row = document.createElement('div');
    row.className = 'card__meta';
    row.textContent = 'Keine persönlichen Daten hinterlegt.';
    dataList.appendChild(row);
  }

  personDetailBodyEl.appendChild(dataList);

  const qualRow = document.createElement('div');
  qualRow.className = 'badge-row';
  if (person.qualifications.length) {
    for (const code of person.qualifications) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = qualificationTitle(game, code);
      qualRow.appendChild(badge);
    }
  } else {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = 'Keine Qualifikationen';
    qualRow.appendChild(badge);
  }
  personDetailBodyEl.appendChild(qualRow);

  const trainingBox = document.createElement('div');
  trainingBox.className = 'card__meta';
  trainingBox.textContent = person.training
    ? `Aktuelle Schulung: ${qualificationTitle(game, person.training.qualificationCode)} (${person.training.remainingTicks} Ticks verbleibend)`
    : 'Keine laufende Schulung';
  personDetailBodyEl.appendChild(trainingBox);

  const actions = document.createElement('div');
  actions.className = 'detail-actions';
  const learnHeader = document.createElement('div');
  learnHeader.className = 'card__meta';
  learnHeader.textContent = 'Schulung starten';
  actions.appendChild(learnHeader);

  const availableQualifications = game.qualifications.filter(
    (q) => q.enabled && !person.qualifications.includes(q.code),
  );

  if (!availableQualifications.length) {
    const none = document.createElement('div');
    none.className = 'card__meta';
    none.textContent = 'Keine weiteren Schulungen verfügbar.';
    actions.appendChild(none);
  } else {
    for (const qual of availableQualifications) {
      const row = document.createElement('div');
      row.className = 'detail-train-row';
      const label = document.createElement('div');
      label.textContent = `${qual.title} (${qual.learningDuration} Ticks)`;
      const cost = document.createElement('div');
      cost.className = 'card__meta';
      cost.textContent =
        'Kosten: ' + (qual.costs.length ? formatResourceDeltaList(qual.costs) : 'keine');
      const btn = document.createElement('button');
      btn.className = 'btn btn--ghost';
      btn.textContent = 'Schulung';
      btn.disabled = !!person.training;
      if (person.training) {
        btn.title = 'Person befindet sich bereits in einer Schulung.';
      }
      btn.addEventListener('click', () => {
        const err = startTraining(game, person.id, qual.code);
        if (err) {
          game.messages.push(err);
        }
        renderAll(game);
      });
      row.appendChild(label);
      row.appendChild(cost);
      row.appendChild(btn);
      actions.appendChild(row);
    }
  }

  personDetailBodyEl.appendChild(actions);
}

function renderPopup(game: GameState): void {
  const popupState = game.activeEventPopup ? JSON.stringify(game.activeEventPopup) : 'none';
  if (popupState === lastPopupState) return;
  lastPopupState = popupState;

  if (!game.activeEventPopup) {
    popupEl.classList.add('hidden');
    popupOptionsEl.innerHTML = '';
    return;
  }
  popupEl.classList.remove('hidden');
  popupTitleEl.textContent = game.activeEventPopup.title;
  popupMessageEl.textContent = game.activeEventPopup.message;

  popupOptionsEl.innerHTML = '';
  for (const option of game.activeEventPopup.options) {
    const btn = document.createElement('button');
    btn.className = 'popup-option';

    const label = document.createElement('div');
    label.className = 'popup-option-title';
    label.textContent = option.text;
    btn.appendChild(label);

    if (option.explanation) {
      const expl = document.createElement('div');
      expl.className = 'popup-option-expl';
      expl.textContent = option.explanation;
      btn.appendChild(expl);
    }

    const effects = document.createElement('div');
    effects.className = 'popup-option-effects';
    effects.textContent = formatResourceDeltaList(option.effects);
    btn.appendChild(effects);

    if (option.enableBuildings && option.enableBuildings.length) {
      const unlock = document.createElement('div');
      unlock.className = 'popup-option-unlocks';
      const names = option.enableBuildings
        .map((id) => BUILDING_TYPES.find((b) => b.id === id)?.name || id)
        .join(', ');
      unlock.textContent = `Schaltet frei: ${names}`;
      btn.appendChild(unlock);
    }

    btn.addEventListener('click', () => {
      if (onChooseEventOption) {
        onChooseEventOption(option);
      }
      renderAll(game);
    });

    popupOptionsEl.appendChild(btn);
  }
}

function renderLog(game: GameState): void {
  for (const msg of game.messages) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = msg;
    logEl.appendChild(entry);
  }
  while (logEl.children.length > 6) {
    logEl.removeChild(logEl.firstChild as ChildNode);
  }
  game.messages.length = 0;
}

function slotLabel(slotId: string): string {
  const idx = SAVE_SLOT_IDS.indexOf(slotId);
  return idx >= 0 ? `Slot ${idx + 1}` : slotId;
}

function renderSaveSlots(): void {
  if (!slotSelectEl || !slotListEl || !slotTimestampEl) return;

  let slotInfos: SaveSlotInfo[];
  try {
    slotInfos = SAVE_SLOT_IDS.map((slotId) => getSaveSlotInfo(slotId));
  } catch (error) {
    slotLoadErrorLogged = true;
    slotInfos = SAVE_SLOT_IDS.map((slotId) => ({ slotId, savedAt: null, hasData: false }));
  }
  const knownIds = new Set(SAVE_SLOT_IDS);
  if (!knownIds.has(selectedSaveSlot)) {
    selectedSaveSlot = SAVE_SLOT_IDS[0];
  }

  slotSelectEl.innerHTML = '';
  for (const info of slotInfos) {
    const opt = document.createElement('option');
    opt.value = info.slotId;
    opt.textContent = `${slotLabel(info.slotId)} – ${info.hasData ? formatTimestamp(info.savedAt) : 'Leer'}`;
    slotSelectEl.appendChild(opt);
  }
  slotSelectEl.value = selectedSaveSlot;

  slotListEl.innerHTML = '';
  for (const info of slotInfos) {
    const row = document.createElement('div');
    row.className = 'slot-entry';
    row.classList.toggle('selected', info.slotId === selectedSaveSlot);

    const title = document.createElement('div');
    title.className = 'slot-title';
    title.textContent = slotLabel(info.slotId);

    const meta = document.createElement('div');
    meta.className = 'slot-meta';
    meta.textContent = info.hasData ? `Stand: ${formatTimestamp(info.savedAt)}` : 'Noch kein Spielstand';

    row.appendChild(title);
    row.appendChild(meta);
    slotListEl.appendChild(row);
  }

  const currentSlot = slotInfos.find((info) => info.slotId === selectedSaveSlot);
  slotTimestampEl.textContent = currentSlot?.hasData
    ? `Ausgewählt: ${formatTimestamp(currentSlot.savedAt)}`
    : 'Ausgewählt: Leer';

  menuLoadBtn.disabled = !currentSlot?.hasData;
}

function renderMenuOverlay(game: GameState): boolean {
  const menuActive = game.screen === 'mainMenu' || game.paused;
  menuOverlayEl.classList.toggle('hidden', !menuActive);
  hudEl.classList.toggle('ui-disabled', menuActive);
  mainEl.classList.toggle('ui-disabled', menuActive);
  logEl.classList.toggle('ui-disabled', menuActive);
  if (menuActive) {
    popupEl.classList.add('hidden');
    lastPopupState = null;
  }
  return menuActive;
}

export function renderAll(game: GameState): void {
  const menuActive = renderMenuOverlay(game);
  renderSaveSlots();

  renderScreenTabs(game, menuActive);
  renderResources(game);

  if (!menuActive) {
    if (game.screen === 'build') {
      renderBuildMenu(game);
      renderGrid(game);
    } else if (game.screen === 'personnel') {
      renderModuleList(game);
      renderPeopleList(game);
    } else if (game.screen === 'personDetail') {
      renderPersonDetail(game);
    }
    renderPopup(game);
  }

  renderLog(game);
}

export function initUi(
  game: GameState,
  onConfirmEvent: (option: EventOption) => void,
): void {
  hudEl = document.getElementById('hud')!;
  mainEl = document.getElementById('main')!;
  resourcesEl = document.getElementById('resources')!;
  timeDisplayEl = document.getElementById('time-display')!;
  buildMenuEl = document.getElementById('build-menu')!;
  gridEl = document.getElementById('grid')!;
  logEl = document.getElementById('log')!;
  popupEl = document.getElementById('event-popup')!;
  popupTitleEl = document.getElementById('popup-title')!;
  popupMessageEl = document.getElementById('popup-message')!;
  popupOptionsEl = document.getElementById('popup-options')!;
  moduleCardsEl = document.getElementById('module-cards')!;
  peopleCardsEl = document.getElementById('people-cards')!;
  buildScreenEl = document.getElementById('build-screen')!;
  personnelScreenEl = document.getElementById('personnel-screen')!;
  personDetailScreenEl = document.getElementById('person-detail-screen')!;
  tabBuildBtn = document.getElementById('tab-build') as HTMLButtonElement;
  tabPersonnelBtn = document.getElementById('tab-personnel') as HTMLButtonElement;
  menuToggleBtn = document.getElementById('menu-toggle') as HTMLButtonElement;
  menuOverlayEl = document.getElementById('main-menu')!;
  menuResumeBtn = document.getElementById('menu-resume') as HTMLButtonElement;
  menuNewBtn = document.getElementById('menu-new') as HTMLButtonElement;
  menuLoadBtn = document.getElementById('menu-load') as HTMLButtonElement;
  menuSaveBtn = document.getElementById('menu-save') as HTMLButtonElement;
  menuOptionsBtn = document.getElementById('menu-options') as HTMLButtonElement;
  slotSelectEl = document.getElementById('menu-slot-select') as HTMLSelectElement;
  slotListEl = document.getElementById('menu-slot-list')!;
  slotTimestampEl = document.getElementById('menu-slot-timestamp')!;
  peopleFilterInput = document.getElementById('people-filter') as HTMLInputElement;
  unassignedFilterBtn = document.getElementById('filter-unassigned') as HTMLButtonElement;
  moduleViewModeSelect = document.getElementById('module-view-mode') as HTMLSelectElement;
  personDetailHeaderEl = document.getElementById('person-detail-name')!;
  personDetailBodyEl = document.getElementById('person-detail-body')!;
  personDetailBackBtn = document.getElementById('person-detail-back') as HTMLButtonElement;
  onChooseEventOption = onConfirmEvent;

  menuToggleBtn.addEventListener('click', () => {
    if (game.screen === 'mainMenu') {
      resumeGame(game);
    } else {
      openMenu(game);
    }
    renderAll(game);
  });

  menuResumeBtn.addEventListener('click', () => {
    resumeGame(game);
    renderAll(game);
  });

  menuNewBtn.addEventListener('click', () => {
    startNewGame(game);
    renderAll(game);
  });

  menuLoadBtn.addEventListener('click', () => {
    loadSelectedSlot(game);
  });

  menuSaveBtn.addEventListener('click', () => {
    saveCurrentSlot(game);
  });

  menuOptionsBtn.addEventListener('click', () => {
    game.messages.push('Optionen sind noch nicht verfügbar.');
    renderAll(game);
  });

  tabBuildBtn.addEventListener('click', () => {
    game.screen = 'build';
    lastGameplayScreen = 'build';
    renderAll(game);
  });

  tabPersonnelBtn.addEventListener('click', () => {
    game.screen = 'personnel';
    lastGameplayScreen = 'personnel';
    game.selectedPersonId = null;
    renderAll(game);
  });

  peopleFilterInput.addEventListener('input', (ev) => {
    peopleFilterTerm = (ev.target as HTMLInputElement).value;
    renderAll(game);
  });

  unassignedFilterBtn.addEventListener('click', () => {
    showUnassignedOnly = !showUnassignedOnly;
    unassignedFilterBtn.classList.toggle('active', showUnassignedOnly);
    renderAll(game);
  });

  moduleViewModeSelect.addEventListener('change', (ev) => {
    moduleListMode = (ev.target as HTMLSelectElement).value as typeof moduleListMode;
    renderAll(game);
  });

  personDetailBackBtn.addEventListener('click', () => {
    game.screen = 'personnel';
    lastGameplayScreen = 'personnel';
    renderAll(game);
  });

  slotSelectEl.addEventListener('change', (ev) => {
    selectedSaveSlot = (ev.target as HTMLSelectElement).value;
    renderAll(game);
  });

  // Delegation für Grid-Klicks
  gridEl.addEventListener('click', (event) => {
    if (game.screen !== 'build') return;
    const target = event.target as HTMLElement;
    const cellDiv = target.closest('.cell') as HTMLElement | null;
    if (!cellDiv) return;
    const x = Number(cellDiv.dataset.x);
    const y = Number(cellDiv.dataset.y);
    placeBuildingAt(game, x, y);
    renderAll(game);
  });

  renderAll(game);
}
