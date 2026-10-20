import * as THREE from 'three';

export interface Outfit {
  /** New singlet colour (the model's singlet is saturated red). */
  singlet: [number, number, number];
  /** Optional tint for the grey-brown cargo shorts. */
  shorts?: [number, number, number];
}

/**
 * Gives one agbero his own clothes: clones his materials and repaints the singlet (and
 * optionally the shorts) in the colour texture, keeping the fabric shading. Skin, towel and
 * slippers are left alone. Runs once per agbero at build time.
 */
export function dressAgbero(root: THREE.Object3D, outfit: Outfit): void {
  const cache = new Map<THREE.Material, THREE.Material>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const src = o.material as THREE.MeshStandardMaterial;
    let mat = cache.get(src) as THREE.MeshStandardMaterial | undefined;
    if (!mat) {
      mat = src.clone();
      if (src.map) mat.map = repaint(src.map, outfit);
      cache.set(src, mat);
    }
    o.material = mat;
  });
}

function repaint(tex: THREE.Texture, outfit: Outfit): THREE.Texture {
  const img = tex.image as CanvasImageSource & { width: number; height: number };
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  if (!g) return tex;
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  const [sr, sg, sb] = outfit.singlet;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255;
    const gr = d[i + 1] / 255;
    const b = d[i + 2] / 255;
    const mx = Math.max(r, gr, b);
    const mn = Math.min(r, gr, b);
    const sat = mx ? (mx - mn) / mx : 0;
    const hue = hueOf(r, gr, b, mx, mn);
    if (sat > 0.5 && (hue > 345 || hue < 12) && r > 0.25) {
      // Singlet red → new colour, carrying over the fold shading
      const shade = Math.min(1.25, mx / 0.78);
      d[i] = clamp255(sr * shade);
      d[i + 1] = clamp255(sg * shade);
      d[i + 2] = clamp255(sb * shade);
    } else if (outfit.shorts && sat < 0.32 && mx > 0.22 && mx < 0.62 && hue > 15 && hue < 50) {
      const [hr, hg, hb] = outfit.shorts;
      const shade = mx / 0.45;
      d[i] = clamp255(hr * shade);
      d[i + 1] = clamp255(hg * shade);
      d[i + 2] = clamp255(hb * shade);
    }
  }
  g.putImageData(data, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.flipY = tex.flipY;
  t.colorSpace = tex.colorSpace;
  t.channel = tex.channel;
  t.wrapS = tex.wrapS;
  t.wrapT = tex.wrapT;
  return t;
}

function hueOf(r: number, g: number, b: number, mx: number, mn: number): number {
  const dlt = mx - mn;
  if (!dlt) return 0;
  let h: number;
  if (mx === r) h = ((g - b) / dlt) % 6;
  else if (mx === g) h = (b - r) / dlt + 2;
  else h = (r - g) / dlt + 4;
  return (h * 60 + 360) % 360;
}

const clamp255 = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
