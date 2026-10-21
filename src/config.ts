// Every tunable number lives here. Units: world units (bottle ≈ 0.98 tall), seconds unless suffixed.

export const CREDIT_HANDLE = '@VOtakpor';
export const BRAND_HANDLE = '@Pepsi_naija';

// Model
export const MODEL_URL = '/models/pepsi-bottle.glb';
export const DRACO_PATH = '/draco/';
export const BOTTLE_HEIGHT = 0.98;
export const BOTTLE_CENTER_Y = 0.49;
export const BOTTLE_HALF_WIDTH = 0.15;
export const FILL_Y = 0.74; // cola level (model units), just under the shoulder
export const FOAM_TOP_Y = 0.862; // how high a shaken bottle's foam climbs: just under the cap
export const LABEL_RADIUS = 0.1336;

// Camera framing
export const CAMERA_FOV = 32;
export const FRAME_HEIGHT = 1.65; // world units visible vertically at rest
export const FRAME_HEIGHT_WIDE = 1.95; // landscape screens: the title is shorter, so leave it more room
export const FRAME_MIN_WIDTH = 0.8; // never show less than this horizontally
export const LOOK_Y = 0.5; // the bottle sits mid-screen, between the title and PLAY
export const INTRO_DOLLY = 1.4;

// Lights (target intensities once the intro finishes)
export const KEY_INTENSITY = 1.6;
export const RIM_L_INTENSITY = 4;
export const RIM_R_INTENSITY = 3;
export const SILHOUETTE_RIM = 1.2;
export const ENV_INTENSITY = 0.55;

// Intro: drag to spin the bottle
export const SPIN_AUTO = 0.45; // rad/s showroom turn when nobody is touching it
export const SPIN_IDLE_S = 1.6; // after a flick, coast this long before the showroom turn resumes
export const SPIN_MAX = 14; // rad/s cap on a flick
export const TILT_MAX = 0.35; // rad the bottle tips towards/away with a vertical drag
export const ESCAPE_HEIGHT = 3.4; // PLAY: the bottle rockets clear of the top of the frame

// Quality
export const FPS_PROBE_START_S = 0.6;
export const FPS_PROBE_LEN_S = 2;
export const FPS_LOW_THRESHOLD = 45;
/**
 * Shaking the intro bottle: sloshing harder than `min` (surface tilt amplitude, held at its peak
 * and let go at `release`/s) counts as shaking.
 * The first `sloshS` seconds only slosh; then the fizz builds at `build`/s (faster when shaken
 * harder than `full`) and settles at `settle`/s when left alone. Past `warn` the title says
 * DON'T SHAKE ME; with the foam at the cap, `holdS` more seconds of shaking and it blows.
 * About 6 s of steady shaking end to end.
 */
export const SHAKE = { min: 0.1, release: 0.25, full: 0.25, sloshS: 1.8, build: 0.3, settle: 0.1, cool: 0.8, warn: 0.5, holdS: 0.7 } as const;
/** How hard a change in drag spin kicks the cola (a quick back-and-forth drag is a shake). */
export const DRAG_SLOSH = 0.16;
/** Drops of cola shed per second as the bottle lifts off. */
export const DRIP_RATE = 140;
export const PARTICLES = { high: 300, low: 80, drips: 180 } as const;
export const DROPLETS = { high: 36, low: 14 } as const;
