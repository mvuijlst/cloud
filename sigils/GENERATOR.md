# A generator of Goetic-style seals

24 October 2026. Goal: 72 new seals that look like they belong on the sheet, of the same complexity, and that are none of the 72.

## Protocol, fixed before any generator output existed

1. **Instrument check.** `ACCEPTANCE.md` test 1 renders encodings with `tools/sigil.py` and compares their features with the scans. Run on the 60 hand encodings themselves, which match their scans by overlay, it fails: energy distance 2.10 against a threshold of 0.41, ink fraction 3 sd too high (`data/acceptance_baseline_real_encodings_aa.json`). The renderer draws a 4 px stroke 6 px wide (OpenCV anti-aliasing), and the encodings' `stroke` is the *measured* width (median 2 x distance transform on the skeleton), which itself overstates the drawn width by about a pixel. Two corrections, neither chosen by looking at test results: `sigil.render(..., exact=True)` draws without anti-aliasing at 4x and downsamples (a requested 3 px stroke then measures 4.0 px, the scans' median), and the stroke is scaled by 0.75, the factor at which the paired median ink fraction of the 60 encodings equals that of their own scans (0.85: +0.031; 0.75: +0.006; 0.65: -0.015). With both, the hand encodings pass: energy distance 0.19, largest KS 0.27 (`data/acceptance_baseline_real_encodings.json`). The default renderer is unchanged, so every score in `data/encoding_scores.csv` still stands. `tools/acceptance.py` runs tests 1, 3 and 4 this way.

2. **Novelty.** "Not those seals" is measured by `tools/novelty.py`: skeleton F-score at 2 px on 96 px drawings, aspect kept, best over shifts and four flips, against all 80 crops. Threshold: 0.6945, the 95th percentile of each real drawing's similarity to its nearest drawing of another identity (`data/novelty_calibration.json`). The measure was picked among eight because it best separates redraws: Paimon 09a/09b 0.71, Bathin 18a/18b 0.79 and Vepar 42a/42b 0.81 lie above the threshold; the other five doubled identities are alternative designs and lie below. A generated seal must not exceed the threshold; any that does is discarded and the count reported.

3. **Fit targets** are the part statistics of the 60 encodings (`tools/encoding_stats.py`, `data/encoding_stats.json`), not the eyeballed families alone: primitives per seal (median 29.5, IQR 23 to 38), lines 12, rings 8, crosses 1.45 mean, triangles 2.2, arcs 3, spirals 1.5; ring radius median 0.046 of the height, cross half-arm 0.10; 60% of seals mirrored (32 of 41 mirrors about a vertical axis), 53% with a repeat, repeat counts mostly 3 and 2; line ends land on a ring 29%, another line 29%, an arc 11%, a triangle 9%, a cross 6%, a spiral 5%, nothing 7%.

4. **Acceptance** is `ACCEPTANCE.md` tests 1, 3 and 4 with the corrected instrument, on the 72 delivered seals. Test 2 (blind human pairs) needs raters who have not seen the project; `GENERATOR.md` reports only what can be run here.

## Result (final seed 20261024, run once after tuning on development seed 101)

`generated/g01.json` .. `g72.json`, sheet `data/generated_sheet.png`. Family mix as on the sheet (16 axial, 10 comb, 11 bowl, 22 compartment, 6 radial, 7 cursive).

- Tests 1, 3, 4 pass (`data/generated_acceptance.json`): energy distance 0.226 (<= 0.409), largest KS 0.326 on sym_lr (<= 0.385), diversity ratio 0.93 (>= 0.8), no escapes. (First run, 24 October: 0.251, 0.326, 0.93.)
- Novelty (`data/generated_novelty.json`): all 72 below 0.6945; median similarity to the nearest real drawing 0.585 (real-to-real median 0.608), maximum 0.683; median 31.5 primitives.
- Regenerated on 25 October after two fixes found by looking at single seals, made in `tools/generate.py` and `generator.js` alike. Comb teeth are one repeat placed without a collision test, so a wide terminal (a T-bar with rings, triangle feet) fused with its neighbours; the terminal must now be narrower than the gap (else a smaller ring, else bare teeth). And an unmirrored radial seal was still mirrored on both axes; its right-hand arms now end in a different terminal, as Decarabia's crescents and crosses do.
- On the development seed, measured complexity matched: median 32 primitives (encodings 29.5); before the "reach" ornament it was 24, about 10% below the scans in stroke length and junctions.
- Not done: test 2 (blind human pairs). The generator was tuned while watching test 1 on seed 101; thresholds were not changed. Weakest statistic: left-right symmetry.

## In the browser (25 October 2026)

`index.html` with `generator.js` and `sigil-data.js` runs the generator client side, with no server code and no libraries; it is served as a static page like the rest of the site. `generator.js` is a line-by-line port of `tools/generate.py` plus the parts of `tools/sigil.py` it needs (geometry, repeat and mirror, SVG); `sigil-data.js` is written by `tools/build_web_data.py` from the same files the Python generator reads, plus the 80 reference skeletons of `tools/novelty.py`. The page first showed a set of 72 per seed; it now shows one seal per visit, as a scan (next section).

- **Random stream.** The port uses its own seeded generator (mulberry32), so a seed gives different seals than in Python. The same seed always gives the same set: the page and Node produce byte-identical output (SHA-256 of the 72 encodings for seed 20261025 matched).
- **Raster.** Collision checks use a small rasteriser in place of OpenCV: coordinates on OpenCV's 1/16 px grid, strokes and filled outlines half a pixel beyond w/2, fitted member by member against `cv2` LINE_8 (about 1% of pixels disagree at 4x).
- **Novelty in the page.** Every seal is scored against the 80 drawings and redrawn from the next seed in a fixed sequence if too close. The page renders the seal as `sigil.render(exact=True)` does (4x, 4 x 4 average; OpenCV stores 8 of 16 as grey 128, so ink needs 9) and thins it with scikit-image 0.26's own Zhang-Suen removal table, copied from its source (`_skeletonize_various_cy.pyx`); with that table its skeletons are pixel-identical to skimage's given the same mask. Over 72 seals the browser score differs from `tools/novelty.py` by -0.0195 to +0.0146 (mean -0.0001), so the page keeps only seals at least 0.02 below the threshold (0.6745): whatever it keeps also passes the Python test.
- **Checked** (`data/web20261025_novelty.json`, `data/web7_novelty.json`): sets of 72 for seeds 20261025 and 7 in the sheet's family mix, generated by the page's code (after the 25 October fixes) and tested with the Python tools: energy distance 0.244 and 0.302, largest KS 0.271 (rings) and 0.293 (sym_lr), diversity 0.96 and 0.94, no escapes; all 144 novel by `tools/novelty.py` (closest 0.667 and 0.673); median 31.5 and 33 primitives. 4 draws were discarded as too close in each.
- **Speed:** about 0.1 s per seal, plus 0.4 to 0.5 s for the scan.

## One seal per visit, as if scanned from a printed book (25 October 2026, superseded)

Superseded the same evening by the plate look below: the user found this version blurry and asked for white on black in the manner of the plates. The code (`scan.js`, `tools/scan_check.py`) is in commit 4dfad9f; the paper and ink measurements (`tools/print_texture.py`, `data/print_texture.json`) are kept.

`index.html` drew a single seal on each visit (a number in the URL, `#1234`, shows that seal again) and showed it as a 500-ppi scan of a printed page: `scan.js`. Its family is drawn in the sheet's proportions (`Sigils.sealForSeed`), so a run of visits has the sheet's mix only on average.

**What a printed scan looks like, measured** (`tools/print_texture.py`, `data/print_texture.json`). The 1904 plates survive only as cleaned scans (paper clipped to white, ink to black, 100 ppi), so two leaves of the 1916 De Laurence printing were fetched, with permission, from the BYU scan on archive.org (500 ppi, uncleaned; `witnesses/delaurence1916/`). They carry text, not seals, but the paper, ink and edges are what the printing and the scanner did:

| | measured |
|---|---|
| paper | RGB 210/205/193 and 201/196/188 on the two leaves; grain 0.9, 1.0, 1.2 grey levels in the bands below 2, 2 to 8, 8 to 32 px; light falling off by 22.5 grey levels across a page |
| ink | RGB 34/31/27 and 12/9/7 (each page inked differently); mottle 6.5 grey levels at least 4 px inside strokes (nearer the edge the figure is the edge blur) |
| edges | Gaussian-blurred step, sigma 1.24 px; smooth: sub-pixel contours deviate 0.16 px from themselves smoothed at 2 px, and the figure keeps growing with the smoothing width (letter shape, not ink), so no raggedness is added |
| specks | 0.12 per square cm, about 6 px each |
| skew | 0 and 0.15 degrees |
| drawn lines (sheet crops against the encodings) | straight: bending 0.0005 of the height on scales above 0.03; width varies 4% (0.5 px on an 18 mm seal, below the edge blur), so no wobble is added |

**Rendering** (`scan.js`, pure JavaScript, runs in the page and under Node): the seal 18 mm tall at 500 ppi, ink coverage rasterised at 3x with the drawn width, resampled with a skew of up to 0.15 degrees and a small offset, dust specks, edge blur, then warm ink with mottle over paper with grain and a light gradient, each page's paper and inking drawn between the two measured leaves.

**Checked against the pages** (`tools/scan_check.py`, `data/scan_check.json`): the same procedure on the two leaves and on six rendered scans. Paper and ink fall within the two leaves' values; grain fine 0.82 to 0.88 (leaves 0.70, 1.14) and mid 1.52 to 1.70 (1.47, 1.77); mottle at least 4 px deep 6.0 to 6.8 (5.8, 7.2); edge sigma 1.27 to 1.28 (1.19, 1.29). The edge blur needed one calibration: the renderer's supersampling and resampling soften an edge by 0.89 px of their own, so applying the pages' 1.24 px read 1.52; it now adds sqrt(1.236^2 - 0.89^2). Page and Node render byte-identical pixels for the same seed (SHA-256 of the image for seed 124809775).

**Single visits against the acceptance tests** (`data/visits_acceptance.json`, `data/visits_*_novelty.json`): six samples of 72 independent visits pass tests 1, 3 and 4: energy distance 0.21 to 0.40, largest KS 0.31 to 0.38 (sym_lr in five), diversity 0.88 to 0.97, median 30 to 36 primitives; all 432 seals novel (closest 0.667 to 0.679). One sample is marginal (energy 0.401, KS 0.382): it drew 10 radial seals where the sheet has 6, and random family draws widen the spread in a way a fixed mix of 72 does not. Before the radial fix, one sample in four failed on sym_lr.

## As on the plates: double ring, name, solid ink, white on black (25 October 2026)

The page shows the seal as the 1904 plates show theirs: inside a double ring with a name lettered round it, in solid ink with the plates' irregularity, white on black (`plate.js`). It is drawn at the screen's own pixel density (up to 2x), so it is never scaled up; the soft look of the previous version came from blur plus upscaling.

**Measured on good scans of the plates** (`tools/plate_ink.py`, `data/plate_ink.json`), the two examples the user supplied: Asmoday from fromoldbooks.org and a scan of four plates (Haagenti, Sitri, Buer, Beleth), about 290 px to the outer ring's radius R. The frame's circles were meant to be perfect, so 1440 rays from each centre measure what the hand and the press did to a line:

| | five plates |
|---|---|
| rings | at 1.000, 0.964 and 0.757 R; line widths 0.019, 0.026, 0.028 R |
| width along a line | coefficient of variation 0.09 to 0.19 (median 0.14), changing over about 0.02 R |
| course | wanders 0.0015 to 0.0038 R, mostly over long stretches |
| edges | ragged by 0.4 to 0.6 px (0.0017 R) |
| roundness | 0.1 to 0.9% elliptical |
| figure | strokes 0.027 to 0.035 R; ink reaching 0.72 R, up to the inner ring |
| letters | 0.13 to 0.14 R tall, centred at 0.866 R |

This corrects the earlier finding that the plates' lines are straight and even (bending 0.0005 of the height, width varying 4%): that was measured on the 133-px sheet, which cannot resolve variation of a pixel or two. At 290 px the swelling and wander are plain.

**Rendering** (`plate.js`): the figure, centred, scaled until its ink reaches 0.70 R, its stroke 0.029 R scaled by the seal's own stroke; the three rings; the name in serif capitals (the browser's Times or equivalent), evenly round the band from the top, each letter's foot toward the centre; a few specks. Drawn at 2x and averaged down, resampled through a slow displacement field (the wander) and out of round by up to twice the plates' median ellipticity; then each pixel's signed distance to the ink edge is shifted by a field correlated over the measured length (half the width swelling on each side of a line) and a fine one (the raggedness), and the ink is where the shifted distance is positive, anti-aliased over one pixel. An earlier try, blur and a varying threshold, filled the 3 to 4 px gap between the two outer rings; the distance version keeps it open.

**Checked** (`tools/plate_check.py`, `data/plate_check.json`): rendered plates measured with the same tool, six seeds, against the median of the five plates: width variation 0.141 (plates 0.140), raggedness 0.00179 R (0.00173), wander 0.00247 R (0.00254), line width 0.0242 R (0.0239), rings at the plates' radii. The edge fields needed one calibration (both fields and the pixel grid add to both statistics), made on four seeds and confirmed on six. Lettering, measured in the browser on a rendered plate: letters 0.134 to 0.143 R tall, centred at 0.862 to 0.867 R.

**Names** (`Sigils.nameForSeed`): an order-2 letter model of the 72 spirit names on the sheet (first spelling of each). A name is kept only if it has 5 to 9 letters, is at least two edits from every one of the sheet's 128 spellings and contains none of them of four letters or more, so it is neither one of theirs nor two glued together: VALIGOSE, STALETH, FOCELETH, GREMODAY, SABIFROTI. Plain English words can still come out (MALLORY); no word list is applied.

**Speed:** about 0.1 to 0.5 s for the seal and 0.5 s for the plate at R = 413 px in a desktop browser.

### While it is being made (25 October 2026)

The page shows the making rather than a spinner: the three rings swept from the top, the name lettered in outline in the places and face it will be inked in, then the seal's parts in the order the grammar placed them, each step captioned with its label from the grammar ("bowl · stem in the bowl", "axial · crossbar"), then "inking" and the plate fading in, about three seconds in all; a tap skips to the plate once it is ready, and a reduced-motion setting shows it at once. The work runs in `sigil-worker.js`, which sends the name, then the seal with its construction trace (`generateSeal(..., { trace: true })`: every placement in order, mirror images included, normalised with the seal) and the plate layout (`plateLayout`, so the outlines land where the ink will), then the rendered plate. Where workers or OffscreenCanvas lettering are missing (opened from disk, older browsers) the page does the same work itself. Recording the trace draws no random numbers: a set of 72 for seed 20261025 is identical to the one tested above, and a plate renders to the same pixels. The check against the 72 seals still runs on every seal but is not shown. The png link saves the plate as printed, black ink on white.

