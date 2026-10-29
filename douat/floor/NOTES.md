# douat · floor

A screensaver page: a stone floor laid one half-square at a time in Douat's diagonally halved squares. It runs entirely in the browser. Every stone, joint and grain of mortar is computed in a WebGL 2 fragment shader. No image is loaded.

Open `/douat/floor/` over HTTP, for example with the repository's `cloud-static` launch configuration: `http://localhost:8765/douat/floor/`. ES modules do not load from `file://`.

## What happens on screen

1. A lime-sand mortar bed fades in, with blue chalk lines snapped every four squares.
2. Stones are lowered into place one by one, about one per second. Each comes in from the unlaid side and drops from 15 to 23 cm. It casts a soft shadow that sharpens as it lands, and settles with a slight slide and twist.
3. When the floor is complete, the joints are filled across the floor in laying order.
4. The finished floor holds for 75 seconds, fades out, and a new floor begins with the next seed.

A mason's order is followed. Repeating designs go row by row from the far wall, or along the diagonal. Centred designs go out from the centre, as setting-out from the centre lines would require. In each square, the half that meets already-laid work goes down first.

## The designs

`pattern.js` samples a new composition for every floor from the grammar in `../study.md`. It uses Douat's key: the dark triangle's right angle is at A bottom-left, B top-left, C top-right, D bottom-right. There are three families.

- **Rows.** A word of 2 or 4 tiles is repeated along a row. A cycle of 1, 2 or 4 rows follows, each row derived from the previous by complement, mirror, flip, quarter turn, shift or half swap. One floor in five uses Douat's design-5 device: a word alternating with a relative of itself.
- **Centred.** A 3×3 to 6×6 seed of diagonals, nested squares, crosses or a free symmetric seed is reflected about the floor centre and folded back on itself beyond its edge, as in design 10. Half of these break the rule once along the diagonal.
- **Bands.** States run along (a·x + b·y) mod m, sometimes mirrored into chevrons.

Each composition then gets a random crop phase, optional transposition and optional colour complement. Floors with fewer than two states, or with more than 80% of one state, are redrawn. The info panel (move the mouse) states the rule, for example `rows of 4, cycle of 2: ADBC / DACB`.

## The stones

Each square is two stones: a triangle of dark bluestone and one of cream limestone, with a joint on the diagonal. In real stone that is the only way to make a half-and-half square. The look was fixed by five photographs the user supplied of reclaimed bluestone and limestone floors, one of them top-down. Every stone is treated as reclaimed: it carries its own history, independent of its neighbours, as stones from an old floor do.

- **Shape.** The straight-sided triangle gets a hand-dressed outline that wanders by up to about 1.4 mm. Each stone sits up to ±1.1 mm off its place and turned up to ±0.6°. Lippage is ±0.75 mm, tilt up to about 1°, and the centre is dished by up to 1.5 mm. The whole layout drifts by a few millimetres over a metre, so joints wander. Where two stones were set hard together, only their dark hairline shows.
- **Arrises.** Edges are rolled, sharper on the limestone and softer on the bluestone. The roll width varies along each edge. Edges are chipped where the stone is chip-prone, with paler fracture.
- **Bluestone.** Tone varies stone to stone. Each stone has warped cloudy mottling with pale haze and darker patches, a stone-scale tone gradient and coarse grain. Pits catch dirt, scuffs are pale and abraded, and some stones carry a calcite vein. Petit granit adds crinoid debris.
- **Limestone.** Ochre and grey clouds. A pitted skin on every stone, and flaking terraces on the weathered ones, with dirt settled in the hollows. Some stones have dark specks, soft stains or a dirty hairline crack.
- **Light.** Window daylight from the top left, 22 to 32° high, falling off across the room. Normals come from the height field, which is what makes relief, rolled edges and lippage visible. A cool sky fill, cavity occlusion, and soft shadows from the stones onto the bed at the frontier. A slight lens falloff and fixed grain complete it.

Three stone pairings are drawn at random per floor (`materials.js`):

- **Reclaimed bluestone and cream limestone**, tight dark joints, weight 5.
- **Honed petit granit and grey limestone**, weight 3.
- **Worn bluestone and limestone in lime mortar**, weight 2.

## Checked against a photograph

The user's top-down photograph has about 155 px per stone. `tools/measure_photo.py` measures it per stone: mean luminance, stone-to-stone spread, and within-stone spread in three bands. The bands are coarse (Gaussian σ 12 px), mid (σ 2 to 12) and fine (below σ 2), plus a median luminance profile across the joints. `tools/measure_render.py` applies the same measurement to a render rescaled to the same stone size: `?still&seed=7`, 1600×900 at 2× pixel density.

| sRGB luminance | Photo, dark | Render, dark | Photo, light | Render, light |
|---|---|---|---|---|
| Mean | 81.3 | 79.4 | 186.4 | 181.3 |
| Stone-to-stone spread | 12.1 | 11.2 | 10.3 | 11.1 |
| Within stone, coarse | 7.3 | 5.2 | 5.2 | 4.1 |
| Within stone, mid | 5.4 | 4.4 | 4.3 | 4.9 |
| Within stone, fine | 8.5 | 5.2 | 9.5 | 7.7 |

| Joints | Photo | Render |
|---|---|---|
| Darkest point | 43 | 57 |
| Width below half depth | 3 px | 3 px |

The photo is a sharpened, compressed web image. Its fine band therefore includes noise and halo that the render does not try to copy. The dark stones' coarse and fine texture is still lighter than in the photo. The colour of the light stone is (196,180,154) against the photo's (201,185,160).

The three other photographs are oblique and were used by eye only: for edges, flaking, lime joints and fossil debris.

## Controls

Move the mouse to show the panel. The keys are `n` for a new floor, `space` to pause, `1` to `4` for speed ×1/×2/×4/×8, and `f` for full screen.

URL parameters:

- `seed=n` repeats a floor; the next floor uses `n+1`.
- `still` shows the finished floor at once.
- `speed=x` changes the laying speed.
- `hold=s` sets how long a finished floor stays, in seconds.
- `material=reclaimed|petit-granit|lime` fixes the stone pairing.
- `cells=n` sets the number of squares across.
- `tilt=deg` tilts the camera.
- `samples=1..4` sets antialiasing samples per device pixel.
- `freeze=n,u` lays stones before `n` at once, then holds stone `n` at fraction `u` of its flight. It is for inspecting the animation.

## How it is drawn

- **Incremental rendering.** The floor is rendered into an off-screen buffer, a square at a time, and only where something changed: a stone landed or a joint was filled. A per-frame pixel budget adapts to the machine. Each frame then copies that buffer to the screen.
- **The stone in flight.** It is rendered once, alone, into a sprite. Each frame it is drawn lifted, turned and displaced, with its shadow blurred by height and thrown onto whatever lies below it: laid stone or bare bed.
- **Two programs.** The shader is split into a stones-and-joints program and a bed program, compiled in parallel. Antialiasing is done by separate jittered draws, averaged by blending.
- **Compile time.** Browsers on Windows compile WebGL through Direct3D's HLSL compiler. As one program inside a per-pixel sample loop, the shader took 10 to 24 s to compile. Split this way it takes about 3.5 to 5.5 s on an RTX A4000, on a page that stays responsive meanwhile. Noise reads a 512² table of random bytes, with quintic interpolation done in the shader.
- **Speed.** On that machine a landed stone costs about 1 ms of GPU time. A full redraw takes 13 ms at 1600×900 with 4 samples, and 28 ms at 3200×1800 with 2.

`tools/shot.mjs` drives headless Chrome over the DevTools protocol, with the cache off. It waits for a condition in the page, evaluates an expression and saves a screenshot. It is how the numbers above were made.

## Not done yet

- Floor-wide traffic wear: worn paths that develop after the floor is laid. Wear is currently per stone, as in a relaid reclaimed floor.
- Other tile types. The renderer already knows whole square stones (cell states 4 and 5), but no design uses them yet. Curved Truchet tiles would need a new stone outline.
- Light that follows the time of day.
- An oblique, photographic camera. Stone sides are drawn, but heights are not ray-marched, so steep views would show the shortcut.
