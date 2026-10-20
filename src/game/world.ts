import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as music from '../audio/music';
import * as sfx from '../audio/sfx';
import * as voices from '../audio/voices';
import { track } from '../analytics/track';
import { FoamTrail } from './foam';
import { dressAgbero, type Outfit } from './outfit';
import { writePref } from '../util/storage';
import type { CharacterAsset, GameAssets } from './assets';
import * as G from './gameConfig';
import { gameDom, useGame, type GamePhase, type Runner } from './gameStore';

export type GameInput = 'left' | 'right' | 'up' | 'down' | 'boost';

const laneX = (lane: number): number => lane * G.LANE_WIDTH;
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const smooth = (t: number): number => t * t * (3 - 2 * t);
const lerp = THREE.MathUtils.lerp;
const setPhase = (phase: GamePhase): void => useGame.setState({ phase });
const AXIS_X = new THREE.Vector3(1, 0, 0);

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
  private readonly roadTex: THREE.Texture;
  private readonly walkTex: THREE.Texture;
  private readonly parkedDanfo: THREE.Group;
  private readonly bottle: THREE.Group;
  private readonly heroBottle: THREE.Group;
  private bottleHolder: Actor | null = null;
  private readonly bottleGrip = new THREE.Group(); // pivot at the bottle's middle, parented to a hand
  private readonly foam = new FoamTrail(700);
  private boostAt = -99; // time the boost started (smooth rise/fall curve)
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
  private ahead = G.START_GRACE;
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
  private bubbleUntil = 0;
  private nextBubbleAt = 0;
  private caps = 0;
  private chill = 0;
  private boostT = 0;
  private boostY = 0;
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
    this.fog = new THREE.Fog(0xeaa070, 45, lowTier ? 120 : 150);
    this.group.visible = false; // built during the story, shown on hand-off

    const hemi = new THREE.HemisphereLight(0xffe2bd, 0x5b4636, 1.7);
    const sun = new THREE.DirectionalLight(0xffc58f, 2.2);
    sun.position.set(-15, 20, 18);
    this.group.add(hemi, sun);

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
    const perSide = lowTier ? 24 : 28;
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

    // Motor-park set dressing: a danfo parked beside the runner in the menu
    this.parkedDanfo = place(assets.props.danfo, 5);
    this.parkedDanfo.position.set(-laneX(1), 0, 1.5);
    this.group.add(this.parkedDanfo);

    // Obstacle pools
    const pool: Record<G.ObstacleKind, number> = { danfo: 4, keke: 4, okada: 4, barrier: 5, table: 4, banner: 4 };
    for (const kind of Object.keys(pool) as G.ObstacleKind[]) {
      const def = G.OBSTACLES[kind];
      for (let i = 0; i < pool[kind]; i++) {
        const obj = place(assets.props[def.prop], def.scale, 'scaleY' in def ? def.scaleY : undefined);
        obj.rotation.y = def.rotY;
        obj.visible = false;
        this.group.add(obj);
        this.obstacles.push({ kind, obj, lane: 0, z: 0, active: false, hit: false, horned: false });
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
    for (const b of [this.bottle, this.heroBottle]) {
      b.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (m instanceof THREE.MeshStandardMaterial) m.fog = false;
        });
      });
    }
    this.group.add(this.bottleGrip, this.heroBottle, this.foam.points);

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
    this.scene.fog = prevFog;
    this.group.visible = false;
    pooled.forEach((o) => {
      o.visible = false;
    });
    hidden.forEach((o) => {
      o.visible = true;
    });
  }

  /** Story hand-off: the bottle that rocketed off-screen falls into the runner's hand. */
  activate(): void {
    this.scene.background = this.sky;
    this.scene.fog = this.fog;
    this.scene.environmentIntensity = 0.35;
    this.group.visible = true;
    this.phaseT = 0;
    this.releaseBottle();
    voices.preloadVoices();
    setPhase('reveal');
  }

  chooseRunner(r: Runner): void {
    for (const a of Object.values(this.runners)) a.root.visible = false;
    this.runner = this.runners[r];
    this.runner.root.visible = true;
    this.runner.root.position.set(0, 0, 0);
    this.runner.play('idle', { pingPong: true, speed: 0.4 });
    if (this.bottleHolder && this.bottleHolder !== this.chairman) this.holdBottle(this.runner);
    useGame.setState({ runner: r });
  }

  private toMenuPose(): void {
    this.runner.play('idle', { pingPong: true, speed: 0.4 });
    this.chairman.play('idle');
    this.agberos[1].play('idle');
    this.agberos[2].play('idle');
    this.layoutMenuAgberos();
  }

  private layoutMenuAgberos(): void {
    // Behind the runner (towards +z), muttering and staring at the yellow cap
    const spots: Array<[number, number, number]> = [
      [1.2, 4.0, -0.25],
      [2.6, 5.2, -0.45],
      [-0.4, 5.8, -0.1],
    ];
    this.agberos.forEach((a, i) => {
      const [x, z, yaw] = spots[i];
      a.root.position.set(x, 0, z);
      a.root.rotation.y = yaw;
    });
  }

  /** TAP TO RUN: psssht → "Oya hold am!" + whistle → camera swings behind → control. */
  tapToRun(): void {
    if (useGame.getState().phase !== 'menu') return;
    this.resetRun();
    sfx.capOpen();
    this.whistled = false;
    this.phaseT = 0;
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
    this.foam.clear();
    this.boostAt = -99;
    this.speed = 0;
    this.distance = 0;
    this.ahead = G.START_GRACE;
    this.lane = this.prevLane = 0;
    this.px = this.py = this.vy = 0;
    this.grounded = true;
    this.duckT = this.slideT = this.lean = 0;
    this.lockAnimUntil = 0;
    this.lastStumble = -99;
    this.chaseGap = 4.5;
    this.chairmanLunge = 0;
    this.bubbleUntil = 0;
    this.caps = this.chill = 0;
    this.boostT = this.boostY = 0;
    this.invulnerableUntil = 0;
    this.stage = 0;
    this.heroBottle.visible = false;
    this.holdBottle(this.runner);
    this.runner.root.rotation.set(0, 0, 0);
    this.runner.root.visible = true;
    this.agberos.forEach((a) => {
      a.root.rotation.y = 0;
    });
    useGame.setState({ caps: 0, distance: 0, stage: 0, chill: 0, boosting: false, banner: null });
  }

  input(action: GameInput): void {
    const phase = useGame.getState().phase;
    if (phase !== 'running' && phase !== 'starting') return;
    const boosting = this.boostT > 0;
    switch (action) {
      case 'left':
      case 'right': {
        const next = Math.max(-1, Math.min(1, this.lane + (action === 'left' ? -1 : 1)));
        if (next === this.lane) return;
        this.prevLane = this.lane;
        this.lane = next;
        sfx.swoosh(action === 'left' ? -1 : 1);
        break;
      }
      case 'up':
        if (!this.grounded || boosting) return;
        this.vy = G.JUMP_VELOCITY;
        this.grounded = false;
        this.duckT = this.slideT = 0;
        this.runner.play('jump', { loop: false, speed: 1.35, fade: 0.08 });
        this.lockAnimUntil = this.time + 0.7;
        sfx.jump();
        break;
      case 'down':
        if (boosting) return;
        if (!this.grounded) this.vy = G.FAST_FALL_VELOCITY;
        this.duckT = this.slideT = G.DUCK_TIME;
        this.runner.play('duck', { fade: 0.06 });
        this.lockAnimUntil = this.time + G.DUCK_TIME;
        if (this.grounded) sfx.slide();
        break;
      case 'boost':
        this.startBoost();
        break;
      default: {
        const never: never = action;
        return never;
      }
    }
  }

  private startBoost(): void {
    if (this.boostT > 0 || this.chill < G.CHILL_FULL || useGame.getState().phase !== 'running') return;
    this.boostT = G.BOOST_S;
    this.boostAt = this.time;
    this.chill = 0;
    this.chaseCloseUntil = 0;
    this.runner.play('duck', { fade: 0.25 }); // surf stance
    sfx.boost();
    music.setStage(Math.min(G.STAGES.length - 1, this.stage + 1));
    this.flashBanner('FIZZ BOOST!', 1400);
    useGame.setState({ chill: 0, boosting: true });
  }

  // ------------------------------------------------------------------ frame

  update(dt: number): void {
    const phase = useGame.getState().phase;
    this.time += dt;
    this.phaseT += dt;

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
      const steps = Math.max(1, Math.ceil(d / G.MAX_STEP));
      for (let i = 0; i < steps && ['running', 'starting'].includes(useGame.getState().phase); i++) {
        this.scroll(d / steps, true);
        if (phase === 'running') {
          this.collide();
          this.collect();
        }
      }
      this.distance += d;
      if (phase === 'running') this.updateStage();
      this.updateBoost(dt);
      this.storeTick -= dt;
      if (this.storeTick <= 0) {
        this.storeTick = 0.1;
        useGame.setState({ distance: Math.floor(this.distance) });
      }
    } else {
      this.scroll(d, false);
    }
    if (phase === 'caught') this.caughtStep();

    // Runner transform: slide lean (pivot at the feet), boost height, surf stance
    const wantLean = this.slideT > 0 && this.grounded && this.boostT <= 0 ? G.SLIDE_LEAN : 0;
    this.lean += (wantLean - this.lean) * Math.min(1, dt * (wantLean > this.lean ? 22 : 12));
    this.runner.root.rotation.x = this.lean;
    if (phase !== 'caught') {
      // Surf stance on the foam: turned slightly side-on, easing in and out with the height
      const surf = Math.min(1, this.boostY / G.BOOST_HEIGHT);
      this.runner.root.rotation.y = 0.35 * surf;
      this.runner.root.rotation.z = Math.sin(this.time * 2.4) * 0.05 * surf;
    }
    this.runner.root.position.set(this.px, this.py + this.boostY - this.lean * 0.12, 0);
    const runRate = Math.min(1.75, Math.max(0.6, this.speed / 12));
    if (this.runner.currentName === 'run') this.runner.setSpeed(runRate);
    this.runner.update(dt);
    this.updateChasers(dt, phase);
    this.updateBottle(phase);
    this.updateCoins();
    this.foam.update(dt, d * G.FOAM_DRAG); // the geyser travels with the runner, trailing a little
    this.foam.setScale(window.innerHeight, this.camera.fov);
    this.updateCamera(dt, phase);
    this.updateBubble(phase);
  }

  private revealStep(): void {
    // The bottle falls out of the sky into the runner's hand, then the idle menu.
    if (this.phaseT >= G.DROP_S && !this.bottleHolder) {
      this.holdBottle(this.runner);
      sfx.catchIt();
    }
    if (this.phaseT > G.DROP_S + 0.5 && this.chairman.currentName !== 'shout') {
      this.chairman.play('shout');
      this.bubbleText = 'Ah-ah! Yellow cap?!';
      this.bubbleUntil = this.time + 2.2;
      voices.shout(1, 0.45);
    }
    if (this.phaseT > G.DROP_S + 1.4) {
      this.chairman.play('idle', { fade: 0.4 });
      setPhase('menu');
    }
  }

  private startingStep(): void {
    if (!this.whistled && this.phaseT > 0.45) {
      this.whistled = true;
      this.bubbleText = 'Oya hold am!';
      this.bubbleUntil = this.time + 1.8;
      voices.shout(3, 0.65);
      sfx.whistle();
      this.chairman.play('shout');
      this.runner.play('run', { fade: 0.2 });
      for (const a of this.agberos.slice(1)) a.play('run');
    }
    if (this.whistled && this.phaseT > 0.9 && this.chairman.currentName !== 'run') this.chairman.play('run');
    if (this.phaseT >= G.START_S) {
      this.chaseCloseUntil = this.time + G.CHASE_HOLD_S;
      this.nextBubbleAt = this.time + 1.5;
      void music.start(0);
      setPhase('running');
    }
  }

  private scroll(d: number, spawn: boolean): void {
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
    if (this.parkedDanfo.visible) {
      this.parkedDanfo.position.z += d;
      if (this.parkedDanfo.position.z > G.DESPAWN_Z + 6) this.parkedDanfo.visible = false;
    }
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
      if (!this.coinOn[i]) continue;
      this.coinZ[i] += d;
      if (this.coinZ[i] > G.DESPAWN_Z) this.coinOn[i] = 0;
    }
    if (!spawn) return;
    this.ahead -= d;
    while (this.ahead < G.SPAWN_HORIZON) {
      this.spawnRow(-this.ahead);
      const [a, b] = G.STAGES[this.stage].gap;
      this.ahead += rand(a, b);
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
      o.lane = lanes[i];
      o.z = z - def.length / 2;
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
    for (let i = 0; i < n; i++) {
      const cz = action ? z + 5.5 - i * G.COIN_SPACING : z - 4 - i * G.COIN_SPACING;
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
        if (this.slideT > 0) sfx.slide();
        else sfx.land();
      }
    }
    if (this.duckT > 0) this.duckT -= dt;
    if (this.slideT > 0 && this.grounded) this.slideT -= dt;
    const free = this.time >= this.lockAnimUntil && this.grounded && this.duckT <= 0 && this.boostT <= 0;
    if (free && this.whistled && this.runner.currentName !== 'run') this.runner.play('run', { fade: 0.12 });
  }

  private updateBoost(dt: number): void {
    const e = this.time - this.boostAt;
    const total = G.BOOST_S + G.BOOST_FALL_S;
    if (e < 0 || e > total + 0.2) return;
    // Smooth height curve: eased rise, a gentle bob on the foam, eased glide down.
    let h: number;
    if (e < G.BOOST_RISE_S) h = G.BOOST_HEIGHT * smooth(e / G.BOOST_RISE_S);
    else if (e < G.BOOST_S) h = G.BOOST_HEIGHT + Math.sin((e - G.BOOST_RISE_S) * 3.2) * 0.12;
    else h = G.BOOST_HEIGHT * (1 - smooth(Math.min(1, (e - G.BOOST_S) / G.BOOST_FALL_S)));
    this.boostY = h;
    this.boostT = Math.max(0, G.BOOST_S - e);

    // The foam geyser: puffs all the way from the feet to the road, spraying back and out.
    if (h > 0.05) {
      const rate = e < G.BOOST_S ? 150 : 60;
      const n = Math.max(1, Math.round(rate * dt));
      for (let i = 0; i < n; i++) {
        const along = Math.random(); // 0 = at the feet, 1 = at the road
        const y = h * (1 - along);
        const side = (Math.random() - 0.5) * 0.7;
        this.foam.emit(
          this.px + side,
          y,
          Math.random() * 0.5,
          side * (0.6 + along * 1.4) + (Math.random() - 0.5) * 0.4, // fans out towards the road
          (Math.random() - 0.5) * 0.5,
          0.2 + Math.random() * 0.7,
          0.2 + along * 0.4 + Math.random() * 0.12,
          0.45 + Math.random() * 0.35,
        );
      }
    }

    if (e >= G.BOOST_S && useGame.getState().boosting) {
      this.invulnerableUntil = this.time + G.BOOST_FALL_S + G.BOOST_GRACE_S;
      useGame.setState({ boosting: false });
      music.setStage(this.stage);
      sfx.whoosh(0.6, 0.35);
    }
    if (e >= total && this.boostAt > 0) {
      this.boostAt = -99;
      this.boostY = 0;
      sfx.land();
      this.runner.play('run', { fade: 0.2 });
    }
  }

  private collide(): void {
    if (this.boostT > 0 || this.boostY > 0.4 || this.time < this.invulnerableUntil) return;
    const top = this.py + (this.duckT > 0 && this.grounded ? G.DUCK_TOP : G.STAND_TOP);
    for (const o of this.obstacles) {
      if (!o.active || o.hit) continue;
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
    this.bubbleText = 'Oya drop am!';
    this.bubbleUntil = this.time + 1.8;
    sfx.crash(false);
    voices.shout(1, 0.6);
  }

  private caught(): void {
    this.phaseT = 0;
    this.boostT = this.boostY = 0;
    this.boostAt = -99;
    this.slideT = this.duckT = 0;
    this.runner.play('fall', { loop: false, speed: 1.3, fade: 0.06 });
    this.camShake = 0.45;
    this.bubbleText = 'We don catch am!';
    this.bubbleUntil = this.time + 3;
    sfx.crash(true);
    window.setTimeout(() => voices.shout(3, 0.7), 250);
    music.stop(0.4);
    const dist = Math.floor(this.distance);
    const best = Math.max(useGame.getState().best, dist);
    writePref('bestDistance', String(best));
    useGame.setState({ best, distance: dist, banner: null, boosting: false });
    // Remember where the camera is, to swing round to the trophy shot from here
    this.camFrom.copy(this.camera.position);
    this.camera.getWorldDirection(this.fwd);
    this.lookFrom.copy(this.camera.position).addScaledVector(this.fwd, 9);
    setPhase('caught');
    track('game_caught', { distance: dist, caps: this.caps });
  }

  private caughtStep(): void {
    // The Chairman takes the bottle and lifts it like a trophy; the boys celebrate.
    if (this.phaseT > 0.8 && this.bottleHolder !== this.chairman) {
      this.holdBottle(this.chairman);
      for (const a of this.agberos) a.play('shout');
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
    if (this.boostT <= 0) music.setStage(s);
  }

  private collect(): void {
    const boosting = this.boostT > 0 || this.boostY > 0.4;
    const top = this.py + this.boostY + G.STAND_TOP;
    let got = 0;
    for (let i = 0; i < G.COIN_POOL; i++) {
      if (!this.coinOn[i]) continue;
      if (Math.abs(this.coinZ[i]) > G.COIN_PICKUP) continue;
      if (Math.abs(this.coinX[i] - this.px) > 0.9) continue;
      // While surfing the fizz, caps in your lane fly up to you.
      if (!boosting && (this.coinY[i] < this.py - 0.3 || this.coinY[i] > top + 0.2)) continue;
      this.coinOn[i] = 0;
      got++;
    }
    if (!got) return;
    this.caps += got;
    this.chill = Math.min(G.CHILL_FULL, this.chill + (this.boostT > 0 ? 0 : got));
    sfx.coin();
    useGame.setState({ caps: this.caps, chill: this.chill / G.CHILL_FULL });
  }

  private flashBanner(text: string, ms: number): void {
    useGame.setState({ banner: text });
    window.setTimeout(() => {
      if (useGame.getState().banner === text) useGame.setState({ banner: null });
    }, ms);
  }

  private updateChasers(dt: number, phase: GamePhase): void {
    if (phase === 'reveal' || phase === 'menu') {
      this.layoutMenuAgberos();
    } else if (phase === 'caught') {
      // Surround the runner, facing the camera for the trophy shot
      const spots: Array<[number, number, number]> = [
        [0.95, -0.7, -0.35],
        [-1.2, 0.4, 0.3],
        [0.3, 1.4, 0],
      ];
      this.agberos.forEach((a, i) => {
        const [x, z, yaw] = spots[i];
        a.root.position.lerp(this.v.set(this.px + x, 0, z), Math.min(1, dt * 4));
        a.root.rotation.y += (yaw - a.root.rotation.y) * Math.min(1, dt * 5);
      });
    } else {
      const want = this.boostT > 0 ? G.CHASE_FAR + 4 : this.time < this.chaseCloseUntil ? G.CHASE_CLOSE : G.CHASE_FAR;
      const rate = phase === 'starting' ? 1.2 : want > this.chaseGap ? 0.6 : 2;
      this.chaseGap += (want - this.chaseGap) * Math.min(1, dt * rate);
      this.chairmanLunge = Math.max(0, this.chairmanLunge - dt * 0.6);
      const offs: Array<[number, number]> = [
        [-1.35, 0.2],
        [1.3, 0.7],
        [0.75, 2.2],
      ];
      this.agberos.forEach((a, i) => {
        let [ox, oz] = offs[i];
        if (i === 0 && this.chairmanLunge > 0) {
          // Right on your heels, reaching for the Pepsi
          ox = lerp(ox, 0.35, this.chairmanLunge);
          oz = lerp(oz, -0.4, this.chairmanLunge);
        }
        a.root.position.lerp(this.v.set(this.px * 0.85 + ox, 0, this.chaseGap + oz), Math.min(1, dt * 6));
        a.root.rotation.y += (0 - a.root.rotation.y) * Math.min(1, dt * 6);
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
    const boost = phase === 'running' ? Math.max(0, this.speed - G.STAGES[0].speed) * 0.45 + (this.boostY > 0.3 ? 6 : 0) : 0;
    const fov = (cam.aspect < 0.8 ? 70 : 55) + boost;
    if (Math.abs(cam.fov - fov) > 0.2) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 4);
      cam.updateProjectionMatrix();
    }
    this.camShake *= Math.pow(0.02, dt);
    const sx = (Math.random() - 0.5) * this.camShake;
    const sy = (Math.random() - 0.5) * this.camShake;
    const chasePos = this.v.set(this.px * 0.5 + sx, G.CAM_HEIGHT + (this.py + this.boostY) * 0.45 + sy, G.CAM_BACK);
    const chaseLook = this.look.set(this.px * 0.5, 1.2 + this.boostY * 0.6, -G.CAM_LOOK_AHEAD);
    // Menu: in front of the runner, looking back at them and the agberos behind
    const menuPos = this.s.set(1.35 + Math.sin(this.time * 0.4) * 0.15, 1.5, -3.5);
    const menuLook = { x: 0.2, y: 1.15, z: 1.5 };

    if (phase === 'reveal' || phase === 'menu' || phase === 'loading') {
      cam.position.copy(menuPos);
      cam.lookAt(menuLook.x, menuLook.y, menuLook.z);
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

  private updateBubble(phase: GamePhase): void {
    const el = gameDom.bubble;
    if (!el) return;
    if (phase === 'running' && this.chaseGap < 5 && this.time > this.nextBubbleAt && this.time > this.bubbleUntil) {
      this.bubbleText = G.BUBBLE_LINES[Math.floor(Math.random() * G.BUBBLE_LINES.length)];
      this.bubbleUntil = this.time + 1.8;
      this.nextBubbleAt = this.time + 3.2;
      voices.shout(1, 0.5);
    }
    if (this.time >= this.bubbleUntil) {
      el.style.opacity = '0';
      return;
    }
    const a = this.chairman.root.position;
    this.v.set(a.x, G.AGBERO_HEIGHT * G.CHAIRMAN_SCALE + 0.45, a.z).project(this.camera);
    if (this.v.z > 1) {
      el.style.opacity = '0';
      return;
    }
    if (el.textContent !== this.bubbleText) el.textContent = this.bubbleText;
    const half = el.offsetWidth / 2 + 8; // keep the bubble on screen
    const x = Math.min(window.innerWidth - half, Math.max(half, (this.v.x * 0.5 + 0.5) * window.innerWidth));
    const y = Math.max(el.offsetHeight + 60, (-this.v.y * 0.5 + 0.5) * window.innerHeight);
    el.style.opacity = '1';
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
    return { phaseT: this.phaseT, time: this.time, speed: this.speed, distance: this.distance, chill: this.chill, boostT: this.boostT };
  }

  /** Test hook (?debug only): get caught now, to check the trophy shot. */
  debugCatch(): void {
    if (useGame.getState().phase === 'running') this.caught();
  }

  /** Test hook (?debug only): fill the Fizz meter. */
  debugFillChill(): void {
    this.chill = G.CHILL_FULL;
    useGame.setState({ chill: 1 });
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
