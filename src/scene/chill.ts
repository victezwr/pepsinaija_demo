import * as THREE from 'three';

/** Where the cap starts (model units): the shell isn't drawn above it. */
const CAP_BOTTOM = 0.872;

/**
 * "Straight from the fridge" condensation, after how it looks in real life and in product shots:
 * - a fog of micro-droplets: the surface goes rough and slightly milky (not white speckles)
 * - beads: clear, smooth lenses that bend the label behind them and darken at their edges
 * - many small drops and a few large ones, larger towards the bottom where water collects
 * - clear trails wiped by drops that slid down, each ending in a fat drop
 *
 * Generated once on a canvas and wrapped round the bottle in cylindrical coordinates (the
 * bottle's own UVs are an atlas, so trails would point every which way).
 * - normal map: the beads' shape (lighting, highlights, lens bending)
 * - data map:   G = roughness (fog rough, beads glassy), B = fog (milky haze), R = bead edge (darkening)
 */
export interface Condensation {
  normal: THREE.Texture;
  data: THREE.Texture;
}

export function makeCondensation(size: number): Condensation {
  const w = size;
  const h = size;
  const hc = document.createElement('canvas');
  hc.width = w;
  hc.height = h;
  const g = hc.getContext('2d');
  const wipe = document.createElement('canvas'); // white where a sliding drop wiped the fog away
  wipe.width = w;
  wipe.height = h;
  const wg = wipe.getContext('2d');
  if (!g || !wg) return { normal: new THREE.Texture(), data: new THREE.Texture() };
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  wg.fillStyle = '#000';
  wg.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'lighten'; // merging drops keep the taller dome
  const px = size / 1024;
  // A domed drop of radius r (px). Drawn three times across the seam so the texture wraps.
  const drop = (x: number, y: number, r: number, squash = 1): void => {
    for (const ox of [-w, 0, w]) {
      const grd = g.createRadialGradient(x + ox, y + r * 0.08, 0, x + ox, y, r);
      grd.addColorStop(0, '#fff');
      grd.addColorStop(0.55, '#cfcfcf');
      grd.addColorStop(0.85, '#6a6a6a');
      grd.addColorStop(1, '#000');
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(x + ox, y, r, r * squash, 0, 0, Math.PI * 2);
      g.fill();
    }
  };
  // v = 0 is the bottom of the bottle (the canvas is flipped by the texture)
  const yOf = (bottomBias: number): number => h * (1 - Math.pow(Math.random(), bottomBias));
  // Runs: drops that grew heavy slid down, wiping clear channels through the fog (drawn first so
  // beads can stay out of them), each ending in a fat drop
  const ends: Array<[number, number, number]> = [];
  for (let i = 0; i < 11; i++) {
    let x = Math.random() * w;
    const y0 = h * (0.15 + Math.random() * 0.6);
    const y1 = Math.min(h - 14 * px, y0 + h * (0.05 + Math.random() * 0.18));
    const width = (5 + Math.random() * 6) * px;
    wg.strokeStyle = '#fff';
    wg.lineCap = 'round';
    wg.lineWidth = width;
    wg.beginPath();
    wg.moveTo(x, y0);
    for (let y = y0; y < y1; y += 8 * px) {
      x += (Math.random() - 0.5) * 3 * px;
      wg.lineTo(x, y);
    }
    wg.stroke();
    ends.push([x, y1, width * 0.85 + 3 * px]);
  }
  const wiped = wg.getImageData(0, 0, w, h).data;
  // Beads: a power-law size mix, bigger and denser towards the bottom, none inside the runs
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * w;
    const y = yOf(1.25);
    if (wiped[((Math.floor(y) * w + Math.floor(x)) * 4) | 0] > 40) continue;
    const low = y / h; // 0 top .. 1 bottom (canvas)
    const r = (1.5 + Math.pow(Math.random(), 3.4) * (6 + 10 * low)) * px;
    drop(x, y, r, 1.05 + Math.random() * 0.15);
  }
  for (const [x, y, r] of ends) drop(x, y, r, 1.25);
  g.globalCompositeOperation = 'source-over';
  // Micro-droplet fog: the base everything sits on (fine grain, low)
  const H = g.getImageData(0, 0, w, h).data;
  const Wp = wg.getImageData(0, 0, w, h).data;
  const nImg = new ImageData(w, h);
  const dImg = new ImageData(w, h);
  const N = nImg.data;
  const D = dImg.data;
  const hAt = (x: number, y: number): number => H[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  const strength = 2.6 * px;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const hc0 = H[i] / 255;
      const dx = (hAt(x + 1, y) - hAt(x - 1, y)) * strength;
      const dy = (hAt(x, y + 1) - hAt(x, y - 1)) * strength;
      // Slight grain on the fog so it isn't plastic-smooth
      const grain = hc0 > 0.02 ? 0 : (Math.random() - 0.5) * 0.08;
      const nx = -dx + grain;
      const ny = dy + grain;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      N[i] = 128 + (nx / len) * 127;
      N[i + 1] = 128 + (ny / len) * 127;
      N[i + 2] = 128 + (nz / len) * 127;
      N[i + 3] = 255;
      const wiped = Wp[i] / 255;
      const bead = Math.min(1, hc0 * 3);
      const fog = (1 - wiped) * (1 - bead);
      // Only the outer rim of a bead darkens (steep and low), the middle stays clear
      const edge = hc0 > 0.04 ? Math.min(1, Math.hypot(dx, dy) * 1.4) * Math.max(0, 1 - hc0 * 1.6) : 0;
      D[i] = edge * 255; // bead edge: darker (light bent away)
      D[i + 1] = (0.06 + fog * 0.5 + wiped * 0.08) * 255; // roughness: beads glassy, fog rough
      D[i + 2] = fog * 255; // milky haze
      D[i + 3] = 255;
    }
  }
  const toTex = (img: ImageData): THREE.Texture => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')?.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 4;
    return t;
  };
  return { normal: toTex(nImg), data: toTex(dImg) };
}

export interface ChillOptions {
  /** Times the texture wraps round the bottle. */
  repeat: number;
  /** Bottle height (model units) the texture spans, from y = 0. */
  height: number;
  /** How far beads bend what's behind them (label only; 0 = none). */
  lens: number;
  /** Milky haze strength. */
  haze: number;
  /** For translucent plastic: how much the fog clouds the see-through. */
  cloud: number;
  /**
   * The bottle shell: its texture has the cola painted in. Keep only its highlights and ridges
   * and make the rest clear plastic (the liquid is its own mesh now).
   */
  pet?: boolean;
}

/**
 * Adds the condensation to a standard/physical material in cylindrical coordinates round the
 * bottle's axis (object space): bead normals (also on the clear-coat), glassy beads in a rough
 * fog, darker bead edges, a lens bend of the print behind each bead, a milky haze.
 */
export function applyCondensation(mat: THREE.MeshStandardMaterial, cond: Condensation, o: ChillOptions): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.tCondN = { value: cond.normal };
    shader.uniforms.tCondD = { value: cond.data };
    shader.uniforms.uCond = { value: new THREE.Vector4(o.repeat, o.height, o.lens, o.haze) };
    shader.uniforms.uCloud = { value: o.cloud };
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vCondP;\nvarying vec3 vCondT;\nvarying vec3 vCondB;\nvoid main() {')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vCondP = position;
        vCondT = normalize(normalMatrix * normalize(vec3(-position.z, 0.0, position.x) + 1e-5));
        vCondB = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `uniform sampler2D tCondN;
        uniform sampler2D tCondD;
        uniform vec4 uCond;
        uniform float uCloud;
        varying vec3 vCondP;
        varying vec3 vCondT;
        varying vec3 vCondB;
        void main() {
          vec2 condUv = vec2((atan(vCondP.z, vCondP.x) / 6.2831853 + 0.5) * uCond.x, clamp(vCondP.y / uCond.y, 0.002, 0.998));
          vec3 condN = texture2D(tCondN, condUv).xyz * 2.0 - 1.0;
          vec4 condD = texture2D(tCondD, condUv);`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        ${
          o.pet
            ? `if (vCondP.y > ${CAP_BOTTOM.toFixed(3)}) discard; // the cap covers this: no plastic drawn over it
        float petLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float petHi = smoothstep(0.42, 0.85, petLum);
        diffuseColor.rgb = mix(vec3(0.8, 0.86, 0.94), vec3(1.0), petHi);
        diffuseColor.a = 0.07 + petHi * 0.45;`
            : ''
        }
        #ifdef USE_MAP
          if (uCond.z > 0.0) diffuseColor.rgb = texture2D(map, vMapUv + condN.xy * uCond.z).rgb; // the bead's lens
        #endif
        diffuseColor.rgb *= 1.0 - condD.r * 0.3; // bead rims bend the light away: a thin darker edge
        float condBead = 1.0 - smoothstep(0.07, 0.2, condD.g); // glassy = a bead
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.12 + 0.035, condBead * 0.6); // beads catch the light
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.94, 1.0), condD.b * uCond.w); // milky fog
        diffuseColor.a = mix(diffuseColor.a, 1.0, condD.b * uCloud); // fog clouds clear plastic`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = max(condD.g, roughnessFactor * 0.35);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        normal = normalize(normalize(vCondT) * condN.x + normalize(vCondB) * condN.y + normal * condN.z);`,
      );
    if (shader.fragmentShader.includes('#include <clearcoat_normal_fragment_maps>')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <clearcoat_normal_fragment_maps>',
        `#include <clearcoat_normal_fragment_maps>
        #ifdef USE_CLEARCOAT
          clearcoatNormal = normal; // the wet coat follows the beads
        #endif`,
      );
    }
  };
  mat.customProgramCacheKey = () => `chill-${o.lens > 0}-${o.cloud > 0}-${o.pet ? 1 : 0}`;
  mat.needsUpdate = true;
}

/** Wet clear-coat over the label print: crisp highlights on the beads (High tier). */
export function wetLabel(src: THREE.MeshStandardMaterial): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    map: src.map,
    color: src.color,
    roughness: src.roughness,
    metalness: src.metalness,
    envMapIntensity: src.envMapIntensity,
    side: src.side,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });
}
