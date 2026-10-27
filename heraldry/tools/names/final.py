"""The proposed name model, trained on all of a roll's toponyms, with plate-level checks and legend forms.
usage: python final.py <legends.json> <geonames_dir> <out.json>"""
import json, sys, random, math, collections, re
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
sys.argv, _args = sys.argv[:1] + [sys.argv[1], sys.argv[2], '/dev/null'], sys.argv
import namemodels as nm_
from segment import split
sys.argv = _args
L = json.load(open(sys.argv[1], encoding='utf-8'))
key = nm_.key

LAB = re.compile(r'[bp]')


def assim_rate(names):
    # how often the roll writes -en- as -em- before b or p (Grünenberg "Wassemberg" for Wassenberg)
    n = m = 0
    for x in names:
        s = split(x)
        if s and s[2][0] in 'bp' and len(s[0]) > 2 and s[0][-2] == 'e':
            if s[0][-1] == 'n': n += 1
            elif s[0][-1] == 'm': m += 1
    return m / max(1, n + m), n + m


class Model:
    def __init__(self, names, det_weight='sqrt'):
        self.rate, _ = assim_rate(names)
        seg = [s for s in map(split, names) if s and not s[3]]
        # de-assimilate: a determinant written -em before b/p is stored as -en
        norm = lambda d, s: d[:-1] + 'n' if d.endswith('em') and s[0] in 'bp' else d
        self.seg = [(norm(d, s), g, s) for d, g, s, _ in seg]
        dc = collections.Counter(d for d, _, _ in self.seg)
        self.dets = {d: (math.sqrt(c) if det_weight == 'sqrt' else 1.0 if det_weight == 'flat' else c) for d, c in dc.items()}
        self.by2 = collections.defaultdict(collections.Counter); self.by1 = collections.defaultdict(collections.Counter); self.g = collections.Counter()
        self.spell = collections.defaultdict(collections.Counter)
        for d, g, s in self.seg: self.by2[d[-2:]][g] += 1; self.by1[d[-1:]][g] += 1; self.g[g] += 1; self.spell[g][s] += 1
        self.pairs = set((d, g) for d, g, _ in self.seg)
        self.tri = set()
        for n in names:
            w = '^' + n + '$'
            for i in range(len(w) - 2): self.tri.add(w[i:i + 3])

    def gen_dist(self, d):
        out = collections.Counter()
        for tab, w in ((self.by2.get(d[-2:], {}), 1.0), (self.by1.get(d[-1:], {}), 0.3), (self.g, 0.05)):
            tot = sum(tab.values()) or 1
            for g, v in tab.items(): out[g] += w * v / tot
        return out

    def join(self, d, s, rng):
        if d.endswith('en') and s[0] in 'bp' and rng.random() < self.rate: d = d[:-1] + 'm'
        return d + s

    def sample(self, rng, banned):
        ds, dw = zip(*self.dets.items())
        for _ in range(500):
            d = rng.choices(ds, dw)[0]
            gd = self.gen_dist(d); gs, gw = zip(*gd.items()); g = rng.choices(gs, gw)[0]
            if (d, g) in self.pairs: continue
            ss, sw = zip(*self.spell[g].items()); s = rng.choices(ss, sw)[0]
            nm = self.join(d, s, rng)
            if not (nm[len(d) - 2:len(d) + 1] in self.tri and nm[len(d) - 1:len(d) + 2] in self.tri): continue
            if key(nm) in banned: continue
            return nm, d, g
        return None


# legend forms of Grünenberg, from the development legends (kings and towns left out: kingdoms and cities are not families)
TITLES = [('', 634), ('Grauff von', 264), ('Her von', 166), ('Frÿ von', 96), ('Herczog von', 55), ('Truchsaes von', 12), ('Schenk von', 9), ('Margrauff von', 9), ('Marschalk von', 5)]


def legend(rng, top, roll):
    if roll == 'zurich': return top.capitalize()
    t = rng.choices([t for t, _ in TITLES], [w for _, w in TITLES])[0]
    return f'{t} {top.capitalize()}' if t else f'von {top.capitalize()}'


if __name__ == '__main__':
    geo = nm_.load_geo(); judge = nm_.Judge(nm_.GEO_NAMES)
    out = {}
    for roll, srcs in (('zurich', ['bare', 'toponyms']), ('grunenberg', ['toponyms', 'bare'])):
        T = sorted(set(n for k in srcs for n in L[roll][k] if len(n) >= 4 and re.fullmatch(r'[a-zäöüßÿ]+', n)))
        allreal = set(key(n) for r in L for k in ('bare', 'toponyms') for n in L[r][k])
        rate, nn = assim_rate(T)
        print(f'== {roll}: -en- written -em- before b/p in {rate:.0%} of {nn} names')
        for dw in ('count', 'sqrt', 'flat'):
            m = Model(T, dw); rng = random.Random(1)
            # plates of sixteen: how often a determinant or a generic recurs within a plate
            rep_d = rep_g = 0; names = []
            for p in range(200):
                plate = [m.sample(rng, allreal | geo) for _ in range(16)]
                rep_d += 16 - len(set(x[1] for x in plate)); rep_g += max(collections.Counter(x[2] for x in plate).values())
                names += [x[0] for x in plate]
            sc = sorted(judge.score(n) for n in names)
            print(f'  determinant weight {dw:5s}: repeated determinants per plate {rep_d / 200:.2f}, commonest generic per plate {rep_g / 200:.1f}, '
                  f'distinct names in 3200 {len(set(names))}, judge median {sc[len(sc) // 2]:.2f}')
        # the same for real plates
        rng = random.Random(2); rd = rg = 0
        segs = [split(n) for n in T]; segs = [s for s in segs if s]
        for p in range(200):
            pl = rng.sample(segs, 16); rd += 16 - len(set(s[0] for s in pl)); rg += max(collections.Counter(s[1] for s in pl).values())
        print(f'  real compound names: repeated determinants per plate {rd / 200:.2f}, commonest generic per plate {rg / 200:.1f}')
        m = Model(T, 'sqrt'); rng = random.Random(2026)
        dets = list(m.dets); space = sum(1 for d in dets for g in m.gen_dist(d) if (d, g) not in m.pairs)
        print(f'  {len(dets)} determinants, {len(m.g)} generics; about {space} determinant-generic pairs not in the roll')
        samples = []
        for i in range(48):
            nm, d, g = m.sample(rng, allreal | geo); samples.append(legend(rng, nm, roll))
        print('  legends:', ' | '.join(samples))
        out[roll] = dict(samples=samples)
    json.dump(out, open(sys.argv[3], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
