"""Plates of sixteen with the determinant chosen by a seeded bijection, so consecutive seeds never share one.
usage: python plates.py <legends.json> <geonames_dir> <current_names.json>"""
import json, sys, random, collections, re
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
args = sys.argv; sys.argv = args[:1] + [args[1], args[2], '/dev/null']
import namemodels as nm_
from final import Model, legend, assim_rate
from segment import split
sys.argv = args
L = json.load(open(args[1], encoding='utf-8')); CUR = json.load(open(args[3], encoding='utf-8'))
geo = nm_.load_geo(); judge = nm_.Judge(nm_.GEO_NAMES); key = nm_.key


def name_for(m, dets, seed, banned, roll):
    # determinant: a bijection of the seed (stride coprime to the list length), so a plate's sixteen differ
    n = len(dets); a = 7919 % n or 1
    while __import__('math').gcd(a, n) != 1: a += 1
    rng = random.Random(seed * 31 + 7)
    for t in range(40):
        d = dets[(a * (seed + t * 104729)) % n]
        gd = m.gen_dist(d); gs, gw = zip(*gd.items())
        g = rng.choices(gs, gw)[0]
        if (d, g) in m.pairs: continue
        ss, sw = zip(*m.spell[g].items()); s = rng.choices(ss, sw)[0]
        nm = m.join(d, s, rng); i = len(d)
        if not (nm[i - 2:i + 1] in m.tri and nm[i - 1:i + 2] in m.tri) or key(nm) in banned: continue
        return legend(rng, nm, roll), nm, d
    return None


for roll, srcs in (('zurich', ['bare', 'toponyms']), ('grunenberg', ['toponyms', 'bare'])):
    T = sorted(set(n for k in srcs for n in L[roll][k] if len(n) >= 4 and re.fullmatch(r'[a-zäöüßÿ]+', n)))
    banned = set(key(n) for r in L for k in ('bare', 'toponyms') for n in L[r][k]) | geo
    m = Model(T, 'flat'); rnd = random.Random(5); dets = sorted(m.dets); rnd.shuffle(dets)
    rep = 0; allnames = []
    for p in range(200):
        pl = [name_for(m, dets, p * 16 + i, banned, roll) for i in range(16)]
        rep += 16 - len(set(x[2] for x in pl)); allnames += [x[1] for x in pl]
    sc = sorted(judge.score(n) for n in allnames)
    cur = CUR[roll]; csc = sorted(judge.score(n) for n in cur)
    print(f'== {roll}: repeated determinants per plate {rep / 200:.2f}; distinct names {len(set(allnames))} of {len(allnames)}; '
          f'judge median {sc[len(sc) // 2]:.2f} (current page {csc[len(csc) // 2]:.2f}); current names that are GeoNames places {sum(key(n) in geo for n in cur) / len(cur):.0%}')
    for p in (2026, 777):
        print(f'  plate {p} current :', ' | '.join(x.capitalize() for x in cur[(p - 2026 if p == 2026 else 16):(p - 2026 if p == 2026 else 16) + 16]))
        print(f'  plate {p} proposed:', ' | '.join(name_for(m, dets, p * 16 + i, banned, roll)[0] for i in range(16)))
