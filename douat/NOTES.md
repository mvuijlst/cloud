# douat · floor

A screensaver page: a stone floor laid one half-square at a time in Douat's diagonally halved squares. It runs entirely in the browser and loads no images. The stones and mortar are generated procedurally in WebGL 2, then drawn as real 3D stones that can be viewed from any angle.

Open `/douat/` over HTTP, for example with the repository's `cloud-static` launch configuration: `http://localhost:8765/douat/`. ES modules do not load from `file://`.

The preparatory work is in `research/`: the feasibility study, protocol, plate annotations and source scans, and the earlier Three.js viewer.

## What happens on screen

1. A lime-sand mortar bed fades in, with blue chalk lines snapped every four squares.
2. Stones are lowered into place one by one, about four a second at the default speed. Each is carried in from the unlaid side, 17 to 26 cm up and tilted 8 to 14° with its leading edge low. It is set down edge first and settles flat with a slight slide and twist. Its soft shadow sharpens as it comes down.
3. When the pattern area is done, the floor keeps growing. Ring after ring of squares is laid around it, clockwise, carrying the pattern outward, until the floor reaches the dark at the edge of the light. The open field goes a little faster than the pattern. At the default speed a floor takes about three minutes; at the slowest, about twelve.
4. When the floor is complete, the joints are filled across the floor in laying order.
5. The finished floor holds for 75 seconds, fades out, and a new floor begins with the next seed.

A mason's order is followed. Repeating designs go row by row from the far wall, or along the diagonal. Centred designs go out from the centre, as setting-out from the centre lines would require. In each square, the half that meets already-laid work goes down first.

The view starts zoomed out as far as it goes, seen from 68° above the horizon. It turns around the floor once every three minutes. It can be turned, tilted, zoomed and moved at any time; see Controls. After eight seconds without input it eases back into turning.

## The designs

`pattern.js` samples a new composition for every floor from the grammar in `research/study.md`. It uses Douat's key: the dark triangle's right angle is at A bottom-left, B top-left, C top-right, D bottom-right. There are three families.

- **Rows.** A word of 2 or 4 tiles is repeated along a row. A cycle of 1, 2 or 4 rows follows, each row derived from the previous by complement, mirror, flip, quarter turn, shift or half swap. One floor in five uses Douat's design-5 device: a word alternating with a relative of itself.
- **Centred.** A 3×3 to 6×6 seed of diagonals, nested squares, crosses or a free symmetric seed is reflected about the floor centre and folded back on itself beyond its edge, as in design 10. Half of these break the rule once along the diagonal.
- **Bands.** States run along (a·x + b·y) mod m, sometimes mirrored into chevrons.

The rule is defined everywhere, so the rings around the first area continue the same composition. Each composition then gets a random crop phase, optional transposition and optional colour complement. Floors with fewer than two states, or with more than 80% of one state, are redrawn. The info panel (move the mouse) states the rule, for example `rows of 4, cycle of 2: ADBC / DACB`.

## The stones

Each square is two stones: a triangle of dark bluestone and one of cream limestone, with a joint on the diagonal. In real stone that is the only way to make a half-and-half square. The look was fixed by five photographs the user supplied of reclaimed bluestone and limestone floors, one of them top-down. Every stone is treated as reclaimed: it carries its own history, independent of its neighbours, as stones from an old floor do.

- **Solid.** Each stone is 25 mm thick, with sides, standing on the mortar bed. The sides show along the unfinished edge, in the joints at low angles, and on the stone in flight.
- **Shape.** The straight-sided triangle gets a hand-dressed outline that wanders by up to about 1.4 mm. Each stone sits up to ±1.1 mm off its place and turned up to ±0.6°. It stands proud or sunk by up to 0.75 mm and tilts by up to about 1°, so neighbours step at their edges. Its centre is dished by up to 1.5 mm. The whole layout drifts by a few millimetres over a metre, so joints wander.
- **Arrises.** Edges are rolled, sharper on the limestone and softer on the bluestone. The roll width varies along each edge. Edges are chipped where the stone is chip-prone, with paler fracture.
- **Bluestone.** Tone varies stone to stone. Each stone has warped cloudy mottling with pale haze and darker patches, a stone-scale tone gradient and coarse grain. Pits catch dirt, scuffs are pale and abraded, and some stones carry a calcite vein. Petit granit adds crinoid debris.
- **Limestone.** Ochre and grey clouds. A pitted skin on every stone, and flaking terraces on the weathered ones, with dirt settled in the hollows. Some stones have dark specks, soft stains or a dirty hairline crack.
- **Joints.** The gaps are real: open down to the bed while the stones are laid, then filled to just below the tops. They darken by how enclosed they are and by the sun's shadow.
- **Light.** Window daylight from the top left, 22 to 32° high. It falls off across the room and, beyond the patterned area, fades over about a metre and a half into darkness. A cool sky fill and cavity occlusion. Sun shadows soften with the distance between the stone and the surface the shadow falls on. A slight lens falloff and fixed grain complete it.

Three stone pairings are drawn at random per floor (`materials.js`):

- **Reclaimed bluestone and cream limestone**, tight dark joints, weight 5.
- **Honed petit granit and grey limestone**, weight 3.
- **Worn bluestone and limestone in lime mortar**, weight 2.

## Checked against a photograph

The user's top-down photograph has about 155 px per stone. `tools/measure_photo.py` measures it per stone: mean luminance, stone-to-stone spread, and within-stone spread in three bands. The bands are coarse (Gaussian σ 12 px), mid (σ 2 to 12) and fine (below σ 2), plus a median luminance profile across the joints. `tools/measure_render.py` applies the same measurement to a render of the view from above, rescaled to the same stone size: `?still&seed=7&photo`, 1600×900 at 2× pixel density. In the page, `douat.measureArgs()` prints the arguments it needs.

| sRGB luminance | Photo, dark | Render, dark | Photo, light | Render, light |
|---|---|---|---|---|
| Mean | 81.3 | 82.4 | 186.4 | 180.2 |
| Stone-to-stone spread | 12.1 | 13.2 | 10.3 | 10.1 |
| Within stone, coarse | 7.3 | 5.9 | 5.2 | 3.5 |
| Within stone, mid | 5.4 | 5.0 | 4.3 | 5.2 |
| Within stone, fine | 8.5 | 5.0 | 9.5 | 7.2 |

| Joints | Photo | Render |
|---|---|---|
| Darkest point | 43 | 49 |
| Width below half depth | 3 px | 3 px |

These are 40 stones of each colour from one floor; another seed moves the render figures by a point or two. The photo is a sharpened, compressed web image. Its fine band therefore includes noise and halo that the render does not try to copy. The dark stones' coarse and fine texture is still lighter than in the photo. The colour of the light stone is (195,179,152) against the photo's (201,185,160).

The three other photographs are oblique and were used by eye only: for edges, flaking, lime joints and fossil debris.

## Controls

The cog at the top right opens the settings; it shows when the mouse moves or the screen is touched, and stays faintly visible on touch screens. The panel describes the floor being laid, and sets:

- **Speed** in five steps, each twice the one before: 1 is a stone every 1.1 s, 3 (the default) four times that, 5 sixteen times.
- **Pause**, **turning** of the view on or off, and **reset view**.
- **Stones:** any pairing drawn per floor, or one fixed pairing. Changing it starts a new floor.
- **Another floor** and **full screen** (where the browser allows it).

Speed, turning and the stone choice are remembered in the browser. With a mouse: drag to turn and tilt, wheel to zoom, right-drag or shift-drag to move, double-click to reset. On a touch screen: drag, pinch, two fingers to move. Keys: `n` new floor, `space` pause, `1` to `5` speed, `r` reset view, `f` full screen, `Esc` closes the panel.

URL parameters:

- `seed=n` repeats a floor; the next floor uses `n+1`.
- `still` shows the finished floor at once.
- `speed=x` multiplies the laying speed directly, overriding the speed setting (step 3 is `speed=4`).
- `hold=s` sets how long a finished floor stays, in seconds.
- `material=reclaimed|petit-granit|lime` fixes the stone pairing.
- `cells=n` sets the number of squares across the first, patterned area.
- `view=yaw,pitch,distance` sets the starting view in degrees and as a fraction of the starting distance, for example `view=60,35,0.5`.
- `spin=minutes` sets how long one turn of the view takes (3 by default); `spin=0` holds the view still.
- `photo` starts straight down, at the framing of a photograph of the floor, without turning. The measurements below use it.
- `low` uses smaller textures and shadow maps; touch devices do this by themselves.
- `freeze=n,u` lays stones before `n` at once, then holds stone `n` at fraction `u` of its flight. It is for inspecting the animation.

## How it is drawn

- **Baked material.** When a floor starts, the stone model in `material.js` is evaluated once into textures, while the screen is still dark. One atlas slot per square of the patterned area holds both its stones at about 0.8 mm per texel: colour, roughness, normals from the height field, cavity, and which stone owns each texel. A second texture holds the mortar bed. The model is the same code that was tuned against the photograph.
- **The squares around.** Each square of the outer rings borrows the two stones of a random square of the patterned area, in one of eight orientations: turned in quarter turns, mirrored or not, whichever matches its own pattern state. It keeps its own offset, turn, lippage and tilt. Giving every outer stone its own texture would need about a gigabyte of graphics memory; at these distances the reuse cannot be seen.
- **Real geometry.** `geometry.js` builds each stone as a mesh, in laying order, so the stones laid so far are one prefix of the vertex buffer. A top is a polygon slightly larger than the stone, cut to its hand-dressed outline by the baked ownership, with smooth edges via alpha-to-coverage. Its sides are vertical faces just inside that outline. Offsets, turn, lippage and tilt are in the vertices. `stonelib.js` mirrors the shader's random numbers so that geometry and texture agree.
- **The stone in flight.** It is the same mesh with a moving transform, so it is a full 3D stone and lands exactly where it stays.
- **Shadows.** One sun shadow map covers the laid floor and is redrawn only when a stone lands. A second, small one follows the stone in flight. Shadows are percentage-closer soft shadows: the penumbra grows with the gap between blocker and receiver.
- **Joints.** The tops of laid stones are drawn from above into a coverage map. Its mipmaps give how enclosed any point of the bed or filling is, which is what darkens a narrow joint. The filling is a plane just below the tops, drawn only where no stone top covers the pixel, using the stencil.
- **Speed.** On an RTX A4000 a frame takes about 3.8 ms at 3200×1800 with 700 stones down and one in flight. Redrawing the floor's shadow map after a landing costs about 1.7 ms. Frames are only drawn when something moves, which with the view turning is every frame.
- **Compile time.** Browsers on Windows compile WebGL through Direct3D's HLSL compiler, which slows down sharply on large shaders and on loops around large bodies. The first version, one program inside a per-pixel sample loop, took 10 to 24 s. The bake now compiles once per page load in about 1.5 s, and Chrome caches it for later visits. Noise reads a 512² table of random bytes, with quintic interpolation done in the shader.

`tools/shot.mjs` drives headless Chrome over the DevTools protocol, with the cache off. It waits for a condition in the page, evaluates an expression and saves a screenshot. It is how the numbers above were made.

## Not done yet

- Floor-wide traffic wear: worn paths that develop after the floor is laid. Wear is currently per stone, as in a relaid reclaimed floor.
- Other tile types. The renderer already knows whole square stones (cell states 4 and 5), but no design uses them yet. Curved Truchet tiles would need a new stone outline.
- Light that follows the time of day.
- Very close views go soft: the atlas holds about 0.8 mm per texel.
