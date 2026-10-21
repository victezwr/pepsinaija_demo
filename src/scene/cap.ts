import * as THREE from 'three';

/**
 * The yellow cap, clean. The generated model's cap shares a texture atlas with the bottle (its
 * patches bleed cola and blue-grey at the edges) and its mesh has dents and a jagged lower edge
 * the background shows through. So the cap is rebuilt in code, fitted to the original's size:
 * a ridged side, a rounded top edge, a tamper ring underneath, in plain yellow plastic.
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

const RIDGES = 64;

/** A screw cap fitted to `box` (its local bounds), axis along Y. */
export function capGeometry(box: THREE.Box3, segments = 256): THREE.BufferGeometry {
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const R = Math.min(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
  const y0 = box.min.y;
  const H = box.max.y - box.min.y;
  // Profile (radius, height) from the bottom of the tamper ring up and over the top
  const prof: Array<[number, number]> = [
    [0.86, 0],
    [0.9, 0.0],
    [0.92, 0.05],
    [0.92, 0.17], // tamper ring
    [0.88, 0.19], // the break line
    [0.88, 0.21],
    [0.985, 0.23],
    [1.0, 0.26], // ridged body
    [1.0, 0.86],
    [0.985, 0.92],
    [0.95, 0.965], // rounded top edge
    [0.88, 0.995],
    [0.75, 1.0],
    [0.0, 1.0],
  ].map(([r, h]) => [r, h] as [number, number]);
  const pts = prof.map(([r, h]) => new THREE.Vector2(r * R, y0 + h * H));
  const geo = new THREE.LatheGeometry(pts, segments);
  // Knurling: flutes round the body only
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const h = (v.y - y0) / H;
    if (h > 0.25 && h < 0.87) {
      const a = Math.atan2(v.z, v.x);
      const k = 1 - 0.022 * (0.5 + 0.5 * Math.cos(a * RIDGES));
      v.x *= k;
      v.z *= k;
    }
    pos.setXYZ(i, v.x + cx, v.y, v.z + cz);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Swap the model's cap mesh for the clean one (same node, same material slot, cleaned). */
export function rebuildCap(cap: THREE.Mesh, segments?: number): void {
  cap.geometry.computeBoundingBox();
  const box = cap.geometry.boundingBox;
  if (!box) return;
  const old = cap.geometry;
  cap.geometry = capGeometry(box, segments);
  old.dispose();
  if (cap.material instanceof THREE.MeshStandardMaterial) cleanCap(cap.material);
}
