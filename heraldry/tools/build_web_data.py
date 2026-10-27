"""Compile the parsed development corpus into heraldry/arms-data.js for the browser grammar.

usage: python build_web_data.py <heraldry_dir>

Reads data/corpus_structures.json (development coats only; the held-out items were never parsed)
and writes, per roll:
  skeletons   the structure of every coat the grammar can express (status ok or bucket), as a
              compact template with a count: field kind and line, ordinary, principal charges
              (count, class, arrangement, issuant, charged), charges on and around the ordinary,
              chief, canton, bordure, label, semy, quartering
  charges     P(charge | slot, class) over the library, from the coats whose charges are in it
  counts      the share of each slot's charge mass the library covers (the named bucket)
  tinctures   field tinctures, partition pairs and triples, and each element's tincture given the
              tincture it lies on
  mods        crowned and double-headed rates
  index       canonical key -> names, for "also borne by"
The names of new coats come from names-data.js (tools/names/build_names.py, NAMES.md).
"""
import json, re, sys, collections
from pathlib import Path

D = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
CLASS = {
    'lion rampant': 'lion', 'lion passant': 'lion', 'lion statant': 'lion', "lion's head": 'lion', 'eagle': 'eagle',
    'martlet': 'bird', 'wing': 'bird', 'swan': 'bird', 'fish': 'fish', 'dolphin': 'fish', 'griffin rampant': 'beast', 'griffin passant': 'beast',
}
GEOM = {'roundel', 'annulet', 'lozenge', 'fusil', 'mascle', 'billet', 'escutcheon'}
STAR = {'mullet', 'mullet of six points', 'estoile', 'crescent', 'sun'}
CROSS = {'cross', 'cross crosslet', 'cross patty', 'cross potenty', 'cross moline', 'saltire couped'}
FLOWER = {'rose', 'cinquefoil', 'trefoil', 'fleur-de-lis', 'leaf'}
PLANT = {'tree'}
HORN = {'antler', 'bugle horn'}


def cls_of(name):
    if name is None: return None
    if name in CLASS: return CLASS[name]
    if name in GEOM: return 'geometric'
    if name in STAR: return 'star'
    if name in CROSS: return 'cross'
    if name in FLOWER: return 'flower'
    if name in PLANT: return 'plant'
    if name in HORN: return 'horn'
    if re.match(r'(bear|boar|wolf|talbot|stag|horse|goat|bull|unicorn) ', name) or name in ("boar's head", "bull's head"): return 'beast'
    return 'object'


def canon(st):
    """canonical key of a parsed structure, matching grammar.js canonical()"""
    f = st['field']; parts = []
    ft = f.get('t') or []
    if f.get('semy'):
        parts.append(f"F:semy:{f['semy']}:{','.join(ft)}:{(st.get('semy') or {}).get('t')}")
    else:
        parts.append(f"F:{f['kind']}:{f.get('n') or ''}:{f.get('line') or ''}:{','.join(x or '?' for x in ft)}")
    o = st.get('ordinary')
    if o:
        t = o.get('t'); t = ','.join(t) if isinstance(t, list) else t
        parts.append(f"O:{o['kind']}:{o.get('n') or ''}:{o.get('line') or ''}:{o.get('pattern') or ''}:{t}")
        if o.get('on'): parts.append(f"ON:{o['on'].get('charge')}:{o['on'].get('n')}:{o['on'].get('t')}")
    m = st.get('main')
    if m: parts.append(f"M:{m.get('charge')}:{m.get('n')}:{m.get('t')}:{'cr' if m.get('mods', {}).get('crowned') else ''}{'dh' if m.get('mods', {}).get('doubleheaded') else ''}{'is' if m.get('mods', {}).get('issuant') else ''}")
    a = st.get('around')
    if a: parts.append(f"A:{a.get('charge')}:{a.get('n')}:{a.get('t')}")
    for k in ('chief', 'bordure', 'label', 'canton'):
        e = st.get(k)
        if e:
            t = e.get('t'); t = ','.join(t) if isinstance(t, list) else t
            s = f"{k[:2].upper()}:{e.get('kind', k)}:{e.get('line') or ''}:{e.get('pattern') or ''}:{t}"
            if e.get('on'): s += f":{e['on'].get('charge')}:{e['on'].get('n')}:{e['on'].get('t')}"
            parts.append(s)
    return '|'.join(parts)


def main():
    S = json.loads((D / 'data' / 'corpus_structures.json').read_text(encoding='utf-8'))
    out = {}
    for roll, rows in S.items():
        cov = [r for r in rows if r['status'] in ('ok', 'bucket')]
        sk = collections.Counter(); ch = collections.defaultdict(collections.Counter); slot_mass = collections.defaultdict(lambda: [0, 0])
        tf = collections.Counter(); tp = collections.Counter(); t3 = collections.Counter()
        cond = collections.defaultdict(collections.Counter)   # (role, under) -> tincture
        mods = collections.Counter(); index = collections.defaultdict(list)
        for r in cov:
            f = r['field']; o = r.get('ordinary'); m = r.get('main'); a = r.get('around')
            def cmeta(c):
                if not c: return None
                cl = cls_of(c.get('charge'))
                return dict(n=c.get('n', 1), c=cl, arr=c.get('arr'), w=c.get('where'), iss=1 if c.get('mods', {}).get('issuant') else 0,
                            chg=1 if c.get('charged') else 0, cch=1 if c.get('t') == 'counterchanged' else 0)
            tpl = dict(
                f=dict(k=f['kind'] if not f.get('semy') else 'semy', n=f.get('n'), l=f.get('line')),
                o=dict(k=o['kind'], n=o.get('n'), l=o.get('line'), p=o.get('pattern'), cch=1 if o.get('t') == 'counterchanged' else 0) if o else None,
                m=cmeta(m), on=cmeta(o.get('on')) if o and o.get('on') else None, ar=cmeta(a),
                c=dict(l=r['chief'].get('line'), on=cmeta(r['chief'].get('on')), p=r['chief'].get('pattern')) if r.get('chief') else None,
                b=dict(p=r['bordure'].get('pattern'), on=cmeta(r['bordure'].get('on'))) if r.get('bordure') else None,
                lb=1 if r.get('label') else 0, cn=r['canton']['kind'] if r.get('canton') else None,
                q=r.get('quartered', 0) if r.get('quartered', 0) >= 2 else 0,
            )
            if tpl['f']['k'] == 'semy': tpl['f']['s'] = cls_of(f.get('semy'))
            sk[json.dumps(tpl, sort_keys=True)] += 1
            # charges per slot and class (library charges only; others count toward the bucket)
            for slot, c in (('main', m), ('on', o.get('on') if o else None), ('around', a), ('chief', (r.get('chief') or {}).get('on')),
                            ('semy', {'charge': f.get('semy'), 'n': 1} if f.get('semy') else None), ('charged', (m or {}).get('charged'))):
                if not c: continue
                slot_mass[slot][1] += 1
                if c.get('charge') and not c.get('unsupported'):
                    slot_mass[slot][0] += 1
                    ch[f'{slot}|{cls_of(c["charge"])}'][c['charge']] += 1
                    ch[f'{slot}|*'][c['charge']] += 1
                    if c['charge'] in ('eagle',) or c['charge'].startswith('lion'):
                        mods[f'{c["charge"].split()[0]}:n'] += 1
                        if c.get('mods', {}).get('crowned'): mods[f'{c["charge"].split()[0]}:crowned'] += 1
                        if c.get('mods', {}).get('doubleheaded'): mods[f'{c["charge"].split()[0]}:doubleheaded'] += 1
            # tinctures, only where the codes aligned with the parse
            if not r.get('tinctures_aligned'): continue
            ft = f.get('t') or []
            if f['kind'] == 'plain' and not f.get('semy') and len(ft) == 1: tf[ft[0]] += 1
            if len(ft) == 2: tp['/'.join(ft)] += 1
            if len(ft) == 3: t3['/'.join(ft)] += 1
            under = ft[0] if len(ft) == 1 else 'party'
            if o and isinstance(o.get('t'), str) and o['t'] != 'counterchanged': cond[f'ord|{under}'][o['t']] += 1
            if o and isinstance(o.get('t'), list) and len(o['t']) == 2: cond['ordpattern|*']['/'.join(o['t'])] += 1
            if o and o.get('on') and o['on'].get('t') and isinstance(o.get('t'), str): cond[f'on|{o["t"]}'][o['on']['t']] += 1
            if m and m.get('t') and m['t'] != 'counterchanged': cond[f'main|{under}'][m['t']] += 1
            if m and m.get('charged') and m['charged'].get('t') and m.get('t'): cond[f'charged|{m["t"]}'][m['charged']['t']] += 1
            if a and a.get('t'): cond[f'around|{under}'][a['t']] += 1
            if r.get('chief') and isinstance(r['chief'].get('t'), str):
                cond[f'chief|{under}'][r['chief']['t']] += 1
                if r['chief'].get('on') and r['chief']['on'].get('t'): cond[f'chiefon|{r["chief"]["t"]}'][r['chief']['on']['t']] += 1
            if r.get('bordure') and isinstance(r['bordure'].get('t'), str): cond[f'bordure|{under}'][r['bordure']['t']] += 1
            if r.get('label') and isinstance(r['label'].get('t'), str): cond[f'label|{under}'][r['label']['t']] += 1
            if r.get('canton') and isinstance(r['canton'].get('t'), str): cond[f'canton|{under}'][r['canton']['t']] += 1
            if f.get('semy') and (r.get('semy') or {}).get('t'): cond[f'semy|{under}'][r['semy']['t']] += 1
            if r['status'] == 'ok': index[canon(r)].append([r['name'][:40], r['num']])
        out[roll] = dict(
            n_dev=len(rows), n_covered=len(cov), n_ok=sum(1 for r in rows if r['status'] == 'ok'),
            skeletons=[[json.loads(k), v] for k, v in sk.most_common()],
            charges={k: dict(v.most_common()) for k, v in ch.items()},
            slot_coverage={k: dict(library=v[0], all=v[1], share=round(v[0] / v[1], 3) if v[1] else None) for k, v in slot_mass.items()},
            tinctures=dict(field=dict(tf.most_common()), pairs=dict(tp.most_common()), triples=dict(t3.most_common()), cond={k: dict(v.most_common()) for k, v in cond.items()}),
            mods=dict(mods), index={k: v[:4] for k, v in index.items()},
            quartered_rate=round(sum(1 for r in cov if r.get('quartered', 0) >= 2) / len(cov), 4),
        )
        print(roll, 'skeletons', len(sk), 'from', len(cov), 'covered coats; index keys', len(index))
        print('  slot coverage', {k: v['share'] for k, v in out[roll]['slot_coverage'].items()})
        print('  main charges', list(out[roll]['charges'].get('main|*', {}).items())[:14])
    js = '/* Generated by tools/build_web_data.py from the development coats of the Zurich roll and\n   Grunenberg\'s Wappenbuch (Clemmensen\'s editions); held-out items excluded. Do not edit. */\n'
    js += '(function (root) { (root.Heraldry = root.Heraldry || {}).DATA = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '; })(typeof self !== "undefined" ? self : globalThis);\n'
    (D / 'arms-data.js').write_text(js, encoding='utf-8', newline='\n')
    print('arms-data.js', len(js) // 1024, 'KB')


if __name__ == '__main__':
    main()
