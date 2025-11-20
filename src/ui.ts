// src/ui.ts
import { EventOption, GameState, ResourceDelta } from './types';
import { BUILDING_TYPES } from './config';
import { placeBuildingAt } from './core';

let resourcesEl: HTMLElement;
let timeDisplayEl: HTMLElement;
let buildMenuEl: HTMLElement;
let gridEl: HTMLElement;
let logEl: HTMLElement;
let popupEl: HTMLElement;
let popupTitleEl: HTMLElement;
let popupMessageEl: HTMLElement;
let popupOptionsEl: HTMLElement;
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
  renderResources(game);
  renderBuildMenu(game);
  renderGrid(game);
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
  onChooseEventOption = onConfirmEvent;

  // Delegation für Grid-Klicks
  gridEl.addEventListener('click', (event) => {
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
