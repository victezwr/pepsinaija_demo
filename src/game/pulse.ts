import * as THREE from 'three';

/**
 * Pulse Mode visuals, pooled and allocation-free per frame:
 * - flat rings: concentric electric-blue rings racing across the asphalt (the shockwave), or
 *   pulsing out from under the runner's feet on the beat while they surf
 * - a camera-facing ring for the initial sonic impact (HD only)
 * - a pad ring: breathing on the road while the pulse is ready, under the feet during the surf
 * All share one additive ring shader: a thin white-hot core inside a blue/cyan glow.
 */
const ringVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const ringFragment = /* glsl */ `
  uniform float uRadius;
  uniform float uWidth;
  uniform float uAlpha;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float dist = abs(d - uRadius);
    float glow = smoothstep(uWidth, 0.0, dist);
    float core = smoothstep(uWidth * 0.18, 0.0, dist);
    vec3 col = uColor * glow + vec3(0.85, 0.95, 1.0) * core;
    float a = (glow * 0.85 + core) * uAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(col * a, a);
  }`;

function ringMaterial(color: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: ringVertex,
    fragmentShader: ringFragment,
    uniforms: {
      uRadius: { value: 0 },
      uWidth: { value: 0.05 },
      uAlpha: { value: 0 },
      uColor: { value: new THREE.Color(color) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

interface Ring {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  start: number; // seconds (world time)
  dur: number;
  size: number; // final diameter, metres
  width: number;
  active: boolean;
  follow: boolean; // rides under the runner's feet instead of being painted on the road
}

export class PulseFX {
  readonly group = new THREE.Group();
  private readonly rings: Ring[] = [];
  private readonly impact: Ring;
  private readonly pad: Ring;
  private next = 0;

  constructor(private readonly lite: boolean) {
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < (lite ? 4 : 8); i++) {
      const mat = ringMaterial(i % 2 ? 0x2ee6ff : 0x1f5bff);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 7;
      this.group.add(mesh);
      this.rings.push({ mesh, mat, start: 0, dur: 1, size: 1, width: 0.05, active: false, follow: false });
    }
    const imat = ringMaterial(0x3d7bff);
    const imesh = new THREE.Mesh(geo, imat);
    imesh.visible = false;
    imesh.renderOrder = 8;
    this.group.add(imesh);
    this.impact = { mesh: imesh, mat: imat, start: 0, dur: 0.5, size: 14, width: 0.09, active: false, follow: false };
    const cmat = ringMaterial(0x2ee6ff);
    const cmesh = new THREE.Mesh(geo, cmat);
    cmesh.rotation.x = -Math.PI / 2;
    cmesh.visible = false;
    cmesh.renderOrder = 7;
    this.group.add(cmesh);
    this.pad = { mesh: cmesh, mat: cmat, start: 0, dur: 1, size: 2.4, width: 0.12, active: false, follow: false };
  }

  /** Concentric rings racing out across the road from (x, z). */
  shockwave(now: number, x: number, z: number, maxDiameter: number, count: number, dur: number): void {
    const n = this.lite ? Math.min(2, count) : count;
    for (let i = 0; i < n; i++) this.ring(now + i * 0.09, x, z, maxDiameter * (1 - i * 0.12), dur, 0.05, false);
  }

  /** The surf's beat: a ring pulsing out from under the runner's feet. */
  beat(now: number): void {
    this.ring(now, 0, 0, 5.5, 0.55, 0.08, true);
  }

  /** The sonic impact: a ring facing the camera, bursting out from the runner. */
  burst(now: number, at: THREE.Vector3): void {
    if (this.lite) return;
    const r = this.impact;
    r.active = true;
    r.start = now;
    r.mesh.position.copy(at);
    r.mesh.visible = true;
  }

  /** Pad ring: 'ground' while charged (on the road), 'feet' during the surf, or off. */
  setPad(mode: 'off' | 'ground' | 'feet'): void {
    this.pad.active = mode !== 'off';
    this.pad.follow = mode === 'feet';
    this.pad.mesh.visible = this.pad.active;
  }

  update(now: number, runner: THREE.Vector3, camera: THREE.Camera, scroll: number): void {
    for (const r of this.rings) {
      if (!r.active) continue;
      if (r.follow) r.mesh.position.set(runner.x, runner.y + 0.02, runner.z);
      else r.mesh.position.z += scroll; // shockwave rings are painted on the road: they travel with it
      const t = (now - r.start) / r.dur;
      if (t < 0) {
        r.mesh.visible = false;
        continue;
      }
      if (t >= 1) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      r.mesh.visible = true;
      const e = 1 - Math.pow(1 - t, 3); // fast out, settling
      r.mesh.scale.setScalar(r.size);
      r.mat.uniforms.uRadius.value = 0.04 + e * 0.92;
      r.mat.uniforms.uWidth.value = r.width * (1 + t);
      r.mat.uniforms.uAlpha.value = (1 - t) * (1 - t);
    }
    const im = this.impact;
    if (im.active) {
      const t = (now - im.start) / im.dur;
      if (t >= 1) {
        im.active = false;
        im.mesh.visible = false;
      } else {
        im.mesh.quaternion.copy(camera.quaternion);
        im.mesh.position.set(runner.x, runner.y + 1, runner.z);
        im.mesh.scale.setScalar(im.size);
        im.mat.uniforms.uRadius.value = 0.05 + (1 - Math.pow(1 - t, 3)) * 0.9;
        im.mat.uniforms.uWidth.value = 0.08;
        im.mat.uniforms.uAlpha.value = 1 - t;
      }
    }
    const pad = this.pad;
    if (pad.active) {
      // Breathing ring: on the road when the pulse is ready, the surfboard of light during the surf
      const p = 0.5 + 0.5 * Math.sin(now * (pad.follow ? 12 : 6));
      pad.mesh.position.set(runner.x, pad.follow ? runner.y + 0.02 : 0.04, runner.z);
      pad.mesh.scale.setScalar(pad.size);
      pad.mat.uniforms.uRadius.value = (pad.follow ? 0.45 : 0.55) + p * 0.3;
      pad.mat.uniforms.uWidth.value = pad.follow ? 0.16 : 0.1;
      pad.mat.uniforms.uAlpha.value = 0.45 + p * 0.4;
    }
  }

  clear(): void {
    for (const r of this.rings) {
      r.active = false;
      r.mesh.visible = false;
    }
    this.impact.active = false;
    this.impact.mesh.visible = false;
    this.setPad('off');
  }

  private ring(start: number, x: number, z: number, size: number, dur: number, width: number, follow: boolean): void {
    const r = this.rings[this.next];
    this.next = (this.next + 1) % this.rings.length;
    r.active = true;
    r.start = start;
    r.dur = dur;
    r.size = size;
    r.width = width;
    r.follow = follow;
    r.mesh.position.set(x, 0.06, z);
    r.mesh.visible = false;
  }
}
