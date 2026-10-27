"""Name models for the arms generator, and three checks of how real their names look.
usage: python namemodels.py <legends.json> <geonames_dir> <out.json>

Models (each trained on half of a roll's toponyms, A; the other half, B, is the reference):
  M0  the page's current model: order-2 letters, 5 to 12 letters, at least two edits from every real name
  M0b the same at order 3
  M1  recombination: a determinant from one real name with a generic element (berg, stain, ingen...)
      drawn given the determinant's last two letters, in the roll's spelling of it; the join must be a
      letter trigram seen in the roll; the result must not be a real name of either roll
Checks:
  disc   a character n-gram classifier (multinomial naive Bayes, n = 1..4, 5-fold CV) told to separate B
         from the model's names: 0.5 means it cannot, 1.0 means every name is told apart
  geo    share of names (spelling normalised) that are places in GeoNames DE, AT, CH: real toponyms
         reach some rate; a model whose names are built like real ones should come near it
  shape  share ending in a known generic element; length; distinct names
"""
import json, sys, random, math, collections, re
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from segment import split, GENERICS

# arguments are read only when given (build_names.py imports this module for key() and load_geo())
L = json.load(open(sys.argv[1], encoding='utf-8')) if len(sys.argv) > 1 and sys.argv[1].endswith('.json') else None
GEO = Path(sys.argv[2]) if len(sys.argv) > 2 else None; OUT = Path(sys.argv[3]) if len(sys.argv) > 3 else None


def key(s):
    s = s.lower().strip()
    for a, b in (('ß', 'ss'), ('ÿ', 'i'), ('y', 'i'), ('ä', 'a'), ('ö', 'o'), ('ü', 'u'), ('ae', 'a'), ('oe', 'o'), ('ue', 'u'), ('uo', 'u'),
                 ('ai', 'ei'), ('ey', 'ei'), ('ch', '#'), ('ck', 'k'), ('gk', 'k'), ('c', 'k'), ('#', 'ch'), ('ph', 'f'), ('v', 'f'),
                 ('th', 't'), ('dt', 't'), ('cz', 'z'), ('tz', 'z')):
        s = s.replace(a, b)
    s = re.sub(r'(.)\1+', r'\1', s)
    s = re.sub(r'^p(?=[aeiour])', 'b', s)
    for a, b in ((r'perg$', 'berg'), (r'purg$', 'burg'), (r'pach$', 'bach'), (r'hein$', 'heim'), (r'husen$', 'hausen'), (r'torf$', 'dorf'),
                 (r'ek$', 'eg'), (r'(ow|aw)$', 'au'), (r'felt$', 'feld'), (r'stat$', 'stadt')):
        s = re.sub(a, b, s)
    return s


def load_geo(geo_dir=None):
    geo_dir = Path(geo_dir) if geo_dir else GEO
    keys = set()
    global GEO_NAMES
    GEO_NAMES = []
    for f in ('DE.txt', 'AT.txt', 'CH.txt'):
        with open(geo_dir / f, encoding='utf-8') as fh:
            for line in fh:
                c = line.split('\t')
                for nm in (c[1], c[2]):
                    nm = re.sub(r'^(burg|burgruine|ruine|schloss|schloß|festung|burgstall|gut|hof|weiler|ortsteil|bad|sankt|st\.?) ', '', nm.lower())
                    if re.fullmatch(r"[a-zäöüß]+", nm) and len(nm) >= 4:
                        k = key(nm)
                        if k not in keys: GEO_NAMES.append(k)
                        keys.add(k)
    return keys


def geo_words(geo_dir):
    """every word of four letters or more in every GeoNames name, ASCII name and alternate name
    (Marburg an der Lahn gives marburg and lahn): the set build_names.py keeps names out of"""
    keys = set()
    for f in ('DE.txt', 'AT.txt', 'CH.txt'):
        with open(Path(geo_dir) / f, encoding='utf-8') as fh:
            for line in fh:
                c = line.split('\t')
                for field in (c[1], c[2], c[3]):
                    for w in re.findall(r"[a-zäöüßÿ]{4,}", field.lower()):
                        keys.add(key(w))
    return keys


def edit(a, b):
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        p, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] != b[j - 1]))
    return d[len(b)]


class Letters:
    def __init__(self, names, order):
        self.o = order; self.m = collections.defaultdict(collections.Counter)
        for n in names:
            w = '^' * order + n + '$'
            for i in range(order, len(w)): self.m[w[i - order:i]][w[i]] += 1

    def sample(self, rng, real):
        for _ in range(500):
            w = '^' * self.o
            while len(w) < 16 + self.o:
                c = self.m.get(w[-self.o:])
                if not c: break
                ks, vs = zip(*c.items()); nx = rng.choices(ks, vs)[0]
                if nx == '$': break
                w += nx
            nm = w[self.o:]
            if not 5 <= len(nm) <= 12: continue
            if any(edit(r, nm) < 2 or (len(r) >= 5 and r in nm) for r in real): continue
            return nm
        return None


class Recombine:
    def __init__(self, names):
        self.seg = {n: split(n) for n in names}; self.seg = {n: s for n, s in self.seg.items() if s and not s[3]}
        self.dets = collections.Counter(s[0] for s in self.seg.values())
        self.by2 = collections.defaultdict(collections.Counter); self.by1 = collections.defaultdict(collections.Counter); self.g = collections.Counter()
        self.spell = collections.defaultdict(collections.Counter)
        for d, g, s, _ in self.seg.values():
            self.by2[d[-2:]][g] += 1; self.by1[d[-1:]][g] += 1; self.g[g] += 1; self.spell[g][s] += 1
        self.pairs = set((s[0], s[1]) for s in self.seg.values())
        self.tri = set()
        for n in names:
            w = '^' + n + '$'
            for i in range(len(w) - 2): self.tri.add(w[i:i + 3])

    def gen_dist(self, d):
        # P(generic | last two letters), backing off to the last letter and to all names (weights 1, 0.3, 0.05)
        out = collections.Counter()
        for tab, w in ((self.by2.get(d[-2:], {}), 1.0), (self.by1.get(d[-1:], {}), 0.3), (self.g, 0.05)):
            tot = sum(tab.values()) or 1
            for g, v in tab.items(): out[g] += w * v / tot
        return out

    def sample(self, rng, real_keys):
        ds, dw = zip(*self.dets.items())
        for _ in range(500):
            d = rng.choices(ds, dw)[0]
            gd = self.gen_dist(d); gs, gw = zip(*gd.items()); g = rng.choices(gs, gw)[0]
            if (d, g) in self.pairs: continue
            ss, sw = zip(*self.spell[g].items()); s = rng.choices(ss, sw)[0]
            nm = d + s
            if not (d[-2:] + s[0] in self.tri and d[-1] + s[:2] in self.tri): continue
            if key(nm) in real_keys: continue
            return nm
        return None


class Judge:
    """order-4 letter model over GeoNames keys (add-0.1); score = mean log2 probability per letter of a name's key"""
    def __init__(self, names, o=4):
        self.o = o; self.m = collections.defaultdict(collections.Counter)
        for n in names:
            w = '^' * o + n + '$'
            for i in range(o, len(w)): self.m[w[i - o:i]][w[i]] += 1
        self.V = len(set(ch for c in self.m.values() for ch in c)); self.tot = {k: sum(c.values()) for k, c in self.m.items()}

    def score(self, n):
        w = '^' * self.o + key(n) + '$'; s = 0.0
        for i in range(self.o, len(w)):
            c = self.m.get(w[i - self.o:i], {}); s += math.log2((c.get(w[i], 0) + 0.1) / (self.tot.get(w[i - self.o:i], 0) + 0.1 * self.V))
        return s / (len(w) - self.o)


def ngrams(n):
    w = '^' + n + '$'; return [w[i:i + k] for k in range(1, 5) for i in range(len(w) - k + 1)]


def nb_cv(pos, neg, rng, folds=5):
    X = [(ngrams(n), 1) for n in pos] + [(ngrams(n), 0) for n in neg]; rng.shuffle(X)
    acc = []
    for f in range(folds):
        test = X[f::folds]; train = [x for i, x in enumerate(X) if i % folds != f]
        cnt = [collections.Counter(), collections.Counter()]; ny = [0, 0]
        for g, y in train: cnt[y].update(g); ny[y] += 1
        V = len(set(cnt[0]) | set(cnt[1])); tot = [sum(c.values()) for c in cnt]
        ok = 0
        for g, y in test:
            sc = [math.log(ny[c] / len(train)) + sum(math.log((cnt[c][t] + 0.5) / (tot[c] + 0.5 * V)) for t in g) for c in (0, 1)]
            ok += (sc[1] > sc[0]) == (y == 1)
        acc.append(ok / len(test))
    return sum(acc) / len(acc)


if __name__ == '__main__':
    geo = load_geo(); print('GeoNames keys', len(geo))
    judge = Judge(GEO_NAMES)
    report = {}
    for roll, srcs in (('zurich', ['bare', 'toponyms']), ('grunenberg', ['toponyms', 'bare'])):
        T = sorted(set(n for k in srcs for n in L[roll][k] if len(n) >= 4 and re.fullmatch(r'[a-zäöüßÿ]+', n)))
        allreal = sorted(set(n for r in L for k in ('bare', 'toponyms') for n in L[r][k]))
        real_keys = set(key(n) for n in allreal)
        res = collections.defaultdict(list); examples = {}
        for rep in range(5):
            rng = random.Random(100 + rep); S2 = T[:]; rng.shuffle(S2); A, B = S2[:len(S2) // 2], S2[len(S2) // 2:]
            models = {'M0': Letters(A, 2), 'M0b': Letters(A, 3), 'M1': Recombine(A)}
            models['M1x'] = models['M1']
            sets = {'real B': B}
            for name, m in models.items():
                out = []; seen = set()
                for _ in range(len(B) * 4):
                    nm = m.sample(rng, allreal if name not in ('M1', 'M1x') else (real_keys | geo if name == 'M1x' else real_keys))
                    if nm and nm not in seen: seen.add(nm); out.append(nm)
                    if len(out) >= len(B): break
                sets[name] = out
            for name, ns in sets.items():
                res[name + ' geo'].append(sum(key(n) in geo for n in ns) / max(1, len(ns)))
                res[name + ' generic'].append(sum(1 for n in ns if split(n)) / max(1, len(ns)))
                res[name + ' len'].append(sum(map(len, ns)) / max(1, len(ns)))
                res[name + ' n'].append(len(ns))
                sc = sorted(judge.score(n) for n in ns); res[name + ' judge'].append(sc[len(sc) // 2])
                res[name + ' judge_p10'].append(sc[len(sc) // 10])
                if name != 'real B':
                    Bc = [n for n in B if split(n)]; nc = [n for n in ns if split(n)]; k2 = min(len(Bc), len(nc))
                    if k2 >= 30: res[name + ' disc_compound'].append(nb_cv(rng.sample(Bc, k2), rng.sample(nc, k2), rng))
                if name != 'real B':
                    k = min(len(B), len(ns)); res[name + ' disc'].append(nb_cv(rng.sample(B, k), rng.sample(ns, k), rng))
                if rep == 0: examples[name] = ns[:40]
        summ = {k: round(sum(v) / len(v), 3) for k, v in sorted(res.items())}
        report[roll] = dict(n_real=len(T), summary=summ, examples=examples)
        print(f'== {roll}: {len(T)} toponyms')
        rngc = random.Random(7); scr = [''.join(rngc.sample(n, len(n))) for n in T]; ssc = sorted(judge.score(n) for n in scr)
        print(f'== {roll}: {len(T)} toponyms; judge median for letters of real names scrambled: {ssc[len(ssc) // 2]:.2f}')
        for m in ('real B', 'M0', 'M0b', 'M1', 'M1x'):
            print(f"  {m:7s} geo {summ[m + ' geo']:.3f}  judge median {summ[m + ' judge']:.2f} p10 {summ[m + ' judge_p10']:.2f}  generic {summ[m + ' generic']:.3f}  len {summ[m + ' len']:.1f}  n {summ[m + ' n']:.0f}" + (f"  disc {summ[m + ' disc']:.3f} disc_compound {summ.get(m + ' disc_compound', float('nan')):.3f}" if m != 'real B' else ''))
        for m in ('real B', 'M0', 'M0b', 'M1', 'M1x'): print(f'  {m}:', ' '.join(examples[m][:24]))
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')
