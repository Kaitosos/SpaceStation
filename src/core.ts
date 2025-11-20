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
  ModuleState,
  Qualification,
} from './types';
import {
  RESOURCE_CONFIGS,
  BUILDING_TYPES,
  EVENT_CONFIGS,
  QUALIFICATION_CONFIGS,
} from './config';

export const BUILDING_TYPE_MAP = new Map(
  BUILDING_TYPES.map((t) => [t.id, t]),
);

let moduleIdCounter = 1;

function nextModuleId(): string {
  return 'm_' + String(moduleIdCounter++).padStart(3, '0');
}

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

export function createInitialQualifications(): Qualification[] {
  return QUALIFICATION_CONFIGS.map((q) => ({ ...q, costs: q.costs.map((c) => ({ ...c })) }));
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

export function createRandomPerson(index: number): Person {
  const firstNames = ['Jax', 'Mara', 'Dex', 'Nova', 'Rin', 'Zoe', 'Kade', 'Vex'];
  const lastNames = ['Vega', 'Ishikawa', 'Black', 'Kwon', 'Nyx', 'Ortiz', 'Kade', 'Flux'];
  const id = 'p_' + String(index + 1).padStart(3, '0');

  const startingQualifications = QUALIFICATION_CONFIGS.filter((q) => q.enabled).map((q) => q.code);
  const randomQual = randomFrom(startingQualifications);
  const qualifications = Array.from(new Set([randomQual]));

  return {
    id,
    name: `${randomFrom(firstNames)} ${randomFrom(lastNames)}`,
    tags: ['citizen'],
    incomePerTick: [{ resource: 'money', amount: 0.5 }],
    needsPerTick: [
      { resource: 'oxygen', amount: 0.2 },
      { resource: 'energy', amount: 0.1 },
    ],
    work: null,
    equipment: [],
    unavailableFor: 0,
    qualifications,
    faceImage: undefined,
    bodyImage: undefined,
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
  const qualifications = createInitialQualifications();
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
    qualifications,
    grid,
    modules: [],
    events,
    activeEventPopup: null,
    selectedBuildingTypeId: null,
    selectedModuleId: null,
    screen: 'build',
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

  if (option.enableBuildings && option.enableBuildings.length) {
    for (const id of option.enableBuildings) {
      const type = BUILDING_TYPE_MAP.get(id);
      if (type && !type.enabled) {
        type.enabled = true;
        game.messages.push('Neues Modul freigeschaltet: ' + type.name);
      }
    }
  }

  if (option.enableQualifications && option.enableQualifications.length) {
    for (const code of option.enableQualifications) {
      const qual = game.qualifications.find((q) => q.code === code);
      if (qual && !qual.enabled) {
        qual.enabled = true;
        game.messages.push('Neue Qualifikation verfügbar: ' + qual.title);
      }
    }
  }

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

function getCellsForArea(
  game: GameState,
  x: number,
  y: number,
  width: number,
  height: number,
): Cell[] | null {
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

  if (!canAfford(game.resources, type.cost)) {
    game.messages.push('Nicht genug Ressourcen für ' + type.name + '.');
    return;
  }

  applyResourceDeltas(game.resources, type.cost, -1);
  const module = createModuleState(type.id, x, y, size.width, size.height);
  game.modules.push(module);
  cells.forEach((c, idx) => {
    c.buildingTypeId = type.id;
    c.isRoot = idx === 0;
    c.moduleId = module.id;
  });
  game.messages.push('Gebaut: ' + type.name);
}

function hasRequiredQualifications(person: Person, module: ModuleState): boolean {
  if (!module.requiredQualifications.length) return true;
  return module.requiredQualifications.every((req) => person.qualifications.includes(req));
}

function getModuleById(game: GameState, moduleId: string): ModuleState | undefined {
  return game.modules.find((m) => m.id === moduleId);
}

export function removePersonFromModule(game: GameState, personId: string, moduleId?: string): void {
  const person = game.people.find((p) => p.id === personId);
  if (!person) return;
  const mod = moduleId ? getModuleById(game, moduleId) : getModuleById(game, person.work || '');
  if (!mod) {
    person.work = null;
    return;
  }
  mod.workers = mod.workers.filter((id) => id !== personId);
  person.work = null;
}

export function assignPersonToModule(game: GameState, personId: string, moduleId: string): string | null {
  const person = game.people.find((p) => p.id === personId);
  const module = getModuleById(game, moduleId);
  if (!person || !module) return 'Unbekannte Zuordnung';

  if (person.unavailableFor > 0) {
    return `${person.name} ist noch ${person.unavailableFor} Ticks verhindert.`;
  }

  if (!hasRequiredQualifications(person, module)) {
    return `${person.name} erfüllt nicht alle Anforderungen.`;
  }

  if (module.workerMax > 0 && module.workers.length >= module.workerMax) {
    return 'Alle Slots sind belegt.';
  }

  if (person.work && person.work !== module.id) {
    removePersonFromModule(game, person.id, person.work);
  }

  if (!module.workers.includes(person.id)) {
    module.workers.push(person.id);
  }
  person.work = module.id;
  game.selectedModuleId = module.id;
  game.messages.push(`${person.name} arbeitet nun in ${BUILDING_TYPE_MAP.get(module.typeId)?.name || module.typeId}.`);
  return null;
}

export function toggleModuleActive(game: GameState, moduleId: string): void {
  const mod = getModuleById(game, moduleId);
  if (!mod) return;
  mod.active = !mod.active;
  game.messages.push(`${BUILDING_TYPE_MAP.get(mod.typeId)?.name || mod.typeId} ist jetzt ${mod.active ? 'aktiv' : 'passiv'}.`);
}

// ---------- Bevölkerung & Tick ----------

export function trySpawnNewPerson(game: GameState): void {
  const popRes = game.resources['population'];
  if (!popRes || popRes.max === undefined) return;

  const maxPop = popRes.max;
  if (game.people.length >= maxPop) return;

  const dockCount = game.modules.filter((m) => m.typeId === 'dock').length;
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

  for (const person of game.people) {
    if (person.unavailableFor > 0) {
      person.unavailableFor--;
    }
  }

  // Modul-Effekte
  for (const module of game.modules) {
    const type = BUILDING_TYPE_MAP.get(module.typeId);
    if (!type) continue;

    // Basisproduktion (auch wenn nicht aktiv)
    addResourceChangesToDelta(delta, type.perTick, +1);
    addResourceChangesToDelta(maxBonus, type.maxBonus, +1);

    if (!module.active) continue;

    const activeWorkers = module.workers
      .map((id) => game.people.find((p) => p.id === id))
      .filter(
        (p): p is Person =>
          !!p && p.work === module.id && p.unavailableFor <= 0 && hasRequiredQualifications(p, module),
      );

    for (const _ of activeWorkers) {
      addResourceChangesToDelta(delta, type.perTick, +1);
    }

    const enabledBonusQualifications = new Set(
      module.bonusQualifications.filter((code) => {
        const q = game.qualifications.find((qual) => qual.code === code);
        return !!q && q.enabled;
      }),
    );

    const activeBonusWorkers = activeWorkers.filter((person) =>
      person.qualifications.some((code) => enabledBonusQualifications.has(code)),
    );
    for (const _ of activeBonusWorkers) {
      addResourceChangesToDelta(delta, type.perTick, +1);
    }
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
