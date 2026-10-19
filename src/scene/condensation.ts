import * as THREE from 'three';
import { LABEL_RADIUS } from '../config';

/** Tangent-space normal map of scattered water beads, generated once on a canvas. */
export function dropletNormalMap(size = 512, count = 420): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  if (!g) return tex;
  const img = g.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 128;
    d[i + 1] = 128;
    d[i + 2] = 255;
    d[i + 3] = 255;
  }
  for (let n = 0; n < count; n++) {
    const r = 1.5 + Math.pow(Math.random(), 3) * 9;
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const ry = r * (1 + Math.random() * 0.35); // beads sag slightly
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const nx = (x - cx) / r;
        const ny = (y - cy) / ry;
        const q = nx * nx + ny * ny;
        if (q >= 1) continue;
        const nz = Math.sqrt(1 - q);
        const px = ((y + size) % size) * size + ((x + size) % size);
        d[px * 4] = 128 + nx * 127;
        d[px * 4 + 1] = 128 - ny * 127;
        d[px * 4 + 2] = 128 + nz * 127;
      }
    }
  }
  g.putImageData(img, 0, 0);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** A handful of beads that slowly slide down the front of the label (High tier only). */
export class Droplets {
  readonly mesh: THREE.InstancedMesh;
  private readonly angle: Float32Array;
  private readonly yPos: Float32Array;
  private readonly speed: Float32Array;
  private readonly size: Float32Array;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(private readonly count: number, private readonly yMin: number, private readonly yMax: number) {
    const geo = new THREE.SphereGeometry(1, 10, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.02,
      metalness: 0,
      transparent: true,
      opacity: 0.45,
      envMapIntensity: 2.5,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.renderOrder = 4;
    this.angle = new Float32Array(count);
    this.yPos = new Float32Array(count);
    this.speed = new Float32Array(count);
    this.size = new Float32Array(count);
    for (let i = 0; i < count; i++) this.respawn(i, true);
  }

  private respawn(i: number, anywhere: boolean): void {
    this.angle[i] = (Math.random() - 0.5) * 2.4; // front hemisphere
    this.yPos[i] = anywhere ? this.yMin + Math.random() * (this.yMax - this.yMin) : this.yMax;
    this.speed[i] = 0;
    this.size[i] = 0.0035 + Math.random() * 0.004;
  }

  update(dt: number): void {
    for (let i = 0; i < this.count; i++) {
      // stick-slip: mostly still, occasionally sliding
      if (Math.random() < dt * 0.25) this.speed[i] = 0.02 + Math.random() * 0.05;
      this.speed[i] *= Math.pow(0.35, dt);
      this.yPos[i] -= this.speed[i] * dt;
      if (this.yPos[i] < this.yMin) this.respawn(i, false);
      const a = this.angle[i];
      const r = LABEL_RADIUS + this.size[i] * 0.4;
      this.v.set(Math.sin(a) * r, this.yPos[i], Math.cos(a) * r);
      this.q.setFromAxisAngle(this.up, a);
      const sz = this.size[i];
      this.s.set(sz, sz * (1.25 + this.speed[i] * 8), sz * 0.55);
      this.m.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
