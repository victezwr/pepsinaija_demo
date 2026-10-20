// Every tunable number lives here. Units: world units (bottle ≈ 0.98 tall), seconds unless suffixed.

export const CREDIT_HANDLE = '@VOtakpor';
export const BRAND_HANDLE = '@Pepsi_naija';

// Model
export const MODEL_URL = '/models/pepsi-bottle.glb';
export const DRACO_PATH = '/draco/';
export const BOTTLE_HEIGHT = 0.98;
export const BOTTLE_CENTER_Y = 0.49;
export const BOTTLE_HALF_WIDTH = 0.15;
export const LABEL_RADIUS = 0.1336;

// Camera framing
export const CAMERA_FOV = 32;
export const FRAME_HEIGHT = 2.0; // world units visible vertically at rest
export const FRAME_MIN_WIDTH = 1.0; // never show less than this horizontally
export const LOOK_Y = 0.63;
export const INTRO_DOLLY = 1.4;
export const PEEL_DOLLY = 0.82;

// Lights (target intensities once the intro finishes)
export const KEY_INTENSITY = 1.6;
export const RIM_L_INTENSITY = 4;
export const RIM_R_INTENSITY = 3;
export const SILHOUETTE_RIM = 1.2;
export const ENV_INTENSITY = 0.55;

// Intro
export const INTRO_SHORT_TIMESCALE = 2.6;

// Shake
export const SHAKE_DRAG_GAIN = 0.62; // energy per (min viewport dimension) of back-and-forth drag
export const SHAKE_STROKE_CAP = 0.28; // a one-way stroke stops counting after this fraction of the viewport
export const SHAKE_DECAY_PER_S = 0.16;
export const SHAKE_HOLD_DELAY_MS = 350;
export const SHAKE_HOLD_PER_S = 0.42;
export const SHAKE_MOTION_THRESHOLD = 9; // m/s², Android device motion
export const SHAKE_MOTION_GAIN = 0.0022;
export const SHAKE_KEY_PER_S = 0.45;
export const SHAKE_LINES: ReadonlyArray<[number, string]> = [
  [0.45, 'EASY…'],
  [0.78, "I'M WARNING YOU."],
];

// Stuck-user help (no text hints: the bottle trembles by itself instead)
export const SELF_TREMBLE_S = 12;

// Dodge
export const DODGES_BEFORE_TIRED = 3;
export const DODGE_COOLDOWN_MS = 420;
export const DODGE_PROXIMITY_PX = 60;
export const DODGE_EDGE_MARGIN = 0.28;
export const DODGE_LINES = ['', 'TOO SLOW.', 'NOPE.'];
export const ESCAPE_HEIGHT = 3.4; // clear of the top of the frame

// Peel
export const PEEL_COMMIT = 0.6;
export const PEEL_DRAG_SPAN = 0.45; // fraction of min viewport dimension for a full peel
export const PEEL_TURN_Y = 0.7; // rad, turns the seam into view
export const PEEL_CURL_START = 2;
export const PEEL_CURL_END = 12;

// Quality
export const FPS_PROBE_START_S = 0.6;
export const FPS_PROBE_LEN_S = 2;
export const FPS_LOW_THRESHOLD = 45;
export const PARTICLES = { high: 300, low: 80 } as const;
export const DROPLETS = { high: 14, low: 0 } as const;
