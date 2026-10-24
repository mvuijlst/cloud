"""Sigil encoding vocabulary: load, render to raster, export SVG.

Units: the drawing's tight ink bounding box has height 1; x runs 0..aspect left
to right, y runs 0..1 top to bottom. Angles are degrees, measured clockwise on
screen from the +x axis (OpenCV convention, y down). Stroke width is in the
same units (0.04 is a typical pen on this sheet).

Member types (field "t"):
  line     p=[x1,y1,x2,y2]
  pline    p=[[x,y],...]  closed=false  fill=false
  arc      c=[x,y] r=r | [rx,ry]  a=[a0,a1]            drawn from a0 to a1 clockwise
  bez      p=[[x,y]...]  3n+1 control points, cubic segments
  ring     c=[x,y] r=r                                  stroked circle
  dot      c=[x,y] r=r                                  filled circle
  cross    c=[x,y] s=half-arm  flared=true  rot=0       flared = cross pattee, filled arms
  tri      p=[[x,y],[x,y],[x,y]]  fill=true
  spiral   c=[x,y] r=[r0,r1] a=[a0,sweep]               radius interpolates r0->r1 over sweep
  crescent c=[x,y] r=r k=0.35 rot=0 ri=r                filled lens: circle r minus circle ri shifted k*r toward rot (the opening)
  repeat   n=k d=[dx,dy] m=[members]                    members translated 0..n-1 times
  mirror   axis="x"|"y" at=v m=[members]                members plus their reflection in the axis
  path     p=[[x,y]...] cubic points, note=...          ESCAPE: free trace of a shape the vocabulary cannot name
Any member may carry w (stroke width override).
"""
import json
import math
from pathlib import Path
import numpy as np
import cv2

VOCAB_VERSION = '1.0'
STRUCTURAL = {'line', 'pline', 'arc', 'bez', 'ring', 'dot', 'cross', 'tri', 'spiral', 'crescent'}
GROUPING = {'repeat', 'mirror'}
ESCAPE = {'path'}


def load(path):
    enc = json.loads(Path(path).read_text(encoding='utf-8'))
    assert 'members' in enc and 'aspect' in enc, path
    enc.setdefault('stroke', 0.04)
    enc.setdefault('escapes', [])
    return enc


# ---------- geometry sampling (unit coordinates) ----------

def _bez_points(pts, n_per=24):
    pts = [np.array(p, float) for p in pts]
    assert (len(pts) - 1) % 3 == 0, f'bez needs 3n+1 points, got {len(pts)}'
    out = [pts[0]]
    for i in range(0, len(pts) - 1, 3):
        p0, p1, p2, p3 = pts[i:i + 4]
        for t in np.linspace(0, 1, n_per + 1)[1:]:
            out.append((1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3)
    return np.array(out)


def _arc_points(c, r, a0, a1, n=None):
    rx, ry = (r, r) if np.isscalar(r) else r
    if n is None:
        n = max(8, int(abs(a1 - a0) / 4))
    ang = np.radians(np.linspace(a0, a1, n + 1))
    return np.stack([c[0] + rx * np.cos(ang), c[1] + ry * np.sin(ang)], 1)


def _spiral_points(c, r0, r1, a0, sweep):
    n = max(12, int(abs(sweep) / 4))
    t = np.linspace(0, 1, n + 1)
    ang = np.radians(a0 + sweep * t)
    rad = r0 + (r1 - r0) * t
    return np.stack([c[0] + rad * np.cos(ang), c[1] + rad * np.sin(ang)], 1)


def _cross_polys(c, s, flared, rot):
    polys = []
    for k in range(4):
        th = math.radians(rot + 90 * k)
        u = np.array([math.cos(th), math.sin(th)]); v = np.array([-u[1], u[0]])
        if flared:
            # cross pattee arm: narrow waist near the centre, wide tip, concave sides
            c0 = np.array(c, float)
            tip = c0 + u * s
            waist = 0.14 * s; spread = 0.55 * s
            side = []
            for f in (0.15, 0.4, 0.65, 0.85):
                # concave side: lateral offset grows slowly then fast toward the tip
                side.append(c0 + u * (f * s) + v * (waist + (spread - waist) * f ** 2.2))
            poly = [c0 + v * waist] + side + [tip + v * spread, tip - v * spread] +                    [c0 + u * (f * s) - v * (waist + (spread - waist) * f ** 2.2) for f in (0.85, 0.65, 0.4, 0.15)] + [c0 - v * waist]
            polys.append(np.array(poly))
        else:
            polys.append(None)
    return polys


def _crescent_poly(c, r, k, rot, ri=None):
    """Filled crescent: outer circle A(c, r) minus inner circle B of radius ri (default r)
    whose centre is shifted by d = k*r from c toward angle rot (the opening side)."""
    c = np.array(c, float); d = k * r; ri = r if ri is None else ri
    th = math.radians(rot)
    u = np.array([math.cos(th), math.sin(th)])
    cb = c + d * u
    # intersection points on A, at angle +-theta from u
    cos_t = (d * d + r * r - ri * ri) / (2 * d * r)
    if cos_t >= 1:  # B inside A: no horns, draw a full annulus-like lens
        cos_t = 0.999
    theta = math.degrees(math.acos(max(-1.0, cos_t)))
    outer = _arc_points(c, r, rot + theta, rot + 360 - theta)
    p1 = outer[-1]; p2 = outer[0]
    # inner arc of B from p1 back to p2 passing through the point of B nearest to c (angle rot+180 from cb)
    a1 = math.degrees(math.atan2(p1[1] - cb[1], p1[0] - cb[0]))
    a2 = math.degrees(math.atan2(p2[1] - cb[1], p2[0] - cb[0]))
    mid = rot + 180
    # choose the sweep from a1 to a2 that contains mid
    def norm(a):
        return (a + 180) % 360 - 180
    sweep = norm(a2 - a1)
    if abs(norm(a1 + sweep / 2 - mid)) > 90:
        sweep = sweep - 360 if sweep > 0 else sweep + 360
    inner = _arc_points(cb, ri, a1, a1 + sweep)
    return np.vstack([outer, inner])


# ---------- expansion of grouping members ----------

def _translate(m, dx, dy):
    m = json.loads(json.dumps(m))
    t = m['t']
    if t in ('line',):
        p = m['p']; m['p'] = [p[0] + dx, p[1] + dy, p[2] + dx, p[3] + dy]
    elif t in ('pline', 'bez', 'tri', 'path'):
        m['p'] = [[x + dx, y + dy] for x, y in m['p']]
    elif t in ('arc', 'ring', 'dot', 'cross', 'spiral', 'crescent'):
        m['c'] = [m['c'][0] + dx, m['c'][1] + dy]
    elif t in ('repeat', 'mirror'):
        m['m'] = [_translate(x, dx, dy) for x in m['m']]
        if t == 'mirror':
            m['at'] = m['at'] + (dx if m['axis'] == 'x' else dy)
    return m


def _reflect(m, axis, at):
    """Reflect a member in the line x=at (axis 'x') or y=at (axis 'y')."""
    m = json.loads(json.dumps(m))
    def rp(x, y):
        return [2 * at - x, y] if axis == 'x' else [x, 2 * at - y]
    def ra(a):  # reflect an angle
        return (180 - a) % 360 if axis == 'x' else (-a) % 360
    t = m['t']
    if t == 'line':
        p = m['p']; a = rp(p[0], p[1]); b = rp(p[2], p[3]); m['p'] = [a[0], a[1], b[0], b[1]]
    elif t in ('pline', 'bez', 'tri', 'path'):
        m['p'] = [rp(x, y) for x, y in m['p']]
    elif t in ('ring', 'dot'):
        m['c'] = rp(*m['c'])
    elif t == 'arc':
        m['c'] = rp(*m['c']); a0, a1 = m['a']; m['a'] = [ra(a1), ra(a0)] if False else [ra(a0), ra(a1)]
        # reflection reverses orientation: keep sweep direction consistent by swapping
        m['a'] = [m['a'][1], m['a'][0]]
        if m['a'][1] < m['a'][0]:
            m['a'][1] += 360
    elif t == 'cross':
        m['c'] = rp(*m['c']); m['rot'] = ra(m.get('rot', 0))
    elif t == 'spiral':
        m['c'] = rp(*m['c']); a0, sw = m['a']; m['a'] = [ra(a0), -sw]
    elif t == 'crescent':
        m['c'] = rp(*m['c']); m['rot'] = ra(m.get('rot', 0))
    elif t == 'repeat':
        m['m'] = [_reflect(x, axis, at) for x in m['m']]
        d = m['d']; m['d'] = [-d[0], d[1]] if axis == 'x' else [d[0], -d[1]]
    elif t == 'mirror':
        m['m'] = [_reflect(x, axis, at) for x in m['m']]
        if m['axis'] == axis:
            m['at'] = 2 * at - m['at']
    return m


def expand(members):
    """Flatten repeat/mirror into primitive members."""
    out = []
    for m in members:
        t = m['t']
        if t == 'repeat':
            for i in range(m['n']):
                out += expand([_translate(x, m['d'][0] * i, m['d'][1] * i) for x in m['m']])
        elif t == 'mirror':
            out += expand(m['m'])
            out += expand([_reflect(x, m['axis'], m['at']) for x in m['m']])
        else:
            out.append(m)
    return out


def count_members(enc):
    prim = expand(enc['members'])
    esc = expand(enc.get('escapes', []))
    from collections import Counter
    c = Counter(m['t'] for m in prim)
    return dict(primitives=len(prim), by_type=dict(c), escapes=len(esc),
                repeats=sum(1 for m in _walk(enc['members']) if m['t'] == 'repeat'),
                mirrors=sum(1 for m in _walk(enc['members']) if m['t'] == 'mirror'))


def _walk(members):
    for m in members:
        yield m
        if m['t'] in GROUPING:
            yield from _walk(m['m'])


# ---------- raster rendering ----------

def render(enc, height_px, pad=4, ink=0, bg=255, include_escapes=True):
    """Render to a grey uint8 image; unit height -> height_px pixels."""
    s = float(height_px)
    W = int(round(enc['aspect'] * s)) + 2 * pad; H = int(round(s)) + 2 * pad
    img = np.full((H, W), bg, np.uint8)
    SH = 4; F = 1 << SH
    def P(pt):
        return (int(round((pt[0] * s + pad) * F)), int(round((pt[1] * s + pad) * F)))
    def width(m):
        return max(1, int(round(m.get('w', enc['stroke']) * s)))
    members = expand(enc['members']) + (expand(enc.get('escapes', [])) if include_escapes else [])
    for m in members:
        t = m['t']; w = width(m)
        if t == 'line':
            cv2.line(img, P(m['p'][:2]), P(m['p'][2:]), ink, w, cv2.LINE_AA, SH)
        elif t in ('pline', 'tri'):
            pts = np.array([P(p) for p in m['p']], np.int32).reshape(-1, 1, 2)
            if m.get('fill', t == 'tri'):
                cv2.fillPoly(img, [pts], ink, cv2.LINE_AA, SH)
                cv2.polylines(img, [pts], True, ink, max(1, w // 2), cv2.LINE_AA, SH)
            else:
                cv2.polylines(img, [pts], bool(m.get('closed', False)), ink, w, cv2.LINE_AA, SH)
        elif t in ('bez', 'path'):
            pts = _bez_points(m['p'])
            pts = np.array([P(p) for p in pts], np.int32).reshape(-1, 1, 2)
            cv2.polylines(img, [pts], False, ink, w, cv2.LINE_AA, SH)
        elif t == 'arc':
            pts = _arc_points(m['c'], m['r'], m['a'][0], m['a'][1])
            pts = np.array([P(p) for p in pts], np.int32).reshape(-1, 1, 2)
            cv2.polylines(img, [pts], False, ink, w, cv2.LINE_AA, SH)
        elif t == 'ring':
            cv2.circle(img, P(m['c']), int(round(m['r'] * s * F)), ink, w, cv2.LINE_AA, SH)
        elif t == 'dot':
            cv2.circle(img, P(m['c']), int(round(m['r'] * s * F)), ink, -1, cv2.LINE_AA, SH)
        elif t == 'cross':
            c = m['c']; sz = m['s']; rot = m.get('rot', 0)
            if m.get('flared', True):
                for poly in _cross_polys(c, sz, True, rot):
                    pts = np.array([P(p) for p in poly], np.int32).reshape(-1, 1, 2)
                    cv2.fillPoly(img, [pts], ink, cv2.LINE_AA, SH)
                # stem through the centre so the arms join visibly
                for k in range(2):
                    th = math.radians(rot + 90 * k); u = np.array([math.cos(th), math.sin(th)])
                    a = np.array(c) - u * sz; b = np.array(c) + u * sz
                    cv2.line(img, P(a), P(b), ink, max(1, int(w * 0.8)), cv2.LINE_AA, SH)
            else:
                for k in range(2):
                    th = math.radians(rot + 90 * k); u = np.array([math.cos(th), math.sin(th)])
                    a = np.array(c) - u * sz; b = np.array(c) + u * sz
                    cv2.line(img, P(a), P(b), ink, w, cv2.LINE_AA, SH)
        elif t == 'spiral':
            pts = _spiral_points(m['c'], m['r'][0], m['r'][1], m['a'][0], m['a'][1])
            pts = np.array([P(p) for p in pts], np.int32).reshape(-1, 1, 2)
            cv2.polylines(img, [pts], False, ink, w, cv2.LINE_AA, SH)
        elif t == 'crescent':
            poly = _crescent_poly(m['c'], m['r'], m.get('k', 0.35), m.get('rot', 0), m.get('ri'))
            pts = np.array([P(p) for p in poly], np.int32).reshape(-1, 1, 2)
            cv2.fillPoly(img, [pts], ink, cv2.LINE_AA, SH)
        else:
            raise ValueError(f'unknown member type {t}')
    return img


# ---------- SVG export ----------

def to_svg(enc, scale=100.0, include_escapes=True):
    s = scale
    W = enc['aspect'] * s; H = 1.0 * s
    sw = enc['stroke'] * s
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-sw:.1f} {-sw:.1f} {W + 2 * sw:.1f} {H + 2 * sw:.1f}" width="{W + 2 * sw:.0f}" height="{H + 2 * sw:.0f}">',
             f'<g fill="none" stroke="#000" stroke-width="{sw:.2f}" stroke-linecap="round" stroke-linejoin="round">']
    def f(v):
        return f'{v * s:.2f}'
    def pts_d(pts, close=False):
        d = 'M ' + ' L '.join(f'{f(x)} {f(y)}' for x, y in pts)
        return d + (' Z' if close else '')
    members = expand(enc['members']) + (expand(enc.get('escapes', [])) if include_escapes else [])
    for m in members:
        t = m['t']; wa = f' stroke-width="{m["w"] * s:.2f}"' if 'w' in m else ''
        if t == 'line':
            x1, y1, x2, y2 = m['p']; parts.append(f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}"{wa}/>')
        elif t == 'pline':
            fill = ' fill="#000"' if m.get('fill') else ''
            parts.append(f'<path d="{pts_d(m["p"], m.get("closed") or m.get("fill"))}"{wa}{fill}/>')
        elif t == 'tri':
            fill = ' fill="#000"' if m.get('fill', True) else ''
            parts.append(f'<path d="{pts_d(m["p"], True)}"{fill}/>')
        elif t in ('bez', 'path'):
            p = m['p']; d = f'M {f(p[0][0])} {f(p[0][1])}'
            for i in range(1, len(p), 3):
                d += ' C ' + ' '.join(f'{f(x)} {f(y)}' for x, y in p[i:i + 3])
            parts.append(f'<path d="{d}"{wa}/>')
        elif t == 'arc':
            parts.append(f'<path d="{pts_d(_arc_points(m["c"], m["r"], m["a"][0], m["a"][1]))}"{wa}/>')
        elif t == 'ring':
            parts.append(f'<circle cx="{f(m["c"][0])}" cy="{f(m["c"][1])}" r="{f(m["r"])}"{wa}/>')
        elif t == 'dot':
            parts.append(f'<circle cx="{f(m["c"][0])}" cy="{f(m["c"][1])}" r="{f(m["r"])}" fill="#000" stroke="none"/>')
        elif t == 'cross':
            c = m['c']; sz = m['s']; rot = m.get('rot', 0)
            if m.get('flared', True):
                for poly in _cross_polys(c, sz, True, rot):
                    parts.append(f'<path d="{pts_d(poly, True)}" fill="#000"/>')
            for k in range(2):
                th = math.radians(rot + 90 * k); u = (math.cos(th), math.sin(th))
                parts.append(f'<line x1="{f(c[0] - u[0] * sz)}" y1="{f(c[1] - u[1] * sz)}" x2="{f(c[0] + u[0] * sz)}" y2="{f(c[1] + u[1] * sz)}"/>')
        elif t == 'spiral':
            parts.append(f'<path d="{pts_d(_spiral_points(m["c"], m["r"][0], m["r"][1], m["a"][0], m["a"][1]))}"{wa}/>')
        elif t == 'crescent':
            parts.append(f'<path d="{pts_d(_crescent_poly(m["c"], m["r"], m.get("k", 0.35), m.get("rot", 0), m.get("ri")), True)}" fill="#000"/>')
    parts.append('</g></svg>')
    return '\n'.join(parts)


if __name__ == '__main__':
    import sys
    enc = load(sys.argv[1])
    img = render(enc, 400)
    cv2.imwrite(sys.argv[2] if len(sys.argv) > 2 else 'out.png', img)
    print(count_members(enc))
