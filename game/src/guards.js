// Shadow Step — the guards.
// One job: patrol, suspicion, chase and search. A guard is a small state
// machine with a vision cone: patrol the waypoints, get suspicious when
// the meter passes the threshold, chase on a full alarm, search the last
// known spot when the trail goes cold, then walk back to the patrol.
//
// The guard never knows the player's position directly. It only ever
// walks toward the last place it *saw* the player, which is what makes
// the game fair: break line of sight and you can get away.

import { CFG } from './config.js';
import { angleTo, canSee, dist, findPath } from './geometry.js';

export function createGuard(def, index) {
  const [c0, r0] = def.path[0];
  const guard = {
    index,
    x: (c0 + 0.5) * CFG.TILE,
    y: (r0 + 0.5) * CFG.TILE,
    angle: 0,
    radius: CFG.GUARD_RADIUS,
    path: def.path,
    waypoint: 1 % def.path.length,
    pause: def.pause ?? 1,
    pauseLeft: 0,
    state: 'patrol', // patrol | suspect | chase | search | return
    detection: 0,
    lastSeen: null,
    lastSeenAt: -99,
    route: null, // A* waypoints the guard is walking, pixel points
    routeTarget: null, // 'x,y' of the tile the route leads to
    searchLeft: 0,
    lookAngle: 0,
    lookSweep: 0,
    heardAt: null, // {x, y} a pebble rang out at
    stepClock: 0,
  };
  // Face along the patrol for the first step.
  const [c1, r1] = def.path[1 % def.path.length];
  guard.angle = angleTo(guard.x, guard.y, (c1 + 0.5) * CFG.TILE, (r1 + 0.5) * CFG.TILE);
  return guard;
}

// Walk toward a pixel point at a speed; returns true on arrival.
function walkToward(guard, tx, ty, speed, dt) {
  const d = dist(guard.x, guard.y, tx, ty);
  const step = speed * dt;
  if (d <= Math.max(step, 3)) {
    guard.x = tx;
    guard.y = ty;
    return true;
  }
  guard.angle = angleTo(guard.x, guard.y, tx, ty);
  guard.x += ((tx - guard.x) / d) * step;
  guard.y += ((ty - guard.y) / d) * step;
  guard.stepClock += dt * 2.2;
  return false;
}

// Follow an A* route (list of pixel waypoints); returns true when done.
// The route is recomputed by the caller when its target changes.
function followRoute(guard, speed, dt) {
  if (!guard.route || guard.route.length === 0) return true;
  const next = guard.route[0];
  if (walkToward(guard, next.x, next.y, speed, dt)) guard.route.shift();
  return guard.route.length === 0;
}

function routeTo(guard, grid, tx, ty, hasKey) {
  const tc = Math.floor(tx / CFG.TILE);
  const tr = Math.floor(ty / CFG.TILE);
  const key = `${tc},${tr}`;
  if (guard.routeTarget === key && guard.route) return;
  const passable = (c, r) => {
    const ch = grid[r][c];
    if (ch === '#' || ch === 'C') return false;
    if (ch === 'D') return hasKey;
    return true;
  };
  const from = { c: Math.floor(guard.x / CFG.TILE), r: Math.floor(guard.y / CFG.TILE) };
  const path = findPath(grid, from.c, from.r, tc, tr, passable);
  guard.route = path || [];
  guard.routeTarget = key;
}

// A guard's walkable check for a pixel point: used by the autopilot.
export function guardCanStand(grid, x, y) {
  const c = Math.floor(x / CFG.TILE);
  const r = Math.floor(y / CFG.TILE);
  if (c < 0 || r < 0 || c >= CFG.COLS || r >= CFG.ROWS) return false;
  const ch = grid[r][c];
  return ch !== '#' && ch !== 'C' && ch !== 'D';
}

export function updateGuard(guard, player, grid, dt, time, hasKey, events) {
  const sees = canSee(grid, guard, player.x, player.y, player.sneaking);
  const d = dist(guard.x, guard.y, player.x, player.y);

  // The detection meter: closer and standing still in the open fills it
  // fastest; sneaking buys time. Out of sight it drains away.
  if (sees) {
    const rate = d < 110 ? CFG.DETECT_RATE_NEAR : CFG.DETECT_RATE_FAR;
    guard.detection = Math.min(1, guard.detection + rate * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    guard.lastSeenAt = time;
  } else {
    guard.detection = Math.max(0, guard.detection - CFG.DETECT_DECAY * dt);
  }

  // A pebble's ring pulls a patrolling or searching guard over to look.
  if (guard.heardAt && (guard.state === 'patrol' || guard.state === 'search' || guard.state === 'return')) {
    if (guard.state !== 'search') {
      guard.state = 'search';
      guard.searchLeft = CFG.SEARCH_SEC;
      guard.route = null;
      guard.routeTarget = null;
    }
    guard.lastSeen = { x: guard.heardAt.x, y: guard.heardAt.y };
    guard.heardAt = null;
  }

  const wasState = guard.state;

  if (guard.detection >= CFG.ALARM_AT) {
    if (guard.state !== 'chase') {
      guard.state = 'chase';
      events.push({ type: 'alarm', guard: guard.index });
    }
  } else if (guard.detection >= CFG.SUSPECT_AT && guard.state === 'patrol') {
    guard.state = 'suspect';
    guard.route = null;
    guard.routeTarget = null;
  } else if (guard.state === 'suspect' && guard.detection < CFG.SUSPECT_AT * 0.5) {
    guard.state = 'patrol';
  }

  switch (guard.state) {
    case 'patrol': {
      if (guard.pauseLeft > 0) {
        guard.pauseLeft -= dt;
        break;
      }
      const target = guard.path[guard.waypoint];
      const tx = (target[0] + 0.5) * CFG.TILE;
      const ty = (target[1] + 0.5) * CFG.TILE;
      if (dist(guard.x, guard.y, tx, ty) < 4) {
        guard.waypoint = (guard.waypoint + 1) % guard.path.length;
        guard.pauseLeft = guard.pause;
        break;
      }
      routeTo(guard, grid, tx, ty, hasKey);
      followRoute(guard, CFG.GUARD_SPEED_PATROL, dt);
      break;
    }
    case 'suspect': {
      // Walk toward the last seen spot, slowly, to have a look.
      if (!guard.lastSeen) {
        guard.state = 'patrol';
        break;
      }
      routeTo(guard, grid, guard.lastSeen.x, guard.lastSeen.y, hasKey);
      if (followRoute(guard, CFG.GUARD_SPEED_SEARCH, dt)) {
        guard.state = 'search';
        guard.searchLeft = CFG.SEARCH_SEC;
        guard.lookSweep = 0;
      }
      break;
    }
    case 'chase': {
      // Chase the last seen spot; refresh it while the player is visible.
      if (sees) {
        routeTo(guard, grid, player.x, player.y, hasKey);
        followRoute(guard, CFG.GUARD_SPEED_CHASE, dt);
      } else if (guard.lastSeen) {
        routeTo(guard, grid, guard.lastSeen.x, guard.lastSeen.y, hasKey);
        followRoute(guard, CFG.GUARD_SPEED_CHASE, dt);
      }
      // Caught: the guard reaches the player while the alarm is up.
      if (d < guard.radius + player.radius + 2) {
        events.push({ type: 'caught', guard: guard.index });
      }
      // Lost the trail: after a few seconds unseen, fall back to search.
      if (!sees && time - guard.lastSeenAt > CFG.CHASE_MEMORY_SEC) {
        guard.state = 'search';
        guard.searchLeft = CFG.SEARCH_SEC;
        guard.route = null;
        guard.routeTarget = null;
        guard.lookSweep = 0;
        events.push({ type: 'lost', guard: guard.index });
      }
      break;
    }
    case 'search': {
      guard.searchLeft -= dt;
      // Sweep the view around the last known spot.
      guard.lookSweep += dt;
      guard.angle = guard.lookAngle + Math.sin(guard.lookSweep * 1.6) * 1.1;
      if (guard.searchLeft <= 0) {
        guard.state = 'return';
        guard.route = null;
        guard.routeTarget = null;
        guard.detection = 0;
      }
      break;
    }
    case 'return': {
      // Walk back to the nearest patrol waypoint, then resume the patrol.
      let nearest = 0;
      let nearestD = Infinity;
      guard.path.forEach(([c, r], i) => {
        const dd = dist(guard.x, guard.y, (c + 0.5) * CFG.TILE, (r + 0.5) * CFG.TILE);
        if (dd < nearestD) {
          nearestD = dd;
          nearest = i;
        }
      });
      const target = guard.path[nearest];
      const tx = (target[0] + 0.5) * CFG.TILE;
      const ty = (target[1] + 0.5) * CFG.TILE;
      routeTo(guard, grid, tx, ty, hasKey);
      if (followRoute(guard, CFG.GUARD_SPEED_PATROL, dt)) {
        guard.waypoint = (nearest + 1) % guard.path.length;
        guard.state = 'patrol';
        guard.pauseLeft = guard.pause * 0.5;
      }
      break;
    }
    default:
      break;
  }

  if (guard.state === 'search' && wasState !== 'search') guard.lookAngle = guard.angle;
  return guard;
}
