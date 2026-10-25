/* What the book would say of the spirit: a description in the English of the
   printed Goetia, by a fixed slot grammar.

   The frame and its odds come from the 72 real entries (tools/goetia_slots,
   data/goetia_slots.json, copied into SIGIL_DATA.lore by build_web_data.py):
   which ranks and how often two, the adjectives on a rank, the legions, how
   often an entry names a location, a nature, a manner, conditions, a former
   order, how many appearances and offices it lists. The fillers come from a
   corpus written by a language model in that English (tools/build_lore.py),
   served as 128 small encoded shards in lore/; a seal's seed picks one shard,
   so a visit fetches a few kilobytes, not the corpus.

   Nothing here depends on the drawing: the seal and its text share only the
   seed and the name. */
(function (root) {
  'use strict';

  const SHARDS = 128, KEY = 0x5A1E6E7D;
  const cache = {};

  function keystream(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) >>> 24;
    };
  }

  const shardOf = seed => (Math.imul((seed ^ 0x10BE5EED) >>> 0, 2654435761) >>> 0) % SHARDS;

  function decode(text, index) {
    const bin = atob(text.trim()), ks = keystream((KEY ^ index) >>> 0), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) ^ ks();
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function loadShard(index, base = '') {
    if (!cache[index]) {
      cache[index] = fetch(`${base}lore/${index.toString(16).padStart(2, '0')}.dat`)
        .then(r => { if (!r.ok) throw new Error('lore shard ' + index + ': ' + r.status); return r.text(); })
        .then(t => decode(t, index).slots);
    }
    return cache[index];
  }

  // ---------- the grammar ----------

  const title = s => s.charAt(0) + s.slice(1).toLowerCase();
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  function weighted(rng, pairs) {   // [[value, weight], ...]
    let x = rng.random() * pairs.reduce((a, [, w]) => a + w, 0);
    for (const [v, w] of pairs) { x -= w; if (x <= 0) return v; }
    return pairs[pairs.length - 1][0];
  }

  function take(rng, list, k) {     // k distinct items
    const pool = list.slice(), out = [];
    while (out.length < k && pool.length) out.push(pool.splice(Math.floor(rng.random() * pool.length), 1)[0]);
    return out;
  }

  function joinOffices(rng, offs) {
    if (offs.length === 1) return `He ${offs[0]}.`;
    const style = rng.random();
    if (style < 0.4) return `He ${offs.slice(0, -1).join(', ')}, and ${offs[offs.length - 1]}.`;
    if (style < 0.75) return 'He ' + offs.join('; he ') + '.';
    return offs.map((o, i) => (i === 0 ? 'He ' : i === offs.length - 1 ? 'And he ' : 'He ') + o + '.').join(' ');
  }

  const RANK_WORD = /\b(Kings?|Dukes?|Princes?|Marquis(?:es)?|Presidents?|Earls?|Knights?)\b/gi;

  function compose(name, slots, seed) {
    const L = root.SIGIL_DATA.lore, rng = root.Sigils.makeRng((seed ^ 0x7E471E5) >>> 0), N = title(name);
    const p = k => rng.random() < L.p[k];
    const rank1 = weighted(rng, L.ranks);
    let rank = rank1;
    const held = [rank1];
    if (p('second_rank')) {
      const r2 = weighted(rng, L.ranks.filter(([r]) => r !== rank1));
      rank = `${rank1} and ${r2}`;
      held.push(r2);
    }
    // a seal formula that names a rank ("after the manner of the Presidents") only for a spirit of
    // that rank; elsewhere a rank is someone else's ("the favour of Kings") and stays
    const fits = s => (s.match(RANK_WORD) || []).every(w => held.some(h => w.toLowerCase().startsWith(h.toLowerCase().slice(0, 5))));
    slots = Object.assign({}, slots, { seal_formulas: slots.seal_formulas.filter(fits) });
    const adj = weighted(rng, L.adjectives);
    const art = /^[AEIOU]/.test(adj || rank) ? 'an' : 'a';
    const rankPhrase = `${art} ${adj ? adj + ' ' : ''}${rank}`;
    const loc = p('location') && slots.locations.length ? ', ' + rng.choice(slots.locations) : '';
    const forms = take(rng, slots.forms, weighted(rng, L.n_appearances));
    let appear = forms.length ? forms[0] : '';
    if (forms.length > 1) appear += ', and at other times ' + forms.slice(1).join(', and again ');
    const trans = p('transformation') && slots.transformations.length ? ', ' + rng.choice(slots.transformations) : '';

    const out = [];
    const opening = weighted(rng, [[0, 0.45], [1, 0.35], [2, 0.2]]);
    if (opening === 0) out.push(`${N} is ${rankPhrase}${loc}, and appeareth ${appear}${trans}.`);
    else if (opening === 1) out.push(`This Spirit is called ${N}. He is ${rankPhrase}${loc}. He appeareth ${appear}${trans}.`);
    else out.push(`The Spirit ${N} is ${rankPhrase}${loc}; he appeareth ${appear}${trans}.`);
    if (p('nature') && slots.nature.length) out.push(`He is ${rng.choice(slots.nature)}.`);
    for (const m of take(rng, slots.manner, weighted(rng, L.n_manner))) out.push(`He ${m}.`);
    const offs = take(rng, slots.offices, Math.max(1, weighted(rng, L.n_offices)));
    if (offs.length) out.push(joinOffices(rng, offs));
    if (p('conditions') && slots.conditions.length) out.push(cap(rng.choice(slots.conditions)) + '.');
    if (p('order') && slots.orders.length) {
      out.push(`He was of ${rng.choice(slots.orders)}` + (p('hope') && slots.hopes.length ? `, and ${rng.choice(slots.hopes)}.` : '.'));
    }
    out.push(`He ${weighted(rng, L.legion_verbs)} ${rng.choice(L.legions)} Legions of Spirits.`);
    if (p('seal') && slots.seal_formulas.length) out.push(cap(rng.choice(slots.seal_formulas)) + '.');
    return out.join(' ');
  }

  async function loreForSeed(seed, name, base = '') {
    const slots = await loadShard(shardOf(seed), base);
    return compose(name, slots, seed);
  }

  root.Sigils = root.Sigils || {};
  Object.assign(root.Sigils, { loreForSeed, loreCompose: compose, loreShardOf: shardOf, loreDecode: decode });
  if (typeof module !== 'undefined' && module.exports) module.exports = { loreForSeed, compose, shardOf, decode };
})(typeof globalThis !== 'undefined' ? globalThis : this);
