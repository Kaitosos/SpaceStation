// src/buildingTypes.ts
import { BUILDING_TYPES } from './config.js';

export const BUILDING_TYPE_MAP = new Map(BUILDING_TYPES.map((t) => [t.id, t]));

export function getBuildingType(id: string) {
  return BUILDING_TYPE_MAP.get(id);
}
