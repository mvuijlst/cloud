"""Legends of the development coats: titles, connectives, toponyms, endings.
usage: python legends.py <heraldry_dir> <out.json>"""
import json, re, sys, collections
from pathlib import Path

D = Path(sys.argv[1]); OUT = Path(sys.argv[2])
S = json.loads((D / 'data' / 'corpus_structures.json').read_text(encoding='utf-8'))

CONN = {'von', 'vom', 'zu', 'zum', 'zur', 'de', 'van', 'us', 'uss', 'an', 'der', 'den', 'dem', 'im', 'in', 'ze', 'und'}
res = {}
for roll in ('zurich', 'grunenberg'):
    legs = [r['name'].strip() for r in S[roll] if r['name'] and r['name'] != '..']
    pre = collections.Counter(); topo = []; bare = []; region = collections.Counter(); forms = collections.Counter()
    for lg in legs:
        w = lg.split()
        # the words before the first 'von' / 'vom' / 'zu': title or given name
        k = next((i for i, x in enumerate(w) if x in ('von', 'vom', 'zu', 'zum', 'zur')), None)
        if k is None:
            if len(w) == 1: bare.append(w[0]); forms['NAME'] += 1
            else: forms['other'] += 1
            continue
        pre[' '.join(w[:k]) or '-'] += 1
        rest = w[k + 1:]
        if rest and rest[0] in ('der', 'den', 'dem'): rest = rest[1:]
        if rest:
            topo.append(re.sub(r'[^a-zäöüßÿ]', '', rest[0]))
            tail = ' '.join(rest[1:3])
            if tail.startswith('im ') or tail.startswith('in '): region[tail] += 1
        forms[('TITLE ' if k else '') + w[k] + ' NAME'] += 1
    res[roll] = dict(n=len(legs), forms=forms.most_common(20), prefixes=pre.most_common(40), regions=region.most_common(20),
                     toponyms=sorted(set(t for t in topo if len(t) >= 3)), bare=sorted(set(bare)))
    print(roll, len(legs), 'legends;', len(set(topo)), 'toponyms after von/zu;', len(set(bare)), 'bare names')
    print('  forms', forms.most_common(10))
    print('  prefixes', pre.most_common(25))
    print('  regions', region.most_common(10))
OUT.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding='utf-8')
