// Shadow Step — the player.
// One job: where the player is, how they move, and what they carry.
// The game owns pickups, doors and the exit; this file owns feet.

import { CFG } from './config.js';
import { moveCircle } from './geometry.js';

export function createPlayer(x, y, pebbles) {
  return {
    x,
    y,
    angle: -Math.PI / 2, // facing up the board at the start
    radius: CFG.PLAYER_RADIUS,
    sneaking: false,
    moving: false,
    movingQuiet: false, // true while sneaking: fewer, softer steps
    pebbles,
    keys: 0,
    // Footstep sound clock, so render/audio can tick in step.
    stepClock: 0,
  };
}

// Move from the input vector (already normalised), in pixels per second.
// Returns nothing; the player slides along walls instead of sticking.
export function updatePlayer(player, input, grid, dt) {
  const speed = input.sneak ? CFG.SNEAK_SPEED : CFG.PLAYER_SPEED;
  player.sneaking = input.sneak;
  const mx = input.x;
  const my = input.y;
  player.moving = mx !== 0 || my !== 0;
  player.movingQuiet = player.moving && input.sneak;
  if (player.moving) {
    player.angle = Math.atan2(my, mx);
    const moved = moveCircle(grid, player.x, player.y, player.radius, mx * speed * dt, my * speed * dt);
    player.x = moved.x;
    player.y = moved.y;
    player.stepClock += dt * (input.sneak ? 1.4 : 2.6);
  }
}

// Tile the player's centre stands on.
export function playerTile(player) {
  return {
    c: Math.floor(player.x / CFG.TILE),
    r: Math.floor(player.y / CFG.TILE),
  };
}
