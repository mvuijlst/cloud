"""Kamea tracing: turn a name into a route through a planetary number square.

This implements the operation described (not fully specified) in Agrippa,
De occulta philosophia II.22, as reconstructed by later writers: each letter of
the name is given its number, numbers too large for the square are reduced,
and the cells are joined in order. Every convention is a named parameter so
that a test can enumerate a finite, predeclared set of them.

Squares are read from a JSON file {planet: {"rows": [[...], ...]}}, normally
kamea/sources/agrippa_II22_tables.json (transcribed from the printed edition).

Value schemes:
  hebrew         standard Hebrew letter values (finals = ordinary letters)
  agrippa_latin  Agrippa II.20 Latin table: A1 B2 C3 D4 E5 F6 G7 H8 I9 K10 L20 M30 N40 O50
                 P60 Q70 R80 S90 T100 V200 X300 Y400 Z500 (J=600, consonantal V=700 not used)
  ordinal        A=1 .. Z=26 (a modern convention, included for contrast)
Reductions (value v, square of n*n cells):
  drop_zeros     divide by 10 while v > n*n (10 -> 1, 300 -> 30 -> 3)
  mod            1 + (v - 1) mod n*n
  none           keep v; values above n*n have no cell and are dropped (recorded)
"""
import json
import math
import sys
from pathlib import Path
import numpy as np
import cv2

ROOT = Path(__file__).resolve().parents[1]

HEBREW = {'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10, 'כ': 20, 'ך': 20,
          'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50, 'ס': 60, 'ע': 70, 'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90,
          'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400}
AGRIPPA_LATIN = dict(zip('ABCDEFGHIKLMNOPQRSTVXYZ',
                         [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500]))
AGRIPPA_LATIN['U'] = 200; AGRIPPA_LATIN['J'] = 9; AGRIPPA_LATIN['W'] = 200  # U/V, I/J identified; W as VV is not in the table
ORDINAL = {chr(65 + i): i + 1 for i in range(26)}
SCHEMES = dict(hebrew=HEBREW, agrippa_latin=AGRIPPA_LATIN, ordinal=ORDINAL)


def load_squares(path=None):
    path = Path(path) if path else ROOT / 'kamea' / 'sources' / 'agrippa_II22_tables.json'
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    squares = {}
    for planet, d in data.items():
        rows = d['rows'] if isinstance(d, dict) else d
        n = len(rows)
        assert all(len(r) == n for r in rows), planet
        flat = sorted(v for r in rows for v in r)
        assert flat == list(range(1, n * n + 1)), f'{planet}: not a permutation of 1..n^2'
        squares[planet] = rows
    return squares


def check_magic(rows):
    n = len(rows); M = n * (n * n + 1) // 2
    ok_rows = all(sum(r) == M for r in rows)
    ok_cols = all(sum(rows[i][j] for i in range(n)) == M for j in range(n))
    ok_d1 = sum(rows[i][i] for i in range(n)) == M
    ok_d2 = sum(rows[i][n - 1 - i] for i in range(n)) == M
    return dict(n=n, constant=M, total=n * n * (n * n + 1) // 2, rows=ok_rows, cols=ok_cols, diag=ok_d1 and ok_d2)


def letter_values(name, scheme):
    table = SCHEMES[scheme]
    out = []
    for ch in name:
        if ch in (' ', '-', '.', "'"):
            continue
        key = ch if scheme == 'hebrew' else ch.upper()
        if key not in table:
            out.append((ch, None)); continue
        out.append((ch, table[key]))
    return out


def reduce_value(v, n2, rule):
    if v is None:
        return None
    if rule == 'drop_zeros':
        while v > n2 and v % 10 == 0:
            v //= 10
        return v if v <= n2 else None
    if rule == 'mod':
        return 1 + (v - 1) % n2
    if rule == 'none':
        return v if v <= n2 else None
    raise ValueError(rule)


def trace(name, rows, scheme='hebrew', rule='drop_zeros'):
    n = len(rows); n2 = n * n
    pos = {rows[i][j]: (j, i) for i in range(n) for j in range(n)}  # value -> (col, row)
    steps = []
    for ch, v in letter_values(name, scheme):
        r = reduce_value(v, n2, rule)
        steps.append(dict(letter=ch, value=v, reduced=r, cell=pos.get(r)))
    cells = [s['cell'] for s in steps if s['cell'] is not None]
    # collapse adjacent repeats into loop markers but keep the visit record
    route = []; loops = []
    for c in cells:
        if route and route[-1] == c:
            loops.append(c)
        else:
            route.append(c)
    return dict(name=name, scheme=scheme, rule=rule, n=n, steps=steps, route=route, loops=loops,
                dropped=[s['letter'] for s in steps if s['cell'] is None])


def route_points(tr, cell=1.0):
    """Cell centres of the route in square units (cell = 1, origin top-left)."""
    return np.array([[c[0] + 0.5, c[1] + 0.5] for c in tr['route']], float) * cell


def render(tr, rows, cell_px=60, show_numbers=True, path_only=False, route_override=None):
    n = tr['n']; S = cell_px; pad = S // 2
    W = H = n * S + 2 * pad
    img = np.full((H, W, 3), 255, np.uint8)
    if not path_only:
        for i in range(n + 1):
            cv2.line(img, (pad, pad + i * S), (pad + n * S, pad + i * S), (200, 200, 200), 1)
            cv2.line(img, (pad + i * S, pad), (pad + i * S, pad + n * S), (200, 200, 200), 1)
        if show_numbers:
            for i in range(n):
                for j in range(n):
                    cv2.putText(img, str(rows[i][j]), (pad + j * S + 4, pad + i * S + 14), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (150, 150, 150), 1)
    pts = (route_override * S if route_override is not None else route_points(tr, S)) + pad
    P = [tuple(int(round(v)) for v in p) for p in pts]
    w = max(2, S // 12)
    if len(P) >= 2:
        cv2.polylines(img, [np.array(P, np.int32).reshape(-1, 1, 2)], False, (0, 0, 0), w, cv2.LINE_AA)
    if P:
        cv2.circle(img, P[0], int(S * 0.14), (0, 0, 0), w)            # start: small ring
        # end: short bar perpendicular to the last segment
        if len(P) >= 2:
            a = np.array(P[-2], float); b = np.array(P[-1], float); d = b - a; L = np.linalg.norm(d)
            if L > 0:
                v = np.array([-d[1], d[0]]) / L * S * 0.18
                cv2.line(img, tuple((b - v).astype(int)), tuple((b + v).astype(int)), (0, 0, 0), w, cv2.LINE_AA)
    for c in tr['loops']:
        cx, cy = int(pad + (c[0] + 0.5) * S), int(pad + (c[1] + 0.5) * S)
        cv2.circle(img, (cx + int(S * 0.2), cy - int(S * 0.2)), int(S * 0.12), (0, 0, 0), w)
    return img


def to_svg(tr, cell=20.0):
    n = tr['n']; pts = route_points(tr, cell)
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-cell / 2} {-cell / 2} {n * cell + cell} {n * cell + cell}">',
             f'<g fill="none" stroke="#000" stroke-width="{cell / 12:.2f}" stroke-linecap="round" stroke-linejoin="round">']
    if len(pts) >= 2:
        parts.append('<path d="M ' + ' L '.join(f'{x:.2f} {y:.2f}' for x, y in pts) + '"/>')
    if len(pts):
        parts.append(f'<circle cx="{pts[0][0]:.2f}" cy="{pts[0][1]:.2f}" r="{cell * 0.14:.2f}"/>')
    parts.append('</g></svg>')
    return '\n'.join(parts)


if __name__ == '__main__':
    squares = load_squares(sys.argv[1] if len(sys.argv) > 1 else None)
    for planet, rows in squares.items():
        print(planet, check_magic(rows))
