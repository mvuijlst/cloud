# Findings: the 72 Goetic seals as data

24 October 2026. Every number below comes from a file named in `FILES.md`. The run was cut short by a usage limit: 60 of the 80 drawings are encoded, the held-out test was not run, and this is stated where it matters.

## 1. Corpus

The sheet is a Commons compilation of the 1904 Mathers/Crowley plates: 80 drawings, 72 identities, eight doubled (`data/crop_manifest.json`). All 80 crops were cut by a label-line detector and checked by eye (`data/crop_qa.png`); two crops that had swallowed large-font labels were fixed before any measurement.

Per-drawing stroke-graph measurements are in `data/features.csv`. Corpus medians (80 drawings): aspect 1.19, ink fraction 0.23, 18 endpoints, 30 junctions, 12 skeleton cycles, 9 small round holes, stroke 4 px on a 133 px drawing (`data/features_summary.json`).

**Clusters do not recover the families named by eye.** Ward clustering on 14 standardised features gives a silhouette of 0.09 to 0.13 for every k from 2 to 10, and the six-cluster cut agrees with my by-eye family assignment of all 72 identities at an adjusted Rand index of 0.04 (`data/clusters.json`, `data/families_by_eye.json`). The clusters sort the drawings by ink density, symmetry and rectilinearity (`data/cluster_sheet.png`): cluster 1 is the dense loopy drawings, cluster 4 the sparse stepped outlines, cluster 3 the bilaterally symmetric ones. "Axial", "bowl", "comb" and the rest are compositional readings that these measurements do not see. Either the families are real but live in member topology, which the encodings record, or they are not real. The encodings favour the first reading: `mirror` was used in 34 of the 51 main-batch encodings and `repeat` in 28, so symmetry and repetition are structural facts, but they cut across the families.

## 2. Vocabulary by encoding

The vocabulary (`encodings/VOCABULARY.md`) has 13 member types: line, pline, arc, bez, ring, dot, cross (pattee), tri, spiral, crescent, repeat, mirror, and `path` as the escape. It changed twice during the pilot (concave cross arms after Sitri; an inner radius on the crescent after Decarabia) and not after.

Pilot of eight: 7 of 8 accepted on the predeclared criterion (coverage and precision of the skeleton within 0.75 stroke at 0.85, dilated IoU at 0.55). Paimon fails on IoU (0.53), Decarabia on coverage (0.84): its near-annular crescents are not what the crescent primitive produces.

Then 51 more drawings were encoded by five parallel encoders from worksheets of detected rings and segments, three fix rounds at most. Results (`data/encoding_scores.csv`, `data/encoding_summary.json`):

| group | n | accepted | mean cov | mean prec | mean IoU | escapes |
|---|---|---|---|---|---|---|
| pilot | 9 | 7 | 0.951 | 0.943 | 0.617 | 5 |
| main | 51 | 51 | 0.995 | 0.984 | 0.714 | 10 |
| held-out | 0 | not run | | | | |

**Escapes concentrate in one family.** All 15 escapes fall in 4 of the 6 "cursive" drawings (Bune, the two Beleths, Bathin); the 54 encoded axial, bowl, comb, compartment and radial drawings needed none (`escapes_by_family`). The vocabulary expresses the rectilinear and symmetric three-quarters of the corpus without residue and fails on closed lobed outlines (heart, omega, leaf). Member usage over 60 encodings: line 716, ring 473, arc 183, tri 130, pline 102, spiral 90, cross 87, bez 40, dot 20, crescent 6.

**What the encoders asked for** (54 wishes, `encoding_summary.json`): overwhelmingly one thing, a cross whose arms can differ, because on this sheet a "cross" is often three pattee arms and a plain stem, or two arms only (a flared bar, an I-bar, a bowtie). Next: a closed lobed outline, an S-curl, a tapered stroke. These are the vocabulary's known gaps and would be version 1.1.

**Not done:** the held-out test. The ten held-out identities (6, 19, 37, 38, 39, 40, 45, 53, 54, 71, fixed in `data/holdout.json` before any encoding) were never encoded, so whether the frozen vocabulary generalises is untested. Twenty drawings in all are missing (list in `data/encoding_summary.json`).

**Measurement caveat** reported by batch A and not fixed: the renderer draws a requested stroke one pixel heavier than asked, which caps dilated IoU near 0.75 and makes coverage and precision lenient by about a pixel. Acceptance is therefore easier than the numbers suggest; every overlay in `data/overlays/` was also checked by eye.

## 3. Witnesses (`witnesses/COLLATION.md`)

Ten seals were collated against Peterson's redrawings of Sloane 3825, the 1904 plates, Wellcome MS 3203 (Hockley's copy, 53 spirits, full resolution), and the single seals from Harley 6483 and Sloane 3648, 2731 and 3824 that Peterson reproduces. The British Library's own images were unreachable and its three Sloane witnesses were never digitised; Skinner and Rankine 2007 and the Folger's V.b.26 images were not reached.

- **Copyists preserve the member graph and change weight, curvature and ring counts.** Furcas and Decarabia are structurally identical in every witness; Agares, Vepar, Amy, Zagan, Seere and Dantalion keep their members while terminals and curves vary.
- **The 1904 plates are an edited witness.** Mathers replaced Bael's globe (a circle crossed by an ellipse, in Sloane 3825, Harley 6483 and Wellcome 3203 alike) with a band of six rings, straightened Zagan's arc, thickened Decarabia's crescents and lengthened Dantalion's arm. A generator tuned on this sheet learns Mathers' hand along with the tradition.
- **Variants are alternative designs, not noise.** Sloane 3825 carries two seals for Bune; the proto-Lemegeton Sloane 3824 has different seals for Seere and Dantalion from the Lemegeton proper.
- **No earlier catalogue carries seals.** Weyer 1563 has none; Scot 1584 and 1665 show only the planetary-angel seals of Book 15 chapter 7; Peterson's transcription of Folger V.b.26 marks every drawing and the Offices-of-Spirits section has none. The seals enter with the 17th-century Lemegeton compilation.

## 4. Kamea, with a control (`kamea/CONTROL.md`, `kamea/GOETIA_TEST.md`)

From the 1533 Cologne edition (Wellcome copy, 600 ppi), the seven squares were transcribed and verified magic, and the 16 intelligence and spirit names were read in Hebrew with their printed values (`kamea/sources/agrippa_II22_tables.json`; three printing errors found, listed there). Tracing each name on its square with the drop-zeros reduction reproduces the printed character for 9 of 16 by eye, plausibly for 3 more, partly for 3; Barzabel does not follow and its printed spelling does not sum to its printed value. The automatic chamfer statistic flags only 6 of the 16 true derivations at p < 0.05, so it misses about half of real ones.

The same procedure, predeclared, on five Goetic seals (Bael, Paimon, Sitri, Furcas, Decarabia) with two Latin value schemes, all seven squares and three reductions, 42 routes each, against 200 shuffled-letter nulls given the same selection: none passes, none is closer to its seal than the best shuffled route. Given the control's power this is weak evidence on its own; the strong evidence is in the images: a Goetic seal is made of rings, flared crosses, crescents and compartments that no route through cell centres produces, while Agrippa's characters are routes and nothing else.

## 5. Acceptance test (`ACCEPTANCE.md`)

Written before any generator exists: energy distance between 80 generated and 80 real feature vectors at most 0.409 and largest per-feature KS at most 0.385, both the 95th percentile over 500 identity-balanced halvings of the real corpus (`data/acceptance_calibration.json`); a blind pairwise test with uninvolved raters whose accuracy interval must include 0.5, both sides rendered through the same renderer; a diversity floor; no escapes.

## What a generator should be built on

Not on the eyeballed families. On the encodings: a corpus of member graphs where symmetry and repetition are explicit, where the per-family escape rate says which structures the vocabulary cannot yet make, and where the witnesses say which members are the tradition's and which are Mathers'. The first task for version 1.1 of the vocabulary is the per-arm cross; the first task for the corpus is the 20 missing encodings and the held-out test.
