"""Builds names-data.js: the material grammar.js makes names from (NAMES.md).

usage: python build_names.py <heraldry_dir> <geonames_dir>
  geonames_dir holds DE.txt, AT.txt and CH.txt from https://download.geonames.org/export/dump/
  (CC BY 4.0; the dump used for the page was downloaded on 27 October 2026).

Per roll it writes
  dets    determinants of the roll's compound place names (Falken-, Regens-), in a fixed shuffled order;
          a determinant the roll writes -em before b or p is stored as -en
  sp      the generic elements in the roll's own spellings (berg, stain, haim, hoven ...)
  opt     per determinant, its options [spelling index, weight, assimilated]: generic elements drawn
          given the determinant's last two letters, weighted by the roll's spellings and by the rate at
          which it writes -en- as -em- before b or p; an option is left out if the roll has that pair,
          if the letters across the join never occur in the roll, or if the name is in either roll
          or is a place in GeoNames (Germany, Austria, Switzerland)
  stride  a step coprime to the number of determinants: seed s takes determinant s * stride mod n,
          so the sixteen consecutive seeds of a plate never share one
  er      spelling indices whose generic element the roll also uses in family names in -er
  forms   legend forms with their counts in the roll: 'von', titles before 'von', or the -er family name
"""
import json, sys, re, math, random, collections
from pathlib import Path
HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
D = Path(sys.argv[1]); GEO_DIR = Path(sys.argv[2])
sys.argv = sys.argv[:1]
import namemodels as nm
from segment import split

key = nm.key
S = json.loads((D / 'data' / 'corpus_structures.json').read_text(encoding='utf-8'))

# ---- legends: toponyms after von / vom / zu, bare names, titles ----
TITLE_OF = {
    'grauff': 'grauff', 'grauf': 'grauff', 'graff': 'grauff', 'grauffe': 'grauff', 'grauffen': 'grauff', 'graf': 'grauff',
    'her': 'her', 'heren': 'her', 'hern': 'her', 'herren': 'her', 'die heren': 'her', 'herre': 'her', 'here': 'her', 'die herren': 'her',
    'frÿ': 'frÿ', 'fry': 'frÿ', 'frig': 'frÿ',
    'herczog': 'herczog', 'der herczog': 'herczog', 'hertzog': 'herczog',
    'truchsaes': 'truchsaes', 'schenk': 'schenk', 'margrauff': 'margrauff', 'marschalk': 'marschalk',
}


def legends(roll):
    topo, bare, forms = [], [], collections.Counter()
    for r in S[roll]:
        lg = (r['name'] or '').strip()
        if not lg or lg == '..': continue
        w = lg.split()
        k = next((i for i, x in enumerate(w) if x in ('von', 'vom', 'zu', 'zum', 'zur')), None)
        if k is None:
            if len(w) == 1:
                bare.append(w[0])
                s = split(w[0])
                if s and s[3]: forms['-er'] += 1
            continue
        pre = ' '.join(w[:k])
        if not pre: forms['von'] += 1
        elif pre in TITLE_OF: forms[TITLE_OF[pre]] += 1
        rest = w[k + 1:]
        if rest and rest[0] in ('der', 'den', 'dem'): rest = rest[1:]
        if rest: topo.append(re.sub(r'[^a-zäöüßÿ]', '', rest[0]))
    names = sorted(set(n for n in topo + bare if len(n) >= 4 and re.fullmatch(r'[a-zäöüßÿ]+', n)))
    return names, forms


def build(roll, names, forms, banned, rng):
    seg = [s for s in map(split, names) if s]
    er_gen = set(s[1] for s in seg if s[3])
    seg = [s for s in seg if not s[3]]
    # the roll's rate of -en- written -em- before b or p
    n_en = sum(1 for d, g, s, _ in seg if s[0] in 'bp' and d.endswith('en'))
    n_em = sum(1 for d, g, s, _ in seg if s[0] in 'bp' and d.endswith('em'))
    rate = n_em / max(1, n_en + n_em)
    norm = lambda d, s: d[:-1] + 'n' if d.endswith('em') and s[0] in 'bp' else d
    seg = [(norm(d, s), g, s) for d, g, s, _ in seg]
    by2, by1, allg, spell = collections.defaultdict(collections.Counter), collections.defaultdict(collections.Counter), collections.Counter(), collections.defaultdict(collections.Counter)
    for d, g, s in seg: by2[d[-2:]][g] += 1; by1[d[-1:]][g] += 1; allg[g] += 1; spell[g][s] += 1
    pairs = set((d, g) for d, g, _ in seg)
    tri = set()
    for n in names:
        w = '^' + n + '$'
        for i in range(len(w) - 2): tri.add(w[i:i + 3])
    sp = sorted(set(s for g in spell for s in spell[g]))
    gen_of = {s: g for g in spell for s in spell[g]}
    # a determinant ending in two consonants (Ainbr- of Ainbringen) goes before a generic element that
    # begins with a consonant only if the roll has that ending there (Falk-en-stain, but not Ainbr-stain)
    VOW = set('aeiouäöüyÿ')
    ends_c = set(d[-2:] for d, g, s in seg if s[0] not in VOW)
    cluster = lambda d, s: d[-1] not in VOW and d[-2] not in VOW and s[0] not in VOW and d[-2:] not in ends_c
    dets = sorted(set(d for d, _, _ in seg)); rng.shuffle(dets)
    out_dets, opts = [], []
    for d in dets:
        gd = collections.Counter()
        for tab, w in ((by2.get(d[-2:], {}), 1.0), (by1.get(d[-1:], {}), 0.3), (allg, 0.05)):
            tot = sum(tab.values()) or 1
            for g, v in tab.items(): gd[g] += w * v / tot
        cand = []
        for g, pg in gd.items():
            if (d, g) in pairs: continue
            tot_s = sum(spell[g].values())
            for s, cs in spell[g].items():
                for asm, pa in ((0, 1 - rate), (1, rate)) if d.endswith('en') and s[0] in 'bp' else ((0, 1.0),):
                    if pa <= 0: continue
                    stem = d[:-1] + 'm' if asm else d
                    name = stem + s; j = len(stem)
                    if name[j - 2:j + 1] not in tri or name[j - 1:j + 2] not in tri or cluster(stem, s): continue
                    if key(name) in banned: continue
                    cand.append((pg * cs / tot_s * pa, sp.index(s), asm))
        if not cand: continue
        top = max(c[0] for c in cand)
        cand = sorted((c for c in cand if c[0] >= 0.03 * top), key=lambda c: -c[0])[:16]
        out_dets.append(d); opts.append([[i, max(1, round(100 * p / top)), a] for p, i, a in cand])
    n = len(out_dets); stride = int(round(n * 0.381966))
    while math.gcd(stride, n) != 1: stride += 1
    er = [i for i, s in enumerate(sp) if gen_of[s] in er_gen]
    return dict(dets=out_dets, sp=sp, opt=opts, stride=stride, er=er, forms=[[k, v] for k, v in forms.most_common()], rate=round(rate, 3))


if __name__ == '__main__':
    geo = nm.geo_words(GEO_DIR)
    rolls = {r: legends(r) for r in ('zurich', 'grunenberg', 'rugen', 'sanktgallen')}
    banned = set(key(n) for r, (names, _) in rolls.items() for n in names) | geo
    # the generator's one roll: the German armorials of 1470 to 1499 pooled, their place names and legend forms
    # together (kings and towns are not families); every roll's names are kept out
    POOL = ('grunenberg', 'rugen', 'sanktgallen')
    names = sorted(set(n for r in POOL for n in rolls[r][0])); forms = collections.Counter()
    for r in POOL: forms.update(rolls[r][1])
    for r in POOL: print(r, 'place names', len(rolls[r][0]), 'forms', rolls[r][1].most_common(8))
    out = {}
    for roll, names, f in (('late', names, forms),):
        out[roll] = build(roll, names, f, banned, random.Random(20261027))
        o = out[roll]
        print(f"{roll}: {len(names)} place names, {len(o['dets'])} determinants, {sum(len(x) for x in o['opt'])} options, "
              f"{len(o['sp'])} spellings, -em- rate {o['rate']}, stride {o['stride']}, forms {o['forms'][:12]}")
    js = ('// generated by tools/names/build_names.py from the development legends and GeoNames (CC BY 4.0); see NAMES.md\n'
          '(function (root) { const H = root.Heraldry = root.Heraldry || {}; H.NAMES = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) +
          '; })(typeof self !== \'undefined\' ? self : globalThis);\n')
    (D / 'names-data.js').write_text(js, encoding='utf-8', newline='\n')
    print('wrote names-data.js,', len(js.encode('utf-8')), 'bytes')
