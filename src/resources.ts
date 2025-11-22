// src/resources.ts
import { RESOURCE_CONFIGS } from './config.js';
import { BUILDING_TYPE_MAP } from './buildingTypes.js';
import { GameState, ResourceConfig, ResourceDelta, ResourcesState, ResourceState } from './types.js';

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

function applyBoundedDelta(res: ResourceState, delta: number): void {
  res.current += delta;
  if (res.max !== undefined) {
    res.current = Math.min(res.max, Math.max(0, res.current));
  } else {
    res.current = Math.max(0, res.current);
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
    applyBoundedDelta(res, sign * d.amount);
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

export function recalcResourceMaximums(game: GameState): void {
  const maxBonus: Record<string, number> = {};
  for (const name in game.resources) {
    maxBonus[name] = 0;
  }

  for (const module of game.modules) {
    const type = BUILDING_TYPE_MAP.get(module.typeId);
    if (!type) continue;
    addResourceChangesToDelta(maxBonus, type.maxBonus, +1);
  }

  for (const resName in game.resources) {
    const res = game.resources[resName];
    const cfg: ResourceConfig | undefined = RESOURCE_CONFIGS.find((c) => c.name === resName);
    if (!cfg || !cfg.hasMax) continue;
    const baseMax = cfg.initialMax ?? 0;
    const bonus = maxBonus[resName] || 0;
    res.max = baseMax + bonus;
  }
}

export function applyBoundedDeltaToResource(res: ResourceState, delta: number): void {
  applyBoundedDelta(res, delta);
}
