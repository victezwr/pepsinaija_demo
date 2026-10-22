import * as THREE from 'three';

/**
 * The cola inside the intro bottle. A copy of the bottle's shape, a little smaller, cut off by a
 * surface that stays level with the world (so it moves when the bottle tips) and sloshes on a
 * damped spring when the bottle is shaken, spun hard, tipped or the phone moves.
 * The fizz is separate from the slosh (the director builds it up only under sustained shaking):
 * `fizz` clouds the cola with tiny bubbles and thickens the bubbly band under the surface, `foam`
 * raises a head of foam up to the cap. As in real shaken soda the foam fills the bottle wall to
 * wall, settles level (it barely sloshes) and is made of bubbles, coarse low down, fine on top.
 *
 * Technique as in game liquid shaders (Half-Life: Alyx style): world-space clip plane +
 * back faces drawn as the liquid's top surface.
 */
const vertex = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vObj;
  varying vec3 vNormalW;
  void main() {
    vObj = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const fragment = /* glsl */ `
  uniform vec3 uPlaneN;   // cola surface normal (world): up, tipped by the slosh / phone tilt
  uniform vec3 uUp;       // level "up" (world, no slosh): the foam settles level, like real foam
  uniform vec3 uPlaneP;   // a point on the surface (world)
  uniform float uTime;
  uniform float uAgit;    // fizz: 0 flat .. 1 about to blow
  uniform float uFoam;    // the head of foam above the surface, 0 none .. 1 up to the cap
  uniform float uFoamTop; // height (world, along up) from the surface to the cap
  uniform vec3 uKeyDir;   // key light (world, towards the light)
  uniform float uLight;   // overall light level (the intro fades in from the dark)
  uniform float uBubbles; // 0 on slow phones' lite tier is still fine; 1 = full
  varying vec3 vWorld;
  varying vec3 vObj;
  varying vec3 vNormalW;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 19.19)); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  // Foam cells: distance to the nearest and second-nearest bubble centre (Worley)
  vec2 cells(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float d1 = 8.0, d2 = 8.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash2(i + g) * 0.8 + 0.1;
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    return vec2(d1, d2);
  }

  // Shaken cola foam: wall-to-wall, made of bubbles (bigger low down, creamy fine at the top),
  // pale tan, lit softly from inside (foam scatters light)
  vec3 foamColor(float rise, float ang, vec3 N, vec3 V, bool top) {
    float scale = mix(70.0, 150.0, rise); // bubbles per unit: coarse at the bottom, fine at the top
    vec2 uv = vec2(ang * 0.135 * scale, vObj.y * scale);
    vec2 c = cells(uv + vec2(0.0, -uTime * 0.25));
    float rim = smoothstep(0.0, 0.12, c.y - c.x); // dark film between bubbles
    vec3 base = mix(vec3(0.50, 0.33, 0.19), vec3(0.86, 0.74, 0.58), smoothstep(0.0, 0.7, rise));
    vec3 col = base * (0.72 + 0.28 * rim);
    col += vec3(1.0, 0.95, 0.88) * smoothstep(0.16, 0.0, c.x) * 0.22; // each bubble's highlight
    float wrap = max(dot(N, uKeyDir) * 0.5 + 0.5, 0.0);
    col *= 0.62 + 0.45 * wrap;
    if (top) col *= 1.08;
    return col;
  }

  void main() {
    float hS = dot(vWorld - uPlaneP, uPlaneN); // above (>0) / below the sloshing cola surface
    float hL = dot(vWorld - uPlaneP, uUp);     // height above the resting level
    float ang = atan(vObj.z, vObj.x);
    // The foam head's top: level, its edge broken up by bubbles (no smooth waves)
    float rough = (noise(vec2(ang * 9.0, uTime * 0.6)) - 0.5) * 0.06 + (noise(vec2(ang * 31.0, uTime)) - 0.5) * 0.025;
    float foamTop = uFoam * uFoamTop * (1.0 + rough);
    float foamLen = max(foamTop, 1e-4);
    if (hS > 0.0 && (uFoam < 0.001 || hL > foamTop)) discard;
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 N = normalize(vNormalW);
    vec3 col;
    if (hS > 0.0) {
      // In the foam head
      float rise = clamp(hL / foamLen, 0.0, 1.0);
      col = foamColor(rise, ang, gl_FrontFacing ? N : -N, V, !gl_FrontFacing);
    } else if (gl_FrontFacing) {
      vec3 cola = vec3(0.018, 0.004, 0.002); // Pepsi: near-black, red-brown only where light gets through
      // The body: near-black cola, amber where light passes through thin edges, a soft sheen
      float fres = pow(1.0 - max(dot(N, V), 0.0), 2.0);
      float through = pow(max(dot(-V, uKeyDir) * 0.5 + 0.5, 0.0), 3.0);
      col = cola + vec3(0.32, 0.07, 0.02) * fres * (0.25 + through * 0.75) + vec3(0.1, 0.025, 0.01) * max(dot(N, uKeyDir), 0.0) * 0.2;
      // Shaken: countless tiny bubbles held in the cola cloud it to a murky brown
      col += vec3(0.05, 0.02, 0.008) * uAgit;
      vec3 R = reflect(-V, N);
      col += vec3(1.0) * pow(max(dot(R, uKeyDir), 0.0), 60.0) * 0.6;
      // Bubbles rising (cylindrical cells), more and faster as the fizz builds
      if (uBubbles > 0.0) {
        float speed = 0.05 + uAgit * 0.35;
        vec2 cell = vec2(ang * 9.0, vObj.y * 55.0 - uTime * speed * 55.0);
        vec2 id = floor(cell);
        vec2 f = fract(cell) - 0.5;
        float on = step(hash(id), 0.02 + uAgit * 0.45);
        vec2 off = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
        float r = 0.06 + 0.1 * hash(id + 1.3) * (0.5 + uAgit);
        vec2 q = f - off * 0.5;
        // A bubble in dark cola: a soft amber body and a bright glint on its upper side
        float body = smoothstep(r, r * 0.4, length(q));
        float glint = smoothstep(r * 0.45, 0.0, length(q - vec2(-0.3, 0.35) * r));
        col += (vec3(0.35, 0.16, 0.08) * body * 0.5 + vec3(1.0, 0.9, 0.8) * glint * 0.7) * on * uBubbles;
      }
      // Under the foam (or the surface): a band where bubbles crowd up, blending into the foam
      float band = 0.002 + uAgit * 0.01 + uFoam * 0.01;
      float into = smoothstep(-band, 0.0, hS);
      vec3 froth = foamColor(0.0, ang, N, V, false);
      col = mix(col, froth, into * into * clamp(0.3 + uAgit * 0.3 + uFoam * 0.4, 0.0, 0.95));
    } else {
      // Seen through the open top: the surface itself (foamy as the fizz builds)
      col = mix(vec3(0.22, 0.09, 0.05), vec3(0.8, 0.66, 0.5), 0.25 + uAgit * 0.6);
    }
    gl_FragColor = vec4(col * uLight, 1.0);
    #include <colorspace_fragment>
  }`;

/** The slosh's natural frequency (rad/s): about 2 Hz. */
const OMEGA = Math.sqrt(160);

export class Liquid {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  /** Slosh state: tilt of the surface (x, z) and its velocity. */
  private readonly w = new THREE.Vector2();
  private readonly wv = new THREE.Vector2();
  /** World "up" for the surface: straight up, or the phone's gravity on Android. */
  readonly up = new THREE.Vector3(0, 1, 0);
  /** The fizz: 0 flat .. 1 about to blow (bubbles, foam line). Set by the director. */
  fizz = 0;
  /** The head of foam above the surface: 0 none .. 1 up to the cap. Set by the director. */
  foam = 0;
  /** Kicks since the director last asked (how hard it is being shaken, not how it rings on). */
  private kicks = 0;
  private readonly tmp = new THREE.Vector3();
  private readonly n = new THREE.Vector3();

  constructor(
    geometry: THREE.BufferGeometry,
    private readonly fillY: number,
    private readonly topY: number,
    bubbles: boolean,
  ) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      side: THREE.DoubleSide,
      uniforms: {
        uPlaneN: { value: new THREE.Vector3(0, 1, 0) },
        uUp: { value: new THREE.Vector3(0, 1, 0) },
        uPlaneP: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uAgit: { value: 0 },
        uFoam: { value: 0 },
        uFoamTop: { value: 0.1 },
        uKeyDir: { value: new THREE.Vector3(-2, 3, 3).normalize() },
        uLight: { value: 1 },
        uBubbles: { value: bubbles ? 1 : 0 },
      },
    });
    this.mesh = new THREE.Mesh(geometry, this.mat);
    // Just inside the plastic (the foam has to reach the walls, as real foam does)
    this.mesh.scale.set(0.975, 0.985, 0.975);
    this.mesh.position.y = 0.006;
    this.mesh.renderOrder = 0;
  }

  /** A kick to the liquid (world-space, roughly in surface-tilt units per second). */
  push(x: number, z: number): void {
    this.wv.x += x;
    this.wv.y += z;
    this.kicks += Math.abs(x) + Math.abs(z);
  }

  /** The kicks since the last call (and reset). */
  takeKicks(): number {
    const k = this.kicks;
    this.kicks = 0;
    return k;
  }

  /** How hard it is sloshing right now (surface tilt amplitude, 0 still .. ~0.6). */
  get slosh(): number {
    return Math.hypot(this.w.x, this.w.y, this.wv.x / OMEGA, this.wv.y / OMEGA);
  }

  update(dt: number, time: number, light: number): void {
    // Damped spring (~2 Hz slosh, settles in ~2 s)
    const k = OMEGA * OMEGA;
    const c = 3.2;
    this.wv.x += (-k * this.w.x - c * this.wv.x) * dt;
    this.wv.y += (-k * this.w.y - c * this.wv.y) * dt;
    this.w.x = THREE.MathUtils.clamp(this.w.x + this.wv.x * dt, -0.6, 0.6);
    this.w.y = THREE.MathUtils.clamp(this.w.y + this.wv.y * dt, -0.6, 0.6);
    const u = this.mat.uniforms;
    // Foam is thick: the more of it, the less the surface sloshes
    const free = 1 - 0.8 * this.foam;
    this.n.copy(this.up).add(this.tmp.set(this.w.x * free, 0, this.w.y * free)).normalize();
    (u.uPlaneN.value as THREE.Vector3).copy(this.n);
    (u.uUp.value as THREE.Vector3).copy(this.up).normalize();
    // The surface passes through the bottle's axis at the fill height
    this.mesh.parent?.localToWorld((u.uPlaneP.value as THREE.Vector3).set(0, this.fillY, 0));
    this.mesh.parent?.localToWorld(this.tmp.set(0, this.topY, 0));
    u.uFoamTop.value = this.tmp.sub(u.uPlaneP.value as THREE.Vector3).dot(u.uUp.value as THREE.Vector3);
    u.uTime.value = time;
    u.uAgit.value = this.fizz;
    u.uFoam.value = this.foam;
    u.uLight.value = light;
  }
}
