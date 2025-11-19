// src/types.ts

export type ResourceName = string;

export interface ResourceDelta {
  resource: ResourceName;
  amount: number;
}

export interface ResourceConfig {
  name: ResourceName;
  hasMax: boolean;
  initialCurrent: number;
  initialMax?: number;
  enabledByDefault: boolean;
}

export interface ResourceState {
  name: ResourceName;
  enabled: boolean;
  current: number;
  max?: number;
  deltaPerTick: number;
}

export type ResourcesState = Record<ResourceName, ResourceState>;

export type Comparator = 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'neq';

export interface ResourceConditionConfig {
  type: 'resource';
  resource: ResourceName;
  comparator: Comparator;
  value: number;
}

export interface TimeConditionConfig {
  type: 'time';
  ticksGte?: number;
  daysGte?: number;
}

export type ConditionConfig = ResourceConditionConfig | TimeConditionConfig;

export interface EventConfig {
  id: string;
  title: string;
  message: string;
  once: boolean;
  conditions: ConditionConfig[];
  options: EventOption[];
}

export interface GameEventState {
  config: EventConfig;
  hasTriggered: boolean;
}

export interface ActiveEventPopup {
  id: string;
  title: string;
  message: string;
  options: EventOption[];
}

export interface EventOption {
  id: string;
  text: string;
  explanation?: string;
  effects: ResourceDelta[];
}

export interface Person {
  id: string;
  name: string;
  tags: string[];
  incomePerTick: ResourceDelta[];
  needsPerTick: ResourceDelta[];
}

export interface Cell {
  x: number;
  y: number;
  buildingTypeId: string | null;
}

export interface Grid {
  width: number;
  height: number;
  cells: Cell[];
}

export interface BuildingType {
  id: string;
  name: string;
  shortName: string;
  description: string;
  cost: ResourceDelta[];
  perTick: ResourceDelta[];
  maxBonus: ResourceDelta[];
}

export interface GameState {
  resources: ResourcesState;
  people: Person[];
  grid: Grid;
  events: GameEventState[];
  activeEventPopup: ActiveEventPopup | null;
  selectedBuildingTypeId: string | null;
  ticks: number;
  days: number;
  messages: string[]; // Log-Nachrichten aus der Logik
}