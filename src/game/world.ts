import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as music from '../audio/music';
import * as score from '../audio/score';
import * as sfx from '../audio/sfx';
import * as voices from '../audio/voices';
import { track } from '../analytics/track';
import { dressAgbero, type Outfit } from './outfit';
import { writePref } from '../util/storage';
import type { CharacterAsset, GameAssets } from './assets';
import * as G from './gameConfig';
import { gameDom, useGame, type GamePhase, type PulseState, type Runner } from './gameStore';
import { PulseFX } from './pulse';
import { bannerPrint, billboardFaces, makeBillboard } from './billboards';

export type GameInput = 'left' | 'right' | 'up' | 'down' | 'boost';

const laneX = (lane: number): number => lane * G.LANE_WIDTH;
const smooth = (t: number): number => t * t * (3 - 2 * t);
const lerp = THREE.MathUtils.lerp;
const setPhase = (phase: GamePhase): void => useGame.setState({ phase });
const AXIS_X = new THREE.Vector3(1, 0, 0);
const CYAN = new THREE.Color(0x7fe6ff);
// Static layouts (module-level so nothing is allocated per frame)
const CHASE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1.35, 0.2],
  [1.3, 0.7],
  [0.75, 2.2],
];
const TROPHY_SPOTS: ReadonlyArray<readonly [number, number, number]> = [
  [0.95, -0.7, -0.35],
  [-1.2, 0.4, 0.3],
  [0.3, 1.4, 0],
];
const MENU_SPOTS: ReadonlyArray<readonly [number, number, number]> = [
  [1.2, 4.0, -0.25],
  [2.6, 5.2, -0.45],
  [-0.4, 5.8, -0.1],
];
const isLive = (p: GamePhase): boolean => p === 'running' || p === 'starting';
const MENU_CAM: readonly [number, number, number] = [1.35, 1.5, -3.5];
const MENU_LOOK: readonly [number, number, number] = [0.2, 1.15, 1.5];
/** Motor-park cinematic camera: [time, position, look-at], eased between keys. */
const CINE_SHOTS: ReadonlyArray<readonly [number, readonly [number, number, number], readonly [number, number, number]]> = [
  [0, [3.2, 4.4, -9.5], [0.4, 1.4, 2]], // wide: the motor park
  [1.5, MENU_CAM, MENU_LOOK], // the runner, the crew behind
  [3.7, MENU_CAM, MENU_LOOK],
  [4.6, [0.5, 1.9, 0.9], [1.2, 1.95, 4]], // push in on the Chairman
  [5.9, [0.5, 1.9, 0.9], [1.2, 1.95, 4]],
  [6.6, [1.0, 1.55, -2.2], [0.05, 1.3, 0.6]], // the runner answers (in shot before the line)
  [8.3, [1.0, 1.55, -2.2], [0.05, 1.3, 0.6]],
  [8.9, MENU_CAM, MENU_LOOK], // back for the swing behind
];
/** Seconds into the motor-park cinematic at which each story beat fires. */
const CINE = { catch: G.DROP_S, react: 1.3, boy: 1.7, chairman: 4.0, runner: 6.7, chase: 8.9 } as const;

/** A skinned character with cross-faded clips. Models face +Z; the chase runs towards -Z. */
class Actor {
  readonly root = new THREE.Group();
  readonly hand: THREE.Object3D | null;
  /** Curl the fingers round whatever is in the right hand (the clips are open-handed). */
  grip = false;
  private readonly fingers: THREE.Object3D[] = [];
  private readonly thumb: THREE.Object3D[] = [];
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  currentName = '';

  constructor(asset: CharacterAsset, height: number) {
    const model = cloneSkinned(asset.scene) as THREE.Group;
    const box = new THREE.Box3().setFromObject(asset.scene);
    model.scale.setScalar(height / Math.max(0.01, box.max.y - box.min.y));
    model.rotation.y = Math.PI;
    this.root.add(model);
    let hand: THREE.Object3D | null = null;
    model.traverse((o) => {
      if (!hand && /RightHand$/.test(o.name)) hand = o;
      if (/RightHand(Index|Middle|Ring|Pinky)[123]$/.test(o.name)) this.fingers.push(o);
      if (/RightHandThumb[23]$/.test(o.name)) this.thumb.push(o);
    });
    this.hand = hand;
    this.mixer = new THREE.AnimationMixer(model);
    for (const [name, clip] of Object.entries(asset.clips)) this.actions.set(name, this.mixer.clipAction(clip));
  }

  play(name: string, opts: { loop?: boolean; fade?: number; speed?: number; pingPong?: boolean } = {}): void {
    const next = this.actions.get(name);
    if (!next) return;
    const { loop = true, fade = 0.15, speed = 1, pingPong = false } = opts;
    next.timeScale = speed;
    if (next === this.current) return;
    next.reset();
    next.setLoop(loop ? (pingPong ? THREE.LoopPingPong : THREE.LoopRepeat) : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    next.enabled = true;
    next.setEffectiveWeight(1);
    if (this.current) next.crossFadeFrom(this.current, fade, false);
    next.play();
    this.current = next;
    this.currentName = name;
  }

  setSpeed(s: number): void {
    if (this.current) this.current.timeScale = s;
  }

  update(dt: number): void {
    this.mixer.update(dt);
    if (this.grip) {
      // Mixamo finger joints bend round their local X axis (checked by render).
      for (const f of this.fingers) f.rotateOnAxis(AXIS_X, G.GRIP_CURL);
      for (const t of this.thumb) t.rotateOnAxis(AXIS_X, G.GRIP_CURL * 0.5);
    }
    this.root.updateMatrixWorld(true);
  }
}

interface Obstacle {
  kind: G.ObstacleKind;
  obj: THREE.Group;
  lane: number;
  z: number;
  active: boolean;
  hit: boolean;
  horned: boolean;
  /** Blown away by the pulse: harmless, flying off the road, then returned to the pool. */
  cleared: boolean;
  clearT: number;
  flingX: number;
  beat: number; // the theme beat its front edge is due to reach the runner on
  passed: boolean; // fully past the runner (near-miss check done)
}

interface Slot {
  variants: THREE.Group[];
  z: number;
}

export class ChaseWorld {
  readonly group = new THREE.Group();
  private readonly runners: Record<Runner, Actor>;
  private runner: Actor;
  private readonly agberos: Actor[] = [];
  private readonly obstacles: Obstacle[] = [];
  private readonly buildings: Slot[] = [];
  private readonly poles: THREE.Group[] = [];
  private readonly buildingSpan: number;
  private readonly poleSpan: number;
  private readonly billboards: THREE.Group[] = [];
  private readonly boardSpan: number;
  private readonly roadTex: THREE.Texture;
  private readonly walkTex: THREE.Texture;
  private readonly parkedDanfo: THREE.Group;
  private readonly bottle: THREE.Group;
  private readonly heroBottle: THREE.Group;
  private bottleHolder: Actor | null = null;
  private readonly bottleGrip = new THREE.Group(); // pivot at the bottle's middle, parented to a hand
  private readonly pulseFx: PulseFX;
  private pulseState: PulseState = 'empty';
  private readonly coinMag = new Uint8Array(G.COIN_POOL); // caps flying to the runner
  private magnetUntil = 0;
  private magnetAhead = 0;
  private pulseBeat = 0; // next beat the Pulse fires a ring on (theme grid)
  private pulseEndBeat = 0;
  private pulseEndsAt = 0; // world time the post-pulse grace ends
  private pulseStartedAt = 0;
  private nextRowBeat = NaN; // the beat the next obstacle row reaches the runner on
  private frameBeat = 0; // beat the world was last stepped to
  private beatGlow = 0;
  private knock = 0; // agbero knock-back, 1 → 0
  private fovKick = 0;
  private readonly hemi: THREE.HemisphereLight;
  private readonly hemiColor = new THREE.Color(0xffe2bd);
  private readonly heldMats: THREE.MeshStandardMaterial[] = [];
  private readonly runnerPos = new THREE.Vector3();
  private pulseCleared = 0; // debug counters
  private pulseCaps = 0;
  private readonly coinMesh: THREE.InstancedMesh;
  private readonly coinX = new Float32Array(G.COIN_POOL);
  private readonly coinY = new Float32Array(G.COIN_POOL);
  private readonly coinZ = new Float32Array(G.COIN_POOL);
  private readonly coinOn = new Uint8Array(G.COIN_POOL);
  private nextCoin = 0;
  private readonly sky: THREE.Texture;
  private readonly fog: THREE.Fog;
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly zero = new THREE.Vector3(0, 0, 0);
  private readonly fwd = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly camFrom = new THREE.Vector3();
  private readonly lookFrom = new THREE.Vector3();

  // Run state
  private time = 0;
  private phaseT = 0;
  private speed = 0;
  private distance = 0;
  private lane = 0;
  private prevLane = 0;
  private px = 0;
  private py = 0;
  private vy = 0;
  private grounded = true;
  private duckT = 0;
  private slideT = 0;
  private lean = 0;
  private lockAnimUntil = 0;
  private lastStumble = -99;
  private chaseGap: number = G.CHASE_CLOSE;
  private chaseCloseUntil = 0;
  private chairmanLunge = 0;
  private camShake = 0;
  private bubbleText = '';
  private bubbleSpeaker: Actor | null = null; // whose head the bubble sits over
  private bubbleName = ''; // shown with the line when the speaker is off-screen
  private bubblePinned = false;
  private readonly saidOnce = new Set<string>(); // one-time lines this run
  private readonly lastSaid: Record<string, number> = {};
  private cineStep = 0; // next motor-park story beat to fire
  private lastLaneChange = -99;
  private jumpQueuedUntil = 0; // a swipe up just before landing still counts
  private liteMats = false;
  private glowFlash = 0; // the catch / game-over flash on the held bottle, 1 → 0
  private glowColor = 0x2a6bff;
  private pulseFireAt = 0; // the shockwave fires after a short wind-up
  private pulseFired = false;
  private bubbleUntil = 0;
  private caps = 0;
  private chill = 0;
  private invulnerableUntil = 0;
  private stage = 0;
  private storeTick = 0;
  private whistled = false;
  /** Test-only (?debug&autopilot): dodges by itself so long runs can be checked headless. */
  autopilot = false;

  constructor(
    assets: GameAssets,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    lowTier: boolean,
  ) {
    this.sky = skyTexture();
    this.fog = new THREE.Fog(0xeaa070, lowTier ? 35 : 45, lowTier ? 95 : 150);
    this.group.visible = false; // built during the story, shown on hand-off

    this.hemi = new THREE.HemisphereLight(0xffe2bd, 0x5b4636, 1.7);
    const sun = new THREE.DirectionalLight(0xffc58f, 2.2);
    sun.position.set(-15, 20, 18);
    this.group.add(this.hemi, sun);
    this.pulseFx = new PulseFX(lowTier);
    this.group.add(this.pulseFx.group);

    // Road + sidewalks (scrolling textures; the geometry never moves)
    this.roadTex = roadTexture();
    this.roadTex.repeat.set(1, 320 / 8);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(G.ROAD_HALF * 2, 320), new THREE.MeshStandardMaterial({ map: this.roadTex, roughness: 0.95 }));
    road.rotation.x = -Math.PI / 2;
    road.position.z = -140;
    this.walkTex = walkTexture();
    this.walkTex.repeat.set(1, 320 / 4);
    for (const side of [-1, 1]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(G.SIDEWALK, 320), new THREE.MeshStandardMaterial({ map: this.walkTex, roughness: 1 }));
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(side * (G.ROAD_HALF + G.SIDEWALK / 2), 0.12, -140);
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 320), new THREE.MeshStandardMaterial({ color: 0xd9d2c4 }));
      curb.position.set(side * (G.ROAD_HALF + 0.12), 0.07, -140);
      this.group.add(walk, curb);
    }
    this.group.add(road);

    // Buildings: shoulder to shoulder, fronts facing the road
    const bScale = 7.5;
    const bWidth = 0.72 * bScale;
    const perSide = lowTier ? 20 : 28; // LITE: a shorter street, hidden by closer fog
    this.buildingSpan = perSide * bWidth;
    for (const side of [-1, 1]) {
      for (let i = 0; i < perSide; i++) {
        const variants = (['building-1', 'building-2', 'building-3'] as const).map((name) => {
          const b = place(assets.props[name], bScale);
          b.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
          b.position.x = side * (G.ROAD_HALF + G.SIDEWALK + 0.38 * bScale);
          b.visible = false;
          this.group.add(b);
          return b;
        });
        variants[Math.floor(Math.random() * 3)].visible = true;
        // Start the row behind the camera too: the menu looks back down the street.
        this.buildings.push({ variants, z: G.DESPAWN_Z + 30 - i * bWidth });
      }
    }
    const poleEvery = 18;
    const polesPerSide = Math.ceil(this.buildingSpan / poleEvery);
    this.poleSpan = polesPerSide * poleEvery;
    for (const side of [-1, 1]) {
      for (let i = 0; i < polesPerSide; i++) {
        const p = place(assets.props.pole, 7.5);
        p.position.set(side * (G.ROAD_HALF + 0.7), 0, G.DESPAWN_Z + 30 - i * poleEvery - (side > 0 ? poleEvery / 2 : 0));
        this.poles.push(p);
        this.group.add(p);
      }
    }

    // Pepsi billboards on the pavement, alternating sides and slogans, angled at the oncoming runner
    const faces = billboardFaces();
    const frame = new THREE.MeshLambertMaterial({ color: 0x23262e });
    const boardsPerSide = 3;
    const boardEvery = this.buildingSpan / boardsPerSide;
    this.boardSpan = boardsPerSide * boardEvery;
    let n = 0;
    for (const side of [-1, 1]) {
      for (let i = 0; i < boardsPerSide; i++) {
        const b = makeBillboard(faces[n++ % faces.length], frame);
        b.position.set(side * (G.ROAD_HALF + G.SIDEWALK * 0.55), 0, -20 - i * boardEvery - (side > 0 ? boardEvery / 2 : 0));
        b.rotation.y = side < 0 ? 0.5 : -0.5;
        this.billboards.push(b);
        this.group.add(b);
      }
    }

    // Motor-park set dressing: a danfo parked beside the runner in the menu
    this.parkedDanfo = place(assets.props.danfo, 5);
    this.parkedDanfo.position.set(-laneX(1), 0, 1.5);
    this.group.add(this.parkedDanfo);

    // Obstacle pools (the overhead banners carry a Pepsi print on the side facing the runner)
    const print = bannerPrint();
    const pool: Record<G.ObstacleKind, number> = { danfo: 4, keke: 4, okada: 4, barrier: 5, table: 4, banner: 4 };
    for (const kind of Object.keys(pool) as G.ObstacleKind[]) {
      const def = G.OBSTACLES[kind];
      for (let i = 0; i < pool[kind]; i++) {
        const obj = place(assets.props[def.prop], def.scale, 'scaleY' in def ? def.scaleY : undefined);
        obj.rotation.y = def.rotY;
        obj.visible = false;
        if (kind === 'banner') {
          const face = new THREE.Mesh(new THREE.PlaneGeometry(G.BANNER_PRINT[0], G.BANNER_PRINT[1]), print);
          face.position.set(0, G.BANNER_PRINT[2], G.BANNER_PRINT[3]);
          obj.add(face);
        }
        this.group.add(obj);
        this.obstacles.push({ kind, obj, lane: 0, z: 0, active: false, hit: false, horned: false, cleared: false, clearT: 0, flingX: 1, beat: 0, passed: true });
      }
    }

    // Coins: one instanced mesh of yellow caps
    const capGeo = new THREE.CylinderGeometry(G.COIN_RADIUS, G.COIN_RADIUS, 0.09, 28).rotateX(Math.PI / 2);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xffc400, metalness: 0.25, roughness: 0.3, emissive: 0x7a4a00, emissiveIntensity: 0.45 });
    this.coinMesh = new THREE.InstancedMesh(capGeo, capMat, G.COIN_POOL);
    this.coinMesh.frustumCulled = false;
    this.coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.coinMesh);

    // The Pepsi: one held in hand, one big hero copy for the game-over shot
    this.bottle = assets.bottle;
    this.bottle.position.y = -0.49; // grip it round the middle of the label
    this.bottleGrip.add(this.bottle);
    this.heroBottle = assets.bottle.clone();
    this.heroBottle.scale.setScalar(0.55 / 0.98);
    this.heroBottle.visible = false;
    // Own opaque material copies: a see-through bottle flickers against the body when sorted.
    for (const b of [this.bottle, this.heroBottle]) {
      b.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshStandardMaterial)) return;
        const m = o.material.clone();
        m.fog = false;
        m.transparent = false;
        m.depthWrite = true;
        m.opacity = 1;
        m.side = THREE.FrontSide;
        o.material = m;
        if (b === this.bottle) this.heldMats.push(m);
      });
    }
    this.group.add(this.bottleGrip, this.heroBottle);

    // Characters
    this.runners = { male: new Actor(assets.male, G.RUNNER_HEIGHT), female: new Actor(assets.female, G.RUNNER_HEIGHT) };
    this.runner = this.runners.male;
    for (const r of Object.values(this.runners)) {
      r.root.visible = false;
      r.root.add(blobShadow(0.55));
      this.group.add(r.root);
    }
    this.runner.root.visible = true;
    // Three different outfits: the Chairman in yellow (he loves that cap), then red and green.
    const outfits: Outfit[] = [
      { singlet: [242, 190, 0] },
      { singlet: [200, 32, 40], shorts: [52, 66, 92] },
      { singlet: [34, 140, 64] },
    ];
    for (let i = 0; i < 3; i++) {
      const a = new Actor(assets.agbero, G.AGBERO_HEIGHT * (i === 0 ? G.CHAIRMAN_SCALE : 0.95 + i * 0.03));
      dressAgbero(a.root, outfits[i]);
      a.root.add(blobShadow(0.6));
      this.agberos.push(a);
      this.group.add(a.root);
    }
    this.toMenuPose();
    if (lowTier) this.useLiteMaterials();
  }

  /**
   * LITE: plain Lambert lighting instead of the physically based materials, for everything but
   * the bottle (it stays shiny). Several times cheaper per pixel on slow phone GPUs. Also called
   * when the chase drops to LITE mid-run (the shaders compile once then).
   */
  useLiteMaterials(): void {
    if (this.liteMats) return;
    this.liteMats = true;
    const keep = new Set<THREE.Object3D>();
    for (const root of [this.bottleGrip, this.heroBottle]) root.traverse((o) => keep.add(o));
    const cache = new Map<THREE.Material, THREE.Material>();
    const conv = (m: THREE.Material): THREE.Material => {
      if (!(m instanceof THREE.MeshStandardMaterial)) return m;
      let l = cache.get(m);
      if (!l) {
        l = new THREE.MeshLambertMaterial({
          map: m.map,
          color: m.color,
          emissive: m.emissive,
          emissiveMap: m.emissiveMap,
          emissiveIntensity: m.emissiveIntensity,
          transparent: m.transparent,
          opacity: m.opacity,
          alphaTest: m.alphaTest,
          side: m.side,
          depthWrite: m.depthWrite,
        });
        cache.set(m, l);
      }
      return l;
    };
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || keep.has(o)) return;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(conv) : conv(mesh.material);
    });
  }

  /** Caps the Pulse meter needs right now (rises with the speed stage). */
  private get pulseCost(): number {
    return G.PULSE_COST[Math.min(this.stage, G.PULSE_COST.length - 1)];
  }

  /** Share of the Pulse still to run (1 → 0), for the HUD's timer bar. */
  private get pulseLeft(): number {
    if (this.pulseState === 'activating') return 1;
    if (this.pulseState !== 'pulsing') return 0;
    return Math.max(0, Math.min(1, (this.pulseEndBeat - this.beatNow()) / G.PULSE_BEATS));
  }

  private get chairman(): Actor {
    return this.agberos[0];
  }

  // ------------------------------------------------------------------ hand-off & menu

  /** Compiles every shader the chase needs while the story is still playing (no hitch at the cut). */
  prewarm(gl: THREE.WebGLRenderer): void {
    const hidden: THREE.Object3D[] = [];
    for (const child of this.scene.children) {
      if (child !== this.group && child.visible) {
        child.visible = false;
        hidden.push(child);
      }
    }
    const pooled: THREE.Object3D[] = [];
    this.group.traverse((o) => {
      if (!o.visible) {
        o.visible = true;
        pooled.push(o);
      }
    });
    const prevFog = this.scene.fog;
    this.group.visible = true;
    this.scene.fog = this.fog;
    void gl.compileAsync(this.scene, this.camera);
    // Upload every texture now too: otherwise each one goes to the GPU the first time its object
    // appears, a ~0.1 s freeze apiece on slow phones, right at the start of the run.
    const seen = new Set<THREE.Texture>();
    this.group.traverse((o) => {
      const mats = (o as THREE.Mesh).material;
      if (!mats) return;
      for (const m of Array.isArray(mats) ? mats : [mats]) {
        for (const v of Object.values(m)) if (v instanceof THREE.Texture && !seen.has(v)) seen.add(v);
        if (m instanceof THREE.ShaderMaterial) {
          for (const u of Object.values(m.uniforms)) if (u.value instanceof THREE.Texture) seen.add(u.value);
        }
      }
    });
    for (const t of seen) gl.initTexture(t);
    this.scene.fog = prevFog;
    this.group.visible = false;
    pooled.forEach((o) => {
      o.visible = false;
    });
    hidden.forEach((o) => {
      o.visible = true;
    });
  }

  /**
   * Cinematic beats D–E: the bottle that rocketed off-screen falls into the runner's hand at the
   * motor park, the crew clocks the Golden Cap, words are exchanged, and the chase starts.
   */
  activate(): void {
    this.scene.background = this.sky;
    this.scene.fog = this.fog;
    this.scene.environmentIntensity = 0.35;
    this.group.visible = true;
    this.phaseT = 0;
    this.cineStep = 0;
    this.chooseRunner(useGame.getState().runner);
    this.toMenuPose();
    this.releaseBottle();
    voices.preloadVoices();
    score.startGroove(0.9); // the drums come back in under the motor park
    setPhase('reveal');
  }

  /**
   * SKIP: straight into a correctly configured run (bottle in hand, theme playing, camera behind,
   * controls live). Safe to call more than once and from any point of the cinematic.
   */
  skipCinematic(): void {
    if (useGame.getState().phase !== 'reveal') return;
    this.cineStep = 99;
    score.stopGroove(0.1);
    if (!music.themePlaying()) void music.startTheme();
    this.holdBottle(this.runner);
    this.resetRun();
    this.runner.root.rotation.set(0, 0, 0);
    this.whistled = true;
    this.runner.play('run', { fade: 0.1 });
    for (const a of this.agberos) a.play('run', { fade: 0.1 });
    this.beginRunning();
    track('cinematic_skipped');
  }

  chooseRunner(r: Runner): void {
    if (this.runner === this.runners[r] && this.runner.root.visible) return;
    for (const a of Object.values(this.runners)) a.root.visible = false;
    this.runner = this.runners[r];
    this.runner.root.visible = true;
    this.runner.root.position.set(0, 0, 0);
    this.runner.play('idle', { speed: 0 });
    if (this.bottleHolder && this.bottleHolder !== this.chairman) this.holdBottle(this.runner);
    useGame.setState({ runner: r });
  }

  private toMenuPose(): void {
    this.runner.play('idle', { speed: 0 }); // one held frame: a looping sliver of clip twitched the hand
    this.chairman.play('idle');
    this.agberos[1].play('idle');
    this.agberos[2].play('idle');
    this.layoutMenuAgberos();
  }

  private layoutMenuAgberos(): void {
    // Behind the runner (towards +z), muttering and staring at the yellow cap
    this.agberos.forEach((a, i) => {
      const [x, z, yaw] = MENU_SPOTS[i];
      a.root.position.set(x, 0, z);
      a.root.rotation.y = yaw;
    });
  }

  /** Cinematic beat E: the Chairman's order, the whistle, the theme erupts, the camera swings behind. */
  private beginChase(): void {
    this.resetRun();
    this.whistled = true;
    this.phaseT = 0;
    this.runner.play('run', { fade: 0.2 });
    for (const a of this.agberos.slice(1)) a.play('run');
    setPhase('starting');
    track('game_start', { runner: useGame.getState().runner });
  }

  /** RUN AGAIN from the game-over screen: straight back into the chase. */
  runAgain(): void {
    this.resetRun();
    this.parkedDanfo.visible = false;
    this.whistled = false;
    this.phaseT = 0.5; // skip the cap-open beat
    setPhase('starting');
    track('game_start', { runner: useGame.getState().runner, again: 1 });
  }

  private resetRun(): void {
    for (const o of this.obstacles) {
      o.active = false;
      o.obj.visible = false;
    }
    this.coinOn.fill(0);
    this.coinMag.fill(0);
    this.resetPulse();
    this.speed = 0;
    this.distance = 0;
    this.nextRowBeat = NaN;
    this.lane = this.prevLane = 0;
    this.px = this.py = this.vy = 0;
    this.grounded = true;
    this.duckT = this.slideT = this.lean = 0;
    this.lockAnimUntil = 0;
    this.lastStumble = -99;
    this.chaseGap = 4.5;
    this.chairmanLunge = 0;
    this.bubbleUntil = 0;
    this.saidOnce.clear();
    this.glowFlash = 0;
    this.caps = this.chill = 0;
    this.invulnerableUntil = 0;
    this.stage = 0;
    this.heroBottle.visible = false;
    this.holdBottle(this.runner);
    this.runner.root.rotation.set(0, 0, 0);
    this.runner.root.visible = true;
    this.agberos.forEach((a) => {
      a.root.rotation.y = 0;
    });
    useGame.setState({ caps: 0, distance: 0, stage: 0, chill: 0, pulseCost: G.PULSE_COST[0], banner: null });
  }

  input(action: GameInput): void {
    const phase = useGame.getState().phase;
    if (phase !== 'running' && phase !== 'starting') return;
    switch (action) {
      case 'left':
      case 'right': {
        const next = Math.max(-1, Math.min(1, this.lane + (action === 'left' ? -1 : 1)));
        if (next === this.lane) return;
        this.prevLane = this.lane;
        this.lane = next;
        this.lastLaneChange = this.time;
        sfx.swoosh(action === 'left' ? -1 : 1);
        break;
      }
      case 'up':
        if (!this.grounded) {
          this.jumpQueuedUntil = this.time + G.JUMP_BUFFER_S; // jump the moment you land
          return;
        }
        this.vy = G.JUMP_VELOCITY;
        this.grounded = false;
        this.duckT = this.slideT = 0;
        this.runner.play('jump', { loop: false, speed: 1.35, fade: 0.08 });
        this.lockAnimUntil = this.time + 0.7;
        sfx.jump();
        break;
      case 'down':
        if (!this.grounded) this.vy = G.FAST_FALL_VELOCITY;
        this.duckT = this.slideT = G.DUCK_TIME;
        this.runner.play('duck', { fade: 0.06 });
        this.lockAnimUntil = this.time + G.DUCK_TIME;
        if (this.grounded) sfx.slide();
        break;
      case 'boost':
        this.activatePulse();
        break;
      default: {
        const never: never = action;
        return never;
      }
    }
  }

  // ------------------------------------------------------------------ Pulse Mode

  private setPulse(state: PulseState): void {
    this.pulseState = state;
    useGame.setState({ pulse: state });
  }

  /**
   * Double-tap / B: the shockwave fires now, then the runner keeps running and pulses on
   * every beat of the theme for PULSE_BEATS beats, clearing the road ahead. Charge is spent once.
   */
  private activatePulse(): void {
    if (this.pulseState !== 'charged' || useGame.getState().phase !== 'running') return;
    // Protected from here; the shockwave lands after a short wind-up (the anticipation beat)
    this.setPulse('activating');
    this.chill = 0;
    this.pulseStartedAt = this.time;
    this.pulseFireAt = this.time + G.PULSE_WINDUP_S;
    this.pulseFired = false;
    this.chaseCloseUntil = 0;
    this.chairmanLunge = 0;
    this.fovKick = -5; // the world draws in...
    this.setGlow(1.4);
    sfx.pulseWindup();
    useGame.setState({ chill: 0 });
  }

  /** ...and the Golden Cap lets go: shockwave, bubbles, agberos blown back, road cleared. */
  private firePulse(): void {
    this.pulseFired = true;
    this.pulseBeat = Math.ceil(this.beatNow() + 0.3); // the first ring lands on the next beat
    this.pulseEndBeat = this.pulseBeat + G.PULSE_BEATS;
    this.pulseFx.setPad('off');
    this.pulseFx.shockwave(this.time, this.px, 0, G.PULSE_SHOCK_DIAMETER, 3, G.PULSE_SHOCK_S);
    this.pulseFx.burst(this.time, this.runnerPos.set(this.px, this.py, 0));
    this.pulseFx.bubbles(this.time, this.px, this.py + 1, 0);
    this.camShake = 0.3;
    this.fovKick = 9;
    this.pulseCleared += this.clearObstacles(-G.PULSE_CLEAR_AHEAD, G.PULSE_CLEAR_BEHIND);
    this.startMagnet(G.PULSE_MAGNET_AHEAD, this.time + 0.9);
    this.knock = 1;
    this.chaseGap += G.PULSE_KNOCKBACK;
    for (const a of this.agberos) a.play('shout', { fade: 0.08 });
    this.setGlow(0);
    sfx.pulseRelease();
    music.setPulse(true);
    this.flashBanner('RELEASE THE PULSE', 900);
    this.line('pulse', this.chairman, 'CHAIRMAN', 'Ha! Wetin be that?!', { once: true, priority: true, voice: 2 }); // first Pulse of the run only
    useGame.setState({ pulseFlash: useGame.getState().pulseFlash + 1 });
  }

  /** Neutralise obstacles between zMin and zMax (world z; ahead is negative). Returns how many. */
  private clearObstacles(zMin: number, zMax: number): number {
    let n = 0;
    for (const o of this.obstacles) {
      if (!o.active || o.cleared || o.z < zMin || o.z > zMax) continue;
      o.cleared = true;
      o.hit = true; // can never damage the runner again
      o.clearT = 0;
      o.flingX = Math.sign(laneX(o.lane) - this.px) || (Math.random() < 0.5 ? -1 : 1);
      n++;
    }
    return n;
  }

  private startMagnet(ahead: number, until: number): void {
    this.magnetAhead = ahead;
    this.magnetUntil = Math.max(this.magnetUntil, until);
  }

  /** Charged glow on the held bottle (and the breathing ring under the runner). */
  private setGlow(level: number, color = 0x2a6bff): void {
    for (const m of this.heldMats) {
      if (m.emissive.getHex() !== color) m.emissive.setHex(color);
      m.emissiveIntensity = level;
    }
  }

  private resetPulse(): void {
    if (this.pulseState !== 'empty') this.setPulse('empty');
    this.pulseFx.clear();
    this.magnetUntil = 0;
    // Caps still flying to the hand would freeze in mid-air once the run stops: drop them
    for (let i = 0; i < G.COIN_POOL; i++) {
      if (!this.coinMag[i]) continue;
      this.coinMag[i] = 0;
      this.coinOn[i] = 0;
    }
    this.knock = 0;
    this.beatGlow = 0;
    this.fovKick = 0;
    this.setGlow(0);
    this.hemi.intensity = 1.7;
    this.hemi.color.copy(this.hemiColor);
    music.setPulse(false);
  }

  // ------------------------------------------------------------------ frame

  update(dt: number): void {
    const phase = useGame.getState().phase;
    this.time += dt;
    this.phaseT += dt;
    this.frameBeat = this.beatNow();

    if (phase === 'starting' || phase === 'running') {
      const target = phase === 'starting' && this.phaseT < 0.55 ? 0 : G.STAGES[this.stage].speed;
      this.speed += (target - this.speed) * Math.min(1, dt * G.SPEED_EASE_PER_S);
    } else {
      this.speed = Math.max(0, this.speed - this.speed * Math.min(1, dt * 4) - dt * 2);
    }
    const d = this.speed * dt;

    if (phase === 'reveal') this.revealStep();
    else if (phase === 'starting') this.startingStep();

    if (phase === 'running' || phase === 'starting') {
      if (this.autopilot && phase === 'running') this.drive();
      this.movePlayer(dt);
      // Sub-step the world so a fast frame can't carry a thin obstacle straight past the runner.
      this.scrollScenery(d);
      const steps = Math.max(1, Math.ceil(d / G.MAX_STEP));
      for (let i = 0; i < steps && isLive(useGame.getState().phase); i++) {
        this.scrollActors(d / steps);
        if (phase === 'running') {
          this.collide();
          this.collect();
        }
      }
      this.spawnOnBeat();
      if (phase === 'running') this.checkNearMisses();
      this.updateMagnet(dt);
      this.distance += d;
      if (phase === 'running') this.updateStage();
      this.updatePulse(dt);
      this.storeTick -= dt;
      if (this.storeTick <= 0) {
        this.storeTick = 0.1;
        useGame.setState({ distance: Math.floor(this.distance) });
      }
    } else {
      this.scrollScenery(d);
      this.scrollActors(d);
    }
    this.updateCleared(dt);
    if (phase === 'caught') this.caughtStep();

    // Runner transform: slide lean (pivot at the feet)
    const wantLean = this.slideT > 0 && this.grounded ? G.SLIDE_LEAN : 0;
    this.lean += (wantLean - this.lean) * Math.min(1, dt * (wantLean > this.lean ? 22 : 12));
    this.runner.root.rotation.x = this.lean;
    this.runner.root.position.set(this.px, this.py - this.lean * 0.12, 0);
    if (phase === 'reveal') {
      const look = this.phaseT > CINE.runner - 0.3 && this.phaseT < CINE.chase ? G.RUNNER_LOOK_BACK : 0;
      this.runner.root.rotation.y += (look - this.runner.root.rotation.y) * Math.min(1, dt * 5);
    }
    const runRate = Math.min(1.75, Math.max(0.6, this.speed / 12));
    if (this.runner.currentName === 'run') this.runner.setSpeed(runRate);
    this.runner.update(dt);
    this.updateChasers(dt, phase);
    this.updateBottle(phase);
    this.updateCoins();
    this.runnerPos.set(this.px, this.py, 0);
    this.pulseFx.update(this.time, this.runnerPos, this.camera, d);
    if (gameDom.pulseTimer) gameDom.pulseTimer.style.transform = `scaleX(${this.pulseLeft.toFixed(3)})`;
    this.updateCapEnergy(dt, phase);
    this.updateCamera(dt, phase);
    this.updateBubble();
  }

  /** Cinematic beats D–E (motor park), fired once each in order. */
  private revealStep(): void {
    const t = this.phaseT;
    if (this.cineStep === 0 && t >= CINE.catch) {
      this.cineStep++;
      this.holdBottle(this.runner);
      sfx.catchIt();
      sfx.goldGlint();
      this.glowFlash = 1; // the Golden Cap flares as it lands
      this.glowColor = 0xffb300;
      this.pulseFx.shockwave(this.time, this.px, 0, 9, 2, 0.6);
    }
    if (this.cineStep === 1 && t >= CINE.react) {
      this.cineStep++;
      this.agberos[1].play('shout', { fade: 0.1 }); // the boys jump at the flash
      this.agberos[2].play('shout', { fade: 0.1 });
    }
    if (this.cineStep === 2 && t >= CINE.boy) {
      this.cineStep++;
      this.say(this.agberos[2], 'AGBERO', 'Chairman, you see that thing?', 2.1, 1, 0.4);
      this.agberos[1].play('idle', { fade: 0.4 });
      this.agberos[2].play('idle', { fade: 0.4 });
    }
    if (this.cineStep === 3 && t >= CINE.chairman) {
      this.cineStep++;
      this.chairman.play('shout', { fade: 0.15 });
      this.say(this.chairman, 'CHAIRMAN', 'Ha! Golden Cap! Omo, bring that one come!', 2.5, 2, 0.6);
    }
    if (this.cineStep === 4 && t >= CINE.runner) {
      this.cineStep++;
      this.chairman.play('idle', { fade: 0.4 });
      this.say(this.runner, 'YOU', 'Na drink I come buy!', 1.9, 0);
    }
    if (this.cineStep === 5 && t >= CINE.chase) {
      this.cineStep++;
      this.beginChase(); // (resets the run, so the line comes after it)
      this.say(this.chairman, 'CHAIRMAN', 'Oya! No let am escape!', 1.8, 3, 0.7);
      this.chairman.play('shout', { fade: 0.1 });
      sfx.whistle();
      score.stopGroove(0.15);
      score.fanfare(); // the trumpet motif and drums throw into the theme
      void music.startTheme();
    }
  }

  private startingStep(): void {
    if (!this.whistled && this.phaseT > 0.45) {
      this.whistled = true;
      sfx.whistle(); // RUN AGAIN: just the whistle (lines while running: stumbles and the first Pulse only)
      this.chairman.play('shout');
      this.runner.play('run', { fade: 0.2 });
      for (const a of this.agberos.slice(1)) a.play('run');
    }
    if (this.whistled && this.phaseT > 0.9 && this.chairman.currentName !== 'run') this.chairman.play('run');
    if (this.phaseT >= G.START_S) this.beginRunning();
  }

  /** Controls on: the run proper (after the swing, a RUN AGAIN or a SKIP). */
  private beginRunning(): void {
    // On LITE the crew doesn't crowd the camera at the start (three big animated figures filling
    // the bottom of the screen are the heaviest frames on slow phones); stumbles still bring them
    this.chaseCloseUntil = this.liteMats ? 0 : this.time + G.CHASE_HOLD_S;
    music.start(0);
    score.startLayers();
    score.setIntensity(this.stage);
    setPhase('running');
    useGame.setState({ cinematic: false });
  }

  /** Road, sidewalks, buildings, poles: once per frame. */
  private scrollScenery(d: number): void {
    this.roadTex.offset.y = (this.roadTex.offset.y + d / 8) % 1;
    this.walkTex.offset.y = (this.walkTex.offset.y + d / 4) % 1;
    for (const slot of this.buildings) {
      slot.z += d;
      if (slot.z > G.DESPAWN_Z + 36) {
        slot.z -= this.buildingSpan;
        slot.variants.forEach((b) => {
          b.visible = false;
        });
        slot.variants[Math.floor(Math.random() * 3)].visible = true;
      }
      for (const b of slot.variants) b.position.z = slot.z;
    }
    for (const p of this.poles) {
      p.position.z += d;
      if (p.position.z > G.DESPAWN_Z + 34) p.position.z -= this.poleSpan;
    }
    for (const b of this.billboards) {
      b.position.z += d;
      if (b.position.z > G.DESPAWN_Z + 34) b.position.z -= this.boardSpan;
    }
    if (this.parkedDanfo.visible) {
      this.parkedDanfo.position.z += d;
      if (this.parkedDanfo.position.z > G.DESPAWN_Z + 6) this.parkedDanfo.visible = false;
    }
  }

  /** Obstacles, caps and spawning: per collision sub-step. */
  private scrollActors(d: number): void {
    for (const o of this.obstacles) {
      if (!o.active) continue;
      // Okadas ride at you; you hear them before you see them.
      o.z += o.kind === 'okada' ? d * (1 + G.OKADA_EXTRA) : d;
      o.obj.position.z = o.z;
      if (o.kind === 'okada' && !o.horned && o.z > -this.speed * (1 + G.OKADA_EXTRA) * G.HORN_LEAD_S) {
        o.horned = true;
        sfx.horn(o.lane);
      }
      if (o.z - G.OBSTACLES[o.kind].length / 2 > G.DESPAWN_Z) {
        o.active = false;
        o.obj.visible = false;
      }
    }
    for (let i = 0; i < G.COIN_POOL; i++) {
      if (!this.coinOn[i] || this.coinMag[i]) continue; // caps flying to the hand move in runner space
      this.coinZ[i] += d;
      if (this.coinZ[i] > G.DESPAWN_Z) this.coinOn[i] = 0;
    }
  }

  /** Song position in beats (the theme's grid), or the world's own clock at the same tempo. */
  private beatNow(): number {
    return music.beat() ?? this.time / music.BEAT_S;
  }

  /**
   * Rows are placed so they reach the runner exactly on a beat of the theme: each one goes
   * (beats to go) × (beat length) × (stage speed) up the road, every `beats` beats.
   */
  private spawnOnBeat(): void {
    const st = G.STAGES[this.stage];
    // Rows are placed for full speed: wait until the runner is up to it (run start)
    if (Number.isNaN(this.nextRowBeat) && this.speed < st.speed * 0.995) return;
    const b = this.beatNow();
    if (Number.isNaN(this.nextRowBeat) || this.nextRowBeat < b || this.nextRowBeat > b + 64) {
      // Run start (or the clock jumped): first row after the grace, on a bar line
      this.nextRowBeat = Math.ceil((b + G.START_GRACE_BEATS) / 4) * 4;
    }
    for (;;) {
      const dist = (this.nextRowBeat - b) * music.BEAT_S * st.speed;
      if (dist > G.SPAWN_HORIZON) break;
      this.spawnRow(-dist);
      this.nextRowBeat += st.beats;
    }
  }

  private spawnRow(z: number): void {
    const st = G.STAGES[this.stage];
    const lanes = [-1, 0, 1].sort(() => Math.random() - 0.5);
    const count = 1 + Math.floor(Math.random() * st.maxBlocked);
    const kinds: G.ObstacleKind[] = [];
    for (let i = 0; i < count; i++) kinds.push(pickKind());
    // Never a wall: a full row always has something you can jump or duck.
    if (count === 3 && kinds.every((k) => G.OBSTACLES[k].action === 'swerve')) kinds[0] = Math.random() < 0.5 ? 'barrier' : 'banner';
    const swerveLanes = new Set<number>();
    const actionByLane = new Map<number, string>();
    kinds.forEach((kind, i) => {
      const o = this.obstacles.find((x) => !x.active && x.kind === kind);
      if (!o) return;
      const def = G.OBSTACLES[kind];
      o.active = true;
      o.hit = false;
      o.horned = false;
      o.cleared = false;
      o.beat = this.nextRowBeat;
      o.passed = false;
      o.obj.scale.set(1, 1, 1);
      o.obj.rotation.set(0, def.rotY, 0);
      o.lane = lanes[i];
      // Okadas close faster, so they start further out to arrive on the same beat
      o.z = (kind === 'okada' ? z * (1 + G.OKADA_EXTRA) : z) - def.length / 2;
      o.obj.position.set(laneX(o.lane), 0, o.z);
      o.obj.visible = true;
      if (def.action === 'swerve') swerveLanes.add(o.lane);
      actionByLane.set(o.lane, def.action);
    });

    // A trail of caps in a passable lane; arcs over jump obstacles
    const open = [-1, 0, 1].filter((l) => !swerveLanes.has(l));
    if (!open.length) return;
    const cl = open[Math.floor(Math.random() * open.length)];
    const action = actionByLane.get(cl);
    const n = 7 + Math.floor(Math.random() * 4);
    // One cap per 16th note: the pickup chimes fall on the theme's grid
    const sp = st.speed * music.BEAT_S / 4;
    const first = action ? z + Math.round(5.5 / sp) * sp : z - Math.round(4 / sp) * sp;
    for (let i = 0; i < n; i++) {
      const cz = first - i * sp;
      let cy = 0.75;
      if (action === 'jump') cy = 0.75 + 1.25 * Math.sin((Math.PI * i) / (n - 1));
      else if (action === 'duck') cy = 0.55;
      this.addCoin(laneX(cl), cy, cz);
    }
  }

  private addCoin(x: number, y: number, z: number): void {
    const i = this.nextCoin;
    this.nextCoin = (this.nextCoin + 1) % G.COIN_POOL;
    this.coinX[i] = x;
    this.coinY[i] = y;
    this.coinZ[i] = z;
    this.coinOn[i] = 1;
    this.coinMag[i] = 0;
  }

  private movePlayer(dt: number): void {
    this.px += (laneX(this.lane) - this.px) * Math.min(1, dt * G.LANE_SWITCH_RATE);
    if (!this.grounded) {
      this.vy -= G.GRAVITY * dt;
      this.py += this.vy * dt;
      if (this.py <= 0) {
        this.py = 0;
        this.vy = 0;
        this.grounded = true;
        if (this.duckT <= 0) this.lockAnimUntil = 0;
        if (this.time < this.jumpQueuedUntil) {
          this.jumpQueuedUntil = 0;
          this.input('up');
          return;
        }
        if (this.slideT > 0) sfx.slide();
        else sfx.land();
      }
    }
    if (this.duckT > 0) this.duckT -= dt;
    if (this.slideT > 0 && this.grounded) this.slideT -= dt;
    const free = this.time >= this.lockAnimUntil && this.grounded && this.duckT <= 0;
    if (free && this.whistled && this.runner.currentName !== 'run') this.runner.play('run', { fade: 0.12 });
  }

  /** The Pulse on the ground: a ring from the runner's feet on every beat, clearing the road ahead. */
  private updatePulse(dt: number): void {
    this.knock = Math.max(0, this.knock - dt * 1.4);
    this.fovKick = Math.max(0, this.fovKick - dt * 14);
    this.beatGlow = Math.max(0, this.beatGlow - dt * 3);
    this.hemi.intensity = 1.7 + this.beatGlow * 0.6;
    this.hemi.color.copy(this.hemiColor).lerp(CYAN, this.beatGlow * 0.35);
    if (this.pulseState === 'empty' || this.pulseState === 'charged') return;
    if (this.pulseState === 'ending') {
      if (this.time >= this.pulseEndsAt) this.setPulse('empty');
      return;
    }
    if (!this.pulseFired) {
      if (this.time >= this.pulseFireAt) this.firePulse();
      return;
    }
    const b = this.beatNow();
    if (this.pulseBeat < b - 2) this.pulseBeat = Math.ceil(b); // the clock jumped (tab was hidden)
    // Caps keep flying to you while it pulses
    this.startMagnet(G.SURF_MAGNET_AHEAD, this.time + 0.1);
    while (b >= this.pulseBeat && this.pulseBeat < this.pulseEndBeat) {
      if (this.pulseState === 'activating') {
        this.setPulse('pulsing');
        this.pulseFx.setPad('feet');
      }
      this.pulseFx.beat(this.time);
      this.pulseCleared += this.clearObstacles(-G.PULSE_BEAT_CLEAR, G.PULSE_CLEAR_BEHIND);
      this.beatGlow = 1;
      this.fovKick = Math.max(this.fovKick, 2.5);
      this.pulseBeat++;
    }
    const overdue = this.time - this.pulseStartedAt > (G.PULSE_BEATS + 4) * music.BEAT_S;
    if (this.pulseBeat >= this.pulseEndBeat || overdue) {
      this.setPulse('ending');
      this.pulseEndsAt = this.time + G.PULSE_GRACE_S;
      this.pulseFx.setPad('off');
      music.setPulse(false);
      sfx.pulseEnd();
    }
  }

  /** Blown-away obstacles: flung off the road, spinning and shrinking, then back to the pool. */
  private updateCleared(dt: number): void {
    for (const o of this.obstacles) {
      if (!o.active || !o.cleared) continue;
      o.clearT += dt;
      const t = o.clearT / 0.6;
      if (t >= 1) {
        o.active = false;
        o.obj.visible = false;
        continue;
      }
      o.obj.position.x = laneX(o.lane) + o.flingX * o.clearT * 10;
      o.obj.position.y = o.clearT * 7 - 12 * o.clearT * o.clearT;
      o.obj.rotation.z = o.flingX * t * 1.8;
      o.obj.scale.setScalar(1 - t * t);
    }
  }

  /** Caps flying into the runner's hand (pulse release and during the surf). */
  private updateMagnet(dt: number): void {
    const on = this.time < this.magnetUntil;
    const tx = this.px;
    const ty = this.py + 1.1;
    let got = 0;
    for (let i = 0; i < G.COIN_POOL; i++) {
      if (!this.coinOn[i]) continue;
      if (!this.coinMag[i]) {
        // Only caps still ahead of you (a cap already behind you is gone)
        if (!on || this.coinZ[i] > 0.3 || this.coinZ[i] < -this.magnetAhead) continue;
        this.coinMag[i] = 1;
      }
      // Fly to the hand: eased, but never slower than CAP_FLY_SPEED, so it always arrives
      const dx = tx - this.coinX[i];
      const dy = ty - this.coinY[i];
      const dz = -this.coinZ[i];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const step = Math.max(dist * Math.min(1, dt * 9), G.CAP_FLY_SPEED * dt);
      if (step >= dist || dist < 0.5) {
        this.coinOn[i] = 0;
        this.coinMag[i] = 0;
        got++;
        continue;
      }
      const k = step / dist;
      this.coinX[i] += dx * k;
      this.coinY[i] += dy * k;
      this.coinZ[i] += dz * k;
    }
    if (got) {
      this.pulseCaps += got;
      this.award(got);
    }
  }

  private collide(): void {
    // Pulse protection is real: no stumbles or catches until safely back on the road.
    if (this.pulseState === 'activating' || this.pulseState === 'pulsing' || this.pulseState === 'ending') return;
    if (this.time < this.invulnerableUntil) return;
    const top = this.py + (this.duckT > 0 && this.grounded ? G.DUCK_TOP : G.STAND_TOP);
    for (const o of this.obstacles) {
      if (!o.active || o.hit || o.cleared) continue;
      const def = G.OBSTACLES[o.kind];
      if (Math.abs(o.z) > def.length / 2 + G.PLAYER_HALF_D) continue;
      const dx = Math.abs(this.px - laneX(o.lane));
      if (dx > def.halfW + G.PLAYER_HALF_W) continue;
      if (top <= def.bottom || this.py >= def.top) continue;
      o.hit = true;
      // Grazing the side = stumble; running into the front = caught.
      if (dx > def.halfW * 0.55) this.stumble();
      else this.caught();
      return;
    }
  }

  private stumble(): void {
    if (this.time - this.lastStumble < G.STUMBLE_WINDOW) {
      this.caught();
      return;
    }
    this.lastStumble = this.time;
    this.lane = this.prevLane;
    this.runner.play('stumble', { loop: false, speed: 1.7, fade: 0.06 });
    this.lockAnimUntil = this.time + 1;
    this.chaseCloseUntil = this.time + G.CHASE_HOLD_S;
    this.chairmanLunge = 1; // the Chairman surges right up behind you
    this.camShake = 0.25;
    sfx.crash(false);
    this.say(this.chairman, 'CHAIRMAN', 'Oya drop am!', 1.8, 1, 0.6);
  }

  private caught(): void {
    this.phaseT = 0;
    this.resetPulse();
    // Keep the trophy shot clear: the camera ends up a few metres ahead of the runner, so caps
    // and traffic around there (even the danfo that caught you) are swept off the set
    for (let i = 0; i < G.COIN_POOL; i++) if (this.coinOn[i] && this.coinZ[i] > -7) this.coinOn[i] = 0;
    for (const o of this.obstacles) {
      if (!o.active || o.z < -12 || o.z > 8) continue;
      o.active = false;
      o.obj.visible = false;
    }
    this.slideT = this.duckT = 0;
    this.runner.play('fall', { loop: false, speed: 1.3, fade: 0.06 });
    this.camShake = 0.45;
    sfx.crash(true);
    this.say(this.agberos[1], 'AGBEROS', 'We don catch am!', 2.6, 3, 0.7);
    music.stop(0.4);
    score.stopLayers();
    score.gameOverSting();
    const dist = Math.floor(this.distance);
    const best = Math.max(useGame.getState().best, dist);
    writePref('bestDistance', String(best));
    useGame.setState({ best, distance: dist, banner: null });
    // Remember where the camera is, to swing round to the trophy shot from here
    this.camFrom.copy(this.camera.position);
    this.camera.getWorldDirection(this.fwd);
    this.lookFrom.copy(this.camera.position).addScaledVector(this.fwd, 9);
    setPhase('caught');
    track('game_caught', { distance: dist, caps: this.caps });
  }

  private caughtStep(): void {
    // The Chairman takes the bottle and lifts it like a trophy; the boys celebrate...
    if (this.phaseT > 0.8 && this.bottleHolder !== this.chairman) {
      this.holdBottle(this.chairman);
      for (const a of this.agberos) a.play('shout');
      this.cineStep = 0;
    }
    // ...then the Golden Cap answers back: a spark and a rattle, and the Chairman isn't so sure
    if (this.cineStep === 0 && this.phaseT > 2.4) {
      this.cineStep = 1;
      this.glowFlash = 1;
      this.glowColor = 0x2a6bff;
      this.handPos(this.chairman, this.v);
      this.pulseFx.burst(this.time, this.v);
      this.pulseFx.bubbles(this.time, this.v.x, this.v.y, this.v.z);
      this.pulseFx.shockwave(this.time, this.chairman.root.position.x, this.chairman.root.position.z, 5, 1, 0.5);
      sfx.capRattle();
      this.chairman.play('idle', { fade: 0.2 });
    }
    if (this.cineStep === 1 && this.phaseT > 2.9) {
      this.cineStep = 2;
      this.say(this.chairman, 'CHAIRMAN', 'Ehn? Wetin dey inside this cap sef?', 2.6, 1, 0.35);
    }
    this.heroBottle.visible = this.phaseT > 1.2;
  }

  private updateStage(): void {
    let s = 0;
    for (let i = 0; i < G.STAGES.length; i++) if (this.distance >= G.STAGES[i].dist) s = i;
    if (s === this.stage) return;
    this.stage = s;
    useGame.setState({ stage: s });
    this.flashBanner('SPEED UP!', 1300);
    sfx.whoosh(0.6, 0.4);
    music.setStage(s);
    score.setIntensity(s); // the music (and, from 1,200 m, the cap's glow) carry the milestones
    if (this.pulseState === 'empty') useGame.setState({ chill: this.chill / this.pulseCost, pulseCost: this.pulseCost });
  }

  private collect(): void {
    const top = this.py + G.STAND_TOP;
    let got = 0;
    for (let i = 0; i < G.COIN_POOL; i++) {
      if (!this.coinOn[i]) continue;
      if (Math.abs(this.coinZ[i]) > G.COIN_PICKUP) continue;
      if (Math.abs(this.coinX[i] - this.px) > 0.9) continue;
      if (this.coinMag[i]) continue; // flying to the hand: counted by updateMagnet
      if (this.coinY[i] < this.py - 0.3 || this.coinY[i] > top + 0.2) continue;
      this.coinOn[i] = 0;
      got++;
    }
    if (got) this.award(got);
  }

  /** Count caps once, fill the Pulse meter (only while it is charging). */
  private award(got: number): void {
    this.caps += got;
    if (this.pulseState === 'empty') {
      this.chill = Math.min(this.pulseCost, this.chill + got);
      if (this.chill >= this.pulseCost) {
        this.setPulse('charged');
        this.pulseFx.setPad('ground');
        sfx.pulseCharge();
      }
    }
    sfx.coin();
    useGame.setState({ caps: this.caps, chill: this.chill / this.pulseCost, pulseCost: this.pulseCost });
  }

  private flashBanner(text: string, ms: number): void {
    useGame.setState({ banner: text });
    window.setTimeout(() => {
      if (useGame.getState().banner === text) useGame.setState({ banner: null });
    }, ms);
  }

  private updateChasers(dt: number, phase: GamePhase): void {
    if (phase === 'reveal' || phase === 'loading') {
      this.layoutMenuAgberos();
    } else if (phase === 'caught') {
      // Surround the runner, facing the camera for the trophy shot
      this.agberos.forEach((a, i) => {
        a.root.rotation.x = 0;
        const [x, z, yaw] = TROPHY_SPOTS[i];
        a.root.position.lerp(this.v.set(this.px + x, 0, z), Math.min(1, dt * 4));
        a.root.rotation.y += (yaw - a.root.rotation.y) * Math.min(1, dt * 5);
      });
    } else {
      const pulsing = this.pulseState === 'activating' || this.pulseState === 'pulsing';
      const want = pulsing ? G.CHASE_FAR + 4 : this.time < this.chaseCloseUntil ? G.CHASE_CLOSE : G.CHASE_FAR;
      const rate = phase === 'starting' ? 1.2 : want > this.chaseGap ? 0.6 : 2;
      this.chaseGap += (want - this.chaseGap) * Math.min(1, dt * rate);
      this.chairmanLunge = Math.max(0, this.chairmanLunge - dt * 0.6);
      this.agberos.forEach((a, i) => {
        let [ox, oz] = CHASE_OFFSETS[i];
        if (i === 0 && this.chairmanLunge > 0) {
          // Right on your heels, reaching for the Pepsi
          ox = lerp(ox, 0.35, this.chairmanLunge);
          oz = lerp(oz, -0.4, this.chairmanLunge);
        }
        a.root.position.lerp(this.v.set(this.px * 0.85 + ox, 0, this.chaseGap + oz), Math.min(1, dt * 6));
        a.root.rotation.y += (0 - a.root.rotation.y) * Math.min(1, dt * 6);
        a.root.rotation.x = -0.6 * this.knock; // blown back by the pulse
        if (this.knock < 0.35 && a.currentName === 'shout' && phase === 'running') a.play('run', { fade: 0.25 });
        if (phase === 'running') a.setSpeed(Math.max(0.7, this.speed / 11));
      });
    }
    for (const a of this.agberos) a.update(dt);
  }

  /** Put the bottle in an actor's right hand: parented to the hand bone, fingers curled round it. */
  private holdBottle(actor: Actor): void {
    for (const a of [...Object.values(this.runners), ...this.agberos]) a.grip = false;
    this.bottleHolder = actor;
    if (!actor.hand) return;
    actor.grip = true;
    actor.hand.add(this.bottleGrip);
    actor.hand.getWorldScale(this.s);
    this.bottleGrip.scale.setScalar(G.BOTTLE_HELD / 0.98 / this.s.x);
    this.bottleGrip.position.set(G.GRIP_POS[0], G.GRIP_POS[1], G.GRIP_POS[2]); // hand-local (model) units
    this.bottleGrip.rotation.set(G.GRIP_ROT[0], G.GRIP_ROT[1], G.GRIP_ROT[2]);
  }

  /** Back into world space (the drop from the sky before the catch). */
  private releaseBottle(): void {
    for (const a of [...Object.values(this.runners), ...this.agberos]) a.grip = false;
    this.bottleHolder = null;
    this.group.add(this.bottleGrip);
    this.bottleGrip.scale.setScalar(G.BOTTLE_HELD / 0.98);
    this.bottleGrip.rotation.set(0, 0, 0);
  }

  private updateBottle(phase: GamePhase): void {
    if (phase === 'reveal' && !this.bottleHolder) {
      // Falling from where the story's bottle left the frame, spinning, into the runner's hand
      const t = Math.min(1, this.phaseT / G.DROP_S);
      this.handPos(this.runner, this.v);
      this.bottleGrip.position.set(this.v.x, lerp(this.v.y + 7, this.v.y, t * t), this.v.z);
      this.bottleGrip.rotation.set(0, this.time * 6, 0);
    }
  }

  private handPos(actor: Actor, out: THREE.Vector3): THREE.Vector3 {
    if (actor.hand) return actor.hand.getWorldPosition(out);
    return out.set(actor.root.position.x + 0.3, actor.root.position.y + 1.0, actor.root.position.z - 0.2);
  }

  private updateCoins(): void {
    const spin = this.time * 3;
    for (let i = 0; i < G.COIN_POOL; i++) {
      if (this.coinOn[i]) {
        this.v.set(this.coinX[i], this.coinY[i], this.coinZ[i]);
        this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, spin + i * 0.3);
        this.s.set(1, 1, 1);
        this.m4.compose(this.v, this.q, this.s);
      } else {
        this.m4.compose(this.zero, this.q.identity(), this.s.set(0, 0, 0));
      }
      this.coinMesh.setMatrixAt(i, this.m4);
    }
    this.coinMesh.instanceMatrix.needsUpdate = true;
  }

  private updateCamera(dt: number, phase: GamePhase): void {
    const cam = this.camera;
    const boost = phase === 'running' ? Math.max(0, this.speed - G.STAGES[0].speed) * 0.45 + (this.pulseState === 'pulsing' ? 3 : 0) : 0;
    const fov = (cam.aspect < 0.8 ? 70 : 55) + boost + this.fovKick;
    if (Math.abs(cam.fov - fov) > 0.2) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 4);
      cam.updateProjectionMatrix();
    }
    this.camShake *= Math.pow(0.02, dt);
    const sx = (Math.random() - 0.5) * this.camShake;
    const sy = (Math.random() - 0.5) * this.camShake;
    const chasePos = this.v.set(this.px * 0.5 + sx, G.CAM_HEIGHT + this.py * 0.45 + sy, G.CAM_BACK);
    const chaseLook = this.look.set(this.px * 0.5, 1.2, -G.CAM_LOOK_AHEAD);
    // The motor park: in front of the runner, looking back at them and the agberos behind
    const menuPos = this.s.set(MENU_CAM[0], MENU_CAM[1], MENU_CAM[2]);
    const menuLook = { x: MENU_LOOK[0], y: MENU_LOOK[1], z: MENU_LOOK[2] };

    if (phase === 'reveal' || phase === 'loading') {
      this.cineCamera(phase === 'reveal' ? this.phaseT : 99);
      return;
    }
    if (phase === 'starting') {
      // Swing round the runner's right side to settle behind them
      const t = smooth(Math.min(1, Math.max(0, (this.phaseT - 0.35) / (G.START_S - 0.35))));
      const a0 = Math.atan2(menuPos.x, menuPos.z);
      const a = lerp(a0, 0, t);
      const r = lerp(Math.hypot(menuPos.x, menuPos.z), G.CAM_BACK, t);
      cam.position.set(Math.sin(a) * r + chasePos.x * t, lerp(menuPos.y, chasePos.y, t), Math.cos(a) * r);
      cam.lookAt(lerp(menuLook.x, chaseLook.x, t), lerp(menuLook.y, chaseLook.y, t), lerp(menuLook.z, chaseLook.z, t));
      return;
    }
    if (phase === 'caught') {
      // Swing to the front-left for the trophy shot
      const t = smooth(Math.min(1, this.phaseT / 1.3));
      // Swing to the roomier side so the camera never ends up inside a roadside pole
      const camX = this.px + (this.px < 0 ? 1.8 : -1.8);
      cam.position.set(lerp(this.camFrom.x, camX, t), lerp(this.camFrom.y, 2.0, t), lerp(this.camFrom.z, -4.6, t));
      cam.lookAt(lerp(this.lookFrom.x, this.px + 0.2, t), lerp(this.lookFrom.y, 1.25, t), lerp(this.lookFrom.z, 0.2, t));
      // The hero bottle hangs top-right of the frame, spinning
      cam.updateMatrixWorld();
      cam.getWorldDirection(this.fwd);
      this.right.crossVectors(this.fwd, cam.up).normalize();
      const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * 2.4;
      this.heroBottle.position
        .copy(cam.position)
        .addScaledVector(this.fwd, 2.4)
        .addScaledVector(this.right, halfH * cam.aspect * 0.5)
        .addScaledVector(cam.up, halfH * 0.18);
      this.heroBottle.rotation.set(0, this.time * 1.6, 0.12);
      return;
    }
    cam.position.copy(chasePos);
    cam.lookAt(chaseLook);
  }

  /** One line of dialogue: a bubble over the speaker's head and (voice > 0) a shout. */
  private say(who: Actor, name: string, text: string, secs: number, voice = 1, loud = 0.5): void {
    this.bubbleText = text;
    this.bubbleSpeaker = who;
    this.bubbleName = name;
    this.bubbleUntil = this.time + secs;
    if (voice > 0) voices.shout(voice, loud);
  }

  /**
   * An event line: `once` per run, or not again within `cooldown` seconds, and never over another
   * line unless `priority`. Returns whether it was said.
   */
  private line(
    key: string,
    who: Actor,
    name: string,
    text: string,
    o: { once?: boolean; cooldown?: number; priority?: boolean; voice?: number; loud?: number },
  ): boolean {
    if (o.once && this.saidOnce.has(key)) return false;
    if (o.cooldown && this.time - (this.lastSaid[key] ?? -99) < o.cooldown) return false;
    if (!o.priority && this.time < this.bubbleUntil) return false;
    this.saidOnce.add(key);
    this.lastSaid[key] = this.time;
    this.say(who, name, text, Math.max(1.6, text.length * 0.06), o.voice ?? 1, o.loud ?? 0.5);
    return true;
  }

  /** Obstacles that just went past without touching you: dodged late or jumped/slid close. */
  private checkNearMisses(): void {
    for (const o of this.obstacles) {
      if (!o.active || o.passed) continue;
      const def = G.OBSTACLES[o.kind];
      if (o.z - def.length / 2 < G.PLAYER_HALF_D) continue;
      o.passed = true;
      if (o.hit || o.cleared || this.pulseState !== 'empty' && this.pulseState !== 'charged') continue;
      const sameLane = o.lane === this.lane; // jumped or slid it
      const lateSwerve = Math.abs(o.lane - this.lane) === 1 && this.time - this.lastLaneChange < 0.6 && def.action === 'swerve';
      if (!sameLane && !lateSwerve) continue;
      sfx.nearMiss(o.lane < this.lane ? -1 : 1);
    }
  }

  /**
   * The held bottle's glow: breathing when the Pulse is ready, a flare on the catch / game-over
   * spark, and from 1,200 m the Golden Cap's energy pulsing on the beat (stronger each stage).
   */
  private updateCapEnergy(dt: number, phase: GamePhase): void {
    this.glowFlash = Math.max(0, this.glowFlash - dt * 1.1);
    if (this.glowFlash > 0) {
      this.setGlow(this.glowFlash * 2.2, this.glowColor);
      return;
    }
    if (this.pulseState === 'charged') {
      this.setGlow(0.35 + 0.3 * Math.sin(this.time * 6));
      return;
    }
    if (this.pulseState === 'activating') return; // wind-up glow set on activation
    if (phase === 'running' && this.stage >= 2 && this.pulseState === 'empty') {
      const b = this.beatNow();
      const onBeat = 1 - (b - Math.floor(b)); // 1 on the beat, fading through it
      this.setGlow((this.stage >= 4 ? 0.4 : this.stage >= 3 ? 0.28 : 0.18) * onBeat * onBeat);
      return;
    }
    this.setGlow(0);
  }

  /** Cinematic camera: eased between the CINE_SHOTS keys. */
  private cineCamera(t: number): void {
    let i = 0;
    while (i < CINE_SHOTS.length - 1 && CINE_SHOTS[i + 1][0] <= t) i++;
    const [t0, p0, l0] = CINE_SHOTS[i];
    const [t1, p1, l1] = CINE_SHOTS[Math.min(i + 1, CINE_SHOTS.length - 1)];
    const k = t1 > t0 ? smooth(Math.min(1, Math.max(0, (t - t0) / (t1 - t0)))) : 1;
    this.camera.position.set(lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k), lerp(p0[2], p1[2], k));
    this.camera.lookAt(lerp(l0[0], l1[0], k), lerp(l0[1], l1[1], k), lerp(l0[2], l1[2], k));
  }

  private updateBubble(): void {
    const el = gameDom.bubble;
    if (!el) return;
    const who = this.bubbleSpeaker;
    if (this.time >= this.bubbleUntil || !who) {
      el.style.opacity = '0';
      return;
    }
    const head = who === this.runner ? G.RUNNER_HEIGHT : who === this.chairman ? G.AGBERO_HEIGHT * G.CHAIRMAN_SCALE : G.AGBERO_HEIGHT;
    const a = who.root.position;
    this.v.set(a.x, a.y + head + 0.45, a.z).project(this.camera);
    // Off-screen speaker (an agbero behind the camera): the line is pinned low, with their name
    const pinned = this.v.z > 1 || Math.abs(this.v.x) > 1.05 || this.v.y > 1.05 || this.v.y < -1;
    const text = pinned ? `${this.bubbleName}: ${this.bubbleText}` : this.bubbleText;
    if (el.textContent !== text) el.textContent = text;
    if (pinned !== this.bubblePinned) {
      this.bubblePinned = pinned;
      el.classList.toggle('bubble--pinned', pinned);
    }
    el.style.opacity = '1';
    if (pinned) {
      // Low, below the runner, clear of the road ahead (above the credit line)
      el.style.transform = `translate(${(window.innerWidth / 2).toFixed(0)}px, ${(window.innerHeight - 36).toFixed(0)}px) translate(-50%, -100%)`;
      return;
    }
    const half = el.offsetWidth / 2 + 8; // keep the bubble on screen
    const x = Math.min(window.innerWidth - half, Math.max(half, (this.v.x * 0.5 + 0.5) * window.innerWidth));
    const y = Math.max(el.offsetHeight + 60, (-this.v.y * 0.5 + 0.5) * window.innerHeight);
    el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -100%)`;
  }

  private drive(): void {
    const near = this.obstacles.filter((o) => o.active && !o.hit && o.z < 2 && o.z > -this.speed * 0.9);
    const blockedIn = (lane: number): boolean => near.some((o) => o.lane === lane && G.OBSTACLES[o.kind].action === 'swerve');
    if (blockedIn(this.lane)) {
      const options = [this.lane - 1, this.lane + 1].filter((l) => l >= -1 && l <= 1 && !blockedIn(l));
      if (options.length) this.input(options[0] < this.lane ? 'left' : 'right');
      return;
    }
    const front = near.find((o) => o.lane === this.lane && o.z > -this.speed * 0.32 && o.z < 0);
    if (!front) return;
    const act = G.OBSTACLES[front.kind].action;
    if (act === 'jump' && this.grounded) this.input('up');
    if (act === 'duck' && this.duckT <= 0) this.input('down');
  }

  debugState(): Record<string, unknown> {
    const holder = this.bottleHolder === this.runner ? 'runner' : this.bottleHolder === this.chairman ? 'chairman' : this.bottleHolder ? 'agbero' : 'none';
    return {
      phaseT: this.phaseT,
      time: this.time,
      speed: this.speed,
      distance: this.distance,
      chill: this.chill,
      pulse: this.pulseState,
      pulseLeft: this.pulseLeft,
      holder,
      runnerVisible: this.runner.root.visible,
      camZ: this.camera.position.z,
      cineStep: this.cineStep,
      bubble: this.time < this.bubbleUntil ? this.bubbleText : '',
      speaker: this.time < this.bubbleUntil ? this.bubbleName : '',
      stage: this.stage,
      intensity: score.debugIntensity(),
    };
  }

  /** Test hook (?debug only): jump the distance (milestone lines, intensity). */
  debugSetDistance(m: number): void {
    if (useGame.getState().phase === 'running') this.distance = m;
  }

  /** Test hook (?debug only): traffic flashes past in the next lane just after a late swerve. */
  debugNearMiss(): void {
    if (useGame.getState().phase !== 'running') return;
    const o = this.obstacles.find((x) => !x.active && G.OBSTACLES[x.kind].action === 'swerve');
    if (!o) return;
    o.active = true;
    o.hit = o.cleared = false;
    o.passed = false;
    o.lane = this.lane === 1 ? 0 : this.lane + 1;
    o.z = G.PLAYER_HALF_D + G.OBSTACLES[o.kind].length / 2 + 0.05;
    o.obj.position.set(laneX(o.lane), 0, o.z);
    o.obj.visible = true;
    this.lastLaneChange = this.time;
  }

  /** Test hook (?debug only): a stumble, as if you clipped something. */
  debugStumble(): void {
    if (useGame.getState().phase === 'running') this.stumble();
  }

  /** Test hook (?debug only): put an obstacle of `kind` in your lane, `ahead` metres up the road. */
  debugSpawn(kind: G.ObstacleKind, ahead: number): void {
    const o = this.obstacles.find((x) => !x.active && x.kind === kind);
    if (!o) return;
    o.active = true;
    o.hit = o.cleared = false;
    o.passed = false;
    o.lane = this.lane;
    o.z = -ahead;
    o.obj.position.set(laneX(o.lane), 0, o.z);
    o.obj.rotation.set(0, G.OBSTACLES[kind].rotY, 0);
    o.obj.scale.set(1, 1, 1);
    o.obj.visible = true;
  }

  /** Test hook (?debug only): nothing can catch you for `secs` (to stage events headless). */
  debugInvulnerable(secs: number): void {
    this.invulnerableUntil = this.time + secs;
  }

  /** Test hook (?debug only): get caught now, to check the trophy shot. */
  debugCatch(): void {
    if (useGame.getState().phase === 'running') this.caught();
  }

  /** Test hook (?debug only): fill the Pulse meter. */
  debugFillChill(): void {
    if (this.pulseState !== 'empty') return;
    this.chill = this.pulseCost - 1;
    this.award(1);
  }

  debugPulse(): Record<string, unknown> {
    let ahead = 0;
    for (const o of this.obstacles) if (o.active && !o.cleared && o.z >= -G.PULSE_CLEAR_AHEAD && o.z <= G.PULSE_CLEAR_BEHIND) ahead++;
    return { state: this.pulseState, cleared: this.pulseCleared, magnetCaps: this.pulseCaps, py: this.py, chill: this.chill, lane: this.lane, caps: this.caps, ahead, beat: this.beatNow(), synced: music.beat() !== null, rowSync: this.debugRowSync() };
  }

  /**
   * Debug: for each row on the road, (beat it will actually reach the runner on, from where it
   * is and how fast it moves) minus (beat it was aimed at). 0 = dead on the beat.
   */
  private debugRowSync(): number[] {
    const b = this.frameBeat; // where the road was last moved to (not the song's position now)
    const out: number[] = [];
    for (const o of this.obstacles) {
      if (!o.active || o.cleared) continue;
      const front = -(o.z + G.OBSTACLES[o.kind].length / 2);
      if (front < 2) continue;
      const v = this.speed * (o.kind === 'okada' ? 1 + G.OKADA_EXTRA : 1);
      if (v < 1) continue;
      out.push(+(b + front / v / music.BEAT_S - o.beat).toFixed(3));
    }
    return out;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.scene.fog = null;
  }
}

function pickKind(): G.ObstacleKind {
  const kinds = Object.keys(G.OBSTACLES) as G.ObstacleKind[];
  const total = kinds.reduce((s, k) => s + G.OBSTACLES[k].weight, 0);
  let r = Math.random() * total;
  for (const k of kinds) {
    r -= G.OBSTACLES[k].weight;
    if (r <= 0) return k;
  }
  return 'barrier';
}

/** Clone a normalised Tripo prop (base at y = 0) and scale it to metres. */
function place(src: THREE.Group, scale: number, scaleY?: number): THREE.Group {
  const g = new THREE.Group();
  const c = src.clone();
  c.scale.set(scale, scaleY ?? scale, scale);
  g.add(c);
  return g;
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (g) draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roadTexture(): THREE.Texture {
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = '#4a4744';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1800; i++) {
      const v = 60 + Math.random() * 40;
      g.fillStyle = `rgb(${v},${v - 3},${v - 6})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    const total = G.ROAD_HALF * 2;
    g.fillStyle = 'rgba(245,240,225,0.9)';
    for (const b of [-0.5, 0.5]) {
      const x = ((b * G.LANE_WIDTH + G.ROAD_HALF) / total) * 256;
      g.fillRect(x - 2.5, 0, 5, 128);
    }
    g.fillStyle = '#e8b62c';
    g.fillRect(4, 0, 4, 256);
    g.fillRect(248, 0, 4, 256);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function walkTexture(): THREE.Texture {
  const t = canvasTex(128, 128, (g) => {
    g.fillStyle = '#b8a487';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(80,60,40,0.35)';
    g.lineWidth = 2;
    for (let i = 0; i <= 128; i += 32) {
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(128, i);
      g.stroke();
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, 128);
      g.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function skyTexture(): THREE.Texture {
  return canvasTex(4, 256, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#3c4a86');
    grd.addColorStop(0.45, '#d9875c');
    grd.addColorStop(0.62, '#f2b278');
    grd.addColorStop(1, '#eaa070');
    g.fillStyle = grd;
    g.fillRect(0, 0, 4, 256);
  });
}

let blobTex: THREE.Texture | null = null;
function blobShadow(radius: number): THREE.Mesh {
  blobTex ??= canvasTex(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  return m;
}
