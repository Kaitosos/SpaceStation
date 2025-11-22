// src/storage.ts
import { GameState, ActiveEventPopup, Grid, ModuleState, Person, ResourceDelta, ResourcesState, GameEventState, Qualification, EventOption } from './types.js';
import { syncModuleIdCounterFromModules } from './buildings.js';

const SAVE_VERSION = 1;
const SAVE_KEY_PREFIX = 'spacestation-save-slot-';

interface SavePayload {
  version: number;
  state: unknown;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function sanitizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter(isString);
}

function sanitizeResourceDeltaArray(input: unknown): ResourceDelta[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is Partial<ResourceDelta> => !!item && typeof item === 'object')
    .map((delta) => ({
      resource: isString(delta.resource) ? delta.resource : 'unknown',
      amount: isNumber(delta.amount) ? delta.amount : 0,
    }));
}

function sanitizeResourcesState(input: unknown): ResourcesState {
  const result: ResourcesState = {};
  if (!input || typeof input !== 'object') return result;
  for (const [key, value] of Object.entries(input)) {
    if (!value || typeof value !== 'object') continue;
    const resource = value as Record<string, unknown>;
    if (!isString(resource.name)) continue;
    if (resource.name !== key) continue;
    const current = isNumber(resource.current) ? resource.current : 0;
    const max = isNumber(resource.max) ? resource.max : undefined;
    const enabled = isBoolean(resource.enabled) ? resource.enabled : false;
    const deltaPerTick = isNumber(resource.deltaPerTick) ? resource.deltaPerTick : 0;
    result[key] = { name: key, enabled, current, max, deltaPerTick };
  }
  return result;
}

function sanitizeGrid(input: unknown): Grid | null {
  if (!input || typeof input !== 'object') return null;
  const grid = input as Record<string, unknown>;
  if (!isNumber(grid.width) || !isNumber(grid.height) || !Array.isArray(grid.cells)) return null;
  const cells = grid.cells
    .filter((cell): cell is Record<string, unknown> => !!cell && typeof cell === 'object')
    .map((cell) => ({
      x: isNumber(cell.x) ? cell.x : 0,
      y: isNumber(cell.y) ? cell.y : 0,
      buildingTypeId: isString(cell.buildingTypeId) ? cell.buildingTypeId : null,
      isRoot: isBoolean(cell.isRoot) ? cell.isRoot : undefined,
      moduleId: isString(cell.moduleId) ? cell.moduleId : null,
    }));
  if (cells.length !== grid.cells.length) return null;
  return { width: grid.width, height: grid.height, cells };
}

function sanitizeModuleStateArray(input: unknown): ModuleState[] {
  if (!Array.isArray(input)) return [];
  const modules: ModuleState[] = [];
  for (const module of input) {
    if (!module || typeof module !== 'object') continue;
    const mod = module as Record<string, unknown>;
    if (!isString(mod.id) || !isString(mod.typeId)) continue;
    if (!isNumber(mod.x) || !isNumber(mod.y) || !isNumber(mod.width) || !isNumber(mod.height)) continue;
    const active = isBoolean(mod.active) ? mod.active : false;
    const requiredQualifications = sanitizeStringArray(mod.requiredQualifications);
    const bonusQualifications = sanitizeStringArray(mod.bonusQualifications);
    const workers = sanitizeStringArray(mod.workers);
    const workerMax = isNumber(mod.workerMax) ? mod.workerMax : 0;
    modules.push({
      id: mod.id,
      typeId: mod.typeId,
      x: mod.x,
      y: mod.y,
      width: mod.width,
      height: mod.height,
      active,
      requiredQualifications,
      bonusQualifications,
      workers,
      workerMax,
    });
  }
  return modules;
}

function sanitizePersonArray(input: unknown): Person[] {
  if (!Array.isArray(input)) return [];
  const people: Person[] = [];
  for (const person of input) {
    if (!person || typeof person !== 'object') continue;
    const p = person as Record<string, unknown>;
    if (!isString(p.id) || !isString(p.name)) continue;
    const tags = sanitizeStringArray(p.tags);
    const incomePerTick = sanitizeResourceDeltaArray(p.incomePerTick);
    const needsPerTick = sanitizeResourceDeltaArray(p.needsPerTick);
    const work = isString(p.work) || p.work === null ? (p.work as string | null) : null;
    const equipment = sanitizeStringArray(p.equipment);
    const unavailableFor = isNumber(p.unavailableFor) ? p.unavailableFor : 0;
    const qualifications = sanitizeStringArray(p.qualifications);
    const personalData = Array.isArray(p.personalData)
      ? p.personalData
          .filter((dp): dp is Record<string, unknown> => !!dp && typeof dp === 'object')
          .map((dp) => ({
            type: isString(dp.type) ? dp.type : 'unknown',
            name: isString(dp.name) ? dp.name : 'unknown',
            value: isNumber(dp.value) ? dp.value : 0,
            translationTable: isString(dp.translationTable) ? dp.translationTable : null,
          }))
      : [];
    const training = p.training && typeof p.training === 'object'
      ? {
          qualificationCode: isString((p.training as Record<string, unknown>).qualificationCode)
            ? ((p.training as Record<string, unknown>).qualificationCode as string)
            : 'unknown',
          remainingTicks: isNumber((p.training as Record<string, unknown>).remainingTicks)
            ? ((p.training as Record<string, unknown>).remainingTicks as number)
            : 0,
        }
      : undefined;
    const faceImage = isString(p.faceImage) ? p.faceImage : undefined;
    const bodyImage = isString(p.bodyImage) ? p.bodyImage : undefined;
    people.push({
      id: p.id,
      name: p.name,
      tags,
      incomePerTick,
      needsPerTick,
      work,
      equipment,
      unavailableFor,
      qualifications,
      personalData,
      training,
      faceImage,
      bodyImage,
    });
  }
  return people;
}

function sanitizeQualificationArray(input: unknown): Qualification[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((qual): qual is Record<string, unknown> => !!qual && typeof qual === 'object')
    .filter((qual) => isString(qual.code) && isString(qual.title))
    .map((qual) => ({
      code: qual.code as string,
      title: qual.title as string,
      enabled: isBoolean(qual.enabled) ? (qual.enabled as boolean) : false,
      costs: sanitizeResourceDeltaArray(qual.costs),
      learningDuration: isNumber(qual.learningDuration) ? (qual.learningDuration as number) : 0,
    }));
}

function sanitizeEventOptions(options: unknown): EventOption[] {
  if (!Array.isArray(options)) return [];
  return options
    .filter((opt): opt is Record<string, unknown> => !!opt && typeof opt === 'object')
    .filter((opt) => isString(opt.id) && isString(opt.text))
    .map((opt) => ({
      id: opt.id as string,
      text: opt.text as string,
      explanation: isString(opt.explanation) ? (opt.explanation as string) : undefined,
      effects: sanitizeResourceDeltaArray(opt.effects),
      enableBuildings: sanitizeStringArray(opt.enableBuildings),
      enableQualifications: sanitizeStringArray(opt.enableQualifications),
      questFlagChanges: Array.isArray(opt.questFlagChanges)
        ? (opt.questFlagChanges
            .filter((change): change is Record<string, unknown> => !!change && typeof change === 'object')
            .filter((change) => isString(change.id) && isString(change.op))
            .map((change) => ({
              id: change.id as string,
              op: change.op as 'set' | 'add' | 'delete',
              value: isNumber(change.value) ? (change.value as number) : undefined,
            })) as EventOption['questFlagChanges'])
        : undefined,
      questTimerChanges: Array.isArray(opt.questTimerChanges)
        ? (opt.questTimerChanges
            .filter((change): change is Record<string, unknown> => !!change && typeof change === 'object')
            .filter((change) => isString(change.id) && isString(change.op))
            .map((change) => ({
              id: change.id as string,
              op: change.op as 'set' | 'add' | 'delete',
              value: isNumber(change.value) ? (change.value as number) : undefined,
            })) as EventOption['questTimerChanges'])
        : undefined,
    }));
}

function sanitizeEvents(input: unknown): GameEventState[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((event): event is Record<string, unknown> => !!event && typeof event === 'object')
    .filter((event) => isBoolean(event.hasTriggered) && event.config && typeof event.config === 'object')
    .map((event) => {
      const config = event.config as Record<string, unknown>;
      const options = sanitizeEventOptions(config.options);
      return {
        hasTriggered: event.hasTriggered as boolean,
        config: {
          id: isString(config.id) ? (config.id as string) : 'unknown',
          title: isString(config.title) ? (config.title as string) : 'Unbekanntes Ereignis',
          message: isString(config.message) ? (config.message as string) : '',
          once: isBoolean(config.once) ? (config.once as boolean) : false,
          conditions: Array.isArray(config.conditions) ? (config.conditions as unknown as GameEventState['config']['conditions']) : [],
          options,
        },
      } as GameEventState;
    });
}

function sanitizeRecordOfNumbers(input: unknown): Record<string, number> {
  if (!input || typeof input !== 'object') return {};
  const record: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    if (isNumber(value)) record[key] = value;
  }
  return record;
}

function sanitizeActiveEventPopup(input: unknown): ActiveEventPopup | null {
  if (!input || typeof input !== 'object') return null;
  const popup = input as Record<string, unknown>;
  if (!isString(popup.id) || !isString(popup.title) || !isString(popup.message)) return null;
  return {
    id: popup.id as string,
    title: popup.title as string,
    message: popup.message as string,
    options: sanitizeEventOptions(popup.options),
  };
}

function sanitizeGameState(input: unknown): GameState {
  if (!input || typeof input !== 'object') {
    throw new Error('Spielstand ist leer oder korrupt.');
  }
  const state = input as Record<string, unknown>;
  const resources = sanitizeResourcesState(state.resources);
  const people = sanitizePersonArray(state.people);
  const qualifications = sanitizeQualificationArray(state.qualifications);
  const grid = sanitizeGrid(state.grid);
  const modules = sanitizeModuleStateArray(state.modules);
  const events = sanitizeEvents(state.events);
  const questFlags = sanitizeRecordOfNumbers(state.questFlags);
  const questTimers = sanitizeRecordOfNumbers(state.questTimers);
  const activeEventPopup = sanitizeActiveEventPopup(state.activeEventPopup);
  const selectedBuildingTypeId = isString(state.selectedBuildingTypeId) ? (state.selectedBuildingTypeId as string) : null;
  const selectedModuleId = isString(state.selectedModuleId) ? (state.selectedModuleId as string) : null;
  const selectedPersonId = isString(state.selectedPersonId) ? (state.selectedPersonId as string) : null;
  const screenValues: GameState['screen'][] = ['mainMenu', 'build', 'personnel', 'personDetail'];
  const screen = isString(state.screen) && screenValues.includes(state.screen as GameState['screen'])
    ? (state.screen as GameState['screen'])
    : 'mainMenu';
  const paused = isBoolean(state.paused) ? (state.paused as boolean) : false;
  const ticks = isNumber(state.ticks) ? (state.ticks as number) : 0;
  const days = isNumber(state.days) ? (state.days as number) : 0;
  const messages = Array.isArray(state.messages) ? state.messages.filter(isString) : [];

  if (!grid) {
    throw new Error('Spielfeld konnte nicht wiederhergestellt werden.');
  }

  return {
    resources,
    people,
    qualifications,
    grid,
    modules,
    events,
    questFlags,
    questTimers,
    activeEventPopup,
    selectedBuildingTypeId,
    selectedModuleId,
    selectedPersonId,
    screen,
    paused,
    ticks,
    days,
    messages,
  };
}

function migrateSavePayload(payload: SavePayload): SavePayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Save-Daten sind ungültig.');
  }
  if (typeof payload.version !== 'number') {
    throw new Error('Save-Version fehlt oder ist ungültig.');
  }
  if (payload.version !== SAVE_VERSION) {
    throw new Error(`Save-Version ${payload.version} wird nicht unterstützt.`);
  }
  if (!('state' in payload)) {
    throw new Error('Save enthält keinen Spielstand.');
  }
  return payload;
}

export function serializeGameState(game: GameState): string {
  const safeState = sanitizeGameState(game);
  const payload: SavePayload = {
    version: SAVE_VERSION,
    state: safeState,
  };
  return JSON.stringify(payload);
}

export function deserializeGameState(serialized: string): GameState {
  let parsed: SavePayload;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    throw new Error('Save konnte nicht gelesen werden.');
  }
  const migrated = migrateSavePayload(parsed);
  const game = sanitizeGameState(migrated.state);
  syncModuleIdCounterFromModules(game.modules);
  return game;
}

export function getSaveSlotKey(slotId: string): string {
  return `${SAVE_KEY_PREFIX}${slotId}`;
}

function ensureLocalStorage(): Storage {
  if (typeof localStorage === 'undefined') {
    throw new Error('localStorage ist nicht verfügbar.');
  }
  return localStorage;
}

export function saveGameStateToSlot(slotId: string, game: GameState): void {
  const storage = ensureLocalStorage();
  const serialized = serializeGameState(game);
  storage.setItem(getSaveSlotKey(slotId), serialized);
}

export function loadGameStateFromSlot(slotId: string): GameState | null {
  const storage = ensureLocalStorage();
  const raw = storage.getItem(getSaveSlotKey(slotId));
  if (!raw) return null;
  try {
    return deserializeGameState(raw);
  } catch (error) {
    console.error('Konnte Save nicht laden:', error);
    return null;
  }
}
