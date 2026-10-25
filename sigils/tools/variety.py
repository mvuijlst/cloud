"""How varied is a set of seals, compared with the 72 on the sheet?

    python tools/variety.py <folder of generated encodings> [--out data/<name>.json]

Three measures, each applied to the real seals and to the generated set:

  look-alike   skeleton F-score between every pair of seals in the set (the
               measure of tools/novelty.py: aspect kept, best over shifts and
               flips). Real: the 72 a-drawings from the crops, and the 60 hand
               encodings rendered the way generated seals are (like with like).
               Higher means the seals resemble each other more. Also each seal's
               most similar other seal (clumping).
  parts        share of primitives by type, and per seal the number of types
               used and the entropy of its type mix (encodings: the 60 hand
               encodings against the generated set).
  line ends    what each end of a straight line touches (the classification of
               tools/encoding_stats.py): a ring, another line, an arc, nothing...
  layout       coarse silhouettes (24 px, blurred) compared by correlation;
               higher means the overall arrangements are more alike.
  composition  how often each construction step recurs (generated only; the
               grammar labels in "notes").

Writes the numbers to --out if given.
"""
import json
import math
import sys
from collections import Counter
from pathlib import Path
import numpy as np
import cv2

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sigil  # noqa: E402
import novelty  # noqa: E402
import encoding_stats  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
TYPES = ['line', 'pline', 'arc', 'bez', 'ring', 'dot', 'cross', 'tri', 'spiral', 'crescent']


def pairwise(masks):
    n = len(masks); S = np.zeros((n, n))
    for i in range(n):
        for j in range(i + 1, n):
            S[i, j] = S[j, i] = novelty.similarity(masks[i], masks[j])
    iu = np.triu_indices(n, 1)
    vals = S[iu]
    nn = np.array([np.max(np.delete(S[i], i)) for i in range(n)])
    return dict(n=n, mean=round(float(vals.mean()), 4), median=round(float(np.median(vals)), 4),
                p90=round(float(np.percentile(vals, 90)), 4), nn_median=round(float(np.median(nn)), 4),
                nn_p90=round(float(np.percentile(nn, 90)), 4))


def enc_masks(encs):
    return [novelty.norm_mask(sigil.render(e, 133, exact=True)) for e in encs]


def parts(encs):
    tot = Counter(); ntypes = []; ent = []
    for e in encs:
        c = Counter(m['t'] for m in sigil.expand(e['members']))
        tot.update(c)
        n = sum(c.values())
        ntypes.append(len(c))
        ent.append(-sum(v / n * math.log2(v / n) for v in c.values()))
    s = sum(tot.values())
    return dict(share={t: round(tot.get(t, 0) / s, 3) for t in TYPES}, types_per_seal=round(float(np.mean(ntypes)), 2),
                entropy_per_seal=round(float(np.mean(ent)), 3), set_entropy=round(-sum(v / s * math.log2(v / s) for v in tot.values()), 3))


def line_ends(encs):
    c = Counter()
    for e in encs:
        prims = sigil.expand(e['members'])
        for i, m in enumerate(prims):
            if m['t'] == 'line':
                x1, y1, x2, y2 = m['p']
                for q in ((x1, y1), (x2, y2)):
                    c[encoding_stats.end_context(q, prims, i, e['stroke'])] += 1
    n = sum(c.values())
    return {k: round(v / n, 3) for k, v in c.most_common()}


def layout_vec(grey):
    m = (grey < 128).astype(np.uint8) * 255
    ys, xs = np.nonzero(m)
    m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = m.shape; k = 24 / max(h, w)
    m = cv2.resize(m, (max(1, int(w * k)), max(1, int(h * k))), interpolation=cv2.INTER_AREA)
    out = np.zeros((24, 24), np.float32); y0 = (24 - m.shape[0]) // 2; x0 = (24 - m.shape[1]) // 2
    out[y0:y0 + m.shape[0], x0:x0 + m.shape[1]] = m / 255
    v = cv2.GaussianBlur(out, (0, 0), 1).ravel(); v -= v.mean()
    return v / (np.linalg.norm(v) + 1e-9)


def layout(greys):
    V = np.array([layout_vec(g) for g in greys]); S = V @ V.T; n = len(V); iu = np.triu_indices(n, 1)
    return dict(mean=round(float(S[iu].mean()), 3), nn_median=round(float(np.median([np.max(np.delete(S[i], i)) for i in range(n)])), 3))


def main():
    folder = Path(sys.argv[1])
    out = Path(sys.argv[sys.argv.index('--out') + 1]) if '--out' in sys.argv else None
    gen = [sigil.load(p) for p in sorted(folder.glob('*.json'))]
    real_encs = [sigil.load(p) for p in sorted((ROOT / 'encodings').glob('*.json'))]
    man = json.loads((ROOT / 'data' / 'crop_manifest.json').read_text(encoding='utf-8'))
    real_crops = [novelty.norm_mask(cv2.imread(str(ROOT / c['crop_file']), cv2.IMREAD_GRAYSCALE)) for c in man['cells'] if c['variant'] == 'a']
    crop_greys = [cv2.imread(str(ROOT / c['crop_file']), cv2.IMREAD_GRAYSCALE) for c in man['cells'] if c['variant'] == 'a']
    res = dict(
        lookalike=dict(real_crops=pairwise(real_crops), real_encodings=pairwise(enc_masks(real_encs)), generated=pairwise(enc_masks(gen))),
        parts=dict(real_encodings=parts(real_encs), generated=parts(gen)),
        line_ends=dict(real_encodings=line_ends(real_encs), generated=line_ends(gen)),
        layout=dict(real_crops=layout(crop_greys), generated=layout([sigil.render(e, 133, exact=True) for e in gen])))
    steps = Counter()
    for e in gen:
        body = e.get('notes', '').split(':', 1)[-1]
        for st in set(s.strip(' .') for s in body.split(';')):
            if st:
                steps[st.split(' with ')[0] if st.startswith(('pendant', 'stem', 'spur', 'arm', 'diagonal spur', 'crossbar')) else st] += 1
    res['composition'] = dict(n=len(gen), most_common=[(k, v) for k, v in steps.most_common(15)])
    for k, v in res['lookalike'].items():
        print(f'look-alike {k:15s} n={v["n"]:3d}  mean {v["mean"]:.3f}  median {v["median"]:.3f}  p90 {v["p90"]:.3f}  nearest-other median {v["nn_median"]:.3f}')
    for k, v in res['parts'].items():
        print(f'parts {k:15s} types/seal {v["types_per_seal"]}  entropy/seal {v["entropy_per_seal"]}  set entropy {v["set_entropy"]}  share {v["share"]}')
    for k, v in res['line_ends'].items():
        print(f'line ends {k:15s}', v)
    for k, v in res['layout'].items():
        print(f'layout {k:15s}', v)
    print('steps in how many of', len(gen), 'seals:', res['composition']['most_common'])
    if out:
        out.write_text(json.dumps(res, indent=1), encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()
