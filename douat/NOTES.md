# douat · floor

A screensaver page: a floor laid one stone or tile at a time. Each floor is one of seven tilings: Douat's diagonally halved squares, cubes of rhombs in three stones and Penrose rhombs, all in stone; and Smith's quarter circles, Truchet's arcs, hexagons and Penrose's arcs, all in cement tiles. It runs entirely in the browser and loads no images. The stones and mortar are generated procedurally in WebGL 2, then drawn as real 3D stones that can be viewed from any angle.

Open `/douat/` over HTTP, for example with the repository's `cloud-static` launch configuration: `http://localhost:8765/douat/`. ES modules do not load from `file://`.

The preparatory work is in `research/`: the feasibility study, protocol, plate annotations and source scans, and the earlier Three.js viewer.

## What happens on screen

1. A lime-sand mortar bed fades in, with blue chalk lines snapped every four squares.
2. Stones are lowered into place one by one, about four a second at the default speed. Each is carried in from the unlaid side, 17 to 26 cm up and tilted 8 to 14° with its leading edge low. It is set down edge first and settles flat with a slight slide and twist. Its soft shadow sharpens as it comes down.
3. When the pattern area is done, the floor keeps growing. Ring after ring is laid around it, clockwise, carrying the pattern outward, until the floor reaches the dark at the edge of the light. The open field goes a little faster than the pattern. At the default speed a floor takes about three minutes; at the slowest, about twelve.
4. When the floor is complete, the joints are filled in a sweep out from the centre.
5. The finished floor stays until nothing has been done to the screen for two minutes. Any input restarts the two minutes: a drag, a zoom, a key, the mouse moving. Then it fades out, and a new floor begins with the next seed.

A mason's order is followed. Repeating designs go row by row from the far wall, or along the diagonal. Centred designs go out from the centre, as setting-out from the centre lines would require. In each square, the half that meets already-laid work goes down first.

The view starts zoomed out as far as it goes, seen from 48° above the horizon. It turns around the floor once every three minutes. It can be turned, tilted, zoomed and moved at any time; see Controls. After eight seconds without input it eases back into turning.

## The tilings

`tilings.js` builds each tiling as a list of stones, each with a class (its shape and design), a placement (a turn and possibly a mirror), and its place in the laying order. Each tiling makes its own choices of design, rule or shape; see "The record of floors" for how they are drawn. The **Tiles** setting or `tiles=` fixes one tiling.

- **Douat's half squares**, in stone. Two triangular stones per 25 cm square, composed as below.
- **Smith's quarter circles**, in cement tiles of 20 cm. Each tile has a quarter disc in two opposite corners. It comes in two printings, dark discs on light and the reverse. The printing follows from the tile's turn and the parity of its corner, so the colour fields always meet across edges and the arcs join into continuous shapes. Turns are a fair coin per tile or a Douat composition from `pattern.js`. Three designs:
  - plain discs;
  - discs outlined in a third pigment;
  - one round corner and one straight one, half Smith and half Truchet. This tile has a single mirror line, so it has four orientations instead of two and carries Douat's four-state compositions in full. Walter, Ligler and Gürsoy's Truchet tile grammar (2024) points out that lowering the symmetry multiplies the distinct neighbour pairs.
- **Truchet's arcs**, in cement tiles of 20 cm: two quarter-circle bands round opposite corners, so lines run on through every tile and close into loops and meanders. The bands are plain or carry a centre line in a third pigment, on a light or a dark ground. Turns are at random, by a Douat composition, in circles, or in waves.
- **Hexagons**, in cement tiles 20 cm across the flats, with three arcs round alternate corners, so each has two orientations. Four designs:
  - the arcs as bands, plain or with a centre line;
  - the arcs as the edges of colour fields, the hexagonal form of Smith's tile, plain or outlined. Tiles turned a sixth are printed the other way round. That keeps one class of the honeycomb's corners dark and the other light, so the fields meet across every edge.

  The orientation follows one of five rules: at random, in rings round the centre, in columns, one in three alike, or in diagonal bands.
- **Cubes**, in stone: rhombs of 60° with 16 cm edges, in light, middle and dark stone by the way they face, so the floor reads as a surface of cubes. Four shapes:
  - **Blocks** splits each hexagon of a lattice into three rhombs, one of two ways, a cube or a hollow: a Truchet tile on the hexagon. The hexagon rules above apply, plus all cubes, the classic tumbling blocks.
  - **A random pile** is a stack of cubes in a corner drawn uniformly at random. It comes from 12·n⁴ moves of single cubes in an n × n × n box, from a half-full start, in about 0.1 s for the usual n of 25. Its middle is disordered, and towards the corners of the hexagon it freezes into flat walls: the arctic circle of Cohn, Larsen and Propp.
  - **Terraces** and **stairs** are stacks shaped by two random staircases, taking the smaller or the sum of the two.
- **Penrose rhombs**, in stone with 19 cm edges. The P3 tiling comes from repeated deflation of Robinson triangles, paired into thick and thin rhombs. It never repeats. On seven floors in ten the thick rhombs are bluestone and the thin ones limestone; otherwise the reverse. They are laid out from the centre.
- **Penrose's arcs**, the same rhombs as cement tiles of 16, 19 or 22 cm. Each carries Penrose's two families of arcs, round the two ends of the triangles' shared edge. Those are the sharp corners of a thick rhomb and the blunt corners of a thin one. What may vary was found by testing candidates against all 2,210 shared edges of a large patch:
  - **First family.** Round one end the arcs have radius ρ on thick rhombs and 1 − ρ on thin ones, for any ρ: across an edge between a thick and a thin rhomb that end lies at opposite ends. These wind into long curves and closed loops that never repeat. No colour field bounded by them joins everywhere, so they stay lines, single or double.
  - **Second family.** Round the other end the arcs share one radius σ, any σ. Every rhomb at such a corner has its second end there, so these close into rings, and may equally be double rings, filled dots, dots in rings, or left out.
  - **Free parameters.** Each floor draws ρ between 0.52 and 0.88 of an edge, σ, the widths of both families, and the inks: two pigments, swapped, one pigment, or light lines on a dark ground. The draws repeat until the lines stay inside each rhomb and clear of each other across the thin rhomb's short diagonal. Wide double lines with double rings cannot fit on the smallest rhombs; those floors keep the lines alone.

## Douat's designs

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

### Cement tiles

Smith, Truchet arc, hexagon and Penrose arc floors use encaustic cement tiles: a pigmented face layer pressed onto a grey concrete body. They are modelled as old floors, not new stock.

- **Face.** Honed flat with fine pores and dirt-filled pinholes. The pigment is cloudy, the darker one more so. Marble dust shows as specks in the face layer.
- **Figure.** The border between pigments wanders gently and bleeds a little, as poured pigment does. A third pigment draws outlines and centre lines, and Penrose's second arcs.
- **Age.** Each tile has its own age. Traffic thins the face in drifts, where the figure greys towards the body and the ground takes up grime. The ground yellows from tile to tile. A few tiles carry a soft old stain. Scratches, edge grime and chips that show the grey body all grow with age.
- **Laying.** Pressed tiles sit truer than hand-cut stone: offsets, turn, lippage and tilt are about a third of the stone values, with tight 1.6 mm joints in dirty grey grout.

Four cement palettes exist: black and white with red, oxblood and cream with black, slate blue and white with ochre, ochre and black with cream.

The cube floors need a third stone. Each stone pairing has a middle one, a grey limestone drawn with the limestone model in its own colour.

Three stone pairings are drawn at random per floor (`materials.js`):

- **Reclaimed bluestone and cream limestone**, tight dark joints, weight 5.
- **Honed petit granit and grey limestone**, weight 3.
- **Worn bluestone and limestone in lime mortar**, weight 2.

## Checked against a photograph

The user's top-down photograph has about 155 px per stone. `tools/measure_photo.py` measures it per stone: mean luminance, stone-to-stone spread, and within-stone spread in three bands. The bands are coarse (Gaussian σ 12 px), mid (σ 2 to 12) and fine (below σ 2), plus a median luminance profile across the joints. `tools/measure_render.py` applies the same measurement to a render of the view from above, rescaled to the same stone size: `?still&seed=7&photo`, 1600×900 at 2× pixel density. In the page, `douat.measureArgs()` prints the arguments it needs.

| sRGB luminance | Photo, dark | Render, dark | Photo, light | Render, light |
|---|---|---|---|---|
| Mean | 81.3 | 83.3 | 186.4 | 178.9 |
| Stone-to-stone spread | 12.1 | 12.4 | 10.3 | 9.6 |
| Within stone, coarse | 7.3 | 6.3 | 5.2 | 4.2 |
| Within stone, mid | 5.4 | 4.9 | 4.3 | 5.9 |
| Within stone, fine | 8.5 | 4.4 | 9.5 | 8.8 |

| Joints | Photo | Render |
|---|---|---|
| Darkest point | 43 | 51 |
| Width below half depth | 3 px | 3 px |

These are 40 stones of each colour from one floor, `?still&seed=7&photo&tiles=douat&material=reclaimed`. Across four seeds the light mean runs from 179 to 183 and the dark from 80 to 83. The photo is a sharpened, compressed web image. Its fine band therefore includes noise and halo that the render does not try to copy. The dark stones' coarse and fine texture is still lighter than in the photo. The colour of the light stone is (193,177,152) against the photo's (201,185,160).

The three other photographs are oblique and were used by eye only: for edges, flaking, lime joints and fossil debris.

## Controls

The cog at the top right opens the settings; it shows when the mouse moves or the screen is touched, and stays faintly visible on touch screens. The panel describes the floor being laid, and sets:

- **Speed** in five steps, each twice the one before: 1 is a stone every 1.1 s, 3 (the default) four times that, 5 sixteen times.
- **Pause**, **turning** of the view on or off, and **reset view**.
- **Tiles:** any tiling drawn per floor, or one fixed tiling.
- **Material:** any that suits the tiles, or one fixed stone or cement pairing. Choosing tiles or a material from the other family resets the other choice to any. Changing either starts a new floor.
- **Floors so far:** how many floors this browser has shown, by tiling, and the last eight. Choosing one lays it again.
- **Another floor** and **full screen** (where the browser allows it).

Speed, turning, tiles and material are remembered in the browser. With a mouse: drag to turn and tilt, wheel to zoom, right-drag or shift-drag to move, double-click to reset. On a touch screen: drag, pinch, two fingers to move. Keys: `n` new floor, `space` pause, `1` to `5` speed, `r` reset view, `f` full screen, `Esc` closes the panel.

URL parameters:

- `seed=n` repeats a floor; the next floor uses `n+1`.
- `still` shows the finished floor at once.
- `speed=x` multiplies the laying speed directly, overriding the speed setting (step 3 is `speed=4`).
- `hold=s` sets how long a finished floor stays without input, in seconds (120 by default).
- `tiles=douat|smith|loops|hex|cubes|penrose|arcs` fixes the tiling.
- `pick=name,name` takes these wherever they appear among a floor's choices, for example `tiles=cubes&pick=a random pile` or `tiles=smith&pick=round and straight corners,by Douat's rule`.
- `material=reclaimed|petit-granit|lime|cement-black|cement-oxblood|cement-blue|cement-ochre` fixes the pairing; one that does not suit the tiles is replaced by one that does.
- `cells=n` sets the number of squares across the first, patterned area.
- `view=yaw,pitch,distance` sets the starting view in degrees and as a fraction of the starting distance, for example `view=60,35,0.5`.
- `spin=minutes` sets how long one turn of the view takes (3 by default); `spin=0` holds the view still.
- `photo` starts straight down, at the framing of a photograph of the floor, without turning. The measurements below use it.
- `low` uses smaller textures and shadow maps; touch devices do this by themselves.
- `freeze=n,u` lays stones before `n` at once, then holds stone `n` at fraction `u` of its flight. It is for inspecting the animation.

## The record of floors

Every floor shown is recorded in this browser's local storage: when, its seed, and each choice made for it. The record holds the tiling, the material, and the tiling's own design, rule, shape, printing or colours. Up to 500 floors are kept.

Each choice is a weighted draw. A choice made on recent floors has its weight cut by a factor of e^(−1.6·r), where r sums 0.75^n over the floors n back that made it. The floor just shown counts 1, so its choice drops to about a fifth. Forty floors in a row from a clear record covered all seven tilings, with two back-to-back repeats, and the first seven were all different.

Every draw takes exactly one random number, whatever the record says. A floor is therefore fully given by its seed and its recorded choices, and choosing it in the panel lays it again exactly. A floor named by `seed=` in the address ignores the record, so that it comes out the same everywhere.

## How it is drawn

- **Baked material.** When a floor starts, the stone model in `material.js` is evaluated once into textures, while the screen is still dark. Each class of stone (a dark triangle, a thick rhomb, a hexagonal tile) gets a pool of 56 distinct stones, 32 on low-power devices, each with its own joint, corner radius and history. Each pool stone takes one atlas slot at about 0.95 mm per texel: colour, roughness, normals from the height field, cavity, and which stone owns each texel. Its outline is an exact rounded polygon read from a small table. A second texture holds the mortar bed. The model is the same code that was tuned against the photograph.
- **Placing stones.** Every stone of the floor takes a random pool stone of its class, turned and possibly mirrored into place. It keeps its own offset, turn, lippage and tilt. A mirrored stone flips its tangent frame so that its relief still lights correctly. Giving every stone its own texture would need about a gigabyte of graphics memory; with 56 of each, repeats cannot be picked out.
- **Real geometry.** `geometry.js` builds each stone as a mesh, in laying order, so the stones laid so far are one prefix of the vertex buffer. A top is a polygon slightly larger than the stone, cut to its hand-dressed outline by the baked ownership, with smooth edges via alpha-to-coverage. Its sides are vertical faces just inside that outline. Offsets, turn, lippage and tilt are in the vertices. `stonelib.js` mirrors the shader's random numbers so that geometry and texture agree.
- **The stone in flight.** It is the same mesh with a moving transform, so it is a full 3D stone and lands exactly where it stays.
- **Shadows.** One sun shadow map covers the laid floor and is redrawn only when a stone lands. A second, small one follows the stone in flight. Shadows are percentage-closer soft shadows: the penumbra grows with the gap between blocker and receiver.
- **Joints.** The tops of laid stones are drawn from above into a coverage map. Its mipmaps give how enclosed any point of the bed or filling is, which is what darkens a narrow joint. The filling is a plane just below the tops, drawn only where no stone top covers the pixel, using the stencil. It appears in a growing circle as the joints are filled.
- **Speed.** On an RTX A4000 a frame takes about 3.8 ms at 3200×1800 with 700 stones down and one in flight. Redrawing the floor's shadow map after a landing costs about 1.7 ms. Frames are only drawn when something moves, which with the view turning is every frame.
- **Compile time.** Browsers on Windows compile WebGL through Direct3D's HLSL compiler, which slows down sharply on large shaders and on loops around large bodies. The first version, one program inside a per-pixel sample loop, took 10 to 24 s. The bake now compiles once per page load in about 1.5 s, and Chrome caches it for later visits. Noise reads a 512² table of random bytes, with quintic interpolation done in the shader.

`tools/shot.mjs` drives headless Chrome over the DevTools protocol, with the cache off. It waits for a condition in the page, evaluates an expression and saves a screenshot. It is how the numbers above were made.

## Not done yet

- Floor-wide traffic wear: worn paths that develop after the floor is laid. Wear is currently per stone, as in a relaid reclaimed floor.
- More tile designs. The renderer takes any convex polygon with up to six corners and any design drawn in the tile's own frame. Candidates: Cairo pentagons, as in the streets of Cairo, and hats or spectres, the aperiodic monotiles of 2023. Those are not convex, which the outline offsetting and the top mesh assume.
- Light that follows the time of day.
- Very close views go soft: the atlas holds about 0.8 mm per texel.
