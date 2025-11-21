// @ts-nocheck
const assert = require('node:assert');
const test = require('node:test');
const {
  addResourceChangesToDelta,
  applyResourceDeltas,
  canAfford,
  createInitialGameState,
  assignPersonToModule,
  placeBuildingAt,
  toggleModuleActive,
  updateGameTick,
} = require('../src/core');

// Unit tests

test('addResourceChangesToDelta aggregates resource changes with sign', () => {
  const delta: Record<string, number> = {};
  addResourceChangesToDelta(
    delta,
    [
      { resource: 'energy', amount: 5 },
      { resource: 'money', amount: 10 },
      { resource: 'energy', amount: 2 },
    ],
    1,
  );
  addResourceChangesToDelta(delta, [{ resource: 'money', amount: 4 }], -1);

  assert.deepStrictEqual(delta, { energy: 7, money: 6 });
});

test('applyResourceDeltas respects caps and ignores population', () => {
  const resources = {
    energy: { name: 'energy', enabled: true, current: 95, max: 100, deltaPerTick: 0 },
    oxygen: { name: 'oxygen', enabled: true, current: 3, max: 5, deltaPerTick: 0 },
    population: { name: 'population', enabled: true, current: 5, max: 10, deltaPerTick: 0 },
  } as const;

  applyResourceDeltas(
    resources as any,
    [
      { resource: 'energy', amount: 10 },
      { resource: 'oxygen', amount: -10 },
      { resource: 'population', amount: 3 },
    ],
  );

  assert.strictEqual(resources.energy.current, 100);
  assert.strictEqual(resources.oxygen.current, 0);
  assert.strictEqual(resources.population.current, 5);
});

test('canAfford validates resources correctly', () => {
  const resources = {
    money: { name: 'money', enabled: true, current: 300, deltaPerTick: 0 },
    energy: { name: 'energy', enabled: true, current: 10, deltaPerTick: 0 },
  } as any;

  assert.strictEqual(canAfford(resources, [{ resource: 'money', amount: 200 }]), true);
  assert.strictEqual(canAfford(resources, [{ resource: 'energy', amount: 11 }]), false);
  assert.strictEqual(
    canAfford(resources, [
      { resource: 'money', amount: 200 },
      { resource: 'oxygen', amount: 1 },
    ]),
    false,
  );
});

// Integration-style test

test('placing a building spends resources and updates tick calculations', () => {
  const game = createInitialGameState();

  game.selectedBuildingTypeId = 'generator';
  placeBuildingAt(game, 0, 0);

  const money = game.resources['money'];
  assert.ok(money);
  assert.strictEqual(money.current, 800);

  const rootCell = game.grid.cells[0];
  assert.ok(rootCell.buildingTypeId === 'generator');
  assert.ok(game.modules.length === 1);

  updateGameTick(game);

  const energy = game.resources['energy'];
  assert.ok(energy.deltaPerTick > 11);
  assert.ok(energy.current > 40);

  const population = game.resources['population'];
  assert.strictEqual(population.current, game.people.length);
  assert.ok(game.resources['money'].current > 800);
});

test('updateGameTick respects resource caps when applying deltas', () => {
  const game = createInitialGameState();

  game.selectedBuildingTypeId = 'generator';
  placeBuildingAt(game, 0, 0);

  const energy = game.resources['energy'];
  energy.current = 99;

  updateGameTick(game);

  assert.strictEqual(energy.current, 100);
});

test('assigning workers respects requirements and capacity toggles module state', () => {
  const game = createInitialGameState();
  const generator = game.people[0];
  generator.qualifications = Array.from(new Set([...generator.qualifications, 'tech_basic']));

  game.selectedBuildingTypeId = 'generator';
  placeBuildingAt(game, 0, 0);

  const module = game.modules[0];
  const err = assignPersonToModule(game, generator.id, module.id);
  assert.strictEqual(err, null);
  assert.strictEqual(module.workers.includes(generator.id), true);

  toggleModuleActive(game, module.id);
  assert.strictEqual(module.active, false);
  toggleModuleActive(game, module.id);
  assert.strictEqual(module.active, true);
});
