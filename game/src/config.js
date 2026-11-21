// Shadow Step — tuning constants and palette.
// One job: every number the rest of the game agrees on lives here,
// so balancing the game means editing this file and nothing else.

export const CFG = {
  // Board geometry. The playfield is 24 x 16 tiles of 40 px, drawn at
  // (0, TOP_BAR) with a sidebar on the right for the minimap and status.
  TILE: 40,
  COLS: 24,
  ROWS: 16,
  TOP_BAR: 64,
  SIDEBAR_X: 960,
  WIDTH: 1280,
  HEIGHT: 800,

  // Player movement, pixels per second.
  PLAYER_SPEED: 148,
  SNEAK_SPEED: 82,
  PLAYER_RADIUS: 13,

  // Guards.
  GUARD_SPEED_PATROL: 62,
  GUARD_SPEED_CHASE: 132,
  GUARD_SPEED_SEARCH: 88,
  GUARD_RADIUS: 14,
  // Vision: how far a guard sees, and how wide the cone is (half-angle).
  VIEW_RANGE: 235,
  VIEW_HALF_ANGLE: 0.61, // ~35 degrees each side
  VIEW_RANGE_SNEAK: 150, // a sneaking player is spotted from closer
  VIEW_RANGE_CROUCH_COVER: 0, // behind a crate the player is invisible

  // Detection meter 0..1. Rises while the player is inside a cone with a
  // clear line of sight, faster up close; falls when unseen.
  DETECT_RATE_NEAR: 1.15,
  DETECT_RATE_FAR: 0.45,
  DETECT_DECAY: 0.30,
  SUSPECT_AT: 0.45, // guard walks over to look
  ALARM_AT: 1.0, // full detection: the guard gives chase
  // How long a chasing guard keeps hunting after losing sight.
  CHASE_MEMORY_SEC: 4.0,
  SEARCH_SEC: 5.0,

  // Pebbles: a thrown pebble rings out to this radius; guards inside it
  // walk over to investigate the landing spot.
  PEBBLE_NOISE_RADIUS: 190,
  PEBBLE_START: 3,

  // Scoring.
  PAR_SEC: [75, 110, 150],
  GHOST_BONUS: 500,
  TIME_BONUS_PER_SEC: 6,

  // Autopilot (used by ?auto=1 and by the screenshot scenes).
  AUTO_WAIT_SEEN: 0.12, // wait while any guard's detection is above this
  AUTO_STUCK_SEC: 7, // then toss a pebble to pull the guard away
};

// Palette: a night museum after closing — deep blue floor, warm lamps,
// amber cones, a player in pale cyan so the eye finds them at once.
export const COLORS = {
  floorA: '#1b2334',
  floorB: '#181f2e',
  floorLine: '#232c42',
  wall: '#3a4666',
  wallTop: '#4d5c85',
  crate: '#6b5433',
  crateTop: '#8a6f45',
  door: '#7a5a22',
  doorOpen: '#3c4a2a',
  exit: '#2fd67a',
  exitGlow: '#1d7a48',
  keycard: '#ffd34d',
  pebble: '#c8ccd8',
  player: '#7fe7f2',
  playerSneak: '#4fb8c9',
  guard: '#ff5d5d',
  guardSuspect: '#ffb02e',
  guardChase: '#ff2e2e',
  cone: 'rgba(255, 190, 60, 0.20)',
  coneSuspect: 'rgba(255, 140, 40, 0.30)',
  coneChase: 'rgba(255, 60, 60, 0.30)',
  shadow: 'rgba(6, 8, 16, 0.55)',
  hudBg: '#10141f',
  hudText: '#e8ecf4',
  hudDim: '#8a93a8',
  sidebarBg: '#141926',
  accent: '#ffd34d',
  danger: '#ff5d5d',
  ok: '#2fd67a',
};
