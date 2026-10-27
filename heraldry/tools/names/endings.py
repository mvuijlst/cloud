"""Which endings the toponyms share: candidate generic elements (Grundwörter) and their spellings.
usage: python endings.py <legends.json>"""
import json, sys, collections
L = json.load(open(sys.argv[1], encoding='utf-8'))
names = sorted(set(L['zurich']['bare'] + L['zurich']['toponyms'] + L['grunenberg']['toponyms'] + L['grunenberg']['bare']))
names = [n for n in names if len(n) >= 4]
print(len(names), 'distinct toponyms')
for k in (3, 4, 5, 6):
    c = collections.Counter(n[-k:] for n in names if len(n) > k + 1)
    print(k, ' '.join(f'{e}:{v}' for e, v in c.most_common(45)))
