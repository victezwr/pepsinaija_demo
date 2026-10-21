// Every tunable number for The Yellow Chase. Units: metres, seconds, m/s.

export const TITLE = 'THE YELLOW CHASE';
export const X_HANDLE = '@Pepsi_naija';
export const HASHTAG = '#PepsiYellowChase';
export const SHARE_URL = 'https://dontshakeme.vercel.app';

/**
 * Endless run: the pace jumps in stages by distance. Rows of obstacles are timed to the theme
 * song: one row reaches the runner every `beats` beats, so the spacing in metres is
 * beats × beat length × speed (e.g. 4 beats at 17 m/s ≈ 26 m).
 */
export const STAGES: ReadonlyArray<{ dist: number; speed: number; beats: number; maxBlocked: number }> = [
  { dist: 0, speed: 17, beats: 4, maxBlocked: 1 },
  { dist: 500, speed: 18.5, beats: 4, maxBlocked: 2 },
  { dist: 1200, speed: 20, beats: 4, maxBlocked: 2 },
  { dist: 2000, speed: 22, beats: 3, maxBlocked: 3 },
  { dist: 3000, speed: 24, beats: 3, maxBlocked: 3 },
];
export const SPEED_EASE_PER_S = 2.5;
export const MAX_STEP = 0.4; // metres per collision sub-step

// Track
export const LANE_WIDTH = 2.2;
export const ROAD_HALF = LANE_WIDTH * 1.5 + 0.3;
export const SIDEWALK = 3.2;
export const SPAWN_HORIZON = 130;
export const DESPAWN_Z = 12;
export const START_GRACE_BEATS = 6; // empty road (once up to speed) before the first row

// Player
export const RUNNER_HEIGHT = 1.75;
export const AGBERO_HEIGHT = 1.8;
export const CHAIRMAN_SCALE = 1.12;
export const LANE_SWITCH_RATE = 14;
export const JUMP_VELOCITY = 9.2;
export const JUMP_BUFFER_S = 0.25; // a swipe up this long before landing jumps on landing
export const GRAVITY = 27;
export const FAST_FALL_VELOCITY = -16;
export const DUCK_TIME = 0.8;
export const SLIDE_LEAN = 0.9;
export const STAND_TOP = 1.7;
export const DUCK_TOP = 1.0;
export const PLAYER_HALF_W = 0.35;
export const PLAYER_HALF_D = 0.35;
// Double-tap (Pulse): two taps that didn't become swipes, this close in time and space
export const DOUBLE_TAP_MS = 320;
export const DOUBLE_TAP_PX = 40;
export const STUMBLE_WINDOW = 4; // second stumble while the Chairman is close = caught
export const BOTTLE_HELD = 0.26; // metres tall in the hand (a touch bigger than life, so it reads)
// Grip in the right hand bone's local space (Mixamo rig, checked by render): fingers curl round
// local X; the bottle sits across the palm, cap up on the thumb side.
export const GRIP_CURL = 1.1; // rad per finger joint
export const GRIP_POS: readonly [number, number, number] = [0, 0.05, 0.02];
export const GRIP_ROT: readonly [number, number, number] = [0, 0, 1.3 - Math.PI];

// Chasers
export const CHASE_CLOSE = 1.0;
export const CHASE_FAR = 10;
export const CHASE_HOLD_S = 3;
export const RUNNER_LOOK_BACK = 0.9; // rad: the runner turns to answer the Chairman in the cinematic

// Okadas drive at you, with a horn first
export const OKADA_EXTRA = 0.55; // extra closing speed as a fraction of yours
export const HORN_LEAD_S = 1.4;

// Coins (yellow caps): one per 16th note of the theme along a trail
export const COIN_POOL = 140;
export const COIN_RADIUS = 0.22;
export const COIN_PICKUP = 0.9;
export const CAP_FLY_SPEED = 30; // m/s minimum for caps pulled to the hand by the Pulse
/** Caps to fill the Pulse meter, by speed stage: it gets harder to charge the further you run. */
export const PULSE_COST: readonly number[] = [50, 70, 90, 110, 130];

// Pulse Mode: release → shockwave, then a ring on every beat while you keep running
export const PULSE_BEATS = 22; // beats of the theme it pulses for (≈ 8 s at 163.5 BPM)
export const PULSE_WINDUP_S = 0.16; // anticipation: the world draws in before the shockwave
export const PULSE_GRACE_S = 0.5; // protection after the last ring
export const PULSE_SHOCK_S = 0.7; // shockwave expansion time
export const PULSE_SHOCK_DIAMETER = 56; // metres across at full size
export const PULSE_CLEAR_AHEAD = 32; // obstacles within this far ahead are blown away on release
export const PULSE_BEAT_CLEAR = 26; // ...and within this far ahead on every beat
export const PULSE_CLEAR_BEHIND = 6;
export const PULSE_MAGNET_AHEAD = 36; // caps within this far ahead fly to you on release
export const SURF_MAGNET_AHEAD = 22; // and while it pulses
export const PULSE_KNOCKBACK = 9; // metres the agberos are blown back

// Camera
export const CAM_HEIGHT = 2.9;
export const CAM_BACK = 5.4;
export const CAM_LOOK_AHEAD = 9;
export const DROP_S = 0.73; // the bottle falling into the runner's hand: two beats of the theme
export const START_S = 1.8; // tap → whistle → camera swing → control

/** Pepsi print on the overhead banner: width, height, centre height, offset towards the runner (m). */
export const BANNER_PRINT: readonly [number, number, number, number] = [2.0, 0.75, 2.3, 0.28];

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
  | 'pole';

export const OBSTACLES = {
  danfo: { prop: 'danfo', action: 'swerve', scale: 5, rotY: 0, halfW: 1.0, length: 5, bottom: 0, top: 2.7, weight: 3 },
  keke: { prop: 'keke', action: 'swerve', scale: 2.8, rotY: Math.PI / 2, halfW: 0.8, length: 2.8, bottom: 0, top: 1.8, weight: 3 },
  okada: { prop: 'okada', action: 'swerve', scale: 2.1, rotY: Math.PI / 2, halfW: 0.6, length: 2.1, bottom: 0, top: 1.3, weight: 2 },
  barrier: { prop: 'barrier-low', action: 'jump', scale: 2.0, rotY: 0, halfW: 1.0, length: 0.6, bottom: 0, top: 0.9, weight: 3 },
  table: { prop: 'vendor-table', action: 'jump', scale: 1.9, rotY: 0, halfW: 0.95, length: 1.1, bottom: 0, top: 1.0, weight: 2 },
  banner: { prop: 'banner', action: 'duck', scale: 2.3, scaleY: 3.6, rotY: 0, halfW: 1.1, length: 0.5, bottom: 1.55, top: 3, weight: 3 },
} as const;
export type ObstacleKind = keyof typeof OBSTACLES;
