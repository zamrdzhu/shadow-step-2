// Shadow Step — grid geometry: line of sight, vision cones, pathfinding.
// One job: answer "can this tile see that point?" and "how do I walk
// there?" for guards, the player and the autopilot alike.

import { CFG } from './config.js';

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

// Smallest absolute difference between two angles, 0..PI.
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Is the tile at (col,row) solid for sight and movement?
// Walls '#' and crates 'C' block both. A locked door 'D' blocks both
// until a keycard opens it; an open door is floor.
export function isSolidTile(grid, col, row) {
  if (col < 0 || row < 0 || col >= CFG.COLS || row >= CFG.ROWS) return true;
  const ch = grid[row][col];
  return ch === '#' || ch === 'C' || ch === 'D';
}

export function isSolidPixel(grid, x, y) {
  return isSolidTile(grid, Math.floor(x / CFG.TILE), Math.floor(y / CFG.TILE));
}

// Line of sight between two pixel points, sampled along the segment.
// A crate between guard and player hides the player: that is what
// "cover to hide behind" means in this game.
export function losClear(grid, x0, y0, x1, y1) {
  const d = dist(x0, y0, x1, y1);
  const steps = Math.max(1, Math.ceil(d / (CFG.TILE / 4)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isSolidPixel(grid, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}

// Is the player inside this guard's vision cone, with a clear sightline?
// range shrinks when the player sneaks; a player fully behind a crate
// fails the line-of-sight test and is never seen.
export function canSee(grid, guard, px, py, sneaking) {
  const range = sneaking ? CFG.VIEW_RANGE_SNEAK : CFG.VIEW_RANGE;
  const d = dist(guard.x, guard.y, px, py);
  if (d > range) return false;
  if (d < 26) return losClear(grid, guard.x, guard.y, px, py); // point blank
  if (angleDiff(angleTo(guard.x, guard.y, px, py), guard.angle) > CFG.VIEW_HALF_ANGLE) return false;
  return losClear(grid, guard.x, guard.y, px, py);
}

// A* over the tile grid, 4-directional. `passable(col,row)` decides which
// tiles the walker may enter (doors need a keycard, for example).
// Returns an array of pixel waypoints (tile centres), start excluded.
export function findPath(grid, sx, sy, tx, ty, passable) {
  const start = { c: sx, r: sy };
  const goal = { c: tx, r: ty };
  const key = (c, r) => r * CFG.COLS + c;
  const open = [{ ...start, g: 0, f: 0, parent: null }];
  const came = new Map();
  const best = new Map([[key(start.c, start.r), 0]]);
  const closed = new Set();
  const h = (c, r) => Math.abs(c - goal.c) + Math.abs(r - goal.r);

  while (open.length) {
    // Cheapest node first; the board is small so a linear scan is fine.
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.c, cur.r);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (cur.c === goal.c && cur.r === goal.r) {
      const path = [];
      let n = cur;
      while (n && n.parent) {
        path.unshift({ x: (n.c + 0.5) * CFG.TILE, y: (n.r + 0.5) * CFG.TILE });
        n = n.parent;
      }
      return path;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = cur.c + dc;
      const nr = cur.r + dr;
      if (nc < 0 || nr < 0 || nc >= CFG.COLS || nr >= CFG.ROWS) continue;
      if (!passable(nc, nr)) continue;
      const nk = key(nc, nr);
      if (closed.has(nk)) continue;
      const g = cur.g + 1;
      if (best.has(nk) && best.get(nk) <= g) continue;
      best.set(nk, g);
      came.set(nk, cur);
      open.push({ c: nc, r: nr, g, f: g + h(nc, nr), parent: cur });
    }
  }
  return null; // no route
}

// Move a circle (x,y,r) by (dx,dy), sliding along solid tiles instead of
// sticking on corners. Returns the new position.
export function moveCircle(grid, x, y, r, dx, dy) {
  let nx = x + dx;
  if (!circleHitsSolid(grid, nx, y, r)) x = nx;
  let ny = y + dy;
  if (!circleHitsSolid(grid, x, ny, r)) y = ny;
  return { x, y };
}

export function circleHitsSolid(grid, x, y, r) {
  const c0 = Math.floor((x - r) / CFG.TILE);
  const c1 = Math.floor((x + r) / CFG.TILE);
  const r0 = Math.floor((y - r) / CFG.TILE);
  const r1 = Math.floor((y + r) / CFG.TILE);
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      if (!isSolidTile(grid, col, row)) continue;
      // Closest point of the tile to the circle centre.
      const cx = clamp(x, col * CFG.TILE, (col + 1) * CFG.TILE);
      const cy = clamp(y, row * CFG.TILE, (row + 1) * CFG.TILE);
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
    }
  }
  return false;
}
