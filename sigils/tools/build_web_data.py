"""Write sigil-data.js: the numbers the browser generator is fitted to.

    python tools/build_web_data.py

The same inputs tools/generate.py reads: per-encoding totals and strokes and
the size quantiles from data/encoding_stats.json, and the aspects of each
family's drawings from data/features.csv with data/families_by_eye.json.

For the novelty test in the browser it also stores, for each of the 80 crops,
the skeleton tools/novelty.py compares against (aspect-kept 96 px, padded),
as base64 little-endian uint16 pixel indices, with the threshold from
data/novelty_calibration.json.

For the plate look it copies the ink and frame measurements of
data/plate_ink.json (tools/plate_ink.py), and for the names lettered round
the frame the spirit names on the sheet (data/crop_manifest.json labels):
the first name of each identity to learn from, every variant to avoid.

For the spirit's description, the odds of the slot grammar in lore.js,
measured on the 72 entries (data/goetia_slots.json, annotated by eye, and
data/goetia_entries_raw.json for the wording of the legions clause).
"""
import base64
import csv
import json
import sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import novelty  # noqa: E402


def novelty_refs():
    cal = json.loads((ROOT / 'data' / 'novelty_calibration.json').read_text(encoding='utf-8'))
    refs = []
    for rid, ident, (sk, _dt) in novelty.real_masks():
        idx = np.flatnonzero(sk).astype('<u2')
        refs.append(dict(id=rid, identity=ident, sk=base64.b64encode(idx.tobytes()).decode('ascii')))
    side = novelty.N + 2 * novelty.SHIFT
    return dict(threshold=cal['threshold_p95_nn_other_identity'], n=novelty.N, tau=novelty.TAU, shift=novelty.SHIFT,
                side=side, refs=refs)


def plate_params():
    t = json.loads((ROOT / 'data' / 'plate_ink.json').read_text(encoding='utf-8'))
    P = t['plates']
    med = lambda f: round(float(np.median([f(p) for p in P])), 5)
    return dict(
        rings=[dict(radius=med(lambda p, i=i: p['rings'][i]['radius']), width=med(lambda p, i=i: p['rings'][i]['width'])) for i in range(3)],
        width_cv=med(lambda p: np.mean([r['width_cv'] for r in p['rings']])),
        width_corr=med(lambda p: np.median([r['width_corr'] for r in p['rings']])),
        wobble_rms=med(lambda p: np.mean([r['wobble_rms'] for r in p['rings']])),
        wobble_corr=med(lambda p: np.median([r['wobble_corr'] for r in p['rings']])),
        edge_rag=med(lambda p: np.mean([r['edge_rag_rms'] for r in p['rings']])),
        ellipticity=med(lambda p: np.mean([r['ellipticity'] for r in p['rings']])),
        figure_reach=med(lambda p: p['figure']['max_radius']), figure_stroke=med(lambda p: p['figure']['stroke']),
        letter_height=med(lambda p: p['letters']['height']), letter_radius=med(lambda p: p['letters']['radius']),
        R_px=med(lambda p: p['R_px']))


def spirit_names():
    import re
    import unicodedata
    man = json.loads((ROOT / 'data' / 'crop_manifest.json').read_text(encoding='utf-8'))
    first = {}; every = set()
    for c in man['cells']:
        label = re.sub(r'^\s*\d+b?\.\s*', '', c['sheet_label'])
        for k, n in enumerate(label.split('/')):
            n = unicodedata.normalize('NFKD', n).encode('ascii', 'ignore').decode().upper()
            n = re.sub('[^A-Z]', '', n)
            if n:
                every.add(n)
                if k == 0:
                    first.setdefault(c['identity'], n)
    return dict(train=[first[i] for i in sorted(first)], avoid=sorted(every))


def lore_params():
    import re
    from collections import Counter
    E = json.loads((ROOT / 'data' / 'goetia_slots.json').read_text(encoding='utf-8'))['entries']
    raw = json.loads((ROOT / 'data' / 'goetia_entries_raw.json').read_text(encoding='utf-8'))
    n = len(E)
    ranks = Counter(r for e in E for r in e['ranks'])

    def adj(words):
        w = [x.capitalize() for x in words]
        return '' if not w else w[0] if len(w) == 1 else ', '.join(w[:-1]) + ' and ' + w[-1]
    adjectives = Counter(adj(e['rank_adjectives']) for e in E)
    counts = lambda key: sorted(Counter(len(e[key]) for e in E).items())
    seal_like = re.compile(r'seal|character|lamen|worn|wear', re.I)
    verbs = Counter()
    for e in raw:
        m = re.search(r'(governeth|ruleth over|ruleth|hath under (?:him|his (?:government|command|power))|commandeth|is (?:a )?(?:captain|chief|ruler) (?:of|over))\s+(?:over\s+)?\d+', e['text'], re.I)
        if m:
            v = m.group(1).lower()
            verbs['ruleth over' if v == 'ruleth' else v] += 1
    order_n = sum(1 for e in E if e['order'])
    return dict(
        source='data/goetia_slots.json (72 entries annotated by eye) and data/goetia_entries_raw.json',
        ranks=[[r, c] for r, c in ranks.most_common()],
        adjectives=[[a, c] for a, c in adjectives.most_common()],
        legions=[e['legions'] for e in E if e['legions']],
        legion_verbs=[[v, c] for v, c in verbs.most_common()],
        n_appearances=[[1, 69], [2, 1]],          # one form, rarely more (Bael: "divers shapes")
        n_manner=[[k, c] for k, c in counts('manner') if k <= 2],
        n_offices=[[k, c] for k, c in counts('offices') if k >= 1],
        p=dict(second_rank=round(sum(1 for e in E if len(e['ranks']) > 1) / n, 3),
               location=round(sum(1 for e in E if e['location']) / n, 3),
               transformation=round(sum(1 for e in E if e['transformation']) / n, 3),
               nature=round(sum(1 for e in E if e['nature']) / n, 3),
               conditions=round(sum(1 for e in E if any(not seal_like.search(x) for x in e['conditions'])) / n, 3),
               order=round(order_n / n, 3),
               hope=round(sum(1 for e in E if e['order'] and e.get('order_extra')) / max(1, order_n), 3),
               seal=round(sum(1 for e in E if e.get('seal_clause')) / n, 3)))


def main():
    st = json.loads((ROOT / 'data' / 'encoding_stats.json').read_text(encoding='utf-8'))
    fam = json.loads((ROOT / 'data' / 'families_by_eye.json').read_text(encoding='utf-8'))['by_identity']
    aspects = {}
    for r in csv.DictReader(open(ROOT / 'data' / 'features.csv', encoding='utf-8')):
        aspects.setdefault(fam[str(int(r['identity']))], []).append(round(float(r['aspect']), 4))
    q = lambda k: {x: st[k][x] for x in ('q10', 'q25', 'median', 'q75', 'q90')}
    data = dict(
        source='sigils/data/encoding_stats.json, features.csv, families_by_eye.json (24 Oct 2026)',
        per=[dict(family=r['family'], total=r['total'], stroke=r['stroke']) for r in st['per_encoding']],
        ring_r=q('ring_r'), cross_s=q('cross_s'), tri_size=q('tri_size'), spiral_r=q('spiral_r'),
        aspects=aspects,
        novelty=novelty_refs(),
        plate=plate_params(),
        names=spirit_names(),
        lore=lore_params())
    js = ('// Generated by tools/build_web_data.py; do not edit by hand.\n'
          'globalThis.SIGIL_DATA = ' + json.dumps(data, separators=(',', ':')) + ';\n')
    (ROOT / 'sigil-data.js').write_text(js, encoding='utf-8', newline='\n')
    print('wrote sigil-data.js', len(js), 'bytes')


if __name__ == '__main__':
    main()
