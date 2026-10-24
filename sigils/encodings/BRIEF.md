# Brief for hand-encoding a batch of Goetic seal drawings

You are encoding drawings from the sheet `M:\dev\cloud\sigils\72_Goeta_sigils.png` in the vocabulary described in `M:\dev\cloud\sigils\encodings\VOCABULARY.md`. Read that file first, then `M:\dev\cloud\sigils\tools\sigil.py`'s docstring (the same vocabulary, as implemented), then the pilot examples `encodings/12a.json`, `encodings/50a.json`, `encodings/61a.json`, `encodings/01a.json` to see the level of detail expected.

Work only inside `M:\dev\cloud\sigils`. Create only `encodings/<id>.json` for the ids in your batch and your report file. Do not edit any tool, the vocabulary, the manifest, or another id's encoding. Do not commit.

## Per drawing

1. `Read` the worksheet image `data/worksheets/<id>.png`. The side panel lists detected ring-like holes (`R`: centre and centreline radius) and straight segments (`L`: endpoints), in encoding units (bbox height = 1, y down). Read coordinates from the grid and these lists.
2. Look up the drawing's `sheet_label` in `data/crop_manifest.json` for the name, and its family in `data/families_by_eye.json` (by identity number; `26b` is `comb`).
3. Write `encodings/<id>.json` with the file layout in VOCABULARY.md. `aspect` and `stroke` come from the worksheet header.
4. Score it from `M:\dev\cloud\sigils`:
   `M:\dev\cloud\.venv\Scripts\python.exe tools\score.py <id>`
5. `Read` the overlay `data/overlays/<id>.png`: grey = source ink you missed, red = ink you invented, dark = agreement. Fix the largest grey and red regions, rescore. At most three fix rounds per drawing. Then move on whether or not it is accepted.

Typical causes of low scores: a stroke placed on a detected edge instead of the centreline (LSD reports stroke edges; the worksheet already merges most pairs, but long merged `L` lines can span gaps), a cross drawn as lines instead of a `cross`, a ring drawn through its centre, an arc with the wrong sweep direction (angles are clockwise on screen; a bowl open at the top is `a: [0, 180]`), a spiral with the wrong sign of sweep.

## Rules that matter for the analysis

- Use `repeat` and `mirror` whenever the source shows evenly spaced copies or bilateral symmetry. These are the structural facts being collected.
- Escapes (`path` members in the `escapes` list) are allowed and expected for organic outlines; their count is a measurement. Do not disguise an escape as a `bez`. A `bez` is for a curve with a nameable role (bowl, arch, horn, handle).
- No new member types or fields. If you needed one, describe it in one line in the `wishes` array of that encoding.
- Record honestly. A drawing that stays below acceptance after three rounds is a finding, not a failure to hide.

## Report

When the batch is done, write `encodings/reports/<batch>.md` with one line per drawing:
`<id> | rounds <n> | cov <x> prec <x> iou <x> | accepted yes/no | primitives <n> escapes <n> repeats <n> mirrors <n> | wishes: ... | one-line note on what was hard`
and a closing paragraph: which vocabulary members you never needed, which you reached for most, and any systematic difficulty with the tools. Return the same content as your final message.
