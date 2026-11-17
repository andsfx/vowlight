// Every tuning number, colour and label VOWLIGHT uses, so the arena, the keeper, the ward, the bolts,
// the four husk kinds, the ten waves, the flame, the combo and the wording all change in one place.

/** The logical field: every rule and every draw works in these coordinates, whatever the window size. */
export const FIELD = { width: 1280, height: 720 };

/** The palette: near-black arena, amber flame, cyan ward, violet husks, magenta bolts. */
export const PALETTE = {
  background: '#070d12',
  haze: '#0d1720',
  flame: '#ffb347',
  flameDeep: '#ff8c2b',
  flameHot: '#ffe9c9',
  ward: '#57e0d8',
  wardHot: '#eaffff',
  enemy: '#8b7bf0',
  enemyHot: '#ddd8ff',
  bolt: '#ff5d73',
  boltHot: '#ffd9df',
  friendly: '#9ffcf4',
  text: '#e9f1f2',
  muted: '#7d8c96',
  danger: '#ff4d6d',
  panel: 'rgba(6, 11, 16, 0.86)',
  panelEdge: 'rgba(87, 224, 216, 0.22)',
  ink: '#04080b',
};

/** Type: system faces only, nothing is fetched over the network. */
export const TYPE = {
  ui: '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif',
  mono: '"SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
};

/** The keeper: a 14 px lantern at the arena centre, 300 px/s, kept 44 px inside the edge. */
export const KEEPER = {
  radius: 14,
  speed: 300,
  margin: 44,
  acceleration: 2600,
  wardTurnRate: 26,
  trailLength: 14,
};

/** The ward: a 90 degree arc at 46 px that widens to 150 degrees at 54 px while braced. */
export const WARD = {
  idleArcDegrees: 90,
  idleRadius: 46,
  braceArcDegrees: 150,
  braceRadius: 54,
  band: 9,
  rimWidth: 6,
  braceRingRadius: 66,
};

/** Enemy bolts and the friendly bolts they become: 5 px, 210-260 px/s, reflected at 1.35x for 3 s. */
export const BOLT = {
  radius: 5,
  friendlyRadius: 6,
  speedMin: 210,
  speedMax: 260,
  armSeconds: 0.28,
  friendlyLifeSeconds: 3,
  friendlySpeedScale: 1.35,
  damage: 1,
  trailLength: 7,
};

/** Splash: a friendly bolt's burst reaches 46 px and takes 2 off every husk caught inside it. */
export const SPLASH = { radius: 46, damage: 2 };

/** The four husk kinds: health, points, size, ai speeds, fire cadence and armour. */
export const ENEMY_KINDS = {
  wisp: {
    name: 'wisp',
    health: 1,
    points: 10,
    radius: 13,
    speed: 62,
    orbitRadius: 260,
    fireEvery: 2.2,
    boltSpeed: 210,
    aimSpread: 0.07,
  },
  lancer: {
    name: 'lancer',
    health: 2,
    points: 25,
    radius: 16,
    speed: 0,
    preferredRange: 380,
    telegraphSeconds: 1.0,
    fireEvery: 3.6,
    boltSpeed: 260,
  },
  splitter: {
    name: 'splitter',
    health: 3,
    points: 40,
    radius: 20,
    speed: 54,
    standoff: 76,
    splitInto: 2,
  },
  warden: {
    name: 'warden',
    health: 6,
    points: 150,
    radius: 30,
    speed: 40,
    preferredRange: 300,
    fireEvery: 2.8,
    boltSpeed: 230,
    spread: 3,
    spreadArc: 0.26,
    armourHalfArcDegrees: 66,
  },
};

/** Ten waves: wave N brings 3 + N husks, at most 9 alive, a warden on 4, 7 and 10. */
export const WAVES = {
  total: 10,
  firstCount: 3,
  aliveCap: 9,
  breatherSeconds: 3,
  introSeconds: 1.4,
  spawnGapMin: 0.85,
  spawnGapMax: 1.5,
  wardenWaves: [4, 7, 10],
  bannerSeconds: 2.4,
  spawnRadiusMin: 360,
  spawnRadiusMax: 500,
};

/** Three flame pips; a bolt costs one and buys 1.6 s of flickering invulnerability. */
export const FLAME = { pips: 3, invulnerableSeconds: 1.6, flickerRate: 26 };

/** The combo climbs one step per kill inside 3.5 s, up to x8, and falls back to x1 when it lapses. */
export const COMBO = { windowSeconds: 3.5, maxMultiplier: 8 };

/** Feedback: hit flash length, shake limits, particle budget and drifting ash. */
export const EFFECTS = {
  hitFlashSeconds: 0.09,
  shakeMax: 16,
  shakeDecay: 7,
  particleLimit: 460,
  ashCount: 90,
  burstParticles: 18,
};

/** Where the best score lives. */
export const STORAGE_KEY = 'vowlight.best';

/** Every string the screens and the hud print. */
export const TEXT = {
  title: 'VOWLIGHT',
  tagline: 'Keep the flame. Return the dark.',
  startPrompt: 'PRESS SPACE',
  score: 'SCORE',
  wave: 'WAVE',
  flame: 'FLAME',
  best: 'BEST',
  braceHint: 'SPACE / RIGHT MOUSE',
  braceLabel: 'BRACE',
  bracedLabel: 'WARD BRACED',
  victoryTitle: 'THE VOW IS KEPT',
  defeatTitle: 'THE FLAME GOES OUT',
  againPrompt: 'PRESS SPACE TO PLAY AGAIN',
  legend: [
    ['WASD', 'MOVE'],
    ['MOUSE', 'AIM WARD'],
    ['SPACE', 'BRACE'],
    ['R', 'RESTART'],
  ],
  victoryStats: ['SCORE', 'WAVES CLEARED', 'BEST COMBO', 'TIME'],
  defeatStats: ['SCORE', 'WAVE REACHED', 'BEST COMBO', 'TIME'],
  titleStatus: 'VOWLIGHT. Press space to begin.',
  playStatusPrefix: 'Playing wave',
  victoryStatus: 'The vow is kept. Press space to play again.',
  defeatStatus: 'The flame goes out. Press space to play again.',
};
