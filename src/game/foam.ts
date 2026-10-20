import * as THREE from 'three';

/**
 * Soft cola foam for the Pulse surf: round, blurry puffs that swell, drift and fade, so the
 * runner rides a frothing geyser instead of a shower of sparks. One Points draw call with a
 * small shader (per-particle size, age and tint).
 */
export class FoamTrail {
  readonly points: THREE.Points;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly age: Float32Array; // 0..1, ≥1 = dead
  private readonly life: Float32Array;
  private readonly size: Float32Array;
  private readonly tint: Float32Array;
  private readonly geo = new THREE.BufferGeometry();
  private readonly mat: THREE.ShaderMaterial;
  private next = 0;

  constructor(private readonly max: number) {
    this.pos = new Float32Array(max * 3).fill(-999);
    this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max).fill(1);
    this.life = new Float32Array(max).fill(1);
    this.size = new Float32Array(max);
    this.tint = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAge', new THREE.BufferAttribute(this.age, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aTint', new THREE.BufferAttribute(this.tint, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uScale: { value: 400 } },
      vertexShader: /* glsl */ `
        attribute float aAge;
        attribute float aSize;
        attribute float aTint;
        uniform float uScale;
        varying float vAge;
        varying float vTint;
        void main() {
          vAge = aAge;
          vTint = aTint;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float grow = 0.55 + 0.9 * sqrt(clamp(aAge, 0.0, 1.0));
          gl_PointSize = aAge >= 1.0 ? 0.0 : min(140.0, aSize * grow * uScale / -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        varying float vAge;
        varying float vTint;
        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float r = dot(p, p);
          if (r > 1.0) discard;
          // soft puff with a brighter, bubbly core
          float body = smoothstep(1.0, 0.15, r);
          float core = smoothstep(0.5, 0.0, r) * 0.35;
          vec3 foam = vec3(0.98, 0.96, 0.92);
          vec3 cola = vec3(0.62, 0.42, 0.26);
          vec3 blue = vec3(0.45, 0.62, 1.0);
          vec3 c = mix(mix(foam, cola, smoothstep(0.55, 1.0, vTint)), blue, smoothstep(0.35, 0.0, vTint) * 0.6);
          float fade = (1.0 - smoothstep(0.55, 1.0, vAge)) * smoothstep(0.0, 0.08, vAge);
          gl_FragColor = vec4(c + core, (body * 0.8 + core) * fade);
        }`,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }

  /** Perspective scale for point sizes; call when the camera or viewport changes. */
  setScale(viewportHeight: number, fovDeg: number): void {
    this.mat.uniforms.uScale.value = viewportHeight / 2 / Math.tan(THREE.MathUtils.degToRad(fovDeg / 2));
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, life: number): void {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.age[i] = 0;
    this.life[i] = life;
    this.size[i] = size;
    this.tint[i] = Math.random();
  }

  /** `scroll` moves foam with the road so the spray stays where it landed. */
  update(dt: number, scroll: number): void {
    let alive = false;
    for (let i = 0; i < this.max; i++) {
      if (this.age[i] >= 1) continue;
      alive = true;
      this.age[i] = Math.min(1, this.age[i] + dt / this.life[i]);
      const drag = Math.pow(0.25, dt);
      this.vel[i * 3] *= drag;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * drag - 1.2 * dt;
      this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] = Math.max(0.05, this.pos[i * 3 + 1] + this.vel[i * 3 + 1] * dt);
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt + scroll;
    }
    if (!alive) return;
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAge.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aTint.needsUpdate = true;
  }

  clear(): void {
    this.age.fill(1);
    this.geo.attributes.aAge.needsUpdate = true;
  }
}
