# Sigil encoding vocabulary, version 1.0

Status: **open** during the encoding of the pilot and of drawings 9 to 70; **frozen** before the held-out ten are encoded (see `data/holdout.json`). Any primitive added after the pilot is listed in the change log with the drawing that forced it.

The reference implementation is `tools/sigil.py` (render to raster, export SVG). `tools/score.py` compares a rendering with its source crop. `tools/worksheet.py` draws the grid and detections used to read coordinates.

## Units

The drawing's tight ink bounding box has height 1. `x` runs from 0 at the left edge to `aspect` at the right edge; `y` runs from 0 at the top to 1 at the bottom (screen orientation). Angles are degrees, clockwise on screen from the +x axis. Stroke width is in the same units; `stroke` in the file header is the measured source stroke (typically 0.03 to 0.045; short wide drawings such as Zagan reach 0.065).

## File layout

```json
{
 "id": "12a", "identity": 12, "variant": "a", "name": "Sitri",
 "vocab": "1.0", "aspect": 1.189, "stroke": 0.030,
 "family_by_eye": "bowl",
 "members": [ ... ],
 "escapes": [ ... ],
 "wishes": [ "optional: the primitive that would have avoided an escape" ],
 "notes": "one or two sentences describing the structure in words"
}
```

`aspect` and `stroke` are copied from the worksheet header. `family_by_eye` is copied from `data/families_by_eye.json` (identity to family; `26b` is overridden to `comb`).

## Members

| type | fields | meaning |
|---|---|---|
| `line` | `p: [x1, y1, x2, y2]` | straight stroke |
| `pline` | `p: [[x,y], ...]`, `closed`, `fill` | polyline; closed polygon; optionally filled |
| `arc` | `c: [x,y]`, `r: r` or `[rx, ry]`, `a: [a0, a1]` | circular or elliptical arc drawn from `a0` to `a1` clockwise on screen |
| `bez` | `p: [[x,y] ...]` with 3n+1 points | one or more cubic segments; a smooth stroke with a nameable role (a bow, a handle) |
| `ring` | `c`, `r` | stroked circle: the open-circle terminal of this sheet |
| `dot` | `c`, `r` | filled circle |
| `cross` | `c`, `s` (half arm), `flared` (default true), `rot` | flared = cross pattee with filled concave arms; `flared: false` is two plain strokes |
| `tri` | `p` (3 points), `fill` (default true) | arrowhead, flared tip, triangle |
| `spiral` | `c`, `r: [r0, r1]`, `a: [a0, sweep]` | curl: radius interpolates r0 to r1 over the sweep; negative sweep is counter-clockwise |
| `crescent` | `c`, `r`, `ri` (default r), `k`, `rot` | filled lens: circle r minus circle ri whose centre is shifted k*r toward angle rot (the opening) |
| `repeat` | `n`, `d: [dx, dy]`, `m: [members]` | the members translated 0..n-1 times by d |
| `mirror` | `axis: "x"` or `"y"`, `at`, `m: [members]` | the members plus their reflection in the line x=at or y=at |
| `path` | `p` (cubic points), `note` | **escape**: a free trace of a shape the vocabulary cannot name; goes in `escapes`, not `members` |

Any member may carry `w` to override the stroke width.

## Encoding rules

1. Read coordinates from the worksheet grid and the R/L detection list; do not guess. Detected `L` segments can be merged across gaps, so trust the picture over the list when they disagree.
2. Use `repeat` for evenly spaced copies and `mirror` for bilateral symmetry whenever the source shows them, even when the copies differ slightly. These record structure; small deviations are acceptable.
3. Stop a stroke at a ring's circumference, not its centre.
4. Flared crosses are `cross` members, never four lines.
5. A curved stroke that has a role (bowl, arch, canopy, horn) is an `arc` or `bez` in `members`. A shape you can only trace is a `path` in `escapes`, with a note. The escape count is a measurement of the vocabulary, so do not hide escapes as `bez`.
6. No new member types or fields. If you needed one, put a one-line description in `wishes`.
7. Iterate at most three times on the overlay. Record the final metrics even when the drawing is not accepted.

## Workflow per drawing

```
read  data/worksheets/<id>.png
write encodings/<id>.json
run   M:\dev\cloud\.venv\Scripts\python.exe tools\score.py <id>      (from M:\dev\cloud\sigils)
read  data/overlays/<id>.png     grey = source only, red = rendering only, dark = both
fix the largest grey and red regions; rescore; at most three rounds
```

## Acceptance (predeclared, `tools/score.py`)

`cov >= 0.85` (fraction of the source skeleton within 0.75 stroke of the rendering), `prec >= 0.85` (fraction of the rendered skeleton within 0.75 stroke of the source), `iou_d1 >= 0.55` (IoU of the two ink masks after 1 px dilation). These were fixed before the pilot was scored.

## Change log

- 1.0 (pilot, 24 Oct 2026): line, pline, arc, bez, ring, dot, cross, tri, spiral, crescent, repeat, mirror, path.
- 1.0 after 12a Sitri: the flared cross arm became a concave cross pattee with a wider tip (rendering change only, no new field).
- 1.0 after 69a Decarabia: `crescent` gained the optional inner radius `ri`, because the sheet's crescents have long thin horns that two equal circles cannot produce.
