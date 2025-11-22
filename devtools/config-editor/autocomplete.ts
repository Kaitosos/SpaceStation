// devtools/config-editor/autocomplete.ts
import { BUILDING_TYPES, QUALIFICATION_CONFIGS, RESOURCE_CONFIGS } from '../../src/config.js';

export interface ConfigSuggestionLists {
  resourceNames: string[];
  buildingIds: string[];
  qualificationCodes: string[];
}

export const createSuggestionLists = (): ConfigSuggestionLists => {
  const resourceNames = RESOURCE_CONFIGS.filter((res) => res.enabledByDefault).map((res) => res.name);
  const buildingIds = BUILDING_TYPES.filter((building) => building.enabled).map((building) => building.id);
  const qualificationCodes = QUALIFICATION_CONFIGS.filter((qual) => qual.enabled).map((qual) => qual.code);

  return {
    resourceNames,
    buildingIds,
    qualificationCodes,
  };
};
