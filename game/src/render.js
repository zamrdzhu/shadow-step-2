// Shadow Step — everything the player sees.
// One job: draw the game on the canvas. The playfield is top-down: floor
// tiles, walls, crates, the exit, guards with raycast vision cones, and
// the player. The sidebar holds the minimap, the objectives and the
// inventory; the top bar holds the detection meter, the clock and the
// score. Title, clear, caught and win screens are drawn here too.

import { CFG, COLORS } from './config.js';
import { angleTo, dist, losClear } from './geometry.js';

const TOP = CFG.TOP_BAR;
const PLAY_W = CFG.COLS * CFG.TILE;
const PLAY_H = CFG.ROWS * CFG.TILE;

function tileCenter(c, r) {
  return { x: (c + 0.5) * CFG.TILE, y: TOP + (r + 0.5) * CFG.TILE };
}

// A guard's vision cone, raycast against walls and crates so the cone
// stops at cover instead of shining through it. Returns the polygon.
function conePolygon(grid, guard, range) {
  const points = [{ x: guard.x, y: TOP + guard.y }];
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const a = guard.angle - CFG.VIEW_HALF_ANGLE + (2 * CFG.VIEW_HALF_ANGLE * i) / steps;
    let d = 12;
    let ex = guard.x;
    let ey = guard.y;
    while (d < range) {
      const nx = guard.x + Math.cos(a) * d;
      const ny = guard.y + Math.sin(a) * d;
      if (!losClear(grid, guard.x, guard.y, nx, ny)) break;
      ex = nx;
      ey = ny;
      d += 8;
    }
    points.push({ x: ex, y: TOP + ey });
  }
  return points;
}

function drawFloor(ctx, level) {
  for (let r = 0; r < CFG.ROWS; r++) {
    for (let c = 0; c < CFG.COLS; c++) {
      const ch = level.grid[r][c];
      const x = c * CFG.TILE;
      const y = TOP + r * CFG.TILE;
      ctx.fillStyle = (c + r) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
      ctx.fillRect(x, y, CFG.TILE, CFG.TILE);
      if (ch === 'E') continue; // exit drawn below
      ctx.strokeStyle = COLORS.floorLine;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, CFG.TILE - 1, CFG.TILE - 1);
    }
  }
}

function drawExit(ctx, level) {
  const { x, y } = tileCenter(level.exit.c, level.exit.r);
  const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 300);
  ctx.save();
  ctx.fillStyle = COLORS.exitGlow;
  ctx.globalAlpha = 0.25 + 0.2 * pulse;
  ctx.beginPath();
  ctx.arc(x, y, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.exit;
  ctx.fillRect(x - 13, y - 13, 26, 26);
  ctx.fillStyle = '#0b2b18';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', x, y + 1);
  ctx.restore();
}

function drawStatics(ctx, level) {
  for (let r = 0; r < CFG.ROWS; r++) {
    for (let c = 0; c < CFG.COLS; c++) {
      const ch = level.grid[r][c];
      const x = c * CFG.TILE;
      const y = TOP + r * CFG.TILE;
      if (ch === '#') {
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(x, y, CFG.TILE, CFG.TILE);
        ctx.fillStyle = COLORS.wallTop;
        ctx.fillRect(x, y, CFG.TILE, 5);
      } else if (ch === 'C') {
        ctx.fillStyle = COLORS.crate;
        ctx.fillRect(x + 4, y + 4, CFG.TILE - 8, CFG.TILE - 8);
        ctx.fillStyle = COLORS.crateTop;
        ctx.fillRect(x + 4, y + 4, CFG.TILE - 8, 6);
        ctx.strokeStyle = '#4a3a20';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 4, y + 4, CFG.TILE - 8, CFG.TILE - 8);
      } else if (ch === 'D') {
        ctx.fillStyle = COLORS.door;
        ctx.fillRect(x + 3, y, CFG.TILE - 6, CFG.TILE);
        ctx.fillStyle = '#a8842f';
        ctx.fillRect(x + CFG.TILE / 2 - 2, y + 8, 4, 12);
      }
    }
  }
  // Open doors lie flat, out of the way.
  for (const door of level.doors) {
    if (!door.open) continue;
    const x = door.c * CFG.TILE;
    const y = TOP + door.r * CFG.TILE;
    ctx.fillStyle = COLORS.doorOpen;
    ctx.fillRect(x + 3, y, CFG.TILE - 6, CFG.TILE);
  }
}

function drawPickups(ctx, level) {
  for (const key of level.keycards) {
    if (key.taken) continue;
    const { x, y } = tileCenter(key.c, key.r);
    ctx.fillStyle = COLORS.keycard;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2c00';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('K', x, y + 0.5);
  }
  for (const spot of level.pebbleSpots) {
    if (spot.taken) continue;
    const { x, y } = tileCenter(spot.c, spot.r);
    ctx.fillStyle = COLORS.pebble;
    ctx.beginPath();
    ctx.arc(x - 5, y + 3, 4, 0, Math.PI * 2);
    ctx.arc(x + 5, y - 2, 4, 0, Math.PI * 2);
    ctx.arc(x + 1, y + 6, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGuards(ctx, game) {
  for (const guard of game.guards) {
    const gx = guard.x;
    const gy = TOP + guard.y;
    // The cone first, so it sits under the guard.
    const range = guard.state === 'chase' ? CFG.VIEW_RANGE + 30 : CFG.VIEW_RANGE;
    const poly = conePolygon(game.level.grid, guard, range);
    ctx.fillStyle =
      guard.state === 'chase'
        ? COLORS.coneChase
        : guard.state === 'suspect' || guard.state === 'search'
          ? COLORS.coneSuspect
          : COLORS.cone;
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fill();

    // Guard body: a red disc with a facing tick and a torch dot.
    ctx.fillStyle =
      guard.state === 'chase'
        ? COLORS.guardChase
        : guard.state === 'suspect'
          ? COLORS.guardSuspect
          : COLORS.guard;
    ctx.beginPath();
    ctx.arc(gx, gy, guard.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2b0d0d';
    ctx.lineWidth = 2;
    ctx.stroke();
    const fx = gx + Math.cos(guard.angle) * (guard.radius + 5);
    const fy = gy + Math.sin(guard.angle) * (guard.radius + 5);
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Detection mark above the head.
    if (guard.detection > 0.05) {
      const mark = guard.detection >= 1 ? '!' : guard.detection >= CFG.SUSPECT_AT ? '?' : '·';
      ctx.fillStyle = guard.detection >= CFG.SUSPECT_AT ? '#ffcf3d' : '#e8ecf4';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(mark, gx, gy - guard.radius - 4);
    }
    // A thin ring shows the meter filling while the guard watches you.
    if (guard.detection > 0.02 && guard.detection < 1) {
      ctx.strokeStyle = '#ffcf3d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(gx, gy, guard.radius + 5, -Math.PI / 2, -Math.PI / 2 + guard.detection * Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawPlayer(ctx, game) {
  const p = game.player;
  const x = p.x;
  const y = TOP + p.y;
  // A soft shadow under the player so they read against the floor.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 10, 13, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.sneaking ? COLORS.playerSneak : COLORS.player;
  ctx.beginPath();
  ctx.arc(x, y, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0b2b30';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Facing tick.
  ctx.strokeStyle = '#0b2b30';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(p.angle) * (p.radius + 4), y + Math.sin(p.angle) * (p.radius + 4));
  ctx.stroke();
  // Sneak: a small "quiet" ring.
  if (p.sneaking) {
    ctx.strokeStyle = 'rgba(127,231,242,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, p.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPebbles(ctx, game) {
  for (const pebble of game.pebblesFlying) {
    const t = pebble.t;
    const x = pebble.x0 + (pebble.x1 - pebble.x0) * t;
    const y = TOP + pebble.y0 + (pebble.y1 - pebble.y0) * t - Math.sin(t * Math.PI) * 26;
    ctx.fillStyle = COLORS.pebble;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTopBar(ctx, game) {
  ctx.fillStyle = COLORS.hudBg;
  ctx.fillRect(0, 0, CFG.WIDTH, TOP);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('SHADOW STEP', 16, TOP / 2);
  if (game.level) {
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '15px monospace';
    ctx.fillText(`Level ${game.levelIndex + 1} — ${game.level.name}`, 220, TOP / 2);
  }
  // Detection meter, centre.
  const mw = 300;
  const mx = CFG.WIDTH / 2 - mw / 2;
  const my = 20;
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('DETECTION', mx, my - 8);
  ctx.fillStyle = '#262d40';
  ctx.fillRect(mx, my, mw, 12);
  const det = game.maxDetection || 0;
  ctx.fillStyle = det >= 1 ? COLORS.danger : det >= CFG.SUSPECT_AT ? '#ffb02e' : COLORS.ok;
  ctx.fillRect(mx, my, mw * Math.min(1, det), 12);
  ctx.strokeStyle = '#3a4358';
  ctx.strokeRect(mx + 0.5, my + 0.5, mw - 1, 11);
  if (game.alarm) {
    ctx.fillStyle = COLORS.danger;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(Math.floor(Date.now() / 400) % 2 === 0 ? 'ALARM!' : 'ALARM', mx + mw + 14, my + 6);
  }
  // Clock and score, right.
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'right';
  const t = game.time || 0;
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(Math.floor(t % 60)).padStart(2, '0');
  ctx.fillText(`${mm}:${ss}   SCORE ${game.score}`, CFG.WIDTH - 16, TOP / 2);
}

function drawMinimap(ctx, game) {
  const scale = 320 / PLAY_W;
  const mw = PLAY_W * scale;
  const mh = PLAY_H * scale;
  const ox = CFG.SIDEBAR_X;
  const oy = TOP + 30;
  ctx.fillStyle = '#0b0e17';
  ctx.fillRect(ox, oy, mw, mh);
  const level = game.level;
  for (let r = 0; r < CFG.ROWS; r++) {
    for (let c = 0; c < CFG.COLS; c++) {
      const ch = level.grid[r][c];
      if (ch === '#') {
        ctx.fillStyle = '#4d5c85';
        ctx.fillRect(ox + c * CFG.TILE * scale, oy + r * CFG.TILE * scale, CFG.TILE * scale, CFG.TILE * scale);
      } else if (ch === 'C') {
        ctx.fillStyle = '#6b5433';
        ctx.fillRect(ox + c * CFG.TILE * scale, oy + r * CFG.TILE * scale, CFG.TILE * scale, CFG.TILE * scale);
      } else if (ch === 'D') {
        ctx.fillStyle = '#7a5a22';
        ctx.fillRect(ox + c * CFG.TILE * scale, oy + r * CFG.TILE * scale, CFG.TILE * scale, CFG.TILE * scale);
      }
    }
  }
  const exit = tileCenter(level.exit.c, level.exit.r);
  ctx.fillStyle = COLORS.exit;
  ctx.fillRect(ox + (exit.x - 6) * scale, oy + (exit.y - TOP - 6) * scale, 12 * scale, 12 * scale);
  for (const key of level.keycards) {
    if (key.taken) continue;
    ctx.fillStyle = COLORS.keycard;
    ctx.fillRect(ox + key.c * CFG.TILE * scale + 3, oy + key.r * CFG.TILE * scale + 3, 7, 7);
  }
  for (const guard of game.guards) {
    ctx.fillStyle = COLORS.guard;
    ctx.beginPath();
    ctx.arc(ox + guard.x * scale, oy + guard.y * scale, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  const p = game.player;
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(ox + p.x * scale, oy + p.y * scale, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a4358';
  ctx.strokeRect(ox + 0.5, oy + 0.5, mw - 1, mh - 1);
}

function drawSidebar(ctx, game) {
  ctx.fillStyle = COLORS.sidebarBg;
  ctx.fillRect(CFG.SIDEBAR_X, TOP, CFG.WIDTH - CFG.SIDEBAR_X, CFG.HEIGHT - TOP);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('MINIMAP', CFG.SIDEBAR_X + 12, TOP + 20);
  drawMinimap(ctx, game);

  let y = TOP + 30 + (PLAY_H * 320) / PLAY_W + 26;
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 14px monospace';
  ctx.fillText('OBJECTIVES', CFG.SIDEBAR_X + 12, y);
  y += 22;
  ctx.font = '14px monospace';
  const level = game.level;
  const lines = [];
  const keysLeft = level.keycards.filter((k) => !k.taken).length;
  const doorsLeft = level.doors.filter((d) => !d.open).length;
  if (keysLeft > 0) lines.push([`Take the keycard (${keysLeft} left)`, false]);
  if (doorsLeft > 0) lines.push([`Unlock the vault door`, game.player.keys > 0]);
  lines.push(['Reach the EXIT unseen', false]);
  lines.push([game.levelAlarm ? 'Spotted — ghost run lost' : 'Ghost run: undetected', !game.levelAlarm]);
  for (const [text, done] of lines) {
    ctx.fillStyle = done ? COLORS.ok : COLORS.hudText;
    ctx.fillText(`${done ? '✓' : '·'} ${text}`, CFG.SIDEBAR_X + 12, y);
    y += 20;
  }

  y += 12;
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 14px monospace';
  ctx.fillText('KIT', CFG.SIDEBAR_X + 12, y);
  y += 22;
  ctx.font = '14px monospace';
  ctx.fillStyle = COLORS.hudText;
  ctx.fillText(`Pebbles: ${game.player.pebbles}  (click to throw)`, CFG.SIDEBAR_X + 12, y);
  y += 20;
  ctx.fillText(`Keycards: ${game.player.keys}`, CFG.SIDEBAR_X + 12, y);

  y += 26;
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '12px monospace';
  const controls = [
    'WASD / arrows — move',
    'SHIFT — sneak (harder to spot)',
    'CLICK — throw a pebble',
    'R — restart level   M — mute',
    'P — pause',
  ];
  for (const line of controls) {
    ctx.fillText(line, CFG.SIDEBAR_X + 12, y);
    y += 17;
  }
}

function drawBottomBar(ctx, game) {
  const y0 = TOP + PLAY_H;
  ctx.fillStyle = COLORS.hudBg;
  ctx.fillRect(0, y0, PLAY_W, CFG.HEIGHT - y0);
  ctx.fillStyle = '#232c42';
  ctx.fillRect(0, y0, PLAY_W, 2);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '13px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('WASD move   ·   SHIFT sneak   ·   CLICK throw a pebble   ·   R restart   ·   P pause   ·   M mute', 16, y0 + 20);
  if (game.level) {
    ctx.fillStyle = COLORS.hudText;
    ctx.textAlign = 'right';
    ctx.fillText(`PAR ${game.level.par}s`, PLAY_W - 16, y0 + 20);
  }
}

function drawMessage(ctx, game) {
  if (!game.message) return;
  if (game.time - game.messageAt > 4) return;
  ctx.fillStyle = 'rgba(16,20,31,0.85)';
  const text = game.message;
  ctx.font = '15px monospace';
  const w = ctx.measureText(text).width + 28;
  ctx.fillRect((PLAY_W - w) / 2, CFG.HEIGHT - 44, w, 30);
  ctx.fillStyle = COLORS.hudText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, PLAY_W / 2, CFG.HEIGHT - 29);
}

function overlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(6,8,16,0.78)';
  ctx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = accent || COLORS.hudText;
  ctx.font = 'bold 54px monospace';
  ctx.fillText(title, CFG.WIDTH / 2, 300);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '18px monospace';
  lines.forEach((line, i) => {
    ctx.fillText(line, CFG.WIDTH / 2, 360 + i * 30);
  });
}

export function draw(ctx, game) {
  ctx.clearRect(0, 0, CFG.WIDTH, CFG.HEIGHT);
  ctx.fillStyle = '#0b0e17';
  ctx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT);

  if (game.screen === 'title') {
    // A live level 1 idles behind the title so the first thing a player
    // sees is the game itself, guards on patrol.
    if (game.level) {
      drawFloor(ctx, game.level);
      drawExit(ctx, game.level);
      drawStatics(ctx, game.level);
      drawPickups(ctx, game.level);
      drawGuards(ctx, game);
      drawPlayer(ctx, game);
    }
    overlay(ctx, 'SHADOW STEP', [
      'A top-down stealth game. Slip past the guards, mind their cones,',
      'toss pebbles to pull them away, and reach the EXIT unseen.',
      '',
      'Three levels. One ghost run. No alarms.',
      '',
      'Press ENTER or click to begin    ·    WASD to move, SHIFT to sneak',
    ]);
    return;
  }

  if (!game.level) return;
  drawFloor(ctx, game.level);
  drawExit(ctx, game.level);
  drawStatics(ctx, game.level);
  drawPickups(ctx, game.level);
  drawGuards(ctx, game);
  drawPlayer(ctx, game);
  drawPebbles(ctx, game);
  drawTopBar(ctx, game);
  drawSidebar(ctx, game);
  drawBottomBar(ctx, game);
  drawMessage(ctx, game);

  if (game.screen === 'clear' && game.clearStats) {
    const s = game.clearStats;
    overlay(
      ctx,
      s.ghost ? 'GHOST — UNSEEN!' : 'LEVEL CLEAR',
      [
        `${game.level.name} finished in ${Math.round(s.time)}s (par ${s.par}s)`,
        s.ghost ? `Ghost bonus +${CFG.GHOST_BONUS}` : 'Spotted — no ghost bonus this time',
        `Level bonus +${s.bonus}   ·   Total score ${game.score}`,
        '',
        'Press ENTER for the next level',
      ],
      s.ghost ? COLORS.ok : COLORS.hudText,
    );
  } else if (game.screen === 'over') {
    overlay(ctx, 'CAUGHT!', [
      `Guard ${game.caughtBy + 1} got you. The run ends in the light.`,
      '',
      'Press R to retry the level',
    ], COLORS.danger);
  } else if (game.screen === 'win') {
    const lines = ['Every level cleared. The museum never knew you were there.', ''];
    game.levelStats.forEach((st, i) => {
      lines.push(`Level ${i + 1} ${st.name}: ${Math.round(st.time)}s — ${st.ghost ? 'GHOST' : 'spotted'} (+${st.bonus})`);
    });
    lines.push('');
    lines.push(`Final score ${game.score}   ·   Ghost levels ${game.ghostLevels} of 3`);
    lines.push('');
    lines.push('Press ENTER to play again');
    overlay(ctx, 'ALL CLEAR', lines, COLORS.ok);
  }
}
