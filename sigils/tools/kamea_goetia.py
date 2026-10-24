"""Predeclared kamea test on five Goetic seals.

Fixed before looking at any result (24 Oct 2026):
  names      the five single-name pilot seals as spelled first on the sheet:
             BAEL, PAIMON, SITRI, FURCAS, DECARABIA
  schemes    ordinal (A=1..Z=26) and agrippa_latin (II.20 Latin table)
  squares    all seven Agrippa squares as printed in 1533
  rules      drop_zeros, mod, none
  target     the seal's own ink skeleton from the sheet crop (crops/<id>.png)
  statistic  the same symmetric chamfer as the Agrippa control (tools/kamea_control.py)
  selection  for each name, the best of the 42 scheme x square x rule combinations
  null       200 random permutations of the name's letters, each also given the
             best of the same 42 combinations, so that the selection is accounted for
  criterion  a seal counts as kamea-derivable only if its best real-name chamfer is
             below the 5th percentile of the null AND at or below the median chamfer
             that the Agrippa control achieved for its true matches under drop_zeros
Writes kamea/goetia_test_results.json and kamea/goetia_test/<id>.png (seal | best trace).
"""
import json
import random
import sys
from pathlib import Path
import numpy as np
import cv2

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kamea  # noqa: E402
from kamea_control import load_tables, skeleton_points, dense_route, chamfer  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
NAMES = [('01a', 'BAEL'), ('09a', 'PAIMON'), ('12a', 'SITRI'), ('50a', 'FURCAS'), ('69a', 'DECARABIA')]
SCHEMES = ['ordinal', 'agrippa_latin']
RULES = ['drop_zeros', 'mod', 'none']


def best_trace(name, squares, S):
    best = (9.9, None)
    for scheme in SCHEMES:
        for planet, rows in squares.items():
            for rule in RULES:
                tr = kamea.trace(name, rows, scheme, rule)
                d, k = chamfer(S, dense_route(tr))
                if d < best[0]:
                    best = (d, (scheme, planet, rule, tr, k))
    return best


def main():
    squares, _ = load_tables()
    control = json.loads((ROOT / 'kamea' / 'control_results.json').read_text(encoding='utf-8'))
    ctrl_dz = [r['rules']['drop_zeros']['chamfer'] for r in control['results']]
    ctrl_median = float(np.median(ctrl_dz))
    rng = random.Random(20261024)
    out = []
    (ROOT / 'kamea' / 'goetia_test').mkdir(parents=True, exist_ok=True)
    for cid, name in NAMES:
        g = cv2.imread(str(ROOT / 'crops' / f'{cid}.png'), cv2.IMREAD_GRAYSCALE)
        S = skeleton_points(g)
        d, (scheme, planet, rule, tr, k) = best_trace(name, squares, S)
        letters = list(name); null = []
        for _ in range(200):
            rng.shuffle(letters)
            null.append(best_trace(''.join(letters), squares, S)[0])
        p05 = float(np.percentile(null, 5))
        res = dict(id=cid, name=name, best_chamfer=round(d, 4), best=dict(scheme=scheme, square=planet, rule=rule, symmetry=k,
                   route=[list(c) for c in tr['route']], reduced=[s['reduced'] for s in tr['steps']]),
                   null_p05=round(p05, 4), null_median=round(float(np.median(null)), 4),
                   frac_shuffles_better=round(float(np.mean([x < d for x in null])), 3),
                   control_median_drop_zeros=round(ctrl_median, 4),
                   passes=bool(d < p05 and d <= ctrl_median))
        out.append(res)
        h = 320
        seal = cv2.resize(g, (int(g.shape[1] * h / g.shape[0]), h), interpolation=cv2.INTER_AREA)
        img = kamea.render(tr, squares[planet], cell_px=max(24, 300 // len(squares[planet])))
        img = cv2.resize(img, (int(img.shape[1] * h / img.shape[0]), h), interpolation=cv2.INTER_AREA)
        sheet = np.hstack([cv2.cvtColor(seal, cv2.COLOR_GRAY2BGR), np.full((h, 8, 3), 180, np.uint8), img])
        head = np.full((26, sheet.shape[1], 3), 255, np.uint8)
        cv2.putText(head, f'{cid} {name}: best of 42 = {scheme}/{planet}/{rule} d={d:.3f}; null p05={p05:.3f}; pass={res["passes"]}', (4, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1)
        cv2.imwrite(str(ROOT / 'kamea' / 'goetia_test' / f'{cid}.png'), np.vstack([head, sheet]))
        print(cid, name, res['best_chamfer'], res['best']['scheme'], res['best']['square'], res['best']['rule'], 'null p05', res['null_p05'], 'pass', res['passes'])
    (ROOT / 'kamea' / 'goetia_test_results.json').write_text(json.dumps(dict(protocol=__doc__, results=out), indent=1), encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()
