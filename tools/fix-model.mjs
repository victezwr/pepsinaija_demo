// Usage: node fix.mjs in.glb label.png out.glb
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import { weld, simplify, prune, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import fs from 'fs';

const [IN, LABEL, OUT] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
const doc = await io.read(IN);
const root = doc.getRoot();
for (const e of root.listExtensionsUsed()) if (e.extensionName !== 'KHR_draco_mesh_compression') e.dispose();

// 1. Reduce ~977k verts to a web-friendly count.
await MeshoptSimplifier.ready;
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.08, error: 0.0003 }));

// 2. De-light the texture: clear-plastic areas baked as opaque white become translucent,
//    baked highlights on the cola get toned down; the yellow cap is left untouched.
const srcMat = root.listMaterials()[0];
const srcTex = srcMat.getBaseColorTexture();
const { data, info } = await sharp(Buffer.from(srcTex.getImage())).resize(2048, 2048).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const capPx = new Uint8Array(info.width * info.height);
for (let i = 0, p = 0; i < data.length; i += 4, p++) {
  const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0;
  const yellow = s > 0.45 && r > 0.55 && g > 0.4 && b < g * 0.6;
  if (yellow) { capPx[p] = 1; continue; }
  if (s < 0.25 && mx > 0.45) {
    // clear plastic: keep a faint tint, alpha scales with how "white" it was
    const t = Math.min(1, (mx - 0.45) / 0.4);
    data[i] = data[i + 1] = data[i + 2] = Math.round(255 * (0.75 + 0.2 * mx));
    data[i + 3] = Math.round(255 * (0.55 - 0.4 * t));
  } else if (mx > 0.3) {
    // baked streaks on the cola: compress highlights toward the liquid colour
    const k = 0.3 / mx + (1 - 0.3 / mx) * 0.4;
    data[i] *= k; data[i + 1] *= k; data[i + 2] *= k;
  }
}
const bottleImg = await sharp(data, { raw: info }).resize(1024, 1024).webp({ quality: 82, alphaQuality: 80 }).toBuffer();
const capImg = await sharp(Buffer.from(srcTex.getImage())).resize(1024, 1024).webp({ quality: 85 }).toBuffer();

// 3. Split the merged mesh into Cap and Bottle by texture colour + height.
const prim = root.listMeshes()[0].listPrimitives()[0];
const pos = prim.getAttribute('POSITION').getArray();
const nrm = prim.getAttribute('NORMAL').getArray();
const uv = prim.getAttribute('TEXCOORD_0').getArray();
const idx = prim.getIndices().getArray();
{
  const nVerts = pos.length / 3, nbrs = Array.from({ length: nVerts }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) { nbrs[idx[t + k]].add(idx[t + (k + 1) % 3]); nbrs[idx[t + k]].add(idx[t + (k + 2) % 3]); }
  for (let pass = 0; pass < 4; pass++) {
    const src = nrm.slice();
    for (let v = 0; v < nVerts; v++) {
      let x = src[v * 3], y = src[v * 3 + 1], z = src[v * 3 + 2];
      for (const n of nbrs[v]) { x += src[n * 3]; y += src[n * 3 + 1]; z += src[n * 3 + 2]; }
      const l = Math.hypot(x, y, z) || 1; nrm[v * 3] = x / l; nrm[v * 3 + 1] = y / l; nrm[v * 3 + 2] = z / l;
    }
  }
}
const isCapV = (v) => {
  if (pos[v * 3 + 1] < 0.88) return false;
  const x = Math.min(info.width - 1, Math.max(0, Math.floor(uv[v * 2] * info.width)));
  const y = Math.min(info.height - 1, Math.max(0, Math.floor(uv[v * 2 + 1] * info.height)));
  return capPx[y * info.width + x] === 1;
};
const groups = { Cap: [], Bottle: [] };
for (let t = 0; t < idx.length; t += 3) {
  const votes = isCapV(idx[t]) + isCapV(idx[t + 1]) + isCapV(idx[t + 2]);
  (votes >= 2 ? groups.Cap : groups.Bottle).push(idx[t], idx[t + 1], idx[t + 2]);
}

// Build a fresh, clean document.
const out = new Document();
const buf = out.createBuffer();
const scene = out.createScene('Scene');
const mkPrim = (tri) => {
  const map = new Map(), P = [], N = [], U = [], I = [];
  for (const v of tri) {
    if (!map.has(v)) { map.set(v, map.size); P.push(pos[v*3], pos[v*3+1], pos[v*3+2]); N.push(nrm[v*3], nrm[v*3+1], nrm[v*3+2]); U.push(uv[v*2], uv[v*2+1]); }
    I.push(map.get(v));
  }
  return out.createPrimitive()
    .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(new Float32Array(P)).setBuffer(buf))
    .setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(new Float32Array(N)).setBuffer(buf))
    .setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(new Float32Array(U)).setBuffer(buf))
    .setIndices(out.createAccessor().setType('SCALAR').setArray(new Uint32Array(I)).setBuffer(buf));
};
const tex = (name, img, mime) => out.createTexture(name).setImage(img).setMimeType(mime);

const bottleMat = out.createMaterial('Bottle').setBaseColorTexture(tex('bottle_basecolor', bottleImg, 'image/webp'))
  .setRoughnessFactor(0.12).setMetallicFactor(0).setAlphaMode('BLEND').setDoubleSided(true);
const capMat = out.createMaterial('Cap').setBaseColorTexture(tex('cap_basecolor', capImg, 'image/webp'))
  .setRoughnessFactor(0.45).setMetallicFactor(0);
scene.addChild(out.createNode('Bottle').setMesh(out.createMesh('Bottle').addPrimitive(mkPrim(groups.Bottle).setMaterial(bottleMat))));
scene.addChild(out.createNode('Cap').setMesh(out.createMesh('Cap').addPrimitive(mkPrim(groups.Cap).setMaterial(capMat))));

// 4. Label: separate wrap mesh around the straight waist (y 0.28–0.57, r≈0.1326).
const labelMeta = await sharp(LABEL).metadata();
const R = 0.1336, C = 2 * Math.PI * R, Hgt = C * labelMeta.height / labelMeta.width, Y0 = 0.425 - Hgt / 2;
const SEG = 128, rot = -0.35 * 2 * Math.PI; // turn the logo (≈35% across the art) to face +Z
const LP = [], LN = [], LU = [], LI = [];
for (let i = 0; i <= SEG; i++) {
  const u = i / SEG, th = u * 2 * Math.PI + rot;
  for (const [y, v] of [[Y0 + Hgt, 0], [Y0, 1]]) { LP.push(R*Math.sin(th), y, R*Math.cos(th)); LN.push(Math.sin(th), 0, Math.cos(th)); LU.push(u, v); }
  if (i < SEG) { const a = i*2; LI.push(a, a+1, a+2, a+1, a+3, a+2); }
}
const labelPrim = out.createPrimitive()
  .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(new Float32Array(LP)).setBuffer(buf))
  .setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(new Float32Array(LN)).setBuffer(buf))
  .setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(new Float32Array(LU)).setBuffer(buf))
  .setIndices(out.createAccessor().setType('SCALAR').setArray(new Uint16Array(LI)).setBuffer(buf));
const labelImg = await sharp(LABEL).resize(2048).webp({ quality: 88 }).toBuffer();
const labelMat = out.createMaterial('Label').setBaseColorTexture(tex('label_basecolor', labelImg, 'image/webp'))
  .setRoughnessFactor(0.35).setMetallicFactor(0).setDoubleSided(true);
scene.addChild(out.createNode('Label').setMesh(out.createMesh('Label').addPrimitive(labelPrim.setMaterial(labelMat))));

out.createExtension(KHRDracoMeshCompression).setRequired(true);
out.createExtension(EXTTextureWebP).setRequired(true);
await out.transform(dedup(), prune());
await io.write(OUT, out);
console.log('cap tris', groups.Cap.length / 3, 'bottle tris', groups.Bottle.length / 3, 'label H', Hgt.toFixed(4), 'Y0', Y0.toFixed(4));
console.log('size MB', (fs.statSync(OUT).size / 1e6).toFixed(2));
