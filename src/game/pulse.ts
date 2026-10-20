import * as THREE from 'three';

/**
 * Pulse Mode visuals, pooled and allocation-free per frame:
 * - flat rings: concentric electric-blue rings racing across the asphalt (the shockwave), or
 *   pulsing out from under the runner's feet on the beat while they surf
 * - a camera-facing ring for the initial sonic impact (HD only)
 * - a pad ring: breathing on the road while the pulse is ready, under the feet while it pulses
 * - bubbles: a pooled burst of carbonation bubbles blown out of the shockwave
 * All share one additive ring shader: a thin white-hot core inside a blue/cyan glow.
 */
const ringVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const bubbleVertex = /* glsl */ `
  attribute float aAge;
  uniform float uScale;
  varying float vAge;
  void main() {
    vAge = aAge;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aAge >= 1.0 ? 0.0 : min(48.0, (0.09 + 0.06 * aAge) * uScale / -mv.z);
  }`;
const bubbleFragment = /* glsl */ `
  varying float vAge;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    // A bubble: bright rim, clear middle, a glint
    float rim = smoothstep(0.62, 0.92, r) * (1.0 - smoothstep(0.92, 1.0, r));
    float glint = smoothstep(0.28, 0.0, length(p - vec2(-0.35, -0.35)));
    float a = (rim * 0.9 + glint) * (1.0 - vAge);
    gl_FragColor = vec4(vec3(0.55, 0.85, 1.0) * a + glint * a, a);
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
  private readonly bubblePts: THREE.Points;
  private readonly bPos: Float32Array;
  private readonly bVel: Float32Array;
  private readonly bAge: Float32Array;
  private readonly bubbleMat: THREE.ShaderMaterial;
  private bubblesAlive = false;
  private lastNow = 0;

  constructor(private readonly lite: boolean) {
    const nb = lite ? 18 : 48;
    this.bPos = new Float32Array(nb * 3);
    this.bVel = new Float32Array(nb * 3);
    this.bAge = new Float32Array(nb).fill(1);
    const bgeo = new THREE.BufferGeometry();
    bgeo.setAttribute('position', new THREE.BufferAttribute(this.bPos, 3).setUsage(THREE.DynamicDrawUsage));
    bgeo.setAttribute('aAge', new THREE.BufferAttribute(this.bAge, 1).setUsage(THREE.DynamicDrawUsage));
    this.bubbleMat = new THREE.ShaderMaterial({
      vertexShader: bubbleVertex,
      fragmentShader: bubbleFragment,
      uniforms: { uScale: { value: 400 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.bubblePts = new THREE.Points(bgeo, this.bubbleMat);
    this.bubblePts.frustumCulled = false;
    this.bubblePts.renderOrder = 9;
    this.group.add(this.bubblePts);
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
  /** Carbonation bubbles blown out of the shockwave from (x, y, z). Reuses the pool. */
  bubbles(now: number, x: number, y: number, z: number): void {
    const n = this.bAge.length;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 6;
      this.bPos[i * 3] = x;
      this.bPos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.6;
      this.bPos[i * 3 + 2] = z;
      this.bVel[i * 3] = Math.cos(a) * sp;
      this.bVel[i * 3 + 1] = 1 + Math.random() * 3;
      this.bVel[i * 3 + 2] = Math.sin(a) * sp;
      this.bAge[i] = Math.random() * 0.15;
    }
    this.bubblesAlive = true;
    this.lastNow = now;
  }

  setPad(mode: 'off' | 'ground' | 'feet'): void {
    this.pad.active = mode !== 'off';
    this.pad.follow = mode === 'feet';
    this.pad.mesh.visible = this.pad.active;
  }

  update(now: number, runner: THREE.Vector3, camera: THREE.Camera, scroll: number): void {
    if (this.bubblesAlive) {
      const dt = Math.min(0.2, Math.max(0, now - this.lastNow));
      let alive = false;
      for (let i = 0; i < this.bAge.length; i++) {
        if (this.bAge[i] >= 1) continue;
        alive = true;
        this.bAge[i] = Math.min(1, this.bAge[i] + dt / 0.9);
        const drag = Math.pow(0.2, dt);
        this.bVel[i * 3] *= drag;
        this.bVel[i * 3 + 1] = this.bVel[i * 3 + 1] * drag + 1.5 * dt; // bubbles rise
        this.bVel[i * 3 + 2] *= drag;
        this.bPos[i * 3] += this.bVel[i * 3] * dt;
        this.bPos[i * 3 + 1] += this.bVel[i * 3 + 1] * dt;
        this.bPos[i * 3 + 2] += this.bVel[i * 3 + 2] * dt + scroll;
      }
      this.bubblesAlive = alive;
      this.bubblePts.geometry.attributes.position.needsUpdate = true;
      this.bubblePts.geometry.attributes.aAge.needsUpdate = true;
      this.bubbleMat.uniforms.uScale.value = window.innerHeight / 2 / Math.tan(THREE.MathUtils.degToRad(((camera as THREE.PerspectiveCamera).fov ?? 60) / 2));
    }
    this.lastNow = now;
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
    this.bAge.fill(1);
    this.bubblePts.geometry.attributes.aAge.needsUpdate = true;
    this.bubblesAlive = false;
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
