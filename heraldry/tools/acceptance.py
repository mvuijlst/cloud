"""Automatic acceptance tests for the arms generator (STUDY.md section 8, tests 1, 2, 4, 5).

usage: python acceptance.py <heraldry_dir> <samples.json>     (samples from tools/dump_samples.js)

Test 1  fit: share of development coats whose structure the grammar expresses (ok + bucket),
        and the bucket (charges outside the library) per slot.
Test 2  held-out reconstruction: the frozen parser on the custodian's held-out items; only counts
        are printed, never the blazons.
Test 4  distribution: one feature vector per coat; energy distance and the largest single-feature
        KS between n generated and n development coats, against the 95th percentile of 200 random
        halvings of the development corpus (n = min(500, half the corpus)).
        Since 26 Oct 2026 the generator differences coats to three or four elements (GENERATOR.md), so it
        departs from the whole corpus on purpose; the same test is also run against the corpus coats of
        three elements or more (complexity from the feature vector, as grammar.js counts it), with the
        complexity histograms of both.
Test 5  diversity (mean pairwise feature distance, at least 0.8 of the corpus's), repetition (share
        of the commonest canonical key, not above the corpus's own), and exact matches with real
        coats in the rolls' index (target: at least 70% of outputs match none).
Since 27 Oct 2026 the generator has one roll, 'late': Grünenberg (development coats), Rugen and St. Gallen-Haggenberg
pooled. Test 1 runs on each parsed roll, test 2 on the two rolls with held-out items, tests 4 and 5 on the generated
roll against the pooled corpus.
Writes data/acceptance.json.
"""
import json, sys, math, random, collections, importlib.util
from pathlib import Path
import numpy as np

D = Path(sys.argv[1]); SAMPLES = Path(sys.argv[2])
spec = importlib.util.spec_from_file_location('ps', D / 'tools' / 'parse_structure.py'); ps = importlib.util.module_from_spec(spec)
sys.argv = [sys.argv[0], str(D)]; spec.loader.exec_module(ps)
spec2 = importlib.util.spec_from_file_location('bw', D / 'tools' / 'build_web_data.py'); bw = importlib.util.module_from_spec(spec2); spec2.loader.exec_module(bw)

METAL = {'or', 'argent'}; COLOUR = {'gules', 'azure', 'sable', 'vert', 'purpure'}
PARTY = {'per pale', 'per fess', 'per bend', 'per bend sinister', 'per chevron', 'per saltire', 'quarterly', 'gyronny', 'tierced per fess', 'tierced per pale'}
PATTERN = {'barry', 'paly', 'bendy', 'bendy sinister', 'chequy', 'lozengy', 'chevronny'}
ORDG = {'fess': 'fess', 'bars': 'fess', 'pale': 'pale', 'pales': 'pale', 'bend': 'bend', 'bend sinister': 'bend', 'bends': 'bend', 'bends sinister': 'bend',
        'chevron': 'chevron', 'chevrons': 'chevron', 'cross': 'cross', 'saltire': 'cross', 'pile': 'other'}
CLASSES = ['lion', 'eagle', 'beast', 'bird', 'fish', 'flower', 'star', 'cross', 'geometric', 'object', 'plant', 'horn', 'other']
FEATS = ['f_plain', 'f_party', 'f_pattern', 'f_semy', 'line'] + [f'o_{k}' for k in ('none', 'fess', 'pale', 'bend', 'chevron', 'cross', 'other')] + \
        [f'm_{c}' for c in ['none'] + CLASSES] + ['m_n', 'on_n', 'ar_n', 'chief', 'chief_ch', 'bordure', 'label', 'canton', 'n_tinct', 'violation', 'quartered']


def feats(field_kind, semy, line, ord_kind, main_cls, main_n, on_n, ar_n, chief, chief_ch, bordure, label, canton, tincts, violation, quartered):
    v = dict.fromkeys(FEATS, 0.0)
    if semy: v['f_semy'] = 1
    elif field_kind in PARTY: v['f_party'] = 1
    elif field_kind in PATTERN: v['f_pattern'] = 1
    else: v['f_plain'] = 1
    v['line'] = 1 if line else 0
    v['o_' + (ORDG.get(ord_kind, 'other') if ord_kind else 'none')] = 1
    v['m_' + (main_cls or 'none')] = 1
    v['m_n'] = math.log1p(main_n); v['on_n'] = math.log1p(on_n); v['ar_n'] = math.log1p(ar_n)
    v['chief'] = chief; v['chief_ch'] = chief_ch; v['bordure'] = bordure; v['label'] = label; v['canton'] = canton
    ts = [t for t in tincts if t]
    v['n_tinct'] = len(set(ts)); v['violation'] = violation; v['quartered'] = quartered
    return [v[k] for k in FEATS]


def viol(under, over):
    if under in METAL and over in METAL: return 1
    if under in COLOUR and over in COLOUR: return 1
    return 0


def corpus_vec(r):
    f = r['field']; o = r.get('ordinary') or {}; m = r.get('main') or {}; a = r.get('around') or {}; ch = r.get('chief') or {}
    cls = None
    if m:
        cls = bw.cls_of(m.get('charge')) if m.get('charge') and not m.get('unsupported') else 'other'
    ft = f.get('t') or []
    first = o.get('t') if isinstance(o.get('t'), str) else (m.get('t') if m else None)
    v = viol(ft[0], first) if len(ft) == 1 and first and first != 'counterchanged' else 0
    ts = list(ft) + [x for x in [o.get('t') if isinstance(o.get('t'), str) else None, m.get('t'), a.get('t'), ch.get('t') if isinstance(ch.get('t'), str) else None,
                                 (o.get('on') or {}).get('t'), (r.get('bordure') or {}).get('t') if isinstance((r.get('bordure') or {}).get('t'), str) else None] if x and x != 'counterchanged']
    return feats(f['kind'], bool(f.get('semy')), f.get('line') or o.get('line'), o.get('kind'), cls, m.get('n', 0) if m else 0, (o.get('on') or {}).get('n', 0), a.get('n', 0) if a else 0,
                 1 if r.get('chief') else 0, 1 if ch.get('on') else 0, 1 if r.get('bordure') else 0, 1 if r.get('label') else 0, 1 if r.get('canton') else 0,
                 [x for x in ts if x not in ('mixed', 'proper')], v, 1 if r.get('quartered', 0) >= 2 else 0)


def gen_vec(a):
    if a.get('quarters'):
        q = a['quarters'][0]; base = gen_vec(q); base[FEATS.index('quartered')] = 1; return base
    f = a['field']; o = a.get('ordinary') or {}; gs = a.get('charges') or []
    main = next((g for g in gs if not g.get('on') and not g.get('around')), None); on = next((g for g in gs if g.get('on') == 'ordinary'), None); ar = next((g for g in gs if g.get('around')), None)
    ch = a.get('chief') or {}
    first = o.get('t') if o and o.get('t') != 'counterchanged' else (main.get('t') if main else None)
    ft = f['t']
    v = viol(ft[0], first) if len(ft) == 1 and first and first != 'counterchanged' else 0
    ts = list(ft) + [x for x in [o.get('t'), main.get('t') if main else None, ar.get('t') if ar else None, ch.get('t'), on.get('t') if on else None, (a.get('bordure') or {}).get('t')] if x and x != 'counterchanged']
    return feats(f['kind'], bool(a.get('semy')), f.get('line') or o.get('line'), o.get('kind'), bw.cls_of(main['charge']) if main else None, main['n'] if main else 0, on['n'] if on else 0, ar['n'] if ar else 0,
                 1 if a.get('chief') else 0, 1 if ch.get('charges') else 0, 1 if a.get('bordure') else 0, 1 if a.get('label') else 0, 1 if a.get('canton') else 0, ts, v, 0)


def complexity(v):
    # elements of a coat from its feature vector, as complexity() in grammar.js counts a skeleton
    g = dict(zip(FEATS, v))
    c = (1 - g['f_plain']) + g['line'] + (1 - g['o_none']) + (1 - g['m_none']) + (1 if g['m_n'] > math.log1p(1) + 1e-9 else 0)
    c += (1 if g['on_n'] > 0 else 0) + (1 if g['ar_n'] > 0 else 0) + g['chief'] + g['chief_ch'] + g['bordure'] + g['label'] + g['canton'] + 2 * g['quartered']
    return int(round(c))


def energy(X, Y):
    def md(A, B): return float(np.mean(np.sqrt(((A[:, None, :] - B[None, :, :]) ** 2).sum(-1))))
    return 2 * md(X, Y) - md(X, X) - md(Y, Y)


def max_ks(X, Y):
    best = 0.0
    for j in range(X.shape[1]):
        a = np.sort(X[:, j]); b = np.sort(Y[:, j]); grid = np.unique(np.concatenate([a, b]))
        ca = np.searchsorted(a, grid, side='right') / len(a); cb = np.searchsorted(b, grid, side='right') / len(b)
        best = max(best, float(np.max(np.abs(ca - cb))))
    return best


def per_feature_gap(X, Y):
    return {FEATS[j]: round(float(abs(X[:, j].mean() - Y[:, j].mean())), 3) for j in range(X.shape[1])}


def main():
    rng = random.Random(20261026)
    S = json.loads((D / 'data' / 'corpus_structures.json').read_text(encoding='utf-8'))
    G = json.loads(SAMPLES.read_text(encoding='utf-8'))
    ho = json.loads((D / 'data' / 'holdout_items.json').read_text(encoding='utf-8'))
    report = {}
    S['late'] = [r for x in ('grunenberg', 'rugen', 'sanktgallen') for r in S[x]]
    for roll in ('zurich', 'grunenberg', 'rugen', 'sanktgallen', 'late'):
        rows = S[roll]; R = {}
        st = collections.Counter(r['status'] for r in rows)
        R['test1_fit'] = dict(n=len(rows), ok=st['ok'], bucket=st['bucket'], out=st['out'], structure_covered=round((st['ok'] + st['bucket']) / len(rows), 4),
                              library_covered=round(st['ok'] / len(rows), 4), gate=0.95, passed=(st['ok'] + st['bucket']) / len(rows) >= 0.95)
        # test 2: held-out items through the frozen parser; counts only
        items = {it['num']: it for it in json.loads((D / 'data' / f'{roll}_items.json').read_text(encoding='utf-8'))} if roll in ho else {}
        hs = collections.Counter(); hn = 0
        for num in ho.get(roll, []):
            it = items.get(num)
            if not it or not it['coats'] or not it['coats'][0].get('blazon'): hs['no blazon in edition'] += 1; continue
            hn += 1; hs[ps.parse_coat(it['coats'][0]['blazon'], it['coats'][0].get('codes'))['status']] += 1
        R['test2_holdout'] = dict(items=len(ho.get(roll, [])), with_blazon=hn, ok=hs['ok'], bucket=hs['bucket'], out=hs['out'], no_blazon=hs['no blazon in edition'],
                                  structure_covered=round((hs['ok'] + hs['bucket']) / hn, 4) if hn else None, gate=0.95, passed=hn > 0 and (hs['ok'] + hs['bucket']) / hn >= 0.95)
        if roll not in ho: R.pop('test2_holdout', None)
        if roll not in G:
            report[roll] = R
            print(f'== {roll}')
            for k, v in R.items(): print(f'  {k}: {json.dumps(v, ensure_ascii=False)}')
            continue
        # test 4: distribution
        C = np.array([corpus_vec(r) for r in rows], float)
        Gv = np.array([gen_vec(x['arms']) for x in G[roll]], float)
        mu = C.mean(0); sd = C.std(0); sd[sd == 0] = 1
        Cz = (C - mu) / sd; Gz = (Gv - mu) / sd
        n = min(500, len(C) // 2, len(Gz))
        eds, kss = [], []
        for _ in range(200):
            idx = list(range(len(Cz))); rng.shuffle(idx)
            A, B = Cz[idx[:n]], Cz[idx[n:2 * n]]
            eds.append(energy(A, B)); kss.append(max_ks(A, B))
        thr_ed = float(np.percentile(eds, 95)); thr_ks = float(np.percentile(kss, 95))
        ged, gks = [], []
        for _ in range(20):
            idx = rng.sample(range(len(Cz)), n); gi = rng.sample(range(len(Gz)), n)
            ged.append(energy(Gz[gi], Cz[idx])); gks.append(max_ks(Gz[gi], Cz[idx]))
        gaps = per_feature_gap(Gv, C)
        R['test4_distribution'] = dict(n=n, energy=round(float(np.median(ged)), 4), energy_threshold=round(thr_ed, 4), max_ks=round(float(np.median(gks)), 4), ks_threshold=round(thr_ks, 4),
                                       passed=bool(np.median(ged) <= thr_ed and np.median(gks) <= thr_ks), largest_mean_gaps=dict(sorted(gaps.items(), key=lambda kv: -kv[1])[:8]))
        # secondary, not pre-registered: the same test against the coats whose charges are all in the library
        Co = np.array([corpus_vec(r) for r in rows if r['status'] == 'ok'], float); Coz = (Co - mu) / sd
        n2 = min(500, len(Coz) // 2, len(Gz)); e2, k2, ce, ck = [], [], [], []
        for _ in range(200):
            idx = list(range(len(Coz))); rng.shuffle(idx)
            ce.append(energy(Coz[idx[:n2]], Coz[idx[n2:2 * n2]])); ck.append(max_ks(Coz[idx[:n2]], Coz[idx[n2:2 * n2]]))
        for _ in range(20):
            idx = rng.sample(range(len(Coz)), n2); gi = rng.sample(range(len(Gz)), n2)
            e2.append(energy(Gz[gi], Coz[idx])); k2.append(max_ks(Gz[gi], Coz[idx]))
        R['test4_secondary_library_coats_only'] = dict(n=n2, energy=round(float(np.median(e2)), 4), energy_threshold=round(float(np.percentile(ce, 95)), 4), max_ks=round(float(np.median(k2)), 4),
                                                       ks_threshold=round(float(np.percentile(ck, 95)), 4), passed=bool(np.median(e2) <= np.percentile(ce, 95) and np.median(k2) <= np.percentile(ck, 95)),
                                                       largest_mean_gaps=dict(sorted(per_feature_gap(Gv, Co).items(), key=lambda kv: -kv[1])[:6]))
        # the generator's band: against the corpus coats of three elements or more
        cc = np.array([complexity(v) for v in C]); gc = np.array([complexity(v) for v in Gv])
        hist = lambda a: {int(k): round(float(np.mean(a == k)), 3) for k in sorted(set(a.tolist()))}
        # quartered coats left out on both sides: in the corpus they make up half the band (a quartering counts two)
        qi = FEATS.index('quartered'); band = (cc >= 3) & (C[:, qi] == 0); Gb = Gz[Gv[:, qi] == 0]
        Cb = Cz[band]; n3 = min(500, len(Cb) // 2, len(Gb)); e3, k3, be, bk = [], [], [], []
        if n3 >= 20:
            for _ in range(200):
                idx = list(range(len(Cb))); rng.shuffle(idx)
                be.append(energy(Cb[idx[:n3]], Cb[idx[n3:2 * n3]])); bk.append(max_ks(Cb[idx[:n3]], Cb[idx[n3:2 * n3]]))
            for _ in range(20):
                idx = rng.sample(range(len(Cb)), n3); gi = rng.sample(range(len(Gb)), n3)
                e3.append(energy(Gb[gi], Cb[idx])); k3.append(max_ks(Gb[gi], Cb[idx]))
        R['test4_band_three_or_more_unquartered'] = dict(corpus_coats=int(len(Cb)), n=n3, energy=round(float(np.median(e3)), 4) if e3 else None, energy_threshold=round(float(np.percentile(be, 95)), 4) if be else None,
                                             max_ks=round(float(np.median(k3)), 4) if k3 else None, ks_threshold=round(float(np.percentile(bk, 95)), 4) if bk else None,
                                             passed=bool(e3 and np.median(e3) <= np.percentile(be, 95) and np.median(k3) <= np.percentile(bk, 95)),
                                             largest_mean_gaps=dict(sorted(per_feature_gap(Gv[Gv[:, qi] == 0], C[band]).items(), key=lambda kv: -kv[1])[:6]) if len(Cb) else {},
                                             complexity_corpus=hist(cc), complexity_generated=hist(gc))
        # test 5: diversity, repetition, matches
        def mean_pair(Z):
            Z = Z[:n]; return float(np.mean(np.sqrt(((Z[:, None, :] - Z[None, :, :]) ** 2).sum(-1))))
        div_c = float(np.mean([mean_pair(Cz[rng.sample(range(len(Cz)), n)]) for _ in range(5)])); div_g = mean_pair(Gz)
        keys = collections.Counter(x['key'] for x in G[roll]); ckeys = collections.Counter(bw.canon(r) for r in rows if r['status'] == 'ok' and r.get('tinctures_aligned'))
        nck = sum(ckeys.values())
        matched = sum(1 for x in G[roll] if x['also']); raw = sum(1 for x in G[roll] if x['rawAlso'])
        R['test5_diversity'] = dict(generated=round(div_g, 3), corpus=round(div_c, 3), ratio=round(div_g / div_c, 3), passed=div_g >= 0.8 * div_c)
        R['test5_repetition'] = dict(generated_top_share=round(keys.most_common(1)[0][1] / len(G[roll]), 4), generated_top=keys.most_common(1)[0][0],
                                     corpus_top_share=round(ckeys.most_common(1)[0][1] / nck, 4), corpus_top=ckeys.most_common(1)[0][0], passed=keys.most_common(1)[0][1] / len(G[roll]) <= ckeys.most_common(1)[0][1] / nck)
        R['test5_matches'] = dict(no_match_share=round(1 - matched / len(G[roll]), 4), no_match_without_redraw=round(1 - raw / len(G[roll]), 4), target=0.7,
                                  passed=1 - matched / len(G[roll]) >= 0.7, note='index = the parsed coats of Zürich, Grünenberg (development), Rugen and St. Gallen-Haggenberg; the Clemmensen Ordinary, Papworth and Rietstap were not indexed')
        report[roll] = R
        print(f'== {roll}')
        for k, v in R.items(): print(f'  {k}: {json.dumps(v, ensure_ascii=False)}')
    (D / 'data' / 'acceptance.json').write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()
