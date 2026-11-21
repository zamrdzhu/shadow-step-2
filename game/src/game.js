// Shadow Step — the game itself.
// One job: the state machine. Title, playing, level clear, caught, win;
// pickups, locked doors, the exit, the pebble throw, the alarm, and the
// autopilot that plays the game on its own (?auto=1) so the entry can
// prove every level is clearable without ever being spotted.

import { CFG } from './config.js';
import { canSee, dist, findPath } from './geometry.js';
import { LEVELS, parseLevel } from './levels.js';
import { createPlayer, playerTile, updatePlayer } from './player.js';
import { createGuard, updateGuard } from './guards.js';

export function createGame() {
  return {
    screen: 'title', // title | play | clear | over | win
    levelIndex: 0,
    level: null,
    player: null,
    guards: [],
    time: 0,
    totalTime: 0,
    score: 0,
    levelAlarm: false, // did any guard raise the alarm this level?
    ghostLevels: 0,
    alarm: false,
    maxDetection: 0,
    message: null, // { text, until }
    messageAt: 0,
    pebblesFlying: [], // { x0, y0, x1, y1, t }
    levelStats: [],
    auto: false,
    autoPath: null,
    autoTarget: null,
    autoTrail: [],
    autoStuckFor: 0,
    autoLastProgress: 0,
    autoRuns: 0, // levels the autopilot finished, for the verifier
    autoGhosts: 0,
    caughtBy: -1,
    clearStats: null, // { time, ghost, bonus } for the clear screen
  };
}

export function loadLevel(game, index) {
  const def = LEVELS[index];
  const level = parseLevel(def, index);
  game.levelIndex = index;
  game.level = level;
  game.player = createPlayer(level.start.x, level.start.y, def.pebbles);
  game.guards = def.guards.map((g, i) => createGuard(g, i));
  game.time = 0;
  game.levelAlarm = false;
  game.alarm = false;
  game.maxDetection = 0;
  game.pebblesFlying = [];
  game.autoPath = null;
  game.autoTarget = null;
  game.autoTrail = [];
  game.autoStuckFor = 0;
  game.autoLastProgress = 0;
  game.caughtBy = -1;
  game.clearStats = null;
  setMessage(game, `${def.name} — ${def.sub}`);
}

export function startGame(game) {
  game.score = 0;
  game.totalTime = 0;
  game.ghostLevels = 0;
  game.levelStats = [];
  game.autoRuns = 0;
  game.autoGhosts = 0;
  loadLevel(game, 0);
  game.screen = 'play';
}

export function setMessage(game, text) {
  game.message = text;
  game.messageAt = game.time;
}

function anyGuardSees(game, x, y, sneaking) {
  for (const guard of game.guards) {
    if (canSee(game.level.grid, guard, x, y, sneaking)) return guard;
  }
  return null;
}

export function throwPebble(game, tx, ty) {
  const player = game.player;
  if (!player || player.pebbles <= 0) return false;
  if (game.pebblesFlying.length > 0) return false;
  player.pebbles -= 1;
  // The pebble lands at the clicked point, or 240 px out in that
  // direction when the click is far away.
  const d = dist(player.x, player.y, tx, ty);
  const maxThrow = 240;
  const lx = d > maxThrow ? player.x + ((tx - player.x) / d) * maxThrow : tx;
  const ly = d > maxThrow ? player.y + ((ty - player.y) / d) * maxThrow : ty;
  game.pebblesFlying.push({ x0: player.x, y0: player.y, x1: lx, y1: ly, t: 0 });
  return true;
}

function landPebble(game, pebble) {
  // Every guard inside the noise radius walks over to have a look.
  for (const guard of game.guards) {
    if (dist(guard.x, guard.y, pebble.x1, pebble.y1) <= CFG.PEBBLE_NOISE_RADIUS) {
      guard.heardAt = { x: pebble.x1, y: pebble.y1 };
    }
  }
  setMessage(game, 'The pebble clatters — a guard goes to look.');
}

function openDoorsNearPlayer(game) {
  const player = game.player;
  if (player.keys <= 0) return;
  const tile = playerTile(player);
  for (const door of game.level.doors) {
    if (door.open) continue;
    if (Math.abs(door.c - tile.c) + Math.abs(door.r - tile.r) <= 1) {
      door.open = true;
      game.level.grid[door.r][door.c] = '.';
      player.keys -= 1;
      setMessage(game, 'Keycard accepted — the vault door slides open.');
    }
  }
}

function collectPickups(game) {
  const player = game.player;
  const tile = playerTile(player);
  for (const key of game.level.keycards) {
    if (!key.taken && key.c === tile.c && key.r === tile.r) {
      key.taken = true;
      player.keys += 1;
      setMessage(game, 'Keycard taken. Find the locked door.');
    }
  }
  for (const spot of game.level.pebbleSpots) {
    if (!spot.taken && spot.c === tile.c && spot.r === tile.r) {
      spot.taken = true;
      player.pebbles += 2;
      setMessage(game, 'Found pebbles (+2).');
    }
  }
}

function levelComplete(game) {
  const ghost = !game.levelAlarm;
  const timeBonus = Math.max(0, Math.round((game.level.par - game.time) * CFG.TIME_BONUS_PER_SEC));
  const bonus = timeBonus + (ghost ? CFG.GHOST_BONUS : 0);
  game.score += bonus;
  game.totalTime += game.time;
  if (ghost) game.ghostLevels += 1;
  game.levelStats.push({ name: game.level.name, time: game.time, ghost, bonus });
  game.clearStats = { time: game.time, ghost, bonus, par: game.level.par };
  if (game.auto) {
    game.autoRuns += 1;
    if (ghost) game.autoGhosts += 1;
  }
  game.screen = 'clear';
}

function levelFailed(game, guardIndex) {
  game.caughtBy = guardIndex;
  game.screen = 'over';
}

// --- Autopilot -----------------------------------------------------------

function autoPassable(game) {
  const hasKey = game.player.keys > 0;
  return (c, r) => {
    const ch = game.level.grid[r][c];
    if (ch === '#' || ch === 'C') return false;
    if (ch === 'D') return hasKey;
    return true;
  };
}

// The autopilot's current objective: the keycard while a locked door
// stands between it and the exit, else the exit itself.
function autoObjective(game) {
  const level = game.level;
  const needsKey = level.doors.some((d) => !d.open) && game.player.keys === 0;
  if (needsKey) {
    const key = level.keycards.find((k) => !k.taken);
    if (key) return { c: key.c, r: key.r, kind: 'keycard' };
  }
  return { c: level.exit.c, r: level.exit.r, kind: 'exit' };
}

function autoRepath(game) {
  const target = autoObjective(game);
  const tile = playerTile(game.player);
  const path = findPath(game.level.grid, tile.c, tile.r, target.c, target.r, autoPassable(game));
  game.autoTarget = target;
  game.autoPath = path || [];
  game.autoTrail = [];
}

function updateAutopilot(game, dt, input) {
  const player = game.player;
  if (!game.autoPath || game.autoPath.length === 0) {
    autoRepath(game);
    if (!game.autoPath || game.autoPath.length === 0) return; // nowhere to go
  }
  input.sneak = true;
  const next = game.autoPath[0];
  const seenNow = anyGuardSees(game, player.x, player.y, true);
  const nextSeen = anyGuardSees(game, next.x, next.y, true);
  const maxDet = Math.max(0, ...game.guards.map((g) => g.detection));

  // Spotted: back away along the trail we came in on, or throw a pebble
  // to pull the guard off while we slip away.
  if (seenNow || maxDet > 0.25) {
    if (player.pebbles > 0 && maxDet > 0.3 && game.pebblesFlying.length === 0) {
      const guard = game.guards.reduce((a, b) => (a.detection > b.detection ? a : b));
      // Toss it past the guard, away from us: the guard turns its back.
      const away = { x: guard.x + (guard.x - player.x), y: guard.y + (guard.y - player.y) };
      throwPebble(game, away.x, away.y);
    }
    if (game.autoTrail.length > 0) {
      const back = game.autoTrail[game.autoTrail.length - 1];
      const d = dist(player.x, player.y, back.x, back.y);
      if (d > 6) {
        input.x = (back.x - player.x) / d;
        input.y = (back.y - player.y) / d;
        return;
      }
      game.autoTrail.pop();
    }
    // Nowhere to retreat to: freeze and let the meter drain.
    input.x = 0;
    input.y = 0;
    return;
  }

  // The next step is watched: wait here until the patrol moves on.
  if (nextSeen) {
    game.autoStuckFor += dt;
    input.x = 0;
    input.y = 0;
    if (game.autoStuckFor > CFG.AUTO_STUCK_SEC && player.pebbles > 0 && game.pebblesFlying.length === 0) {
      const guard = game.guards[0];
      throwPebble(game, guard.x + 120, guard.y);
      game.autoStuckFor = 0;
    }
    return;
  }
  game.autoStuckFor = 0;

  // Walk the path, remembering the way back.
  const d = dist(player.x, player.y, next.x, next.y);
  if (d < 6) {
    game.autoTrail.push({ x: next.x, y: next.y });
    if (game.autoTrail.length > 24) game.autoTrail.shift();
    game.autoPath.shift();
    game.autoLastProgress = game.time;
    return;
  }
  input.x = (next.x - player.x) / d;
  input.y = (next.y - player.y) / d;
  game.autoLastProgress = game.time;
}

// --- Main update ---------------------------------------------------------

export function update(game, input, dt) {
  if (game.screen !== 'play') return;
  game.time += dt;

  // Pebbles in flight.
  for (const pebble of game.pebblesFlying) pebble.t += dt * 2.6;
  const landed = game.pebblesFlying.filter((p) => p.t >= 1);
  game.pebblesFlying = game.pebblesFlying.filter((p) => p.t < 1);
  for (const pebble of landed) landPebble(game, pebble);

  // The autopilot drives the input; a human drives it instead.
  const drive = { x: input.x, y: input.y, sneak: input.sneak };
  if (game.auto) updateAutopilot(game, dt, drive);
  if (input.throw) throwPebble(game, input.throw.x, input.throw.y);

  updatePlayer(game.player, drive, game.level.grid, dt);
  openDoorsNearPlayer(game);
  collectPickups(game);

  const events = [];
  let alarm = false;
  for (const guard of game.guards) {
    updateGuard(guard, game.player, game.level.grid, dt, game.time, game.player.keys > 0, events);
    if (guard.state === 'chase') alarm = true;
  }
  game.alarm = alarm;
  game.maxDetection = Math.max(0, ...game.guards.map((g) => g.detection));
  for (const event of events) {
    if (event.type === 'alarm') {
      game.levelAlarm = true;
      setMessage(game, 'SPOTTED! Break line of sight!');
    } else if (event.type === 'lost') {
      setMessage(game, 'You slipped away. Stay out of the light.');
    } else if (event.type === 'caught') {
      levelFailed(game, event.guard);
      return;
    }
  }

  // Reached the exit?
  const exit = game.level.exit;
  const ex = (exit.c + 0.5) * CFG.TILE;
  const ey = (exit.r + 0.5) * CFG.TILE;
  if (dist(game.player.x, game.player.y, ex, ey) < 26) {
    levelComplete(game);
  }
}

export function nextLevel(game) {
  if (game.levelIndex + 1 < LEVELS.length) {
    loadLevel(game, game.levelIndex + 1);
    game.screen = 'play';
  } else {
    game.screen = 'win';
  }
}

export function retryLevel(game) {
  loadLevel(game, game.levelIndex);
  game.screen = 'play';
}

export function toTitle(game) {
  game.screen = 'title';
  game.level = null;
  game.player = null;
  game.guards = [];
}

// Guards patrol behind the title screen. They watch a dummy player far
// off the board, so nothing ever spots the idle player standing there.
export function updateAmbient(game, dt) {
  if (game.screen !== 'title' || !game.level) return;
  const dummy = { x: -500, y: -500, radius: 13, sneaking: true };
  const events = [];
  for (const guard of game.guards) {
    updateGuard(guard, dummy, game.level.grid, dt, game.time, false, events);
  }
}
