// Shadow Step — the three levels.
// One job: the maps. Legend: '#' wall, '.' floor, 'C' crate (blocks
// movement and sight — the cover you hide behind), 'D' locked door,
// 'K' keycard, '*' pebble pickup, 'E' exit, 'S' player start.
// Guard patrols are waypoint lists; guards walk between them with A*,
// so a patrol may cross any open ground.

export const LEVELS = [
  {
    name: 'Night Shift',
    sub: 'Learn the dark. Two guards, no locked doors.',
    par: 75,
    pebbles: 3,
    map: [
      '########################',
      '#......C......C......E.#',
      '#.C.....##.....C.......#',
      '#......#.......#.......#',
      '#..##..#...##..#...##..#',
      '#......#.......#.......#',
      '#..C.......C.......C...#',
      '#......#.......#.......#',
      '#..##..#...##..#...##..#',
      '#......#.......#.......#',
      '#...C......C.......C...#',
      '#......#.......#.......#',
      '#..##..#...##..#...##..#',
      '#......#.......#.......#',
      '#S.....#...*...#...C...#',
      '########################',
    ],
    guards: [
      { path: [[2, 7], [21, 7]], pause: 1.2 },
      { path: [[18, 2], [18, 13]], pause: 1.0 },
    ],
  },
  {
    name: 'The Vault',
    sub: 'The exit is sealed. Take the keycard, then the door.',
    par: 110,
    pebbles: 3,
    map: [
      '########################',
      '#K.....C......C.....#E.#',
      '#.C.....##.....C....D..#',
      '#......#.......#....D..#',
      '#..##..#...##..#....D..#',
      '#......#.......#....####',
      '#..C.......C.......C...#',
      '#......#.......#.......#',
      '#..##..#...##..#...##..#',
      '#......#.......#.......#',
      '#...C......C.......C...#',
      '#......#.......#.......#',
      '#..##..#...##..#...##..#',
      '#......#.......#.......#',
      '#S.....#...*...#...C...#',
      '########################',
    ],
    guards: [
      { path: [[2, 7], [21, 7]], pause: 1.0 },
      { path: [[18, 2], [18, 13]], pause: 0.9 },
      { path: [[2, 12], [21, 12]], pause: 1.1 },
    ],
  },
  {
    name: 'Blackout',
    sub: 'Four guards, one keycard, no room for mistakes.',
    par: 150,
    pebbles: 4,
    map: [
      '########################',
      '#K.....C......C.....#E.#',
      '#.C..C..##..C..C....D..#',
      '#......#.......#....D..#',
      '#..##..#...##..#....D..#',
      '#..C...#....C..#....####',
      '#..C.......C.......C...#',
      '#..##..#...##..#...##..#',
      '#......#....C..#.......#',
      '#..C...#.......#...C...#',
      '#......#...##..#.......#',
      '#..##..#.......#...##..#',
      '#......#....C..#.......#',
      '#..C...#.......#...C...#',
      '#S..*..#...*...#...C...#',
      '########################',
    ],
    guards: [
      { path: [[2, 6], [21, 6]], pause: 0.8 },
      { path: [[18, 2], [18, 13]], pause: 0.8 },
      { path: [[2, 11], [21, 11]], pause: 0.9 },
      { path: [[5, 3], [5, 13]], pause: 0.7 },
    ],
  },
];

// Parse one level definition into a live level: a mutable grid copy,
// pixel start, and the lists of pickups, doors and guards.
export function parseLevel(def, index) {
  if (def.map.length !== 16) throw new Error(`level ${index}: need 16 rows, got ${def.map.length}`);
  for (const row of def.map) {
    if (row.length !== 24) throw new Error(`level ${index}: row must be 24 chars: "${row}"`);
  }
  const grid = def.map.map((row) => row.split(''));
  const level = {
    index,
    name: def.name,
    sub: def.sub,
    par: def.par,
    pebbles: def.pebbles,
    grid,
    start: null,
    exit: null,
    keycards: [],
    pebbleSpots: [],
    doors: [],
  };
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 24; c++) {
      const ch = grid[r][c];
      if (ch === 'S') {
        level.start = { x: (c + 0.5) * 40, y: (r + 0.5) * 40 };
        grid[r][c] = '.';
      } else if (ch === 'E') {
        level.exit = { c, r };
        grid[r][c] = '.';
      } else if (ch === 'K') {
        level.keycards.push({ c, r, taken: false });
        grid[r][c] = '.';
      } else if (ch === '*') {
        level.pebbleSpots.push({ c, r, taken: false });
        grid[r][c] = '.';
      } else if (ch === 'D') {
        level.doors.push({ c, r, open: false });
      }
    }
  }
  if (!level.start) throw new Error(`level ${index}: no player start`);
  if (!level.exit) throw new Error(`level ${index}: no exit`);
  return level;
}
