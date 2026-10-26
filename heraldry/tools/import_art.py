"""Import heraldic SVG art as recolourable charges for the renderer.

usage: python import_art.py <spec.json> <out.js>

spec.json: [{ "charge": "lion rampant", "file": "path/to.svg", "credit": "...", "licence": "...", "source": "url",
              "body": ["#fcef3c", ...],          fills that take the charge's tincture
              "arms": ["#e20909"], "tongue": [], fills that take the armed / langued tincture (default: body)
              "ink": ["#000000"],                fills and strokes drawn in ink
              "white": ["#ffffff"],              fills kept white (eyes, teeth)
              "flip": false }]                    flip horizontally so the beast faces dexter
Every element is kept in document order as a layer {d, role, stroke?}: the artist's own construction
(outline under or over the body, details on top) is preserved; only the colours are replaced.
Coordinates are mapped into a unit box (the larger side 1), paths reduced to absolute M L C Z.
"""
import json, math, re, sys
import xml.etree.ElementTree as ET

NUM = r'[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?'


def parse_transform(s):
    M = [1, 0, 0, 1, 0, 0]
    for name, args in re.findall(r'(\w+)\s*\(([^)]*)\)', s or ''):
        v = [float(x) for x in re.findall(NUM, args)]
        if name == 'matrix': T = v[:6]
        elif name == 'translate': T = [1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0]
        elif name == 'scale': T = [v[0], 0, 0, v[1] if len(v) > 1 else v[0], 0, 0]
        elif name == 'rotate':
            a = math.radians(v[0]); c, s_ = math.cos(a), math.sin(a)
            T = [c, s_, -s_, c, 0, 0]
            if len(v) == 3: T = mul(mul([1, 0, 0, 1, v[1], v[2]], T), [1, 0, 0, 1, -v[1], -v[2]])
        elif name == 'skewX': T = [1, 0, math.tan(math.radians(v[0])), 1, 0, 0]
        elif name == 'skewY': T = [1, math.tan(math.radians(v[0])), 0, 1, 0, 0]
        else: continue
        M = mul(M, T)
    return M


def mul(A, B):
    return [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]]


def ap(M, x, y): return (M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5])


def arc_to_cubic(x1, y1, rx, ry, phi, fa, fs, x2, y2):
    if rx == 0 or ry == 0: return [(x1, y1, x2, y2, x2, y2)]
    phi = math.radians(phi); cp, sp = math.cos(phi), math.sin(phi)
    dx, dy = (x1 - x2) / 2, (y1 - y2) / 2
    x1p, y1p = cp * dx + sp * dy, -sp * dx + cp * dy
    rx, ry = abs(rx), abs(ry)
    lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry)
    if lam > 1: rx *= math.sqrt(lam); ry *= math.sqrt(lam)
    num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    co = math.sqrt(max(0, num / den)) if den else 0
    if fa == fs: co = -co
    cxp, cyp = co * rx * y1p / ry, -co * ry * x1p / rx
    cx, cy = cp * cxp - sp * cyp + (x1 + x2) / 2, sp * cxp + cp * cyp + (y1 + y2) / 2
    ang = lambda ux, uy, vx, vy: math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not fs and dt > 0: dt -= 2 * math.pi
    elif fs and dt < 0: dt += 2 * math.pi
    n = max(1, int(math.ceil(abs(dt) / (math.pi / 2))))
    out = []; d = dt / n; k = 4 / 3 * math.tan(d / 4)
    for i in range(n):
        a1 = t1 + i * d; a2 = a1 + d
        e1 = (math.cos(a1), math.sin(a1)); e2 = (math.cos(a2), math.sin(a2))
        p = lambda ex, ey: (cx + rx * cp * ex - ry * sp * ey, cy + rx * sp * ex + ry * cp * ey)
        q1 = p(e1[0] - k * e1[1], e1[1] + k * e1[0]); q2 = p(e2[0] + k * e2[1], e2[1] - k * e2[0]); q3 = p(*e2)
        out.append((*q1, *q2, *q3))
    return out


def parse_d(d):
    toks = re.findall(r'[MmLlHhVvCcSsQqTtAaZz]|' + NUM, d or '')
    i = 0; cmd = None; x = y = sx = sy = 0; segs = []; lc = None; lq = None
    def num():
        nonlocal i
        v = float(toks[i]); i += 1; return v
    while i < len(toks):
        if re.match('[A-Za-z]', toks[i]): cmd = toks[i]; i += 1
        if cmd is None: break
        rel = cmd.islower(); C = cmd.upper()
        if C == 'Z':
            segs.append(('Z',)); x, y = sx, sy; lc = lq = None
            if i < len(toks) and not re.match('[A-Za-z]', toks[i]): cmd = 'l' if rel else 'L'
            continue
        if C == 'M':
            nx, ny = num(), num()
            if rel: nx += x; ny += y
            x, y = sx, sy = nx, ny; segs.append(('M', x, y)); cmd = 'l' if rel else 'L'; lc = lq = None
        elif C == 'L':
            nx, ny = num(), num()
            if rel: nx += x; ny += y
            x, y = nx, ny; segs.append(('L', x, y)); lc = lq = None
        elif C == 'H':
            nx = num(); x = x + nx if rel else nx; segs.append(('L', x, y)); lc = lq = None
        elif C == 'V':
            ny = num(); y = y + ny if rel else ny; segs.append(('L', x, y)); lc = lq = None
        elif C in 'CS':
            if C == 'C':
                x1, y1, x2, y2, ex, ey = [num() for _ in range(6)]
                if rel: x1 += x; y1 += y; x2 += x; y2 += y; ex += x; ey += y
            else:
                x2, y2, ex, ey = [num() for _ in range(4)]
                if rel: x2 += x; y2 += y; ex += x; ey += y
                x1, y1 = (2 * x - lc[0], 2 * y - lc[1]) if lc else (x, y)
            segs.append(('C', x1, y1, x2, y2, ex, ey)); lc = (x2, y2); lq = None; x, y = ex, ey
        elif C in 'QT':
            if C == 'Q':
                qx, qy, ex, ey = [num() for _ in range(4)]
                if rel: qx += x; qy += y; ex += x; ey += y
            else:
                ex, ey = num(), num()
                if rel: ex += x; ey += y
                qx, qy = (2 * x - lq[0], 2 * y - lq[1]) if lq else (x, y)
            segs.append(('C', x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), ex + 2 / 3 * (qx - ex), ey + 2 / 3 * (qy - ey), ex, ey)); lq = (qx, qy); lc = None; x, y = ex, ey
        elif C == 'A':
            rx, ry, phi, fa, fs, ex, ey = [num() for _ in range(7)]
            if rel: ex += x; ey += y
            for c in arc_to_cubic(x, y, rx, ry, phi, int(fa), int(fs), ex, ey): segs.append(('C', *c))
            x, y = ex, ey; lc = lq = None
    return segs


def shape_to_d(el, tag):
    g = lambda k, dflt=0.0: float(re.findall(NUM, el.get(k, str(dflt)))[0]) if el.get(k) else dflt
    if tag == 'path': return el.get('d', '')
    if tag == 'rect':
        x, y, w, h = g('x'), g('y'), g('width'), g('height')
        return f'M{x},{y}H{x + w}V{y + h}H{x}Z'
    if tag in ('circle', 'ellipse'):
        cx, cy = g('cx'), g('cy'); rx = g('r') if tag == 'circle' else g('rx'); ry = g('r') if tag == 'circle' else g('ry')
        return f'M{cx + rx},{cy}A{rx},{ry} 0 1 0 {cx - rx},{cy}A{rx},{ry} 0 1 0 {cx + rx},{cy}Z'
    if tag in ('polygon', 'polyline'):
        pts = re.findall(NUM, el.get('points', ''))
        if len(pts) < 4: return ''
        d = 'M' + ' L'.join(f'{pts[i]},{pts[i + 1]}' for i in range(0, len(pts) - 1, 2))
        return d + ('Z' if tag == 'polygon' else '')
    if tag == 'line': return f"M{g('x1')},{g('y1')}L{g('x2')},{g('y2')}"
    return ''


def style_of(el, inherited):
    st = dict(inherited)
    for k in ('fill', 'stroke', 'stroke-width', 'fill-opacity', 'opacity', 'display', 'visibility', 'fill-rule'):
        if el.get(k) is not None: st[k] = el.get(k)
    for kv in (el.get('style') or '').split(';'):
        if ':' in kv:
            k, v = kv.split(':', 1); st[k.strip()] = v.strip()
    return st


def norm_colour(c):
    if not c or c == 'none': return None
    c = c.strip().lower()
    named = {'black': '#000000', 'white': '#ffffff', 'red': '#ff0000', 'blue': '#0000ff', 'yellow': '#ffff00'}
    c = named.get(c, c)
    if re.fullmatch(r'#[0-9a-f]{3}', c): c = '#' + ''.join(ch * 2 for ch in c[1:])
    if c.startswith('rgb'):
        v = [int(float(x)) for x in re.findall(NUM, c)][:3]; c = '#%02x%02x%02x' % tuple(v)
    return c


def css_rules(root):
    rules = {}
    for el in root.iter():
        if el.tag.split('}')[-1] == 'style' and el.text:
            for sel, body in re.findall(r'([^{}]+)\{([^}]*)\}', el.text):
                for s in sel.split(','):
                    s = s.strip()
                    if s.startswith('.'): rules.setdefault(s[1:], []).append(body)
    return rules


def walk(root):
    ids = {el.get('id'): el for el in root.iter() if el.get('id')}
    rules = css_rules(root)
    out = []
    def visit(el, M, st):
        tag = el.tag.split('}')[-1]
        if tag in ('defs', 'clipPath', 'mask', 'metadata', 'title', 'desc', 'style', 'pattern', 'linearGradient', 'radialGradient', 'symbol'): return
        if el.get('class') and rules:
            extra = ';'.join(b for c in el.get('class').split() for b in rules.get(c, []))
            if extra: el.set('style', extra + ';' + (el.get('style') or ''))
        st2 = style_of(el, st)
        if st2.get('display') == 'none' or st2.get('visibility') == 'hidden': return
        M2 = mul(M, parse_transform(el.get('transform')))
        if tag == 'use':
            ref = (el.get('{http://www.w3.org/1999/xlink}href') or el.get('href') or '').lstrip('#')
            if ref in ids:
                M3 = mul(M2, [1, 0, 0, 1, float(el.get('x', 0) or 0), float(el.get('y', 0) or 0)])
                visit(ids[ref], M3, st2)
            return
        if tag in ('g', 'svg', 'a', 'switch'):
            for ch in el: visit(ch, M2, st2)
            return
        d = shape_to_d(el, tag)
        if not d: return
        segs = parse_d(d)
        pts = []
        for s in segs:
            if s[0] == 'Z': pts.append(('Z',)); continue
            q = [s[0]]
            for k in range(1, len(s), 2): q.extend(ap(M2, s[k], s[k + 1]))
            pts.append(tuple(q))
        scale = math.sqrt(abs(M2[0] * M2[3] - M2[1] * M2[2]))
        sw = st2.get('stroke-width'); sw = float(re.findall(NUM, sw)[0]) * scale if sw and re.findall(NUM, sw) else scale * 1.0
        fill = st2.get('fill', '#000000'); stroke = st2.get('stroke')
        op = float(st2.get('fill-opacity', 1) or 1) * float(st2.get('opacity', 1) or 1)
        out.append(dict(segs=pts, fill=norm_colour(fill) if op > 0.05 else None, stroke=norm_colour(stroke), sw=sw, evenodd=st2.get('fill-rule') == 'evenodd'))
    visit(root, [1, 0, 0, 1, 0, 0], {'fill': '#000000'})
    return out


def bounds(items):
    xs, ys = [], []
    for it in items:
        for s in it['segs']:
            if s[0] == 'Z': continue
            xs.extend(s[1::2]); ys.extend(s[2::2])
    return min(xs), min(ys), max(xs), max(ys)


def close(c, palette, tol=40):
    if not c: return False
    a = int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16)
    for p in palette:
        p = norm_colour(p); b = int(p[1:3], 16), int(p[3:5], 16), int(p[5:7], 16)
        if sum(abs(a[i] - b[i]) for i in range(3)) <= tol: return True
    return False


def to_dsl(segs, M):
    out = []
    for s in segs:
        if s[0] == 'Z': out.append(['Z']); continue
        q = [s[0]]
        for k in range(1, len(s), 2):
            x, y = ap(M, s[k], s[k + 1]); q.extend([round(x, 3), round(y, 3)])
        out.append(q)
    return out


def main():
    spec = json.load(open(sys.argv[1], encoding='utf-8')); out_js = sys.argv[2]
    lib = {}
    for e in spec:
        root = ET.parse(e['file']).getroot()
        items = walk(root)
        if e.get('rotate'):
            a = math.radians(e['rotate']); R = [math.cos(a), math.sin(a), -math.sin(a), math.cos(a), 0, 0]
            for it in items:
                it['segs'] = [s if s[0] == 'Z' else tuple([s[0]] + [v for k in range(1, len(s), 2) for v in ap(R, s[k], s[k + 1])]) for s in it['segs']]
        if e.get('crop'):
            # keep only what lies inside a window of the drawing's bounds (drops signatures and stray marks)
            b0 = bounds(items); fx0, fy0, fx1, fy1 = e['crop']
            X0, Y0 = b0[0] + fx0 * (b0[2] - b0[0]), b0[1] + fy0 * (b0[3] - b0[1]); X1, Y1 = b0[0] + fx1 * (b0[2] - b0[0]), b0[1] + fy1 * (b0[3] - b0[1])
            def inside(it):
                xs = [v for s in it['segs'] if s[0] != 'Z' for v in s[1::2]]; ys = [v for s in it['segs'] if s[0] != 'Z' for v in s[2::2]]
                return xs and X0 <= (min(xs) + max(xs)) / 2 <= X1 and Y0 <= (min(ys) + max(ys)) / 2 <= Y1
            items = [it for it in items if inside(it)]
        if e.get('split'):
            # keep one half of a symmetric drawing (a single wing out of a pair)
            b0 = bounds(items); mid = (b0[0] + b0[2]) / 2
            def cx(it):
                xs = [v for s in it['segs'] if s[0] != 'Z' for v in s[1::2]]
                return (min(xs) + max(xs)) / 2 if xs else mid
            items = [it for it in items if (cx(it) < mid) == (e['split'] == 'left')]
        roles = []
        for it in items:
            f, s = it['fill'], it['stroke']
            role = None
            if close(f, e.get('body', []), e.get('tol', 40)): role = 'body'
            elif close(f, e.get('arms', []), e.get('tol', 40)): role = 'arms'
            elif close(f, e.get('tongue', []), e.get('tol', 40)): role = 'tongue'
            elif close(f, e.get('crown', []), e.get('tol', 40)): role = 'crown'
            elif e.get('luma') is not None and f:
                # quantised traces: light fills are the body, dark fills the engraver's lines
                lum = (0.2126 * int(f[1:3], 16) + 0.7152 * int(f[3:5], 16) + 0.0722 * int(f[5:7], 16)) / 255
                role = 'body' if lum >= e['luma'] else 'ink'
            elif close(f, e.get('ink', ['#000000']), e.get('tol', 40)): role = 'ink'
            elif close(f, e.get('white', ['#ffffff']), 30): role = 'white'
            roles.append(role)
            it['role'] = role
        used = [it for it in items if it['role'] or (it['stroke'] and close(it['stroke'], e.get('ink', ['#000000'])))]
        if not used: print('nothing usable in', e['file']); continue
        bx = bounds([it for it in used if it['role'] in ('body', 'arms', 'tongue', 'crown', 'ink')] or used)
        w, h = bx[2] - bx[0], bx[3] - bx[1]; s = 1 / max(w, h)
        M = [s, 0, 0, s, -bx[0] * s, -bx[1] * s]
        if e.get('flip'): M = mul([-1, 0, 0, 1, w * s, 0], M)
        layers = []
        for it in used:
            L = dict(d=to_dsl(it['segs'], M))
            if it['role']: L['role'] = it['role']
            if it['evenodd']: L['evenodd'] = 1
            if it['stroke'] and close(it['stroke'], e.get('ink', ['#000000'])) and it['sw'] > 0:
                L['stroke'] = round(it['sw'] * s, 5)
            layers.append(L)
        if e.get('crown'): pass
        lib[e['charge']] = dict(layers=layers, crown=e.get('crown_at'), w=round(w * s, 4), h=round(h * s, 4), credit=e.get('credit'), licence=e.get('licence'), source=e.get('source'))
        c = {}
        for L in layers: c[L.get('role', 'stroke')] = c.get(L.get('role', 'stroke'), 0) + 1
        print(e['charge'], 'layers', len(layers), c, 'aspect', round(w / h, 3))
    js = '/* Generated by tools/import_art.py. Heraldic art by the artists credited per charge, under the licences given. */\n'
    js += '(function (root) { (root.Heraldry = root.Heraldry || {}).ART = ' + json.dumps(lib, separators=(',', ':')) + '; })(typeof self !== "undefined" ? self : globalThis);\n'
    open(out_js, 'w', encoding='utf-8', newline='\n').write(js)
    print('wrote', out_js, len(js) // 1024, 'KB')


if __name__ == '__main__':
    main()
