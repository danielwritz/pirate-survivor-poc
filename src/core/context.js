import { createGameState } from './state.js';
import { createPlayer } from './player.js';

export function createGameContext(overrides = {}) {
  const state = overrides.state ?? createGameState();
  const player = overrides.player ?? createPlayer();

  return {
    state,
    player,
    canvas: overrides.canvas ?? null,
    ctx: overrides.ctx ?? null
  };
}
