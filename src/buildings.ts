// src/buildings.ts
import { BUILDING_TYPE_MAP } from './buildingTypes.js';
import { applyResourceDeltas, canAfford, recalcResourceMaximums } from './resources.js';
import { GameState, Cell, Grid, ModuleState, Person } from './types.js';

let moduleIdCounter = 1;

function nextModuleId(): string {
  return 'm_' + String(moduleIdCounter++).padStart(3, '0');
}

export function createGrid(width: number, height: number): Grid {
  const cells: Cell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cells.push({ x, y, buildingTypeId: null, moduleId: null });
    }
  }
  return { width, height, cells };
}

export function rebuildGridFromModules(game: GameState): void {
  for (const cell of game.grid.cells) {
    cell.buildingTypeId = null;
    cell.moduleId = null;
    cell.isRoot = false;
  }

  for (const module of game.modules) {
    const type = BUILDING_TYPE_MAP.get(module.typeId);
    if (!type) continue;
    const cells = getCellsForArea(game, module.x, module.y, module.width, module.height);
    if (!cells) continue;
    cells.forEach((cell, idx) => {
      cell.buildingTypeId = module.typeId;
      cell.moduleId = module.id;
      cell.isRoot = idx === 0;
    });
  }
}

function expandGridWithBorder(game: GameState): void {
  const oldGrid = game.grid;
  game.grid = createGrid(oldGrid.width + 2, oldGrid.height + 2);
  for (const module of game.modules) {
    module.x += 1;
    module.y += 1;
  }
  rebuildGridFromModules(game);
}

function getCell(game: GameState, x: number, y: number): Cell | null {
  const grid = game.grid;
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return null;
  const index = y * grid.width + x;
  return grid.cells[index] ?? null;
}

function getCellsForArea(game: GameState, x: number, y: number, width: number, height: number): Cell[] | null {
  const cells: Cell[] = [];
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const cell = getCell(game, x + dx, y + dy);
      if (!cell) return null;
      cells.push(cell);
    }
  }
  return cells;
}

function createModuleState(typeId: string, x: number, y: number, width: number, height: number): ModuleState {
  const type = BUILDING_TYPE_MAP.get(typeId);
  return {
    id: nextModuleId(),
    typeId,
    x,
    y,
    width,
    height,
    active: type?.activeByDefault ?? true,
    requiredQualifications: type?.requiredQualifications ? [...type.requiredQualifications] : [],
    bonusQualifications: type?.bonusQualifications ? [...type.bonusQualifications] : [],
    workers: [],
    workerMax: type?.workerMax ?? 0,
  };
}

function moduleTouchesBoundary(game: GameState, x: number, y: number, width: number, height: number): boolean {
  return x <= 0 || y <= 0 || x + width >= game.grid.width || y + height >= game.grid.height;
}

function isAdjacentToExistingModule(game: GameState, x: number, y: number, width: number, height: number): boolean {
  if (!game.modules.length) return true;
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const cx = x + dx;
      const cy = y + dy;
      const neighbors = [
        getCell(game, cx + 1, cy),
        getCell(game, cx - 1, cy),
        getCell(game, cx, cy + 1),
        getCell(game, cx, cy - 1),
      ];
      if (neighbors.some((c) => c && !!c.buildingTypeId)) {
        return true;
      }
    }
  }
  return false;
}

export function placeBuildingAt(game: GameState, x: number, y: number): void {
  const buildingId = game.selectedBuildingTypeId;
  if (!buildingId) {
    game.messages.push('Kein Modul ausgewählt.');
    return;
  }

  const cell = getCell(game, x, y);
  if (!cell) return;

  const type = BUILDING_TYPE_MAP.get(buildingId);
  if (!type) return;

  if (!type.enabled) {
    game.messages.push('Dieses Modul ist noch gesperrt.');
    return;
  }

  const size = type.size || { width: 1, height: 1 };
  const cells = getCellsForArea(game, x, y, size.width, size.height);
  if (!cells || cells.length !== size.width * size.height) {
    game.messages.push('Das Modul passt hier nicht ins Raster.');
    return;
  }

  if (cells.some((c) => c.buildingTypeId)) {
    game.messages.push('Dieses Feld ist bereits belegt.');
    return;
  }

  if (!isAdjacentToExistingModule(game, x, y, size.width, size.height)) {
    game.messages.push('Module müssen angrenzend gebaut werden.');
    return;
  }

  if (!canAfford(game.resources, type.cost)) {
    game.messages.push('Nicht genug Ressourcen für ' + type.name + '.');
    return;
  }

  applyResourceDeltas(game.resources, type.cost, -1);
  const module = createModuleState(type.id, x, y, size.width, size.height);
  game.modules.push(module);
  const touchesEdge = moduleTouchesBoundary(game, x, y, size.width, size.height);
  rebuildGridFromModules(game);
  if (touchesEdge) {
    expandGridWithBorder(game);
    game.messages.push('Der verfügbare Baubereich wurde erweitert.');
  }
  recalcResourceMaximums(game);
  game.messages.push('Gebaut: ' + type.name);
}

export function getModuleById(game: GameState, moduleId: string): ModuleState | undefined {
  return game.modules.find((m) => m.id === moduleId);
}

export function toggleModuleActive(game: GameState, moduleId: string): void {
  const mod = getModuleById(game, moduleId);
  if (!mod) return;
  mod.active = !mod.active;
  game.messages.push(`${BUILDING_TYPE_MAP.get(mod.typeId)?.name || mod.typeId} ist jetzt ${mod.active ? 'aktiv' : 'passiv'}.`);
}

export function moduleHasActiveWorkers(game: GameState, module: ModuleState): Person[] {
  return module.workers
    .map((id) => game.people.find((p) => p.id === id))
    .filter((p): p is Person => !!p && p.work === module.id && p.unavailableFor <= 0);
}
