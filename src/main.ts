// src/main.ts
import { createInitialGameState, updateGameTick, applyEventOptionAndClose } from './core.js';
import { initUi, renderAll } from './ui.js';

const game = createInitialGameState();

initUi(game, (option) => {
  applyEventOptionAndClose(game, option);
});

const TICK_MS = 500;

setInterval(() => {
  if (!game.activeEventPopup) {
    updateGameTick(game);
  }
  renderAll(game);
}, TICK_MS);
