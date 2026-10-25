"""Part statistics of the hand encodings, the targets the generator is fitted to.

Writes data/encoding_stats.json: per-encoding primitive counts by type (after
expanding repeat and mirror), header aspect and stroke, use of mirror and
repeat, sizes of rings, crosses and triangles, line orientation and length,
and what sits at the free ends of lines (ring, cross, triangle, spiral, other
line, nothing). Units are the encoding units (drawing height 1).
"""
import json
import math
import sys
from collections import Counter
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sigil  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
TYPES = ['line', 'pline', 'arc', 'bez', 'ring', 'dot', 'cross', 'tri', 'spiral', 'crescent']


def q(v):
    v = np.asarray(v, float)
    if not len(v):
        return None
    return dict(n=len(v), q10=round(float(np.percentile(v, 10)), 4), q25=round(float(np.percentile(v, 25)), 4),
                median=round(float(np.median(v)), 4), q75=round(float(np.percentile(v, 75)), 4),
                q90=round(float(np.percentile(v, 90)), 4), mean=round(float(v.mean()), 4))


def end_context(p, prims, self_i, stroke):
    """What touches the line end p: nearest decoration within 1.5 stroke."""
    tol = 1.5 * stroke
    best = ('free', 1e9)
    for j, m in enumerate(prims):
        if j == self_i:
            continue
        t = m['t']
        if t == 'ring':
            d = abs(math.dist(p, m['c']) - m['r'])
        elif t == 'dot':
            d = max(0.0, math.dist(p, m['c']) - m['r'])
        elif t == 'cross':
            d = max(0.0, math.dist(p, m['c']) - m['s'])
        elif t == 'tri':
            d = min(math.dist(p, v) for v in m['p'])
            c = np.mean(m['p'], 0); d = min(d, math.dist(p, c))
        elif t == 'spiral':
            pts = sigil._spiral_points(m['c'], m['r'][0], m['r'][1], m['a'][0], m['a'][1])
            d = float(np.min(np.hypot(pts[:, 0] - p[0], pts[:, 1] - p[1])))
        elif t == 'line':
            a = np.array(m['p'][:2]); b = np.array(m['p'][2:]); ab = b - a
            tt = np.clip(np.dot(np.array(p) - a, ab) / max(np.dot(ab, ab), 1e-12), 0, 1)
            d = float(np.linalg.norm(a + tt * ab - p)); t = 'line'
        elif t == 'arc':
            pts = sigil._arc_points(m['c'], m['r'], m['a'][0], m['a'][1])
            d = float(np.min(np.hypot(pts[:, 0] - p[0], pts[:, 1] - p[1])))
        elif t in ('pline', 'bez'):
            pts = np.array(m['p'], float) if t == 'pline' else sigil._bez_points(m['p'])
            d = float(np.min(np.hypot(pts[:, 0] - p[0], pts[:, 1] - p[1])))
        else:
            continue
        rank = {'ring': 0, 'cross': 1, 'tri': 2, 'spiral': 3, 'dot': 4, 'crescent': 5}.get(t, 9)
        if d <= tol and (best[0] == 'free' or (rank, d) < (best[2], best[1])):
            best = (t, d, rank)
    return best[0]


def main():
    per = []; rings = []; crosses = []; tris = []; lines_len = []; line_orient = Counter(); ends = Counter()
    arcs_r = []; spirals = []
    for p in sorted((ROOT / 'encodings').glob('*.json')):
        enc = sigil.load(p)
        prims = sigil.expand(enc['members'])
        top = Counter(m['t'] for m in enc['members'])
        c = Counter(m['t'] for m in prims)
        walk = list(sigil._walk(enc['members']))
        per.append(dict(id=enc['id'], family=enc.get('family_by_eye'), aspect=enc['aspect'], stroke=enc['stroke'],
                        total=len(prims), mirror=any(m['t'] == 'mirror' for m in walk),
                        mirror_axes=sorted({m['axis'] for m in walk if m['t'] == 'mirror'}),
                        repeat=any(m['t'] == 'repeat' for m in walk),
                        repeat_n=[m['n'] for m in walk if m['t'] == 'repeat'],
                        escapes=len(enc.get('escapes', [])), **{t: c.get(t, 0) for t in TYPES}))
        s = enc['stroke']
        for i, m in enumerate(prims):
            t = m['t']
            if t == 'ring':
                rings.append(m['r'])
            elif t == 'cross':
                crosses.append(m['s'])
            elif t == 'tri':
                pts = np.array(m['p']); tris.append(float(np.ptp(pts, 0).max()))
            elif t == 'arc':
                r = m['r']; arcs_r.append(float(np.mean(r)) if not np.isscalar(r) else r)
            elif t == 'spiral':
                spirals.append(max(m['r']))
            elif t == 'line':
                x1, y1, x2, y2 = m['p']; L = math.hypot(x2 - x1, y2 - y1); lines_len.append(L)
                a = math.degrees(math.atan2(y2 - y1, x2 - x1)) % 180
                line_orient['h' if min(a, 180 - a) < 10 else 'v' if abs(a - 90) < 10 else 'diag'] += 1
                for e in ((x1, y1), (x2, y2)):
                    ends[end_context(e, prims, i, s)] += 1
    fam = Counter(r['family'] for r in per)
    out = dict(
        n=len(per),
        families=dict(fam),
        aspect=q([r['aspect'] for r in per]), stroke=q([r['stroke'] for r in per]),
        total_primitives=q([r['total'] for r in per]),
        per_type={t: q([r[t] for r in per]) for t in TYPES},
        per_type_share_of_drawings_using={t: round(sum(r[t] > 0 for r in per) / len(per), 3) for t in TYPES},
        mirror_fraction=round(sum(r['mirror'] for r in per) / len(per), 3),
        mirror_axes=dict(Counter(a for r in per for a in r['mirror_axes'])),
        repeat_fraction=round(sum(r['repeat'] for r in per) / len(per), 3),
        repeat_n=dict(Counter(n for r in per for n in r['repeat_n'])),
        ring_r=q(rings), cross_s=q(crosses), tri_size=q(tris), arc_r=q(arcs_r), spiral_r=q(spirals),
        line_length=q(lines_len), line_orientation=dict(line_orient),
        line_end_context={k: round(v / sum(ends.values()), 3) for k, v in ends.most_common()},
        per_family_total={f: q([r['total'] for r in per if r['family'] == f]) for f in fam},
        per_encoding=per)
    (ROOT / 'data' / 'encoding_stats.json').write_text(json.dumps(out, indent=1), encoding='utf-8', newline='\n')
    print(json.dumps({k: v for k, v in out.items() if k != 'per_encoding'}, indent=1))


if __name__ == '__main__':
    main()
