import * as THREE from 'three';

/**
 * "Straight from the fridge": a condensation layer drawn over the label and the plastic.
 * A fog of micro-droplets with clear trails where drops have run down, and fat beads at
 * the bottom of each trail. Generated once on a canvas (alpha in every channel), then used
 * as the alpha map of a thin white layer on top of the surface.
 */
export function mistTexture(trails: boolean, size = 1024): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size / 2;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  if (!g) return tex;
  const w = c.width;
  const h = c.height;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  // Micro-droplet fog: thousands of tiny dots of varying strength
  for (let i = 0; i < w * h * 0.05; i++) {
    const v = 60 + Math.random() * 120;
    g.fillStyle = `rgb(${v},${v},${v})`;
    const r = 0.5 + Math.random() * 1.3;
    g.beginPath();
    g.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2);
    g.fill();
  }
  // Soft overall haze so the fog reads as a layer, not noise
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(40,40,40,1)';
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  if (trails) {
    // Runs: wavy clear channels wiped through the fog, a fat bead at the bottom of each
    for (let i = 0; i < 26; i++) {
      let x = Math.random() * w;
      const y0 = Math.random() * h * 0.5;
      const y1 = y0 + h * (0.25 + Math.random() * 0.55);
      const width = 3 + Math.random() * 5;
      g.strokeStyle = '#000';
      g.lineWidth = width;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x, y0);
      for (let y = y0; y < y1; y += 6) {
        x += (Math.random() - 0.5) * 2.2;
        g.lineTo(x, y);
      }
      g.stroke();
      bead(g, x, Math.min(h - 6, y1), width * 0.9 + 2);
    }
  }
  // Scattered beads sitting in the fog
  for (let i = 0; i < 140; i++) bead(g, Math.random() * w, Math.random() * h, 1.5 + Math.pow(Math.random(), 2.5) * 6);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** A water bead: clear rim (the fog is pushed aside) with a bright highlight. */
function bead(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(x, y, r * 1.35, r * 1.5, 0, 0, Math.PI * 2);
  g.fill();
  const grd = g.createRadialGradient(x - r * 0.35, y - r * 0.4, 0, x, y, r);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(200,200,200,0.75)');
  grd.addColorStop(1, 'rgba(90,90,90,0.25)');
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(x, y, r, r * 1.12, 0, 0, Math.PI * 2);
  g.fill();
}

/** A cold, misted layer over `mesh` (same geometry, drawn on top). */
export function addMist(mesh: THREE.Mesh, alpha: THREE.Texture, opacity: number, renderOrder: number): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xe8f1ff,
    roughness: 0.35,
    metalness: 0,
    alphaMap: alpha,
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    envMapIntensity: 1.6,
  });
  const layer = new THREE.Mesh(mesh.geometry, mat);
  layer.renderOrder = renderOrder;
  layer.frustumCulled = false;
  mesh.add(layer);
  return layer;
}

/** Wet clear-coat over the label print: crisp highlights through the beads (High tier). */
export function wetLabel(src: THREE.MeshStandardMaterial, beads: THREE.Texture): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    map: src.map,
    color: src.color,
    roughness: src.roughness,
    metalness: src.metalness,
    normalMap: src.normalMap,
    normalScale: src.normalScale,
    envMapIntensity: src.envMapIntensity,
    side: src.side,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    clearcoatNormalMap: beads,
    clearcoatNormalScale: new THREE.Vector2(1.1, 1.1),
  });
  return m;
}
