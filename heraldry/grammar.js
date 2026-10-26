/* The composition grammar: a seed gives a coat of arms, its blazon in English, a
   canonical key for lookup against the rolls, and a name.

   Structure is drawn from the rolls themselves: a development coat of the chosen roll
   is picked at random as a skeleton (its field division and lines, its ordinary, the
   number, class and arrangement of its charges, its chief, canton, bordure and label),
   then every charge is redrawn from the roll's charges of that class in that position
   and every tincture from the roll's tinctures given what it lies on (arms-data.js,
   built by tools/build_web_data.py). The rule of tincture is not imposed: the tables
   carry it, about 97 coats in 100 (STUDY.md 4.2); a tincture is never laid on itself.

   Rolls: 'zurich' (c. 1340) and 'grunenberg' (1483). */
(function (root) {
  'use strict';
  const H = root.Heraldry = root.Heraldry || {};

  function makeRng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  H.makeRng = makeRng;
  // independent streams for structure, tinctures and the name, so one does not shift the others
  const stream = (seed, k) => makeRng((Math.imul(seed >>> 0, 2654435761) ^ Math.imul(k, 2246822519)) >>> 0);

  function pick(rng, table, filter) {
    const entries = Object.entries(table).filter(([k]) => !filter || filter(k));
    let tot = 0; for (const [, w] of entries) tot += w;
    if (!tot) return null;
    let r = rng() * tot;
    for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
    return entries[entries.length - 1][0];
  }
  const METALS = new Set(['or', 'argent']), COLOURS = new Set(['gules', 'azure', 'sable', 'vert', 'purpure']);
  const NEUTRAL = new Set(['ermine', 'vair', 'proper']);
  const T_ALL = { argent: 30, or: 20, gules: 22, azure: 14, sable: 9, vert: 2, purpure: 0.3 };

  function tinctureOn(rng, D, role, under, avoid = []) {
    // a tincture for an element lying on 'under' (a tincture, or 'party' for a divided field)
    const table = D.tinctures.cond[`${role}|${under}`] || D.tinctures.cond[`${role}|party`] || null;
    const bad = k => avoid.includes(k) || k === under || k === 'mixed' || k === 'proper' || k === 'null';
    let t = table ? pick(rng, table, k => !bad(k)) : null;
    if (!t) {
      // nothing recorded for this pair: any tincture of the other class (rule of tincture)
      const other = METALS.has(under) ? COLOURS : COLOURS.has(under) ? METALS : null;
      t = pick(rng, T_ALL, k => !bad(k) && (!other || other.has(k)));
    }
    return t;
  }

  // With the imported art loaded, a beast is named in the attitude its drawing shows: the Fox-Davies
  // drawings give one attitude per species, so a bear rampant of the rolls becomes a bear passant, and so on.
  const DRAWN_AS = {
    'lion statant': 'lion passant', 'bear rampant': 'bear passant', 'bear statant': 'bear passant', 'wolf rampant': 'wolf passant', 'wolf statant': 'wolf passant',
    'talbot rampant': 'talbot passant', 'talbot statant': 'talbot passant', 'stag rampant': 'stag passant', 'stag statant': 'stag passant',
    'boar rampant': 'boar passant', 'boar statant': 'boar passant', 'bull rampant': 'bull passant', 'bull statant': 'bull passant', 'goat statant': 'goat passant',
    'horse passant': 'horse rampant', 'horse statant': 'horse rampant', 'unicorn passant': 'unicorn rampant', 'unicorn statant': 'unicorn rampant', 'griffin passant': 'griffin rampant',
  };
  function chargeFor(rng, D, slot, cls) {
    const t = D.charges[`${slot}|${cls}`] || D.charges[`main|${cls}`] || D.charges[`${slot}|*`] || D.charges['main|*'];
    const c = pick(rng, t);
    return H.ART && DRAWN_AS[c] && H.ART[DRAWN_AS[c]] ? DRAWN_AS[c] : c;
  }

  // one coat from a skeleton
  function fromSkeleton(rng, rt, D, sk) {
    const arms = { roll: null };
    // field
    const fk = sk.f.k;
    let fieldT;
    if (fk === 'plain' || fk === 'semy') fieldT = [pick(rt, D.tinctures.field, k => k !== 'mixed' && k !== 'proper')];
    else if (fk === 'tierced per fess' || fk === 'tierced per pale') fieldT = (pick(rt, D.tinctures.triples) || 'or/gules/argent').split('/');
    else if (fk === 'vair') fieldT = ['vair'];
    else fieldT = (pick(rt, D.tinctures.pairs, k => !/mixed|proper|null/.test(k) && k.split('/')[0] !== k.split('/')[1]) || 'argent/gules').split('/');
    const party = fieldT.length > 1;
    const under = party ? 'party' : fieldT[0];
    // only divisions drawn with a patterned line keep one, so the blazon never names a line that is not drawn
    const LINED = new Set(['per pale', 'per fess', 'per bend', 'per bend sinister', 'per chevron', 'barry', 'paly', 'bendy', 'bendy sinister', 'tierced per fess']);
    arms.field = { kind: fk === 'semy' ? 'plain' : fk, t: fieldT, line: LINED.has(fk) ? sk.f.l || null : null, n: sk.f.n || undefined };
    if (fk === 'semy') {
      const ch = chargeFor(rng, D, 'semy', sk.f.s || 'flower');
      arms.semy = { charge: ch, t: tinctureOn(rt, D, 'semy', fieldT[0]) };
    }
    // ordinary
    let ordT = null;
    if (sk.o) {
      const o = sk.o;
      arms.ordinary = { kind: o.k, n: o.n || undefined, line: o.l || null };
      if (o.p) {
        arms.ordinary.pattern = o.p;
        const pr = (pick(rt, D.tinctures.cond['ordpattern|*'] || { 'argent/gules': 1 }, k => !/mixed|proper/.test(k)) || 'argent/gules').split('/');
        arms.ordinary.t = pr[0]; arms.ordinary.t2 = pr[1]; ordT = pr[0];
      } else if (o.cch && party) { arms.ordinary.t = 'counterchanged'; }
      else { ordT = arms.ordinary.t = tinctureOn(rt, D, 'ord', under); }
      if (sk.on) {
        const ch = chargeFor(rng, D, 'on', sk.on.c);
        arms.charges = arms.charges || [];
        arms.charges.push({ charge: ch, n: sk.on.n, t: ordT ? tinctureOn(rt, D, 'on', ordT) : tinctureOn(rt, D, 'main', under), on: 'ordinary' });
      }
    }
    // principal charges
    if (sk.m) {
      const ch = chargeFor(rng, D, 'main', sk.m.c);
      const g = { charge: ch, n: sk.m.n };
      g.t = sk.m.cch && party ? 'counterchanged' : tinctureOn(rt, D, 'main', under, ordT ? [] : []);
      if (sk.m.arr === 'in pale') g.inPale = true;
      if (sk.m.arr === 'in fess') g.inFess = true;
      if (sk.m.iss && /^(lion|bear|wolf|stag|goat|horse|unicorn|griffin|bull|eagle)/.test(ch) && sk.m.n === 1) g.issuant = true;
      const kind = ch.split(' ')[0];
      const mods = D.mods || {};
      if ((kind === 'lion' || kind === 'eagle') && mods[`${kind}:n`]) {
        if (rng() < (mods[`${kind}:crowned`] || 0) / mods[`${kind}:n`]) g.crowned = g.t === 'or' ? 'gules' : 'or';
        if (kind === 'eagle' && rng() < (mods['eagle:doubleheaded'] || 0) / mods['eagle:n']) g.opts = { doubleheaded: true };
      }
      if (g.crowned) g.opts = Object.assign({}, g.opts, { crowned: true });
      if (sk.m.chg && g.t !== 'counterchanged' && /^(eagle|lion)/.test(ch)) {
        const sub = chargeFor(rng, D, 'charged', 'star');
        g.charged = { charge: sub, t: tinctureOn(rt, D, 'charged', g.t) };
      }
      if (sk.o && !sk.ar && !sk.on) arms.ordinary.over = true;   // "3 fleurs-de-lis & bend": the bend lies over them
      arms.charges = arms.charges || [];
      arms.charges.push(g);
    }
    if (sk.ar) {
      const ch = chargeFor(rng, D, 'around', sk.ar.c);
      arms.charges = arms.charges || [];
      arms.charges.push({ charge: ch, n: sk.ar.n, t: tinctureOn(rt, D, 'around', under, ordT ? [ordT] : []), around: true, where: sk.ar.w || 'betw' });
    }
    if (sk.c) {
      arms.chief = { t: tinctureOn(rt, D, 'chief', under), line: sk.c.l || null };
      if (sk.c.on) {
        const ch = chargeFor(rng, D, 'chief', sk.c.on.c);
        arms.chief.charges = { charge: ch, n: sk.c.on.n, t: tinctureOn(rt, D, 'chiefon', arms.chief.t) };
        if (sk.c.on.iss && /^(lion|bear|wolf|stag|goat|horse|unicorn|griffin|bull|eagle)/.test(ch)) { arms.chief.charges.issuant = true; arms.chief.charges.n = 1; }
      }
    }
    if (sk.cn) arms.canton = { kind: sk.cn, t: tinctureOn(rt, D, 'canton', under) };
    if (sk.b) {
      arms.bordure = { t: tinctureOn(rt, D, 'bordure', under) };
      if (sk.b.p === 'compony') { arms.bordure.pattern = 'compony'; arms.bordure.t2 = arms.bordure.t === 'argent' ? 'gules' : 'argent'; }
    }
    if (sk.lb) arms.label = { t: tinctureOn(rt, D, 'label', under) };
    return arms;
  }

  // A coat whose canonical key is that of a coat in the rolls is redrawn, its tinctures and charges
  // from the next streams, up to six times; if it still matches, it is kept and the page says who bore it.
  function sample(seed, rollName = 'grunenberg', opt = {}) {
    const tries = opt.redraw === false ? 1 : 7;
    let a = null, first = null;
    for (let k = 0; k < tries; k++) {
      a = sampleOnce(seed, rollName, k);
      if (!first) first = a;
      // a redraw must not change the rate of breaches of the rule of tincture: unless the first
      // draw broke the rule, a redraw that breaks it is passed over
      if (!H.alsoBorneBy(a).length && (k === 0 || !breaksRule(a) || breaksRule(first))) break;
    }
    return a;
  }
  function breaksRule(a) {
    if (a.quarters) a = a.quarters[0];
    const f = a.field.t; if (f.length !== 1) return false;
    const gs = a.charges || []; const main = gs.find(g => !g.on && !g.around); const o = a.ordinary;
    const first = o && o.t !== 'counterchanged' ? o.t : main ? main.t : null;
    if (!first) return false;
    return (METALS.has(f[0]) && METALS.has(first)) || (COLOURS.has(f[0]) && COLOURS.has(first));
  }
  H.breaksRule = breaksRule;
  function sampleOnce(seed, rollName, k) {
    const D = H.DATA[rollName];
    const rs = stream(seed, 1), rt = stream(seed, 2 + 10 * k), rc = stream(seed, 3 + 10 * k);
    const sks = D.skeletons;
    const choose = (pred) => {
      const pool = sks.filter(([s]) => pred(s)); let tot = 0; for (const [, w] of pool) tot += w;
      let r = rs() * tot; for (const [s, w] of pool) { r -= w; if (r <= 0) return s; } return pool[pool.length - 1][0];
    };
    const sk = choose(() => true);
    let arms;
    if (sk.q) {
      // a quartered coat: two coats of this roll, 1 and 4, 2 and 3
      const simple = s => !s.q && !s.b && !s.lb;
      const a = fromSkeleton(rc, rt, D, choose(simple)), b = fromSkeleton(rc, rt, D, choose(simple));
      arms = { field: { kind: 'quarterly', t: [a.field.t[0], b.field.t[0]] }, quarters: [a, b, b, a] };
    } else arms = fromSkeleton(rc, rt, D, sk);
    arms.roll = rollName; arms.seed = seed >>> 0; arms.draw = k;
    return arms;
  }
  H.sample = sample;

  // ---------- canonical key (mirrors canon() in tools/build_web_data.py) ----------
  function canonical(a) {
    if (a.quarters) return 'Q:' + canonical(a.quarters[0]) + '#' + canonical(a.quarters[1]);
    const p = [];
    const f = a.field;
    if (a.semy) p.push(`F:semy:${a.semy.charge}:${f.t.join(',')}:${a.semy.t}`);
    else p.push(`F:${f.kind}:${f.kind === 'plain' || /^per |quarterly|tierced/.test(f.kind) ? '' : (f.n || '')}:${f.line || ''}:${f.t.join(',')}`);
    const groups = a.charges || [];
    const on = groups.find(g => g.on === 'ordinary'), main = groups.find(g => !g.on && !g.around), ar = groups.find(g => g.around);
    if (a.ordinary) {
      const o = a.ordinary; const t = o.pattern ? `${o.t},${o.t2}` : o.t;
      p.push(`O:${o.kind}:${o.n || (/s$/.test(o.kind) ? '' : 1)}:${o.line || ''}:${o.pattern || ''}:${t}`);
      if (on) p.push(`ON:${on.charge}:${on.n}:${on.t}`);
    }
    if (main) p.push(`M:${main.charge}:${main.n}:${main.t}:${main.crowned ? 'cr' : ''}${main.opts && main.opts.doubleheaded ? 'dh' : ''}${main.issuant ? 'is' : ''}`);
    if (ar) p.push(`A:${ar.charge}:${ar.n}:${ar.t}`);
    if (a.chief) p.push(`CH:chief:${a.chief.line || ''}::${a.chief.t}` + (a.chief.charges ? `:${a.chief.charges.charge}:${a.chief.charges.n}:${a.chief.charges.t}` : ''));
    if (a.bordure) p.push(`BO:bordure:::${a.bordure.pattern ? a.bordure.t + ',' + a.bordure.t2 : a.bordure.t}`);
    if (a.label) p.push(`LA:label:::${a.label.t}`);
    if (a.canton) p.push(`CA:${a.canton.kind || 'canton'}:::${a.canton.t}`);
    return p.join('|');
  }
  H.canonical = canonical;
  H.alsoBorneBy = (arms) => {
    const key = canonical(arms); const out = [];
    for (const r of ['zurich', 'grunenberg']) for (const [name, num] of (H.DATA[r].index[key] || [])) out.push({ roll: r, name, num });
    return out;
  };
  // a legend from the rolls, tidied for display: "grauff von touggenburg her imm ..." -> "Grauff von Touggenburg"
  H.legend = (name) => {
    const w = name.replace(/[^a-zäöüß .']/gi, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 4);
    if (!w.length || w[0] === '..' || !w[0]) return null;
    return w.map((x, i) => /^(von|vom|zu|zum|zur|der|die|das|und|im|imm|ob|de|van|her)$/.test(x) && i ? x : x.charAt(0).toUpperCase() + x.slice(1)).join(' ');
  };

  // ---------- blazon ----------
  const NUM = ['', 'a', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const NUMN = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  const an = w => /^[aeiou]/.test(w) ? 'an' : 'a';
  const LINE_WORD = { indented: 'indented', dancetty: 'dancetty', wavy: 'wavy', embattled: 'embattled', engrailed: 'engrailed', invected: 'invected', nebuly: 'nebuly' };
  function chargeWords(g) {
    const info = H.CHARGE_INFO[g.charge] || { plural: g.charge + 's' };
    let noun = g.n > 1 ? info.plural : (info.sing || g.charge);
    if (g.charge === 'eagle' && g.opts && g.opts.doubleheaded) noun = g.n > 1 ? 'double-headed eagles' : 'double-headed eagle';
    if (g.issuant) noun = 'demi-' + noun.replace(/ (rampant|passant|statant)$/, '') + ' issuant';
    if (g.charge === 'antler') noun = g.n > 1 ? "stag's attires" : "stag's attire";
    const count = g.n > 1 ? NUMN[g.n] : an(noun);
    let s = `${count} ${noun}`;
    if (g.inPale && g.n > 1) s += ' in pale'; else if (g.inFess && g.n > 1) s += ' in fess';
    s += ' ' + (g.t === 'counterchanged' ? 'counterchanged' : g.t);
    if (g.crowned) s += ` crowned ${g.crowned}`;
    if (g.charged) { const cs = (H.CHARGE_INFO[g.charged.charge] || {}).sing || g.charged.charge; s += `, ${g.n > 1 ? 'each ' : ''}charged with ${an(cs)} ${cs} ${g.charged.t}`; }
    return s;
  }
  function fieldWords(a) {
    const f = a.field; const ln = f.line ? ' ' + LINE_WORD[f.line] : '';
    const two = `${f.t[0]} and ${f.t[1]}`;
    switch (f.kind) {
      case 'plain': return a.semy ? `${cap(f.t[0])} semy of ${H.CHARGE_INFO[a.semy.charge] ? H.CHARGE_INFO[a.semy.charge].plural : a.semy.charge} ${a.semy.t}` : cap(f.t[0]);
      case 'barry': return `Barry${ln} of ${NUMN[f.n || 6]} ${two}`;
      case 'paly': return `Paly${ln} of ${NUMN[f.n || 6]} ${two}`;
      case 'bendy': return `Bendy of ${NUMN[f.n || 6]} ${two}`;
      case 'bendy sinister': return `Bendy sinister of ${NUMN[f.n || 6]} ${two}`;
      case 'chequy': return `Chequy ${two}`;
      case 'lozengy': return `Lozengy ${two}`;
      case 'gyronny': return `Gyronny of eight ${two}`;
      case 'quarterly': return `Quarterly ${two}`;
      case 'tierced per fess': return `Tierced per fess ${f.t[0]}, ${f.t[1]} and ${f.t[2]}`;
      case 'tierced per pale': return `Tierced per pale ${f.t[0]}, ${f.t[1]} and ${f.t[2]}`;
      default: return `${cap(f.kind)}${ln} ${two}`;
    }
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function ordinaryWords(o) {
    const ln = o.line ? ' ' + LINE_WORD[o.line] : '';
    const t = o.pattern ? `${o.pattern === 'compony' ? 'compony' : 'chequy'} ${o.t} and ${o.t2}` : o.t;
    const k = o.kind;
    if (k === 'bars') return `${NUMN[o.n || 2]} bars${ln} ${t}`;
    if (k === 'pales') return `${NUMN[o.n || 3]} pallets${ln} ${t}`;
    if (k === 'bends') return `${NUMN[o.n || 2]} bendlets${ln} ${t}`;
    if (k === 'bends sinister') return `${NUMN[o.n || 2]} bendlets sinister${ln} ${t}`;
    if (k === 'chevrons') return `${NUMN[o.n || 2]} chevronels${ln} ${t}`;
    return `${an(k)} ${k}${ln} ${t}`;
  }
  function blazonCoat(a) {
    const parts = [fieldWords(a)];
    const groups = a.charges || [];
    const on = groups.find(g => g.on === 'ordinary'), main = groups.find(g => !g.on && !g.around), ar = groups.find(g => g.around);
    if (a.ordinary && !a.ordinary.over) {
      let s = ordinaryWords(a.ordinary);
      if (ar) s += ` between ${chargeWords(ar)}`;
      if (on) s = `on ${s} ${chargeWords(on)}`;
      parts.push(s);
      if (main) parts.push(chargeWords(main));
    } else {
      const WHERE = { 'in chf': ' in chief', 'in base': ' in base', dx: ' in dexter chief', sn: ' in sinister chief' };
      if (main) parts.push(chargeWords(main) + (ar ? `, accompanied by ${chargeWords(ar)}${WHERE[ar.where] || ''}` : ''));
      else if (ar) parts.push(chargeWords(ar));
      if (a.ordinary) parts.push(`overall ${ordinaryWords(a.ordinary)}` + (on ? ` charged with ${chargeWords(on)}` : ''));
    }
    if (a.chief) {
      const s = `a chief${a.chief.line ? ' ' + LINE_WORD[a.chief.line] : ''} ${a.chief.t}`;
      parts.push(a.chief.charges ? `on ${s} ${chargeWords(a.chief.charges)}` : s);
    }
    if (a.canton) parts.push(`${a.canton.kind === 'canton sinister' ? 'a sinister canton' : 'a canton'} ${a.canton.t}`);
    if (a.bordure) parts.push(a.bordure.pattern ? `a bordure compony ${a.bordure.t} and ${a.bordure.t2}` : `a bordure ${a.bordure.t}`);
    if (a.label) parts.push(`a label of three points ${a.label.t}`);
    return parts.join(', ');
  }
  function blazon(a) {
    if (a.quarters) return `Quarterly: 1st and 4th, ${blazonCoat(a.quarters[0])}; 2nd and 3rd, ${blazonCoat(a.quarters[1])}.`;
    return blazonCoat(a) + '.';
  }
  H.blazon = blazon;

  // ---------- names ----------
  // an order-2 letter model over the family names of the chosen roll; a name is kept only if it is
  // at least two edits from every name of both rolls and contains none of them of five letters or more
  const models = {};
  function model(roll) {
    if (models[roll]) return models[roll];
    const names = H.DATA[roll].names; const m = {};
    for (const nm of names) {
      const w = '^^' + nm + '$';
      for (let i = 2; i < w.length; i++) { const k = w.slice(i - 2, i); (m[k] = m[k] || {}); m[k][w[i]] = (m[k][w[i]] || 0) + 1; }
    }
    const all = new Set(H.DATA.zurich.names.concat(H.DATA.grunenberg.names));
    return (models[roll] = { m, all: [...all] });
  }
  function edit(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function nameFor(seed, roll = 'grunenberg') {
    const { m, all } = model(roll); const rng = stream(seed, 4);
    for (let tries = 0; tries < 200; tries++) {
      let w = '^^';
      while (w.length < 16) { const nx = pick(rng, m[w.slice(-2)] || { $: 1 }); if (nx === '$') break; w += nx; }
      const nm = w.slice(2);
      if (nm.length < 5 || nm.length > 12) continue;
      if (all.some(r => edit(r, nm) < 2 || (r.length >= 5 && nm.includes(r)))) continue;
      return nm.charAt(0).toUpperCase() + nm.slice(1);
    }
    return 'Ungenannt';
  }
  H.nameFor = nameFor;
})(typeof self !== 'undefined' ? self : globalThis);
