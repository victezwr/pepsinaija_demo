import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as C from '../config';
import { shake } from '../input/shake';
import { useStore } from '../state/store';
import * as director from '../story/director';
import { getRig, setRig, type Rig } from '../story/rig';
import { Droplets, dropletNormalMap } from './condensation';
import { Fizz } from './fizz';
import { LabelPeel } from './labelPeel';

export function Experience(): null {
  const { scene, camera, gl, size } = useThree();
  const tier = useStore((s) => s.tier);
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
    shake.setViewport(size.width, size.height);
    director.ready();
    return () => {
      rig.root.removeFromParent();
      rig.fizz.points.removeFromParent();
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
    shake.setViewport(size.width, size.height);
  }, [size]);

  useEffect(() => {
    const rig = getRig();
    if (tier === 'low' && rig?.droplets) {
      rig.droplets.mesh.removeFromParent();
      rig.droplets = null;
    }
  }, [tier]);

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

  const drops = dropletNormalMap();
  let cap: THREE.Mesh | null = null;
  let label: THREE.Mesh | null = null;
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mat = o.material as THREE.MeshStandardMaterial;
    if (o.name === 'Bottle') {
      // Translucent PET: draw inside faces first, then outside, without depth writes.
      mat.side = THREE.FrontSide;
      mat.depthWrite = false;
      mat.roughness = 0.1;
      mat.envMapIntensity = 1.2;
      mat.normalMap = drops;
      mat.normalScale.set(0.3, 0.3);
      o.renderOrder = 2;
      const backMat = mat.clone();
      backMat.side = THREE.BackSide;
      const back = new THREE.Mesh(o.geometry, backMat);
      back.renderOrder = 1;
      o.parent?.add(back);
    } else if (o.name === 'Cap') {
      cap = o;
    } else if (o.name === 'Label') {
      label = o;
      // Front prints the artwork; the back is plain label stock, so the peel never shows a mirrored logo.
      mat.side = THREE.FrontSide;
      const back = new THREE.Mesh(o.geometry, new THREE.MeshStandardMaterial({ color: 0xe4e9f2, roughness: 0.55, side: THREE.BackSide }));
      back.frustumCulled = false;
      o.add(back);
      mat.roughness = 0.28;
      const ln = drops.clone();
      ln.repeat.set(4, 1.4);
      ln.needsUpdate = true;
      mat.normalMap = ln;
      mat.normalScale.set(0.45, 0.45);
    }
  });
  if (!cap || !label) throw new Error('Model is missing Cap or Label');
  const capMesh = cap as THREE.Mesh;
  const labelMesh = label as THREE.Mesh;
  labelMesh.frustumCulled = false;

  const capMat = capMesh.material as THREE.MeshStandardMaterial;
  const yellowMap = capMat.map as THREE.Texture;
  const blueMap = makeBlueCap(yellowMap);
  capMat.map = blueMap;
  capMat.roughness = 0.4;

  const nozzle = new THREE.Object3D();
  nozzle.position.set(0, 0.9, 0);
  (labelMesh.parent ?? model).add(nozzle);

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

  let droplets: Droplets | null = null;
  if (withDroplets) {
    droplets = new Droplets(C.DROPLETS.high, 0.3, 0.555);
    labelMesh.parent?.add(droplets.mesh);
  }

  return {
    scene,
    camera,
    root,
    spin,
    cap: capMesh,
    capParent: capMesh.parent ?? model,
    nozzle,
    capMat,
    yellowMap,
    blueMap,
    label: labelMesh,
    labelParent: labelMesh.parent ?? model,
    peel: new LabelPeel(labelMesh.geometry),
    fizz,
    droplets,
    key,
    rimL,
    rimR,
    capFlash,
    glow,
    viewport: { w: 1, h: 1, halfWidth: 0.5, pxPerWorld: 400 },
  };
}

/** The old blue cap, derived from the yellow texture so shape and shading match exactly. */
function makeBlueCap(yellow: THREE.Texture): THREE.Texture {
  const img = yellow.image as CanvasImageSource & { width: number; height: number };
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  if (!g) return yellow;
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gr = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, gr, b);
    const sat = mx ? (mx - Math.min(r, gr, b)) / mx : 0;
    if (sat > 0.35 && r > gr * 0.7 && b < gr * 0.75) {
      const l = mx / 255;
      const hi = Math.max(0, l - 0.85) * 4; // keep specular highlights bright
      d[i] = Math.min(255, 18 * l + 200 * hi);
      d[i + 1] = Math.min(255, 52 * l + 200 * hi);
      d[i + 2] = Math.min(255, 215 * l + 120 * hi);
    }
  }
  g.putImageData(data, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.flipY = yellow.flipY;
  t.colorSpace = yellow.colorSpace;
  t.channel = yellow.channel;
  return t;
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
