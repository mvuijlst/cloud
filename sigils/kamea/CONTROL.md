# Agrippa control: do the printed characters follow from the printed names and squares?

Source: De occulta philosophia II.22, Cologne 1533 (Wellcome copy via Internet Archive hin-wel-all-00001912-001, leaves 171-175). Squares and Hebrew spellings as transcribed in `sources/agrippa_II22_tables.json`. Method: `tools/kamea.py` with the Hebrew values, reduction by dropping zeros until the value fits the square (the convention described by Rankine and the Golden Dawn), cells joined in order, a retraced segment drawn as a hairpin, a repeated letter as a loop. Side-by-side images in `control/`. Statistic: bounding-box-fitted symmetric chamfer between woodcut skeleton and route, best of the 8 symmetries of the square; "shuffles better" is the fraction of 200 random letter orders of the same name whose best route scores lower (0 = the real order beats every shuffle).

The verdict column is my reading of the side-by-side image, recorded before the Goetic test was run.

| name | role, planet | Hebrew as printed | values -> cells | verdict | chamfer | shuffles better |
|---|---|---|---|---|---|---|
| Agiel | Intelligentia, Saturn | אגיאל | 1-3-1-1-3 | **plausible** | 0.070 | 0.32 |
| Zazel | Daemonium, Saturn | זאזל | 7-1-7-3 | **plausible** | 0.165 | 0.00 |
| Iohphiel | Intelligentia, Jupiter | יהפיאל | 10-5-8-10-1-3 | **match** | 0.095 | 0.67 |
| Hismael | Daemonium, Jupiter | הסמאל | 5-6-4-1-3 | **match** | 0.088 | 0.09 |
| Graphiel | Intelligentia, Mars | גראפיאל | 3-20-1-8-10-1-3 | **partial** | 0.127 | 0.28 |
| Barzabel | Daemonium, Mars | ברצאבאל | 2-20-9-1-2-1-3 | **no** | 0.075 | 0.15 |
| Nachiel | Intelligentia, Sol | נכיאל | 5-20-10-1-30 | **plausible** | 0.130 | 0.92 |
| Sorath | Daemonium, Sol | סורת | 6-6-20-4 | **match** | 0.123 | 0.82 |
| Hagiel | Intelligentia, Venus | הגיאל | 5-3-10-1-30 | **match** | 0.118 | 0.86 |
| Kedemel | Daemonium, Venus | קדמאל | 10-4-40-1-30 | **match** | 0.115 | 0.70 |
| Bne Seraphim | Intelligentiae, Venus | בני שרפים | 2-5-10-30-20-8-10-40 | **match** | 0.045 | 0.00 |
| Tiriel | Intelligentia, Mercury | טיריאל | 9-10-20-10-1-30 | **match** | 0.087 | 0.39 |
| Taphthartharath | Daemonium, Mercury | תפתרתרת | 40-8-40-20-40-20-40 | **match** | 0.042 | 0.05 |
| Hasmodai | Daemonium, Luna | השמודאי | 5-30-40-6-4-1-10 | **partial** | 0.097 | 0.10 |
| Schedbarschemoth Schartathan | Daemonium daemoniorum, Luna | שדברשהמעת שרתתן | 30-4-2-20-30-5-40-70-40-30-20-40-40-50 | **partial** | 0.111 | 0.32 |
| Malcha betharsisim hed beruah schehakim | Intelligentia intelligentiarum, Luna | מלכא בתרשיתים עד ברוח שחקים | 40-30-20-1-2-40-20-30-10-40-10-40-70-4-2-20-6-8-30-8-10-10-40 | **match** | 0.065 | 0.00 |

Totals: 9 match, 3 plausible, 3 partial, 1 no, of 16.

## What the control establishes

1. With the spellings and squares as printed in 1533 and the drop-zeros reduction, the route reproduces the printed character for most names. The clearest cases are the ones with retraces (Iophiel, Taphthartharath, Hagiel), where the printer drew the retrace as a hairpin.
2. The method is not uniform across the chapter. Barzabel does not follow, and its printed spelling does not even sum to the printed value; Graphiel and Hasmodai only partly follow. Either the printer, the spelling or the rule differs for these, which is consistent with Rankine's remark that Agrippa is inconsistent.
3. The automatic statistic is weak: it marks only 6 of 16 real routes as beating 85% of shuffles, although 11 of 16 match or plausibly match by eye. The Goetic test below therefore reports both the statistic and a side-by-side image, and any negative must be read against this detection rate.

Verdict notes:

- Agiel: retraced diagonal drawn as a hairpin with rings at both ends; the woodcut has the same hairpin and end rings.
- Zazel: diagonal with a retrace plus a horizontal bar; the woodcut shows the diagonal, the turn and a detached bar.
- Iohphiel: three horizontal strokes in row 2 retraced as hairpins, then a diagonal: the woodcut is exactly that figure.
- Hismael: zigzag with a top bar and a long closing diagonal, as printed.
- Graphiel: nested wedges in both, but the printed figure is a single large arrowhead with an inner wedge.
- Barzabel: printed: one long diagonal with a double hairpin foot; traced route is a crossing zigzag (printed spelling sums to 326, not 325).
- Nachiel: small zigzag at one end, long diagonal, short stroke at the other end; the printed figure has the same three parts.
- Sorath: long diagonal from a looped start to a ringed end; the repeated samekh gives the loop.
- Hagiel: long diagonal plus a tall narrow hairpin, as printed.
- Kedemel: top bar, long diagonal to the foot, return to the centre, bar to the left, as printed.
- Bne Seraphim: bow-tie of crossing strokes; the route beats every shuffled spelling.
- Tiriel: long diagonal with an M-shaped zigzag at the upper end, as printed.
- Taphthartharath: an L drawn in hairpins: four retraces of two segments, exactly the printed figure.
- Hasmodai: arrow-like figure in both; the printed spelling with he sums to 366, not 369, so one letter may differ.
- Schedbarschemoth Schartathan: both dense with a loop and a lower triangle; correspondence not followable stroke by stroke.
- Malcha betharsisim hed beruah schehakim: dense coil of retraces at the right and crossing diagonals at the left; the route beats every shuffled spelling.
