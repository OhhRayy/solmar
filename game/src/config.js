// Every tuning number, colour and piece of text in one place. Solmar is a fixed logical
// world (3280 x 2480 units) drawn through a camera that follows the player; the canvas
// itself is always 1280 x 720 logical pixels, scaled to the window.

export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const WORLD = { width: 3280, height: 2480 };

export const SAVE_KEY = 'solmar.save.v1';

// The road grid: 8 vertical roads and 6 horizontal ones, 400 apart, 100 wide.
export const ROADS = {
  vertical: [240, 640, 1040, 1440, 1840, 2240, 2640, 3040],
  horizontal: [240, 640, 1040, 1440, 1840, 2240],
  width: 100,
};

export const PLAYER = {
  radius: 14,
  walkSpeed: 175,
  sprintSpeed: 265,
  health: 100,
  regenPerSecond: 1.2,
  punchRange: 46,
  punchDamage: 25,
  batDamage: 55,
  batRange: 58,
  punchCooldown: 0.38,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 430,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 540,
  maxReverse: 190,
  steer: 2.5,
  driftGrip: 0.92,
  grip: 0.985,
  enterRange: 66,
};

export const TRAFFIC = { count: 16, cruise: 205, cruiseJitter: 55 };
export const PEDS = { count: 26, walk: 58, flee: 215 };

export const WANTED = {
  maxStars: 5,
  stealCar: 25,
  hitPedestrian: 15,
  punchPedestrian: 6,
  punchCop: 30,
  ramCopCar: 12,
  lockSeconds: 5,
  decayPerSecond: 3,
  decayClearRange: 450,
  maxFootCops: 3,
  maxInterceptors: 2,
};

export const COP = { speed: 205, arrestRange: 30, arrestSeconds: 1.2, giveUpRange: 820 };
export const INTERCEPTOR = { maxSpeed: 520, accel: 470, ramDamage: 6, boxInSeconds: 2.0, boxInRange: 62 };

export const MISSIONS = [
  { id: 'hot-wheels', name: 'Hot Wheels', reward: 250, time: 180, brief: 'Steal any car and deliver it to the Marina Garage.' },
  { id: 'sunset-run', name: 'Sunset Run', reward: 400, time: 90, brief: 'Hit all 5 checkpoints along the coast road before the sun sets.' },
  { id: 'lose-heat', name: 'Lose the Heat', reward: 350, time: 150, brief: 'The law is on you. Break line of sight and let the heat die down.' },
  { id: 'cab-hustle', name: 'Cab Hustle', reward: 500, time: 240, brief: 'Three fares are waiting. Pick them up and drop them off, fast.' },
  { id: 'solmar-score', name: 'The Solmar Score', reward: 1500, time: 300, brief: 'Walk into the Reserve Bank, take the vault cash, and lose the law at the beach.' },
];

export const PALETTE = {
  ground: '#c9b48c',
  sidewalk: '#d9cdb2',
  road: '#3f444c',
  roadEdge: '#2e3238',
  lane: '#e8d44d',
  park: '#79a95a',
  parkDark: '#5d8f45',
  sand: '#ecd9a4',
  sea: '#2b9ec6',
  seaDeep: '#1b7ea6',
  plaza: '#e6d5ac',
  buildingRoof: '#e8dcc8',
  text: '#f4f1e8',
  darkText: '#23262b',
  muted: '#c9c2ae',
  gold: '#f2c94c',
  cash: '#58c96b',
  health: '#e5534b',
  police: '#4f8ef7',
  panel: 'rgba(20, 24, 30, 0.88)',
  panelEdge: 'rgba(255, 255, 255, 0.16)',
};

export const BUILDING_COLORS = ['#e8dcc8', '#d98a6a', '#7fb3a8', '#e8b64c', '#9a8fb5', '#c96f5a', '#8fb8d8', '#e3cfa5'];
export const CAR_COLORS = ['#d94f3d', '#3d7fd9', '#f2c94c', '#58c96b', '#e8e8e8', '#8a5fd9', '#e87fa8', '#3fb8a8', '#e07b2e', '#5a6b7d'];
export const PED_SHIRTS = ['#d94f3d', '#3d7fd9', '#f2c94c', '#58c96b', '#e8e8e8', '#8a5fd9', '#e87fa8', '#e07b2e'];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const STORY = [
  'Solmar. A sun-soaked city on the coast, where the marina glitters',
  'and everybody owes somebody something. You are Rio Vega, a driver',
  'fresh out of the marina with an empty wallet and a fast reputation.',
  'Mara Sol, the fixer at the Palm Plaza, has five jobs for you.',
  'Finish them all and the city is yours.',
];
