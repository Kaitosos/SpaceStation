// devtools/config-editor/configEditor.ts
import {
  BUILDING_TYPES,
  EVENT_CONFIGS,
  QUALIFICATION_CONFIGS,
  RESOURCE_CONFIGS,
} from '../../src/config';
import {
  BuildingType,
  EventConfig,
  Qualification,
  ResourceConfig,
  ResourceDelta,
} from '../../src/types';

interface EditorState {
  resources: ResourceConfig[];
  buildings: BuildingType[];
  qualifications: Qualification[];
  events: EventConfig[];
}

const isDevEnvironment = (): boolean => {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '';
};

const cloneState = (): EditorState => ({
  resources: JSON.parse(JSON.stringify(RESOURCE_CONFIGS)),
  buildings: JSON.parse(JSON.stringify(BUILDING_TYPES)),
  qualifications: JSON.parse(JSON.stringify(QUALIFICATION_CONFIGS)),
  events: JSON.parse(JSON.stringify(EVENT_CONFIGS)),
});

const state: EditorState = cloneState();

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

const createTextInput = (
  value: string,
  onChange: (val: string) => void,
): HTMLInputElement => {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.addEventListener('input', () => onChange(input.value));
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

const createResourceCard = (config: ResourceConfig, container: HTMLElement): void => {
  const card = document.createElement('div');
  card.className = 'devcfg-card';

  card.appendChild(field('Name', createTextInput(config.name, (v) => (config.name = v))));
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
  card.appendChild(
    field(
      'Kosten (resource:amount pro Zeile)',
      (() => {
        const area = document.createElement('textarea');
        area.value = formatResourceDeltas(building.cost);
        area.addEventListener('input', () => (building.cost = parseResourceDeltas(area.value)));
        return area;
      })(),
    ),
  );
  card.appendChild(
    field(
      'Tick-Effekte',
      (() => {
        const area = document.createElement('textarea');
        area.value = formatResourceDeltas(building.perTick);
        area.addEventListener('input', () => (building.perTick = parseResourceDeltas(area.value)));
        return area;
      })(),
      'Positive oder negative Werte, pro Zeile ein Eintrag',
    ),
  );
  card.appendChild(
    field(
      'Max-Bonus',
      (() => {
        const area = document.createElement('textarea');
        area.value = formatResourceDeltas(building.maxBonus);
        area.addEventListener('input', () => (building.maxBonus = parseResourceDeltas(area.value)));
        return area;
      })(),
      'Steigert Max-Werte von Ressourcen',
    ),
  );
  card.appendChild(
    field(
      'Benötigte Qualifikationen (code, Komma-getrennt)',
      createTextInput(building.requiredQualifications.join(', '), (v) => {
        building.requiredQualifications = v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }),
    ),
  );
  card.appendChild(
    field(
      'Bonus-Qualifikationen (code, Komma-getrennt)',
      createTextInput(building.bonusQualifications.join(', '), (v) => {
        building.bonusQualifications = v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }),
    ),
  );

  container.appendChild(card);
};

const createQualificationCard = (qualification: Qualification, container: HTMLElement): void => {
  const card = document.createElement('div');
  card.className = 'devcfg-card';

  card.appendChild(field('Code', createTextInput(qualification.code, (v) => (qualification.code = v))));
  card.appendChild(field('Titel', createTextInput(qualification.title, (v) => (qualification.title = v))));
  card.appendChild(field('Aktiv?', createCheckbox(qualification.enabled, (v) => (qualification.enabled = v))));
  card.appendChild(
    field(
      'Kosten (resource:amount pro Zeile)',
      (() => {
        const area = document.createElement('textarea');
        area.value = formatResourceDeltas(qualification.costs);
        area.addEventListener('input', () => (qualification.costs = parseResourceDeltas(area.value)));
        return area;
      })(),
    ),
  );
  card.appendChild(
    field(
      'Lernzeit',
      createNumberInput(qualification.learningDuration, (v) => (qualification.learningDuration = v)),
      'Anzahl Ticks bis Abschluss',
    ),
  );

  container.appendChild(card);
};

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

  addSubheading(card, 'Bedingungen (code:wert pro Zeile)');
  const conditionArea = document.createElement('textarea');
  conditionArea.value = event.conditions
    .map((cond) => `${cond.resource || cond.qualification || cond.flag || 'code'}:${cond.threshold || 0}`)
    .join('\n');
  conditionArea.addEventListener('input', () => {
    event.conditions = conditionArea.value
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [code, threshold] = line.split(':');
        return { resource: code, threshold: Number(threshold || 0) };
      });
  });
  card.appendChild(conditionArea);

  addSubheading(card, 'Optionen');
  event.options.forEach((option, idx) => {
    const optWrap = document.createElement('div');
    optWrap.className = 'devcfg-card';

    optWrap.appendChild(field('Label', createTextInput(option.label, (v) => (option.label = v))));
    optWrap.appendChild(
      field(
        'Effekte',
        (() => {
          const area = document.createElement('textarea');
          area.value = formatResourceDeltas(option.effects || []);
          area.addEventListener('input', () => (option.effects = parseResourceDeltas(area.value)));
          return area;
        })(),
      ),
    );
    optWrap.appendChild(
      field(
        'Folge-Event-ID',
        createTextInput(option.followupEventId ?? '', (v) => (option.followupEventId = v || undefined)),
        'Optional',
      ),
    );

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
    event.options.push({ label: 'Neue Option', effects: [], followupEventId: undefined });
    renderConfigEditor();
  });
  card.appendChild(addOpt);

  container.appendChild(card);
};

const renderSection = (
  container: HTMLElement,
  title: string,
  renderList: (list: HTMLElement) => void,
  onAdd: () => void,
): void => {
  const section = document.createElement('section');
  section.className = 'devcfg-section';

  const header = document.createElement('div');
  header.className = 'devcfg-header';

  const h = document.createElement('h2');
  h.textContent = title;
  header.appendChild(h);

  const addBtn = document.createElement('button');
  addBtn.textContent = `${title} hinzufügen`;
  addBtn.addEventListener('click', onAdd);
  header.appendChild(addBtn);

  section.appendChild(header);

  const list = document.createElement('div');
  list.className = 'devcfg-list';
  renderList(list);
  section.appendChild(list);

  container.appendChild(section);
};

const generateConfigTs = (): string => {
  const toJSON = (obj: unknown): string => JSON.stringify(obj, null, 2);
  return `// Auto-generiert vom Dev Config Editor\n` +
    `export const RESOURCE_CONFIGS = ${toJSON(state.resources)} as const;\n` +
    `export const BUILDING_TYPES = ${toJSON(state.buildings)} as const;\n` +
    `export const QUALIFICATION_CONFIGS = ${toJSON(state.qualifications)} as const;\n` +
    `export const EVENT_CONFIGS = ${toJSON(state.events)} as const;\n`;
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

  renderSection(
    content,
    'Ressourcen',
    (list) => {
      list.replaceChildren();
      state.resources.forEach((cfg) => createResourceCard(cfg, list));
    },
    () => {
      state.resources.push({
        name: 'neue_ressource',
        hasMax: false,
        initialCurrent: 0,
        enabledByDefault: true,
      });
      renderConfigEditor();
    },
  );

  renderSection(
    content,
    'Gebäude',
    (list) => {
      list.replaceChildren();
      state.buildings.forEach((cfg) => createBuildingCard(cfg, list));
    },
    () => {
      state.buildings.push({
        id: 'new_building',
        name: 'Neues Gebäude',
        shortName: 'N',
        description: '',
        type: 'allgemein',
        size: { width: 1, height: 1 },
        enabled: true,
        cost: [],
        perTick: [],
        maxBonus: [],
        requiredQualifications: [],
        bonusQualifications: [],
        workerMax: 0,
      });
      renderConfigEditor();
    },
  );

  renderSection(
    content,
    'Qualifikationen',
    (list) => {
      list.replaceChildren();
      state.qualifications.forEach((cfg) => createQualificationCard(cfg, list));
    },
    () => {
      state.qualifications.push({
        code: 'new_qualification',
        title: 'Neue Qualifikation',
        enabled: true,
        costs: [],
        learningDuration: 0,
      });
      renderConfigEditor();
    },
  );

  renderSection(
    content,
    'Events',
    (list) => {
      list.replaceChildren();
      state.events.forEach((cfg) => createEventCard(cfg, list));
    },
    () => {
      state.events.push({
        id: 'new_event',
        title: 'Neues Event',
        message: '',
        once: false,
        conditions: [],
        options: [],
      });
      renderConfigEditor();
    },
  );

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
