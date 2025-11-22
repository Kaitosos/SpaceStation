// devtools/config-editor/configEditor.ts
import {
  BUILDING_TYPES,
  EVENT_CONFIGS,
  QUALIFICATION_CONFIGS,
  RESOURCE_CONFIGS,
} from '../../src/config.js';
import {
  BuildingType,
  Comparator,
  ConditionConfig,
  EventConfig,
  Qualification,
  QuestFlagChange,
  QuestTimerChange,
  ResourceConfig,
  ResourceDelta,
  ResourceConditionConfig,
  TimeConditionConfig,
  TranslationTable,
  TranslationTableEntry,
  EventOption,
} from '../../src/types.js';
import { TRANSLATION_TABLES } from '../../src/translationTables.js';
import { createSuggestionLists } from './autocomplete.js';
import { createConditionWizard } from './conditionWizard.js';
import {
  createValidationContext,
  validateBuildings,
  validateConditions,
  validateQualifications,
  validateResourceDeltas,
  ValidationIssue,
} from './validators.js';

interface EditorState {
  resources: ResourceConfig[];
  buildings: BuildingType[];
  qualifications: Qualification[];
  events: EventConfig[];
  translationTables: TranslationTable[];
}

type TabKey = 'resources' | 'buildings' | 'qualifications' | 'events' | 'translations';

const isDevEnvironment = (): boolean => {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '';
};

const cloneState = (): EditorState => ({
  resources: JSON.parse(JSON.stringify(RESOURCE_CONFIGS)),
  buildings: JSON.parse(JSON.stringify(BUILDING_TYPES)),
  qualifications: JSON.parse(JSON.stringify(QUALIFICATION_CONFIGS)),
  events: JSON.parse(JSON.stringify(EVENT_CONFIGS)),
  translationTables: JSON.parse(JSON.stringify(TRANSLATION_TABLES)),
});

const state: EditorState = cloneState();
const suggestions = createSuggestionLists();
let validationContext = createValidationContext(state.resources, state.buildings, state.qualifications);

const selection: Record<TabKey, number> = {
  resources: 0,
  buildings: 0,
  qualifications: 0,
  events: 0,
  translations: 0,
};

let activeTab: TabKey = 'resources';

const field = (
  label: string,
  input: HTMLElement,
  helper?: string,
): HTMLElement => {
  const wrapper = document.createElement('label');
  wrapper.className = 'devcfg-field';

  const title = document.createElement('div');
  title.className = 'devcfg-label';
  title.textContent = label;
  wrapper.appendChild(title);

  input.classList.add('devcfg-input');
  wrapper.appendChild(input);

  if (helper) {
    const note = document.createElement('div');
    note.className = 'devcfg-helper';
    note.textContent = helper;
    wrapper.appendChild(note);
  }

  return wrapper;
};

const renderValidation = (
  wrapper: HTMLElement,
  input: HTMLInputElement | HTMLTextAreaElement,
  issue: ValidationIssue | null,
  applySuggestion?: (replacement: string) => void,
): void => {
  const existing = wrapper.querySelector('.devcfg-validation');
  if (existing) existing.remove();

  input.classList.toggle('devcfg-error', Boolean(issue));
  if (!issue) return;

  const hint = document.createElement('div');
  hint.className = 'devcfg-validation';
  hint.textContent =
    issue.invalidValues.length === 1
      ? `Ungültiger ${issue.type === 'resource' ? 'Ressourcenname' : issue.type === 'building' ? 'Gebäude-ID' : 'Qualifikationscode'}: ${
          issue.invalidValues[0]
        }`
      : `Ungültige ${
          issue.type === 'resource' ? 'Ressourcen' : issue.type === 'building' ? 'Gebäude-IDs' : 'Qualifikationscodes'
        }: ${issue.invalidValues.join(', ')}`;

  if (issue.suggestions.length && applySuggestion) {
    const quickfix = document.createElement('div');
    quickfix.className = 'devcfg-quickfix';

    const label = document.createElement('span');
    label.textContent = 'Quickfix:';
    quickfix.appendChild(label);

    const select = document.createElement('select');
    issue.suggestions.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    quickfix.appendChild(select);

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Anwenden';
    button.addEventListener('click', () => applySuggestion(select.value));
    quickfix.appendChild(button);

    hint.appendChild(quickfix);
  }

  wrapper.appendChild(hint);
};

const attachValidation = (
  wrapper: HTMLElement,
  input: HTMLInputElement | HTMLTextAreaElement,
  compute: () => ValidationIssue | null,
  applySuggestion?: (replacement: string) => void,
): void => {
  const update = (): void => renderValidation(wrapper, input, compute(), applySuggestion);
  input.addEventListener('input', update);
  update();
};

const datalistCache = new Map<string, HTMLDataListElement>();

const attachSuggestions = (input: HTMLInputElement, key: string, values: string[]): void => {
  if (!values.length) return;

  let list = datalistCache.get(key);
  if (!list) {
    list = document.createElement('datalist');
    list.id = `devcfg-${key}`;
    document.body.appendChild(list);
    datalistCache.set(key, list);
  }

  list.innerHTML = '';
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    list?.appendChild(option);
  });

  input.setAttribute('list', list.id);
};

const createTextInput = (
  value: string,
  onChange: (val: string) => void,
  autocompleteKey?: string,
): HTMLInputElement => {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.addEventListener('input', () => onChange(input.value));
  if (autocompleteKey) {
    const values =
      autocompleteKey === 'resources'
        ? suggestions.resourceNames
        : autocompleteKey === 'buildings'
          ? suggestions.buildingIds
          : suggestions.qualificationCodes;
    attachSuggestions(input, autocompleteKey, values);
  }
  return input;
};

const createNumberInput = (
  value: number,
  onChange: (val: number) => void,
  step = '1',
): HTMLInputElement => {
  const input = document.createElement('input');
  input.type = 'number';
  input.step = step;
  input.value = String(value);
  input.addEventListener('input', () => onChange(Number(input.value || 0)));
  return input;
};

const createCheckbox = (value: boolean, onChange: (val: boolean) => void): HTMLInputElement => {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = value;
  input.addEventListener('change', () => onChange(input.checked));
  return input;
};

const formatResourceDeltas = (deltas: ResourceDelta[]): string =>
  deltas.map((d) => `${d.resource}:${d.amount}`).join('\n');

const parseResourceDeltas = (text: string): ResourceDelta[] =>
  text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [resource, amount] = line.split(':');
      return { resource: resource?.trim() ?? '', amount: Number(amount ?? 0) } as ResourceDelta;
    })
    .filter((d) => d.resource.length > 0);

const addSubheading = (container: HTMLElement, title: string): void => {
  const h = document.createElement('h3');
  h.textContent = title;
  container.appendChild(h);
};

const formatTranslationEntries = (entries: TranslationTableEntry[]): string =>
  entries.map((entry) => `${entry.value}:${entry.label}`).join('\n');

const parseTranslationEntries = (text: string): TranslationTableEntry[] =>
  text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, label] = line.split(':');
      return { value: Number(value ?? 0), label: (label ?? '').trim() } as TranslationTableEntry;
    })
    .filter((entry) => entry.label.length > 0);

const formatQuestChanges = (changes?: (QuestFlagChange | QuestTimerChange)[]): string =>
  (changes || [])
    .map((c) =>
      c.op === 'delete' ? `${c.id},delete` : `${c.id},${c.op},${c.value === undefined ? 0 : c.value}`,
    )
    .join('\n');

const parseQuestChanges = (text: string): (QuestFlagChange | QuestTimerChange)[] =>
  text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, op, value] = line.split(',').map((s) => s.trim());
      const operation = op === 'delete' ? 'delete' : op === 'add' ? 'add' : 'set';
      const parsedValue = Number(value ?? 0);
      return { id, op: operation, value: isNaN(parsedValue) ? 0 : parsedValue } as QuestFlagChange;
    });

const formatConditions = (conditions: ConditionConfig[]): string =>
  conditions
    .map((cond) => {
      if (cond.type === 'resource') {
        return `resource:${cond.resource},${cond.comparator},${cond.value}`;
      }
      if (cond.type === 'questFlag') {
        return `questFlag:${cond.flag},${cond.comparator},${cond.value}`;
      }
      if (cond.type === 'questTimer') {
        return `questTimer:${cond.timer},${cond.comparator},${cond.value}`;
      }
      const parts = [] as string[];
      if (cond.ticksGte !== undefined) parts.push(`ticksGte=${cond.ticksGte}`);
      if (cond.daysGte !== undefined) parts.push(`daysGte=${cond.daysGte}`);
      return `time:${parts.join(',') || 'ticksGte=0'}`;
    })
    .join('\n');

const createResourceCard = (config: ResourceConfig, container: HTMLElement): void => {
  const card = document.createElement('div');
  card.className = 'devcfg-card';

  card.appendChild(field('Name', createTextInput(config.name, (v) => (config.name = v), 'resources')));
  card.appendChild(
    field('Hat Maximum?', createCheckbox(config.hasMax, (v) => (config.hasMax = v)), 'Max-Wert steuerbar?'),
  );
  card.appendChild(
    field(
      'Initial (Aktuell)',
      createNumberInput(config.initialCurrent, (v) => (config.initialCurrent = v), '0.1'),
      'Startwert für aktuellen Bestand',
    ),
  );
  card.appendChild(
    field(
      'Initial (Max)',
      createNumberInput(config.initialMax ?? 0, (v) => (config.initialMax = v), '0.1'),
      'Optional, nur relevant wenn „Hat Maximum“',
    ),
  );
  card.appendChild(
    field('Standard aktiviert?', createCheckbox(config.enabledByDefault, (v) => (config.enabledByDefault = v))),
  );

  container.appendChild(card);
};

const createBuildingCard = (building: BuildingType, container: HTMLElement): void => {
  const card = document.createElement('div');
  card.className = 'devcfg-card';

  card.appendChild(field('ID', createTextInput(building.id, (v) => (building.id = v))));
  card.appendChild(field('Name', createTextInput(building.name, (v) => (building.name = v))));
  card.appendChild(field('Kurzname', createTextInput(building.shortName, (v) => (building.shortName = v))));
  card.appendChild(field('Beschreibung', createTextInput(building.description, (v) => (building.description = v))));
  card.appendChild(field('Typ', createTextInput(building.type, (v) => (building.type = v))));
  card.appendChild(field('Aktiv im Build-Menü?', createCheckbox(building.enabled, (v) => (building.enabled = v))));
  card.appendChild(
    field(
      'Standard aktiv?',
      createCheckbox(Boolean(building.activeByDefault), (v) => (building.activeByDefault = v)),
    ),
  );
  card.appendChild(
    field(
      'Arbeitsplätze',
      createNumberInput(building.workerMax ?? 0, (v) => (building.workerMax = v)),
      '0 bedeutet keine Zuweisung möglich',
    ),
  );
  card.appendChild(
    field(
      'Größe (BxH)',
      createTextInput(`${building.size.width}x${building.size.height}`, (v) => {
        const [w, h] = v.split('x').map((n) => Number(n.trim() || '0'));
        building.size = { width: w, height: h };
      }),
      'Format: BreitexHöhe, z.B. 2x2',
    ),
  );
  const costArea = document.createElement('textarea');
  costArea.value = formatResourceDeltas(building.cost);
  costArea.addEventListener('input', () => (building.cost = parseResourceDeltas(costArea.value)));
  const costField = field('Kosten (resource:amount pro Zeile)', costArea);
  attachValidation(
    costField,
    costArea,
    () => validateResourceDeltas(building.cost, validationContext),
    (replacement) => {
      const target = validateResourceDeltas(building.cost, validationContext)?.invalidValues[0];
      if (!target) return;
      building.cost = building.cost.map((delta) => (delta.resource === target ? { ...delta, resource: replacement } : delta));
      costArea.value = formatResourceDeltas(building.cost);
    },
  );
  card.appendChild(costField);

  const perTickArea = document.createElement('textarea');
  perTickArea.value = formatResourceDeltas(building.perTick);
  perTickArea.addEventListener('input', () => (building.perTick = parseResourceDeltas(perTickArea.value)));
  const perTickField = field('Tick-Effekte', perTickArea, 'Positive oder negative Werte, pro Zeile ein Eintrag');
  attachValidation(
    perTickField,
    perTickArea,
    () => validateResourceDeltas(building.perTick, validationContext),
    (replacement) => {
      const target = validateResourceDeltas(building.perTick, validationContext)?.invalidValues[0];
      if (!target) return;
      building.perTick = building.perTick.map((delta) =>
        delta.resource === target ? { ...delta, resource: replacement } : delta,
      );
      perTickArea.value = formatResourceDeltas(building.perTick);
    },
  );
  card.appendChild(perTickField);

  const maxBonusArea = document.createElement('textarea');
  maxBonusArea.value = formatResourceDeltas(building.maxBonus);
  maxBonusArea.addEventListener('input', () => (building.maxBonus = parseResourceDeltas(maxBonusArea.value)));
  const maxBonusField = field('Max-Bonus', maxBonusArea, 'Steigert Max-Werte von Ressourcen');
  attachValidation(
    maxBonusField,
    maxBonusArea,
    () => validateResourceDeltas(building.maxBonus, validationContext),
    (replacement) => {
      const target = validateResourceDeltas(building.maxBonus, validationContext)?.invalidValues[0];
      if (!target) return;
      building.maxBonus = building.maxBonus.map((delta) =>
        delta.resource === target ? { ...delta, resource: replacement } : delta,
      );
      maxBonusArea.value = formatResourceDeltas(building.maxBonus);
    },
  );
  card.appendChild(maxBonusField);
  const requiredInput = createTextInput((building.requiredQualifications ?? []).join(', '), (v) => {
    const list = v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    building.requiredQualifications = list;
  }, 'qualifications');
  const requiredField = field('Benötigte Qualifikationen (code, Komma-getrennt)', requiredInput);
  attachValidation(
    requiredField,
    requiredInput,
    () => validateQualifications(building.requiredQualifications ?? [], validationContext),
    (replacement) => {
      const target = validateQualifications(building.requiredQualifications ?? [], validationContext)?.invalidValues[0];
      if (!target) return;
      const updated = (building.requiredQualifications ?? []).map((code) => (code === target ? replacement : code));
      building.requiredQualifications = updated;
      requiredInput.value = updated.join(', ');
    },
  );
  card.appendChild(requiredField);

  const bonusInput = createTextInput((building.bonusQualifications ?? []).join(', '), (v) => {
    const list = v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    building.bonusQualifications = list;
  }, 'qualifications');
  const bonusField = field('Bonus-Qualifikationen (code, Komma-getrennt)', bonusInput);
  attachValidation(
    bonusField,
    bonusInput,
    () => validateQualifications(building.bonusQualifications ?? [], validationContext),
    (replacement) => {
      const target = validateQualifications(building.bonusQualifications ?? [], validationContext)?.invalidValues[0];
      if (!target) return;
      const updated = (building.bonusQualifications ?? []).map((code) => (code === target ? replacement : code));
      building.bonusQualifications = updated;
      bonusInput.value = updated.join(', ');
    },
  );
  card.appendChild(bonusField);

  container.appendChild(card);
};

const createQualificationCard = (qualification: Qualification, container: HTMLElement): void => {
  const card = document.createElement('div');
  card.className = 'devcfg-card';

  card.appendChild(field('Code', createTextInput(qualification.code, (v) => (qualification.code = v), 'qualifications')));
  card.appendChild(field('Titel', createTextInput(qualification.title, (v) => (qualification.title = v))));
  card.appendChild(field('Aktiv?', createCheckbox(qualification.enabled, (v) => (qualification.enabled = v))));
  const qualCostArea = document.createElement('textarea');
  qualCostArea.value = formatResourceDeltas(qualification.costs);
  qualCostArea.addEventListener('input', () => (qualification.costs = parseResourceDeltas(qualCostArea.value)));
  const qualCostField = field('Kosten (resource:amount pro Zeile)', qualCostArea);
  attachValidation(
    qualCostField,
    qualCostArea,
    () => validateResourceDeltas(qualification.costs, validationContext),
    (replacement) => {
      const target = validateResourceDeltas(qualification.costs, validationContext)?.invalidValues[0];
      if (!target) return;
      qualification.costs = qualification.costs.map((delta) =>
        delta.resource === target ? { ...delta, resource: replacement } : delta,
      );
      qualCostArea.value = formatResourceDeltas(qualification.costs);
    },
  );
  card.appendChild(qualCostField);
  card.appendChild(
    field(
      'Lernzeit',
      createNumberInput(qualification.learningDuration, (v) => (qualification.learningDuration = v)),
      'Anzahl Ticks bis Abschluss',
    ),
  );

  container.appendChild(card);
};

const createDefaultOption = (id: string): EventOption => ({
  id,
  text: 'Neue Option',
  explanation: '',
  effects: [],
  enableBuildings: [],
  enableQualifications: [],
  questFlagChanges: [],
  questTimerChanges: [],
});

const createEventCard = (event: EventConfig, container: HTMLElement): void => {
  const card = document.createElement('div');
  card.className = 'devcfg-card';

  card.appendChild(field('ID', createTextInput(event.id, (v) => (event.id = v))));
  card.appendChild(field('Titel', createTextInput(event.title, (v) => (event.title = v))));
  card.appendChild(
    field(
      'Nachricht',
      (() => {
        const area = document.createElement('textarea');
        area.value = event.message;
        area.addEventListener('input', () => (event.message = area.value));
        return area;
      })(),
    ),
  );
  card.appendChild(field('Einmalig?', createCheckbox(Boolean(event.once), (v) => (event.once = v))));

  const conditionWizard = createConditionWizard({
    onAdd: (condition) => {
      event.conditions.push(condition);
      renderConfigEditor();
    },
    resourceSuggestions: suggestions.resourceNames,
  });
  card.appendChild(conditionWizard);

  addSubheading(
    card,
    'Bedingungen (pro Zeile z. B. resource:oxygen,lte,20 oder time:ticksGte=60 oder questFlag:flag_id,eq,1)',
  );
  const conditionArea = document.createElement('textarea');
  conditionArea.value = formatConditions(event.conditions);
  conditionArea.addEventListener('input', () => {
    const parsed: ConditionConfig[] = conditionArea.value
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [kind, rest] = line.split(':');
        if (kind === 'time') {
          const cond: TimeConditionConfig = { type: 'time' };
          (rest || '')
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean)
            .forEach((entry) => {
              const [k, v] = entry.split('=');
              const num = Number(v ?? '0');
              if (k === 'ticksGte') cond.ticksGte = num;
              if (k === 'daysGte') cond.daysGte = num;
            });
          return cond;
        }
        if (kind === 'questFlag') {
          const [flag, comparator, value] = (rest || '').split(',').map((s) => s.trim());
          const cmp: Comparator = ['lt', 'lte', 'gt', 'gte', 'eq', 'neq'].includes(comparator as Comparator)
            ? (comparator as Comparator)
            : 'eq';
          return { type: 'questFlag', flag: flag || 'flag', comparator: cmp, value: Number(value || 0) };
        }
        if (kind === 'questTimer') {
          const [timer, comparator, value] = (rest || '').split(',').map((s) => s.trim());
          const cmp: Comparator = ['lt', 'lte', 'gt', 'gte', 'eq', 'neq'].includes(comparator as Comparator)
            ? (comparator as Comparator)
            : 'eq';
          return { type: 'questTimer', timer: timer || 'timer', comparator: cmp, value: Number(value || 0) };
        }
        const [resource, comparator, value] = (rest || '').split(',').map((s) => s.trim());
        const cmp: Comparator = ['lt', 'lte', 'gt', 'gte', 'eq', 'neq'].includes(comparator as Comparator)
          ? (comparator as Comparator)
          : 'gte';
        const cond: ResourceConditionConfig = {
          type: 'resource',
          resource: resource || 'resource',
          comparator: cmp,
          value: Number(value || 0),
        };
        return cond;
    });
    event.conditions = parsed;
  });
  const conditionField = field('Bedingungen', conditionArea);
  attachValidation(
    conditionField,
    conditionArea,
    () => validateConditions(event.conditions, validationContext),
    (replacement) => {
      const invalid = validateConditions(event.conditions, validationContext)?.invalidValues[0];
      if (!invalid) return;
      event.conditions = event.conditions.map((cond) =>
        cond.type === 'resource' && cond.resource === invalid ? { ...cond, resource: replacement } : cond,
      );
      conditionArea.value = formatConditions(event.conditions);
    },
  );
  card.appendChild(conditionField);

  addSubheading(card, 'Optionen');
  const nextOptionId = (): string => `option_${event.options.length + 1}`;
  const optionSnippets: { label: string; create: () => EventOption }[] = [
    {
      label: 'Basis-Option mit Freischaltungen',
      create: () => createDefaultOption(nextOptionId()),
    },
    {
      label: 'Quest-Option mit Standardwerten',
      create: () => ({
        ...createDefaultOption(nextOptionId()),
        text: 'Quest-Update',
        questFlagChanges: [{ id: 'quest_flag', op: 'set', value: 0 }],
        questTimerChanges: [{ id: 'quest_timer', op: 'set', value: 0 }],
      }),
    },
  ];

  const snippetWrap = document.createElement('div');
  snippetWrap.className = 'devcfg-card';
  const snippetTitle = document.createElement('h4');
  snippetTitle.textContent = 'Option-Snippets';
  snippetWrap.appendChild(snippetTitle);

  const snippetHint = document.createElement('p');
  snippetHint.textContent = 'Fügt Optionen mit vorausgefüllten Effekten, Freischaltungen und Quest-Änderungen hinzu.';
  snippetWrap.appendChild(snippetHint);

  const snippetButtons = document.createElement('div');
  snippetButtons.className = 'devcfg-snippet-buttons';
  optionSnippets.forEach((snippet) => {
    const btn = document.createElement('button');
    btn.textContent = snippet.label;
    btn.addEventListener('click', () => {
      event.options.push(snippet.create());
      renderConfigEditor();
    });
    snippetButtons.appendChild(btn);
  });
  snippetWrap.appendChild(snippetButtons);
  card.appendChild(snippetWrap);
  event.options.forEach((option, idx) => {
    const optWrap = document.createElement('div');
    optWrap.className = 'devcfg-card';

    optWrap.appendChild(field('Option-ID', createTextInput(option.id, (v) => (option.id = v))));
    optWrap.appendChild(field('Text', createTextInput(option.text, (v) => (option.text = v))));
    optWrap.appendChild(
      field(
        'Erklärung (optional)',
        (() => {
          const area = document.createElement('textarea');
          area.value = option.explanation ?? '';
          area.addEventListener('input', () => (option.explanation = area.value || undefined));
          return area;
        })(),
      ),
    );
    const effectsArea = document.createElement('textarea');
    effectsArea.value = formatResourceDeltas(option.effects || []);
    effectsArea.addEventListener('input', () => (option.effects = parseResourceDeltas(effectsArea.value)));
    const effectsField = field('Effekte', effectsArea);
    attachValidation(
      effectsField,
      effectsArea,
      () => validateResourceDeltas(option.effects || [], validationContext),
      (replacement) => {
        const target = validateResourceDeltas(option.effects || [], validationContext)?.invalidValues[0];
        if (!target) return;
        option.effects = (option.effects || []).map((delta) =>
          delta.resource === target ? { ...delta, resource: replacement } : delta,
        );
        effectsArea.value = formatResourceDeltas(option.effects || []);
      },
    );
    optWrap.appendChild(effectsField);
    optWrap.appendChild(
      field(
        'Quest-Flags (id,op,value pro Zeile)',
        (() => {
          const area = document.createElement('textarea');
          area.value = formatQuestChanges(option.questFlagChanges);
          area.addEventListener('input', () => {
            option.questFlagChanges = parseQuestChanges(area.value) as QuestFlagChange[];
          });
          return area;
        })(),
        'op: set | add | delete',
      ),
    );
    optWrap.appendChild(
      field(
        'Quest-Timer (id,op,value pro Zeile)',
        (() => {
          const area = document.createElement('textarea');
          area.value = formatQuestChanges(option.questTimerChanges);
          area.addEventListener('input', () => {
            option.questTimerChanges = parseQuestChanges(area.value) as QuestTimerChange[];
          });
          return area;
        })(),
        'op: set | add | delete',
      ),
    );
    const enableBuildingsInput = createTextInput((option.enableBuildings ?? []).join(', '), (v) => {
      const ids = v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      option.enableBuildings = ids.length ? ids : undefined;
    }, 'buildings');
    const enableBuildingsField = field('Gebäude freischalten (ID, Komma-getrennt)', enableBuildingsInput, 'Optional');
    attachValidation(
      enableBuildingsField,
      enableBuildingsInput,
      () => validateBuildings(option.enableBuildings ?? [], validationContext),
      (replacement) => {
        const invalid = validateBuildings(option.enableBuildings ?? [], validationContext)?.invalidValues[0];
        if (!invalid) return;
        const updated = (option.enableBuildings ?? []).map((id) => (id === invalid ? replacement : id));
        option.enableBuildings = updated.length ? updated : undefined;
        enableBuildingsInput.value = updated.join(', ');
      },
    );
    optWrap.appendChild(enableBuildingsField);

    const enableQualificationsInput = createTextInput((option.enableQualifications ?? []).join(', '), (v) => {
      const ids = v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      option.enableQualifications = ids.length ? ids : undefined;
    }, 'qualifications');
    const enableQualificationsField = field(
      'Qualifikationen freischalten (Code, Komma-getrennt)',
      enableQualificationsInput,
      'Optional',
    );
    attachValidation(
      enableQualificationsField,
      enableQualificationsInput,
      () => validateQualifications(option.enableQualifications ?? [], validationContext),
      (replacement) => {
        const invalid = validateQualifications(option.enableQualifications ?? [], validationContext)?.invalidValues[0];
        if (!invalid) return;
        const updated = (option.enableQualifications ?? []).map((id) => (id === invalid ? replacement : id));
        option.enableQualifications = updated.length ? updated : undefined;
        enableQualificationsInput.value = updated.join(', ');
      },
    );
    optWrap.appendChild(enableQualificationsField);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Option entfernen';
    deleteBtn.addEventListener('click', () => {
      event.options.splice(idx, 1);
      renderConfigEditor();
    });
    optWrap.appendChild(deleteBtn);

    card.appendChild(optWrap);
  });
  
  const addOpt = document.createElement('button');
  addOpt.textContent = 'Option hinzufügen';
  addOpt.addEventListener('click', () => {
    const nextIndex = event.options.length + 1;
    event.options.push(createDefaultOption(`option_${nextIndex}`));
    renderConfigEditor();
  });
  card.appendChild(addOpt);

  container.appendChild(card);
};

const createTranslationCard = (table: TranslationTable, container: HTMLElement, onDelete: () => void): void => {
  const card = document.createElement('div');
  card.className = 'devcfg-card';

  card.appendChild(field('ID', createTextInput(table.id, (v) => (table.id = v))));
  card.appendChild(field('Name', createTextInput(table.name, (v) => (table.name = v))));
  card.appendChild(
    field(
      'Fallback-Label (optional)',
      createTextInput(table.defaultLabel ?? '', (v) => (table.defaultLabel = v || undefined)),
      'Wird genutzt, wenn kein Eintrag gefunden wird',
    ),
  );
  card.appendChild(
    field(
      'Einträge (value:Label pro Zeile)',
      (() => {
        const area = document.createElement('textarea');
        area.value = formatTranslationEntries(table.entries);
        area.addEventListener('input', () => (table.entries = parseTranslationEntries(area.value)));
        return area;
      })(),
      'Leere Zeilen werden ignoriert',
    ),
  );

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Tabelle löschen';
  deleteBtn.addEventListener('click', onDelete);
  card.appendChild(deleteBtn);

  container.appendChild(card);
};

const newResource = (): ResourceConfig => ({
  name: 'neue_ressource',
  hasMax: false,
  initialCurrent: 0,
  initialMax: 0,
  enabledByDefault: true,
});

const newBuilding = (): BuildingType => ({
  id: 'neues_gebaeude',
  name: 'Neues Gebäude',
  shortName: 'Neu',
  description: 'Beschreibung',
  type: 'misc',
  enabled: true,
  activeByDefault: false,
  workerMax: 0,
  size: { width: 1, height: 1 },
  cost: [],
  perTick: [],
  maxBonus: [],
  requiredQualifications: [],
  bonusQualifications: [],
});

const newQualification = (): Qualification => ({
  code: 'neu_qual',
  title: 'Neue Qualifikation',
  costs: [],
  enabled: true,
  learningDuration: 1,
});

const newEvent = (): EventConfig => ({
  id: 'neues_event',
  title: 'Neues Event',
  message: 'Beschreibung des Events',
  once: false,
  conditions: [],
  options: [createDefaultOption('option_1')],
});

const newTranslationTable = (): TranslationTable => ({
  id: 'neue_tabelle',
  name: 'Neue Tabelle',
  entries: [],
});

const ensureSelectionInRange = (): void => {
  const clamp = (key: TabKey, listLength: number): void => {
    if (listLength === 0) {
      selection[key] = 0;
      return;
    }
    selection[key] = Math.min(selection[key], listLength - 1);
    selection[key] = Math.max(selection[key], 0);
  };

  clamp('resources', state.resources.length);
  clamp('buildings', state.buildings.length);
  clamp('qualifications', state.qualifications.length);
  clamp('events', state.events.length);
  clamp('translations', state.translationTables.length);
};

const generateConfigTs = (): string => {
  const toJSON = (obj: unknown): string => JSON.stringify(obj, null, 2);
  return `// Auto-generiert vom Dev Config Editor\n` +
    `export const RESOURCE_CONFIGS = ${toJSON(state.resources)} as const;\n` +
    `export const BUILDING_TYPES = ${toJSON(state.buildings)} as const;\n` +
    `export const QUALIFICATION_CONFIGS = ${toJSON(state.qualifications)} as const;\n` +
    `export const EVENT_CONFIGS = ${toJSON(state.events)} as const;\n` +
    `export const TRANSLATION_TABLES = ${toJSON(state.translationTables)} as const;\n`;
};

const downloadConfig = (): void => {
  const blob = new Blob([generateConfigTs()], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'config.ts';
  a.click();
  URL.revokeObjectURL(url);
};

const renderConfigEditor = (): void => {
  const existing = document.getElementById('dev-config-editor');
  if (existing) existing.remove();

  ensureSelectionInRange();
  validationContext = createValidationContext(state.resources, state.buildings, state.qualifications);

  const overlay = document.createElement('div');
  overlay.id = 'dev-config-editor';

  const header = document.createElement('div');
  header.className = 'devcfg-header';
  const title = document.createElement('h1');
  title.textContent = 'Config Editor (Dev)';
  header.appendChild(title);

  const actions = document.createElement('div');
  actions.className = 'devcfg-header-actions';

  const reset = document.createElement('button');
  reset.textContent = 'Zurücksetzen';
  reset.addEventListener('click', () => {
    Object.assign(state, cloneState());
    renderConfigEditor();
  });
  actions.appendChild(reset);

  const exportBtn = document.createElement('button');
  exportBtn.textContent = 'config.ts exportieren';
  exportBtn.addEventListener('click', downloadConfig);
  actions.appendChild(exportBtn);

  header.appendChild(actions);
  overlay.appendChild(header);

  const content = document.createElement('div');
  content.className = 'devcfg-content';

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'resources', label: 'Ressourcen' },
    { key: 'buildings', label: 'Gebäude' },
    { key: 'qualifications', label: 'Qualifikationen' },
    { key: 'events', label: 'Events' },
    { key: 'translations', label: 'Translation Tables' },
  ];

  const tabNav = document.createElement('div');
  tabNav.className = 'devcfg-tabs';
  tabs.forEach((tab) => {
    const btn = document.createElement('button');
    btn.textContent = tab.label;
    btn.className = `devcfg-tab ${activeTab === tab.key ? 'active' : ''}`;
    btn.addEventListener('click', () => {
      activeTab = tab.key;
      renderConfigEditor();
    });
    tabNav.appendChild(btn);
  });

  const tabContent = document.createElement('div');
  tabContent.className = 'devcfg-tab-content';

  const renderListWithDetails = <T,>(
    items: T[],
    key: TabKey,
    labelSelector: (item: T, index: number) => string,
    add: () => void,
    renderCard: (item: T, container: HTMLElement) => void,
  ): void => {
    const panel = document.createElement('div');
    panel.className = 'devcfg-tab-panel';

    const list = document.createElement('div');
    list.className = 'devcfg-tab-list';

    const listHeader = document.createElement('div');
    listHeader.className = 'devcfg-tab-list-header';
    const listTitle = document.createElement('span');
    listTitle.textContent = `${items.length} Einträge`;
    listHeader.appendChild(listTitle);

    const addBtn = document.createElement('button');
    addBtn.textContent = 'Neu erstellen';
    addBtn.addEventListener('click', () => {
      add();
      selection[key] = items.length - 1;
      renderConfigEditor();
    });
    listHeader.appendChild(addBtn);

    list.appendChild(listHeader);

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'devcfg-empty';
      empty.textContent = 'Keine Einträge vorhanden.';
      list.appendChild(empty);
    }

    items.forEach((item, idx) => {
      const entry = document.createElement('button');
      entry.className = `devcfg-list-item ${selection[key] === idx ? 'active' : ''}`;
      entry.textContent = labelSelector(item, idx);
      entry.addEventListener('click', () => {
        selection[key] = idx;
        renderConfigEditor();
      });
      list.appendChild(entry);
    });

    const detail = document.createElement('div');
    detail.className = 'devcfg-tab-detail';

    if (items.length > 0) {
      const selected = items[selection[key]];
      renderCard(selected, detail);
    } else {
      const empty = document.createElement('div');
      empty.className = 'devcfg-card';
      empty.textContent = 'Füge einen Eintrag hinzu, um Details zu bearbeiten.';
      detail.appendChild(empty);
    }

    panel.appendChild(list);
    panel.appendChild(detail);
    tabContent.appendChild(panel);
  };

  switch (activeTab) {
    case 'resources':
      renderListWithDetails<ResourceConfig>(
        state.resources,
        'resources',
        (item, idx) => item.name || `Ressource ${idx + 1}`,
        () => state.resources.push(newResource()),
        (item, container) => createResourceCard(item, container),
      );
      break;
    case 'buildings':
      renderListWithDetails<BuildingType>(
        state.buildings,
        'buildings',
        (item, idx) => item.name || `Gebäude ${idx + 1}`,
        () => state.buildings.push(newBuilding()),
        (item, container) => createBuildingCard(item, container),
      );
      break;
    case 'qualifications':
      renderListWithDetails<Qualification>(
        state.qualifications,
        'qualifications',
        (item, idx) => item.title || `Qualifikation ${idx + 1}`,
        () => state.qualifications.push(newQualification()),
        (item, container) => createQualificationCard(item, container),
      );
      break;
    case 'events':
      renderListWithDetails<EventConfig>(
        state.events,
        'events',
        (item, idx) => item.title || `Event ${idx + 1}`,
        () => state.events.push(newEvent()),
        (item, container) => createEventCard(item, container),
      );
      break;
    case 'translations':
      renderListWithDetails<TranslationTable>(
        state.translationTables,
        'translations',
        (item, idx) => item.name || `Tabelle ${idx + 1}`,
        () => state.translationTables.push(newTranslationTable()),
        (item, container) =>
          createTranslationCard(item, container, () => {
            state.translationTables.splice(selection.translations, 1);
            ensureSelectionInRange();
            renderConfigEditor();
          }),
      );
      break;
  }

  content.appendChild(tabNav);
  content.appendChild(tabContent);
  overlay.appendChild(content);

  const close = document.createElement('button');
  close.id = 'devcfg-close';
  close.textContent = 'Schließen';
  close.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.appendChild(close);

  document.body.appendChild(overlay);
};

const ensureStyles = (): void => {
  if (document.getElementById('devcfg-style')) return;
  const style = document.createElement('style');
  style.id = 'devcfg-style';
  style.textContent = `
    :root {
      --devcfg-bg: #0f172a;
      --devcfg-surface: #111827;
      --devcfg-border: #1f2a44;
      --devcfg-border-strong: #2563eb;
      --devcfg-text: #e5e7eb;
      --devcfg-text-muted: #94a3b8;
      --devcfg-accent: #2563eb;
      --devcfg-accent-strong: #1e3a8a;
      --devcfg-danger: #f43f5e;
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    body { background: var(--devcfg-bg); color: var(--devcfg-text); margin: 0; }

    #dev-config-editor {
      position: fixed;
      inset: 0;
      background: rgba(6, 12, 24, 0.94);
      overflow: auto;
      padding: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    #dev-config-editor.hidden { display: none; }

    .devcfg-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      padding: 12px 16px;
      border: 1px solid var(--devcfg-border);
      border-radius: 12px;
      background: var(--devcfg-surface);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.24);
    }

    .devcfg-header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.2px; }

    .devcfg-header-actions { display: flex; gap: 10px; flex-wrap: wrap; }

    #devcfg-toggle,
    #devcfg-close,
    .devcfg-header-actions button,
    .devcfg-section .devcfg-header button,
    .devcfg-card button {
      border: 1px solid var(--devcfg-border);
      background: var(--devcfg-accent);
      color: #fff;
      padding: 8px 12px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
    }

    #devcfg-toggle:hover,
    #devcfg-close:hover,
    .devcfg-header-actions button:hover,
    .devcfg-section .devcfg-header button:hover,
    .devcfg-card button:hover {
      background: var(--devcfg-accent-strong);
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(37, 99, 235, 0.3);
    }

    #devcfg-toggle,
    #devcfg-close { position: fixed; bottom: 16px; z-index: 10000; }
    #devcfg-toggle { right: 16px; }
    #devcfg-close { left: 16px; background: transparent; color: var(--devcfg-text); border-color: var(--devcfg-border); box-shadow: none; }
    #devcfg-close:hover { background: rgba(255, 255, 255, 0.06); }

    .devcfg-content { display: grid; gap: 16px; }

    .devcfg-tabs { display: grid; grid-auto-flow: column; gap: 8px; width: fit-content; }

    .devcfg-tab {
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid var(--devcfg-border);
      background: rgba(255, 255, 255, 0.03);
      color: var(--devcfg-text);
      cursor: pointer;
      font-weight: 600;
      transition: background 120ms ease, border-color 120ms ease;
    }

    .devcfg-tab.active {
      background: var(--devcfg-accent);
      border-color: var(--devcfg-accent);
      color: #fff;
      box-shadow: 0 8px 18px rgba(37, 99, 235, 0.25);
    }

    .devcfg-tab-content { display: grid; }

    .devcfg-tab-panel {
      display: grid;
      grid-template-columns: 260px 1fr;
      gap: 16px;
      align-items: start;
    }

    .devcfg-tab-list {
      border: 1px solid var(--devcfg-border);
      border-radius: 14px;
      background: var(--devcfg-surface);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
      display: grid;
      gap: 8px;
      padding: 12px;
    }

    .devcfg-tab-list-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 700;
      color: var(--devcfg-text);
    }

    .devcfg-tab-list-header button {
      border: 1px solid var(--devcfg-border);
      background: var(--devcfg-accent);
      color: #fff;
      padding: 8px 10px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: background 120ms ease, transform 120ms ease;
    }

    .devcfg-tab-list-header button:hover { background: var(--devcfg-accent-strong); transform: translateY(-1px); }

    .devcfg-list-item {
      text-align: left;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--devcfg-border);
      background: rgba(255, 255, 255, 0.02);
      color: var(--devcfg-text);
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease;
    }

    .devcfg-list-item:hover { background: rgba(255, 255, 255, 0.05); }

    .devcfg-list-item.active {
      border-color: var(--devcfg-accent);
      background: rgba(37, 99, 235, 0.12);
      color: #fff;
    }

    .devcfg-tab-detail { display: grid; gap: 12px; }

    .devcfg-empty {
      padding: 12px;
      border-radius: 10px;
      border: 1px dashed var(--devcfg-border);
      color: var(--devcfg-text-muted);
      font-style: italic;
    }

    .devcfg-section {
      padding: 16px;
      border: 1px solid var(--devcfg-border);
      border-radius: 14px;
      background: var(--devcfg-surface);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
      display: grid;
      gap: 12px;
    }

    .devcfg-section h2 { margin: 0; font-size: 18px; font-weight: 700; color: var(--devcfg-text); }

    .devcfg-actions { display: flex; justify-content: flex-end; margin-bottom: 8px; }

    .devcfg-list { display: grid; gap: 12px; }

    .devcfg-card {
      border: 1px solid var(--devcfg-border);
      border-radius: 12px;
      padding: 12px;
      display: grid;
      gap: 10px;
      background: #0b1220;
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
    }

    .devcfg-card h3 { margin: 0; font-size: 14px; color: var(--devcfg-text-muted); }

    .devcfg-field { display: grid; gap: 4px; }

    .devcfg-label { font-weight: 600; font-size: 12px; color: var(--devcfg-text-muted); letter-spacing: 0.2px; }

    .devcfg-input {
      width: 100%;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--devcfg-border);
      background: rgba(255, 255, 255, 0.02);
      color: var(--devcfg-text);
      transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
      font-size: 14px;
    }

    .devcfg-input:focus {
      outline: none;
      border-color: var(--devcfg-border-strong);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
      background: rgba(255, 255, 255, 0.04);
    }

    .devcfg-helper { font-size: 12px; color: var(--devcfg-text-muted); }

    .devcfg-validation {
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid var(--devcfg-danger);
      background: rgba(244, 63, 94, 0.08);
      color: var(--devcfg-danger);
      font-size: 12px;
      display: grid;
      gap: 6px;
    }

    .devcfg-quickfix {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .devcfg-quickfix select {
      flex: 1;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--devcfg-border);
      border-radius: 8px;
      color: var(--devcfg-text);
      padding: 6px 8px;
    }

    .devcfg-quickfix button {
      background: var(--devcfg-danger);
      color: #fff;
      border: none;
      padding: 6px 10px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }

    .devcfg-quickfix button:hover { background: #f43f5e; }

    textarea.devcfg-input { min-height: 80px; font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace; resize: vertical; }

    .devcfg-error { border-color: var(--devcfg-danger) !important; box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.35); }
  `;
  document.head.appendChild(style);
};

export const initDevConfigEditor = (): void => {
  if (!isDevEnvironment()) {
    const warning = document.createElement('div');
    warning.style.padding = '20px';
    warning.style.color = '#ff6b81';
    warning.textContent = 'Dieses Tool ist nur für lokale Entwicklungsumgebungen gedacht.';
    document.body.appendChild(warning);
    return;
  }

  ensureStyles();
  renderConfigEditor();

  const toggle = document.createElement('button');
  toggle.id = 'devcfg-toggle';
  toggle.textContent = 'Config Editor öffnen';
  toggle.addEventListener('click', () => {
    const overlay = document.getElementById('dev-config-editor');
    if (overlay) overlay.classList.remove('hidden');
  });
  document.body.appendChild(toggle);
};

document.addEventListener('DOMContentLoaded', initDevConfigEditor);
