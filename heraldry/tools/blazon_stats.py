"""Per-roll distributions from Clemmensen's coded blazons (output of parse_clemmensen.py).

usage: python blazon_stats.py <parsed_dir> <out_json>

For every item with at least one parsed coat:
  field tincture      first letter of the first coat's code (X/Z/E/N/= excluded as 'other')
  charge tincture     second letter of the first coat's code
  metal/colour test   O,A = metal; G,B,S,V,P = colour; rule-of-tincture violation = field and first
                      charge tincture in the same class, for single coats whose blazon is a charge or
                      ordinary (partition-only coats such as 'paly', 'qtly', 'lozengy' are tested on
                      their two tinctures too, since they juxtapose)
  charge classes      keyword classes over the blazon of the first coat (several may apply)
  coats per item      1 = single, >1 = quartered/impaled/etc.
"""
import json, re, sys, collections
from pathlib import Path

METAL = set('OA'); COLOUR = set('GBSVP')
CLASSES = collections.OrderedDict([
    ('lion', r'\blion'), ('eagle', r'\beagle'), ('fess_barry', r'\b(fess|bars?|barry|barruly|bar-gemel)\b'), ('bend_bendy', r'\bbend'),
    ('pale_paly', r'\b(pale|paly|pales)\b'), ('chevron', r'\bchevron'), ('chief', r'\bchief\b'), ('cross', r'\b(cross|saltire|crosslet)'),
    ('border', r'\bborder'), ('label', r'\blabel\b'), ('qtly_checky_lozengy', r'\b(qtly|quarterly|checky|chequy|lozengy|gyronny|fusilly|vairy)\b'),
    ('per_partition', r'PARTITION'), ('roundel_annulet', r'\b(roundel|annulet|bezant|ring)s?\b'),
    ('star_crescent_sun', r'\b(mullet|star|estoile|crescent|sun|moon)s?\b'), ('rose_flower', r'\b(rose|fleur|lily|flower|trefoil)'),
    ('plant_tree_leaf', r'\b(tree|leaf|leaves|branch|oak|nettle|grape|bunch|stock|lime)\b'), ('antler_horn', r'\b(antler|attire|bugle|horn)s?\b'),
    ('beast', r'\b(bear|boar|talbot|dog|hound|horse|stag|hart|goat|ram|wolf|ox|bull|elephant|camel|hare|ibex|lamb|cat|fox|squirrel|wild)'),
    ('bird', r'\b(swan|cock|crane|ostrich|raven|bird|hen|falcon|dove|duck|peacock|goose|parrot|stork|heron)'), ('fish', r'\b(barbel|fish|pike|dolphin|salmon|trout)'),
    ('monster', r'\b(griffin|dragon|wyvern|unicorn|mermaid|basilisk|harpy|centaur)'), ('human', r"\b(head|man|monk|king|saint|maiden|arm|hand|moor|figure|knight|bust)\b"),
    ('object', r'\b(key|axe|hammer|arrow|sword|wheel|buckle|escutcheon|castle|tower|helmet|crown|hat|anchor|ladder|knife|dagger|shears|cup|bell|pot|bucket|mallet|hook|crook|bridge|gate|column|pillar|staff|rod|club|shovel|spade|rake|plough|scythe|sickle|wing|mount|hill|stirrup|spur|bow|bolt|crossbow|lantern|shuttle|comb|saw|chess|rook|dice|mill|rind|ship|boat|oar|net|basket|torch|candle|mirror|chain|collar|belt|glove|shoe|boot|flag|banner|pennon|harp|trumpet|drum|hunting|vase|jug|bottle|scales|balance|book|letter)s?\b'),
    ('semy', r'\bsemy\b'),
])


def cls_of(t):
    return 'metal' if t in METAL else 'colour' if t in COLOUR else 'other'


def main():
    pdir, outp = Path(sys.argv[1]), Path(sys.argv[2])
    out = {}
    for roll in ('zurich', 'grunenberg'):
        items = json.loads((pdir / f'{roll}_items.json').read_text(encoding='utf-8'))
        n_items = len(items)
        with_coats = [it for it in items if it['coats'] and it['coats'][0].get('blazon')]
        field = collections.Counter(); charge = collections.Counter(); pair = collections.Counter()
        classes = collections.Counter(); ncoats = collections.Counter(); viol = []; tested = 0
        combos = collections.Counter(); n_tinct = collections.Counter()
        for it in with_coats:
            c0 = it['coats'][0]; code = c0.get('codes') or ''
            blz = c0['blazon'].lower()
            # arrangement phrases ("3 antlers in pale", "bendwise", "per bend") are not ordinaries: strip them first
            blz = re.sub(r'\bin (pale|fess|bend|chief|base|saltire|cross|pairle|orle|bordure)\b', ' ', blz)
            blz = re.sub(r'\b(bend|pale|fess|chevron|saltire)wise\b', ' ', blz)
            blz = re.sub(r'\bper (fess|pale|bend|chevron|saltire)\b', ' PARTITION ', blz)
            blz = re.sub(r'\b(pf|pp|pq|ps)\b', ' PARTITION ', blz)
            ncoats[len(it['coats'])] += 1
            hit = [k for k, rx in CLASSES.items() if re.search(rx, blz)]
            for k in hit:
                classes[k] += 1
            if not hit:
                classes['_unclassified'] += 1
            if len(it['coats']) == 1 and code:
                letters = [ch for ch in code if ch in 'OAGBSVPEXZN']
                n_tinct[len(letters)] += 1
                if letters:
                    field[letters[0]] += 1
                if len(letters) >= 2:
                    charge[letters[1]] += 1
                    pair[letters[0] + letters[1]] += 1
                    combos[''.join(sorted(set(letters[:2])))] += 1
                    cf, cc = cls_of(letters[0]), cls_of(letters[1])
                    if cf != 'other' and cc != 'other':
                        tested += 1
                        if cf == cc:
                            viol.append(dict(num=it['num'], name=it['name'], codes=code, blazon=c0['blazon']))
        tot = len(with_coats)
        out[roll] = dict(items_in_edition=n_items, items_with_coat=tot, coats_per_item=dict(ncoats),
                         tinctures_per_single_coat=dict(sorted(n_tinct.items())),
                         field_tincture={k: v for k, v in field.most_common()}, charge_tincture={k: v for k, v in charge.most_common()},
                         field_charge_pair={k: v for k, v in pair.most_common(12)}, metal_colour_combo={k: v for k, v in combos.most_common(12)},
                         rule_of_tincture=dict(tested=tested, violations=len(viol), rate=round(len(viol) / tested, 4) if tested else None, cases=viol[:40]),
                         charge_classes_per_mille={k: round(1000 * v / tot, 1) for k, v in classes.most_common()},
                         charge_classes_count=dict(classes.most_common()))
        print(roll, 'items', n_items, 'with coat', tot, 'single', ncoats.get(1), 'multi', tot - ncoats.get(1, 0))
        print('  field', field.most_common(8))
        print('  charge', charge.most_common(8))
        print('  rule of tincture: tested', tested, 'violations', len(viol))
        print('  classes per mille:', [(k, round(1000 * v / tot)) for k, v in classes.most_common(12)])
    outp.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()
