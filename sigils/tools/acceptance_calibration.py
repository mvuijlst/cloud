"""Calibrate the distribution-distance threshold for the generator acceptance test.

Question: how far apart, on the measured features, are two random halves of the
real corpus? A future generator's 80 outputs must be no farther from the 80
real drawings than that. Writes data/acceptance_calibration.json.

Distance: energy distance between the two sets after standardising every
feature on the full corpus (counts log1p). Splits are identity-balanced (both
drawings of a doubled identity go to the same half).
"""
import csv
import json
import random
from collections import defaultdict
from pathlib import Path
import numpy as np
from scipy.spatial.distance import cdist
from scipy.stats import ks_2samp

ROOT = Path(__file__).resolve().parents[1]
FEATURES = ['endpoints', 'junctions', 'cycle_rank', 'rings', 'enclosures', 'components_t128',
            'ink_fraction', 'aspect', 'orient_h', 'orient_v', 'orient_diag', 'branch_straightness', 'sym_lr', 'sym_tb']
LOG = {'endpoints', 'junctions', 'cycle_rank', 'rings', 'enclosures', 'components_t128'}


def energy_distance(A, B):
    dab = cdist(A, B).mean(); daa = cdist(A, A).mean(); dbb = cdist(B, B).mean()
    return float(2 * dab - daa - dbb)


def main():
    rows = list(csv.DictReader(open(ROOT / 'data' / 'features.csv', encoding='utf-8')))
    for r in rows:
        for k, v in list(r.items()):
            if k not in ('id', 'variant'):
                r[k] = float(v)
        r['orient_diag'] = r['orient_d1'] + r['orient_d2']
    X = np.array([[np.log1p(r[f]) if f in LOG else r[f] for f in FEATURES] for r in rows])
    mu, sd = X.mean(0), X.std(0) + 1e-9
    Z = (X - mu) / sd
    ids = defaultdict(list)
    for i, r in enumerate(rows):
        ids[int(r['identity'])].append(i)
    idents = sorted(ids)
    rng = random.Random(20261024)
    dists = []; ks_max = []
    for _ in range(500):
        rng.shuffle(idents)
        half = set(idents[:len(idents) // 2])
        A = np.array([Z[i] for k in idents if k in half for i in ids[k]])
        B = np.array([Z[i] for k in idents if k not in half for i in ids[k]])
        dists.append(energy_distance(A, B))
        ks_max.append(max(ks_2samp(A[:, j], B[:, j]).statistic for j in range(Z.shape[1])))
    out = dict(
        features=FEATURES, standardisation=dict(mean=mu.tolist(), std=sd.tolist(), log1p=sorted(LOG)),
        splits=500, seed=20261024,
        energy_distance=dict(median=float(np.median(dists)), p90=float(np.percentile(dists, 90)), p95=float(np.percentile(dists, 95)), max=float(max(dists))),
        max_per_feature_ks=dict(median=float(np.median(ks_max)), p95=float(np.percentile(ks_max, 95))),
        rule='A set of 80 generated drawings passes the distribution test if its energy distance to the 80 real drawings, on these standardised features, is at most the p95 value above, and no single feature has a two-sample KS statistic above the p95 value above.')
    (ROOT / 'data' / 'acceptance_calibration.json').write_text(json.dumps(out, indent=1), encoding='utf-8', newline='\n')
    print(json.dumps({k: out[k] for k in ('energy_distance', 'max_per_feature_ks')}, indent=1))


if __name__ == '__main__':
    main()
