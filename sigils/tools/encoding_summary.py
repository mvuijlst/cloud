"""Aggregate the hand encodings: coverage, escapes, structure, scores, held-out result.

Reads encodings/*.json, data/encoding_scores.csv (run tools/score.py --all first),
data/holdout.json, data/clusters.json. Writes data/encoding_summary.json and prints
the tables used in FINDINGS.md.
"""
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path
import numpy as np
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sigil  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]


def main():
    hold = json.loads((ROOT / 'data' / 'holdout.json').read_text(encoding='utf-8'))
    holdout_ids = set(hold['holdout']); pilot_ids = set(hold['pilot'])
    scores = {r['id']: r for r in csv.DictReader(open(ROOT / 'data' / 'encoding_scores.csv', encoding='utf-8'))}
    encs = {}
    for p in sorted((ROOT / 'encodings').glob('*.json')):
        encs[p.stem] = sigil.load(p)
    man = {c['id']: c for c in json.loads((ROOT / 'data' / 'crop_manifest.json').read_text(encoding='utf-8'))['cells']}
    missing = sorted(set(man) - set(encs))
    rows = []
    type_counts = Counter(); fam_esc = defaultdict(list); wishes = []
    for cid, e in encs.items():
        c = sigil.count_members(e)
        s = scores.get(cid, {})
        grp = 'holdout' if e['identity'] in holdout_ids else 'pilot' if e['identity'] in pilot_ids else 'main'
        esc_members = sigil.expand(e.get('escapes', []))
        rows.append(dict(id=cid, group=grp, family=e.get('family_by_eye', ''), primitives=c['primitives'], escapes=c['escapes'],
                         repeats=c['repeats'], mirrors=c['mirrors'], by_type=c['by_type'],
                         cov=float(s.get('cov', 'nan')), prec=float(s.get('prec', 'nan')), iou=float(s.get('iou_d1', 'nan')),
                         accepted=s.get('accepted', '') == 'True', wishes=e.get('wishes', [])))
        type_counts.update(c['by_type'])
        fam_esc[e.get('family_by_eye', '')].append(c['escapes'])
        for w in e.get('wishes', []):
            wishes.append((cid, w))
    def agg(sel):
        if not sel:
            return {}
        return dict(n=len(sel), accepted=sum(r['accepted'] for r in sel), mean_cov=round(float(np.mean([r['cov'] for r in sel])), 3),
                    mean_prec=round(float(np.mean([r['prec'] for r in sel])), 3), mean_iou=round(float(np.mean([r['iou'] for r in sel])), 3),
                    primitives_median=float(np.median([r['primitives'] for r in sel])), primitives_total=sum(r['primitives'] for r in sel),
                    escapes_total=sum(r['escapes'] for r in sel), with_escapes=sum(1 for r in sel if r['escapes'] > 0),
                    with_repeat=sum(1 for r in sel if r['repeats'] > 0), with_mirror=sum(1 for r in sel if r['mirrors'] > 0))
    out = dict(
        n_encoded=len(encs), n_missing=len(missing), missing=missing,
        all=agg(rows), by_group={g: agg([r for r in rows if r['group'] == g]) for g in ('pilot', 'main', 'holdout')},
        by_family={f: agg([r for r in rows if r['family'] == f]) for f in sorted(set(r['family'] for r in rows))},
        primitive_type_counts=dict(type_counts.most_common()),
        escapes_by_family={f: dict(drawings=len(v), total=sum(v), with_escapes=sum(1 for x in v if x > 0)) for f, v in fam_esc.items()},
        wishes=[dict(id=c, wish=w) for c, w in wishes],
        per_drawing=rows)
    (ROOT / 'data' / 'encoding_summary.json').write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding='utf-8', newline='\n')
    print('encoded', len(encs), 'missing', missing)
    for g, a in out['by_group'].items():
        print(g, a)
    print('types', out['primitive_type_counts'])
    print('escapes by family', out['escapes_by_family'])
    print('wishes', len(wishes))
    for c, w in wishes:
        print('  ', c, w)


if __name__ == '__main__':
    main()
