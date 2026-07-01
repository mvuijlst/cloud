#!/usr/bin/env node
"use strict";
/*
 * anonymize-gedcom.js
 * -------------------
 * Anonymize a GEDCOM file for public sharing (e.g. the "islands" family-tree viewer).
 *
 *   - Living people are anonymized: given names collapse to initials
 *     ("Jan Philippe David /Vuijlsteke/" -> "J.P.D. /Vuijlsteke/").
 *   - Everyone is stripped down to the minimum the viewer needs:
 *     name(s), a single birth year, and the family structure (HUSB/WIFE/CHIL).
 *     Places, sources, notes, media, occupations, exact dates, etc. are dropped.
 *
 * "Living" = no death/burial record AND (known or estimated) birth year within
 * the last `--max-age` years. When a person has no birth date of their own, the
 * birth year is ESTIMATED by propagating dates through the family graph
 * (children, parents, spouses, siblings). This is what lets a spouse of someone
 * born in 1780 be correctly treated as historical, while a parent of someone
 * born in 2010 is treated as possibly living.
 *
 * Only genuine life-event dates are trusted. Source-citation dates
 * (`3 DATE` under `SOUR`/`DATA`) and record last-changed dates (`2 DATE` under
 * `CHAN`) are ignored on purpose -- confusing those for real dates is what makes
 * naive anonymizers mislabel centuries-old people as living.
 *
 * Usage:
 *   node anonymize-gedcom.js <input.ged> [output] [options]
 *
 * Options:
 *   --js                 Wrap output as `window.<VAR>="..."` (for default_data.js).
 *                        Auto-enabled when the output path ends in `.js`.
 *   --var NAME           JS variable name for --js output (default: DEFAULT_GED).
 *   --year YYYY          Reference "current" year (default: this year).
 *   --max-age N          Living if birth year > year - N (default: 100).
 *   --gen-gap N          Assumed parent/child age gap for estimation (default: 30).
 *   --assume-living      If a person has no date evidence anywhere in their
 *                        family, treat them as living (default: treat as
 *                        historical / keep full name).
 *   --redact-living-year Drop the birth year of living people too (default: keep).
 *   -h, --help           Show this help.
 *
 * If no output path is given, writes "<input>.anon.ged" next to the input.
 * No external dependencies; Node 14+.
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------- CLI parsing
function parseArgs(argv) {
  const opts = {
    input: null,
    output: null,
    js: false,
    varName: "DEFAULT_GED",
    year: new Date().getFullYear(),
    maxAge: 100,
    genGap: 30,
    assumeLiving: false,
    redactLivingYear: false,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-h": case "--help": opts.help = true; break;
      case "--js": opts.js = true; break;
      case "--assume-living": opts.assumeLiving = true; break;
      case "--redact-living-year": opts.redactLivingYear = true; break;
      case "--var": opts.varName = argv[++i]; break;
      case "--year": opts.year = parseInt(argv[++i], 10); break;
      case "--max-age": opts.maxAge = parseInt(argv[++i], 10); break;
      case "--gen-gap": opts.genGap = parseInt(argv[++i], 10); break;
      default:
        if (a.startsWith("-")) { console.error("Unknown option: " + a); process.exit(2); }
        positional.push(a);
    }
  }
  opts.input = positional[0] || null;
  opts.output = positional[1] || null;
  return opts;
}

// ------------------------------------------------------------ GEDCOM helpers
const YEAR_RE = /\b(\d{3,4})\b/g;
// Take the LAST 3-4 digit group in a DATE value (mirrors the viewer's parser):
// "FROM SEP 1953 TO JUN 1959" -> 1959, "27 NOV 1629" -> 1629, "ABT 1147" -> 1147.
function yearOf(dateValue) {
  const m = dateValue.match(YEAR_RE);
  return m ? parseInt(m[m.length - 1], 10) : null;
}

// Level-1 event tags whose level-2 DATE means "this person was alive then".
// (Birth/death/christening are handled separately; CHAN/SOUR are ignored.)
const IGNORE_L1_FOR_ALIVE = new Set(["NAME", "SEX", "FAMC", "FAMS", "CHAN", "SOUR",
  "OBJE", "NOTE", "REFN", "RIN", "RFN", "_UID", "RESN", "SUBM", "ANCI", "DESI"]);
const DEATH_TAGS = new Set(["DEAT", "BURI", "CREM"]);
const CHR_TAGS = new Set(["CHR", "BAPM", "CHRA"]);

// Split a level line into { level, tag, value }.
function splitLine(line) {
  const sp1 = line.indexOf(" ");
  if (sp1 < 0) return null;
  const level = parseInt(line.slice(0, sp1), 10);
  if (Number.isNaN(level)) return null;
  let rest = line.slice(sp1 + 1);
  let tag, value;
  if (rest.startsWith("@")) {
    // "0 @I1@ INDI" -> tag is the record type after the xref
    const sp2 = rest.indexOf(" ");
    const xref = sp2 < 0 ? rest : rest.slice(0, sp2);
    const after = sp2 < 0 ? "" : rest.slice(sp2 + 1);
    const sp3 = after.indexOf(" ");
    tag = sp3 < 0 ? after : after.slice(0, sp3);
    value = sp3 < 0 ? "" : after.slice(sp3 + 1);
    return { level, tag, value, xref };
  }
  const sp2 = rest.indexOf(" ");
  tag = sp2 < 0 ? rest : rest.slice(0, sp2);
  value = sp2 < 0 ? "" : rest.slice(sp2 + 1);
  return { level, tag, value };
}

// -------------------------------------------------------------------- parse
function parse(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const indis = new Map();   // id -> individual
  const fams = new Map();    // id -> family
  const order = [];          // [{kind:'I'|'F', id}] in file order

  let rec = null;            // current record object
  let recKind = null;        // 'I' | 'F' | null
  let l1 = null;             // current level-1 tag within the record
  let curName = null;        // current NAME entry being filled

  for (const raw of lines) {
    const line = raw.replace(/[\r\n]+$/, "");
    if (line === "") continue;
    const p = splitLine(line);
    if (!p) continue;

    if (p.level === 0) {
      rec = null; recKind = null; l1 = null; curName = null;
      if (p.tag === "INDI" && p.xref) {
        rec = { id: p.xref, names: [], sex: null, birthYear: null, chrYear: null,
                hasDeath: false, deathYear: null, aliveYears: [] };
        indis.set(p.xref, rec); recKind = "I"; order.push({ kind: "I", id: p.xref });
      } else if (p.tag === "FAM" && p.xref) {
        rec = { id: p.xref, husb: null, wife: null, chil: [], marrYear: null };
        fams.set(p.xref, rec); recKind = "F"; order.push({ kind: "F", id: p.xref });
      }
      continue;
    }
    if (!rec) continue;

    if (recKind === "I") {
      if (p.level === 1) {
        l1 = p.tag; curName = null;
        if (p.tag === "NAME") {
          curName = { text: p.value, type: null, surn: null };
          rec.names.push(curName);
        } else if (p.tag === "SEX") {
          const s = p.value.trim().charAt(0).toUpperCase();
          if (s === "M" || s === "F") rec.sex = s;
        } else if (DEATH_TAGS.has(p.tag)) {
          rec.hasDeath = true;
        }
      } else if (p.level === 2) {
        if (l1 === "NAME" && curName) {
          if (p.tag === "TYPE") curName.type = p.value.trim();
          else if (p.tag === "SURN") curName.surn = p.value;
        } else if (p.tag === "DATE") {
          const y = yearOf(p.value);
          if (y != null) {
            if (l1 === "BIRT") { if (rec.birthYear == null) rec.birthYear = y; }
            else if (CHR_TAGS.has(l1)) { if (rec.chrYear == null) rec.chrYear = y; }
            else if (DEATH_TAGS.has(l1)) { if (rec.deathYear == null) rec.deathYear = y; }
            else if (!IGNORE_L1_FOR_ALIVE.has(l1)) { rec.aliveYears.push(y); }
          }
        }
      }
      // level >= 3 (e.g. SOUR/DATA/DATE citation dates) is intentionally ignored.
    } else if (recKind === "F") {
      if (p.level === 1) {
        l1 = p.tag;
        if (p.tag === "HUSB") rec.husb = p.value.trim();
        else if (p.tag === "WIFE") rec.wife = p.value.trim();
        else if (p.tag === "CHIL") rec.chil.push(p.value.trim());
      } else if (p.level === 2 && p.tag === "DATE" && l1 === "MARR") {
        const y = yearOf(p.value);
        if (y != null && rec.marrYear == null) rec.marrYear = y;
      }
    }
  }
  return { indis, fams, order };
}

// ---------------------------------------------------- birth-year estimation
function estimateBirthYears(db, opts) {
  const { indis, fams } = db;
  const ADULT_GAP = 25;      // assumed age at a recorded adult life event / marriage
  const genGap = opts.genGap;

  // Build relationship indexes.
  const parents = new Map(); // id -> [parentId...]
  const children = new Map();
  const spouses = new Map();
  const siblings = new Map();
  const push = (map, k, v) => { if (!v) return; if (!map.has(k)) map.set(k, []); map.get(k).push(v); };

  for (const fam of fams.values()) {
    const p = [fam.husb, fam.wife].filter(Boolean);
    for (const c of fam.chil) {
      for (const par of p) { push(parents, c, par); push(children, par, c); }
    }
    if (fam.husb && fam.wife) { push(spouses, fam.husb, fam.wife); push(spouses, fam.wife, fam.husb); }
    for (const c of fam.chil) for (const c2 of fam.chil) if (c !== c2) push(siblings, c, c2);
    // marriage year -> both spouses were adults
    if (fam.marrYear != null) {
      for (const s of p) { const ind = indis.get(s); if (ind) ind.aliveYears.push(fam.marrYear); }
    }
  }

  const median = (arr) => {
    const a = arr.slice().sort((x, y) => x - y);
    const n = a.length;
    return n % 2 ? a[(n - 1) / 2] : Math.round((a[n / 2 - 1] + a[n / 2]) / 2);
  };

  // est: id -> { year, direct }.  Seed with own hard evidence.
  const est = new Map();
  for (const ind of indis.values()) {
    let y = null;
    if (ind.birthYear != null) y = ind.birthYear;
    else if (ind.chrYear != null) y = ind.chrYear;           // christened ~ at birth
    else if (ind.deathYear != null) y = ind.deathYear - 40;  // rough: born well before death
    else if (ind.aliveYears.length) y = Math.min(...ind.aliveYears) - ADULT_GAP;
    if (y != null) est.set(ind.id, { year: y, direct: true });
  }

  // Fixpoint: fill unknowns from neighbours until nothing new appears.
  let changed = true, rounds = 0;
  while (changed && rounds < 100) {
    changed = false; rounds++;
    for (const ind of indis.values()) {
      if (est.has(ind.id)) continue;
      const cand = [];
      for (const c of children.get(ind.id) || []) if (est.has(c)) cand.push(est.get(c).year - genGap);
      for (const par of parents.get(ind.id) || []) if (est.has(par)) cand.push(est.get(par).year + genGap);
      for (const s of spouses.get(ind.id) || []) if (est.has(s)) cand.push(est.get(s).year);
      for (const sib of siblings.get(ind.id) || []) if (est.has(sib)) cand.push(est.get(sib).year);
      if (cand.length) { est.set(ind.id, { year: median(cand), direct: false }); changed = true; }
    }
  }
  return est;
}

// ------------------------------------------------------------- classify
function isLiving(ind, est, opts) {
  if (ind.hasDeath) return false;                 // has a death/burial record => not living
  const e = est.get(ind.id);
  if (!e) return !!opts.assumeLiving;             // no evidence anywhere
  return e.year >= opts.year - opts.maxAge;        // born within the window (inclusive)
}

// ---------------------------------------------------------- name handling
function initials(nameText) {
  const i = nameText.indexOf("/");
  const given = (i >= 0 ? nameText.slice(0, i) : nameText).trim();
  const surnamePart = i >= 0 ? nameText.slice(i).trim() : "";
  const inits = given.split(/\s+/).filter(Boolean)
    .map((tok) => { const m = tok.match(/\p{L}/u); return m ? m[0].toUpperCase() + "." : ""; })
    .join("");
  if (!surnamePart) return inits;
  return inits ? inits + " " + surnamePart : surnamePart;
}

function surnameOf(name) {
  if (name.surn && name.surn.trim()) return name.surn.trim();
  const m = /\/([^/]*)\//.exec(name.text);
  return m && m[1].trim() ? m[1].trim() : null;
}

// ------------------------------------------------------------------ emit
function emit(db, est, opts) {
  const out = [];
  out.push("0 HEAD");
  out.push("1 SOUR gedcom-anonymizer");
  out.push("1 GEDC");
  out.push("2 VERS 5.5.1");
  out.push("2 FORM LINEAGE-LINKED");
  out.push("1 CHAR UTF-8");

  const stats = { total: 0, living: 0 };

  for (const entry of db.order) {
    if (entry.kind === "I") {
      const ind = db.indis.get(entry.id);
      stats.total++;
      const living = isLiving(ind, est, opts);
      if (living) stats.living++;

      out.push(`0 ${ind.id} INDI`);
      for (const name of ind.names) {
        const text = living ? initials(name.text) : name.text.trim();
        out.push(`1 NAME ${text}`);
        if (name.type) out.push(`2 TYPE ${name.type}`);
        const surn = surnameOf(name);
        if (surn) out.push(`2 SURN ${surn}`);
      }
      if (ind.sex) out.push(`1 SEX ${ind.sex}`);   // sex drives node shape; not sensitive
      const showYear = !(living && opts.redactLivingYear);
      if (showYear && ind.birthYear != null) {
        out.push("1 BIRT"); out.push(`2 DATE ${ind.birthYear}`);
      } else if (showYear && ind.chrYear != null) {
        out.push("1 CHR"); out.push(`2 DATE ${ind.chrYear}`);
      }
    } else {
      const fam = db.fams.get(entry.id);
      if (!fam.husb && !fam.wife && fam.chil.length === 0) continue;
      out.push(`0 ${fam.id} FAM`);
      if (fam.husb) out.push(`1 HUSB ${fam.husb}`);
      if (fam.wife) out.push(`1 WIFE ${fam.wife}`);
      for (const c of fam.chil) out.push(`1 CHIL ${c}`);
      // marriage year drives the marriage glyph's position; redact only when
      // both spouses are living and living years are being redacted.
      const bothLiving = opts.redactLivingYear
        && fam.husb && fam.wife
        && db.indis.has(fam.husb) && isLiving(db.indis.get(fam.husb), est, opts)
        && db.indis.has(fam.wife) && isLiving(db.indis.get(fam.wife), est, opts);
      if (fam.marrYear != null && !bothLiving) {
        out.push("1 MARR"); out.push(`2 DATE ${fam.marrYear}`);
      }
    }
  }
  out.push("0 TRLR");
  return { gedcom: out.join("\n") + "\n", stats };
}

// ------------------------------------------------------------------- main
function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.input) {
    console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(2, 46).join("\n").replace(/^ \* ?/gm, ""));
    process.exit(opts.help ? 0 : 2);
  }
  if (!opts.output) opts.output = opts.input.replace(/\.ged(com)?$/i, "") + ".anon.ged";
  if (/\.js$/i.test(opts.output)) opts.js = true;

  const text = fs.readFileSync(opts.input, "utf8");
  const db = parse(text);
  const est = estimateBirthYears(db, opts);
  const { gedcom, stats } = emit(db, est, opts);

  let payload = gedcom;
  if (opts.js) payload = `window.${opts.varName}=${JSON.stringify(gedcom)};\n`;
  fs.writeFileSync(opts.output, payload, "utf8");

  console.error(
    `Anonymized ${stats.total} individuals (${stats.living} living / anonymized, ` +
    `${stats.total - stats.living} historical) + ${db.fams.size} families.\n` +
    `Reference year ${opts.year}, max age ${opts.maxAge}. Wrote ${path.relative(process.cwd(), opts.output)}` +
    (opts.js ? ` (JS: window.${opts.varName})` : "") + ".");
}

main();
