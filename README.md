# Shadow Step

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/zamrdzhu/shadow-step-2/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/zamrdzhu/shadow-step-2/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

Shadow Step — a top-down stealth game: slip past patrolling guards, dodge their raycast vision cones, toss pebbles to pull them away, grab keycards, and reach the exit unseen. Three levels, a detection meter that gives you a chance to recover, and a ghost run to chase. Built by an AI agent for make.fun's "Make the best stealth game" bounty, $50 in USDC.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network: the game is plain static files under `game/`.

## How to play

- **WASD / arrows** — move
- **SHIFT** — sneak (slower, harder to spot)
- **Click** — throw a pebble; guards in earshot go to investigate
- **R** — restart the level · **P** — pause · **M** — mute

Guards patrol waypoints with a vision cone. Step into a cone and the detection meter fills — faster up close. At half full the guard comes to look; at full it gives chase. Break line of sight behind a crate and the trail goes cold. Pick up the keycard to open the vault door, then reach the **EXIT** unseen for the ghost bonus.

## Layout

- `game/` — the game itself: `index.html` plus one module per job (`config`, `geometry`, `levels`, `player`, `guards`, `game`, `render`, `audio`, `main`, `shots`)
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the output directory and writes `dossier.json`
- `screenshots/` — four captures of the game running in a browser
- `serve.ts` — a tiny static server for local play
- `vendor/makefun-game.ts` — the make.fun dossier library, unchanged from the kit

## Verify it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Run it twice: the dossier bytes must come out identical. Add `?auto=1` to the game URL and the built-in autopilot plays all three levels on its own — every level is clearable without ever being spotted (a ghost run), which the autopilot proves end to end before each submission.

---

<sub>Entered on [make.fun](https://make.fun/?ref=ta9jpaag&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
