import * as THREE from 'three';
import { LABEL_RADIUS, PEEL_CURL_END, PEEL_CURL_START } from '../config';

/**
 * Authored peel: the label is a thin cylinder; progress p (0..1) lifts it from its u = 0 seam.
 * Lifted strip leaves the surface tangentially and curls outward with tightening curvature,
 * so a full peel ends as a rolled-up tube. Vertices are addressed by UV, not index order
 * (Draco reorders vertices).
 */
export class LabelPeel {
  private readonly pos: THREE.BufferAttribute;
  private readonly u: Float32Array;
  private readonly y: Float32Array;
  private readonly seamAngle: number;
  private readonly circumference = 2 * Math.PI * LABEL_RADIUS;
  progress = 0;

  constructor(private readonly geometry: THREE.BufferGeometry) {
    this.pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
    const n = this.pos.count;
    this.u = new Float32Array(n);
    this.y = new Float32Array(n);
    let ref = 0;
    for (let i = 0; i < n; i++) {
      this.u[i] = uv.getX(i);
      this.y[i] = this.pos.getY(i);
      if (Math.abs(this.u[i] - 0.5) < Math.abs(this.u[ref] - 0.5)) ref = i;
    }
    // angle(u) = seamAngle + u·2π, matching how tools/fix-model.mjs built the cylinder
    this.seamAngle = Math.atan2(this.pos.getX(ref), this.pos.getZ(ref)) - this.u[ref] * 2 * Math.PI;
    this.pos.setUsage(THREE.DynamicDrawUsage);
  }

  set(p: number): void {
    this.progress = p;
    const C = this.circumference;
    const R = LABEL_RADIUS;
    const L = Math.max(0, p) * C * 1.02;
    const leave = this.seamAngle + (Math.min(L, C) / C) * 2 * Math.PI;
    const sL = Math.sin(leave);
    const cL = Math.cos(leave);
    const k = PEEL_CURL_START + (PEEL_CURL_END - PEEL_CURL_START) * Math.min(1, p);
    for (let i = 0; i < this.u.length; i++) {
      const d = this.u[i] * C;
      if (d >= L) {
        const th = this.seamAngle + this.u[i] * 2 * Math.PI;
        this.pos.setXYZ(i, R * Math.sin(th), this.y[i], R * Math.cos(th));
      } else {
        const t = L - d;
        const phi = t * k;
        const a = Math.sin(phi) / k; // along tangent (towards decreasing angle)
        const b = (1 - Math.cos(phi)) / k; // outward
        const r = R + b;
        this.pos.setXYZ(i, r * sL - a * cL, this.y[i], r * cL + a * sL);
      }
    }
    this.pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }
}
