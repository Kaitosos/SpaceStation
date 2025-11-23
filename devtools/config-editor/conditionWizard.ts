// devtools/config-editor/conditionWizard.ts
import {
  Comparator,
  ConditionConfig,
  QuestFlagConditionConfig,
  QuestTimerConditionConfig,
  ResourceConditionConfig,
  TimeConditionConfig,
} from '../../src/types.js';

interface WizardOptions {
  onAdd: (condition: ConditionConfig) => void;
  resourceSuggestions: string[];
}

type WizardConditionState = {
  type: ConditionConfig['type'];
  comparator: Comparator;
  resource: string;
  value?: number;
  flag: string;
  timer: string;
  ticksGte?: number;
  daysGte?: number;
};

const comparators: Comparator[] = ['lt', 'lte', 'gt', 'gte', 'eq', 'neq'];

const createField = (label: string, input: HTMLElement, helper?: string): HTMLElement => {
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

const createSelect = <T extends string>(
  values: T[],
  onChange: (value: T) => void,
  selected?: T,
): HTMLSelectElement => {
  const select = document.createElement('select');
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    option.selected = selected === value;
    select.appendChild(option);
  });
  select.addEventListener('change', () => onChange(select.value as T));
  return select;
};

const createNumberInput = (
  value: number | undefined,
  onChange: (val: number | undefined) => void,
  placeholder?: string,
): HTMLInputElement => {
  const input = document.createElement('input');
  input.type = 'number';
  input.value = value === undefined ? '' : String(value);
  if (placeholder) input.placeholder = placeholder;
  input.addEventListener('input', () => {
    const num = input.value === '' ? undefined : Number(input.value);
    onChange(Number.isNaN(num as number) ? undefined : (num as number));
  });
  return input;
};

const createTextInput = (
  value: string,
  onChange: (val: string) => void,
  suggestions: string[] = [],
  placeholder?: string,
  datalistContainer?: HTMLElement,
): HTMLInputElement => {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  if (placeholder) input.placeholder = placeholder;
  input.addEventListener('input', () => onChange(input.value));

  if (suggestions.length) {
    const list = document.createElement('datalist');
    const id = `devcfg-wizard-${Math.random().toString(36).slice(2)}`;
    list.id = id;
    suggestions.forEach((valueSuggestion) => {
      const option = document.createElement('option');
      option.value = valueSuggestion;
      list.appendChild(option);
    });
    (datalistContainer ?? document.body).appendChild(list);
    input.setAttribute('list', id);
  }

  return input;
};

const mergeTimeCondition = (state: WizardConditionState): TimeConditionConfig => {
  const condition: TimeConditionConfig = { type: 'time' };
  const hasTicks = typeof state.ticksGte === 'number';
  const hasDays = typeof state.daysGte === 'number';
  if (hasTicks) condition.ticksGte = state.ticksGte;
  if (hasDays) condition.daysGte = state.daysGte;
  if (!hasTicks && !hasDays) {
    condition.ticksGte = 0;
  }
  return condition;
};

export const createConditionWizard = (options: WizardOptions): HTMLElement => {
  const state: WizardConditionState = {
    type: 'resource',
    comparator: 'gte',
    resource: '',
    value: 0,
    flag: '',
    timer: '',
  };

  const wrapper = document.createElement('div');
  wrapper.className = 'devcfg-card';

  const heading = document.createElement('h3');
  heading.textContent = 'Condition Wizard';
  wrapper.appendChild(heading);

  const intro = document.createElement('p');
  intro.textContent = 'Wähle den Condition-Typ aus und fülle die passenden Felder aus.';
  wrapper.appendChild(intro);

  const formArea = document.createElement('div');
  formArea.className = 'devcfg-wizard-form';

  const renderFields = (): void => {
    formArea.innerHTML = '';

    const comparatorSelect = createSelect(comparators, (val) => {
      state.comparator = val;
    }, state.comparator);

    switch (state.type) {
      case 'resource': {
        formArea.appendChild(
          createField(
            'Ressource',
            createTextInput(state.resource, (v) => (state.resource = v), options.resourceSuggestions, 'Ressourcen-ID', wrapper),
          ),
        );
        formArea.appendChild(createField('Vergleich', comparatorSelect));
        formArea.appendChild(
          createField('Schwelle', createNumberInput(state.value, (v) => (state.value = v ?? 0), 'Zahl')),
        );
        break;
      }
      case 'questFlag': {
        formArea.appendChild(
          createField('Quest-Flag', createTextInput(state.flag, (v) => (state.flag = v), [], 'quest_flag', wrapper)),
        );
        formArea.appendChild(createField('Vergleich', comparatorSelect));
        formArea.appendChild(createField('Wert', createNumberInput(state.value, (v) => (state.value = v ?? 0), 'Zahl')));
        break;
      }
      case 'questTimer': {
        formArea.appendChild(
          createField('Quest-Timer', createTextInput(state.timer, (v) => (state.timer = v), [], 'quest_timer', wrapper)),
        );
        formArea.appendChild(createField('Vergleich', comparatorSelect));
        formArea.appendChild(createField('Wert', createNumberInput(state.value, (v) => (state.value = v ?? 0), 'Zahl')));
        break;
      }
      case 'time': {
        formArea.appendChild(
          createField('Ticks ≥', createNumberInput(state.ticksGte, (v) => (state.ticksGte = v), 'Optional')), 
        );
        formArea.appendChild(
          createField('Tage ≥', createNumberInput(state.daysGte, (v) => (state.daysGte = v), 'Optional')),
        );
        break;
      }
    }
  };

  const typeSelect = createSelect<ConditionConfig['type']>(
    ['resource', 'time', 'questFlag', 'questTimer'],
    (value) => {
      state.type = value;
      renderFields();
    },
    state.type,
  );

  wrapper.appendChild(createField('Condition-Typ', typeSelect));
  wrapper.appendChild(formArea);

  const addBtn = document.createElement('button');
  addBtn.textContent = 'Bedingung hinzufügen';
  addBtn.addEventListener('click', () => {
    let condition: ConditionConfig;

    if (state.type === 'resource') {
      const cond: ResourceConditionConfig = {
        type: 'resource',
        resource: state.resource || options.resourceSuggestions[0] || 'resource',
        comparator: state.comparator,
        value: state.value ?? 0,
      };
      condition = cond;
    } else if (state.type === 'questFlag') {
      const cond: QuestFlagConditionConfig = {
        type: 'questFlag',
        flag: state.flag || 'quest_flag',
        comparator: state.comparator,
        value: state.value ?? 0,
      };
      condition = cond;
    } else if (state.type === 'questTimer') {
      const cond: QuestTimerConditionConfig = {
        type: 'questTimer',
        timer: state.timer || 'quest_timer',
        comparator: state.comparator,
        value: state.value ?? 0,
      };
      condition = cond;
    } else {
      condition = mergeTimeCondition(state);
    }

    options.onAdd(condition);

    state.resource = '';
    state.flag = '';
    state.timer = '';
    state.value = 0;
    state.ticksGte = undefined;
    state.daysGte = undefined;
    renderFields();
  });
  wrapper.appendChild(addBtn);

  renderFields();
  return wrapper;
};
