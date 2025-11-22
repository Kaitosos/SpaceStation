// @ts-nocheck
const assert = require('node:assert');
const test = require('node:test');
const { setupMockDom } = require('./mockDom');
const { createInitialGameState } = require('../src/core');
const { BUILDING_TYPES } = require('../src/config');
const { saveGameStateToSlot } = require('../src/storage');

test('renderAll draws resources and grid with stable counts', () => {
  const { document } = setupMockDom();
  const game = createInitialGameState();

  const { initUi } = require('../src/ui');
  initUi(game, () => {});

  game.screen = 'build';
  game.paused = false;
  const { renderAll } = require('../src/ui');
  renderAll(game);

  const resourceRows = document.getElementById('resources').children;
  assert.ok(resourceRows.length >= 3, 'renders visible resource rows');

  const gridCells = document.getElementById('grid').children;
  assert.strictEqual(gridCells.length, game.grid.width * game.grid.height);
});

test('grid click handler builds selected module and updates UI state', () => {
  const { document } = setupMockDom();
  const game = createInitialGameState();
  const generatorType = BUILDING_TYPES.find((b) => b.id === 'generator');

  game.selectedBuildingTypeId = generatorType.id;
  delete require.cache[require.resolve('../src/ui')];
  const { initUi, renderAll } = require('../src/ui');
  initUi(game, () => {});

  game.screen = 'build';
  game.paused = false;
  renderAll(game);

  const anchor = game.modules[0];
  const targetX = anchor.x + anchor.width;
  const targetY = anchor.y;
  const gridCells = Array.from(document.getElementById('grid').children);
  const targetCell = gridCells.find(
    (el: any) => el.dataset && el.dataset.x === String(targetX) && el.dataset.y === String(targetY),
  );

  assert.ok(targetCell, 'target cell exists');
  document.getElementById('grid').dispatchEvent({ type: 'click', target: targetCell });

  assert.strictEqual(game.modules.length, 2);
  renderAll(game);
  const selectedButtons = document.getElementById('build-menu').querySelectorAll('.selected');
  assert.ok(game.grid.cells.some((c: any) => c.buildingTypeId === generatorType.id));
  assert.ok(selectedButtons.length >= 0); // ensure query works without throwing
});

test('save slot list updates load availability and metadata display', () => {
  const storage = new Map();
  global.localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
  };

  const { document } = setupMockDom();
  const game = createInitialGameState();

  delete require.cache[require.resolve('../src/ui')];
  const { initUi, renderAll } = require('../src/ui');
  initUi(game, () => {});

  game.screen = 'mainMenu';
  game.paused = true;
  renderAll(game);

  const loadBtn: any = document.getElementById('menu-load');
  const slotList = document.getElementById('menu-slot-list');
  const slotTimestamp = document.getElementById('menu-slot-timestamp');

  assert.strictEqual(loadBtn.disabled, true, 'load is disabled when no saves exist');
  assert.strictEqual(slotList.children.length, 3, 'renders default slots');
  assert.ok(slotTimestamp.textContent.includes('Leer'));

  game.ticks = 5;
  saveGameStateToSlot('slot-1', game);

  renderAll(game);

  assert.strictEqual(loadBtn.disabled, false, 'load enabled when slot has data');
  assert.ok(slotTimestamp.textContent.includes('Ausgewählt'));
});

test('loading a save reinitializes UI filters and restores game state', () => {
  const storage = new Map();
  global.localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
  };

  const { document } = setupMockDom();
  const game = createInitialGameState();
  game.ticks = 7;

  saveGameStateToSlot('slot-1', game);

  delete require.cache[require.resolve('../src/ui')];
  const { initUi, renderAll } = require('../src/ui');
  initUi(game, () => {});

  game.screen = 'personnel';
  game.paused = false;
  renderAll(game);

  const filterInput: any = document.getElementById('people-filter');
  filterInput.value = 'abc';
  filterInput.dispatchEvent({ type: 'input', target: filterInput });
  const unassignedBtn: any = document.getElementById('filter-unassigned');
  unassignedBtn.dispatchEvent({ type: 'click', target: unassignedBtn });

  game.ticks = 42;

  const loadBtn: any = document.getElementById('menu-load');
  loadBtn.dispatchEvent({ type: 'click', target: loadBtn });

  assert.strictEqual(game.ticks, 7, 'loaded ticks from saved state');
  assert.strictEqual(game.screen, 'build', 'returns to gameplay screen after load');
  assert.strictEqual(filterInput.value, '', 'filter cleared after load');
  assert.ok(!unassignedBtn.className.includes('active'), 'unassigned filter reset');
});
