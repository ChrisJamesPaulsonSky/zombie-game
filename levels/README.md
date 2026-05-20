# Levels

Each level is a `<name>.json` file describing terrain, splines, entities, and
camera. Per-vertex elevation is stored in a sibling `<name>_hgt.png` image
(TICKET-050) — see below.

## File pairs

| File | Format | Purpose |
|---|---|---|
| `<name>.json` | UTF-8 JSON | Authored content: terrain grid, splines, buildings, props, spawn zones, camera |
| `<name>_hgt.png` | 8-bit grayscale PNG | Per-vertex heightmap (optional) |

Both files must be dropped into this directory together. The JSON references
the PNG via the `elevation_png` field; the loader resolves it relative to the
level URL.

`level_manifest.json` and `campaign.json` are not levels — they're indices.

## Heightmap PNG format

- **Color type:** single-channel 8-bit grayscale (PNG `colorType = 0`).
- **Dimensions:** `(level.width + 1) × (level.height + 1)`. One pixel per
  vertex, *not* per tile — a 196×196 tile level has a 197×197 PNG.
- **Pixel value:** `u8` tenths of a cell. `0 = ground`, `100 = max height`
  (10 cells). Values >100 are clamped on load.
- **Origin:** top-left, row-major. PNG row `vy=0` is the same row as
  `terrain_grid[0]`.
- **Filename:** must match `<level>_hgt.png` (matches the existing
  `terrain_*_hgt.png` material-map convention).

The encoder/decoder lives in
[`crates/engine_core/src/map/elevation_png.rs`](../../crates/engine_core/src/map/elevation_png.rs).
The loader tolerates RGB/RGBA/GrayscaleAlpha 8-bit PNGs (reads channel 0)
because image tools sometimes upcast on save.

## Editing the heightmap

You can paint heights in any image tool — GIMP, Krita, Photoshop, even
Aseprite. Two rules:

1. **Stay 8-bit.** If your editor offers a "convert to 16-bit" mode, decline.
2. **Save as grayscale PNG.** RGB still works (the loader reads R), but
   grayscale produces the smallest file.

Black = ground level, mid-grey ≈ 5 cells, near-white ≈ 10 cells. Anything
above pixel value 100 is clamped on load.

## Editor save flow

The in-game editor's "Save Level" emits two browser downloads:

- `level.json` — the level data, with `elevation_png: "level_hgt.png"`.
- `level_hgt.png` — the heightmap.

Drop both into `web/levels/`, optionally rename consistently
(e.g. `my_map.json` + `my_map_hgt.png`, updating the `elevation_png` field
to match).

## Procedural levels

A level can omit both `elevation_png` and the legacy `elevation_grid` and
declare a `hills` array instead — the engine generates heights at load time.
Used by `blank_*.json` and any mapgen output.

Precedence at load time: `elevation_png` → legacy `elevation_grid` → `hills`
→ flat.

## Legacy: `elevation_grid`

Pre-TICKET-050 levels stored vertex heights inline as `elevation_grid: [[u8;
W+1]; H+1]`. The loader still accepts this shape so old level files don't
break. New saves never emit it.

If you have an unmigrated level lying around, run:

```bash
cargo test -p engine_core -- --ignored migrate_levels
```

…to convert it (idempotent — files without `elevation_grid` are skipped).

## Art-pipeline tools

The Node tools that read or modify per-vertex heights all use a shared
helper at [`tools/level_elevation.js`](../../tools/level_elevation.js). If
you write a new tool that touches elevation, use the same helper rather than
re-rolling PNG decode/encode.

Tools that currently use it:
[`road_embankment.js`](../../tools/road_embankment.js),
[`map_border_hills.js`](../../tools/map_border_hills.js),
[`hedge_field_borders.js`](../../tools/hedge_field_borders.js),
[`resize_map.js`](../../tools/resize_map.js).
