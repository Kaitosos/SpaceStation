// src/core.ts
import {
  ResourceDelta,
  ResourcesState,
  ResourceConfig,
  Person,
  Grid,
  GameEventState,
  GameState,
  Comparator,
  ConditionConfig,
  EventConfig,
  EventOption,
  Cell,
} from './types';
import { RESOURCE_CONFIGS, BUILDING_TYPES, EVENT_CONFIGS } from './config';

export const BUILDING_TYPE_MAP = new Map(
  BUILDING_TYPES.map((t) => [t.id, t]),
);

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function createInitialResources(): ResourcesState {
  const res: ResourcesState = {};
  for (const cfg of RESOURCE_CONFIGS) {
    res[cfg.name] = {
      name: cfg.name,
      enabled: cfg.enabledByDefault,
      current: cfg.initialCurrent,
      max: cfg.hasMax ? cfg.initialMax ?? 0 : undefined,
      deltaPerTick: 0,
    };
  }
  return res;
}

export function createGrid(width: number, height: number): Grid {
  const cells: Cell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cells.push({ x, y, buildingTypeId: null });
    }
  }
  return { width, height, cells };
}

export function createRandomPerson(index: number): Person {
  const firstNames = ['Jax', 'Mara', 'Dex', 'Nova', 'Rin', 'Zoe', 'Kade', 'Vex'];
  const lastNames = ['Vega', 'Ishikawa', 'Black', 'Kwon', 'Nyx', 'Ortiz', 'Kade', 'Flux'];
  const id = 'p_' + String(index + 1).padStart(3, '0');

  return {
    id,
    name: `${randomFrom(firstNames)} ${randomFrom(lastNames)}`,
    tags: ['citizen'],
    incomePerTick: [{ resource: 'money', amount: 0.5 }],
    needsPerTick: [
      { resource: 'oxygen', amount: 0.2 },
      { resource: 'energy', amount: 0.1 },
    ],
  };
}

export function createInitialPeople(): Person[] {
  const people: Person[] = [];
  for (let i = 0; i < 5; i++) {
    people.push(createRandomPerson(i));
  }
  return people;
}

export function createInitialEvents(): GameEventState[] {
  return EVENT_CONFIGS.map((cfg) => ({
    config: cfg,
    hasTriggered: false,
  }));
}

export function createInitialGameState(): GameState {
  const resources = createInitialResources();
  const people = createInitialPeople();
  const grid = createGrid(16, 10);
  const events = createInitialEvents();

  const popRes = resources['population'];
  if (popRes) {
    popRes.current = people.length;
  }

  return {
    resources,
    people,
    grid,
    events,
    activeEventPopup: null,
    selectedBuildingTypeId: null,
    ticks: 0,
    days: 0,
    messages: [],
  };
}

// ---------- Ressourcen-Helpers ----------

export function addResourceChangesToDelta(
  delta: Record<string, number>,
  changes: ResourceDelta[],
  sign: 1 | -1,
): void {
  for (const ch of changes) {
    const key = ch.resource;
    delta[key] = (delta[key] || 0) + sign * ch.amount;
  }
}

export function applyResourceDeltas(
  resources: ResourcesState,
  deltas: ResourceDelta[],
  sign: 1 | -1 = 1,
): void {
  for (const d of deltas) {
    const res = resources[d.resource];
    if (!res || d.resource === 'population') continue;
    res.current += sign * d.amount;
    if (res.max !== undefined) {
      if (res.current > res.max) res.current = res.max;
      if (res.current < 0) res.current = 0;
    } else {
      if (res.current < 0) res.current = 0;
    }
  }
}

export function canAfford(resources: ResourcesState, cost: ResourceDelta[]): boolean {
  for (const c of cost) {
    const res = resources[c.resource];
    if (!res) return false;
    if (res.current < c.amount) return false;
  }
  return true;
}

// ---------- Events ----------

function checkComparator(a: number, cmp: Comparator, b: number): boolean {
  switch (cmp) {
    case 'lt':
      return a < b;
    case 'lte':
      return a <= b;
    case 'gt':
      return a > b;
    case 'gte':
      return a >= b;
    case 'eq':
      return a === b;
    case 'neq':
      return a !== b;
  }
}

export function evaluateCondition(game: GameState, cond: ConditionConfig): boolean {
  if (cond.type === 'resource') {
    const res = game.resources[cond.resource];
    if (!res) return false;
    return checkComparator(res.current, cond.comparator, cond.value);
  }
  if (cond.type === 'time') {
    const tickOk = cond.ticksGte === undefined || game.ticks >= cond.ticksGte;
    const dayOk = cond.daysGte === undefined || game.days >= cond.daysGte;
    return tickOk && dayOk;
  }
  return false;
}

export function areAllConditionsMet(game: GameState, cfg: EventConfig): boolean {
  return cfg.conditions.every((c) => evaluateCondition(game, c));
}

export function checkEvents(game: GameState): void {
  if (game.activeEventPopup) return;

  for (const evt of game.events) {
    if (evt.hasTriggered && evt.config.once) continue;
    if (areAllConditionsMet(game, evt.config)) {
      game.activeEventPopup = {
        id: evt.config.id,
        title: evt.config.title,
        message: evt.config.message,
        options: evt.config.options,
      };
      return;
    }
  }
}

export function applyEventOptionAndClose(
  game: GameState,
  option: EventOption,
): void {
  const popup = game.activeEventPopup;
  if (!popup) return;

  applyResourceDeltas(game.resources, option.effects, +1);

  const evt = game.events.find((e) => e.config.id === popup.id);
  if (evt) {
    evt.hasTriggered = true;
  }

  game.activeEventPopup = null;
  game.messages.push(`Event abgeschlossen: ${popup.title} – ${option.text}`);
}

// ---------- Grid / Gebäude ----------

function getCell(game: GameState, x: number, y: number): Cell | null {
  const grid = game.grid;
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return null;
  const index = y * grid.width + x;
  return grid.cells[index] ?? null;
}

export function placeBuildingAt(game: GameState, x: number, y: number): void {
  const buildingId = game.selectedBuildingTypeId;
  if (!buildingId) {
    game.messages.push('Kein Modul ausgewählt.');
    return;
  }

  const cell = getCell(game, x, y);
  if (!cell) return;

  if (cell.buildingTypeId) {
    game.messages.push('Dieses Feld ist bereits belegt.');
    return;
  }

  const type = BUILDING_TYPE_MAP.get(buildingId);
  if (!type) return;

  if (!canAfford(game.resources, type.cost)) {
    game.messages.push('Nicht genug Ressourcen für ' + type.name + '.');
    return;
  }

  applyResourceDeltas(game.resources, type.cost, -1);
  cell.buildingTypeId = type.id;
  game.messages.push('Gebaut: ' + type.name);
}

// ---------- Bevölkerung & Tick ----------

export function trySpawnNewPerson(game: GameState): void {
  const popRes = game.resources['population'];
  if (!popRes || popRes.max === undefined) return;

  const maxPop = popRes.max;
  if (game.people.length >= maxPop) return;

  let dockCount = 0;
  for (const cell of game.grid.cells) {
    if (cell.buildingTypeId === 'dock') dockCount++;
  }
  if (dockCount <= 0) return;

  const spawnRatePerTick = 0.02 * dockCount;
  if (Math.random() < spawnRatePerTick) {
    const p = createRandomPerson(game.people.length);
    game.people.push(p);
    game.messages.push('Neuer Bewohner eingetroffen: ' + p.name);
  }
}

export function updateGameTick(game: GameState): void {
  game.ticks++;
  if (game.ticks % 40 === 0) {
    game.days++;
  }

  const resources = game.resources;
  const delta: Record<string, number> = {};
  const maxBonus: Record<string, number> = {};
  for (const name in resources) {
    delta[name] = 0;
    maxBonus[name] = 0;
  }

  // Gebäude-Effekte
  for (const cell of game.grid.cells) {
    if (!cell.buildingTypeId) continue;
    const type = BUILDING_TYPE_MAP.get(cell.buildingTypeId);
    if (!type) continue;
    addResourceChangesToDelta(delta, type.perTick, +1);
    addResourceChangesToDelta(maxBonus, type.maxBonus, +1);
  }

  // Personen-Effekte
  for (const person of game.people) {
    addResourceChangesToDelta(delta, person.incomePerTick, +1);
    addResourceChangesToDelta(delta, person.needsPerTick, -1);
  }

  // Max-Werte
  for (const resName in resources) {
    const res = resources[resName];
    const cfg: ResourceConfig | undefined = RESOURCE_CONFIGS.find(
      (c) => c.name === resName,
    );
    if (!cfg || !cfg.hasMax) continue;
    const baseMax = cfg.initialMax ?? 0;
    const bonus = maxBonus[resName] || 0;
    res.max = baseMax + bonus;
  }

  // Deltas anwenden
  for (const resName in resources) {
    const res = resources[resName];
    const d = delta[resName] || 0;
    res.deltaPerTick = d;

    if (resName === 'population') {
      continue; // wird unten gesetzt
    }

    res.current += d;
    if (res.max !== undefined) {
      if (res.current > res.max) res.current = res.max;
      if (res.current < 0) res.current = 0;
    } else {
      if (res.current < 0) res.current = 0;
    }
  }

  // Population aus people ableiten
  const popRes = resources['population'];
  if (popRes) {
    popRes.current = game.people.length;
    popRes.deltaPerTick = 0;
  }

  trySpawnNewPerson(game);
  checkEvents(game);
}
