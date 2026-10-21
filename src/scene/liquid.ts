import * as THREE from 'three';

/**
 * The cola inside the intro bottle. A copy of the bottle's shape, a little smaller, cut off by a
 * surface that stays level with the world (so it moves when the bottle tips) and sloshes on a
 * damped spring when the bottle is shaken, spun hard, tipped or the phone moves.
 * The fizz is separate from the slosh (the director builds it up only under sustained shaking):
 * `fizz` sets the bubbles and the foam line, `foam` raises a head of foam up the neck.
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
  uniform vec3 uPlaneN;   // surface normal (world): up, tipped by the slosh / phone tilt
  uniform vec3 uPlaneP;   // a point on the surface (world)
  uniform float uTime;
  uniform float uAgit;    // fizz: 0 flat .. 1 about to blow
  uniform float uFoam;    // the head of foam above the surface, 0 none .. 1 up to the cap
  uniform float uFoamTop; // distance (world) from the surface to the cap
  uniform vec3 uKeyDir;   // key light (world, towards the light)
  uniform float uLight;   // overall light level (the intro fades in from the dark)
  uniform float uBubbles; // 0 on slow phones' lite tier is still fine; 1 = full
  varying vec3 vWorld;
  varying vec3 vObj;
  varying vec3 vNormalW;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    float h = dot(vWorld - uPlaneP, uPlaneN);
    // The foam head: a rough, bubbly top edge that climbs to the cap as the pressure builds
    float ang = atan(vObj.z, vObj.x);
    float foamEdge = uFoam * uFoamTop * (1.0 + 0.06 * sin(ang * 7.0 + uTime * 3.0) + 0.04 * sin(ang * 13.0 - uTime * 5.0));
    if (h > foamEdge) discard;
    if (h > 0.0) {
      float g = hash(floor(vec2(ang * 60.0, vObj.y * 420.0 - uTime * 6.0)));
      float g2 = hash(floor(vec2(ang * 24.0, vObj.y * 160.0 + uTime * 2.0)));
      vec3 foamCol = vec3(0.78, 0.62, 0.45) * (0.72 + 0.28 * g) + vec3(0.08) * step(0.86, g2);
      foamCol *= mix(0.75, 1.0, smoothstep(0.0, foamEdge + 1e-4, h)); // denser, browner low down
      if (!gl_FrontFacing) foamCol *= 0.85;
      gl_FragColor = vec4(foamCol * uLight, 1.0);
      #include <colorspace_fragment>
      return;
    }
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 N = normalize(vNormalW);
    vec3 cola = vec3(0.018, 0.004, 0.002); // Pepsi: near-black, red-brown only where light gets through
    vec3 col;
    if (gl_FrontFacing) {
      // The body: near-black cola, amber where light passes through thin edges, a soft sheen
      float fres = pow(1.0 - max(dot(N, V), 0.0), 2.0);
      float through = pow(max(dot(-V, uKeyDir) * 0.5 + 0.5, 0.0), 3.0);
      col = cola + vec3(0.32, 0.07, 0.02) * fres * (0.25 + through * 0.75) + vec3(0.1, 0.025, 0.01) * max(dot(N, uKeyDir), 0.0) * 0.2;
      vec3 R = reflect(-V, N);
      col += vec3(1.0) * pow(max(dot(R, uKeyDir), 0.0), 60.0) * 0.6;
      // Bubbles rising (cylindrical cells), more and faster when shaken
      if (uBubbles > 0.0) {
        float a = ang;
        float speed = 0.05 + uAgit * 0.35;
        vec2 cell = vec2(a * 9.0, vObj.y * 55.0 - uTime * speed * 55.0);
        vec2 id = floor(cell);
        vec2 f = fract(cell) - 0.5;
        float rnd = hash(id);
        float on = step(rnd, 0.02 + uAgit * 0.45);
        vec2 off = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
        float r = 0.06 + 0.1 * hash(id + 1.3) * (0.5 + uAgit);
        vec2 q = f - off * 0.5;
        // A bubble in dark cola: a soft amber body and a bright glint on its upper side
        float body = smoothstep(r, r * 0.4, length(q));
        float glint = smoothstep(r * 0.45, 0.0, length(q - vec2(-0.3, 0.35) * r));
        col += (vec3(0.35, 0.16, 0.08) * body * 0.5 + vec3(1.0, 0.9, 0.8) * glint * 0.7) * on * uBubbles;
      }
      // The foam line just under the surface, thicker as the fizz builds
      float foamH = 0.0025 + uAgit * 0.05;
      float foam = smoothstep(-foamH, -foamH * 0.2, h);
      float grain = hash(floor(vec2(atan(vObj.z, vObj.x) * 40.0, vObj.y * 300.0)));
      col = mix(col, vec3(0.62, 0.45, 0.3) * (0.75 + 0.3 * grain), foam * (0.55 + uAgit * 0.4));
    } else {
      // Seen through the open top: the surface itself, foamy as the fizz builds
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
    // Just inside the plastic, clear of the label
    this.mesh.scale.set(0.93, 0.985, 0.93);
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
    this.n.copy(this.up).add(this.tmp.set(this.w.x, 0, this.w.y)).normalize();
    (u.uPlaneN.value as THREE.Vector3).copy(this.n);
    // The surface passes through the bottle's axis at the fill height
    this.mesh.parent?.localToWorld((u.uPlaneP.value as THREE.Vector3).set(0, this.fillY, 0));
    this.mesh.parent?.localToWorld(this.tmp.set(0, this.topY, 0));
    u.uFoamTop.value = this.tmp.distanceTo(u.uPlaneP.value as THREE.Vector3);
    u.uTime.value = time;
    u.uAgit.value = this.fizz;
    u.uFoam.value = this.foam;
    u.uLight.value = light;
  }
}
