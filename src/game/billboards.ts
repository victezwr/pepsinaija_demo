import * as THREE from 'three';

/**
 * Pepsi branding along the chase, drawn in code from the logo (no extra downloads):
 * - roadside billboards on the pavement, angled towards the oncoming runner
 * - a print for the overhead banner obstacle
 * Faces are self-lit a little, like lit signs at sunset. Everything is built once and pooled.
 */
const BLUE_TOP = '#1f4bff';
const BLUE_BOTTOM = '#0a1d8c';
const YELLOW = '#ffc400';

type Line = { text: string; color: string };

function logoImage(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/logo.svg';
  });
}

/** A sign face: blue gradient, the Pepsi globe on the left, two lines of copy. */
function signTexture(w: number, h: number, top: Line, bottom: Line): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const draw = (logo: HTMLImageElement | null): void => {
    const g = c.getContext('2d');
    if (!g) return;
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, BLUE_TOP);
    grd.addColorStop(1, BLUE_BOTTOM);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    // Halftone dots, as on the site's ring
    g.fillStyle = 'rgba(255,255,255,0.07)';
    for (let y = 8; y < h; y += 16) for (let x = (y / 16) % 2 ? 8 : 16; x < w; x += 16) g.fillRect(x, y, 4, 4);
    const pad = h * 0.1;
    const logoSize = h - pad * 2;
    if (logo) g.drawImage(logo, pad, pad, logoSize, logoSize);
    const tx = logo ? pad * 2 + logoSize : pad;
    const maxW = w - tx - pad;
    const fit = (text: string, size: number): number => {
      let s = size;
      for (;;) {
        g.font = `900 ${s}px Archivo, "Arial Black", system-ui, sans-serif`;
        if (g.measureText(text).width <= maxW || s < 12) return s;
        s -= 2;
      }
    };
    g.textBaseline = 'middle';
    g.fillStyle = top.color;
    fit(top.text, h * 0.3);
    g.fillText(top.text, tx, h * 0.36);
    g.fillStyle = bottom.color;
    fit(bottom.text, h * 0.3);
    g.fillText(bottom.text, tx, h * 0.7);
    // A thin white frame
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = h * 0.025;
    g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
    tex.needsUpdate = true;
  };
  draw(null);
  // Redraw once the logo (and the brand font) are in
  void Promise.all([logoImage(), document.fonts?.ready ?? Promise.resolve()]).then(([logo]) => draw(logo));
  return tex;
}

function faceMaterial(map: THREE.Texture): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.55 });
}

/** The roadside billboards' two faces (alternating). */
export function billboardFaces(): THREE.MeshLambertMaterial[] {
  return [
    faceMaterial(signTexture(1024, 384, { text: 'STAY ON THE', color: '#ffffff' }, { text: 'PULSE', color: YELLOW })),
    faceMaterial(signTexture(1024, 384, { text: 'SAME TASTE.', color: '#ffffff' }, { text: 'NEW LOOK.', color: YELLOW })),
  ];
}

/** A billboard on two posts: 6 m × 2.25 m face, its bottom edge 3 m up. Faces +Z. */
export function makeBillboard(face: THREE.Material, frame: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const W = 6;
  const H = 2.25;
  const base = 3;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(W, H), face);
  board.position.set(0, base + H / 2, 0.08);
  const back = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, H + 0.2, 0.14), frame);
  back.position.set(0, base + H / 2, 0);
  g.add(board, back);
  for (const x of [-W * 0.3, W * 0.3]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, base + 0.2, 0.22), frame);
    post.position.set(x, (base + 0.2) / 2, -0.05);
    g.add(post);
  }
  return g;
}

/** The overhead banner's print. */
export function bannerPrint(): THREE.MeshLambertMaterial {
  const m = faceMaterial(signTexture(1024, 320, { text: 'STAY ON THE', color: '#ffffff' }, { text: 'PULSE', color: YELLOW }));
  m.side = THREE.DoubleSide;
  return m;
}
