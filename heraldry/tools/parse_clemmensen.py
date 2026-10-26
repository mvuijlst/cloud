"""Parse Steen Clemmensen's text editions (pdftotext output) of the Zürich roll and Grünenberg
into item records: number, name, region, position code, coats (tincture codes + blazon), crest.

usage: python parse_clemmensen.py <zurich.txt> <grunenberg.txt> <out_dir>

Clemmensen's conventions (bhm.txt p.252 legend): A argent, O or; B azure, G gules, S sable,
V vert; P purple; N proper; E ermine; X = mixed, Z = vair; '=' repeats the previous coat.
Single-coat line:  "[s2f6a] 1 O G   lion rampant"        -> codes 'OG', blazon 'lion rampant'
Multi-coat line:   "lion; castle; =; = {OS, AG}"         -> coats split on ';', codes in braces
"""
import json, re, sys
from pathlib import Path

HDR_ZUR = re.compile(r'^(\d{1,3}) (\S.*?)(?:\s{2,}([a-z]{3}))?\s*$')
# Grünenberg headers: number, a name without digits (concordance tables carry digits), optional [attribution], optional region
HDR_GRU = re.compile(r'^\s{0,8}(\d{1,4}) ([a-z.\'][^0-9]*?)(?:\s+([a-z]{3}))?\s*$')
POS = r'(s\d[fb]\d+[ab]|\d+[a-z]\d*)'
ARMS = re.compile(r'^\s*' + POS + r'?\s*(\d+)?\s+([A-Z=]{1,2}(?:\s+[A-Z=]{1,3})*)\s+([a-z0-9].*?)(?:\s{2,}\d{1,4})?\s*$')
ARMS_NOCODE = re.compile(r'^\s*' + POS + r'?\s*(\d+)?\s+([a-z].*?)(?:\s{2,}\d{1,4})?\s*$')
BRACES = re.compile(r'^\s*' + POS + r'?\s*(.*?)\s*\{([^}]*)\}\s*(\d+)?\s*$')
CREST = re.compile(r'crest ornament')


def read(p):
    return Path(p).read_bytes().decode('cp1252', errors='replace').replace('\x0c', '\n').splitlines()


def parse(lines, hdr_re, nmax, start=0, max_jump=0):
    items = []
    i = start; expect = 1
    while i < len(lines) and expect <= nmax:
        m = hdr_re.match(lines[i])
        if m and expect <= int(m.group(1)) <= min(nmax, expect + max_jump):
            num = int(m.group(1)); name = m.group(2).strip(); region = m.group(3)
            expect = num
            # Grünenberg headers carry [attribution] in brackets
            attr = None
            mb = re.search(r'\[(.*?)\]', name)
            if mb:
                attr = mb.group(1); name = name[:mb.start()].strip()
            rec = dict(num=num, name=name, region=region, attr=attr, pos=None, coats=[], crest=None, raw_arms=None, parse='none')
            j = i + 1
            # arms line = next non-empty line
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines):
                raw = lines[j]
                rec['raw_arms'] = raw.strip()
                mbr = BRACES.match(raw)
                if mbr and ';' in raw:
                    rec['pos'] = mbr.group(1)
                    texts = [t.strip() for t in mbr.group(2).split(';')]
                    codes = [c.strip().replace(' ', '') for c in mbr.group(3).split(',')]
                    coats = []; last = None
                    ci = 0
                    for t in texts:
                        if t == '=':
                            coats.append(dict(codes=last['codes'] if last else None, blazon=last['blazon'] if last else None, repeat=True))
                        else:
                            c = codes[ci] if ci < len(codes) else None; ci += 1
                            last = dict(codes=c, blazon=t, repeat=False); coats.append(last)
                    rec['coats'] = coats; rec['parse'] = 'multi'
                else:
                    ma = ARMS.match(raw)
                    if ma:
                        rec['pos'] = ma.group(1)
                        rec['coats'] = [dict(codes=ma.group(3).replace(' ', ''), blazon=ma.group(4), repeat=False)]
                        rec['parse'] = 'single'
                    else:
                        mn = ARMS_NOCODE.match(raw)
                        if mn and not CREST.search(raw):
                            rec['pos'] = mn.group(1)
                            rec['coats'] = [dict(codes=None, blazon=mn.group(3), repeat=False)]
                            rec['parse'] = 'nocode'
                # crest: first line within next 6 non-empty lines containing 'crest ornament'
                k = j + 1; seen = 0
                while k < len(lines) and seen < 6:
                    if lines[k].strip():
                        seen += 1
                        if CREST.search(lines[k]):
                            rec['crest'] = lines[k].strip(); break
                    k += 1
            # some Grünenberg items carry the blazon on the header line ("195 ..   cross patriarchal on mount   hoe")
            if rec['coats'] and re.fullmatch(r'\d{1,4}', (rec['coats'][0].get('blazon') or '').strip()):
                bits = re.split(r'\s{2,}', lines[i].strip())
                if len(bits) >= 2:
                    rec['coats'][0]['blazon'] = bits[1].strip(); rec['name'] = bits[0].split(' ', 1)[1] if ' ' in bits[0] else rec['name']
                    rec['parse'] = rec['parse'] + '+header'
            items.append(rec); expect += 1
            i = j if j > i else i + 1
        else:
            i += 1
    return items


def main():
    zur, gru, out = sys.argv[1], sys.argv[2], Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    z = parse(read(zur), HDR_ZUR, 559)
    glines = read(gru)
    # the Grünenberg item list starts after the concordance tables: first "1 .." header beyond line 4000
    gstart = next(i for i, l in enumerate(glines) if i > 4000 and re.match(r'^\s{0,8}1 (\.\.|[a-z])', l))
    g = parse(glines, HDR_GRU, 2293, start=gstart, max_jump=60)
    for name, items in (('zurich', z), ('grunenberg', g)):
        (out / f'{name}_items.json').write_text(json.dumps(items, indent=0, ensure_ascii=False), encoding='utf-8', newline='\n')
        n = len(items)
        kinds = {}
        for it in items:
            kinds[it['parse']] = kinds.get(it['parse'], 0) + 1
        print(name, 'items', n, 'last', items[-1]['num'] if items else None, 'parse kinds', kinds,
              'with crest', sum(1 for it in items if it['crest']))


if __name__ == '__main__':
    main()
