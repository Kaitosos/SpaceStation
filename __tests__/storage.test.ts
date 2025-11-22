// @ts-nocheck
const assert = require('node:assert');
const test = require('node:test');
const {
  serializeGameState,
  deserializeGameState,
  saveGameStateToSlot,
  loadGameStateFromSlot,
  getSaveSlotKey,
} = require('../src/storage');
const { placeBuildingAt } = require('../src/buildings');

function createMinimalGrid() {
  return { width: 1, height: 1, cells: [{ x: 0, y: 0, buildingTypeId: null, isRoot: true, moduleId: null }] };
}

function createMinimalGameState() {
  return {
    resources: {},
    people: [],
    qualifications: [],
    grid: createMinimalGrid(),
    modules: [],
    events: [],
    questFlags: {},
    questTimers: {},
    activeEventPopup: null,
    selectedBuildingTypeId: null,
    selectedModuleId: null,
    selectedPersonId: null,
    screen: 'mainMenu',
    paused: false,
    ticks: 0,
    days: 0,
    messages: [],
  };
}

test('serializeGameState wraps payload with version and sanitizes values', () => {
  const game = createMinimalGameState();
  game.resources = {
    energy: { name: 'energy', enabled: true, current: Infinity, max: 10, deltaPerTick: 1 },
  };

  const serialized = serializeGameState(game);
  const parsed = JSON.parse(serialized);

  assert.strictEqual(parsed.version, 1);
  assert.strictEqual(parsed.state.resources.energy.current, 0);
});

test('deserializeGameState validates version and corrupt payloads', () => {
  assert.throws(() => deserializeGameState('{'), /Save konnte nicht gelesen werden/);
  const unsupported = JSON.stringify({ version: 99, state: {} });
  assert.throws(() => deserializeGameState(unsupported), /wird nicht unterstützt/);
});

test('deserializeGameState sanitizes incoming structures', () => {
  const payload = {
    version: 1,
    state: {
      resources: {
        energy: { name: 'energy', enabled: true, current: 'bad', max: 10, deltaPerTick: 1 },
      },
      people: [
        { id: 'p1', name: 'Valid', tags: ['a'], incomePerTick: [{ resource: 'energy', amount: 1 }] },
        { id: 5, name: 'Invalid' },
      ],
      qualifications: [
        { code: 'tech', title: 'Tech', enabled: 'yes', learningDuration: 2, costs: [{ resource: 'energy', amount: 1 }] },
      ],
      grid: createMinimalGrid(),
      modules: [
        {
          id: 'm1',
          typeId: 'habitat',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          active: true,
          requiredQualifications: ['q1'],
          bonusQualifications: 'oops',
          workers: ['p1'],
          workerMax: 1,
        },
        { id: null },
      ],
      events: [
        {
          hasTriggered: true,
          config: {
            id: 'e1',
            title: 'Test',
            message: 'msg',
            options: [{ id: 'opt', text: 'Do it', effects: [{ resource: 'energy', amount: 2 }] }],
          },
        },
      ],
      questFlags: { a: 1, b: 'nope' },
      questTimers: { timer: 5 },
      activeEventPopup: { id: 'pop', title: 'T', message: 'M', options: [{ id: 'o', text: 'x' }] },
      selectedBuildingTypeId: 'generator',
      selectedModuleId: 'm1',
      selectedPersonId: 'p1',
      screen: 'build',
      paused: true,
      ticks: 10,
      days: 2,
      messages: ['ok'],
    },
  };

  const game = deserializeGameState(JSON.stringify(payload));

  assert.strictEqual(game.resources.energy.current, 0);
  assert.strictEqual(game.people.length, 1);
  assert.strictEqual(game.qualifications[0].enabled, false);
  assert.strictEqual(game.modules.length, 1);
  assert.deepStrictEqual(game.questFlags, { a: 1 });
});

test('saveGameStateToSlot and loadGameStateFromSlot persist using prefixed keys', () => {
  const storage = new Map();
  global.localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
  };

  const game = createMinimalGameState();
  saveGameStateToSlot('A', game);

  const storedValue = storage.get(getSaveSlotKey('A'));
  assert.ok(storedValue, 'value should be stored under prefixed key');

  const loaded = loadGameStateFromSlot('A');
  assert.ok(loaded);
  assert.strictEqual(loaded.screen, 'mainMenu');
});

test('loadGameStateFromSlot returns null and logs on corrupt save', () => {
  const storage = new Map();
  let errorCalled = false;
  global.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  const originalError = console.error;
  console.error = () => {
    errorCalled = true;
  };

  storage.set(getSaveSlotKey('B'), 'not-json');
  const result = loadGameStateFromSlot('B');

  console.error = originalError;
  assert.strictEqual(result, null);
  assert.strictEqual(errorCalled, true);
});

test('deserializeGameState restores module ID counter so new builds increment correctly', () => {
  const grid = { width: 6, height: 6, cells: [] };
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      grid.cells.push({ x, y, buildingTypeId: null, isRoot: false, moduleId: null });
    }
  }

  // Existing module occupying a 2x2 area starting at (1,1)
  const occupied = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
  ];
  for (const { x, y } of occupied) {
    const idx = y * grid.width + x;
    grid.cells[idx].buildingTypeId = 'generator';
    grid.cells[idx].moduleId = 'm_010';
    grid.cells[idx].isRoot = x === 1 && y === 1;
  }

  const payload = {
    version: 1,
    state: {
      resources: {
        money: { name: 'money', enabled: true, current: 1000, max: 1000, deltaPerTick: 0 },
      },
      people: [],
      qualifications: [],
      grid,
      modules: [
        {
          id: 'm_010',
          typeId: 'generator',
          x: 1,
          y: 1,
          width: 2,
          height: 2,
          active: true,
          requiredQualifications: [],
          bonusQualifications: [],
          workers: [],
          workerMax: 2,
        },
      ],
      events: [],
      questFlags: {},
      questTimers: {},
      activeEventPopup: null,
      selectedBuildingTypeId: 'generator',
      selectedModuleId: null,
      selectedPersonId: null,
      screen: 'build',
      paused: false,
      ticks: 0,
      days: 0,
      messages: [],
    },
  };

  const game = deserializeGameState(JSON.stringify(payload));

  placeBuildingAt(game, 3, 1);

  const newModule = game.modules.find((m) => m.id !== 'm_010');
  assert.ok(newModule);
  assert.strictEqual(newModule.id, 'm_011');
});
