#!/usr/bin/env python3
"""
anonymize_gedcom.py
-------------------
Anonymize a GEDCOM file for public sharing (e.g. the "islands" family-tree viewer).

  - Living people are anonymized: given names collapse to initials
    ("Jan Philippe David /Vuijlsteke/" -> "J.P.D. /Vuijlsteke/").
  - Everyone is stripped down to the minimum the viewer needs:
    name(s), a single birth year, and the family structure (HUSB/WIFE/CHIL).
    Places, sources, notes, media, occupations, exact dates, etc. are dropped.

"Living" = no death/burial record AND (known or estimated) birth year within the
last --max-age years. When a person has no birth date of their own, the birth
year is ESTIMATED by propagating dates through the family graph (children,
parents, spouses, siblings). This is what lets a spouse of someone born in 1780
be correctly treated as historical, while a parent of someone born in 2010 is
treated as possibly living.

Only genuine life-event dates are trusted. Source-citation dates (`3 DATE` under
`SOUR`/`DATA`) and record last-changed dates (`2 DATE` under `CHAN`) are ignored
on purpose -- confusing those for real dates is what makes naive anonymizers
mislabel centuries-old people as living.

Usage:
    python anonymize_gedcom.py <input.ged> [output] [options]

If no output path is given, writes "<input>.anon.ged" next to the input.
When the output path ends in `.js`, the result is wrapped as
`window.<VAR>="...";` (for default_data.js). No external dependencies.
"""

import argparse
import datetime
import json
import os
import re
import sys
import statistics

YEAR_RE = re.compile(r"\d{3,4}")
LETTER_RE = re.compile(r"[^\W\d_]", re.UNICODE)  # first alphabetic char (Unicode-aware)
SURN_SLASH_RE = re.compile(r"/([^/]*)/")

# Level-1 tags whose level-2 DATE does NOT mean "alive then" (CHAN = edit date, etc.).
IGNORE_L1_FOR_ALIVE = {
    "NAME", "SEX", "FAMC", "FAMS", "CHAN", "SOUR", "OBJE", "NOTE",
    "REFN", "RIN", "RFN", "_UID", "RESN", "SUBM", "ANCI", "DESI",
}
DEATH_TAGS = {"DEAT", "BURI", "CREM"}
CHR_TAGS = {"CHR", "BAPM", "CHRA"}


def year_of(date_value):
    """Last 3-4 digit group in a DATE value (mirrors the viewer's parser).

    "FROM SEP 1953 TO JUN 1959" -> 1959, "27 NOV 1629" -> 1629, "ABT 1147" -> 1147.
    """
    matches = YEAR_RE.findall(date_value)
    return int(matches[-1]) if matches else None


def split_line(line):
    """Split a GEDCOM line into (level, tag, value, xref). xref is None if absent."""
    parts = line.split(" ", 1)
    if len(parts) < 2:
        return None
    try:
        level = int(parts[0])
    except ValueError:
        return None
    rest = parts[1]
    if rest.startswith("@"):
        # "0 @I1@ INDI" -> xref @I1@, tag INDI
        xr = rest.split(" ", 1)
        xref = xr[0]
        after = xr[1] if len(xr) > 1 else ""
        tv = after.split(" ", 1)
        tag = tv[0]
        value = tv[1] if len(tv) > 1 else ""
        return level, tag, value, xref
    tv = rest.split(" ", 1)
    tag = tv[0]
    value = tv[1] if len(tv) > 1 else ""
    return level, tag, value, None


class Individual:
    __slots__ = ("id", "names", "sex", "birth_year", "chr_year", "has_death",
                 "death_year", "alive_years")

    def __init__(self, rid):
        self.id = rid
        self.names = []          # list of dicts: {text, type, surn}
        self.sex = None
        self.birth_year = None
        self.chr_year = None
        self.has_death = False
        self.death_year = None
        self.alive_years = []


class Family:
    __slots__ = ("id", "husb", "wife", "chil", "marr_year")

    def __init__(self, rid):
        self.id = rid
        self.husb = None
        self.wife = None
        self.chil = []
        self.marr_year = None


def parse(text):
    lines = text.lstrip("﻿").splitlines()
    indis, fams, order = {}, {}, []
    rec = None
    kind = None
    l1 = None
    cur_name = None

    for raw in lines:
        line = raw.rstrip("\r\n")
        if not line:
            continue
        p = split_line(line)
        if not p:
            continue
        level, tag, value, xref = p

        if level == 0:
            rec = kind = l1 = cur_name = None
            if tag == "INDI" and xref:
                rec = Individual(xref)
                indis[xref] = rec
                kind = "I"
                order.append(("I", xref))
            elif tag == "FAM" and xref:
                rec = Family(xref)
                fams[xref] = rec
                kind = "F"
                order.append(("F", xref))
            continue
        if rec is None:
            continue

        if kind == "I":
            if level == 1:
                l1 = tag
                cur_name = None
                if tag == "NAME":
                    cur_name = {"text": value, "type": None, "surn": None}
                    rec.names.append(cur_name)
                elif tag == "SEX":
                    s = value.strip()[:1].upper()
                    if s in ("M", "F"):
                        rec.sex = s
                elif tag in DEATH_TAGS:
                    rec.has_death = True
            elif level == 2:
                if l1 == "NAME" and cur_name is not None:
                    if tag == "TYPE":
                        cur_name["type"] = value.strip()
                    elif tag == "SURN":
                        cur_name["surn"] = value
                elif tag == "DATE":
                    y = year_of(value)
                    if y is not None:
                        if l1 == "BIRT":
                            if rec.birth_year is None:
                                rec.birth_year = y
                        elif l1 in CHR_TAGS:
                            if rec.chr_year is None:
                                rec.chr_year = y
                        elif l1 in DEATH_TAGS:
                            if rec.death_year is None:
                                rec.death_year = y
                        elif l1 not in IGNORE_L1_FOR_ALIVE:
                            rec.alive_years.append(y)
            # level >= 3 (e.g. SOUR/DATA/DATE citation dates) is ignored on purpose.
        else:  # FAM
            if level == 1:
                l1 = tag
                if tag == "HUSB":
                    rec.husb = value.strip()
                elif tag == "WIFE":
                    rec.wife = value.strip()
                elif tag == "CHIL":
                    rec.chil.append(value.strip())
            elif level == 2 and tag == "DATE" and l1 == "MARR":
                y = year_of(value)
                if y is not None and rec.marr_year is None:
                    rec.marr_year = y

    return indis, fams, order


def estimate_birth_years(indis, fams, gen_gap):
    ADULT_GAP = 25  # assumed age at a recorded adult life event / marriage

    parents, children, spouses, siblings = {}, {}, {}, {}

    def push(m, k, v):
        if v:
            m.setdefault(k, []).append(v)

    for fam in fams.values():
        pair = [x for x in (fam.husb, fam.wife) if x]
        for c in fam.chil:
            for par in pair:
                push(parents, c, par)
                push(children, par, c)
        if fam.husb and fam.wife:
            push(spouses, fam.husb, fam.wife)
            push(spouses, fam.wife, fam.husb)
        for c in fam.chil:
            for c2 in fam.chil:
                if c != c2:
                    push(siblings, c, c2)
        if fam.marr_year is not None:
            for s in pair:
                ind = indis.get(s)
                if ind:
                    ind.alive_years.append(fam.marr_year)

    def median(arr):
        return int(round(statistics.median(arr)))

    # Seed with own hard evidence.
    est = {}  # id -> (year, direct)
    for ind in indis.values():
        y = None
        if ind.birth_year is not None:
            y = ind.birth_year
        elif ind.chr_year is not None:
            y = ind.chr_year                     # christened ~ at birth
        elif ind.death_year is not None:
            y = ind.death_year - 40              # rough: born well before death
        elif ind.alive_years:
            y = min(ind.alive_years) - ADULT_GAP
        if y is not None:
            est[ind.id] = (y, True)

    # Fixpoint: fill unknowns from neighbours until nothing new appears.
    changed, rounds = True, 0
    while changed and rounds < 100:
        changed = False
        rounds += 1
        for ind in indis.values():
            if ind.id in est:
                continue
            cand = []
            for c in children.get(ind.id, ()):
                if c in est:
                    cand.append(est[c][0] - gen_gap)
            for par in parents.get(ind.id, ()):
                if par in est:
                    cand.append(est[par][0] + gen_gap)
            for s in spouses.get(ind.id, ()):
                if s in est:
                    cand.append(est[s][0])
            for sib in siblings.get(ind.id, ()):
                if sib in est:
                    cand.append(est[sib][0])
            if cand:
                est[ind.id] = (median(cand), False)
                changed = True
    return est


def is_living(ind, est, year, max_age, assume_living):
    if ind.has_death:
        return False                              # has a death/burial record => not living
    e = est.get(ind.id)
    if e is None:
        return assume_living                      # no evidence anywhere
    return e[0] >= year - max_age                 # born within the window (inclusive)


def initials(name_text):
    slash = name_text.find("/")
    given = (name_text[:slash] if slash >= 0 else name_text).strip()
    surname_part = name_text[slash:].strip() if slash >= 0 else ""
    inits = ""
    for tok in given.split():
        m = LETTER_RE.search(tok)
        if m:
            inits += m.group(0).upper() + "."
    if not surname_part:
        return inits
    return (inits + " " + surname_part) if inits else surname_part


def surname_of(name):
    if name["surn"] and name["surn"].strip():
        return name["surn"].strip()
    m = SURN_SLASH_RE.search(name["text"])
    if m and m.group(1).strip():
        return m.group(1).strip()
    return None


def emit(indis, fams, order, est, opts):
    out = ["0 HEAD", "1 SOUR gedcom-anonymizer", "1 GEDC",
           "2 VERS 5.5.1", "2 FORM LINEAGE-LINKED", "1 CHAR UTF-8"]
    total = living_count = 0

    for kind, rid in order:
        if kind == "I":
            ind = indis[rid]
            total += 1
            living = is_living(ind, est, opts.year, opts.max_age, opts.assume_living)
            if living:
                living_count += 1

            out.append("0 %s INDI" % ind.id)
            for name in ind.names:
                text = initials(name["text"]) if living else name["text"].strip()
                out.append("1 NAME %s" % text)
                if name["type"]:
                    out.append("2 TYPE %s" % name["type"])
                surn = surname_of(name)
                if surn:
                    out.append("2 SURN %s" % surn)
            if ind.sex:
                out.append("1 SEX %s" % ind.sex)   # drives node shape; not sensitive
            show_year = not (living and opts.redact_living_year)
            if show_year and ind.birth_year is not None:
                out.append("1 BIRT")
                out.append("2 DATE %d" % ind.birth_year)
            elif show_year and ind.chr_year is not None:
                out.append("1 CHR")
                out.append("2 DATE %d" % ind.chr_year)
        else:
            fam = fams[rid]
            if not fam.husb and not fam.wife and not fam.chil:
                continue
            out.append("0 %s FAM" % fam.id)
            if fam.husb:
                out.append("1 HUSB %s" % fam.husb)
            if fam.wife:
                out.append("1 WIFE %s" % fam.wife)
            for c in fam.chil:
                out.append("1 CHIL %s" % c)
            # marriage year drives the marriage glyph's position; redact only
            # when both spouses are living and living years are being redacted.
            both_living = (opts.redact_living_year and fam.husb and fam.wife
                           and fam.husb in indis
                           and is_living(indis[fam.husb], est, opts.year, opts.max_age, opts.assume_living)
                           and fam.wife in indis
                           and is_living(indis[fam.wife], est, opts.year, opts.max_age, opts.assume_living))
            if fam.marr_year is not None and not both_living:
                out.append("1 MARR")
                out.append("2 DATE %d" % fam.marr_year)
    out.append("0 TRLR")
    return "\n".join(out) + "\n", total, living_count


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Anonymize a GEDCOM file (initials for living people, minimal fields).")
    ap.add_argument("input", help="input .ged file")
    ap.add_argument("output", nargs="?", help="output path (default: <input>.anon.ged; "
                                              ".js wraps as window.<VAR>=...)")
    ap.add_argument("--js", action="store_true",
                    help="wrap output as window.<VAR>=\"...\" (auto for .js output)")
    ap.add_argument("--var", dest="var_name", default="DEFAULT_GED",
                    help="JS variable name for --js output (default: DEFAULT_GED)")
    ap.add_argument("--year", type=int, default=datetime.date.today().year,
                    help="reference 'current' year (default: this year)")
    ap.add_argument("--max-age", type=int, default=100,
                    help="living if birth year >= year - N (default: 100)")
    ap.add_argument("--gen-gap", type=int, default=30,
                    help="assumed parent/child age gap for estimation (default: 30)")
    ap.add_argument("--assume-living", action="store_true",
                    help="treat people with no date evidence as living (default: historical)")
    ap.add_argument("--redact-living-year", action="store_true",
                    help="also drop the birth year of living people (default: keep)")
    opts = ap.parse_args(argv)

    if not opts.output:
        opts.output = re.sub(r"\.ged(com)?$", "", opts.input, flags=re.I) + ".anon.ged"
    if opts.output.lower().endswith(".js"):
        opts.js = True

    with open(opts.input, "r", encoding="utf-8") as f:
        text = f.read()

    indis, fams, order = parse(text)
    est = estimate_birth_years(indis, fams, opts.gen_gap)
    gedcom, total, living = emit(indis, fams, order, est, opts)

    payload = gedcom
    if opts.js:
        payload = "window.%s=%s;\n" % (opts.var_name, json.dumps(gedcom))
    with open(opts.output, "w", encoding="utf-8", newline="") as f:
        f.write(payload)

    sys.stderr.write(
        "Anonymized %d individuals (%d living / anonymized, %d historical) + %d families.\n"
        "Reference year %d, max age %d. Wrote %s%s.\n" % (
            total, living, total - living, len(fams), opts.year, opts.max_age,
            os.path.relpath(opts.output),
            (" (JS: window.%s)" % opts.var_name) if opts.js else ""))


if __name__ == "__main__":
    main()
