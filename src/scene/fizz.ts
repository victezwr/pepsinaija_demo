import * as THREE from 'three';

/** One Points object; particles are recycled. Positions are in world space. */
export class Fizz {
  readonly points: THREE.Points;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly geo: THREE.BufferGeometry;
  private next = 0;

  constructor(private readonly max: number) {
    this.pos = new Float32Array(max * 3).fill(-999);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.PointsMaterial({
      color: 0xfff3e2, // pale cola foam
      size: 0.032,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      map: dotTexture(),
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  /** Spray from origin, mostly along dir, inside a cone. */
  emit(count: number, origin: THREE.Vector3, dir: THREE.Vector3, speed: number, spread: number): void {
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      this.pos[i * 3] = origin.x;
      this.pos[i * 3 + 1] = origin.y;
      this.pos[i * 3 + 2] = origin.z;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.vel[i * 3] = (dir.x + (Math.random() - 0.5) * spread) * s;
      this.vel[i * 3 + 1] = (dir.y + (Math.random() - 0.5) * spread * 0.5) * s;
      this.vel[i * 3 + 2] = (dir.z + (Math.random() - 0.5) * spread) * s;
      this.life[i] = 0.5 + Math.random() * 0.8;
    }
  }

  update(dt: number): void {
    let alive = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      alive = true;
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= 3.2 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.life[i] <= 0) this.pos[i * 3 + 1] = -999;
    }
    if (alive) (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  clear(): void {
    this.life.fill(0);
    this.pos.fill(-999);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}

function dotTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  if (g) {
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
