// Shadow Step — bootstrap and input.
// One job: own the canvas, the keyboard and mouse, and the frame loop,
// and hand the game a clean input object every frame. Query strings:
//   ?auto=1        the autopilot plays on its own
//   ?scene=title|cover|chase|win   stage one moment for a screenshot
//   ?level=2       start on that level (1-based) with the title skipped

import { CFG } from './config.js';
import { createGame, loadLevel, nextLevel, retryLevel, startGame, toTitle, update, updateAmbient } from './game.js';
import { draw } from './render.js';
import { createAudio, playAlarm, playCaught, playPebble, playPickup, playSteps, playWin, toggleMute } from './audio.js';
import { stageScene } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CFG.WIDTH;
canvas.height = CFG.HEIGHT;

const game = createGame();
const audio = createAudio();
const params = new URLSearchParams(location.search);

// The title shows a live level 1 behind it, guards already on patrol.
loadLevel(game, 0);
if (params.get('auto') === '1') {
  game.auto = true;
  startGame(game);
}
const levelParam = Number(params.get('level') || 0);
if (levelParam >= 1 && levelParam <= 3 && params.get('auto') !== '1') {
  loadLevel(game, levelParam - 1);
  game.screen = 'play';
}

const keys = new Set();
let mouse = { x: 0, y: 0 };
let clickAt = null;
let paused = false;

function keyName(e) {
  return e.key.toLowerCase();
}

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  keys.add(keyName(e));
  if (keyName(e) === 'm') toggleMute(audio);
  if (keyName(e) === 'p' && game.screen === 'play') paused = !paused;
  if (keyName(e) === 'enter') {
    if (game.screen === 'title') startGame(game);
    else if (game.screen === 'clear') nextLevel(game);
    else if (game.screen === 'win') {
      toTitle(game);
      loadLevel(game, 0);
    }
  }
  if (keyName(e) === 'r' && (game.screen === 'over' || game.screen === 'play')) retryLevel(game);
});
window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse = {
    x: ((e.clientX - rect.left) / rect.width) * CFG.WIDTH,
    y: ((e.clientY - rect.top) / rect.height) * CFG.HEIGHT,
  };
});
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * CFG.WIDTH;
  const y = ((e.clientY - rect.top) / rect.height) * CFG.HEIGHT;
  if (game.screen === 'title') {
    startGame(game);
    return;
  }
  if (game.screen === 'clear') {
    nextLevel(game);
    return;
  }
  if (game.screen === 'win') {
    toTitle(game);
    loadLevel(game, 0);
    return;
  }
  if (game.screen === 'over') {
    retryLevel(game);
    return;
  }
  if (game.screen === 'play') clickAt = { x, y: y - CFG.TOP_BAR };
});

// A handle for the autopilot verifier and the screenshot scenes.
window.__shadow = {
  game,
  audio,
  stage: (name) => stageScene(game, name),
  state: () => ({
    screen: game.screen,
    level: game.levelIndex + 1,
    time: game.time,
    score: game.score,
    alarm: game.alarm,
    levelAlarm: game.levelAlarm,
    autoRuns: game.autoRuns,
    autoGhosts: game.autoGhosts,
    player: game.player ? { x: game.player.x, y: game.player.y, pebbles: game.player.pebbles, keys: game.player.keys } : null,
    guards: game.guards.map((g) => ({ state: g.state, detection: g.detection })),
  }),
};

const scene = params.get('scene');
if (scene) stageScene(game, scene);

let last = performance.now();
let lastAlarm = false;
let lastCaught = false;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const input = { x: 0, y: 0, sneak: false, throw: null };
  if (game.screen === 'title' && !paused) updateAmbient(game, dt);
  if (game.screen === 'play' && !paused) {
    if (keys.has('a') || keys.has('arrowleft')) input.x -= 1;
    if (keys.has('d') || keys.has('arrowright')) input.x += 1;
    if (keys.has('w') || keys.has('arrowup')) input.y -= 1;
    if (keys.has('s') || keys.has('arrowdown')) input.y += 1;
    if (input.x !== 0 && input.y !== 0) {
      input.x *= Math.SQRT1_2;
      input.y *= Math.SQRT1_2;
    }
    input.sneak = keys.has('shift');
    if (clickAt) {
      input.throw = clickAt;
      clickAt = null;
      playPebble(audio);
    }
    update(game, input, dt);
    playSteps(audio, game, game.time);
    if (game.alarm && !lastAlarm) playAlarm(audio);
    if (game.screen === 'over' && !lastCaught) playCaught(audio);
    if (game.screen === 'win') playWin(audio);
    lastAlarm = game.alarm;
    lastCaught = game.screen === 'over';
  }

  draw(ctx, game);
  if (paused && game.screen === 'play') {
    ctx.fillStyle = 'rgba(6,8,16,0.6)';
    ctx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT);
    ctx.fillStyle = '#e8ecf4';
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED — press P', CFG.WIDTH / 2, CFG.HEIGHT / 2);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
