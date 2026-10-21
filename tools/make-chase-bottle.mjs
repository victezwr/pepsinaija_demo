// The bottle the runner carries in the chase is a few centimetres on screen: a simplified copy
// of the intro model's geometry (same mesh names, ~6% of the triangles). Geometry only: the game
// reuses the intro model's materials and textures (already downloaded and on the GPU).
// Usage: node make-chase-bottle.mjs ../public/models/pepsi-bottle.glb ../public/game/bottle-chase.glb [ratio]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { simplify, weld, prune, dedup } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';

const [SRC, OUT, RATIO = '0.04', ERROR = '0.006'] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
const doc = await io.read(SRC);
const count = () => {
  const out = {};
  for (const m of doc.getRoot().listMeshes()) {
    let t = 0;
    for (const p of m.listPrimitives()) t += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
    out[m.getName()] = Math.round(t);
  }
  return out;
};
console.log('before', count());
await MeshoptSimplifier.ready;
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: +RATIO, error: +ERROR, lockBorder: true }));
// Strip textures: the game swaps in the intro model's materials by mesh name
for (const m of doc.getRoot().listMaterials()) {
  m.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
}
for (const t of doc.getRoot().listTextures()) t.dispose();
await doc.transform(dedup(), prune());
console.log('after ', count());
doc.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({ method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER });
await io.write(OUT, doc);
