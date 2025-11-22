// src/core.ts
import { BUILDING_TYPE_MAP } from './buildingTypes.js';
import { createInitialEvents, checkEvents } from './events.js';
import { createGrid, rebuildGridFromModules } from './buildings.js';
import {
  addResourceChangesToDelta,
  applyBoundedDeltaToResource,
  createInitialResources,
  recalcResourceMaximums,
} from './resources.js';
import { createInitialPeople } from './personGenerator.js';
import { createInitialQualifications, hasRequiredQualifications, trySpawnNewPerson } from './workforce.js';
import { GameState, Person } from './types.js';

export { addResourceChangesToDelta, applyResourceDeltas, canAfford } from './resources.js';
export { placeBuildingAt, toggleModuleActive } from './buildings.js';
export { assignPersonToModule } from './workforce.js';
export { evaluateCondition, areAllConditionsMet, checkEvents, applyEventOptionAndClose } from './events.js';

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

  const game: GameState = {
    resources,
    people,
    qualifications,
    grid,
    modules: [],
    events,
    questFlags: {},
    questTimers: {},
    activeEventPopup: null,
    selectedBuildingTypeId: null,
    selectedModuleId: null,
    selectedPersonId: null,
    screen: 'mainMenu',
    paused: true,
    ticks: 0,
    days: 0,
    messages: [],
  };

  const startType = BUILDING_TYPE_MAP.get('habitat');
  if (startType) {
    const startX = Math.floor((grid.width - startType.size.width) / 2);
    const startY = Math.floor((grid.height - startType.size.height) / 2);
    const module = {
      id: 'm_000',
      typeId: 'habitat',
      x: startX,
      y: startY,
      width: startType.size.width,
      height: startType.size.height,
      active: startType.activeByDefault ?? true,
      requiredQualifications: startType.requiredQualifications ? [...startType.requiredQualifications] : [],
      bonusQualifications: startType.bonusQualifications ? [...startType.bonusQualifications] : [],
      workers: [],
      workerMax: startType.workerMax ?? 0,
    };
    game.modules.push(module);
    rebuildGridFromModules(game);
    recalcResourceMaximums(game);
    game.selectedModuleId = module.id;
    game.messages.push('Startmodul im Zentrum platziert.');
  }

  return game;
}

export function updateGameTick(game: GameState): void {
  game.ticks++;
  if (game.ticks % 40 === 0) {
    game.days++;
  }

  for (const timerId in game.questTimers) {
    const value = game.questTimers[timerId];
    if (value <= 0) continue;
    game.questTimers[timerId] = Math.max(0, value - 1);
  }

  const resources = game.resources;
  const delta: Record<string, number> = {};
  for (const name in resources) {
    delta[name] = 0;
  }

  for (const person of game.people) {
    if (person.unavailableFor > 0) {
      person.unavailableFor--;
      if (person.unavailableFor < 0) person.unavailableFor = 0;
    }
    const training = person.training;
    if (training) {
      training.remainingTicks -= 1;
      if (training.remainingTicks <= 0) {
        if (!person.qualifications.includes(training.qualificationCode)) {
          person.qualifications.push(training.qualificationCode);
        }
        const qualTitle =
          game.qualifications.find((q) => q.code === training.qualificationCode)?.title || training.qualificationCode;
        game.messages.push(`${person.name} hat die Schulung ${qualTitle} abgeschlossen.`);
        person.training = undefined;
        person.unavailableFor = Math.max(0, person.unavailableFor);
      }
    }
  }

  // Modul-Effekte
  for (const module of game.modules) {
    const type = BUILDING_TYPE_MAP.get(module.typeId);
    if (!type) continue;

    // Basisproduktion (auch wenn nicht aktiv)
    addResourceChangesToDelta(delta, type.perTick, +1);

    if (!module.active) continue;

    const activeWorkers = module.workers
      .map((id) => game.people.find((p) => p.id === id))
      .filter(
        (p): p is Person => !!p && p.work === module.id && p.unavailableFor <= 0 && hasRequiredQualifications(p, module),
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

  recalcResourceMaximums(game);

  // Deltas anwenden
  for (const resName in resources) {
    const res = resources[resName];
    const d = delta[resName] || 0;
    res.deltaPerTick = d;

    if (resName === 'population') {
      continue; // wird unten gesetzt
    }

    applyBoundedDeltaToResource(res, d);
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
