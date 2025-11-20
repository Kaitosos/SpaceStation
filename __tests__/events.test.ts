// @ts-nocheck
const assert = require('node:assert');
const test = require('node:test');
const {
  applyEventOptionAndClose,
  areAllConditionsMet,
  checkEvents,
  createInitialGameState,
  evaluateCondition,
} = require('../src/core');
const { EVENT_CONFIGS, BUILDING_TYPES } = require('../src/config');

function getOptionById(options, id) {
  return options.find((o) => o.id === id);
}

test('evaluateCondition checks resource and time comparators', () => {
  const game = createInitialGameState();
  const oxygenCond = { type: 'resource', resource: 'oxygen', comparator: 'lt', value: 100 };
  const timeCond = { type: 'time', ticksGte: 10, daysGte: 0 };

  assert.strictEqual(evaluateCondition(game, oxygenCond), true);
  assert.strictEqual(evaluateCondition(game, { ...oxygenCond, comparator: 'gt', value: 9999 }), false);
  assert.strictEqual(evaluateCondition(game, timeCond), false);

  game.ticks = 20;
  assert.strictEqual(evaluateCondition(game, timeCond), true);
});

test('events trigger and mutate state when options are applied', () => {
  const game = createInitialGameState();
  const lowOxygenCfg = EVENT_CONFIGS.find((e) => e.id === 'low_oxygen_warning');
  const investorCfg = EVENT_CONFIGS.find((e) => e.id === 'investor_arrives');

  game.ticks = 120;
  game.resources['oxygen'].current = 10;
  assert.strictEqual(areAllConditionsMet(game, lowOxygenCfg), true);

  checkEvents(game);
  assert.ok(game.activeEventPopup);
  assert.strictEqual(game.activeEventPopup.id, 'low_oxygen_warning');

  const buySupplies = getOptionById(lowOxygenCfg.options, 'buy_supplies');
  applyEventOptionAndClose(game, buySupplies);
  assert.strictEqual(game.activeEventPopup, null);
  assert.ok(game.resources['oxygen'].current > 10);
  assert.ok(game.messages.some((m) => m.includes('Event abgeschlossen')));

  // Trigger next event and unlock building
  game.ticks = 200;
  game.resources['population'].current = 12;
  checkEvents(game);
  assert.ok(game.activeEventPopup);
  assert.strictEqual(game.activeEventPopup.id, 'investor_arrives');

  const acceptInvestment = getOptionById(investorCfg.options, 'accept_investment');
  applyEventOptionAndClose(game, acceptInvestment);

  const scienceLab = BUILDING_TYPES.find((b) => b.id === 'science_lab');
  assert.ok(scienceLab?.enabled, 'science lab should be unlocked after investment');
});
