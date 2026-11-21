// Shadow Step — the hand-in program (Node 22, standard library only).
//
// It copies this repository's game/ and screenshots/ into the output
// directory and writes /output/dossier.json with the vendored make.fun
// library, so the judge can read the game. Run it twice and the bytes
// must come out identical: the program is pure copying plus the
// dossier builder, and nothing in it depends on the clock or the
// environment. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for
// /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The game itself: plain static files, no build step, no network.
// The gate only accepts plain files and directories under game/, so
// refuse a symlink here rather than ship one.
const gameDir = join(here, 'game');
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing — the entry has no game to hand in');
}
for (const name of readdirSync(gameDir)) {
  if (statSync(join(gameDir, name), { throwIfNoEntry: false })?.isSymbolicLink()) {
    throw new Error(`game/${name} is a symlink — the gate takes plain files only`);
  }
}
mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });

// Screenshots: 3 or 4, each at most 256 KiB, the first by name the cover.
// Refuse to hand in a broken set rather than ship one silently.
const shotsDir = join(here, 'screenshots');
const shots = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((name) => !name.startsWith('.')).sort()
  : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`screenshots/ must hold 3 or 4 images, found ${shots.length}`);
}
for (const name of shots) {
  const size = statSync(join(shotsDir, name)).size;
  if (size > 256 * 1024) throw new Error(`screenshot ${name} is ${size} bytes, over the 256 KiB cap`);
}
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The dossier the judge reads: the game's source and its screenshots,
// written by the vendored make.fun library with the scorer's own caps.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`handed in ${shots.length} screenshots and game/ to ${out}`);
console.log(`dossier.json is ${statSync(join(out, 'dossier.json')).size} bytes`);
