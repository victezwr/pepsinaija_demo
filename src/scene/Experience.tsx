import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as C from '../config';
import { useStore } from '../state/store';
import * as director from '../story/director';
import { getRig, setRig, type Rig } from '../story/rig';
import { rebuildCap } from './cap';
import { applyCondensation, makeCondensation, wetLabel } from './chill';
import { Droplets } from './condensation';
import { Liquid } from './liquid';
import { Fizz } from './fizz';

export function Experience(): null {
  const { scene, camera, gl, size } = useThree();
  const gltf = useLoader(GLTFLoader, C.MODEL_URL, (loader) => {
    const draco = new DRACOLoader();
    draco.setDecoderPath(C.DRACO_PATH);
    draco.setDecoderConfig({ type: 'wasm' });
    loader.setDRACOLoader(draco);
  });

  useLayoutEffect(() => {
    const rig = buildRig(scene, camera as THREE.PerspectiveCamera, gl, gltf.scene, useStore.getState().tier === 'high');
    setRig(rig);
    rig.viewport.w = size.width;
    rig.viewport.h = size.height;
    director.ready();
    return () => {
      rig.root.removeFromParent();
      rig.fizz.points.removeFromParent();
      rig.drips.points.removeFromParent();
      [rig.key, rig.rimL, rig.rimR].forEach((l) => l.removeFromParent());
    };
    // Built once per loaded model.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf]);

  useEffect(() => {
    const rig = getRig();
    if (!rig) return;
    rig.viewport.w = size.width;
    rig.viewport.h = size.height;
  }, [size]);


  useFrame((_, dt) => director.update(Math.min(dt, 1 / 20)));
  return null;
}

function buildRig(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  gl: THREE.WebGLRenderer,
  model: THREE.Object3D,
  withDroplets: boolean,
): Rig {
  scene.background = null;
  const pmrem = new THREE.PMREMGenerator(gl);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffffff, 0);
  key.position.set(-2, 3, 3);
  const rimL = new THREE.DirectionalLight(0x2a6bff, 0);
  rimL.position.set(-3, 1.5, -2);
  const rimR = new THREE.DirectionalLight(0x5fa0ff, 0);
  rimR.position.set(3, 1, -2);
  scene.add(key, rimL, rimR);

  const root = new THREE.Group();
  const spin = new THREE.Group();
  spin.position.y = C.BOTTLE_CENTER_Y;
  model.position.y = -C.BOTTLE_CENTER_Y;
  spin.add(model);
  root.add(spin);
  scene.add(root);

  // Fresh from the fridge (see chill.ts): one condensation set, wrapped round label and plastic
  const cond = makeCondensation(withDroplets ? 1024 : 512);
  const H = C.BOTTLE_HEIGHT;
  let bottleMesh: THREE.Mesh | null = null;
  let cap: THREE.Mesh | null = null;
  let label: THREE.Mesh | null = null;
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mat = o.material as THREE.MeshStandardMaterial;
    if (o.name === 'Bottle') {
      // Clear PET round the liquid: inside faces first, then outside, without depth writes.
      mat.side = THREE.FrontSide;
      mat.depthWrite = false;
      mat.transparent = true;
      mat.roughness = 0.08;
      mat.envMapIntensity = 1.4;
      o.renderOrder = 2;
      const backMat = mat.clone();
      backMat.side = THREE.BackSide;
      applyCondensation(mat, cond, { repeat: 2, height: H, lens: 0, haze: 0.35, cloud: 0.1, pet: true });
      applyCondensation(backMat, cond, { repeat: 2, height: H, lens: 0, haze: 0.15, cloud: 0.04, pet: true });
      const back = new THREE.Mesh(o.geometry, backMat);
      back.renderOrder = 1;
      o.parent?.add(back);
      bottleMesh = o;
    } else if (o.name === 'Cap') {
      cap = o;
    } else if (o.name === 'Label') {
      label = o;
      mat.side = THREE.FrontSide;
      mat.roughness = 0.28;
      const m = withDroplets ? wetLabel(mat) : mat; // wet clear-coat on HD
      applyCondensation(m, cond, { repeat: 2, height: H, lens: 0.003, haze: 0.13, cloud: 0 });
      o.material = m;
    }
  });
  if (!cap || !label) throw new Error('Model is missing Cap or Label');
  const capMesh = cap as THREE.Mesh;
  const labelMesh = label as THREE.Mesh;
  labelMesh.frustumCulled = false;

  // The cola, as its own mesh inside the plastic, so it can slosh
  const liquid = new Liquid((bottleMesh as THREE.Mesh | null)?.geometry ?? labelMesh.geometry, C.FILL_Y, C.FOAM_TOP_Y, withDroplets);
  (bottleMesh as THREE.Mesh | null)?.parent?.add(liquid.mesh);

  rebuildCap(capMesh); // the new yellow cap, clean (see cap.ts)
  const capMat = capMesh.material as THREE.MeshStandardMaterial;

  const capFlash = new THREE.PointLight(0xffc400, 0, 1.2, 2);
  capFlash.position.set(0, 0.45, 0.25);
  spin.add(capFlash);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.1),
    new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.001;
  root.add(glow);

  const fizz = new Fizz(C.PARTICLES.high);
  scene.add(fizz.points);
  // Cola shaken off the bottle as it blows and lifts off (falls under gravity)
  const drips = new Fizz(C.PARTICLES.drips, 0xb8662c, 0.044, { additive: false, gravity: 9, life: 1.4 });
  scene.add(drips.points);

  // Beads sliding down the label (fewer on LITE)
  const droplets = new Droplets(withDroplets ? C.DROPLETS.high : C.DROPLETS.low, 0.3, 0.555);
  labelMesh.parent?.add(droplets.mesh);

  return {
    scene,
    camera,
    root,
    spin,
    cap: capMesh,
    capMat,
    label: labelMesh,
    fizz,
    drips,
    droplets,
    liquid,
    key,
    rimL,
    rimR,
    capFlash,
    glow,
    viewport: { w: 1, h: 1, halfWidth: 0.5, pxPerWorld: 400 },
  };
}

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(40,90,255,0.9)');
    grd.addColorStop(0.35, 'rgba(20,60,255,0.35)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
