"""Run the automatic parts of ACCEPTANCE.md on a folder of encodings.

    python tools/acceptance.py <folder> [--out data/<name>.json]

Tests 1 (energy distance, max KS), 3 (diversity floor) and 4 (no escapes), with
the thresholds and standardisation stored in data/acceptance_calibration.json.
Every encoding is rendered with tools/sigil.py at the corpus median height
(133 px) and measured with tools/features.py, exactly as the real crops were.
Rendering is exact-width with stroke x STROKE_K; --aa restores the original
anti-aliased renderer, under which even the hand encodings fail (GENERATOR.md).
"""
import csv
import json
import sys
import tempfile
from pathlib import Path
import numpy as np
import cv2
from scipy.spatial.distance import cdist, pdist
from scipy.stats import ks_2samp

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sigil  # noqa: E402
import features  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
HEIGHT = 133
# Encodings carry the measured stroke (median 2 x distance transform on the
# skeleton), which overstates the drawn width. 0.75 makes the paired median ink
# fraction of the 60 hand encodings equal to that of their scans (GENERATOR.md).
STROKE_K = 0.75


def energy_distance(A, B):
    return float(2 * cdist(A, B).mean() - cdist(A, A).mean() - cdist(B, B).mean())


def standardise(rows, cal):
    F = cal['features']; LOG = set(cal['standardisation']['log1p'])
    mu = np.array(cal['standardisation']['mean']); sd = np.array(cal['standardisation']['std'])
    X = []
    for r in rows:
        r = dict(r); r['orient_diag'] = float(r['orient_d1']) + float(r['orient_d2'])
        X.append([np.log1p(float(r[f])) if f in LOG else float(r[f]) for f in F])
    return (np.array(X) - mu) / sd


def real_rows():
    return list(csv.DictReader(open(ROOT / 'data' / 'features.csv', encoding='utf-8')))


def scale_stroke(enc, k):
    enc = json.loads(json.dumps(enc)); enc['stroke'] *= k
    def walk(ms):
        for m in ms:
            if 'w' in m:
                m['w'] *= k
            if m['t'] in sigil.GROUPING:
                walk(m['m'])
    walk(enc['members']); walk(enc.get('escapes', []))
    return enc


def measure_encoding(enc, height=HEIGHT, exact=True, k=STROKE_K):
    img = sigil.render(scale_stroke(enc, k) if exact else enc, height, exact=exact)
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / 'x.png'; cv2.imwrite(str(p), img)
        return features.measure(p)


def evaluate(gen_rows, escapes=0, label=''):
    cal = json.loads((ROOT / 'data' / 'acceptance_calibration.json').read_text(encoding='utf-8'))
    Zr = standardise(real_rows(), cal); Zg = standardise(gen_rows, cal)
    ed = energy_distance(Zg, Zr)
    ks = {f: float(ks_2samp(Zg[:, j], Zr[:, j]).statistic) for j, f in enumerate(cal['features'])}
    div = float(pdist(Zg).mean() / pdist(Zr).mean())
    t_ed = cal['energy_distance']['p95']; t_ks = cal['max_per_feature_ks']['p95']
    res = dict(label=label, n=len(gen_rows),
               energy_distance=round(ed, 4), energy_threshold=round(t_ed, 4), pass_energy=ed <= t_ed,
               max_ks=round(max(ks.values()), 4), max_ks_feature=max(ks, key=ks.get), ks_threshold=round(t_ks, 4),
               pass_ks=max(ks.values()) <= t_ks,
               diversity_ratio=round(div, 4), pass_diversity=div >= 0.8,
               escapes=escapes, pass_escapes=escapes == 0,
               ks_by_feature={k: round(v, 3) for k, v in ks.items()},
               mean_z_by_feature={f: round(float(Zg[:, j].mean() - Zr[:, j].mean()), 3) for j, f in enumerate(cal['features'])})
    res['pass_automatic'] = all(res[k] for k in ('pass_energy', 'pass_ks', 'pass_diversity', 'pass_escapes'))
    return res


def main():
    folder = Path(sys.argv[1])
    out = Path(sys.argv[sys.argv.index('--out') + 1]) if '--out' in sys.argv else None
    rows = []; esc = 0
    for p in sorted(folder.glob('*.json')):
        enc = sigil.load(p)
        esc += len(sigil.expand(enc.get('escapes', [])))
        rows.append(dict(id=enc.get("id", p.stem), **measure_encoding(enc, exact="--aa" not in sys.argv)))
    res = evaluate(rows, esc, label=str(folder))
    print(json.dumps({k: v for k, v in res.items()}, indent=1))
    if out:
        out.write_text(json.dumps(dict(result=res, rows=rows), indent=1), encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()
