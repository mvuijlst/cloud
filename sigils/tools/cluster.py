"""Cluster the 80 drawings on measured features and compare with eyeballed families.

Reads data/features.csv. Writes data/clusters.json, data/cluster_sheet.png,
data/dendrogram.png and data/holdout.json (the predeclared held-out identities
for the vocabulary test, chosen here before any encoding was written).
"""
import csv
import json
import random
from collections import Counter, defaultdict
from pathlib import Path
import numpy as np
import cv2
from scipy.cluster.hierarchy import linkage, fcluster, dendrogram
from scipy.spatial.distance import pdist
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
K = 6
FEATURES = ['endpoints', 'junctions', 'cycle_rank', 'rings', 'enclosures', 'components_t128',
            'ink_fraction', 'aspect', 'orient_h', 'orient_v', 'orient_diag', 'branch_straightness', 'sym_lr', 'sym_tb']
LOG = {'endpoints', 'junctions', 'cycle_rank', 'rings', 'enclosures', 'components_t128'}

# Families named by eye in the superseded ANALYSIS.md section 3.2 (examples only).
EYEBALL = {
    'axial': [1, 3, 5, 22, 59],
    'comb': [9, 11, 19, 50, 72],
    'bowl': [2, 12, 14, 45, 49],
    'compartment': [17, 30, 36, 37, 38, 39, 40, 47, 48, 52],
    'radial': [29, 54, 57, 62, 69],
    'cursive': [13, 26, 53, 70],
}
PILOT = [1, 9, 12, 26, 36, 50, 61, 69]


def main():
    rows = list(csv.DictReader(open(ROOT / 'data' / 'features.csv', encoding='utf-8')))
    for r in rows:
        for k, v in list(r.items()):
            if k not in ('id', 'variant'):
                r[k] = float(v)
        r['orient_diag'] = r['orient_d1'] + r['orient_d2']
    X = np.array([[np.log1p(r[f]) if f in LOG else r[f] for f in FEATURES] for r in rows])
    X = (X - X.mean(0)) / (X.std(0) + 1e-9)
    Z = linkage(X, method='ward')
    labels = fcluster(Z, K, criterion='maxclust')
    # silhouette for k = 2..10 to report the natural number of groups
    D = pdist(X)
    from scipy.spatial.distance import squareform
    Dm = squareform(D)
    sil = {}
    for k in range(2, 11):
        lab = fcluster(Z, k, criterion='maxclust')
        s = []
        for i in range(len(rows)):
            same = lab == lab[i]
            if same.sum() <= 1:
                s.append(0); continue
            a = Dm[i][same].sum() / (same.sum() - 1)
            b = min(Dm[i][lab == c].mean() for c in set(lab) if c != lab[i])
            s.append((b - a) / max(a, b))
        sil[k] = round(float(np.mean(s)), 3)

    clusters = defaultdict(list)
    for r, l in zip(rows, labels):
        clusters[int(l)].append(r['id'])
    # describe each cluster by feature means (unstandardised)
    desc = {}
    for c, ids in clusters.items():
        sub = [r for r in rows if r['id'] in ids]
        desc[c] = {f: round(float(np.mean([r[f] for r in sub])), 3) for f in FEATURES}

    # compare with eyeballed families
    fam_of = {}
    for fam, ids in EYEBALL.items():
        for i in ids:
            fam_of[i] = fam
    table = defaultdict(Counter)
    for r, l in zip(rows, labels):
        fam = fam_of.get(int(r['identity']))
        if fam:
            table[fam][int(l)] += 1
    # adjusted Rand index between cluster labels and family labels on the labelled drawings
    lab_pairs = [(int(l), fam_of[int(r['identity'])]) for r, l in zip(rows, labels) if int(r['identity']) in fam_of]
    ari = adjusted_rand(lab_pairs)

    # held-out identities: 10, stratified by cluster, variants kept together, pilot excluded, seed fixed
    rng = random.Random(20261024)
    ident_cluster = {}
    for r, l in zip(rows, labels):
        ident_cluster.setdefault(int(r['identity']), int(l))  # cluster of the 'a' drawing
    by_c = defaultdict(list)
    for i, c in ident_cluster.items():
        if i not in PILOT:
            by_c[c].append(i)
    sizes = {c: len(v) for c, v in by_c.items()}
    total = sum(sizes.values())
    quota = {c: max(1, round(10 * n / total)) for c, n in sizes.items()}
    while sum(quota.values()) > 10:
        c = max(quota, key=lambda c: quota[c]); quota[c] -= 1
    while sum(quota.values()) < 10:
        c = max(sizes, key=lambda c: sizes[c] / max(1, quota[c])); quota[c] += 1
    holdout = []
    for c in sorted(by_c):
        pool = sorted(by_c[c]); rng.shuffle(pool)
        holdout += pool[:quota[c]]
    holdout = sorted(holdout)

    # the same comparison against the full by-eye assignment of all 72 identities (data/families_by_eye.json)
    fe = json.loads((ROOT / 'data' / 'families_by_eye.json').read_text(encoding='utf-8'))
    def fam_full(r):
        return fe['variant_overrides'].get(r['id'], fe['by_identity'][str(int(r['identity']))])
    table_full = defaultdict(Counter)
    for r, l in zip(rows, labels):
        table_full[fam_full(r)][int(l)] += 1
    ari_full = adjusted_rand([(int(l), fam_full(r)) for r, l in zip(rows, labels)])
    out = dict(method='Ward linkage on standardised features; counts log1p-transformed', k=K, features=FEATURES,
               eyeball_full_vs_cluster={fam: dict(cnt) for fam, cnt in table_full.items()}, adjusted_rand_index_full=round(ari_full, 3),
               silhouette_by_k=sil, clusters={c: sorted(ids) for c, ids in sorted(clusters.items())},
               cluster_feature_means=desc, eyeball_examples=EYEBALL,
               eyeball_vs_cluster={fam: dict(cnt) for fam, cnt in table.items()}, adjusted_rand_index=round(ari, 3))
    (ROOT / 'data' / 'clusters.json').write_text(json.dumps(out, indent=1), encoding='utf-8', newline='\n')
    if not (ROOT / 'data' / 'holdout.json').exists():
      (ROOT / 'data' / 'holdout.json').write_text(json.dumps(dict(
        chosen_on='2026-10-24, before any encoding was written', seed=20261024,
        rule='10 identities stratified by feature cluster of the a-drawing, pilot identities excluded, variants kept together',
        pilot=PILOT, holdout=holdout), indent=1), encoding='utf-8', newline='\n')

    # dendrogram
    plt.figure(figsize=(18, 6))
    dendrogram(Z, labels=[r['id'] for r in rows], leaf_font_size=7, color_threshold=Z[-(K - 1), 2])
    plt.title('Ward clustering of 80 drawings on 14 measured features')
    plt.tight_layout(); plt.savefig(ROOT / 'data' / 'dendrogram.png', dpi=110); plt.close()

    # contact sheet by cluster
    man = {c['id']: c for c in json.loads((ROOT / 'data' / 'crop_manifest.json').read_text(encoding='utf-8'))['cells']}
    cell = 150; cols = 12
    rows_img = []
    for c in sorted(clusters):
        ids = sorted(clusters[c])
        n_rows = (len(ids) + cols - 1) // cols
        sheet = np.full((n_rows * cell + 24, cols * cell, 3), 255, np.uint8)
        cv2.putText(sheet, f'cluster {c}  n={len(ids)}', (4, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
        for i, cid in enumerate(ids):
            im = cv2.imread(str(ROOT / man[cid]['crop_file']))
            h, w = im.shape[:2]; s = (cell - 24) / max(h, w)
            im = cv2.resize(im, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
            y0 = 24 + (i // cols) * cell; x0 = (i % cols) * cell
            sheet[y0:y0 + im.shape[0], x0:x0 + im.shape[1]] = im
            cv2.putText(sheet, cid, (x0 + 2, y0 + cell - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 200), 1)
        rows_img.append(sheet)
    cv2.imwrite(str(ROOT / 'data' / 'cluster_sheet.png'), np.vstack(rows_img))

    print('silhouette by k:', sil)
    for c in sorted(clusters):
        print(f'cluster {c} ({len(clusters[c])}):', ' '.join(sorted(clusters[c])))
    print('eyeball vs cluster:', json.dumps(out['eyeball_vs_cluster']))
    print('ARI (33 example identities)', round(ari, 3), ' ARI (all 80, full by-eye assignment)', round(ari_full, 3))
    print('full by-eye vs cluster:', json.dumps(out['eyeball_full_vs_cluster']))
    print('holdout', holdout)


def adjusted_rand(pairs):
    a = [p[0] for p in pairs]; b = [p[1] for p in pairs]
    from math import comb
    ct = Counter(pairs)
    sum_ij = sum(comb(v, 2) for v in ct.values())
    sum_a = sum(comb(v, 2) for v in Counter(a).values())
    sum_b = sum(comb(v, 2) for v in Counter(b).values())
    n2 = comb(len(pairs), 2)
    expected = sum_a * sum_b / n2
    mx = (sum_a + sum_b) / 2
    return (sum_ij - expected) / (mx - expected) if mx != expected else 0.0


if __name__ == '__main__':
    main()
