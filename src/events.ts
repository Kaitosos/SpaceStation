// src/events.ts
import { BUILDING_TYPE_MAP } from './buildingTypes.js';
import { EVENT_CONFIGS } from './config.js';
import { applyResourceDeltas } from './resources.js';
import {
  Comparator,
  ConditionConfig,
  EventConfig,
  EventOption,
  GameEventState,
  GameState,
  QuestFlagChange,
  QuestTimerChange,
} from './types.js';

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

export function createInitialEvents(): GameEventState[] {
  return EVENT_CONFIGS.map((cfg) => ({
    config: cfg,
    hasTriggered: false,
  }));
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
  if (cond.type === 'questFlag') {
    const value = game.questFlags[cond.flag] ?? 0;
    return checkComparator(value, cond.comparator, cond.value);
  }
  if (cond.type === 'questTimer') {
    const value = game.questTimers[cond.timer] ?? 0;
    return checkComparator(value, cond.comparator, cond.value);
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

export function applyEventOptionAndClose(game: GameState, option: EventOption): void {
  const popup = game.activeEventPopup;
  if (!popup) return;

  applyResourceDeltas(game.resources, option.effects, +1);

  const applyQuestChanges = (
    changes: (QuestFlagChange | QuestTimerChange)[] | undefined,
    store: Record<string, number>,
  ): void => {
    if (!changes) return;
    for (const change of changes) {
      const current = store[change.id] ?? 0;
      if (change.op === 'delete') {
        delete store[change.id];
        continue;
      }
      const value = change.value ?? 0;
      if (change.op === 'set') {
        store[change.id] = value;
        continue;
      }
      if (change.op === 'add') {
        store[change.id] = current + value;
      }
    }
  };

  applyQuestChanges(option.questFlagChanges, game.questFlags);
  applyQuestChanges(option.questTimerChanges, game.questTimers);

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
