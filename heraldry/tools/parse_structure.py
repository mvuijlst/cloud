"""Parse Clemmensen's coded blazons (data/<roll>_items.json) into the structures the generator uses.

usage: python parse_structure.py <heraldry_dir>

For every development item (held-out item numbers in data/holdout_items.json are skipped unread)
the first coat is parsed into
  field     {kind: plain | per pale | ... | barry | semy, n, line, t: [tinctures]}
  ordinary  {kind: fess | bars | pale | pales | bend | bends | bend sinister | chevron | cross | saltire | pile, n, line, t}
  main      {charge, n, t, mods}            principal charges on the field
  on        {charge, n, t}                  charges on the ordinary
  around    {charge, n, t, where}           secondary charges (betw / acc. / cant.)
  chief, bordure, label, canton             {t, line, on}
and given a status:
  ok        every element is a primitive of the grammar and every charge is in the library
  bucket    the structure is a primitive structure but a charge is not in the library (the named bucket)
  out       the structure itself is outside the grammar (reason recorded)
Writes data/corpus_structures.json and prints the coverage (test 1 of STUDY.md section 8).
"""
import json, re, sys, collections
from pathlib import Path

D = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
TINCT = {'A': 'argent', 'O': 'or', 'G': 'gules', 'B': 'azure', 'S': 'sable', 'V': 'vert', 'P': 'purpure', 'N': 'proper', 'E': 'ermine', 'Z': 'vair', 'X': 'mixed', 'Q': 'proper', 'T': 'proper', 'H': 'proper'}

PARTITIONS = [  # (regex at the start of the field phrase, kind, n)
    (r'^per pale', 'per pale', None), (r'^per fess', 'per fess', None), (r'^per bend sn', 'per bend sinister', None), (r'^per bend', 'per bend', None),
    (r'^per chevron', 'per chevron', None), (r'^per saltire', 'per saltire', None), (r'^(qtly|quarterly)', 'quarterly', None),
    (r'^(gyronny|gironny)', 'gyronny', 8), (r'^tierced per fess', 'tierced per fess', 3), (r'^tierced per pale', 'tierced per pale', 3),
    (r'^barry of (\d+)', 'barry', 'g'), (r'^barry', 'barry', 6), (r'^barruly', 'barry', 10), (r'^paly of (\d+)', 'paly', 'g'), (r'^paly', 'paly', 6),
    (r'^bendy sn', 'bendy sinister', 6), (r'^bendy of (\d+)', 'bendy', 'g'), (r'^bendy', 'bendy', 6), (r'^(checky|chequy) of (\d+)', 'chequy', 'g2'), (r'^(checky|chequy)', 'chequy', 6),
    (r'^(lozengy|lozangy)', 'lozengy', 5), (r'^vairy', 'vair', None), (r'^chevronny', 'chevronny', 6),
    # pily: piles counterposed, counted in pieces (pile and interval both), palewise unless barry or bendy (Parker:
    # "paly pily is only another name for pily"); fretty, a field with a fret of bendlets interlaced over it
    (r'^pily-paly of (\d+)', 'pily', 'g'), (r'^pily-paly', 'pily', 6), (r'^pily-barry of (\d+)', 'pily barry', 'g'), (r'^pily-barry', 'pily barry', 6),
    (r'^pily-bendy of (\d+)', 'pily bendy', 'g'), (r'^pily-bendy', 'pily bendy', 6), (r'^fretty\b', 'fretty', None),
]
ORDS = [  # ordinaries that can stand as the main element
    (r'^(\d) bars', 'bars', 'g'), (r'^bar\b', 'bars', 1), (r'^(\d) pales', 'pales', 'g'), (r'^(\d) bends sn', 'bends sinister', 'g'), (r'^(\d) bends', 'bends', 'g'),
    (r'^(\d) chevrons', 'chevrons', 'g'), (r'^fess\b', 'fess', 1), (r'^pale\b', 'pale', 1), (r'^bend sn', 'bend sinister', 1), (r'^bend\b', 'bend', 1),
    (r'^chevron\b', 'chevron', 1), (r'^cross\b(?! (crosslet|potenty|patt|moline|of|flory|pattee|formy|couped|humetty|anchored|recercel))', 'cross', 1),
    (r'^saltire\b(?! couped)', 'saltire', 1), (r'^pile\b', 'pile', 1), (r'^chief\b', 'chief', 1), (r'^(border|bordure)\b', 'bordure', 1), (r'^label\b', 'label', 1),
    (r'^canton\b|^quarter\b', 'canton', 1),
]
LINES = {'indented': 'indented', 'dancetty': 'dancetty', 'undy': 'wavy', 'wavy': 'wavy', 'embattled': 'embattled', 'crenelated': 'embattled', 'crenellated': 'embattled',
         'crenely': 'embattled', 'engrailed': 'engrailed', 'invected': 'invected', 'nebuly': 'nebuly'}
UNSUPPORTED_LINES = ['embattled-counterembattled', 'raguly', 'grady', 'potenty', 'flory', 'compony', 'checky', 'cotised', 'fimbriated', 'voided', 'couped', 'humetty', 'trefly', 'per pale', 'qtly', 'per fess']

# charge nouns -> library charge (exact) or None (bucket); order matters (longest first)
EXCLUDED = r"crampons?|wolf-?hooks?|blackamoor|moor's|moors'|saracen|swastika|fylfot"   # not generated (STUDY.md 2, dossier 6)
CHARGES = [
    (r"lions'? heads?", "lion's head"), (r"boars'? heads?", "boar's head"), (r"bulls?'? (heads?|faces?)|oxe?n?'?s? heads?", "bull's head"),
    (r'saltires? couped|saltorels?', 'saltire couped'), (r'crosse?s? potenty', 'cross potenty'), (r'crosse?s? moline|crosse?s? flory|crosse?s? anchored', 'cross moline'),
    (r'griffins?', 'griffin'), (r'unicorns?', 'unicorn'), (r'bulls?|oxe?n?|cows?', 'bull'), (r'fox(es)?', 'wolf'),
    (r'suns?', 'sun'), (r'gonfanons?', 'gonfanon'), (r'mill-?rinds?', 'mill-rind'), (r'(elm |linden |lime |oak |nettle |waterlily |water-lily )?leaves|(elm |linden |lime |oak |nettle )?leaf', 'leaf'),
    (r'anchors?', 'anchor'), (r'mallets?|hammers?', 'mallet'), (r'spearheads?|spear-heads?', 'spearhead'),
    (r'lions?', 'lion'), (r'eagles?', 'eagle'), (r'bears?', 'bear'), (r'boars?', 'boar'), (r'wolf|wolves', 'wolf'), (r'talbots?|hounds?|brach(es)?|greyhounds?|dogs?', 'talbot'),
    (r'stags?|harts?|bucks?|does?', 'stag'), (r'horses?', 'horse'), (r'goats?|ibex(es)?|rams?', 'goat'),
    (r'roses?', 'rose'), (r'cinquefoils?', 'cinquefoil'), (r'trefoils?', 'trefoil'), (r'fleurs?-de-lis', 'fleur-de-lis'),
    (r'mullets? of (6|six)( pt| points)?|stars? of (6|six)', 'mullet of six points'), (r'mullets?|stars?( of \d+ pt)?', 'mullet'), (r'estoiles?', 'estoile'),
    (r'(de|in)?crescents?', 'crescent'), (r'roundels?|bezants?|plates?|torteaux|pellets?', 'roundel'), (r'annulets?|rings?', 'annulet'),
    (r'lozenges?', 'lozenge'), (r'fusils?', 'fusil'), (r'mascles?', 'mascle'), (r'billets?', 'billet'), (r'escallops?|shells?', 'escallop'), (r'escutcheons?', 'escutcheon'),
    (r'hearts?', 'heart'), (r'crosse?s? crosslet( fitchy)?|crosslets?', 'cross crosslet'), (r'crosse?s? patt(y|ee|é)|crosse?s? formy', 'cross patty'), (r'crosse?s? couped|crosse?s? humetty', 'cross'),
    (r'towers?', 'tower'), (r'castles?', 'castle'), (r'keys?', 'key'), (r'crowns?|coronets?', 'crown'), (r'wheels?|cartwheels?', 'wheel'), (r'horseshoes?', 'horseshoe'),
    (r'bugle-?horns?|hunting-?horns?|horns?', 'bugle horn'), (r'swords?', 'sword'), (r'arrows?', 'arrow'), (r'axes?', 'axe'), (r'buckles?', 'buckle'), (r'chess-?rooks?', 'chess rook'),
    (r'trees?', 'tree'), (r'antlers?|attires?', 'antler'), (r'wings?', 'wing'), (r'barbels?|fish|pikes?|trouts?|salmons?', 'fish'),
    (r'swans?', 'swan'), (r'dolphins?', 'dolphin'),
    (r'martlets?|birds?|ravens?|crows?|cocks?|ducks?|herons?|cranes?|doves?|falcons?|owls?|popinjays?|geese|goose|storks?|ostrich(es)?|hens?|peacocks?', 'martlet'),
    (r'mounts?|trimounts?|hills?', 'trimount'),
]
WORDNUM = {'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6}
BEAST = {'lion', 'bear', 'boar', 'wolf', 'talbot', 'stag', 'horse', 'goat', 'bull', 'unicorn', 'griffin'}


def charge_phrase(s):
    """'3 lions passt guard cr.' -> dict(charge, n, mods, noun, lib) or None"""
    s = s.strip().strip(',').strip()
    if re.search(EXCLUDED, s):
        return dict(charge=None, n=1, noun='excluded', raw=s, unsupported=['excluded'])
    m = re.match(r'^(\d+|two|three|four|five|six)?\s*(.*)$', s)
    n = m.group(1); rest = m.group(2)
    n = int(n) if n and n.isdigit() else WORDNUM.get(n, 1) if n else 1
    for rx, lib in CHARGES:
        mm = re.match(r'^(' + rx + r')\b(.*)$', rest)
        if mm:
            tail = mm.group(mm.lastindex) if mm.lastindex else ''
            tail = rest[mm.end(1):]
            mods = {}
            if re.search(r'\bcr\.|crowned', tail): mods['crowned'] = True
            if re.search(r'doubleheaded', tail): mods['doubleheaded'] = True
            if re.search(r'\bguard\b', tail): mods['guardant'] = True
            if re.search(r'\breguard', tail): mods['reguardant'] = True
            # standing on a mount (the rolls' Dreiberg) or a terrace: a base of its own, not a charge
            bm = re.search(r'\bon (a )?(mount|trimount|hill|terrace)s?\b', tail)
            base = ('terrace' if bm.group(2) == 'terrace' else 'trimount') if bm else None
            if re.search(r'q\.f\.', tail): mods['queue fourchy'] = True
            att = None
            for a, k in (('passt', 'passant'), ('passant', 'passant'), ('statant', 'statant'), ('stat\\b', 'statant'), ('rampant', 'rampant'), ('salient|saillant|springing', 'salient'), ('segreant', 'rampant'),
                         ('sejt|sejant', 'sejant'), ('couchant|couched', 'couchant'), ('naissant|isst', 'issuant'), ('embowed', 'embowed'), ('naiant', 'naiant'), ('addorsed', 'addorsed'), ('fitchy', 'fitchy')):
                if re.search(r'\b' + a, tail): att = att or k; mods[k] = True
            arr = None
            for a, k in (('in pale', 'in pale'), ('in fess', 'in fess'), ('in bend', 'in bend'), ('in saltire', 'in saltire'), ('(2:1)', '2-1'), ('(1:2)', '1-2'), ('(3:2)', '3-2'), ('(3:2:1)', '3-2-1'), ('(3:3)', '3-3')):
                if a in tail: arr = k
            # things the library does not draw
            unsupported = []
            if mods.get('issuant') and lib not in BEAST and lib != 'eagle': unsupported.append('issuant')
            if mods.get('sejant') or mods.get('couchant'): unsupported.append('attitude')
            if re.search(r'\bholding\b|\bch\.|winged|hooded|(?<!double)(?<!triple)headed|tripleheaded|collared|saddled|with\b', tail) and lib != 'trimount': unsupported.append('modifier')
            if lib in BEAST:
                if lib == 'lion':
                    name = 'lion passant' if mods.get('passant') else 'lion statant' if mods.get('statant') else 'lion salient' if mods.get('salient') else 'lion rampant'
                    # looking out of the shield, or back over its shoulder
                    if mods.get('reguardant'): name += ' reguardant'
                    elif mods.get('guardant'): name += ' guardant'
                elif lib != 'griffin' and mods.get('salient'): name = f'{lib} salient'
                elif lib in ('stag', 'horse', 'goat', 'boar', 'bull', 'unicorn') and mods.get('rampant'): name = f'{lib} rampant'
                elif lib in ('stag', 'horse', 'goat', 'boar', 'talbot', 'wolf', 'bear', 'bull', 'unicorn', 'griffin') and mods.get('passant'): name = f'{lib} passant'
                elif lib in ('stag', 'horse', 'goat', 'boar', 'bull') and not mods.get('issuant'): name = f'{lib} statant'
                else: name = f'{lib} rampant'
            elif lib == 'eagle': name = 'eagle'
            elif lib == 'fish': name = 'fish'
            else: name = lib
            noun = mm.group(1)
            approx = noun not in (lib, lib + 's') and not noun.startswith(lib.split()[0])
            return dict(charge=name, n=n, mods=mods, arr=arr, noun=noun, unsupported=unsupported, approx=approx, raw=s, base=base)
    return dict(charge=None, n=n, noun=rest.split(' ')[0] if rest else '', raw=s, unsupported=['not in library'])


def parse_coat(blz, codes):
    b = blz.lower().strip()
    b = re.sub(r'\s+', ' ', b)
    out = dict(field=None, ordinary=None, main=None, on=None, around=None, chief=None, bordure=None, label=None, canton=None, base=None, status='ok', reasons=[])
    def out_(r): out['status'] = 'out'; out['reasons'].append(r)
    def bucket(r):
        if out['status'] == 'ok': out['status'] = 'bucket'
        out['reasons'].append(r)
    if re.search(r'\bpily|fretty|chevronny|per pale .* & |per fess .* & .* & |\bsn\b.*\bdx\b|tierced per pale|bust|man\b|woman|monk|saint|king|blackamoor|moor|human|arm\b|hand\b|griffin|unicorn|dragon|wyvern|panther|serpent|dolphin|harp|letters?\b|\bisst\b.*&', b) and not re.match(r'^per pale & ', b):
        pass  # judged below element by element
    # split into elements on ' & ' (top level), keep 'ch.' / 'betw' / 'acc.' / 'cant.' inside elements
    elems = [e.strip() for e in re.split(r'\s&\s', b) if e.strip()]
    letters = [c for c in (codes or '') if c in TINCT]
    li = 0
    def take(k=1):
        nonlocal li
        r = letters[li:li + k]; li += k
        return [TINCT[c] for c in r] if len(r) == k else None
    # the field
    first = elems[0]
    fk = None
    for rx, kind, n in PARTITIONS:
        m = re.match(rx, first)
        if m:
            nn = int(m.group(1)) if n == 'g' else int(m.group(2)) if n == 'g2' else n
            fk = dict(kind=kind, n=nn, line=None)
            rest = first[m.end():].strip()
            for w, lt in LINES.items():
                if rest.startswith(w): fk['line'] = lt; rest = rest[len(w):].strip()
            if rest.startswith('plain'): rest = rest[5:].strip()
            if rest.startswith('masoned'):
                fk['masoned'] = True; rest = rest[7:].strip()
                mn = re.match(r'^of (\d+)$', rest)
                if mn and fk.get('n'): fk['n'] = int(mn.group(1))
            if rest:
                # a partition carrying charges in one part ("per pale eagle isst") is outside the grammar
                if re.match(r'^(of \d+|of)\b', rest): rest = ''
                else: out_('partition with a charge in one part: ' + rest)
            elems = elems[1:]
            break
    if fk is None and re.match(r'^semy of |^(billety|crusily|roundelly|semy|bezanty|goutty)', first):
        m = re.match(r'^semy of (.*)$', first)
        cp = charge_phrase(m.group(1)) if m else dict(charge={'billety': 'billet', 'crusily': 'cross crosslet', 'roundelly': 'roundel', 'bezanty': 'roundel'}.get(first.split()[0]), n=1, unsupported=[])
        fk = dict(kind='plain', semy=cp.get('charge'))
        if not cp.get('charge'): bucket('semy of an unlisted charge')
        elems = elems[1:]
        if elems or ' ' in first and not m: pass
        out['semy'] = cp
    if fk is None: fk = dict(kind='plain')
    tk = {'plain': 1, 'tierced per fess': 3, 'vair': 0}.get(fk['kind'], 2)
    if fk['kind'] == 'vair':
        fk['t'] = ['vair']; fk['kind'] = 'plain'
        if letters[:1] == ['Z']: take(1)
    else:
        fk['t'] = take(tk)
        if fk.get('masoned'): fk['ms'] = (take(1) or [None])[0]
    if fk['kind'].startswith('pily') and fk.get('n') and fk['n'] % 2: fk['n'] *= 2   # "pily of 3": three piles, six pieces
    out['field'] = fk
    if fk.get('semy'):
        out['semy']['t'] = (take(1) or [None])[0]
    # the remaining elements
    for e in elems:
        e = e.strip()
        cch = ' cch' in e or e.endswith('cch')
        e2 = re.sub(r'\s*cch( per (pale|fess|bend))?', '', e).strip()
        # split off charged / around
        on_m = re.split(r'\sch\.\s', e2, maxsplit=1)
        main_part = on_m[0]; on_part = on_m[1] if len(on_m) > 1 else None
        ar = None
        mm = re.split(r'\s(betw|acc\.|cant\.)\s', main_part, maxsplit=1)
        if len(mm) > 1: main_part, ar = mm[0], mm[2]
        # an ordinary?
        ok = None
        for rx, kind, n in ORDS:
            m = re.match(rx, main_part)
            if m:
                ok = dict(kind=kind, n=int(m.group(1)) if n == 'g' else n, line=None)
                rest = main_part[m.end():].strip()
                for w, lt in LINES.items():
                    if re.match(w + r'\b', rest): ok['line'] = lt; rest = rest[len(w):].strip()
                pm = re.match(r'^(checky|compony|counter-?compony|per pale|fretty)\b', rest)
                if pm:
                    ok['pattern'] = {'checky': 'checky', 'compony': 'compony', 'per pale': 'per pale', 'fretty': 'fretty'}.get(pm.group(1), 'checky'); rest = rest[pm.end():].strip()
                if rest.startswith('masoned'): ok['masoned'] = True; rest = rest[7:].strip()
                if kind == 'canton' and rest.startswith('sn'):
                    ok['kind'] = 'canton sinister'; rest = rest[2:].strip()
                if rest:
                    out_(f'{kind} {rest}')
                break
        if ok:
            kind = ok['kind']
            if ok.get('pattern'):
                tt = take(1)
                if tt == ['mixed']: tt = take(2)
                else: tt = (tt or []) + (take(1) or [])
                ok['t'] = tt
            else:
                t = None if cch else (take(1) or [None])[0]
                ok['t'] = t if not cch else 'counterchanged'
            if ok.get('masoned'): ok['ms'] = (take(1) or [None])[0]
            target = kind if kind in ('chief', 'bordure', 'label') else 'canton' if kind.startswith('canton') else 'ordinary'
            if target == 'ordinary' and out['ordinary']: out_('two ordinaries'); continue
            out[target] = ok
            if on_part:
                cp = charge_phrase(on_part); cp['t'] = (take(1) or [None])[0]
                ok['on'] = cp
                if cp['charge'] is None: bucket('on: ' + cp['noun'])
                elif cp['unsupported']: bucket('on: ' + ','.join(cp['unsupported']))
                if target == 'ordinary': out['on'] = cp
            if ar:
                cp = charge_phrase(re.sub(r'\b(in chf|in base|dx|sn|in fess|in pale)\b', '', ar)); cp['t'] = (take(1) or [None])[0]
                w = re.search(r'\b(in chf|in base|dx|sn)\b', ar)
                cp['where'] = w.group(1) if w else 'betw'
                out['around'] = cp
                if cp['charge'] is None: bucket('around: ' + cp['noun'])
                elif cp['unsupported']: bucket('around: ' + ','.join(cp['unsupported']))
            continue
        # otherwise principal charges
        cp = charge_phrase(main_part)
        cp['t'] = 'counterchanged' if cch else (take(1) or [None])[0]
        if cp.get('base'): out['base'] = dict(kind=cp['base'], t=(take(1) or [None])[0], on=1)
        if on_part:
            sub = charge_phrase(on_part); sub['t'] = (take(1) or [None])[0]
            cp['charged'] = sub
            if sub['charge'] is None: bucket('charged with: ' + sub.get('noun', ''))
        if ar:
            a2 = charge_phrase(re.sub(r'\b(in chf|in base|dx|sn|in fess|in pale)\b', '', ar)); a2['t'] = (take(1) or [None])[0]
            w = re.search(r'\b(in chf|in base|dx|sn)\b', ar)
            a2['where'] = w.group(1) if w else 'betw'
            out['around'] = a2
            if a2['charge'] is None: bucket('around: ' + a2['noun'])
        if out['main']: out_('two principal charge groups'); continue
        out['main'] = cp
        if cp['charge'] is None: bucket('main: ' + cp['noun'])
        elif cp['unsupported']: bucket('main: ' + ','.join(cp['unsupported']))
    # a mount in base that accompanies the principal charge or an ordinary is a base too, the charges above it
    a = out['around']
    if a and a.get('charge') == 'trimount' and a.get('where') == 'in base' and a.get('n') == 1 and not out['base']:
        out['base'] = dict(kind='trimount', t=a.get('t'), on=0); out['around'] = None
    out['tinctures_aligned'] = li == len(letters)
    if not out['field'].get('t') and out['field']['kind'] != 'plain': out['tinctures_aligned'] = False
    return out


def main():
    ho = json.loads((D / 'data' / 'holdout_items.json').read_text(encoding='utf-8'))
    res = {}
    # the two rolls of the study, and two later editions of the same series (Rugen 1493-99, St. Gallen-Haggenberg
    # 1470) that the generator pools with Grünenberg; only the first two have held-out items
    for roll in ('zurich', 'grunenberg', 'rugen', 'sanktgallen'):
        items = json.loads((D / 'data' / f'{roll}_items.json').read_text(encoding='utf-8'))
        excl = set(ho.get(roll, []))
        rows = []
        for it in items:
            if it['num'] in excl: continue
            if not it['coats'] or not it['coats'][0].get('blazon'): continue
            coats = [c for c in it['coats'] if not c.get('repeat')]
            st = parse_coat(it['coats'][0]['blazon'], it['coats'][0].get('codes'))
            st['num'] = it['num']; st['name'] = it['name']; st['n_coats'] = len(it['coats'])
            st['blazon'] = it['coats'][0]['blazon']; st['codes'] = it['coats'][0].get('codes')
            if len(it['coats']) > 1:
                st['quartered'] = len(it['coats'])
                # which quarters the edition gives as "=" (the same as the quarter diagonally opposite): xxrr is
                # 1st and 4th one coat, 2nd and 3rd another; xxxx four different coats
                st['qpat'] = ''.join('r' if c.get('repeat') else 'x' for c in it['coats'])
            rows.append(st)
        c = collections.Counter(r['status'] for r in rows)
        reasons = collections.Counter(x.split(':')[0] + (':' + x.split(':')[1].strip().split(' ')[0] if ':' in x else '') for r in rows for x in r['reasons'])
        res[roll] = rows
        n = len(rows)
        print(f'{roll}: {n} development coats; ok {c["ok"]} ({c["ok"] / n:.1%}), bucket {c["bucket"]} ({c["bucket"] / n:.1%}), out {c["out"]} ({c["out"] / n:.1%}); structure covered {(c["ok"] + c["bucket"]) / n:.1%}')
        print('   reasons:', reasons.most_common(30))
        print('   tinctures aligned:', sum(r['tinctures_aligned'] for r in rows))
    (D / 'data' / 'corpus_structures.json').write_text(json.dumps(res, ensure_ascii=False), encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()
