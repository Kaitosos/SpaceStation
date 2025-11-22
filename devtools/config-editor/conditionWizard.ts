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

const createNumberInput = (value: number, onChange: (val: number) => void, placeholder?: string): HTMLInputElement => {
  const input = document.createElement('input');
  input.type = 'number';
  input.value = String(value);
  if (placeholder) input.placeholder = placeholder;
  input.addEventListener('input', () => onChange(Number(input.value || 0)));
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

export const createConditionWizard = (options: WizardOptions): HTMLElement => {
  let currentType: ConditionConfig['type'] = 'resource';
  let latestComparator: Comparator = 'gte';

  const wrapper = document.createElement('div');
  wrapper.className = 'devcfg-card';

  const heading = document.createElement('h3');
  heading.textContent = 'Condition Wizard';
  wrapper.appendChild(heading);

  const formArea = document.createElement('div');
  formArea.className = 'devcfg-wizard-form';

  const inputs: Record<string, HTMLInputElement | HTMLSelectElement> = {};

  const renderFields = (): void => {
    formArea.innerHTML = '';
    inputs.resource = createTextInput('', (v) => (inputs.resource.value = v), options.resourceSuggestions, 'Ressourcen-ID', wrapper);
    inputs.flag = createTextInput('', (v) => (inputs.flag.value = v), [], 'Quest-Flag', wrapper);
    inputs.timer = createTextInput('', (v) => (inputs.timer.value = v), [], 'Quest-Timer', wrapper);
    inputs.value = createNumberInput(0, (v) => (inputs.value.value = String(v)), 'Zahl');
    inputs.ticksGte = createNumberInput(0, (v) => (inputs.ticksGte.value = String(v)), 'Ticks');
    inputs.daysGte = createNumberInput(0, (v) => (inputs.daysGte.value = String(v)), 'Tage');

    const comparatorSelect = createSelect(comparators, (val) => {
      latestComparator = val;
    }, latestComparator);
    inputs.comparator = comparatorSelect;

    switch (currentType) {
      case 'resource':
        formArea.appendChild(createField('Ressource', inputs.resource));
        formArea.appendChild(createField('Vergleich', comparatorSelect));
        formArea.appendChild(createField('Schwelle', inputs.value));
        break;
      case 'questFlag':
        formArea.appendChild(createField('Quest-Flag', inputs.flag));
        formArea.appendChild(createField('Vergleich', comparatorSelect));
        formArea.appendChild(createField('Wert', inputs.value));
        break;
      case 'questTimer':
        formArea.appendChild(createField('Quest-Timer', inputs.timer));
        formArea.appendChild(createField('Vergleich', comparatorSelect));
        formArea.appendChild(createField('Wert', inputs.value));
        break;
      case 'time':
        formArea.appendChild(createField('Ticks ≥', inputs.ticksGte, 'Optional'));
        formArea.appendChild(createField('Tage ≥', inputs.daysGte, 'Optional'));
        break;
    }
  };

  const typeSelect = createSelect<ConditionConfig['type']>(
    ['resource', 'time', 'questFlag', 'questTimer'],
    (value) => {
      currentType = value;
      renderFields();
    },
    currentType,
  );

  wrapper.appendChild(createField('Condition-Typ', typeSelect));
  wrapper.appendChild(formArea);

  const addBtn = document.createElement('button');
  addBtn.textContent = 'Bedingung hinzufügen';
  addBtn.addEventListener('click', () => {
    let condition: ConditionConfig;

    if (currentType === 'resource') {
      const cond: ResourceConditionConfig = {
        type: 'resource',
        resource: (inputs.resource as HTMLInputElement).value || 'resource',
        comparator: (inputs.comparator as HTMLSelectElement).value as Comparator,
        value: Number((inputs.value as HTMLInputElement).value || 0),
      };
      condition = cond;
    } else if (currentType === 'questFlag') {
      const cond: QuestFlagConditionConfig = {
        type: 'questFlag',
        flag: (inputs.flag as HTMLInputElement).value || 'flag',
        comparator: (inputs.comparator as HTMLSelectElement).value as Comparator,
        value: Number((inputs.value as HTMLInputElement).value || 0),
      };
      condition = cond;
    } else if (currentType === 'questTimer') {
      const cond: QuestTimerConditionConfig = {
        type: 'questTimer',
        timer: (inputs.timer as HTMLInputElement).value || 'timer',
        comparator: (inputs.comparator as HTMLSelectElement).value as Comparator,
        value: Number((inputs.value as HTMLInputElement).value || 0),
      };
      condition = cond;
    } else {
      const cond: TimeConditionConfig = { type: 'time' };
      const ticksVal = Number((inputs.ticksGte as HTMLInputElement).value || 0);
      const daysVal = Number((inputs.daysGte as HTMLInputElement).value || 0);
      if (!Number.isNaN(ticksVal)) cond.ticksGte = ticksVal;
      if (!Number.isNaN(daysVal)) cond.daysGte = daysVal;
      condition = cond;
    }

    options.onAdd(condition);
    renderFields();
  });
  wrapper.appendChild(addBtn);

  renderFields();
  return wrapper;
};
