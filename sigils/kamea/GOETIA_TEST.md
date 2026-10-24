# Predeclared kamea test on five Goetic seals

Protocol fixed before any result was seen (see the docstring of `tools/kamea_goetia.py`): five pilot seals, two Latin value schemes, all seven 1533 squares, three reductions, so 42 routes per name; target is the seal's own skeleton from the sheet crop; statistic is the chamfer of the Agrippa control; the null is 200 shuffled letter orders each given the same best-of-42 selection. A seal passes only if its best real-name route beats the null's 5th percentile and is at least as close as the control's median true match.

| seal | name | best of 42 (scheme / square / rule) | chamfer | null 5th pct | shuffles better | passes |
|---|---|---|---|---|---|---|
| 01a | BAEL | agrippa_latin / Sol / drop_zeros | 0.102 | 0.089 | 0.44 | no |
| 09a | PAIMON | ordinal / Jupiter / drop_zeros | 0.068 | 0.064 | 0.23 | no |
| 12a | SITRI | ordinal / Venus / drop_zeros | 0.073 | 0.068 | 0.18 | no |
| 50a | FURCAS | agrippa_latin / Mercury / mod | 0.086 | 0.071 | 0.83 | no |
| 69a | DECARABIA | agrippa_latin / Jupiter / mod | 0.066 | 0.059 | 0.48 | no |

Control median chamfer for true matches (drop_zeros): 0.096.

## Reading

None of the five passes. For every seal the best real-name route is no closer to the seal than the best route of a random reshuffling of the same letters, which is what one expects when the 42-way search is finding coincidental overlap rather than a derivation.

Power: on the Agrippa control the same statistic put the true route below the null's 5th percentile for 3 of 16 characters that do come from kameas, and 11 of 16 match by eye. So the statistic misses true derivations about half the time, and a single negative here is weak evidence. The stronger argument is the side-by-side images in `goetia_test/`: a Goetic seal contains rings, flared crosses, crescents and enclosed compartments that no route through cell centres produces, under any of the 42 conventions, while the Agrippa characters contain nothing but routes, hairpins, loops and end marks.
