// src/personGenerator.ts
import { QUALIFICATION_CONFIGS } from './config';
import { DataPoint, Person } from './types';

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function createPersonalData(): DataPoint[] {
  return [
    {
      type: 'status',
      name: 'Stimmung',
      value: Math.floor(Math.random() * 4),
      translationTable: 'mood',
    },
    {
      type: 'fitness',
      name: 'Fitness',
      value: Math.floor(Math.random() * 3),
      translationTable: 'fitness',
    },
    {
      type: 'service',
      name: 'Dienstjahre',
      value: Math.max(0, Math.round(Math.random() * 6 - 2)),
      translationTable: null,
    },
  ];
}

export function createRandomPerson(index: number): Person {
  const firstNames = ['Jax', 'Mara', 'Dex', 'Nova', 'Rin', 'Zoe', 'Kade', 'Vex'];
  const lastNames = ['Vega', 'Ishikawa', 'Black', 'Kwon', 'Nyx', 'Ortiz', 'Kade', 'Flux'];
  const id = 'p_' + String(index + 1).padStart(3, '0');

  const startingQualifications = QUALIFICATION_CONFIGS.filter((q) => q.enabled).map((q) => q.code);
  const randomQual = randomFrom(startingQualifications);
  const qualifications = Array.from(new Set([randomQual]));

  return {
    id,
    name: `${randomFrom(firstNames)} ${randomFrom(lastNames)}`,
    tags: ['citizen'],
    incomePerTick: [{ resource: 'money', amount: 0.5 }],
    needsPerTick: [
      { resource: 'oxygen', amount: 0.2 },
      { resource: 'energy', amount: 0.1 },
    ],
    work: null,
    equipment: [],
    unavailableFor: 0,
    qualifications,
    personalData: createPersonalData(),
    faceImage: undefined,
    bodyImage: undefined,
  };
}

export function createInitialPeople(): Person[] {
  const people: Person[] = [];
  for (let i = 0; i < 4; i++) {
    people.push(createRandomPerson(i));
  }
  return people;
}
