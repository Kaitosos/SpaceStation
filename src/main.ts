// src/main.ts
import { createInitialGameState, updateGameTick, applyEventEffectsAndClose } from './core';
import { initUi, renderAll } from './ui';

const game = createInitialGameState();

initUi(game, () => {
  applyEventEffectsAndClose(game);
});

const TICK_MS = 500;

setInterval(() => {
  if (!game.activeEventPopup) {
    updateGameTick(game);
  }
  renderAll(game);
}, TICK_MS);
