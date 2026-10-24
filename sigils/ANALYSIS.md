# Goetic sigils: visual analysis and a generation specification

Research and revision date: 24 October 2026. Scope: analysis and documentation for a future browser-only generator; no generator is implemented here. This revision incorporates selected improvements from the supplied *Goetic sigil analysis and generator specification.md* and corrects several edge cases in both documents. See [REVIEW.md](REVIEW.md) for the assessment.

## Findings

The supplied sheet can be reproduced with a small vector vocabulary, but its individual designs require stored, manually checked geometry. New sigils with a similar visual character can be generated using a constrained grammar: choose a structural skeleton, add repeated or mirrored members, attach terminal ornaments, then introduce limited asymmetry.

Kameas offer a separate, deterministic way to turn names into drawings. They are useful for a generation mode, but the sources examined do **not** establish a name-to-kamea algorithm that reconstructs the 72 Goetic seals. A design that resembles one of these seals is not evidence of its historical derivation.

The recommended eventual application has four explicitly labelled modes:

| Mode | Input | Output | Basis |
|---|---|---|---|
| Reference | Spirit ID and variant | A checked vector reconstruction | Recorded historical drawing |
| Invented Goetic-style | Seed and visual controls | New composition from a shape grammar | Analysis and design proposal in this document |
| Name-seeded style | Name and visual controls | Repeatable grammar output using a name hash | Modern design; hashing is not historical letter encoding |
| Kamea | Text, alphabet mapping, square, conventions | An ordered route through numbered cells | Historical numerical tradition with explicitly declared implementation choices |

The two style modes share one generator; their seed inputs differ. Reference, style generation, and kamea tracing have distinct data contracts. Optional borders and captions are presentation layers rather than extra construction modes.

## 1. The supplied image

File: [72_Goeta_sigils.png](72_Goeta_sigils.png), 2048 × 1519 pixels. It contains an eight-row, ten-column arrangement: **80 drawings representing 72 numbered identities**. Eight identities have a second drawing labelled with a `b`: 9, 13, 14, 18, 26, 42, 47, and 70. These are variants, not eight additional spirits.

The image is a clean black-on-white compilation with name labels, rather than an unedited manuscript page. At this resolution, broad structure is clear, but individual curls, small intersections, and the exact attachment of strokes need enlarged, source-specific inspection before tracing. The descriptions below are visual observations, not measured vector annotations.

The local file's SHA-256 is `6a6df81aef47ef7292df3bf6918e3b004a0876093f6398031cc5ba5accc20995`. This identifies the bytes inspected; it does not by itself establish a match to a remote revision.

The matching [Commons file page](https://commons.wikimedia.org/wiki/File:72_Goeta_sigils.png) identifies the compilation with Mathers and Crowley's *Goetia* (1904) and lists a September 2026 edit correcting Astaroth. It currently labels the compilation CC BY-SA 4.0. Matching title, dimensions, and appearance identify a likely source, but the local file has not been byte-matched to a particular Commons revision. Record the exact revision when preparing distributed reference assets; do not infer the compilation's licence merely from the age of its historical subject.

## 2. Cross-reference with the requested list

The [Wikipedia list](https://en.wikipedia.org/w/index.php?title=List_of_sigils_of_demons&oldid=1376037641) contains the same 72 Goetic identities, plus Lucifer from *Grimorium Verum*. Its ordering differs: Astaroth appears after Andromalius rather than in the sheet's position 29. Its origin column identifies the Goetic entries with the *Lesser Key*, not with individually specified construction algorithms. Lucifer is outside the supplied sheet.

A direct browser inspection also confirms the feedback's useful border distinction: the list's Bael and Agares assets show the core drawing inside concentric circles with perimeter lettering, whereas the supplied sheet omits those surrounds. Store `core`, `border`, `perimeterText`, and `caption` separately. This rendering separation does not establish that a border was historically optional in every witness; preserve the complete source composition too.

The following is an **identity and spelling crosswalk**, accompanied by my visual inventory of the local sheet. It is not a claim that every curve matches Wikipedia's currently displayed individual asset. Historical variants should be retained by source rather than collapsed into a single supposedly definitive seal. Links lead to the list's named subject pages; origin for all 72 entries is the *Lesser Key* as catalogued in the requested list.

| Sheet ID | Wikipedia name | Structure visible in the supplied drawing |
|---|---|---|
| 1 | [Bael](https://en.wikipedia.org/wiki/Bael) | Cross-headed diagonal arms, central band, splayed ring-ended legs |
| 2 | [Agares](https://en.wikipedia.org/wiki/Agares) | Ring-topped rail, central cross, nested hanging arcs |
| 3 | [Vassago](https://en.wikipedia.org/wiki/Vassago) | Axial staff, branched ring terminals, stepped lower enclosure |
| 4 | [Samigina](https://en.wikipedia.org/wiki/Samigina) | Stacked crosses over a gridded domed base |
| 5 | [Marbas](https://en.wikipedia.org/wiki/Marbas) | Central ring, forked upper arms, three descending stems |
| 6 | [Valefor](https://en.wikipedia.org/wiki/Valefor) | Tilted oval and ring fringe over an asymmetric crossbar |
| 7 | [Amon](https://en.wikipedia.org/wiki/Amon_(demon)) | Rounded rectangular frame, curled edges, central bar and glyph |
| 8 | [Barbatos](https://en.wikipedia.org/wiki/Barbatos) | Arched frame, internal crosses, repeated baseline bars |
| 9, 9b | [Paimon](https://en.wikipedia.org/wiki/Paimon) | Repeated upright loops and rings on horizontal rails |
| 10 | [Buer](https://en.wikipedia.org/wiki/Buer_(demon)) | Quartered wheel attached to a cross and lower crossbars |
| 11 | [Gusion](https://en.wikipedia.org/wiki/Gusion) | Comb of parallel stems, hanging rings, outward curled feet |
| 12 | [Sitri](https://en.wikipedia.org/wiki/Sitri) | Three crosses on a rail above a semicircular bowl |
| 13, 13b | [Beleth](https://en.wikipedia.org/wiki/Beleth) | Irregular cursive upper strokes over a barred, ringed base |
| 14, 14b | [Leraie](https://en.wikipedia.org/wiki/Leraie) | Sheet: Leraje variants; bowl with ringed rim and central angular glyph |
| 15 | [Eligos](https://en.wikipedia.org/wiki/Eligos) | Sloping looped rail, arrow-like right end, row of lower rings |
| 16 | [Zepar](https://en.wikipedia.org/wiki/Zepar) | Broad crossbar, triple uprights, bowed sides and paired curls |
| 17 | [Botis](https://en.wikipedia.org/wiki/Botis) | Ring-cornered quadrilateral containing stacked crosses |
| 18, 18b | [Bathin](https://en.wikipedia.org/wiki/Bathin) | Dense banded bowl on left, crossing stems and curved right appendage |
| 19 | [Sallos](https://en.wikipedia.org/wiki/Sallos) | Repeated vertical stems with rings and curled lateral brackets |
| 20 | [Purson](https://en.wikipedia.org/wiki/Purson) | Ring-topped central body, lower loops, diagonal toothed extension |
| 21 | [Marax](https://en.wikipedia.org/wiki/Marax) | Sheet: Marax/Morax; angular zigzag with ring clusters and curved tips |
| 22 | [Ipos](https://en.wikipedia.org/wiki/Ipos) | Paired sloping legs around central crossbar ladder |
| 23 | [Aim](https://en.wikipedia.org/wiki/Aim_(demon)) | Bowed left spine, ring-ended bars and curved right branches |
| 24 | [Naberius](https://en.wikipedia.org/wiki/Naberius) | Parallel bent horizontal strokes meeting an ornate right boundary |
| 25 | [Glasya-Labolas](https://en.wikipedia.org/wiki/Glasya-Labolas) | Rectangular left compartment and droplet-like right compartment |
| 26, 26b | [Bune](https://en.wikipedia.org/wiki/Bune) | Primary: dense organic tangle; alternate: horizontal comb with rings |
| 27 | [Ronove](https://en.wikipedia.org/wiki/Ronove) | Sheet: Ronové; angular upper rail, lower curls and hanging ring stems |
| 28 | [Berith](https://en.wikipedia.org/wiki/Berith) | Rounded enclosure, internal grid, crosses and asymmetric lower flourish |
| 29 | [Astaroth](https://en.wikipedia.org/wiki/Astaroth) | Interlaced diagonals, tall ring-tipped stems, dotted accents |
| 30 | [Forneus](https://en.wikipedia.org/wiki/Forneus) | Paired rounded vertical cells with an internal ladder and side staffs |
| 31 | [Foras](https://en.wikipedia.org/wiki/Foras) | Wide bowed frame around repeated bars and crosses |
| 32 | [Asmoday](https://en.wikipedia.org/wiki/Asmoday) | Sheet: Asmoday/Asmodai; right-heavy curved enclosure and loop fringe |
| 33 | [Gaap](https://en.wikipedia.org/wiki/Gaap) | Horizontal capsule with four interior rings and cross-ended spine |
| 34 | [Furfur](https://en.wikipedia.org/wiki/Furfur) | Curled lateral brackets, central comb and downward triangle |
| 35 | [Marchosias](https://en.wikipedia.org/wiki/Marchosias) | Splayed curved uprights, central cross, ringed horizontal beam |
| 36 | [Stolas](https://en.wikipedia.org/wiki/Stolas) | Sheet: Stolas/Stolos; stepped frame with cross and ring-bearing extension |
| 37 | [Phenex](https://en.wikipedia.org/wiki/Phenex) | Sheet: Phenex/Pheynix; stepped top, crossed bar, large right curve |
| 38 | [Halphas](https://en.wikipedia.org/wiki/Halphas) | Angular block-like outline, interior cross and upper circles |
| 39 | [Malphas](https://en.wikipedia.org/wiki/Malphas) | Rounded horizontal body, paired internal branch motifs, side staff |
| 40 | [Raum](https://en.wikipedia.org/wiki/Raum) | Pointed left end, stepped panels, gridded rounded right end |
| 41 | [Focalor](https://en.wikipedia.org/wiki/Focalor) | Crossed diagonals, serrated left stroke, ringed branch and cross staff |
| 42, 42b | [Vepar](https://en.wikipedia.org/wiki/Vepar) | Dense repeated upper loops over a bowl and hanging glyphs |
| 43 | [Sabnock](https://en.wikipedia.org/wiki/Sabnock) | Sheet: Sabnock/Savnok; upper U and rings above arrowed lower rail |
| 44 | [Shax](https://en.wikipedia.org/wiki/Shax) | Sheet includes Shan/Shax/Shaz/Shass; two joined rounded compartments |
| 45 | [Vine](https://en.wikipedia.org/wiki/Vine_(demon)) | Crown-like top above a narrowing shield containing a cross |
| 46 | [Bifrons](https://en.wikipedia.org/wiki/Bifrons) | Sheet: Bifrons/Bifrovs; curved canopy with diagonal hanging stems |
| 47, 47b | [Vual](https://en.wikipedia.org/wiki/Vual) | Sheet: Uvall/Vual/Oval; stepped body, central parallel bars, lower cross |
| 48 | [Haagenti](https://en.wikipedia.org/wiki/Haagenti) | Rectilinear compartments on a horizontal beam, rings and lower crosses |
| 49 | [Crocell](https://en.wikipedia.org/wiki/Crocell) | Sheet: Crocell/Crokel; banded shield, cross and serrated outer flanks |
| 50 | [Furcas](https://en.wikipedia.org/wiki/Furcas) | Ring-cornered ladder with four uprights and lower triangle |
| 51 | [Balam](https://en.wikipedia.org/wiki/Balam_(demon)) | Diagonal stem with branching rings, angular head and curved foot |
| 52 | [Alloces](https://en.wikipedia.org/wiki/Alloces) | Sheet: Alloces/Alocas; framed grid, interior crosses and ring terminals |
| 53 | [Camio](https://en.wikipedia.org/wiki/Camio) | Sheet: Caim/Camio; irregular compartmented outline and curled projections |
| 54 | [Murmur](https://en.wikipedia.org/wiki/Murmur_(demon)) | Crossed diagonal supports, crescents and axial crosses |
| 55 | [Orobas](https://en.wikipedia.org/wiki/Orobas) | Squared enclosure, patterned top and large curled right extension |
| 56 | [Gremory](https://en.wikipedia.org/wiki/Gremory) | Sheet: Gremory/Gamori; ringed crown, cross and curved lower bowl |
| 57 | [Ose](https://en.wikipedia.org/wiki/Ose_(demon)) | Diagonally crossed square, serrated sides and internal crosses |
| 58 | [Amy](https://en.wikipedia.org/wiki/Amy_(demon)) | Sheet: Amy/Avnas; tilted stepped outline and sawtooth upper edge |
| 59 | [Orias](https://en.wikipedia.org/wiki/Orias) | Sheet: Oriax/Orias; Y-shaped axial structure with squared lower feet |
| 60 | [Vapula](https://en.wikipedia.org/wiki/Vapula) | Heart-like upper lobe, broad U frame, serrated sides, lower cross |
| 61 | [Zagan](https://en.wikipedia.org/wiki/Zagan) | Long stepped rail with several hanging glyphs and ring endpoints |
| 62 | [Valac](https://en.wikipedia.org/wiki/Valac) | Sheet includes Volac/Valak/Valu/Ualac; radial left hub and curved right lobe |
| 63 | [Andras](https://en.wikipedia.org/wiki/Andras) | Ring-tipped grid, paired hanging curved shapes and lower triangle |
| 64 | [Haures](https://en.wikipedia.org/wiki/Haures) | Sheet includes Hauras/Havres/Flauros; broad upper arc and serrated sides |
| 65 | [Andrealphus](https://en.wikipedia.org/wiki/Andrealphus) | Stepped curved enclosure, central curls and downward angular pendant |
| 66 | [Cimeies](https://en.wikipedia.org/wiki/Cimeies) | Sheet: Cimejes/Cimeies/Kimaris; irregular stepped outline and central triangle |
| 67 | [Amdusias](https://en.wikipedia.org/wiki/Amdusias) | Sheet also Amdukias; compartmented ringed left body and right triangular beam |
| 68 | [Belial](https://en.wikipedia.org/wiki/Belial) | Broad crenellated canopy with several hanging glyphs |
| 69 | [Decarabia](https://en.wikipedia.org/wiki/Decarabia) | Crossed diagonals, four outer rings, crescents and a cross |
| 70, 70b | [Seere](https://en.wikipedia.org/wiki/Seere) | Sheet: Seere/Sear/Seir; rounded serrated boundary with cursive interior |
| 71 | [Dantalion](https://en.wikipedia.org/wiki/Dantalion) | Ring-topped left ladder, stepped base and long curved right arm |
| 72 | [Andromalius](https://en.wikipedia.org/wiki/Andromalius) | Three barred levels, central vertical line and curled upper mark |

Spelling is a poor database key: retain a numeric identity, an exact source label, aliases, and a variant identifier. Some marks look like letters or objects; the descriptions above deliberately use geometric terms and do not assign symbolic meanings to those resemblances.

## 3. Visual grammar derived from the sheet

### 3.1 A small vocabulary, many arrangements

| Element | Examples | Suitable vector representation |
|---|---|---|
| Straight staff, beam, diagonal | 1, 22, 50, 72 | Line segments and polylines |
| Angular or stepped enclosure | 36–38, 47, 58, 66, 68 | Orthogonal polygonal paths |
| Bowl, shield, capsule, canopy | 2, 12, 14, 30, 33, 45 | Elliptical arcs or cubic Bézier paths |
| Open-circle terminal | 3, 5, 11, 50 | Unfilled circle attached to a stem |
| Curled terminal | 11, 19, 31, 55 | Short cubic curves with controlled winding |
| Cross and flared cross | 4, 12, 17, 31 | Dedicated filled outline, not a font glyph |
| Fork, arrowhead, triangle | 5, 15, 34, 43, 50 | Small outlined or filled polygon |
| Repeated bars, loops, teeth | 9, 11, 24, 42, 49 | Motif repeated along a rail or boundary |
| Crescent and rounded lobes | 54, 60, 69 | Paired arcs or a closed crescent outline |
| Dots and small satellites | 29, 34, 67 | Circles placed independently of major strokes |

This supports a **decorated graph** representation. Structural members form a graph; crossings may or may not be graph junctions. Ornaments attach to nodes, endpoints, or locations along an edge. Some outlines and isolated marks remain separate components. A single continuous pen stroke is not an adequate universal model. However, branch-like appearances alone do not disprove a route construction: a polyline can revisit vertices and retrace segments. Treat visual topology as evidence to test, not as an automatic impossibility proof.

### 3.2 Composition is more important than ornament count

Several distinct structural families are visible:

1. **Axial branching:** a central staff with lateral arms or splayed legs, e.g. 1, 3, 5, 22, 59.
2. **Rail and comb:** repeated stems attached to one or more beams, e.g. 9, 11, 19, 50, 72.
3. **Bowl or shield:** a rim, curved lower boundary, and internal members, e.g. 2, 12, 14, 45, 49.
4. **Compartmented frame:** cells or stepped boundaries with inserted glyphs, e.g. 17, 30, 36–40, 47–48, 52.
5. **Diagonal or radial assembly:** crossed supports and terminal motifs, e.g. 29, 54, 57, 62, 69.
6. **Cursive or organic assembly:** irregular loops and lobes, e.g. 13, 26, 53, 70.

These are overlapping design categories, not historical classifications. For example, 50 is both a frame and a comb. A generator should select a dominant family and optionally borrow one secondary motif family.

Many designs use bilateral balance without exact reflection of every detail. Others are strongly directional or asymmetric. Whole-symbol mirroring would overproduce logos and underproduce the irregular signatures in the sheet. Better controls are `none`, `structural`, and `strict` symmetry: structural symmetry mirrors the skeleton while allowing different ornaments on the two sides.

Repetition supplies rhythm: aligned terminals and evenly spaced bars make a complex image feel intentional. Negative space matters equally. The open interiors of 12, 14, 45, and 50 distinguish them from the much denser 26 or 42. The generator needs separate controls for skeleton complexity and ornament density.

### 3.3 What the variants teach

Paimon's pair preserves the repeated upright-and-rail idea despite changes in curvature and detail. Leraje's pair preserves a bowl while changing the central angular form. Vual's pair shares a stepped body and central bars. Seere's pair shares an enclosing scalloped/serrated mass while differing internally. Bune's pair differs much more substantially in silhouette.

Therefore, a variant must sometimes be a separate drawing recipe, not just random perturbation of one path. Do not interpolate between historical alternatives and label the result historical.

### 3.4 Quantitative calibration and its limits

The feedback introduces valuable candidate measurements: aspect ratio, ink coverage, connected components, and reflection similarity. It reports median aspect ratio 1.208, median ink coverage 0.228, and median component count 2. Those results are **reported by the supplied feedback and have not been independently reproduced here**. They should not yet become acceptance thresholds. Exact crop coordinates, per-drawing results, connectivity convention, and a runnable measurement procedure were not supplied with it.

To make that evidence reproducible, retain the following with a future analysis run:

| Record | Required detail |
|---|---|
| Input | Image hash, dimensions, and revision/source |
| Crop manifest | Identity, variant, exact integer rectangle in original pixels, label masks, excluded material |
| Pixel processing | Colour conversion, alpha compositing, strict/non-strict threshold comparison, resampling, denoising order |
| Components | Four- or eight-neighbour connectivity, minimum area, whether discarded pixels affect bounds/density |
| Results | Raw values per drawing, empty/clipped crop flags, percentile interpolation convention, tool versions |
| Visual QA | Annotated crop/contact sheet demonstrating that labels and adjacent drawings are excluded |
| Sensitivity | Repeat with thresholds such as 96, 128, and 160 and modest crop changes; identify unstable results |

Evaluate aspect and ink coverage on each tight core bounding box. For rendered comparisons also fix output scale, stroke profile, anti-aliasing, and threshold; these change the measurement. Pixel components are not semantic components: an intended contact can break into pieces at one threshold, while a close crossing can merge. Ring holes, graph cycles, and enclosure relationships likewise need separate treatment.

Do not force ordinary outputs into the middle 50% of reference density: by definition that would exclude half the reference observations. Use broad, preferably family-specific distributions as soft priors and retain intentional outliers such as long Zagan-like silhouettes. A square SVG viewport can contain a wide core without stretching it into a square.

The 80 drawings are not 80 independent identities. For identity-balanced calibration, give each variant weight `1 / numberOfVariantsForItsIdentity`, or report results both per drawing and per identity. Otherwise the eight doubled identities disproportionately influence tuning. Keep variants of one identity together in any evaluation split.

## 4. Historical construction: what can be supported

Use four evidence labels throughout future annotations: **observed** (visible in a specified image), **documented** (present in an identified witness or instruction), **inferred** (a proposed explanation of observations), and **proposed** (a modern generation convention). A documented historical instruction is not, by itself, documentation that it produced a particular Goetic seal.

### 4.1 The Goetic seals are transmitted designs

Peterson's [Goetia edition](https://www.esotericarchives.com/solomon/goetia.htm), based on Sloane MS 3825 with variant readings, presents seals alongside individual spirits. Its introduction distinguishes this seal-bearing catalogue from earlier *Offices of Spirits* witnesses. The entries give drawings to use, rather than a general geometric recipe for recovering every seal from its name. Its Bune entry explicitly includes an alternative seal; variants are therefore present in the textual tradition, not merely a modern software convenience.

**Research conclusion:** no universal recovery procedure was located in the consulted sources. This is a bounded finding, not proof that no historical rationale ever existed. Similar circles, crosses, or letter-like forms are insufficient to establish a particular alphabet, planet, or encryption scheme. Any claimed derivation should specify the source, exact spelling, mapping, table orientation, and every finishing operation, then reproduce the target without discretionary repairs.

### 4.2 Kameas: planetary numerical tables

Agrippa's [*Occult Philosophy*, II.22](https://www.esotericarchives.com/agrippa/agripp2b.htm) supplies planetary number squares and distinguishes planetary seals from characters of associated intelligences and spirits. A square's size alone does not specify the arrangement of its numbers. For source comparison, preserve the actual table orientation and layout.

| Planet | Order n | Cell range | Row/column magic sum | Sum of all cells |
|---|---:|---:|---:|---:|
| Saturn | 3 | 1–9 | 15 | 45 |
| Jupiter | 4 | 1–16 | 34 | 136 |
| Mars | 5 | 1–25 | 65 | 325 |
| Sun | 6 | 1–36 | 111 | 666 |
| Venus | 7 | 1–49 | 175 | 1225 |
| Mercury | 8 | 1–64 | 260 | 2080 |
| Moon | 9 | 1–81 | 369 | 3321 |

The sums follow directly from `M = n(n² + 1)/2` and `T = n²(n² + 1)/2`. A mathematically valid alternative square can still produce a different drawing. Planetary seals, intelligence characters, spirit characters, and the Goetic set are different reference categories; similarity of names does not equate them.

For the proposed **name-tracing mode**, use this explicit pipeline:

```text
original text
  → declared spelling/transliteration and reading order
  → ordered letter values (not their total)
  → declared reduction into the chosen square's range
  → ordered cell centres
  → connecting path
  → declared start/end/repetition marks
```

This is an operational specification. It does not assert that all its conventions are given in II.22. Hebrew numerical spellings, Latin letter positions, digit reduction, removal of zeros, and modular reduction are not interchangeable. Store the selected convention and show the intermediate values. A text total discards order and cannot determine the route.

For a first implementation, provide a transparently **modern Latin profile**: A=1 through Z=26; retain letter order and repetitions; reduce each value with `1 + ((value - 1) mod n²)`. This always yields an in-range cell, but is an application choice, not an asserted historical rule. A historically sourced Hebrew profile should be added only with its precise letter and reduction conventions documented.

Make normalization a versioned part of the modern profile. First apply Unicode NFKC, then validate against ASCII `A–Z`/`a–z` plus the whitespace and punctuation the profile explicitly permits. Reject digits, unsupported letters, symbols, and control characters with their positions; show the normalized text before generating. Only after validation uppercase ASCII letters and remove the permitted separators. Validating before unrestricted Unicode uppercasing avoids accidentally accepting expansions such as `ß → SS`. NFKC deliberately admits compatibility forms such as full-width Latin letters; accents require a separately named transliteration profile rather than silent stripping.

Worked modern example, deliberately using a Goetic name to expose the distinction:

```text
Saturn-layout example, top row first:
4  9  2
3  5  7
8  1  6

BAEL → [2, 1, 5, 12] → [2, 1, 5, 3]
cell centres as (column,row), zero-based:
[(2,0), (1,2), (1,1), (0,1)]
```

Connect those points in order. For this application profile, draw a small ring at the start and a short perpendicular cap at the end, unless either collides with another mark. The resulting route is **a new BAEL-derived kamea design**, not the supplied Bael seal. The visible source seal has branches and a central assembly not reproduced by these four points.

Adjacent repetitions require an explicit policy because their segment has zero length: preserve their position in metadata and add a small loop marker in the drawing. Distinguish these from a return to a cell after intervening letters. Classify by ordered route length, not the number of distinct cells:

- Empty sequence: prompt, no route.
- One entry: standalone mark.
- Two entries: one segment if different, or the repeated-cell treatment if equal.
- More entries: preserve every visit in order. `ABA → [1,2,1]` has two traversals even though it visits only two distinct cells.

A repeated run records its multiplicity and can use one repetition marker plus an explicit count in the trace. The route `AA` still contains two visits despite having one distinct cell. Coincident start/end decorations should use a documented combined marker or be omitted with that fact recorded; they must not move the underlying points. Visual simplification belongs in a separately identified preview layer. Keep the full route available in the canonical export.

### 4.3 Other documented approaches

Agrippa's [III.29–30](https://www.esotericarchives.com/agrippa/agripp3c.htm) discusses character alphabets and a nine-chamber method that divides Hebrew letters into groups and combines their graphical forms; Michael is a worked example. This is composition from letter forms, a different operation from joining numbered kamea cells. It suggests a possible later alphabet-composition mode, but does not establish that it generated this sheet.

The [so-called Fourth Book](https://esotericarchives.com/agrippa/agrippa4.htm), whose attribution to Agrippa is disputed in the edition's introduction, describes celestial characters as lines and heads, and also discusses extraction through tables. Its repertoire of stars/crosses, circular marks, angular forms, strokes, tails, and dots offers a historical comparison for the sheet's vocabulary. It does not supply a demonstrated one-to-one derivation of the 72 Goetic seals. Borrowing that vocabulary for a generator should be labelled an adaptation.

Other proposed letter wheels and Rose Cross methods need their own named sources, layouts, and dates. Do not label every non-kamea method modern merely because a new implementation is modern. The date and evidence for a construction tradition are separate from any claim that it explains this particular set.

## 5. Proposed algorithm for new Goetic-style sigils

Everything in this section is a design proposal derived from visual inspection. Initial numerical limits are tuning parameters, not statistics measured from the 80 drawings.

Separate three layers: **topology** (connections, visits, enclosures, repetition groups), **geometry** (coordinates, curves, transforms), and **style** (stroke, fills, caps, texture). Store group membership and attachments explicitly. Change style without changing topology, and perturb joined members together so shared points remain shared.

### 5.1 Generation pipeline

1. **Seed:** hash a user seed into a versioned deterministic PRNG. Keep the displayed name separate from the seed unless the user explicitly selects name-seeded generation. A hash creates repeatability, not historical name encoding.
2. **Family:** select axial, comb, bowl, compartmented, diagonal/radial, or cursive. Start with roughly equal sampling; adjust after reviewing generated sheets.
3. **Layout:** use normalized coordinates, with 10% initial padding and a sampled core aspect ratio. A square viewport is optional. Reserve primary axes and evenly spaced attachment sites. Permit diagonal and curved geometry rather than snapping everything to a square grid.
4. **Skeleton:** create a compact assembly with an initial budget of 3–9 major members. Sample dimensions and branch counts coherently within the selected family.
5. **Repetition:** place 2–5 copies of a chosen member on a rail or boundary. Share scale and spacing across the group. Not every composition needs repetition.
6. **Symmetry:** select none, structural, or strict. Mirror connected subassemblies as units. In structural mode, vary one or two ornaments after mirroring.
7. **Terminals:** assign rings, curls, forks, caps, or crosses to eligible endpoints. Use a dominant terminal type plus a smaller number of contrasting marks.
8. **Interior:** add one focal glyph or a sparse secondary structure in reserved empty space. Dense variants can subdivide the interior; sparse variants should retain a large clear region.
9. **Controlled irregularity:** slightly alter selected lengths or curve handles; optionally add a single side appendage. Do not jitter every vertex independently.
10. **Validation:** reject clipped geometry, accidental near-tangencies, unreadably tight spaces, and excessive ornament overlap. Allow intentional crossings and densely patterned families.
11. **Rendering:** convert the accepted geometry to SVG paths, circles, and filled motif outlines. Fit bounds including stroke widths and ornaments; keep names outside the drawing bounds.

Use a bounded retry count, e.g. 40 attempts, followed by a known valid family template. Derive each attempt from `(seed, algorithmVersion, attemptIndex)` so rejection and fallback remain reproducible.

Keep single-sigil generation independent of the current gallery. The feedback's proposed batch duplicate penalty would otherwise make the same seed yield different output depending on previous accepted drawings. Generate a stable canonical design per seed; a separate gallery curator can select among those designs. A reproducible curated batch needs its own seed, candidate order, selection version, and selected recipe IDs. Loading or reordering a gallery must not mutate an existing design.

Use independent named random streams for topology, geometry, and style, derived from the root seed. Adjusting line weight should not consume random values that change branch count. Persist resolved geometry in the recipe, since a seed alone cannot guarantee bit-identical future rendering across algorithm changes or floating-point/rasterization implementations.

### 5.2 Constraint and scoring rules

Hard constraints should cover valid geometry, declared attachments, finite coordinates, bounds, and minimum visible features. Soft scores can encourage regular spacing, coherent ornaments, negative space, and family diversity. Terms such as `focalClarity` need an operational definition or human assessment; an equation containing that name does not yet implement a measurable score.

For a stroked ring, distinguish centreline diameter `d`, outside diameter `D = d + w`, and clear inside diameter `H = d - w = D - 2w`, where `w` is stroke width. The feedback's lower bound of outside diameter `2w` leaves a zero-sized hole. Instead require a positive inner aperture and validate it at the intended preview resolution; a reasonable initial target is `H ≥ w` and at least two output pixels, subject to contact-sheet review.

Do not independently offset ornaments after attaching them. Specify whether a ring is stroked or a filled annulus, whether the stem terminates on its outer or centreline boundary, and which direction its local frame uses. Measure gaps after stroke expansion, not between bare centrelines. Account for caps, joins, miter limits, and filled motifs in bounds. Reference tracing preserves actual source attachments even when they differ from these invented-mode defaults.

Prefer a few explicit metrics initially: minimum non-contact gap, aperture size, clipped area, aspect ratio, component count at a fixed raster profile, and duplicate distance. Report each rather than hiding them behind one arbitrary quality number. Add learned or subjective scoring only after reviewing real output batches.

### 5.3 A concrete invented recipe

```text
family = bowl; symmetry = structural; repeatedMembers = 3
rim: (-0.65,-0.30) → (0.65,-0.30)
bowl: cubic curve from left rim to right rim through lower handles
three uprights at x = -0.40, 0, +0.40
uprights rise from rim to y = -0.65; ring at each upper end
central flared cross inside bowl
one short pendant below bowl
left and right rim endpoints receive small outward curls
replace right curl with a fork for controlled asymmetry
```

Render y increasing downward, then scale to fit. This combines motifs observed in 2, 12, and 14 without claiming to reproduce any of them. The grammar should also produce frameless, asymmetric, stepped, and cursive families; otherwise every output becomes a decorated bowl.

### 5.4 Geometry model

Use semantic geometry before rendering:

```text
Sigil {
  schemaVersion, mode, seed, algorithmVersion,
  sourceIdentity?, sourceVariant?, sourceReference?,
  sourceImageHash?, sourceComposition?, evidenceStatus?,
  attribution?, license?,
  family?, parameters,
  nodes[], edges[], ornaments[], independentPaths[],
  symmetryGroups[], intentionalCrossings[],
  coreBounds, border?, perimeterText?, caption?,
  encodingTrace? {
    original, normalized, values, reduced, cells, profileVersion,
    squareId, squareOrientation, repetitionPolicy, terminalPolicy
  }
}
```

Edges can be straight, polyline, arc, or cubic. An ornament stores attachment point, local tangent, size, and type. Ring attachment should meet its circumference rather than run through its centre. Crosses and arrowheads need explicit filled outlines to match their dark visual weight. At crossings, distinguish connectivity in data even when the renderer draws both strokes identically.

Add hand-drawn variation only after generating readable geometry, using stable per-member perturbations. Preserve shared junctions so connected strokes do not drift apart. The supplied sheet's clean appearance makes distress and ink texture optional rather than foundational.

For reference assets, distinguish a source witness from the edition or modern redraw through which it was accessed. Store page/folio and figure identifiers where known. An uncertain attribution remains explicitly uncertain; source-wide metadata must not silently certify every extracted drawing.

## 6. Reproducing the reference set

Exact reference rendering needs a data-authoring phase rather than inference from names:

1. Index all 80 cells; associate each with identity and variant, retaining exact sheet labels.
2. Choose and record the source witness for each drawing. If a manuscript differs from the compilation, retain both under separate variant IDs.
3. Crop labels away and manually trace the geometry. Automatic thresholding or centreline tracing can assist, but dense intersections and flared crosses need correction.
4. Encode repeated parts as reusable motifs where this preserves the source shape. Retain arbitrary paths for exceptions such as Bune and Seere.
5. Compare the rendering over its source crop at enlarged scale and at thumbnail size. Check attachments, internal holes, orientation, and silhouette; accept intentional source irregularities.

Rendering a stored vector recipe is a valid way to generate an existing sigil. It should be described as reconstruction from reference data. A grammar can generate variations around that recipe, but those variations become invented designs.

For testing a purported kamea derivation, predeclare a finite set of spellings, squares, reductions, and terminal conventions. Compare the raw path's topology and landmark arrangement with the reference before any decoration. Report failures as well as apparent matches. Unrestricted rotations, deletions, branches, and hand-added glyphs can force resemblance and make the hypothesis untestable.

Use the same predeclared rules on held-out identities, keeping variants together. Compare against shuffled names or shuffled letter orders of the same lengths. Count all tested profiles and any extra editing operations: searching hundreds of alternatives makes a single apparent match weak evidence. A convincing explanatory rule should reduce the amount of bespoke geometry needed and generalize beyond the examples used to invent it. A grammar that resembles the set aesthetically and a historical decoding hypothesis require different evaluations.

## 7. Client-side implementation plan

Use ordinary JavaScript modules and inline SVG. No server, model inference, remote font, or network lookup is required during generation. Reference recipes, square tables, and provenance can be bundled as static data. A local HTTP server may be used during development; that does not imply a server dependency in the generator itself.

Suggested future layout, not files created by this research:

```text
sigils/
  index.html
  styles.css
  js/{app,prng,geometry,grammar,kamea,render-svg}.js
  data/{reference-sigils,planetary-squares,profiles}.json
  ANALYSIS.md
  72_Goeta_sigils.png
```

Expose mode, seed/text, family, complexity, ornament density, symmetry, and line weight. Keep family controls for invented mode and alphabet/table controls for kamea mode. Show the selected reference witness in reference mode. Offer SVG and PNG export plus a JSON recipe containing the algorithm/profile version. Name-seeded and numeric name-encoded modes should have distinct labels.

SVG is the primary editable/exportable form; PNG can be rasterized through a browser canvas. Construct SVG with DOM APIs and insert labels as text, so arbitrary input is not interpreted as markup. Handle high-DPI preview and export separately. Keep provenance in metadata or an adjacent export manifest.

Decide explicitly whether offline support means a static site that works without external services, or opening `index.html` directly with `file://`. External ES modules and JSON fetches need not work under direct-file browser restrictions. For direct-file support, package scripts and data into a self-contained HTML or compatible classic-script build. This is a packaging choice; the geometry algorithm remains client-side.

### Validation before implementation is considered complete

- Reference data has 72 identities and 80 sheet variants, with the eight `b` alternatives correctly assigned; Lucifer is not silently added to the sheet set.
- Every stored square contains exactly 1 through n² and has correct row, column, and main-diagonal sums. Its orientation matches its recorded source.
- Known text examples verify ordered mapping, reduction, coordinates, repeated letters, and endpoint conventions. Include the BAEL example above as a modern-profile fixture.
- Include `AA`, `ABA`, coincident start/end points, digits, accented Latin, full-width Latin, `ß`, and combining marks. Ensure validation and traces reflect the selected profile exactly.
- Same seed, algorithm version, and parameters reproduce identical geometry. Different seeds are checked for useful structural diversity rather than merely changed ornament positions.
- Gallery order and prior generated items do not change a canonical seed's result. Style-only controls preserve topology. JSON round-trip restores resolved geometry and encoding trace.
- Exported bounds contain all strokes and ornaments. Test empty input, one-cell paths, long names, unsupported characters, and maximum complexity.
- Review an invented 8 × 10 contact sheet beside the source for family diversity, spacing, density, and silhouette. These are qualitative checks until the source has been annotated.
- When quantitative calibration is added, publish raw measurements and crop manifests, retain sparse/dense and long/tall outliers, and report identity-balanced as well as per-drawing results.
- Validate runtime with network access disabled and inspect SVG/PNG output at several sizes. Confirm reference drawings against their selected witnesses.
- Check ring apertures and non-contact gaps at 64, 256, and 1024 px. Define which optional details may be omitted in a thumbnail; canonical reference/export geometry remains intact.

## 8. Recommended next step and remaining uncertainty

Start implementation with the semantic geometry library and six invented families, then add the explicit modern kamea profile. In parallel with later reference authoring, retain a small set of manually checked reference drawings covering contrasting structures before tracing all 80. Full historical reconstruction should remain a separately tracked deliverable.

This analysis establishes a usable vocabulary and generation architecture. It does not recover lost authorial intent, quantify motif frequencies, attribute every variant to a manuscript, or prove a universal historical construction rule. The main open research task is source-by-source tracing of the individual drawings; the main design task is tuning the grammar through contact-sheet comparison.

Before adding elaborate scoring or a general constraint solver, implement one explicit recipe per family and a pilot reference set spanning simple, dense, narrow, and variant-heavy drawings. Compare variations of those recipes to identify which constraints actually improve the output. No separate scoring framework is needed until simpler checks prove insufficient.

## Sources and evidence boundaries

All links consulted on 24 October 2026. Historical statements above refer to the texts and editorial notes actually inspected; the proposed software algorithms are original design recommendations.

1. [Requested Wikipedia list, revision 1376037641](https://en.wikipedia.org/w/index.php?title=List_of_sigils_of_demons&oldid=1376037641) — identity cross-reference, naming, and listed textual origins. It does not document a separate construction algorithm for every entry.
2. [Commons: 72 Goeta sigils.png](https://commons.wikimedia.org/wiki/File:72_Goeta_sigils.png) — compilation metadata, revision history, and stated licence; local revision equivalence remains unverified.
3. [Peterson, *Lemegeton*, Part 1: Goetia](https://www.esotericarchives.com/solomon/goetia.htm) — primary-text transcription with manuscript variants and editorial introduction. Modern editorial material and figures have their own rights statements.
4. [Agrippa, *Occult Philosophy*, Book II, chapter 22](https://www.esotericarchives.com/agrippa/agripp2b.htm) — planetary tables, seals, and named intelligence/spirit characters.
5. [Agrippa, *Occult Philosophy*, Book III, chapters 29–30](https://www.esotericarchives.com/agrippa/agripp3c.htm) — character alphabets and nine-chamber letter composition.
6. [Pseudo-Agrippa, *Fourth Book*, character construction section](https://esotericarchives.com/agrippa/agrippa4.htm) — lines/heads and table-based character methods; consult the introduction on authorship.
