// src/ui.ts
import { GameState } from './types';
import { BUILDING_TYPES, } from './config';
import { placeBuildingAt } from './core';

let resourcesEl: HTMLElement;
let timeDisplayEl: HTMLElement;
let buildMenuEl: HTMLElement;
let gridEl: HTMLElement;
let logEl: HTMLElement;
let popupEl: HTMLElement;
let popupTitleEl: HTMLElement;
let popupMessageEl: HTMLElement;
let popupOkButton: HTMLButtonElement;

function formatDelta(d: number): string {
  if (!d) return '±0/Tick';
  const sign = d > 0 ? '+' : '';
  const abs = Math.abs(d);
  const rounded = abs < 0.1 ? d.toFixed(2) : d.toFixed(1);
  return `${sign}${rounded}/Tick`;
}

function renderResources(game: GameState): void {
  resourcesEl.innerHTML = '';
  for (const name in game.resources) {
    const r = game.resources[name];
    if (!r.enabled) continue;

    const div = document.createElement('div');
    div.className = 'resource';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'resource-name';
    nameSpan.textContent = name.toUpperCase();

    const valueSpan = document.createElement('span');
    valueSpan.className = 'resource-value';
    if (r.max !== undefined) {
      valueSpan.textContent = `${r.current.toFixed(0)} / ${r.max.toFixed(0)}`;
    } else {
      valueSpan.textContent = r.current.toFixed(0);
    }

    const deltaSpan = document.createElement('span');
    deltaSpan.className = 'resource-delta';
    deltaSpan.textContent = `(${formatDelta(r.deltaPerTick)})`;
    if (r.deltaPerTick > 0.001) deltaSpan.classList.add('delta-positive');
    else if (r.deltaPerTick < -0.001) deltaSpan.classList.add('delta-negative');

    div.appendChild(nameSpan);
    div.appendChild(valueSpan);
    div.appendChild(deltaSpan);
    resourcesEl.appendChild(div);
  }

  timeDisplayEl.textContent = `Ticks: ${game.ticks} | Tage: ${game.days}`;
}

function renderBuildMenu(game: GameState): void {
  buildMenuEl.innerHTML = '';
  const header = document.createElement('h2');
  header.textContent = 'Module';
  buildMenuEl.appendChild(header);

  for (const type of BUILDING_TYPES) {
    const btn = document.createElement('button');
    btn.className = 'build-button';
    if (game.selectedBuildingTypeId === type.id) {
      btn.classList.add('selected');
    }

    const nameDiv = document.createElement('div');
    nameDiv.className = 'build-name';
    nameDiv.textContent = type.name;

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

    btn.appendChild(nameDiv);
    btn.appendChild(costDiv);
    btn.appendChild(descDiv);

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
  gridEl.innerHTML = '';
  (gridEl as HTMLElement).style.gridTemplateColumns = `repeat(${grid.width}, 26px)`;

  for (const cell of grid.cells) {
    const div = document.createElement('div');
    const classes = ['cell'];
    if (!cell.buildingTypeId) {
      classes.push('empty');
    } else {
      classes.push(`building-${cell.buildingTypeId}`);
    }
    div.className = classes.join(' ');
    div.dataset.x = String(cell.x);
    div.dataset.y = String(cell.y);

    if (cell.buildingTypeId) {
      const type = BUILDING_TYPES.find((t) => t.id === cell.buildingTypeId);
      div.textContent = type ? type.shortName : '?';
    } else {
      div.textContent = '';
    }

    gridEl.appendChild(div);
  }
}

function renderPopup(game: GameState): void {
  if (!game.activeEventPopup) {
    popupEl.classList.add('hidden');
    return;
  }
  popupEl.classList.remove('hidden');
  popupTitleEl.textContent = game.activeEventPopup.title;
  popupMessageEl.textContent = game.activeEventPopup.message;
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
  onConfirmEvent: () => void,
): void {
  resourcesEl = document.getElementById('resources')!;
  timeDisplayEl = document.getElementById('time-display')!;
  buildMenuEl = document.getElementById('build-menu')!;
  gridEl = document.getElementById('grid')!;
  logEl = document.getElementById('log')!;
  popupEl = document.getElementById('event-popup')!;
  popupTitleEl = document.getElementById('popup-title')!;
  popupMessageEl = document.getElementById('popup-message')!;
  popupOkButton = document.getElementById('popup-ok-button') as HTMLButtonElement;

  popupOkButton.addEventListener('click', () => {
    onConfirmEvent();
    renderAll(game);
  });

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
