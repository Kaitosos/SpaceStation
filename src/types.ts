// src/types.ts

export type ResourceName = string;

export interface ResourceDelta {
  resource: ResourceName;
  amount: number;
}

export interface Qualification {
  code: string;
  title: string;
  enabled: boolean;
  costs: ResourceDelta[];
  learningDuration: number;
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

export interface QuestFlagConditionConfig {
  type: 'questFlag';
  flag: string;
  comparator: Comparator;
  value: number;
}

export interface QuestTimerConditionConfig {
  type: 'questTimer';
  timer: string;
  comparator: Comparator;
  value: number;
}

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

export type ConditionConfig =
  | ResourceConditionConfig
  | TimeConditionConfig
  | QuestFlagConditionConfig
  | QuestTimerConditionConfig;

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
  enableBuildings?: string[];
  enableQualifications?: string[];
  questFlagChanges?: QuestFlagChange[];
  questTimerChanges?: QuestTimerChange[];
}

export interface QuestFlagChange {
  id: string;
  op: 'set' | 'add' | 'delete';
  value?: number;
}

export interface QuestTimerChange {
  id: string;
  op: 'set' | 'add' | 'delete';
  value?: number;
}

export interface Person {
  id: string;
  name: string;
  tags: string[];
  incomePerTick: ResourceDelta[];
  needsPerTick: ResourceDelta[];
  work: string | null;
  equipment: string[];
  unavailableFor: number;
  qualifications: string[];
  faceImage?: string;
  bodyImage?: string;
}

export interface Cell {
  x: number;
  y: number;
  buildingTypeId: string | null;
  isRoot?: boolean;
  moduleId?: string | null;
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
  type: string;
  size: { width: number; height: number };
  image?: string;
  enabled: boolean;
  cost: ResourceDelta[];
  perTick: ResourceDelta[];
  maxBonus: ResourceDelta[];
  requiredQualifications?: string[];
  bonusQualifications?: string[];
  workerMax?: number;
  activeByDefault?: boolean;
}

export interface ModuleState {
  id: string;
  typeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  active: boolean;
  requiredQualifications: string[];
  bonusQualifications: string[];
  workers: string[];
  workerMax: number;
}

export interface GameState {
  resources: ResourcesState;
  people: Person[];
  qualifications: Qualification[];
  grid: Grid;
  modules: ModuleState[];
  events: GameEventState[];
  questFlags: Record<string, number>;
  questTimers: Record<string, number>;
  activeEventPopup: ActiveEventPopup | null;
  selectedBuildingTypeId: string | null;
  selectedModuleId: string | null;
  screen: 'build' | 'personnel';
  ticks: number;
  days: number;
  messages: string[]; // Log-Nachrichten aus der Logik
}
