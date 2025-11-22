// devtools/config-editor/validators.ts
import { BuildingType, ConditionConfig, Qualification, ResourceConfig, ResourceDelta } from '../../src/types.js';

export type ValidationType = 'resource' | 'building' | 'qualification';

export interface ValidationIssue {
  type: ValidationType;
  invalidValues: string[];
  suggestions: string[];
}

export interface ValidationContext {
  resourceNames: string[];
  buildingIds: string[];
  qualificationCodes: string[];
}

export const createValidationContext = (
  resources: ResourceConfig[],
  buildings: BuildingType[],
  qualifications: Qualification[],
): ValidationContext => ({
  resourceNames: resources.map((res) => res.name),
  buildingIds: buildings.map((b) => b.id),
  qualificationCodes: qualifications.map((q) => q.code),
});

const buildIssue = (
  type: ValidationType,
  invalidValues: string[],
  suggestions: string[],
): ValidationIssue | null => {
  if (!invalidValues.length) return null;
  return { type, invalidValues, suggestions };
};

export const validateResources = (
  values: string[],
  context: ValidationContext,
): ValidationIssue | null => {
  const invalidValues = values.filter((value) => value && !context.resourceNames.includes(value));
  return buildIssue('resource', invalidValues, context.resourceNames);
};

export const validateBuildings = (
  values: string[],
  context: ValidationContext,
): ValidationIssue | null => {
  const invalidValues = values.filter((value) => value && !context.buildingIds.includes(value));
  return buildIssue('building', invalidValues, context.buildingIds);
};

export const validateQualifications = (
  values: string[],
  context: ValidationContext,
): ValidationIssue | null => {
  const invalidValues = values.filter((value) => value && !context.qualificationCodes.includes(value));
  return buildIssue('qualification', invalidValues, context.qualificationCodes);
};

export const validateResourceDeltas = (
  deltas: ResourceDelta[],
  context: ValidationContext,
): ValidationIssue | null => validateResources(deltas.map((delta) => delta.resource), context);

export const validateConditions = (
  conditions: ConditionConfig[],
  context: ValidationContext,
): ValidationIssue | null => {
  const resources = conditions
    .filter((cond): cond is Extract<ConditionConfig, { type: 'resource' }> => cond.type === 'resource')
    .map((cond) => cond.resource);
  return validateResources(resources, context);
};
