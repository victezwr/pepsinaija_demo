import * as THREE from 'three';

/**
 * The yellow cap, clean. The generated model's cap shares a texture atlas with the bottle (its
 * patches bleed cola and blue-grey at the edges) and its mesh has dents and a jagged lower edge
 * the background shows through. So the cap is rebuilt in code from the original's own outline
 * (see capGeometry), smooth and finely ridged, in plain yellow plastic.
 */
export const CAP_YELLOW = 0xf7c200;

export function cleanCap(mat: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  mat.map = null;
  mat.color.setHex(CAP_YELLOW);
  mat.roughness = 0.38;
  mat.metalness = 0.05;
  mat.side = THREE.FrontSide;
  mat.needsUpdate = true;
  return mat;
}

const RIDGES = 90;
const BINS = 26;

/**
 * A clean screw cap with the original cap's own outline: the outer radius at each height is read
 * off the generated mesh (a high percentile, so dents and stray inner faces don't count), smoothed,
 * and turned into a lathe with fine ridges round the grip. Axis along Y.
 */
export function capGeometry(src: THREE.BufferGeometry, segments = 256): THREE.BufferGeometry {
  src.computeBoundingBox();
  const box = src.boundingBox as THREE.Box3;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const y0 = box.min.y;
  const H = box.max.y - box.min.y;
  const pos = src.attributes.position as THREE.BufferAttribute;
  const bins: number[][] = Array.from({ length: BINS }, () => []);
  for (let i = 0; i < pos.count; i++) {
    const h = (pos.getY(i) - y0) / H;
    const r = Math.hypot(pos.getX(i) - cx, pos.getZ(i) - cz);
    bins[Math.min(BINS - 1, Math.floor(h * BINS))].push(r);
  }
  const pct = (a: number[], p: number): number => {
    if (!a.length) return NaN;
    const b = [...a].sort((x, y) => x - y);
    return b[Math.min(b.length - 1, Math.floor(p * b.length))];
  };
  let radii = bins.map((b) => pct(b, 0.985));
  // Fill empty bins, then smooth out the dents (3-tap)
  radii = radii.map((r, i) => (Number.isNaN(r) ? radii.find((x, j) => j > i && !Number.isNaN(x)) ?? radii[i - 1] ?? 0 : r));
  radii = radii.map((r, i) => (radii[Math.max(0, i - 1)] + 2 * r + radii[Math.min(BINS - 1, i + 1)]) / 4);
  // The grip's radius (middle of the cap): where the ridges go
  const grip = radii.slice(Math.floor(BINS * 0.35), Math.floor(BINS * 0.85)).sort((a, b) => a - b);
  const R = grip[Math.floor(grip.length / 2)];
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < BINS; i++) pts.push(new THREE.Vector2(radii[i], y0 + ((i + 0.5) / BINS) * H));
  // Close the top: round over to the centre
  const top = y0 + H;
  const rTop = radii[BINS - 1];
  pts.push(new THREE.Vector2(rTop * 0.97, top - H * 0.008));
  pts.push(new THREE.Vector2(rTop * 0.88, top));
  pts.push(new THREE.Vector2(0, top));
  pts.unshift(new THREE.Vector2(radii[0] * 0.96, y0));
  const geo = new THREE.LatheGeometry(pts, segments);
  // Fine ridges on the grip: where the outline is near its widest, away from the top and bottom
  const p = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const h = (v.y - y0) / H;
    const r = Math.hypot(v.x, v.z);
    if (h > 0.3 && h < 0.92 && r > R * 0.97 && r < R * 1.03) {
      const a = Math.atan2(v.z, v.x);
      const k = 1 - 0.018 * (0.5 + 0.5 * Math.cos(a * RIDGES));
      v.x *= k;
      v.z *= k;
    }
    p.setXYZ(i, v.x + cx, v.y, v.z + cz);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Swap the model's cap mesh for the clean one (same node, same material slot, cleaned). */
export function rebuildCap(cap: THREE.Mesh, segments?: number): void {
  const old = cap.geometry;
  cap.geometry = capGeometry(old, segments);
  old.dispose();
  if (cap.material instanceof THREE.MeshStandardMaterial) cleanCap(cap.material);
}
