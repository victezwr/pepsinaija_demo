# Pepsi Naija — "DON'T SHAKE ME"

Unofficial concept / spec project. Not affiliated with or endorsed by PepsiCo.

## Assets

| Path | What it is |
|---|---|
| `assets/source/tripo-bottle-original.glb` | Original Tripo export (57 MB, single merged mesh, lighting baked into texture) |
| `assets/source/label-wrap.png` | Flat 50 cl wrap label artwork |
| `assets/models/pepsi-bottle.glb` | Web-ready model (~8 MB, Draco) with separate `Bottle`, `Cap` and `Label` nodes |
| `assets/previews/` | Before/after renders |

`pepsi-bottle.glb` is regenerated from the sources with `cd tools && npm install && npm run fix-model`. The script:

- simplifies the mesh (~977k → ~150k vertices),
- de-lights the texture: clear plastic that Tripo baked as opaque white becomes translucent, baked highlights on the cola are toned down,
- splits the yellow cap into its own node so it can be animated,
- wraps the label on its own cylinder at the bottle waist (r ≈ 0.134, y ≈ 0.28–0.57), logo facing +Z — this mesh doubles as the peelable sticker.

Model units: bottle height ≈ 0.98, body radius ≈ 0.15, base at y = 0.
