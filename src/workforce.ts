// src/workforce.ts
import { BUILDING_TYPE_MAP } from './buildingTypes.js';
import { QUALIFICATION_CONFIGS } from './config.js';
import { getModuleById } from './buildings.js';
import { applyResourceDeltas, canAfford } from './resources.js';
import { createRandomPerson } from './personGenerator.js';
import { GameState, ModuleState, Person, Qualification } from './types.js';

export function createInitialQualifications(): Qualification[] {
  return QUALIFICATION_CONFIGS.map((q) => ({ ...q, costs: q.costs.map((c) => ({ ...c })) }));
}

export function hasRequiredQualifications(person: Person, module: ModuleState): boolean {
  if (!module.requiredQualifications.length) return true;
  return module.requiredQualifications.every((req) => person.qualifications.includes(req));
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

export function startTraining(game: GameState, personId: string, qualificationCode: string): string | null {
  const person = game.people.find((p) => p.id === personId);
  if (!person) return 'Unbekannte Person.';
  if (person.training) return `${person.name} befindet sich bereits in einer Schulung.`;
  if (person.qualifications.includes(qualificationCode)) return `${person.name} hat diese Qualifikation schon.`;

  const qualification = game.qualifications.find((q) => q.code === qualificationCode);
  if (!qualification || !qualification.enabled) return 'Diese Qualifikation ist noch nicht freigeschaltet.';

  if (!canAfford(game.resources, qualification.costs)) {
    return 'Für die Schulung fehlen Ressourcen.';
  }

  applyResourceDeltas(game.resources, qualification.costs, -1);
  person.training = {
    qualificationCode,
    remainingTicks: qualification.learningDuration,
  };
  person.unavailableFor = Math.max(person.unavailableFor, qualification.learningDuration);
  game.messages.push(`${person.name} startet Schulung: ${qualification.title}.`);
  return null;
}

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
