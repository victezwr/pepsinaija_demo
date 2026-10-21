import type * as THREE from 'three';
import type { Fizz } from '../scene/fizz';
import type { Droplets } from '../scene/condensation';
import type { Liquid } from '../scene/liquid';

/** Animated values the director tweens; the scene applies them every frame. */
export interface Pose {
  x: number;
  y: number;
  ry: number;
  rz: number;
  sx: number;
  sy: number;
}

export interface Rig {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group; // base pivot (y = 0): position + squash
  spin: THREE.Group; // centre pivot: rotation
  cap: THREE.Mesh;
  capMat: THREE.MeshStandardMaterial;
  label: THREE.Mesh;
  fizz: Fizz;
  drips: Fizz;
  droplets: Droplets | null;
  liquid: Liquid;
  key: THREE.DirectionalLight;
  rimL: THREE.DirectionalLight;
  rimR: THREE.DirectionalLight;
  capFlash: THREE.PointLight;
  glow: THREE.Mesh;
  viewport: { w: number; h: number; halfWidth: number; pxPerWorld: number };
}

export const pose: Pose = { x: 0, y: 0, ry: 0, rz: 0, sx: 1, sy: 1 };
export const cam = { dolly: 1, shake: 0, orbit: 0 };
export const lights = { key: 0, rimL: 0, rimR: 0, env: 0 };
export const ring = { opacity: 0, scale: 0.85, pulse: 0, flash: 0 };
/** DOM nodes the director drives directly (no React re-render per frame). */
export const dom: { ring: HTMLElement | null; ripple: HTMLElement | null } = { ring: null, ripple: null };

let current: Rig | null = null;
export const setRig = (r: Rig): void => {
  current = r;
};
export const getRig = (): Rig | null => current;
