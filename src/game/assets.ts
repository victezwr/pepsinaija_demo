import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACO_PATH, MODEL_URL } from '../config';
import type { PropName } from './gameConfig';

export interface CharacterAsset {
  scene: THREE.Group;
  clips: Record<string, THREE.AnimationClip>;
}

export interface GameAssets {
  male: CharacterAsset;
  female: CharacterAsset;
  agbero: CharacterAsset;
  props: Record<PropName, THREE.Group>;
  bottle: THREE.Group;
}

const PROPS: PropName[] = [
  'danfo',
  'keke',
  'okada',
  'barrier-low',
  'vendor-table',
  'banner',
  'building-1',
  'building-2',
  'building-3',
  'pole',
  'tower',
];

/** Trim windows (seconds) cut from Tripo's longer clips; see context/progress-tracker.md. */
const TRIMS: Record<string, [number, number]> = {
  jump: [0.95, 1.95],
  duck: [0.86, 0.98], // the deep crouch before the jump, held as a duck
  stumble: [0.3, 2.1],
  fall: [0.3, 2.6],
};

let pending: Promise<GameAssets> | null = null;

function loader(): GLTFLoader {
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_PATH);
  draco.setDecoderConfig({ type: 'wasm' });
  return new GLTFLoader().setDRACOLoader(draco);
}

function character(gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }): CharacterAsset {
  const clips: Record<string, THREE.AnimationClip> = {};
  for (const c of gltf.animations) clips[c.name] = c;
  for (const [name, [from, to]] of Object.entries(TRIMS)) {
    const src = clips[name === 'duck' ? 'jump' : name];
    if (src) clips[name] = THREE.AnimationUtils.subclip(src, name, Math.round(from * 30), Math.round(to * 30), 30);
  }
  gltf.scene.traverse((o) => {
    if (o instanceof THREE.Mesh) o.frustumCulled = false; // skinned bounds don't follow the animation
  });
  return { scene: gltf.scene, clips };
}

/** Starts (once) and returns the game download. Safe to call early to warm the cache. */
export function loadGameAssets(): Promise<GameAssets> {
  if (pending) return pending;
  const l = loader();
  const get = (url: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> => l.loadAsync(url);
  pending = (async () => {
    const [male, female, agbero, bottle, ...props] = await Promise.all([
      get('/game/runner-male.glb'),
      get('/game/runner-female.glb'),
      get('/game/agbero.glb'),
      get(MODEL_URL),
      ...PROPS.map((p) => get(`/game/${p}.glb`)),
    ]);
    const propMap = {} as Record<PropName, THREE.Group>;
    PROPS.forEach((p, i) => {
      propMap[p] = props[i].scene;
    });
    return {
      male: character(male),
      female: character(female),
      agbero: character(agbero),
      props: propMap,
      bottle: bottle.scene,
    };
  })();
  pending.catch(() => {
    pending = null; // allow a retry
  });
  return pending;
}
