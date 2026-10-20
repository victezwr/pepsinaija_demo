// Every tunable number for the chase. Units: metres, seconds, m/s.

export const COIN_TARGET = 1000;

/** Speed rises in stages as the coin count grows (Subway Surfers-style pace jumps). */
export const STAGES: ReadonlyArray<{ coins: number; speed: number; gap: [number, number]; maxBlocked: number }> = [
  { coins: 0, speed: 12, gap: [24, 32], maxBlocked: 1 },
  { coins: 200, speed: 14.5, gap: [21, 28], maxBlocked: 2 },
  { coins: 400, speed: 17, gap: [19, 25], maxBlocked: 2 },
  { coins: 600, speed: 20, gap: [18, 23], maxBlocked: 3 },
  { coins: 800, speed: 23, gap: [17, 22], maxBlocked: 3 },
];
export const SPEED_EASE_PER_S = 2.5; // how fast speed blends to a new stage

// Track
export const LANE_WIDTH = 2.2;
export const LANES = [-1, 0, 1] as const;
export const ROAD_HALF = LANE_WIDTH * 1.5 + 0.3;
export const SIDEWALK = 3.2;
export const SPAWN_HORIZON = 130; // rows are spawned this far ahead
export const DESPAWN_Z = 12; // behind the camera
export const START_GRACE = 34; // empty road at the start

// Player
export const RUNNER_HEIGHT = 1.75;
export const AGBERO_HEIGHT = 1.8;
export const LANE_SWITCH_RATE = 14;
export const JUMP_VELOCITY = 9.2;
export const GRAVITY = 27;
export const FAST_FALL_VELOCITY = -16;
export const DUCK_TIME = 0.8;
export const SLIDE_LEAN = 0.9; // rad the runner throws the body back while sliding
export const STAND_TOP = 1.7;
export const DUCK_TOP = 1.0;
export const PLAYER_HALF_W = 0.35;
export const PLAYER_HALF_D = 0.35;
export const STUMBLE_WINDOW = 4; // a second stumble inside this window = caught

// Chasers
export const CHASE_CLOSE = 1.0; // just behind the runner, flanking
export const CHASE_FAR = 10; // behind the camera
export const CHASE_HOLD_S = 3;
export const BUBBLE_LINES = ['Hold am!', 'Where you dey go?!', 'Bring that Pepsi come!', 'Oya stop there!', 'Na our own be dat!'];

// Coins (yellow caps)
export const COIN_POOL = 140;
export const COIN_SPACING = 1.6;
export const COIN_RADIUS = 0.22;
export const COIN_PICKUP = 0.9;

// Finish
export const TOWER_DISTANCE = 150; // locked tower stays this far ahead until COIN_TARGET
export const TOWER_HEIGHT = 14;
export const BOTTLE_ON_TOWER = 2.4;
export const FINISH_STOP = 11; // runner stops this far in front of the tower

// Camera
export const CAM_HEIGHT = 2.9;
export const CAM_BACK = 5.4;
export const CAM_LOOK_AHEAD = 9;
export const REVEAL_S = 3.2; // camera pull-back
export const REVEAL_HOLD_S = 0.9; // hold on the bottle after it lands
export const BOTTLE_DROP_S = 0.45;

export type PropName =
  | 'danfo'
  | 'keke'
  | 'okada'
  | 'barrier-low'
  | 'vendor-table'
  | 'banner'
  | 'building-1'
  | 'building-2'
  | 'building-3'
  | 'pole'
  | 'tower';

/**
 * Obstacles. Tripo models are normalised (longest side = 1, base at y = 0).
 * `action` tells the player what beats it; hit boxes are in metres.
 */
export const OBSTACLES = {
  danfo: { prop: 'danfo', action: 'swerve', scale: 5, rotY: 0, halfW: 1.0, length: 5, bottom: 0, top: 2.7, weight: 3 },
  keke: { prop: 'keke', action: 'swerve', scale: 2.8, rotY: Math.PI / 2, halfW: 0.8, length: 2.8, bottom: 0, top: 1.8, weight: 3 },
  okada: { prop: 'okada', action: 'swerve', scale: 2.1, rotY: Math.PI / 2, halfW: 0.6, length: 2.1, bottom: 0, top: 1.3, weight: 2 },
  barrier: { prop: 'barrier-low', action: 'jump', scale: 2.0, rotY: 0, halfW: 1.0, length: 0.6, bottom: 0, top: 0.9, weight: 3 },
  table: { prop: 'vendor-table', action: 'jump', scale: 1.9, rotY: 0, halfW: 0.95, length: 1.1, bottom: 0, top: 1.0, weight: 2 },
  banner: { prop: 'banner', action: 'duck', scale: 2.3, scaleY: 3.6, rotY: 0, halfW: 1.1, length: 0.5, bottom: 1.55, top: 3, weight: 3 },
} as const;
export type ObstacleKind = keyof typeof OBSTACLES;
