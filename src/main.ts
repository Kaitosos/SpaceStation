// src/main.ts
import { createInitialGameState, updateGameTick } from './core.js';
import { applyEventOptionAndClose } from './events.js';
import { initUi, renderAll } from './ui.js';

const game = createInitialGameState();

initUi(game, (option) => {
  applyEventOptionAndClose(game, option);
});

const TICK_MS = 500;

setInterval(() => {
  const shouldTick = !game.activeEventPopup && game.screen !== 'mainMenu' && !game.paused;
  if (shouldTick) {
    updateGameTick(game);
  }
  renderAll(game);
}, TICK_MS);
