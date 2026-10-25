# A generator of Goetic-style seals

24 October 2026. Goal: 72 new seals that look like they belong on the sheet, of the same complexity, and that are none of the 72.

## Protocol, fixed before any generator output existed

1. **Instrument check.** `ACCEPTANCE.md` test 1 renders encodings with `tools/sigil.py` and compares their features with the scans. Run on the 60 hand encodings themselves, which match their scans by overlay, it fails: energy distance 2.10 against a threshold of 0.41, ink fraction 3 sd too high (`data/acceptance_baseline_real_encodings_aa.json`). The renderer draws a 4 px stroke 6 px wide (OpenCV anti-aliasing), and the encodings' `stroke` is the *measured* width (median 2 x distance transform on the skeleton), which itself overstates the drawn width by about a pixel. Two corrections, neither chosen by looking at test results: `sigil.render(..., exact=True)` draws without anti-aliasing at 4x and downsamples (a requested 3 px stroke then measures 4.0 px, the scans' median), and the stroke is scaled by 0.75, the factor at which the paired median ink fraction of the 60 encodings equals that of their own scans (0.85: +0.031; 0.75: +0.006; 0.65: -0.015). With both, the hand encodings pass: energy distance 0.19, largest KS 0.27 (`data/acceptance_baseline_real_encodings.json`). The default renderer is unchanged, so every score in `data/encoding_scores.csv` still stands. `tools/acceptance.py` runs tests 1, 3 and 4 this way.

2. **Novelty.** "Not those seals" is measured by `tools/novelty.py`: skeleton F-score at 2 px on 96 px drawings, aspect kept, best over shifts and four flips, against all 80 crops. Threshold: 0.6945, the 95th percentile of each real drawing's similarity to its nearest drawing of another identity (`data/novelty_calibration.json`). The measure was picked among eight because it best separates redraws: Paimon 09a/09b 0.71, Bathin 18a/18b 0.79 and Vepar 42a/42b 0.81 lie above the threshold; the other five doubled identities are alternative designs and lie below. A generated seal must not exceed the threshold; any that does is discarded and the count reported.

3. **Fit targets** are the part statistics of the 60 encodings (`tools/encoding_stats.py`, `data/encoding_stats.json`), not the eyeballed families alone: primitives per seal (median 29.5, IQR 23 to 38), lines 12, rings 8, crosses 1.45 mean, triangles 2.2, arcs 3, spirals 1.5; ring radius median 0.046 of the height, cross half-arm 0.10; 60% of seals mirrored (32 of 41 mirrors about a vertical axis), 53% with a repeat, repeat counts mostly 3 and 2; line ends land on a ring 29%, another line 29%, an arc 11%, a triangle 9%, a cross 6%, a spiral 5%, nothing 7%.

4. **Acceptance** is `ACCEPTANCE.md` tests 1, 3 and 4 with the corrected instrument, on the 72 delivered seals. Test 2 (blind human pairs) needs raters who have not seen the project; `GENERATOR.md` reports only what can be run here.

## Result (final seed 20261024, run once after tuning on development seed 101)

`generated/g01.json` .. `g72.json`, sheet `data/generated_sheet.png`. Family mix as on the sheet (16 axial, 10 comb, 11 bowl, 22 compartment, 6 radial, 7 cursive).

- Tests 1, 3, 4 pass (`data/generated_acceptance.json`): energy distance 0.251 (<= 0.409), largest KS 0.326 on sym_lr (<= 0.385), diversity ratio 0.93 (>= 0.8), no escapes.
- Novelty (`data/generated_novelty.json`): all 72 below 0.6945; median similarity to the nearest real drawing 0.586 (real-to-real median 0.608), maximum 0.683.
- On the development seed, measured complexity matched: median 32 primitives (encodings 29.5); before the "reach" ornament it was 24, about 10% below the scans in stroke length and junctions.
- Not done: test 2 (blind human pairs). The generator was tuned while watching test 1 on seed 101; thresholds were not changed. Weakest statistic: left-right symmetry.

## In the browser (25 October 2026)

`index.html` with `generator.js` and `sigil-data.js` runs the generator client side, with no server code and no libraries; it is served as a static page like the rest of the site. `generator.js` is a line-by-line port of `tools/generate.py` plus the parts of `tools/sigil.py` it needs (geometry, repeat and mirror, SVG); `sigil-data.js` is written by `tools/build_web_data.py` from the same files the Python generator reads, plus the 80 reference skeletons of `tools/novelty.py`. The page shows a set of 72 for a seed (`#seed` in the URL), a detail view per seal and SVG or JSON downloads.

- **Random stream.** The port uses its own seeded generator (mulberry32), so a seed gives different seals than in Python. The same seed always gives the same set: the page and Node produce byte-identical output (SHA-256 of the 72 encodings for seed 20261025 matched).
- **Raster.** Collision checks use a small rasteriser in place of OpenCV: coordinates on OpenCV's 1/16 px grid, strokes and filled outlines half a pixel beyond w/2, fitted member by member against `cv2` LINE_8 (about 1% of pixels disagree at 4x).
- **Novelty in the page.** Every seal is scored against the 80 drawings and redrawn from the next seed in a fixed sequence if too close. The page renders the seal as `sigil.render(exact=True)` does (4x, 4 x 4 average; OpenCV stores 8 of 16 as grey 128, so ink needs 9) and thins it with scikit-image 0.26's own Zhang-Suen removal table, copied from its source (`_skeletonize_various_cy.pyx`); with that table its skeletons are pixel-identical to skimage's given the same mask. Over 72 seals the browser score differs from `tools/novelty.py` by -0.0195 to +0.0146 (mean -0.0001), so the page keeps only seals at least 0.02 below the threshold (0.6745): whatever it keeps also passes the Python test.
- **Checked** (`data/web20261025_novelty.json`, `data/web7_novelty.json`): seeds 20261025 and 7, generated by the page's code and tested with the Python tools: energy distance 0.240 and 0.281, largest KS 0.257 and 0.317 (sym_lr both times), diversity 0.97 and 0.99, no escapes; all 144 novel by `tools/novelty.py` (closest 0.667 and 0.673); median 30 and 33 primitives. The page discarded 4 and 5 draws as too close.
- **Speed:** about 9 s for 72 seals in a desktop browser, drawn one at a time so the grid fills as it goes.
