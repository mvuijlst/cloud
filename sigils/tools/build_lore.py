"""Build the encoded, sharded lore corpus the seal page reads.

    python tools/build_lore.py

Input: lore_src/*.json, slot fillers written by a language model in the
English of the printed Goetia (kept out of git and out of the served files),
and data/goetia_entries_raw.json, the 72 real entries.

Steps:
  1. clean: trim, drop a leading "he", trailing full stops, bad lengths
  2. de-duplicate: exact (case-insensitive) and near (word-set Jaccard >= 0.8
     against an earlier phrase of the same slot)
  3. novelty: drop any phrase sharing a run of six words with a real entry
     (lower case, letters only)
  3b. repetition: in the large slots keep at most END_CAP phrases ending in the
     same three words, and among the offices at most OPEN_CAP (share of the
     slot) opening with the same two words (the other slots open by their
     grammar, "in the form of", "The Exorcist must"), so stock tails such as "...as the Exorcist willeth" cannot recur
     across visits (the generated part of the office corpus had only 36%
     distinct endings)
  4. shard: the large slots (forms, offices, manner, conditions) are divided
     among SHARDS files by a hash of the phrase; every shard also gets a sample
     of SMALL_K phrases from each small slot (transformations, nature,
     locations, orders, hopes, seal formulas), so any one shard can complete
     a spirit
  5. encode: each shard's JSON, as UTF-8, XORed with a mulberry32 key stream
     (seed KEY ^ shard index, top byte of each draw) and base64: a deterrent to
     reading the corpus off the server as one plain file, not protection

Writes lore/<xx>.dat (xx = shard index in hex) and data/lore_build.json.
"""
import base64
import hashlib
import json
import random
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHARDS = 128
SMALL_K = 8
END_CAP = 4
OPEN_CAP = 0.025
KEY = 0x5A1E6E7D
BIG = {'forms': ('appearance', 'forms'), 'offices': ('offices', 'offices'), 'manner': ('manner', 'manner'),
       'conditions': ('manner', 'conditions')}
SMALL = {'transformations': ('appearance', 'transformations'), 'nature': ('manner', 'nature'),
         'locations': ('manner', 'locations'), 'orders': ('manner', 'orders'), 'hopes': ('manner', 'hopes'),
         'seal_formulas': ('manner', 'seal_formulas')}
LENGTH = {'forms': (3, 40), 'offices': (3, 30), 'manner': (3, 26), 'conditions': (5, 36), 'transformations': (4, 30),
          'nature': (2, 20), 'locations': (2, 12), 'orders': (2, 16), 'hopes': (4, 24), 'seal_formulas': (4, 30)}
VERB_SLOTS = {'offices', 'manner'}


def mulberry32(a):
    a &= 0xFFFFFFFF
    while True:
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        yield (t ^ (t >> 14)) & 0xFFFFFFFF


def encode(obj, index):
    data = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    ks = mulberry32(KEY ^ index)
    return base64.b64encode(bytes(b ^ (next(ks) >> 24) for b in data)).decode('ascii')


def words(s):
    return re.findall(r"[a-z]+", s.lower())


def clean(slot, s):
    s = re.sub(r'\s+', ' ', str(s)).strip().rstrip('.').strip()
    if slot in VERB_SLOTS:
        s = re.sub(r'^(he|and he)\s+', '', s, flags=re.I)
    lo, hi = LENGTH[slot]
    n = len(s.split())
    return s if lo <= n <= hi else None


def main():
    src = ROOT / 'lore_src'
    files = {f.stem: json.loads(f.read_text(encoding='utf-8')) for f in src.glob('*.json')}
    real = json.loads((ROOT / 'data' / 'goetia_entries_raw.json').read_text(encoding='utf-8'))
    grams = set()
    for e in real:
        w = words(e['text'])
        grams.update(tuple(w[i:i + 6]) for i in range(len(w) - 5))
    report = {}; slots = {}
    for slot, (fname, key) in {**BIG, **SMALL}.items():
        raw = files.get(fname, {}).get(key, [])
        kept, seen, sets = [], set(), []
        drops = dict(length=0, duplicate=0, near=0, copies_real=0, stock_end=0, stock_open=0)
        ends, opens = {}, {}
        open_cap = max(8, int(OPEN_CAP * len(raw)))
        for s in raw:
            c = clean(slot, s)
            if c is None:
                drops['length'] += 1; continue
            k = ' '.join(words(c))
            if k in seen:
                drops['duplicate'] += 1; continue
            w = words(c)
            if any(tuple(w[i:i + 6]) in grams for i in range(len(w) - 5)):
                drops['copies_real'] += 1; continue
            ws = set(w)
            if any(len(ws & o) / len(ws | o) >= 0.8 for o in sets):
                drops['near'] += 1; continue
            if slot in BIG:
                e3, o2 = ' '.join(w[-3:]), ' '.join(w[:2])
                if ends.get(e3, 0) >= END_CAP:
                    drops['stock_end'] += 1; continue
                if slot == 'offices' and opens.get(o2, 0) >= open_cap:   # other slots open by their grammar ("in the form of", "The Exorcist must")
                    drops['stock_open'] += 1; continue
                ends[e3] = ends.get(e3, 0) + 1; opens[o2] = opens.get(o2, 0) + 1
            seen.add(k); sets.append(ws); kept.append(c)
        slots[slot] = kept
        report[slot] = dict(source=len(raw), kept=len(kept), dropped=drops)
    # shards
    shards = [{s: [] for s in slots} for _ in range(SHARDS)]
    for slot in BIG:
        for p in slots[slot]:
            h = int(hashlib.sha1((slot + '|' + p).encode('utf-8')).hexdigest(), 16) % SHARDS
            shards[h][slot].append(p)
    rng = random.Random(20261025)
    for slot in SMALL:
        pool = slots[slot]
        for sh in shards:
            sh[slot] = rng.sample(pool, min(SMALL_K, len(pool))) if pool else []
    out = ROOT / 'lore'
    out.mkdir(exist_ok=True)
    for f in out.glob('*.dat'):
        f.unlink()
    sizes = []
    for i, sh in enumerate(shards):
        txt = encode(dict(v=1, slots=sh), i)
        (out / f'{i:02x}.dat').write_text(txt, encoding='ascii', newline='\n')
        sizes.append(len(txt))
    empty = {slot: sum(1 for sh in shards if not sh[slot]) for slot in slots}
    report['shards'] = dict(n=SHARDS, bytes_min=min(sizes), bytes_max=max(sizes), bytes_total=sum(sizes),
                            per_shard_min={slot: min(len(sh[slot]) for sh in shards) for slot in BIG},
                            shards_missing_a_slot=empty)
    (ROOT / 'data' / 'lore_build.json').write_text(json.dumps(report, indent=1), encoding='utf-8', newline='\n')
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
