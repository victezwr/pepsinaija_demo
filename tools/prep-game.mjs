// Prepares the Tripo game assets for the web.
// Usage: node prep-game.mjs <srcDir> <outDir>
// - characters: canonical clip names, unused clips dropped, root motion locked (hips x/z), resampled
// - everything: textures → 1024 WebP, Draco geometry
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, prune, resample, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const [SRC, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});

const CUSTOM = 'In place, no forward movement. 0.0–0.4s: running natural';
// Which Tripo clip becomes which game clip (checked frame by frame, see context/progress-tracker.md).
const CLIPS = {
  'runner-male.glb': {
    run: (n) => n === 'run',
    jump: (n) => n.startsWith('make the character jump'),
    stumble: (n) => n.startsWith(CUSTOM) && n.endsWith('.001'),
    fall: (n) => n.startsWith(CUSTOM) && n.endsWith(', a'),
    cheer: (n) => n === 'cheer',
  },
  'runner-female.glb': {
    run: (n) => n === 'run',
    jump: (n) => n.startsWith('make the character jump'),
    stumble: (n) => n.startsWith(CUSTOM) && n.endsWith('.002'),
    fall: (n) => n.startsWith(CUSTOM) && n.endsWith('.001'),
    cheer: (n) => n === 'cheer',
  },
  'agbero.glb': {
    run: (n) => n === 'run',
    idle: (n) => n === 'standing_relax',
    shout: (n) => n === 'angry_03',
  },
};

for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith('.glb'))) {
  const doc = await io.read(path.join(SRC, file));
  const root = doc.getRoot();
  const map = CLIPS[file];
  if (map) {
    for (const anim of root.listAnimations()) {
      const name = Object.keys(map).find((k) => map[k](anim.getName()));
      if (!name) {
        anim.dispose();
        continue;
      }
      anim.setName(name);
      for (const ch of anim.listChannels()) {
        // Lock root motion: the game code owns the character's position.
        if (ch.getTargetPath() !== 'translation' || !/Hips$/.test(ch.getTargetNode()?.getName() ?? '')) continue;
        const out = ch.getSampler().getOutput();
        const a = out.getArray().slice();
        for (let i = 0; i < a.length; i += 3) {
          a[i] = 0;
          a[i + 2] = 0;
        }
        out.setArray(a);
      }
    }
    const names = root.listAnimations().map((a) => a.getName());
    for (const k of Object.keys(map)) if (!names.includes(k)) throw new Error(`${file}: missing clip ${k}`);
  }

  for (const tex of root.listTextures()) {
    const img = await sharp(Buffer.from(tex.getImage())).resize(1024, 1024, { fit: 'inside' }).webp({ quality: 80 }).toBuffer();
    tex.setImage(img).setMimeType('image/webp');
  }

  doc.createExtension(KHRDracoMeshCompression).setRequired(true);
  doc.createExtension(EXTTextureWebP).setRequired(true);
  await doc.transform(weld(), resample(), dedup(), prune());
  const out = path.join(OUT, file);
  await io.write(out, doc);
  const clips = map ? ` clips: ${root.listAnimations().map((a) => a.getName()).join(', ')}` : '';
  console.log(`${file.padEnd(20)} ${(fs.statSync(path.join(SRC, file)).size / 1e6).toFixed(2)} MB → ${(fs.statSync(out).size / 1e6).toFixed(2)} MB${clips}`);
}
