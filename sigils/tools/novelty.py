"""Novelty test: is a generated sigil any closer to a real seal than real seals are to each other?

Similarity of two drawings: both ink masks cropped to their bounding box,
scaled (aspect kept) into 96 x 96 and skeletonised; the F-score of the two
skeletons, each pixel counting as matched when the other skeleton is within
2 px, maximised over shifts of +-4 px and over the identity, left-right,
top-bottom and 180-degree flips (a mirrored copy is still a copy).

The measure was chosen among eight (dilated-mask IoU and skeleton F-score,
stretched or aspect-kept, two tolerances each) as the one that best separates
the doubled identities' two drawings from nearest drawings of other identities:
six of the sixteen variant-to-partner similarities lie above the threshold
below, against two for dilated-mask IoU. The other five pairs are alternative
designs (witnesses/COLLATION.md), not redraws, and no measure should match them.

    python tools/novelty.py calibrate      -> data/novelty_calibration.json
    python tools/novelty.py <folder>       -> data/<folder name>_novelty.json

Calibration, from the 80 crops: for every drawing, its most similar drawing of
another identity; and the similarity of each doubled identity's two drawings.
The threshold is the 95th percentile of the first: a generated sigil passes when
its most similar real drawing is no more similar than that.
"""
import json
import sys
from pathlib import Path
import numpy as np
import cv2
from scipy import ndimage as ndi
from skimage.morphology import skeletonize

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sigil  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
N = 96; TAU = 2; SHIFT = 4


def norm_mask(grey):
    """Skeleton and its distance transform, aspect kept, padded for shifting."""
    m = grey < 128
    ys, xs = np.nonzero(m)
    m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.uint8) * 255
    h, w = m.shape; k = N / max(h, w)
    m = cv2.resize(m, (max(1, int(w * k)), max(1, int(h * k))), interpolation=cv2.INTER_AREA)
    out = np.zeros((N, N), np.uint8); y0 = (N - m.shape[0]) // 2; x0 = (N - m.shape[1]) // 2
    out[y0:y0 + m.shape[0], x0:x0 + m.shape[1]] = m
    sk = np.pad(skeletonize(out > 64), SHIFT)
    return sk, ndi.distance_transform_edt(~sk)


def variants(m):
    sk, dt = m
    return [(sk, dt), (sk[:, ::-1], dt[:, ::-1]), (sk[::-1], dt[::-1]), (sk[::-1, ::-1], dt[::-1, ::-1])]


def similarity(a, b):
    """Skeleton F-score at TAU, max over flips of b and shifts."""
    sa, da = a; best = 0.0
    for sb, db in variants(b):
        for dy in range(-SHIFT, SHIFT + 1, 2):
            for dx in range(-SHIFT, SHIFT + 1, 2):
                s2 = np.roll(np.roll(sb, dy, 0), dx, 1); d2 = np.roll(np.roll(db, dy, 0), dx, 1)
                p = (da[s2] <= TAU).mean(); r = (d2[sa] <= TAU).mean()
                best = max(best, 2 * p * r / max(p + r, 1e-9))
    return float(best)


def real_masks():
    man = json.loads((ROOT / 'data' / 'crop_manifest.json').read_text(encoding='utf-8'))
    out = []
    for c in man['cells']:
        out.append((c['id'], int(c['identity']), norm_mask(cv2.imread(str(ROOT / c['crop_file']), cv2.IMREAD_GRAYSCALE))))
    return out


def calibrate():
    R = real_masks()
    n = len(R); S = np.zeros((n, n))
    for i in range(n):
        for j in range(i + 1, n):
            S[i, j] = S[j, i] = similarity(R[i][2], R[j][2])
    nn = []; same = []
    for i in range(n):
        others = [(S[i, j], R[j][0]) for j in range(n) if R[j][1] != R[i][1]]
        s, who = max(others); nn.append(dict(id=R[i][0], nearest=who, sim=round(s, 4)))
        for j in range(i + 1, n):
            if R[j][1] == R[i][1]:
                same.append(dict(pair=[R[i][0], R[j][0]], sim=round(S[i, j], 4)))
    v = np.array([x['sim'] for x in nn])
    out = dict(method=__doc__.split('\n\n')[1].strip(), threshold_p95_nn_other_identity=round(float(np.percentile(v, 95)), 4),
               nn_other_identity=dict(min=float(v.min()), median=float(np.median(v)), p95=float(np.percentile(v, 95)), max=float(v.max())),
               same_identity_pairs=same, nearest=nn)
    (ROOT / 'data' / 'novelty_calibration.json').write_text(json.dumps(out, indent=1), encoding='utf-8', newline='\n')
    print(json.dumps({k: out[k] for k in ('threshold_p95_nn_other_identity', 'nn_other_identity', 'same_identity_pairs')}, indent=1))


def test(folder):
    cal = json.loads((ROOT / 'data' / 'novelty_calibration.json').read_text(encoding='utf-8'))
    thr = cal['threshold_p95_nn_other_identity']
    R = real_masks(); res = []
    for p in sorted(Path(folder).glob('*.json')):
        enc = sigil.load(p)
        g = norm_mask(sigil.render(enc, 133, exact=True))
        sims = sorted(((similarity(g, m), rid) for rid, _, m in R), reverse=True)
        res.append(dict(id=enc.get('id', p.stem), nearest=sims[0][1], sim=round(sims[0][0], 4),
                        second=sims[1][1], sim2=round(sims[1][0], 4), novel=sims[0][0] <= thr))
    v = np.array([r['sim'] for r in res])
    out = dict(threshold=thr, n=len(res), n_novel=int(sum(r['novel'] for r in res)),
               sim=dict(median=float(np.median(v)), max=float(v.max())), results=res)
    Path(ROOT / 'data' / f'{Path(folder).name}_novelty.json').write_text(json.dumps(out, indent=1), encoding='utf-8', newline='\n')
    print(json.dumps({k: out[k] for k in ('threshold', 'n', 'n_novel', 'sim')}, indent=1))
    return out


if __name__ == '__main__':
    calibrate() if sys.argv[1] == 'calibrate' else test(sys.argv[1])
