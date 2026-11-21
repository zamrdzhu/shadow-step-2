// Shadow Step — staged moments for the screenshots.
// One job: put the game into a photogenic state — title, a tense
// mid-level moment, an alarm — using the game's own state, so every
// screenshot is a real render of the game's own code in the browser.
// The win shot is not staged here: it is taken after the autopilot
// really clears all three levels.

import { CFG } from './config.js';
import { loadLevel } from './game.js';

function placeAt(game, tileC, tileR) {
  game.player.x = (tileC + 0.5) * CFG.TILE;
  game.player.y = (tileR + 0.5) * CFG.TILE;
}

function placeGuard(game, index, tileC, tileR, angle, detection, state) {
  const guard = game.guards[index];
  guard.x = (tileC + 0.5) * CFG.TILE;
  guard.y = (tileR + 0.5) * CFG.TILE;
  guard.angle = angle;
  guard.detection = detection;
  guard.state = state || 'patrol';
  guard.route = null;
  guard.routeTarget = null;
  if (state === 'chase') {
    guard.lastSeen = { x: game.player.x, y: game.player.y };
    guard.lastSeenAt = game.time;
  }
}

export function stageScene(game, name) {
  if (name === 'title') {
    loadLevel(game, 0);
    game.screen = 'title';
    return true;
  }
  if (name === 'cover') {
    // Level 1, mid-play: the player slips between crates while a guard's
    // cone sweeps past, detection already a third full.
    loadLevel(game, 0);
    game.screen = 'play';
    game.time = 23.4;
    placeAt(game, 10, 10);
    game.player.angle = -Math.PI / 2;
    game.player.sneaking = true;
    const angleToPlayer = Math.atan2(game.player.y - 8.5 * CFG.TILE, game.player.x - 13.5 * CFG.TILE);
    placeGuard(game, 0, 13, 8, angleToPlayer, 0.35, 'patrol');
    placeGuard(game, 1, 18, 5, Math.PI / 2, 0, 'patrol');
    game.maxDetection = 0.35;
    return true;
  }
  if (name === 'chase') {
    // The alarm is up: a guard has the player dead in its cone and is
    // closing in. The shot is taken before it reaches the player.
    loadLevel(game, 0);
    game.screen = 'play';
    game.time = 41.0;
    placeAt(game, 12, 8);
    game.player.angle = Math.PI;
    placeGuard(game, 0, 8, 8, 0, 1.0, 'chase');
    placeGuard(game, 1, 18, 11, -Math.PI / 2, 0.2, 'patrol');
    game.alarm = true;
    game.levelAlarm = true;
    game.maxDetection = 1.0;
    return true;
  }
  return false;
}
