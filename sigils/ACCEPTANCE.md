# Acceptance test for a Goetic-style sigil generator

Written 24 October 2026, before any generator exists. A generator that emits encodings in the vocabulary of `encodings/VOCABULARY.md` is accepted when all four tests below pass. The numbers come from `data/acceptance_calibration.json` and `data/features.csv`; nothing here is a judgement call made after seeing generator output.

## 1. Distribution test (automatic)

Render 80 generated encodings with `tools/sigil.py` at the corpus median height (133 px) and measure them with `tools/features.py`. Standardise the 14 clustering features with the corpus mean and standard deviation stored in `data/acceptance_calibration.json` (counts are log1p-transformed first).

Pass when both hold:

| statistic | threshold | origin |
|---|---|---|
| energy distance, 80 generated vs 80 real | <= 0.409 | 95th percentile over 500 identity-balanced random halvings of the real corpus |
| largest single-feature two-sample KS statistic | <= 0.385 | same halvings, 95th percentile of the per-split maximum |

The threshold means: the generated set is no farther from the real set than one random half of the real set is from the other half.

## 2. Blind pairwise test (human)

Both sides are rendered through the same renderer from encodings, so stroke texture cannot give the source away: the real side is the hand encodings in `encodings/`, not the scans. At least three raters who did not work on this project each see 40 pairs, one real and one generated per pair, in random left/right order, and pick the real one.

Pass when the pooled accuracy's 95% Wilson interval contains 0.5. For 120 trials that is an accuracy of at most 0.59.

## 3. Diversity floor (automatic)

Mean pairwise Euclidean distance between the 80 generated feature vectors (standardised as in test 1) must be at least 0.8 times the same quantity for the 80 real drawings. This guards against passing test 1 by producing near-copies of a few corpus modes.

## 4. Coverage by construction

The generator emits only members of the frozen vocabulary; its outputs must contain no `path` escapes. (Escapes are a measurement of the corpus, not a tool for the generator.)

## What the test does not cover

Whether a design looks like a Goetic seal to someone who knows the corpus is test 2. Whether it looks good is nobody's test and is not claimed.
