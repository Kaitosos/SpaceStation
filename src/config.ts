// src/config.ts
import {
  ResourceConfig,
  BuildingType,
  EventConfig,
} from './types';

export const RESOURCE_CONFIGS: ResourceConfig[] = [
  {
    name: 'energy',
    hasMax: true,
    initialCurrent: 40,
    initialMax: 100,
    enabledByDefault: true,
  },
  {
    name: 'oxygen',
    hasMax: true,
    initialCurrent: 40,
    initialMax: 100,
    enabledByDefault: true,
  },
  {
    name: 'money',
    hasMax: false,
    initialCurrent: 1000,
    enabledByDefault: true,
  },
  {
    name: 'population',
    hasMax: true,
    initialCurrent: 0,
    initialMax: 0,
    enabledByDefault: true,
  },
];

export const BUILDING_TYPES: BuildingType[] = [
  {
    id: 'generator',
    name: 'Generator',
    shortName: 'G',
    description: 'Produziert Energie pro Tick.',
    cost: [{ resource: 'money', amount: 200 }],
    perTick: [{ resource: 'energy', amount: 12 }],
    maxBonus: [],
  },
  {
    id: 'life_support',
    name: 'Lebenserhaltung',
    shortName: 'L',
    description: 'Verbraucht Energie, erzeugt Sauerstoff.',
    cost: [{ resource: 'money', amount: 300 }],
    perTick: [
      { resource: 'energy', amount: -5 },
      { resource: 'oxygen', amount: 15 },
    ],
    maxBonus: [],
  },
  {
    id: 'habitat',
    name: 'Wohnmodul',
    shortName: 'H',
    description: 'Erhöht maximale Bevölkerung, verbraucht etwas Energie.',
    cost: [{ resource: 'money', amount: 250 }],
    perTick: [{ resource: 'energy', amount: -3 }],
    maxBonus: [{ resource: 'population', amount: 5 }],
  },
  {
    id: 'energy_storage',
    name: 'Energiespeicher',
    shortName: 'E',
    description: 'Erhöht maximal speicherbare Energie.',
    cost: [{ resource: 'money', amount: 300 }],
    perTick: [],
    maxBonus: [{ resource: 'energy', amount: 50 }],
  },
  {
    id: 'oxygen_storage',
    name: 'O2-Tank',
    shortName: 'O',
    description: 'Erhöht maximal speicherbaren Sauerstoff.',
    cost: [{ resource: 'money', amount: 300 }],
    perTick: [],
    maxBonus: [{ resource: 'oxygen', amount: 50 }],
  },
  {
    id: 'dock',
    name: 'Dock',
    shortName: 'D',
    description: 'Ermöglicht Zuzug neuer Bewohner & etwas Einkommen.',
    cost: [{ resource: 'money', amount: 400 }],
    perTick: [{ resource: 'money', amount: 2 }],
    maxBonus: [],
  },
];

export const EVENT_CONFIGS: EventConfig[] = [
  {
    id: 'low_oxygen_warning',
    title: 'Sauerstoffwarnung',
    message: 'Die Sauerstoffreserven fallen kritisch. Einige Bewohner werden nervös.',
    once: true,
    conditions: [
      { type: 'resource', resource: 'oxygen', comparator: 'lte', value: 20 },
      { type: 'time', ticksGte: 60 },
    ],
    effects: [
      { resource: 'money', amount: -100 },
    ],
  },
  {
    id: 'investor_arrives',
    title: 'Zwielichtiger Investor',
    message: 'Ein Investor bietet dir eine Einlage an – ohne Fragen zu stellen.',
    once: true,
    conditions: [
      { type: 'resource', resource: 'population', comparator: 'gte', value: 10 },
      { type: 'time', ticksGte: 100 },
    ],
    effects: [
      { resource: 'money', amount: 500 },
    ],
  },
];
