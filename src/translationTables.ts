// src/translationTables.ts
import { TranslationTable } from './types';

export const TRANSLATION_TABLES: TranslationTable[] = [
  {
    id: 'mood',
    name: 'Stimmung',
    entries: [
      { value: 0, label: 'Niedergeschlagen' },
      { value: 1, label: 'Neutral' },
      { value: 2, label: 'Zufrieden' },
      { value: 3, label: 'Begeistert' },
    ],
    defaultLabel: 'Unbekannt',
  },
  {
    id: 'fitness',
    name: 'Fitness',
    entries: [
      { value: 0, label: 'Erschöpft' },
      { value: 1, label: 'Belastbar' },
      { value: 2, label: 'Topfit' },
    ],
    defaultLabel: 'Unbekannt',
  },
];

export function getTranslationTable(id: string): TranslationTable | undefined {
  return TRANSLATION_TABLES.find((table) => table.id === id);
}

export function translateValue(tableId: string, value: number): string | null {
  const table = getTranslationTable(tableId);
  if (!table) return null;
  const entry = table.entries.find((e) => e.value === value);
  if (entry) return entry.label;
  return table.defaultLabel ?? null;
}
