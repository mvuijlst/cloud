"""Is the classifier's cue against recombined names the repetition of determinants? Compare compounds only:
real B vs recombined names drawing each determinant at most once, and vs the plain recombination.
usage: python repcue.py <legends.json> <geonames_dir>"""
import json, sys, random, collections, re
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
args = sys.argv; sys.argv = args[:1] + [args[1], args[2], '/dev/null']
import namemodels as nm_
from segment import split
sys.argv = args
L = json.load(open(args[1], encoding='utf-8'))
for roll, srcs in (('zurich', ['bare', 'toponyms']), ('grunenberg', ['toponyms', 'bare'])):
    T = sorted(set(n for k in srcs for n in L[roll][k] if len(n) >= 4 and re.fullmatch(r'[a-zäöüßÿ]+', n)))
    real_keys = set(nm_.key(n) for r in L for k in ('bare', 'toponyms') for n in L[r][k])
    res = collections.defaultdict(list)
    for rep in range(5):
        rng = random.Random(300 + rep); S2 = T[:]; rng.shuffle(S2); A, B = S2[:len(S2) // 2], S2[len(S2) // 2:]
        Bc = [n for n in B if split(n)]
        m = nm_.Recombine(A)
        plain, once, used = [], [], set()
        for _ in range(20000):
            x = m.sample(rng, real_keys)
            if not x: continue
            if len(plain) < len(Bc) and x not in plain: plain.append(x)
            d = split(x)[0] if split(x) else None
            if d and d not in used and len(once) < len(Bc): used.add(d); once.append(x)
            if len(plain) >= len(Bc) and len(once) >= len(Bc): break
        for nm, ns in (('repeating determinants', plain), ('each determinant once', once)):
            k = min(len(Bc), len(ns)); res[nm].append((nm_.nb_cv(rng.sample(Bc, k), rng.sample(ns, k), rng), k))
        res['len real compounds'].append((sum(map(len, Bc)) / len(Bc), 0)); res['len recombined'].append((sum(map(len, plain)) / len(plain), 0))
    print(roll, {k: (round(sum(a for a, _ in v) / len(v), 3), min(b for _, b in v)) for k, v in res.items()})
