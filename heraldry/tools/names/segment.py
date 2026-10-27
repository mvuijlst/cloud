"""Split the rolls' toponyms into determinant + generic element (Bestimmungswort + Grundwort).
usage: python segment.py <legends.json> <out.json>"""
import json, sys, collections

# generic elements, period spellings first-listed by nothing in particular; matched longest first
GENERICS = {
    'berg': ['berg', 'perg', 'berck', 'berch'],
    'burg': ['burg', 'purg', 'burck', 'purgk', 'burgk'],
    'stein': ['stain', 'stein', 'stayn', 'stain'],
    'fels': ['fels', 'vels', 'velz', 'felß', 'felss', 'felsz'],
    'egg': ['egg', 'egk', 'eck', 'egge', 'eg'],
    'ingen': ['ingen', 'ingin', 'igen', 'inge'],
    'bach': ['bach', 'pach'],
    'heim': ['haim', 'hain', 'heim', 'hein', 'hem'],
    'hausen': ['hussen', 'husen', 'hausen', 'hussin', 'husin'],
    'dorf': ['dorff', 'dorf', 'torff', 'torf'],
    'hofen': ['hoffen', 'hoven', 'hofen', 'hoffe', 'hofe', 'höffen', 'höfen', 'hofen'],
    'feld': ['felden', 'velden', 'feld', 'veld', 'velt', 'felt'],
    'stetten': ['stetten', 'stettin', 'stett', 'stetin'],
    'weiler': ['wiler', 'wile', 'wil', 'wyl', 'weiler'],
    'au': ['aw', 'au', 'ouw', 'ow'],
    'ach': ['ach'],
    'tal': ['tal', 'thal', 'tall'],
    'kirch': ['kirchen', 'kilchen', 'kirch', 'kilch'],
    'brunn': ['brunnen', 'brunn', 'brun'],
    'wald': ['walden', 'wald', 'walt'],
    'ried': ['riet', 'ried', 'rieden'],
    'rode': ['rode', 'rod', 'rade', 'rad'],
    'hart': ['hart', 'hardt', 'hard'],
    'horn': ['horn'],
    'see': ['see'],
    'mund': ['mund'],
    'land': ['land'],
    'stat': ['statt', 'stat'],
    'werd': ['werd', 'wert', 'wörd'],
    'hus': ['hus', 'haus'],
    'stall': ['stal', 'stall'],
    'wilen': ['wilen', 'wylen'],
    'borg': ['borg'],
    'forst': ['forst', 'vorst'],
    'garten': ['garten', 'gartten'],
    'beck': ['beck', 'bek', 'ek'],
    'loh': ['loh', 'lo'],
    'buch': ['buoch', 'buch', 'puch'],
    'bühl': ['bühel', 'büel', 'buel', 'bühl', 'buhel', 'bül'],
    'moos': ['moos', 'mos'],
    'wang': ['wangen', 'wang'],
    'schwand': ['schwanden', 'schwand'],
    'matt': ['matten', 'matt'],
}
SPELL = sorted(((s, g) for g, ss in GENERICS.items() for s in ss), key=lambda x: -len(x[0]))


def split(name):
    """(determinant, generic id, spelling, 'er' suffix) or None"""
    er = ''
    for base in ([name[:-2], name] if name.endswith('er') else [name]):
        for s, g in SPELL:
            if base.endswith(s) and len(base) - len(s) >= 2:
                d = base[:-len(s)]
                if g in ('egg', 'au', 'ach', 'rode', 'hus', 'beck', 'loh', 'moos') and len(d) < 3: continue
                return d, g, s, ('er' if base != name else '')
    return None


if __name__ == '__main__':
    L = json.load(open(sys.argv[1], encoding='utf-8'))
    out = {}
    for roll, srcs in (('zurich', ['bare', 'toponyms']), ('grunenberg', ['toponyms', 'bare'])):
        names = sorted(set(n for k in srcs for n in L[roll][k] if len(n) >= 4))
        seg = {}; miss = []
        for n in names:
            s = split(n)
            if s: seg[n] = s
            else: miss.append(n)
        g = collections.Counter(s[1] for s in seg.values()); sp = collections.Counter(s[2] for s in seg.values())
        print(f'{roll}: {len(names)} toponyms, {len(seg)} split ({len(seg) / len(names):.0%}), {sum(1 for s in seg.values() if s[3])} with -er')
        print('  generics', ' '.join(f'{k}:{v}' for k, v in g.most_common()))
        print('  spellings', ' '.join(f'{k}:{v}' for k, v in sp.most_common(30)))
        print('  not split (sample):', ' '.join(miss[::max(1, len(miss) // 60)]))
        out[roll] = dict(seg=seg, miss=miss)
    json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
