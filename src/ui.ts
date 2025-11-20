// src/ui.ts
import { EventOption, GameState, ResourceDelta, ModuleState, Person } from './types';
import { BUILDING_TYPES } from './config';
import {
  placeBuildingAt,
  assignPersonToModule,
  removePersonFromModule,
  toggleModuleActive,
} from './core';

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
let tabBuildBtn: HTMLButtonElement;
let tabPersonnelBtn: HTMLButtonElement;
let onChooseEventOption: ((option: EventOption) => void) | null = null;
let selectedBuildTypeFilter: string | 'all' = 'all';
let lastTimeDisplay = '';
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
    btn.className = 'build-button';
    if (game.selectedBuildingTypeId === type.id) {
      btn.classList.add('selected');
    }

    const nameDiv = document.createElement('div');
    nameDiv.className = 'build-name';
    nameDiv.textContent = type.name;

    const metaDiv = document.createElement('div');
    metaDiv.className = 'build-meta';
    metaDiv.textContent = `Typ: ${type.type} • Größe: ${type.size.width}x${type.size.height}`;

    const costDiv = document.createElement('div');
    costDiv.className = 'build-cost';
    costDiv.textContent =
      'Kosten: ' +
      (type.cost.length
        ? type.cost.map((c) => `${c.amount} ${c.resource}`).join(', ')
        : 'keine');

    const descDiv = document.createElement('div');
    descDiv.className = 'build-desc';
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

function renderScreenTabs(game: GameState): void {
  const isBuild = game.screen === 'build';
  buildScreenEl.classList.toggle('active', isBuild);
  personnelScreenEl.classList.toggle('active', !isBuild);
  tabBuildBtn.classList.toggle('active', isBuild);
  tabPersonnelBtn.classList.toggle('active', !isBuild);
}

function personCanWorkInModule(person: Person, module: ModuleState): boolean {
  if (person.unavailableFor > 0) return false;
  if (module.requiredQualifications.length) {
    const hasAll = module.requiredQualifications.every((req) => person.qualifications.includes(req));
    if (!hasAll) return false;
  }
  return true;
}

function renderModuleList(game: GameState): void {
  moduleCardsEl.innerHTML = '';
  if (!game.selectedModuleId && game.modules.length) {
    game.selectedModuleId = game.modules[0].id;
  }
  if (!game.modules.length) {
    const empty = document.createElement('div');
    empty.className = 'card card-meta';
    empty.textContent = 'Noch keine Module gebaut.';
    moduleCardsEl.appendChild(empty);
    return;
  }

  for (const mod of game.modules) {
    const type = buildingTypeMap.get(mod.typeId);
    const card = document.createElement('div');
    card.className = 'card module-card';
    card.classList.toggle('active', mod.active);
    card.classList.toggle('inactive', !mod.active);
    if (game.selectedModuleId === mod.id) card.classList.add('selected');

    const header = document.createElement('div');
    header.className = 'card-header';
    header.textContent = type?.name || mod.typeId;
    const status = document.createElement('span');
    status.className = 'card-meta';
    status.textContent = mod.active ? 'Aktiv' : 'Passiv';
    header.appendChild(status);
    card.appendChild(header);

    const workerMeta = document.createElement('div');
    workerMeta.className = 'card-meta';
    workerMeta.textContent = `Slots: ${mod.workers.length}/${mod.workerMax ?? 0}`;
    card.appendChild(workerMeta);

    if (mod.requiredQualifications.length) {
      const reqRow = document.createElement('div');
      reqRow.className = 'pill-row';
      for (const code of mod.requiredQualifications) {
        const pill = document.createElement('span');
        pill.className = 'pill';
        pill.textContent = 'Pflicht: ' + qualificationTitle(game, code);
        reqRow.appendChild(pill);
      }
      card.appendChild(reqRow);
    }

    if (mod.bonusQualifications.length) {
      const bonusRow = document.createElement('div');
      bonusRow.className = 'pill-row';
      for (const code of mod.bonusQualifications) {
        const pill = document.createElement('span');
        pill.className = 'pill';
        pill.textContent = 'Bonus: ' + qualificationTitle(game, code);
        bonusRow.appendChild(pill);
      }
      card.appendChild(bonusRow);
    }

    const workersLine = document.createElement('div');
    workersLine.className = 'card-meta';
    const workerNames = mod.workers
      .map((id) => game.people.find((p) => p.id === id)?.name)
      .filter(Boolean);
    workersLine.textContent = workerNames.length ? `Arbeiter: ${workerNames.join(', ')}` : 'Keine zugewiesen';
    card.appendChild(workersLine);

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = mod.active ? 'Deaktivieren' : 'Aktivieren';
    toggleBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleModuleActive(game, mod.id);
      renderAll(game);
    });
    card.appendChild(toggleBtn);

    card.addEventListener('click', () => {
      game.selectedModuleId = mod.id;
      renderAll(game);
    });

    moduleCardsEl.appendChild(card);
  }
}

function renderPeopleList(game: GameState): void {
  peopleCardsEl.innerHTML = '';
  const selectedModule = game.modules.find((m) => m.id === game.selectedModuleId) || null;

  for (const person of game.people) {
    const card = document.createElement('div');
    card.className = 'card person-card';

    const header = document.createElement('div');
    header.className = 'card-header';
    header.textContent = person.name;
    const status = document.createElement('span');
    status.className = 'person-status';
    if (person.unavailableFor > 0) {
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
      qualRow.className = 'pill-row';
      for (const code of person.qualifications) {
        const pill = document.createElement('span');
        pill.className = 'pill';
        pill.textContent = qualificationTitle(game, code);
        qualRow.appendChild(pill);
      }
      card.appendChild(qualRow);
    }

    const needs = document.createElement('div');
    needs.className = 'card-meta';
    needs.textContent = `Bedarf: ${formatResourceDeltaList(person.needsPerTick)} | Einkommen: ${formatResourceDeltaList(
      person.incomePerTick,
    )}`;
    card.appendChild(needs);

    const actionBtn = document.createElement('button');

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

    card.appendChild(actionBtn);
    peopleCardsEl.appendChild(card);
  }
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

export function renderAll(game: GameState): void {
  renderScreenTabs(game);
  renderResources(game);
  if (game.screen === 'build') {
    renderBuildMenu(game);
    renderGrid(game);
  } else {
    renderModuleList(game);
    renderPeopleList(game);
  }
  renderPopup(game);
  renderLog(game);
}

export function initUi(
  game: GameState,
  onConfirmEvent: (option: EventOption) => void,
): void {
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
  tabBuildBtn = document.getElementById('tab-build') as HTMLButtonElement;
  tabPersonnelBtn = document.getElementById('tab-personnel') as HTMLButtonElement;
  onChooseEventOption = onConfirmEvent;

  tabBuildBtn.addEventListener('click', () => {
    game.screen = 'build';
    renderAll(game);
  });

  tabPersonnelBtn.addEventListener('click', () => {
    game.screen = 'personnel';
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
