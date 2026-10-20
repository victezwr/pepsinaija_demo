import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as music from '../audio/music';
import * as sfx from '../audio/sfx';
import * as voices from '../audio/voices';
import { track } from '../analytics/track';
import { writePref } from '../util/storage';
import type { CharacterAsset, GameAssets } from './assets';
import * as G from './gameConfig';
import { gameDom, useGame, type GamePhase, type Runner } from './gameStore';

export type GameInput = 'left' | 'right' | 'up' | 'down';

const laneX = (lane: number): number => lane * G.LANE_WIDTH;
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const smooth = (t: number): number => t * t * (3 - 2 * t);
const setPhase = (phase: GamePhase): void => useGame.setState({ phase });

/** A skinned character with cross-faded clips. Models face +Z; the chase runs towards -Z. */
class Actor {
  readonly root = new THREE.Group();
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
    this.mixer = new THREE.AnimationMixer(model);
    for (const [name, clip] of Object.entries(asset.clips)) this.actions.set(name, this.mixer.clipAction(clip));
  }

  play(name: string, opts: { loop?: boolean; fade?: number; speed?: number } = {}): void {
    const next = this.actions.get(name);
    if (!next) return;
    const { loop = true, fade = 0.15, speed = 1 } = opts;
    next.timeScale = speed;
    if (next === this.current) return;
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
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
  }
}

interface Obstacle {
  kind: G.ObstacleKind;
  obj: THREE.Group;
  lane: number;
  z: number;
  active: boolean;
  hit: boolean;
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
  private readonly tower = new THREE.Group();
  private readonly bottle: THREE.Group;
  private readonly coinMesh: THREE.InstancedMesh;
  private readonly coinX = new Float32Array(G.COIN_POOL);
  private readonly coinY = new Float32Array(G.COIN_POOL);
  private readonly coinZ = new Float32Array(G.COIN_POOL);
  private readonly coinOn = new Uint8Array(G.COIN_POOL);
  private nextCoin = 0;
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly zero = new THREE.Vector3(0, 0, 0);
  private readonly bottleFrom = new THREE.Vector3();
  private readonly sky: THREE.Texture;
  private readonly fog: THREE.Fog;
  private slideT = 0;
  private lean = 0;

  // Run state
  private time = 0;
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
  private lockAnimUntil = 0;
  private lastStumble = -99;
  private chaseGap: number = G.CHASE_CLOSE;
  private chaseCloseUntil = 0;
  private towerZ = -G.TOWER_DISTANCE;
  private camShake = 0;
  private phaseT = 0;
  private bubbleText = '';
  private bubbleUntil = 0;
  private nextBubbleAt = 0;
  private coins = 0;
  private stage = 0;
  private landed = false;
  /** Test-only (?debug&autopilot): dodges by itself so the finish can be checked headless. */
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
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(G.ROAD_HALF * 2, 320),
      new THREE.MeshStandardMaterial({ map: this.roadTex, roughness: 0.95 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.z = -140;
    this.roadTex.repeat.set(1, 320 / 8);
    this.walkTex = walkTexture();
    this.walkTex.repeat.set(1, 320 / 4);
    for (const side of [-1, 1]) {
      const walk = new THREE.Mesh(
        new THREE.PlaneGeometry(G.SIDEWALK, 320),
        new THREE.MeshStandardMaterial({ map: this.walkTex, roughness: 1 }),
      );
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
    const perSide = lowTier ? 20 : 26;
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
        const slot = { variants, z: G.DESPAWN_Z - i * bWidth };
        variants[Math.floor(Math.random() * 3)].visible = true;
        this.buildings.push(slot);
      }
    }
    const poleEvery = 18;
    const polesPerSide = Math.ceil(this.buildingSpan / poleEvery);
    this.poleSpan = polesPerSide * poleEvery;
    for (const side of [-1, 1]) {
      for (let i = 0; i < polesPerSide; i++) {
        const p = place(assets.props.pole, 7.5);
        p.position.set(side * (G.ROAD_HALF + 0.7), 0, G.DESPAWN_Z - i * poleEvery - (side > 0 ? poleEvery / 2 : 0));
        this.poles.push(p);
        this.group.add(p);
      }
    }

    // Obstacle pools
    const pool: Record<G.ObstacleKind, number> = { danfo: 4, keke: 4, okada: 4, barrier: 5, table: 4, banner: 4 };
    for (const kind of Object.keys(pool) as G.ObstacleKind[]) {
      const def = G.OBSTACLES[kind];
      for (let i = 0; i < pool[kind]; i++) {
        const obj = place(assets.props[def.prop], def.scale, 'scaleY' in def ? def.scaleY : undefined);
        obj.rotation.y = def.rotY;
        obj.visible = false;
        this.group.add(obj);
        this.obstacles.push({ kind, obj, lane: 0, z: 0, active: false, hit: false });
      }
    }

    // Coins: one instanced mesh of yellow caps
    const capGeo = new THREE.CylinderGeometry(G.COIN_RADIUS, G.COIN_RADIUS, 0.09, 28).rotateX(Math.PI / 2);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xffc400, metalness: 0.25, roughness: 0.3, emissive: 0x7a4a00, emissiveIntensity: 0.45 });
    this.coinMesh = new THREE.InstancedMesh(capGeo, capMat, G.COIN_POOL);
    this.coinMesh.frustumCulled = false;
    this.coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.coinMesh);

    // The prize: water tower with the bottle on top, glowing through the haze
    const tw = place(assets.props.tower, G.TOWER_HEIGHT);
    this.tower.add(tw);
    this.bottle = assets.bottle;
    this.bottle.scale.setScalar(G.BOTTLE_ON_TOWER / 0.98);
    this.bottle.position.y = G.TOWER_HEIGHT;
    this.bottle.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (m instanceof THREE.MeshStandardMaterial) m.fog = false;
        });
      }
    });
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd36b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    glow.scale.setScalar(7);
    glow.position.set(0, G.TOWER_HEIGHT + 1.1, -0.9); // behind the bottle so it halos instead of washing it out
    this.tower.add(this.bottle, glow);
    this.group.add(this.tower);

    // Characters
    this.runners = { male: new Actor(assets.male, G.RUNNER_HEIGHT), female: new Actor(assets.female, G.RUNNER_HEIGHT) };
    this.runner = this.runners.male;
    for (const r of Object.values(this.runners)) {
      r.root.visible = false;
      this.group.add(r.root);
      r.root.add(blobShadow(0.55));
    }
    for (let i = 0; i < 3; i++) {
      const a = new Actor(assets.agbero, G.AGBERO_HEIGHT * (0.95 + i * 0.04));
      a.root.add(blobShadow(0.6));
      a.play('idle');
      this.agberos.push(a);
      this.group.add(a.root);
    }
    this.layoutAgberos(true);
  }

  // ------------------------------------------------------------------ flow

  /**
   * Compiles every shader the chase needs while the story is still playing, with the scene
   * set up exactly as it will be (story objects hidden, game fog on), so the hand-off has no hitch.
   */
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

  /** Hand-off from the story: switch the scene over and start the reveal on the tower. */
  activate(): void {
    this.scene.background = this.sky;
    this.scene.fog = this.fog;
    this.scene.environmentIntensity = 0.35;
    this.group.visible = true;
    this.phaseT = 0;
    this.landed = false;
    voices.preloadVoices();
    setPhase('reveal');
  }

  chooseRunner(r: Runner): void {
    for (const a of Object.values(this.runners)) a.root.visible = false;
    this.runner = this.runners[r];
    this.runner.root.visible = true;
    this.runner.root.position.set(0, 0, 0);
    this.runner.play('cheer');
    useGame.setState({ runner: r });
  }

  /** Fresh run from zero (also used for "Run am again"). */
  start(): void {
    for (const o of this.obstacles) {
      o.active = false;
      o.obj.visible = false;
    }
    this.coinOn.fill(0);
    this.time = 0;
    this.speed = G.STAGES[0].speed * 0.6;
    this.distance = 0;
    this.ahead = G.START_GRACE;
    this.lane = this.prevLane = 0;
    this.px = this.py = this.vy = 0;
    this.grounded = true;
    this.duckT = 0;
    this.slideT = 0;
    this.lean = 0;
    this.lockAnimUntil = 0;
    this.lastStumble = -99;
    this.chaseGap = G.CHASE_CLOSE;
    this.chaseCloseUntil = G.CHASE_HOLD_S;
    this.towerZ = -G.TOWER_DISTANCE;
    this.coins = 0;
    this.stage = 0;
    this.nextBubbleAt = 0.4;
    this.bubbleUntil = 0;
    this.bottle.position.set(0, G.TOWER_HEIGHT, 0);
    this.bottle.rotation.set(0, 0, 0);
    this.bottle.scale.setScalar(G.BOTTLE_ON_TOWER / 0.98);
    if (this.bottle.parent !== this.tower) this.tower.add(this.bottle);
    this.runner.root.visible = true;
    this.runner.play('run');
    for (const a of this.agberos) a.play('run');
    useGame.setState({ coins: 0, stage: 0, unlocked: false, banner: null });
    setPhase('running');
    void music.start(0);
    voices.shout(3, 0.6); // the chase is on
    track('game_start', { runner: useGame.getState().runner });
  }

  input(action: GameInput): void {
    if (useGame.getState().phase !== 'running') return;
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
        if (!this.grounded) return;
        this.vy = G.JUMP_VELOCITY;
        this.grounded = false;
        this.duckT = 0;
        this.slideT = 0;
        this.runner.play('jump', { loop: false, speed: 1.35, fade: 0.08 });
        this.lockAnimUntil = this.time + 0.7;
        sfx.jump();
        break;
      case 'down':
        // Slide: knees bent, body thrown back, feet first under the banner.
        if (!this.grounded) this.vy = G.FAST_FALL_VELOCITY;
        this.duckT = G.DUCK_TIME;
        this.slideT = G.DUCK_TIME;
        this.runner.play('duck', { fade: 0.06 });
        this.lockAnimUntil = this.time + G.DUCK_TIME;
        if (this.grounded) sfx.slide();
        break;
      default: {
        const never: never = action;
        return never;
      }
    }
  }

  // ------------------------------------------------------------------ frame

  update(dt: number): void {
    const phase = useGame.getState().phase;
    this.time += dt;
    this.phaseT += dt;

    if (phase === 'running') {
      const target = G.STAGES[this.stage].speed;
      this.speed += (target - this.speed) * Math.min(1, dt * G.SPEED_EASE_PER_S);
    } else {
      this.speed = Math.max(0, this.speed - this.speed * Math.min(1, dt * 4) - dt * 2);
    }
    const d = this.speed * dt;
    this.distance += d;
    if (phase === 'running') {
      if (this.autopilot) this.drive();
      this.movePlayer(dt);
      // Sub-step the world so a fast frame can't carry a thin obstacle straight past the runner.
      const steps = Math.max(1, Math.ceil(d / G.MAX_STEP));
      for (let i = 0; i < steps && useGame.getState().phase === 'running'; i++) {
        this.scroll(d / steps, true);
        this.collide();
        this.collect();
      }
      this.updateStage();
      const unlocked = useGame.getState().unlocked;
      if (unlocked) {
        this.towerZ += d;
        if (this.towerZ >= -G.FINISH_STOP) this.win();
      }
    } else {
      this.scroll(d, false);
    }
    if (phase === 'caught') {
      this.caughtStep(dt);
    } else if (phase === 'won' || phase === 'end') {
      this.wonStep(dt);
    }

    this.tower.position.z = this.towerZ;
    // Slide lean eases in fast and out a little slower; pivot is the feet.
    const wantLean = this.slideT > 0 && this.grounded ? G.SLIDE_LEAN : 0;
    this.lean += (wantLean - this.lean) * Math.min(1, dt * (wantLean > this.lean ? 22 : 12));
    this.runner.root.rotation.x = this.lean;
    this.runner.root.position.set(this.px, this.py - this.lean * 0.12, 0);
    const runRate = Math.min(1.75, Math.max(0.6, this.speed / 12));
    if (phase === 'running' && this.runner.currentName === 'run') this.runner.setSpeed(runRate);
    this.runner.update(dt);
    this.updateChasers(dt, phase);
    this.updateCoins();
    this.updateCamera(dt, phase);
    this.updateBubble();
  }

  private scroll(d: number, spawn: boolean): void {
    this.roadTex.offset.y = (this.roadTex.offset.y + d / 8) % 1;
    this.walkTex.offset.y = (this.walkTex.offset.y + d / 4) % 1;
    for (const slot of this.buildings) {
      slot.z += d;
      if (slot.z > G.DESPAWN_Z + 6) {
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
      if (p.position.z > G.DESPAWN_Z + 4) p.position.z -= this.poleSpan;
    }
    for (const o of this.obstacles) {
      if (!o.active) continue;
      o.z += d;
      o.obj.position.z = o.z;
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
    if (useGame.getState().unlocked) return;
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
      o.lane = lanes[i];
      o.z = z - def.length / 2;
      o.obj.position.set(laneX(o.lane), 0, o.z);
      o.obj.visible = true;
      if (def.action === 'swerve') swerveLanes.add(o.lane);
      actionByLane.set(o.lane, def.action);
    });

    // A line of caps in a passable lane; arcs over jump obstacles
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
    if (this.time >= this.lockAnimUntil && this.grounded && this.duckT <= 0 && this.runner.currentName !== 'run') {
      this.runner.play('run', { fade: 0.12 });
    }
  }

  private collide(): void {
    const top = this.py + (this.duckT > 0 && this.grounded ? G.DUCK_TOP : G.STAND_TOP);
    for (const o of this.obstacles) {
      if (!o.active || o.hit) continue;
      const def = G.OBSTACLES[o.kind];
      if (Math.abs(o.z) > def.length / 2 + G.PLAYER_HALF_D) continue;
      const dx = Math.abs(this.px - laneX(o.lane));
      if (dx > def.halfW + G.PLAYER_HALF_W) continue;
      if (top <= def.bottom || this.py >= def.top) continue;
      o.hit = true;
      // Grazing the side while changing lanes = stumble; running into the front = caught.
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
    this.camShake = 0.25;
    this.bubbleText = 'We don almost catch am!';
    this.bubbleUntil = this.time + 1.6;
    sfx.crash(false);
    voices.shout(2, 0.55);
  }

  private caught(): void {
    this.phaseT = 0;
    this.runner.play('fall', { loop: false, speed: 1.3, fade: 0.06 });
    this.camShake = 0.45;
    this.bubbleText = 'We don catch am!';
    this.bubbleUntil = this.time + 3;
    this.slideT = 0;
    sfx.crash(true);
    window.setTimeout(() => voices.shout(3, 0.7), 250);
    music.stop(0.4);
    const best = Math.max(useGame.getState().best, this.coins);
    writePref('best', String(best));
    useGame.setState({ best, banner: null });
    setPhase('caught');
    track('game_caught', { coins: this.coins });
  }

  private caughtStep(dt: number): void {
    if (this.phaseT > 0.7 && this.agberos[0].currentName !== 'shout') for (const a of this.agberos) a.play('shout');
    this.chaseGap += (0.9 - this.chaseGap) * Math.min(1, dt * 3);
  }

  private win(): void {
    this.phaseT = 0;
    this.runner.play('cheer', { fade: 0.2 });
    for (const a of this.agberos) a.play('idle', { fade: 0.3 });
    this.bubbleText = 'Haa! E don land!';
    this.bubbleUntil = this.time + 3;
    // Move the bottle out of the tower so it can fly to the runner.
    this.bottle.getWorldPosition(this.bottleFrom);
    this.group.attach(this.bottle);
    useGame.setState({ banner: 'E DON LAND.' });
    music.stop(0.8);
    sfx.sting();
    setPhase('won');
    track('game_won', { coins: this.coins });
  }

  private wonStep(dt: number): void {
    const t = Math.min(1, this.phaseT / 1.5);
    const e = smooth(t);
    // Arc from the tower top down to just in front of the runner
    const tx = this.px;
    const tz = -2.2;
    this.bottle.position.set(
      THREE.MathUtils.lerp(this.bottleFrom.x, tx, e),
      THREE.MathUtils.lerp(this.bottleFrom.y, 0, e) + Math.sin(Math.PI * t) * 3,
      THREE.MathUtils.lerp(this.bottleFrom.z, tz, e),
    );
    this.bottle.scale.setScalar(THREE.MathUtils.lerp(G.BOTTLE_ON_TOWER, 1.1, e) / 0.98);
    this.bottle.rotation.y += dt * (1 - t) * 8;
    this.chaseGap += (5 - this.chaseGap) * Math.min(1, dt * 2);
    if (this.phaseT > 3.2 && useGame.getState().phase === 'won') setPhase('end');
  }

  private collect(): void {
    const top = this.py + G.STAND_TOP;
    let got = 0;
    for (let i = 0; i < G.COIN_POOL; i++) {
      if (!this.coinOn[i]) continue;
      if (Math.abs(this.coinZ[i]) > G.COIN_PICKUP) continue;
      if (Math.abs(this.coinX[i] - this.px) > 0.9) continue;
      if (this.coinY[i] < this.py - 0.3 || this.coinY[i] > top + 0.2) continue;
      this.coinOn[i] = 0;
      got++;
    }
    if (!got) return;
    this.coins += got;
    sfx.coin();
    const unlockedNow = this.coins >= G.COIN_TARGET && !useGame.getState().unlocked;
    useGame.setState({ coins: this.coins, ...(unlockedNow ? { unlocked: true } : {}) });
    if (unlockedNow) {
      this.flashBanner('1000 CAPS! THE PEPSI DEY YOUR FRONT. RUN!', 2600);
      sfx.sparkle();
    }
  }

  private updateStage(): void {
    let s = 0;
    for (let i = 0; i < G.STAGES.length; i++) if (this.coins >= G.STAGES[i].coins) s = i;
    if (s === this.stage) return;
    this.stage = s;
    useGame.setState({ stage: s });
    this.flashBanner('SPEED UP!', 1300);
    sfx.whoosh(0.6, 0.4);
    music.setStage(s);
  }

  private flashBanner(text: string, ms: number): void {
    useGame.setState({ banner: text });
    window.setTimeout(() => {
      if (useGame.getState().banner === text) useGame.setState({ banner: null });
    }, ms);
  }

  private layoutAgberos(snap: boolean): void {
    const offs: Array<[number, number]> = [
      [-1.35, 0.2],
      [1.3, 0.7],
      [0.75, 2.2],
    ];
    this.agberos.forEach((a, i) => {
      const [ox, oz] = offs[i];
      const x = this.px * 0.85 + ox;
      const z = this.chaseGap + oz;
      if (snap) a.root.position.set(x, 0, z);
      else a.root.position.lerp(this.v.set(x, 0, z), 0.2);
    });
  }

  private updateChasers(dt: number, phase: GamePhase): void {
    if (phase === 'running') {
      const want = this.time < this.chaseCloseUntil ? G.CHASE_CLOSE : G.CHASE_FAR;
      this.chaseGap += (want - this.chaseGap) * Math.min(1, dt * (want > this.chaseGap ? 0.6 : 2));
      for (const a of this.agberos) a.setSpeed(Math.max(0.7, this.speed / 11));
    }
    this.layoutAgberos(phase === 'reveal' || phase === 'card' || phase === 'select');
    for (const a of this.agberos) a.update(dt);
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
    // Widen a touch as the pace climbs, for a sense of speed.
    const boost = phase === 'running' ? Math.max(0, this.speed - G.STAGES[0].speed) * 0.45 : 0;
    const fov = (cam.aspect < 0.8 ? 70 : 55) + boost;
    if (Math.abs(cam.fov - fov) > 0.2) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    this.camShake *= Math.pow(0.02, dt);
    const sx = (Math.random() - 0.5) * this.camShake;
    const sy = (Math.random() - 0.5) * this.camShake;
    const restPos = this.v.set(this.px * 0.5 + sx, G.CAM_HEIGHT + this.py * 0.3 + sy, G.CAM_BACK);
    const restLook = this.look.set(this.px * 0.5, 1.2, -G.CAM_LOOK_AHEAD);
    if (phase === 'reveal') {
      // Continue the story's exit: the bottle drops out of the sky onto the tower top,
      // the camera holds on it, then pulls back down the street.
      const drop = Math.min(1, this.phaseT / G.BOTTLE_DROP_S);
      this.bottle.position.y = G.TOWER_HEIGHT + 5 * (1 - drop) * (1 - drop);
      if (drop >= 1 && !this.landed) {
        this.landed = true;
        sfx.land();
        sfx.sparkle();
      }
      const squash = this.landed ? Math.max(0, 1 - (this.phaseT - G.BOTTLE_DROP_S) / 0.35) : 0;
      this.bottle.scale.set(1 + squash * 0.12, 1 - squash * 0.15, 1 + squash * 0.12).multiplyScalar(G.BOTTLE_ON_TOWER / 0.98);
      const t = smooth(Math.max(0, Math.min(1, (this.phaseT - G.REVEAL_HOLD_S) / G.REVEAL_S)));
      const fromY = G.TOWER_HEIGHT + 1.4;
      cam.position.set(0, THREE.MathUtils.lerp(fromY, restPos.y, t), THREE.MathUtils.lerp(this.towerZ + 7, restPos.z, t));
      const lookY = THREE.MathUtils.lerp(fromY, restLook.y, t);
      const lookZ = THREE.MathUtils.lerp(this.towerZ, restLook.z, t);
      cam.lookAt(0, lookY, lookZ);
      if (this.phaseT > G.REVEAL_HOLD_S + G.REVEAL_S * 0.7 && this.agberos[0].currentName !== 'shout') {
        for (const a of this.agberos) a.play('shout');
        voices.shout(3, 0.6);
        this.bubbleText = 'Na our own be dat!';
        this.bubbleUntil = this.time + 2.6;
      }
      if (this.phaseT >= G.REVEAL_HOLD_S + G.REVEAL_S + 0.5) setPhase('card');
      return;
    }
    if (phase === 'won' || phase === 'end') {
      // Swing round in front of the runner (between them and the tower) to face them and the bottle
      const t = smooth(Math.min(1, this.phaseT / 1.6));
      cam.position.set(
        THREE.MathUtils.lerp(restPos.x, this.px + 1.8, t),
        THREE.MathUtils.lerp(restPos.y, 1.7, t),
        THREE.MathUtils.lerp(restPos.z, -5.2, t),
      );
      cam.lookAt(THREE.MathUtils.lerp(restLook.x, this.px, t), THREE.MathUtils.lerp(restLook.y, 1.1, t), THREE.MathUtils.lerp(restLook.z, -1, t));
      return;
    }
    cam.position.copy(restPos);
    cam.lookAt(restLook);
  }

  private updateBubble(): void {
    const el = gameDom.bubble;
    if (!el) return;
    const phase = useGame.getState().phase;
    if (phase === 'running' && this.chaseGap < 5 && this.time > this.nextBubbleAt && this.time > this.bubbleUntil) {
      this.bubbleText = G.BUBBLE_LINES[Math.floor(Math.random() * G.BUBBLE_LINES.length)];
      this.bubbleUntil = this.time + 1.8;
      voices.shout(1, 0.5);
      this.nextBubbleAt = this.time + 3.2;
    }
    const show = this.time < this.bubbleUntil && phase !== 'end';
    if (!show) {
      el.style.opacity = '0';
      return;
    }
    const a = this.agberos[0].root.position;
    this.v.set(a.x, G.AGBERO_HEIGHT + 0.45, a.z).project(this.camera);
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
    return { phaseT: this.phaseT, time: this.time, towerZ: this.towerZ, speed: this.speed };
  }

  /** Test hook (?debug only): jump the coin count, e.g. to check the finish. */
  debugCoins(n: number): void {
    this.coins = n - 1;
    this.addCoin(this.px, 0.75, -0.2);
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
    // Lane dashes at the two lane boundaries (road is 3 lanes + 0.3 m margins)
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

function glowTexture(): THREE.Texture {
  return canvasTex(128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,220,120,0.9)');
    grd.addColorStop(0.4, 'rgba(255,190,60,0.35)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
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
