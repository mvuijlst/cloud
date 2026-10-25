# What is in this folder

Everything here was produced on 24 October 2026 from `72_Goeta_sigils.png` and the sources named in each subfolder. `FINDINGS.md` is the report; every number in it comes from a file listed below. Python runs from the repo venv: `M:\dev\cloud\.venv\Scripts\python.exe`, working directory `M:\dev\cloud\sigils`.

## Corpus

| path | what |
|---|---|
| `72_Goeta_sigils.png` | the sheet, 2048 x 1519, SHA-256 `6a6df81a...` (Commons compilation of the 1904 Mathers/Crowley plates) |
| `data/crop_manifest.json` | 80 integer rectangles in sheet pixels, identity, variant, sheet label, label rectangle |
| `crops/<id>.png` | one crop per drawing, label text excluded (`tools/crop_cells.py`) |
| `data/crop_qa.png` | the sheet with every rectangle drawn, used for the visual check |
| `data/features.csv` | per-drawing measurements (`tools/features.py`; column meanings in its docstring) |
| `data/features_summary.json` | per-drawing and identity-weighted quartiles |
| `data/clusters.json`, `data/dendrogram.png`, `data/cluster_sheet.png` | Ward clustering and the comparison with by-eye families (`tools/cluster.py`) |
| `data/families_by_eye.json` | my family assignment for all 72 identities, made from thumbnails before clusters were compared |
| `data/holdout.json` | pilot and held-out identities, fixed before any encoding |
| `data/worksheets/<id>.png` | grid plus detected rings and segments, used to read coordinates (`tools/worksheet.py`) |

## Vocabulary and encodings

| path | what |
|---|---|
| `encodings/VOCABULARY.md` | the member types, units, rules, acceptance and change log |
| `encodings/BRIEF.md` | the per-drawing procedure given to the encoders |
| `encodings/<id>.json` | one hand encoding per drawing |
| `encodings/render/<id>.png`, `encodings/svg/<id>.svg` | the encoding rendered (`tools/sigil.py`) |
| `data/overlays/<id>.png` | source (grey) against rendering (red), with metrics (`tools/score.py`) |
| `data/encoding_scores.csv` | cov, prec, iou, acceptance, member counts per encoding |
| `data/encoding_summary.json` | aggregates by group (pilot, main, held-out) and by family (`tools/encoding_summary.py`) |
| `encodings/reports/*.md` | the encoders' batch reports, including wishes for primitives |

## Witnesses

| path | what |
|---|---|
| `witnesses/SOURCES.md`, `witnesses/INVENTORY.json` | what was fetched, from where, and what was unreachable |
| `witnesses/<witness>/` | seal images per witness |
| `witnesses/COLLATION.md` | the ten-seal collation table |

## Kamea

| path | what |
|---|---|
| `kamea/sources/` | Agrippa II.22 (1533, Wellcome copy): page images, Latin text, Freake, transcribed tables, SOURCES.md |
| `kamea/woodcuts/<name>.png` | the printed characters cropped and binarised |
| `kamea/control/<name>.png`, `kamea/control_results.json`, `kamea/CONTROL.md` | the positive control (`tools/kamea_control.py`) |
| `kamea/goetia_test/<id>.png`, `kamea/goetia_test_results.json` | the predeclared test on five Goetic seals (`tools/kamea_goetia.py`) |

## Acceptance

| path | what |
|---|---|
| `ACCEPTANCE.md` | the test a future generator must pass |
| `data/acceptance_calibration.json` | thresholds from 500 identity-balanced halvings of the corpus (`tools/acceptance_calibration.py`) |

## Generator

| path | what |
|---|---|
| `GENERATOR.md` | protocol, instrument check, novelty measure, results, browser port |
| `tools/generate.py`, `generated/` | the Python generator and its 72 seals (seed 20261024) |
| `tools/acceptance.py`, `tools/novelty.py` | ACCEPTANCE.md tests 1, 3, 4 with the corrected renderer; the novelty test |
| `tools/encoding_stats.py`, `data/encoding_stats.json` | the part statistics the generator is fitted to |
| `index.html`, `generator.js`, `scan.js`, `sigil-data.js` | the generator in the browser, one seal per visit rendered as a printed scan; `sigil-data.js` from `tools/build_web_data.py` |
| `tools/print_texture.py`, `data/print_texture.json` | paper, ink, edge, speck and skew measurements of a printed scan (1916 leaves), and how straight the sheet's drawn lines are |
| `tools/scan_check.py`, `data/scan_check.json` | the same measurement on the real leaves and on rendered scans |
| `data/visits_acceptance.json`, `data/visits_*_novelty.json` | six samples of 72 single visits against the acceptance and novelty tests |
| `witnesses/delaurence1916/` | two leaves of the 1916 De Laurence printing (archive.org, BYU scan, 500 ppi) |

## Superseded

`ANALYSIS.md` and `REVIEW.md` are the earlier pass; kept for the record, not used by anything above.
