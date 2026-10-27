/* Renders a coat of arms (the tree made by grammar.js) as SVG, in two styles:

   engraved  black ink on white, tinctures in Petra Sancta's hatching (1638), as on
             Rolland's plates (1903-1926): hatch pitch 2.0 and line 0.65 per 100 of
             shield width, dots for or on a 3.4 pitch, outline 1.0 (measured, STUDY.md 5.2);
             sable charges are solid black, as on Rolland's plates and the Italian page.
   colour    flat tinctures with thin dark outlines, as on the Commons charts.

   All geometry is mapped point by point (no SVG transforms), so hatching keeps
   its pitch and direction in the shield's frame on every charge and quarter.

   Both styles use the same shield, and both are printed: an SVG filter roughens
   every edge by about a tenth of a hatching line, mottles the ink so solid black
   and flat colour vary by a few per cent, and lays a faint grain on the paper.
   It is meant to be seen only from close by. */
(function (root) {
  'use strict';
  const H = root.Heraldry = root.Heraldry || {};
  const P = H.P;

  const COLOURS = {
    or: '#f2c230', argent: '#ffffff', gules: '#cf2a2f', azure: '#1f63ae', sable: '#232323', vert: '#2f8f46', purpure: '#7b3f8f',
    ermine: '#ffffff', vair: '#ffffff', proper: '#9a6b3a',
  };
  const DARK = '#1c1c1c';
  H.COLOURS = COLOURS;

  const ENG = { pitch: 2.0, line: 0.62, dot: 3.4, dotR: 0.52, outline: 1.0, partLine: 0.55, chargeLine: 0.55, detail: 0.42 };

  function patternDefs(style, id) {
    if (style !== 'engraved') {
      return `<pattern id="${id}-ermine" patternUnits="userSpaceOnUse" width="12" height="14"><rect width="12" height="14" fill="#fff"/>${ermineSpot(6, 3.5, 3.2)}${ermineSpot(0, 10.5, 3.2)}${ermineSpot(12, 10.5, 3.2)}</pattern>`
        + `<pattern id="${id}-vair" patternUnits="userSpaceOnUse" width="16" height="16"><rect width="16" height="16" fill="${COLOURS.azure}"/>${vairBells(16, '#fff')}</pattern>`;
    }
    const p = ENG.pitch, w = ENG.line;
    return [
      `<pattern id="${id}-gules" patternUnits="userSpaceOnUse" width="${p}" height="${p}"><rect width="${p}" height="${p}" fill="#fff"/><rect x="${(p - w) / 2}" width="${w}" height="${p}" fill="#000"/></pattern>`,
      `<pattern id="${id}-azure" patternUnits="userSpaceOnUse" width="${p}" height="${p}"><rect width="${p}" height="${p}" fill="#fff"/><rect y="${(p - w) / 2}" width="${p}" height="${w}" fill="#000"/></pattern>`,
      `<pattern id="${id}-sable" patternUnits="userSpaceOnUse" width="${p}" height="${p}"><rect width="${p}" height="${p}" fill="#fff"/><rect x="${(p - w) / 2}" width="${w}" height="${p}" fill="#000"/><rect y="${(p - w) / 2}" width="${p}" height="${w}" fill="#000"/></pattern>`,
      `<pattern id="${id}-vert" patternUnits="userSpaceOnUse" width="${p * 1.41}" height="${p * 1.41}" patternTransform="rotate(-45)"><rect width="${p * 1.41}" height="${p * 1.41}" fill="#fff"/><rect x="${(p * 1.41 - w) / 2}" width="${w}" height="${p * 1.41}" fill="#000"/></pattern>`,
      `<pattern id="${id}-purpure" patternUnits="userSpaceOnUse" width="${p * 1.41}" height="${p * 1.41}" patternTransform="rotate(45)"><rect width="${p * 1.41}" height="${p * 1.41}" fill="#fff"/><rect x="${(p * 1.41 - w) / 2}" width="${w}" height="${p * 1.41}" fill="#000"/></pattern>`,
      `<pattern id="${id}-or" patternUnits="userSpaceOnUse" width="${ENG.dot}" height="${ENG.dot * 1.732}"><rect width="${ENG.dot}" height="${ENG.dot * 1.732}" fill="#fff"/><circle cx="${ENG.dot / 2}" cy="${ENG.dot * 0.433}" r="${ENG.dotR}" fill="#000"/><circle cx="0" cy="${ENG.dot * 1.299}" r="${ENG.dotR}" fill="#000"/><circle cx="${ENG.dot}" cy="${ENG.dot * 1.299}" r="${ENG.dotR}" fill="#000"/></pattern>`,
      `<pattern id="${id}-ermine" patternUnits="userSpaceOnUse" width="12" height="14"><rect width="12" height="14" fill="#fff"/>${ermineSpot(6, 3.5, 3.2)}${ermineSpot(0, 10.5, 3.2)}${ermineSpot(12, 10.5, 3.2)}</pattern>`,
      `<pattern id="${id}-vair" patternUnits="userSpaceOnUse" width="16" height="16"><rect width="16" height="16" fill="url(#${id}-azure)"/>${vairBells(16, '#fff', '#000')}</pattern>`,
      `<pattern id="${id}-proper" patternUnits="userSpaceOnUse" width="${p * 2}" height="${p * 2}"><rect width="${p * 2}" height="${p * 2}" fill="#fff"/><circle cx="${p}" cy="${p}" r="0.35" fill="#000"/></pattern>`,
    ].join('');
  }
  function ermineSpot(x, y, s) {
    const m = [s, 0, 0, s, x - s / 2, y - s / 2];
    const sp = H.CHARGES['ermine spot']();
    return sp.parts.map(pt => `<path d="${P.toD(P.map(pt.path, m))}" fill="#000"/>`).join('');
  }
  function vairBells(S, fill, stroke) {
    // two rows of bells per tile, the second row offset by half a bell
    const bell = (x, y, w, h) => `M${x} ${y + h}L${x} ${y + h * 0.45}L${x + w * 0.25} ${y + h * 0.2}L${x + w * 0.25} ${y}L${x + w * 0.75} ${y}L${x + w * 0.75} ${y + h * 0.2}L${x + w} ${y + h * 0.45}L${x + w} ${y + h}Z`;
    const w = S / 2, h = S / 2;
    const d = [bell(0, 0, w, h), bell(w, 0, w, h), bell(-w / 2, h, w, h), bell(w / 2, h, w, h), bell(w * 1.5, h, w, h)].join('');
    return `<path d="${d}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="0.4"` : ''}/>`;
  }

  // the paint for a tincture
  function paint(t, style, id, isCharge) {
    if (style === 'engraved') {
      if (t === 'argent') return '#fff';
      if (t === 'sable' && isCharge) return '#000';
      return `url(#${id}-${t})`;
    }
    if (t === 'ermine' || t === 'vair') return `url(#${id}-${t})`;
    return COLOURS[t] || '#888';
  }

  // ---------- a pen that maps every path through the current matrix ----------
  class Pen {
    constructor(style, id) { this.style = style; this.id = id; this.out = []; this.M = P.mat.id(); this.clipN = 0; this.defs = []; }
    d(path) { return P.toD(P.map(path, this.M)); }
    fill(path, t, opt = {}) {
      const f = paint(t, this.style, this.id, opt.charge);
      this.out.push(`<path d="${this.d(path)}" fill="${f}"${opt.evenodd ? ' fill-rule="evenodd"' : ''}${opt.clip ? ` clip-path="url(#${opt.clip})"` : ''}/>`);
    }
    stroke(pts, w, opt = {}) {
      const path = Array.isArray(pts[0]) && typeof pts[0][0] === 'number' ? P.poly(pts, !!opt.closed) : pts;
      const col = opt.color || (this.style === 'engraved' ? '#000' : DARK);
      this.out.push(`<path d="${this.d(path)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"${opt.clip ? ` clip-path="url(#${opt.clip})"` : ''}${opt.opacity ? ` stroke-opacity="${opt.opacity}"` : ''}/>`);
    }
    clip(path) {
      const cid = `${this.id}-c${this.clipN++}`;
      this.defs.push(`<clipPath id="${cid}"><path d="${this.d(path)}"${''}/></clipPath>`);
      return cid;
    }
    open(clip) { this.out.push(`<g clip-path="url(#${clip})">`); }
    close() { this.out.push('</g>'); }
  }

  // ---------- drawing a charge into a slot ----------
  function chargeMatrix(ch, slot, fit = 1) {
    const all = P.concat(...ch.parts.map(p => p.path));
    const b = P.bounds(all); const w = b[2] - b[0], h = b[3] - b[1];
    const s = slot.s * fit / Math.max(w, h);
    let M = P.mat.tr(-(b[0] + b[2]) / 2, -(b[1] + b[3]) / 2);
    M = P.mat.mul(P.mat.sc(slot.flip ? -s : s, s), M);
    if (slot.rot) M = P.mat.mul(P.mat.rot(slot.rot), M);
    M = P.mat.mul(P.mat.tr(slot.c[0], slot.c[1]), M);
    return M;
  }
  function artFor(spec) {
    if (!H.ART) return null;
    const o = spec.opts || {};
    if (spec.charge === 'eagle' && o.doubleheaded) return H.ART['eagle doubleheaded'] || null;
    return H.ART[spec.charge] || null;
  }
  // an imported drawing as a charge: its layers, recoloured by role, keep the artist's order
  function artCharge(art) {
    const parts = art.layers.map(L => ({ path: L.d, role: L.role || 'ink', art: L }));
    return { parts, art };
  }
  function drawCharge(pen, spec, slot, tinct, clip) {
    const art = artFor(spec);
    const builder = H.CHARGES[spec.charge];
    if (!builder && !art) return;
    const ch = art ? artCharge(art) : builder(spec.opts || {});
    const saved = pen.M;
    let CM = chargeMatrix(ch, slot, spec.fit || 1);
    if (spec.issuant) {
      // a demi-beast: the upper 56% of the figure, its cut lying on the slot's centre line
      const all = P.concat(...ch.parts.map(p => p.path)); const b = P.bounds(all);
      const cutY = b[1] + 0.56 * (b[3] - b[1]);
      const s = slot.s / Math.max(b[2] - b[0], b[3] - b[1]);
      CM = P.mat.mul(P.mat.tr(slot.c[0], slot.c[1]), P.mat.mul(P.mat.sc(s), P.mat.tr(-(b[0] + b[2]) / 2, -cutY)));
      pen.M = P.mat.mul(saved, CM);
      const cc = pen.clip(P.poly([[b[0] - 1, b[1] - 1], [b[2] + 1, b[1] - 1], [b[2] + 1, cutY], [b[0] - 1, cutY]]));
      pen.M = saved;
      clip = clip ? clip : cc;
      if (clip !== cc) { pen.out.push(`<g clip-path="url(#${cc})">`); }
      pen.M = P.mat.mul(saved, CM);
      drawParts(pen, ch, spec, tinct, clip);
      if (clip !== cc) pen.out.push('</g>');
      pen.M = saved;
      return;
    }
    pen.M = P.mat.mul(saved, CM);
    drawParts(pen, ch, spec, tinct, clip);
    pen.M = saved;
    if (spec.charged) {
      // a small charge on the body of this one, at the centre of its outline
      const all = P.concat(...ch.parts.filter(p => p.role === 'body').map(p => p.path)); const b = P.bounds(all);
      const cx = (b[0] + b[2]) / 2, cy = b[1] + (b[3] - b[1]) * (/eagle/.test(spec.charge) ? 0.52 : 0.5);
      const c = P.mapPt([cx, cy], CM);
      drawCharge(pen, { charge: spec.charged.charge }, { c, s: slot.s * (/eagle/.test(spec.charge) ? 0.22 : 0.3) }, spec.charged.t, clip);
    }
  }
  function drawParts(pen, ch, spec, tinct, clip) {
    if (ch.art) return drawArt(pen, ch, spec, tinct, clip);
    const eng = pen.style === 'engraved';
    const olw = eng ? ENG.chargeLine * 2 : 0.9;
    const roleT = role => (role === 'arms' && spec.armed) || (role === 'tongue' && (spec.langued || spec.armed)) || (role === 'crown' && spec.crowned) || tinct;
    const cl = clip ? { clip } : {};
    // outline under, then fills: the union of the parts keeps only its outer edge
    for (const p of ch.parts) pen.out.push(`<path d="${pen.d(p.path)}" fill="none" stroke="${eng ? '#000' : DARK}" stroke-width="${olw}" stroke-linejoin="round"${clip ? ` clip-path="url(#${clip})"` : ''}/>`);
    for (const p of ch.parts) {
      const t = roleT(p.role);
      if (eng && t !== 'argent' && !(t === 'sable')) pen.fill(p.path, 'argent', Object.assign({ charge: true, evenodd: true }, cl));
      pen.fill(p.path, t, Object.assign({ charge: true, evenodd: true }, cl));
    }
    const dark = (eng && tinct === 'sable') || (!eng && tinct === 'sable');
    for (const dt of ch.details || []) {
      const col = dark ? (eng ? '#fff' : '#9a9a9a') : (eng ? '#000' : DARK);
      if (dt.fill) pen.out.push(`<path d="${pen.d(dt.path)}" fill="${col}"${clip ? ` clip-path="url(#${clip})"` : ''}/>`);
      else pen.stroke(dt.path, (eng ? ENG.detail : 0.4) * (dt.w || 1), Object.assign({ color: col }, cl));
    }
  }

  function drawArt(pen, ch, spec, tinct, clip) {
    const eng = pen.style === 'engraved';
    const k = Math.sqrt(Math.abs(pen.M[0] * pen.M[3] - pen.M[1] * pen.M[2]));
    const roleT = role => (role === 'arms' && spec.armed) || (role === 'tongue' && (spec.langued || spec.armed)) || (role === 'crown' && spec.crowned) || tinct;
    const cl = clip ? ` clip-path="url(#${clip})"` : '';
    let seenBody = false;
    const sable = tinct === 'sable';
    for (const p of ch.parts) {
      const L = p.art; const d = pen.d(L.d); const fr = L.evenodd ? ' fill-rule="evenodd"' : '';
      if (L.role === 'body' || L.role === 'arms' || L.role === 'tongue' || L.role === 'crown') {
        const t = L.role === 'body' ? tinct : roleT(L.role);
        if (L.role === 'body') seenBody = true;
        if (eng && t !== 'argent' && t !== 'sable') pen.out.push(`<path d="${d}" fill="#fff"${fr}${cl}/>`);
        pen.out.push(`<path d="${d}" fill="${paint(t, pen.style, pen.id, true)}"${fr}${cl}/>`);
      } else if (L.role === 'white') {
        pen.out.push(`<path d="${d}" fill="#fff"${fr}${cl}/>`);
      } else if (L.role === 'ink') {
        // ink drawn over a sable body would vanish: draw it in white (engraved) or grey (colour)
        const col = sable && seenBody ? (eng ? '#fff' : '#8a8a8a') : (eng ? '#000' : DARK);
        pen.out.push(`<path d="${d}" fill="${col}"${fr}${cl}/>`);
      }
      if (L.stroke) {
        const col = sable && seenBody && L.role !== 'body' ? (eng ? '#fff' : '#8a8a8a') : (eng ? '#000' : DARK);
        pen.out.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="${(L.stroke * k).toFixed(3)}" stroke-linejoin="round"${cl}/>`);
      }
    }
    if (spec.crowned && ch.art.crown) {
      // a crown of our own on each of the artist's heads, where the import spec put it
      const saved = pen.M;
      for (const [x, y, s, r] of ch.art.crown) {
        const c = P.mapPt([x, y], saved);
        pen.M = P.mat.id();
        drawCharge(pen, { charge: 'crown' }, { c, s: s * k, rot: r || 0 }, spec.crowned, clip);
      }
      pen.M = saved;
    }
  }

  // ---------- the field, ordinaries, charges ----------
  // the bordure, over the edge of the shield
  function drawBordure(pen, arms, sh, b, plw) {
    pen.fill(b.path, arms.bordure.t, { evenodd: true });
    if (arms.bordure.pattern === 'compony') {
      // alternate segments of the bordure in the second tincture
      const outer = sh.poly, inner = b.inner, N = outer.length, seg = 16;
      for (let k = 1; k < seg; k += 2) {
        const i0 = Math.floor(k * N / seg), i1 = Math.floor((k + 1) * N / seg);
        const q = outer.slice(i0, i1 + 1).concat(inner.slice(i0, i1 + 1).reverse());
        pen.fill(P.poly(q), arms.bordure.t2);
        pen.stroke([outer[i0], inner[i0]], plw); pen.stroke([outer[Math.min(i1, N - 1)], inner[Math.min(i1, N - 1)]], plw);
      }
    }
    for (const l of b.lines) pen.stroke(l, plw);
    if (arms.bordure.charges) for (const s of b.slots(arms.bordure.charges.n)) drawCharge(pen, arms.bordure.charges, s, arms.bordure.charges.t);
  }

  function drawCoat(pen, arms, sh) {
    const eng = pen.style === 'engraved';
    const plw = eng ? ENG.partLine : 0.45;
    if (arms.bordure) {
      // Within a bordure the coat is a whole shield of its own: the bordure's inner outline is the shield
      // under a map, so field, ordinary, charges, chief, canton and label are drawn through that map and laid
      // out as on a shield without one. The field's first tincture lies under the join, so no gap shows.
      const b = H.ordinary('bordure', sh);
      const outer = pen.clip(sh.path);
      pen.open(outer);
      pen.fill(sh.path, arms.field.t[0]);
      const saved = pen.M;
      pen.M = P.mat.mul(saved, b.innerMat);
      drawCoat(pen, Object.assign({}, arms, { bordure: null }), sh);
      pen.M = saved;
      drawBordure(pen, arms, sh, b, plw);
      pen.close();
      return;
    }
    const field = arms.field;
    const shClip = pen.clip(sh.path);
    pen.open(shClip);
    // field
    let div = null;
    if (arms.quarters) {
      const q = arms.quarters; const [fx, fy] = sh.fess;
      const boxes = [[0, 0, fx, fy], [fx, 0, 100, fy], [0, fy, fx, 120], [fx, fy, 100, 120]];
      boxes.forEach((bx, i) => {
        // each quarter is a rectangular sub-shield as wide as the quarter and as high, uniformly scaled,
        // so its field, partitions and ordinaries reach the quarter's edges
        const saved = pen.M;
        const k = (bx[2] - bx[0]) / 100, subH = (bx[3] - bx[1]) / k;
        const bc = pen.clip(P.poly([[bx[0], bx[1]], [bx[2], bx[1]], [bx[2], bx[3]], [bx[0], bx[3]]]));
        pen.out.push(`<g clip-path="url(#${bc})">`);
        pen.M = P.mat.mul(saved, P.mat.mul(P.mat.tr(bx[0], bx[1]), P.mat.sc(k)));
        drawCoat(pen, q[i], H.rectShield(subH));
        pen.out.push('</g>');
        pen.M = saved;
      });
      pen.stroke([[sh.fess[0], -5], [sh.fess[0], 125]], plw); pen.stroke([[-5, sh.fess[1]], [105, sh.fess[1]]], plw);
    } else {
      div = H.division(field.kind, sh, { line: field.line, n: field.n });
      // a field of counted pieces under a chief (barry of six, tierced per fess) is laid out in the space below
      // the chief, so every piece shows and the drawing reads back to its blazon
      if (arms.chief && H.COUNTED && H.COUNTED.test(field.kind)) {
        const SH = sh.H || 120, top = H.ordinary('chief', sh, { line: arms.chief.line }).h, k = (SH - top) / SH;
        const sq = q => [q[0], top + q[1] * k];
        div = Object.assign({}, div, { regions: div.regions.map(r => Object.assign({}, r, { poly: r.poly.map(sq) })), lines: div.lines.map(l => l.map(sq)) });
      }
      div.regions.forEach((r, i) => pen.fill(P.poly(r.poly), field.t[r.t]));
      for (const l of div.lines) pen.stroke(l, plw);
    }
    // semy
    if (arms.semy) for (const s of H.semy(sh, 11)) drawCharge(pen, { charge: arms.semy.charge }, s, arms.semy.t);
    // ordinary (unless it lies over the charges)
    const ao = arms.ordinary;
    const ord = ao ? H.ordinary(ao.kind, sh, { line: ao.line, n: ao.n }) : null;
    const paintOrd = () => {
      if (ao.t === 'counterchanged' && div && div.regions.length > 1) {
        div.regions.forEach((r, i) => {
          const rc = pen.clip(i === 0 ? P.poly([[-20, -20], [120, -20], [120, 140], [-20, 140]]) : P.poly(r.poly));
          pen.out.push(`<g clip-path="url(#${rc})">`); drawOrdinary(pen, ord, field.t[1 - r.t], plw); pen.out.push('</g>');
        });
      } else drawOrdinary(pen, ord, ao.t, plw);
      if (ao.pattern) {
        const oc = pen.clip(ord.path || P.concat(...(ord.polys || [ord.poly]).map(q => P.poly(q))));
        for (const q of H.ordinaryChecks(ao.kind, sh, ao.pattern === 'compony' ? 1 : 2)) pen.fill(P.poly(q), ao.t2, { clip: oc });
        for (const l of ord.lines || []) pen.stroke(l, plw);
      }
    };
    if (ord && !ao.over) paintOrd();
    // charges: on the ordinary, around it, or on the field
    const chief = arms.chief ? H.ordinary('chief', sh, { line: arms.chief.line }) : null;
    const gs = arms.charges || [];
    const gMain = gs.find(g => !g.on && !g.around), gAr = gs.find(g => g.around);
    // a principal charge accompanied by others, with no ordinary between them: the principal one gives way
    const flank = gMain && gAr && (!ord || ao.over) ? H.flankLayout(sh, gMain, gAr, { chief: !!arms.chief, label: !!arms.label, div: field.kind }) : null;
    const slotsFor = (g) => {
      if (flank && g === gMain) return flank.main;
      if (flank && g === gAr) return flank.around;
      if (g.on === 'ordinary' && ord && ord.slots) return ord.slots(g.n);
      if (g.issuant) return [{ c: [sh.fess[0], div && /per fess|tierced per fess/.test(field.kind) ? sh.fess[1] : sh.fess[1] + 26], s: 92 }];
      return H.arrangement(g.n, sh, { ord: ord && !ao.over && (g.around || g.on !== 'ordinary') ? ord : null, chief: !!arms.chief, inPale: g.inPale, inFess: g.inFess, div: field.kind });
    };
    const slotMap = new Map(gs.map(g => [g, slotsFor(g)]));
    if (arms.canton) {
      // A canton takes the dexter chief (below a chief, if there is one). The charges on the field are drawn
      // together toward a point in sinister base, by the least amount that clears every box of the canton,
      // so they keep their arrangement and do not run into each other.
      const cb = (chief ? chief.h : 0) + 36, A = [64, (sh.H || 120) * 0.87];
      const free = (f) => [...slotMap].every(([g, ss]) => g.on === 'ordinary' || ss.every(sl => {
        const x = A[0] + (sl.c[0] - A[0]) * f, y = A[1] + (sl.c[1] - A[1]) * f, s = sl.s * f;
        return x - s / 2 >= 36 || y - s / 2 >= cb;
      }));
      let f = 1; while (f > 0.45 && !free(f)) f -= 0.02;
      if (f < 1) for (const [g, ss] of slotMap) if (g.on !== 'ordinary') slotMap.set(g, ss.map(sl => Object.assign({}, sl, { c: [A[0] + (sl.c[0] - A[0]) * f, A[1] + (sl.c[1] - A[1]) * f], s: sl.s * f })));
    }
    const drawGroup = (g) => {
      let slots = slotMap.get(g);
      if (ord && (ord.kind === 'bend' || ord.kind === 'bend sinister') && g.on === 'ordinary') {
        const beastly = /lion|bear|boar|wolf|talbot|stag|horse|goat|eagle|martlet|griffin|unicorn|bull/.test(g.charge);
        if (beastly) slots = slots.map(s => Object.assign({}, s, { rot: 0 }));
      }
      for (const s of slots) {
        if (g.t === 'counterchanged' && div && div.regions.length > 1) {
          // each part of the charge takes the other tincture of the region it lies in
          div.regions.forEach((r, i) => {
            const rc = pen.clip(i === 0 ? P.poly([[-20, -20], [120, -20], [120, 140], [-20, 140]]) : P.poly(r.poly));
            drawCharge(pen, Object.assign({}, g, { charged: null }), s, field.t[1 - r.t], rc);
          });
        } else drawCharge(pen, g, s, g.t);
      }
    };
    // charges laid on an ordinary that lies over the others are drawn after it
    const over = !!(ao && ao.over);
    for (const g of gs) if (!(over && g.on === 'ordinary')) drawGroup(g);
    if (ord && over) { paintOrd(); for (const g of gs) if (g.on === 'ordinary') drawGroup(g); }
    const drawCanton = () => {
      const cn = H.ordinary(arms.canton.kind || 'canton', sh, { top: chief ? chief.h : 0 }); drawOrdinary(pen, cn, arms.canton.t, plw);
      if (arms.canton.charges) drawCharge(pen, arms.canton.charges, cn.slots(1)[0], arms.canton.charges.t);
    };
    if (arms.canton && chief) drawCanton();
    // chief
    if (chief) {
      drawOrdinary(pen, chief, arms.chief.t, plw);
      if (arms.chief.charges) {
        const cs = arms.chief.charges;
        if (cs.issuant) {
          // a demi-beast rising from the base of the chief, clipped to the chief
          const cc = pen.clip(P.poly([[-5, -5], [105, -5], [105, chief.h], [-5, chief.h]]));
          drawCharge(pen, cs, { c: [50, chief.h + 1], s: 64 }, cs.t, cc);
        } else for (const s of chief.slots(cs.n)) drawCharge(pen, cs, s, cs.t);
      }
    }
    // canton
    if (arms.canton && !chief) drawCanton();
    // label (a brisure)
    if (arms.label) { const lb = H.ordinary('label', sh); for (const p of lb.polys) pen.fill(P.poly(p), arms.label.t); for (const l of lb.lines) pen.stroke(l, plw); }
    pen.close();
  }

  function drawOrdinary(pen, ord, t, plw) {
    if (ord.poly) pen.fill(P.poly(ord.poly), t);
    if (ord.polys) for (const p of ord.polys) pen.fill(P.poly(p), t);
    if (ord.path) pen.fill(ord.path, t, { evenodd: true });
    if (ord.kind === 'cross' || ord.kind === 'saltire') {
      // outline the union, not the overlap
      if (ord.kind === 'saltire') {
        const stroked = ord.polys.map(p => P.poly(p));
        for (const s of stroked) pen.out.push(`<path d="${pen.d(s)}" fill="none" stroke="${pen.style === 'engraved' ? '#000' : DARK}" stroke-width="${plw}"/>`);
        for (const p of ord.polys) pen.fill(P.poly(p), t);
        return;
      }
    }
    for (const l of ord.lines || []) pen.stroke(l, plw);
  }

  // ---------- print ----------
  // In shield units (100 wide). Fine noise, about one cycle per unit, moves edges by up to a sixth of a unit;
  // a slow noise, about five units across, lightens the ink by up to five per cent in patches; a fine dark
  // speckle of at most five per cent greys the paper here and there. The seeds follow the coat, so it prints the same way each time.
  function printFilter(id, seed, style) {
    const s = (seed % 9973) + 1;
    const rag = style === 'engraved' ? 0.32 : 0.4;
    return `<filter id="${id}-print" filterUnits="userSpaceOnUse" x="-4" y="-4" width="108" height="128" color-interpolation-filters="sRGB">`
      + `<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="${s}" result="fine"/>`
      + `<feDisplacementMap in="SourceGraphic" in2="fine" scale="${rag}" xChannelSelector="R" yChannelSelector="G" result="ragged"/>`
      + `<feTurbulence type="fractalNoise" baseFrequency="0.2" numOctaves="3" seed="${s + 7}" result="slow"/>`
      + `<feColorMatrix in="slow" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.22 0 0 0 -0.11" result="veil"/>`
      + `<feComposite in="veil" in2="ragged" operator="atop" result="inked"/>`
      + `<feTurbulence type="fractalNoise" baseFrequency="2.4" numOctaves="1" seed="${s + 13}" result="grain"/>`
      + `<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.3 0 0 0 -0.18" result="speck"/>`
      + `<feComposite in="speck" in2="inked" operator="atop"/>`
      + `</filter>`;
  }

  // ---------- public ----------
  let uid = 0;
  function renderSVG(arms, style = 'engraved', opt = {}) {
    const id = opt.id || `a${(uid++).toString(36)}`;
    // one shield shape for both styles, the engraved plates' French shield
    const shKind = arms.shield || opt.shield || 'french';
    const sh = H.shield(shKind);
    const pen = new Pen(style, id);
    drawCoat(pen, arms, sh);
    const eng = style === 'engraved';
    pen.out.push(`<path d="${P.toD(sh.path)}" fill="none" stroke="${eng ? '#000' : DARK}" stroke-width="${eng ? ENG.outline : 0.9}" stroke-linejoin="round"/>`);
    const size = opt.size ? ` width="${opt.size}" height="${Math.round(opt.size * 1.2)}"` : '';
    const print = opt.print !== false;
    const body = print ? `<g filter="url(#${id}-print)">${pen.out.join('')}</g>` : pen.out.join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 104 124"${size}${opt.title ? ` role="img" aria-label="${opt.title.replace(/"/g, '&quot;')}"` : ''}><defs>${patternDefs(style, id)}${pen.defs.join('')}${print ? printFilter(id, arms.seed || 1, style) : ''}</defs>${body}</svg>`;
  }
  H.renderSVG = renderSVG;
  H.drawChargeSVG = function (name, style = 'engraved', t = 'gules', opts = {}) {
    // one charge on its own, for the test sheet
    const id = `c${(uid++).toString(36)}`;
    const pen = new Pen(style, id);
    drawCharge(pen, Object.assign({ charge: name, opts }, opts.spec || {}), { c: [50, 50], s: 86 }, t);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${patternDefs(style, id)}${pen.defs.join('')}</defs>${pen.out.join('')}</svg>`;
  };
})(typeof self !== 'undefined' ? self : globalThis);
