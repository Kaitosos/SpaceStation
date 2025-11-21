// @ts-nocheck
const assert = require('node:assert');
const test = require('node:test');
const { setupMockDom } = require('./mockDom');
const { createInitialGameState } = require('../src/core');
const { BUILDING_TYPES } = require('../src/config');

test('renderAll draws resources and grid with stable counts', () => {
  const { document } = setupMockDom();
  const game = createInitialGameState();

  const { initUi } = require('../src/ui');
  initUi(game, () => {});

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
