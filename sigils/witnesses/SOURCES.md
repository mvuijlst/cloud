# SOURCES — primary-source witnesses for the 72 Goetic seals

All fetches were made on **2026-10-24** with `curl` (User-Agent "Mozilla/5.0 (research fetch)").
Everything fetched was treated as data; nothing downloaded was executed. Where a source was
unreachable or paywalled this is stated explicitly below; no secondary source was substituted.

Folder layout:

| folder | witness |
|---|---|
| `peterson_sloane3825/` | Peterson's online Goetia (based on BL Sloane MS 3825): 72 seals + Bune's second seal + the page HTML |
| `mathers1904/` | Mathers/Crowley, *The Book of the Goetia of Solomon the King*, 1904 first edition: plate pages + 80 per-figure crops |
| `harley6483/` | BL Harley MS 6483 (Dr Rudd): the only reachable images (4 seals, via Peterson) + BL catalogue evidence |
| `sloane/` | Sloane 3648 / 2731 / 3824 seal images reachable via Peterson + BL catalogue records for Sloane 3825, 2731, 3648 |
| `wellcome_ms3203/` | Wellcome Collection MS.3203 (Hockley-circle copy, 1843–69; Peterson's "W3203"): seal tables, full-resolution leaves + 54 cell crops |
| `negative_evidence/` | Weyer, Scot, Folger V.b.26 material |

---

## 1. Peterson, *Lemegeton, Part 1: Goetia* (esotericarchives.com)

**URLs used (2026-10-24)**

- https://www.esotericarchives.com/solomon/goetia.htm — saved as `peterson_sloane3825/goetia_peterson.html` (134,082 bytes; page states "Updated Feb 22, 2026")
- https://www.esotericarchives.com/solomon/lemegeton.htm — saved as `peterson_sloane3825/lemegeton_peterson.html` (general introduction, manuscript list, appendix of manuscript drawings)
- https://www.esotericarchives.com/copyright.htm — read, not saved
- seal images: `https://www.esotericarchives.com/gifs/gN.jpg` for N = 4–72 (except as noted), `https://www.esotericarchives.com/solomon/gN.png` for N = 1, 2, 3, 50, 51, 52; `gifs/g26a.jpg` (Bune, first seal), `gifs/g26b.jpg` (Bune, second seal), `gifs/g42r1.jpg` (Vepar, revised), `gifs/g43r1.jpg` (Sabnach, revised), `gifs/g58b.jpg` (Amy as in Sl. 2731), `gifs/sl_3648_g42.jpg` (Vepar in Sl. 3648), `solomon/harl_6483_27ra.jpg` (Harley 6483 f. 27r, Bune/"Bime"), `solomon/Sloane-3824_fol_115v_seere_seal.jpg`, `solomon/Sloane-3824_fol_116r_dantalion_seal.jpg`, `solomon/Sloane-3824_fol_116r_andromalius_seal.jpg`; appendix of lemegeton.htm: `gifs/0219fig.gif` (Baal, Harl. 6483), `gifs/0220fig.gif` (Agares, Harl. 6483), `gifs/0221fig.gif` (Vasago, Harl. 6483).

**Basis of the edition.** "Transcribed from London, British Library Sloane ms. 3825. Variants from other manuscripts are noted in square brackets []. Also in square brackets are the folio numbers from Sl. 3825." Figure N on the page is the seal of spirit N (verified for all 72 by the `id=` anchors preceding each `<IMG>`); files were saved as `NN_name.ext`.

**How the seal images were produced.** The page nowhere says in one sentence "the seals are redrawn", so the following is evidence plus an inference:

- Header: "This digital edition by Joseph H. Peterson, 1999. Updated Feb 22, 2026. Introduction and notes copyright © 1999; **figures copyright © 2001 by Joseph H. Peterson.** Transcription license CC-BY 4.0."
- Revision history in the `<META NAME="revisionDesc">` of the HTML: "1972-07-25 Joseph H. Peterson; Hand copied from manuscript Sl.3825 in British Museum"; "1998-09-02 Joseph H. Peterson; Scanned in from typewritten pages. Corrections controlled by microfilm copy. Added introduction."; "2020-Apr-03 JHP: Convert images to jpg."; "2021-Jul-06 JHP: Add footnotes on magic circle, triangle, pentagram, and hexagram with updated artwork."; "2022-Mar-20 JHP: Expand Seere, Dantalion, and Andromalius footnotes (with seals) from Sl. 3824."; "**2025-Feb-22 JHP: Refined seals 42 & 43**" (the files for 42 and 43 are named `g42r1.jpg`, `g43r1.jpg`).
- copyright.htm: "The materials on the Twilit Grotto Esoteric Archives (including all texts, translations, images, descriptions, **drawings** etc.) are provided for the personal use of students, scholars, and the public."
- Visual character: the 72 `g*` images are clean black-on-white line drawings with no paper tone, bleed-through or folio context (sizes 157–470 px); by contrast every image Peterson labels as coming from a manuscript (`harl_6483_27ra.jpg`, `sl_3648_g42.jpg`, the three `Sloane-3824_*` seals, `triangle_Sl_3825.jpg`, `ring_Sloane_3825.jpg`, `g73_sloane_3825_magic_circle_rescan.jpg`) is a greyscale photographic scan with paper tone.
- They are not Mathers' plates: Mathers' engravings put each seal in a double ring with the name lettered round it and use their own figure numbering (80 figures, see §2); Peterson's drawings have no ring or lettering, and e.g. his Bael, Agares and Vassago are visibly different drawings from Mathers' figures 1–3 and from the Harley 6483 versions he reproduces.
- Caption under figure 2 (Agares): "King Agares (sec. man.)" — i.e. the label stands in the manuscript in a second hand.

**Conclusion:** Peterson's 72 seal figures are his own artwork (hand-copied from Sl. 3825 in 1972, controlled against microfilm, periodically refined), i.e. redrawings of the Sloane 3825 seals — neither scans of the manuscript nor copies of Mathers. Treat them as a careful modern tracing of Sloane 3825, not as a photographic witness.

**Every seal for which Peterson shows an alternative or comments on a variant (exact wording):**

- **26 Bune** — text: "his seal is this wch he owneth [oweth] obedience to. first" [g26a] "& Nota he hath another seal or Character wch is made Thus." [g26b] "yu may use wch yu will, but ye first is best as Salomon saith." Footnote 28: "Bune (Duke): # 24 in W and Scot. H and Sl. 3648 both read "Bime," against W's Bune, seemingly in error. Sl. 2731 notes (in margin) "in another copy 'Bime.'" Crowley/Mathers: "Bune, or Bimé.- The Twenty-sixth Spirit is Buné (or Bim)." Mathers' version of the sigil has "BUNE" drawn around it, while his table showing Rudd's Hebrew reads "Bimé." The actual ms. however has no such diacritic:" [followed by `harl_6483_27ra.jpg`, a scan of Harley 6483 f. 27r showing the Bime seal with Hebrew and the psalm verse "Clamavi in toto corde meo…"]. Files: `26_bune.jpg` (= g26a), `26_bune_alt_g26b.jpg`, `harley6483/26_bune_harley6483_f27r_peterson.jpg`.
- **42 Vepar** — footnote 49b (on the seal): "So Sl. 2731, 3648, NWU, Harl. 6483. Sl. 3648:" [followed by `sl_3648_g42.jpg`]. Revision log: "Refined seals 42 & 43". Files: `42_vepar.jpg` (= g42r1), `sloane/42_vepar_sloane3648_peterson.jpg`.
- **43 Sabnach** — seal refined 2025-02-22 ("g43r1"); no textual note on the seal itself.
- **58 Amy** — footnote 68: "To make sense of the attempted corrections, compare with the version given in Sl. 2731:" [followed by `g58b.jpg`]. File: `sloane/58_amy_sloane2731_peterson_g58b.jpg` (a line drawing in Peterson's style; whether it is a tracing or a scan of Sl. 2731 is not stated).
- **70 Seere** — footnote 80: "This spirit is not found in W, nor are Dantalion or Andromalius. It was possibly drawn from Sl. 3824 fol. 114v: "Of the spirit Seere His [figure] Character nature & Office &c. …"" [followed by `Sloane-3824_fol_115v_seere_seal.jpg`]. File: `sloane/70_seere_sloane3824_f115v_peterson.jpg`.
- **71 Dantalion** — footnote 81: "Dantalion (Duke): H: "Dantaylion." Not in W or Scot. Sl. 3824 (a "proto-Lemegeton") fol. 116r: "Of the spirit Dantalion His Character …"" [followed by `Sloane-3824_fol_116r_dantalion_seal.jpg`]. File: `sloane/71_dantalion_sloane3824_f116r_peterson.jpg`.
- **72 Andromalius** — footnote 82: "Andromalius (Earl): Not in W or Scot. … See also Sloane 3824 fol. 116r: "Of the spirit Andromalius. His Character …"" [followed by `Sloane-3824_fol_116r_andromalius_seal.jpg`]. File: `sloane/72_andromalius_sloane3824_f116r_peterson.jpg`.
- **21 Morax** — name only, no seal variant: "Mathers follows Harl. 6482 (Rudd) in reading "Marax"."
- No other spirit has an alternative seal or a seal-specific comment on the page.

**Peterson on where the seals first appear in the tradition:**

- goetia.htm introduction: "**The spirit sigils do not appear in any of the earlier manuscripts of the Offices of Spirits that I am aware of**, although they are reminiscent of those found in some other catalogs of spirits, such as that in Ms Plut 89 Sup 38 (fol. 95v ff), which contains sigils for 100 demons, or the Secrets of Solomon."
- lemegeton.htm: "The first book, Goetia, corresponds closely with the catalog of demons published by Johahn Weyer (or Johann Wierus) as Pseudomonarchia daemonum in his 1563 De Praestigiis Daemonum. **In Weyer's text there are no demonic seals**, and the demons are invoked by a simple conjuration, not the elaborate ritual found in the Lemegeton. Reginald Scot included an English translation of Weyer's text, which does in fact seem to be the ancestor of this part of the Lemegeton — specifically the 1665 edition." Also: "Fasciculus Rerum Geomanticarum (Plut 89 Sup 38) (dated 1401-1410) has a large collection of demon sigils, but they seem to be unrelated." and, of Sloane 3824 and Douce 116: "A collection which can be considered a proto-Lemegeton. Includes demon sigils, hexagram, pentagram, excerpts from Heptameron…" (Douce 116).
- weyer.htm (Other manuscripts, on Plut. 89 Sup 38): "Some demon sigils also occur earlier in the manuscript, but they do not match those in the Lesser Key of Solomon / Goetia manuscripts."

Counts: 72 primary seals + 1 alternative (Bune) in `peterson_sloane3825/`; 4 Harley 6483 images in `harley6483/`; 5 Sloane images in `sloane/`.

---

## 2. Mathers / Crowley, *The Book of the Goetia of Solomon the King* (1904)

**Search record (archive.org advancedsearch, 2026-10-24).** No scan of the 1904 printing exists on archive.org. Items examined:

- `ac_goetia` (dated 1904 in metadata) — description: "This re-set electronic edition prepared by Celephaïs Press … 2003 E.V." → a re-typeset edition, not a scan.
- `goetia_202006` (dated 1904) and `the-lesser-key-of-solomon-goetia` (folkscanomy) — OCR of the title page reads "The Lesser Key Of Solomon GOETIA Compiled and Translated By S.L. "MacGregor" Mathers Editing and Additional Material By Aleister Crowley" → modern reprint title page, user uploads; not the 1904 edition.
- `lesserkeyofsolom00dela` (Brigham Young University scan, 98 leaves, 500 ppi) and `lesserkeysolomo00laurgoog` (Google scan, 97 leaves): *The Lesser Key of Solomon, Goetia*, Chicago: De Laurence, 1916 — the unauthorised reprint of Mathers/Crowley with seals printed inline; spirits occupy leaves n34 (Bael) to n57 (Andromalius) of the BYU item. Not downloaded (reprint; the 1904 was preferred as instructed). Peterson (lemegeton.htm): "There is also an edition published by Chicago: The Occult Pub. House, "1903", but the date must be mistaken or fictitious, as the 1904 is certainly the first edition supervised by Crowley."
- `lesserkeyofsolom0000math` — 2016 reprint, lending library; ignored.
- HathiTrust catalogue (https://catalog.hathitrust.org/Search/Home?lookfor=goetia+crowley+mathers): HTTP 403 to curl — **not checked**.

**1904 first-edition scan obtained.** Wikimedia Commons `File:The Book of the Goetia (Mathers-Crowley, 1904).djvu` (https://commons.wikimedia.org/wiki/File:The_Book_of_the_Goetia_(Mathers-Crowley,_1904).djvu; 84 pages, 2096×2696 px per page, uploaded 2023-11-19, licence PD-old-70-expired; Wikisource index https://en.wikisource.org/wiki/Index:The_Book_of_the_Goetia_(Mathers-Crowley,_1904).djvu gives publisher "Society for the Propagation of Religious Truth, Boleskine, Foyers, Iverness, 1904", OCLC 1294461). Its declared source is the scan by 100th Monkey Press:

- https://www.100thmonkeypress.com/biblio/acrowley/books/goetia_1904/goetia_text.pdf — 133,353,115 bytes, 84 pages, no text layer; each text page is one 4200×5400 px 600-ppi greyscale image; **the covers (pp. 1, 84), the frontispiece plate (p. 6) and the two seal plates (pp. 26, 53) are only 700×900 px 100-ppi colour images** (`pdfimages -list`). Downloaded to a scratch directory and not kept in this folder; only the needed pages were extracted.
- https://www.100thmonkeypress.com/biblio/acrowley/books/goetia_1904/goetia_1904.htm — bibliography page: "Publisher: Society for the Propagation of Religious Truth (S.P.R.T.). Printer: Chiswick Press. Published At: Boleskine, Foyers, Inverness. Date: 1904. Edition: 1st Edition. Pages: x + 66." with the link "Download Scan from Original Book"; states (a) 1 copy on vellum, (b) 10 on Japanese vellum, (c) 200 on machine-made paper.
- Title page (PDF p. 7, saved) reads "THE BOOK OF THE GOETIA OF SOLOMON THE KING … EDITED, VERIFIED, INTRODUCED AND COMMENTED BY ALEISTER CROWLEY / SOCIETY FOR THE PROPAGATION OF RELIGIOUS TRUTH / BOLESKINE, FOYERS, INVERNESS / 1904".
- Commons page renders of the DjVu were refused (HTTP 400 "Use thumbnail sizes listed on https://w.wiki/GHai") and the DjVu has no text layer; PDF page numbers = DjVu page numbers (both 84; the Wikisource pagelist marks pages 6, 26, 53 and 82 as "Image").

**Where the 72 seals are (leaf numbers).** In the 1904 edition the seals are **not** printed beside the text. The catalogue of spirits (printed pp. 13–31 = PDF pp. 27–45) refers to numbered figures; the figures are on three plates:

| PDF/DjVu page | content |
|---|---|
| 6 | frontispiece plate (colour, 700×900 px in the scan): **Figures 1–24** (spirits 1–20), the table "After the Hebrew of Dr. Rudd" (Figures 81–152 = Hebrew names only, no seals), Figure 153 (magical circle), Figure 154 (triangle) |
| 26 | plate: **Figures 25–72** (spirits 21–65), 6 × 8 grid |
| 53 | plate: **Figures 73–80** (spirits 66–72) plus Figures 155–176 (hexagram, pentagram, ring, brass vessel, secret seal, steles, Theurgia samples) |

Text evidence: p. 19 n. on Bune "He hath another Seal (which is the first of these,¹ but the last is the best).² … ¹ Figure 30. ² Figure 31."; p. 34: "Such as they are, these names in the Hebrew of Dr. Rudd are here shown. (See Figures 81 to 152 inclusive.)"; p. 34 "(See Frontispiece, Figure 153.)".

Figure → spirit map (read from the plates; eight spirits have two seals): 1 Bael, 2 Agares, 3 Vassago, 4 Samigina, 5 Marbas, 6 Valefor, 7 Amon, 8 Barbatos, **9–10 Paimon**, 11 Buer, 12 Gusion, 13 Sitri, **14–15 Beleth**, 16 Leraje, **17–18 Eligos**, 19 Zepar, 20 Botis, **21–22 Bathin**, 23 Sallos, 24 Purson, 25 Marax, 26 Ipos, 27 Aim, 28 Naberius, 29 Glasya-Labolas, **30–31 Bune**, 32 Ronove, 33 Berith, 34 Astaroth, 35 Forneus, 36 Foras, 37 Asmoday, 38 Gaap, 39 Furfur, 40 Marchosias, 41 Stolas, 42 Phenex, 43 Halphas, 44 Malphas, 45 Raum, 46 Focalor, **47–48 Vepar**, 49 Sabnock, 50 Shax, 51 Vine, 52 Bifrons, 53 Uvall, 54 Haagenti, **55–56 Crocell**, 57 Furcas, 58 Balam, 59 Alloces, 60 Camio, 61 Murmur, 62 Orobas, 63 Gremory, 64 Ose, 65 Amy, 66 Oriax, 67 Vapula, 68 Zagan, 69 Valac, 70 Andras, 71 Haures, 72 Andrealphus, 73 Cimeies, 74 Amdusias, 75 Belial, 76 Decarabia, **77–78 Seere**, 79 Dantalion, 80 Andromalius.

**Files.** `mathers1904/pdfpage06_…LOWRES.png`, `pdfpage07_title_page.png` (4200×5400), `pdfpage26_plate_figs25-72.png`, `pdfpage53_plate_figs73-80_and_155-176.png` (native extractions, `pdfimages -png`); `mathers1904/figs/NN_name[_sealK]_figFFF.png` — 80 cells cut from the three plates on the printing grid and rotated 90° clockwise to upright (the plates are printed sideways). **Resolution caveat:** because the source scanned the plates at 100 ppi, each cell is only ≈105 × 105 px. A better reproduction of the 1904 plates was not found online; the 1916 De Laurence scans (above) reproduce the same cuts inline at 500 ppi if a surrogate is ever needed.

---

## 3. Harley MS 6483, Sloane MSS 3825 / 2731 / 3648, Skinner & Rankine 2007

**British Library (all checked 2026-10-24).**

- Legacy Digitised Manuscripts: `https://www.bl.uk/manuscripts/FullDisplay.aspx?ref=Harley_MS_6483`, `…ref=Sloane_MS_3825`, `…ref=Sloane_MS_2731`, `…ref=Sloane_MS_3648` and `Viewer.aspx?ref=harley_ms_6483_f001r` all redirect (HTTP 200) to the generic page `https://www.bl.uk/collection/digitised-manuscripts-archives?ref=…`, which says: "Please note that some digitised items are currently unavailable as a result of a cyber-attack on the Library. We are working hard to put these back online as soon as possible." No images are served.
- IIIF: `https://iiif.bl.uk/manifests/ark:/81055/…` — no ark identifiers for these manuscripts could be obtained; a probe returned 404. **Not reachable.**
- Archives and Manuscripts Catalogue (https://searcharchives.bl.uk/, interim Blacklight instance: "This is an interim version of our Archives and Manuscripts Catalogue while we continue to recover from a cyber-attack."):
  - Reference search `"Harley MS 6483"` → "No entries found"; all-fields searches for `Harley 6483`, `Harley MS 6482`, `Harley MS 6484`, `Rudd Goetia`, `Liber malorum spirituum` returned no record for Harley 6483. The first hit for "Harley MS 6483" was in fact **Harley MS 6478** (Epigrams from the Palatine Anthology; record 040-001614165), whose record reads "Digitised Content: http://www.bl.uk/manuscripts/FullDisplay.aspx?ref=Harley_MS_6478 (digital images currently unavailable)" — saved as `harley6483/bl_catalogue_record_Harley_MS_6478_wrong_hit.html` as evidence that the Rudd volume has no record in the interim catalogue. **Harley 6483: no digitisation found; no images reachable.**
  - Sloane MS 3825, record 040-002116215 (`sloane/bl_catalogue_record_Sloane_MS_3825.html`): "ff. 100-179 Salomon, King of Israel: Clavicle of Solomon: 1572.: Fr." — field "Digitised Content:" is empty → **not digitised**.
  - Sloane MS 2731, record 040-002115103 (`sloane/bl_catalogue_record_Sloane_MS_2731.html`): "Salomon, King of Israel: Clavicle of Solomon: 1572.: Fr." — "Digitised Content:" empty → **not digitised**.
  - Sloane MS 3648, record 040-002116038 (`sloane/bl_catalogue_record_Sloane_MS_3648.html`): "ff. 1-47 Salomon, King of Israel: Lesser Key of Solomon (Lemegeton): 1572.: Fr. …" — "Digitised Content:" empty → **not digitised**.
- Consequently the only reachable images of these manuscripts' seals are those Peterson reproduces: Harley 6483 — Bael, Agares, Vassago (lemegeton.htm appendix: "APPENDIX - Other examples of some of the drawings: Sigil for Baal, from Harl. 6483. Sigil for Agares, from Harl. 6483. Sigil for Vasago, from Harl. 6483.") and Bune/"Bime" f. 27r; Sloane 3648 — Vepar; Sloane 2731 — Amy (and, not spirit seals, the brass vessel and secret seal); Sloane 3824 — Seere, Dantalion, Andromalius. Sloane 3825 itself is represented only through Peterson's redrawings (§1).

**Skinner & Rankine, *The Goetia of Dr Rudd* (Golden Hoard 2007; Llewellyn 2010).**

- Google Books API (`https://www.googleapis.com/books/v1/volumes?q=…`): HTTP 429 "Quota exceeded for quota metric 'Queries' and limit 'Queries per day'" on both attempts; the legacy GData feed returned HTTP 500; the HTML search (`google.com/search?tbm=bks`) returned no parseable result list without JavaScript. **Preview not checked / not reachable by this method.**
- archive.org holds three complete copies uploaded by private users (`the-goetia-of-dr.-rudd`, `stephen-skinner-the-goetia-of-dr.-rudd`, `the-goetia-of-dr.-rudd-pdfdrive.com`, the last described as "( PDFDrive.com )"). These are full reproductions of an in-copyright book, not a publisher preview; **not downloaded**.

---

## 3b. Additional witness found: Wellcome Collection MS.3203 (Peterson's "W3203")

- Catalogue: https://api.wellcomecollection.org/catalogue/v2/works/abkwgz5c — "Lea, Henry Dawson. Five treatises upon Magic. … Two Books of Solomon the King called Goetia and Theurgia Goetia, with the Names, Offices, Circles and Seals of 336 Spirits. … Transcribed by my friend Henry Dawson Lea from MSS. I lent to him in the year 1843. Illustrated by numerous pen-drawn figures, diagrams, sigils, etc., some coloured, and some inscribed on slips of tracing-paper, pasted down. The title, as given above, is by the hand of Frederick Hockley [1808-1885]…"; Reference MS.3203; Publication/creation 1843–1869.
- IIIF manifest: https://iiif.wellcomecollection.org/presentation/v2/b19087469 (saved as `wellcome_ms3203/iiif_manifest_b19087469.json`); 221 canvases of c. 4100 × 4870 px; licence http://creativecommons.org/publicdomain/mark/1.0/. Image service pattern: `https://iiif.wellcomecollection.org/image/b19087469_WT2747_MS_3203_NNNN.JP2/{region}/{size}/0/default.jpg`.
- Located by a thumbnail contact sheet of all canvases and medium-size checks: Goetia text ends on canvas 94 ("End of Goetia"); canvas 95 = "Plate 1" triangle, "Plate 2" secret seal, circle, brass vessel; canvas 96 = pentagram, hexagram and the table "Seals of the…" nos 1–8; canvas 97 = nos 9–26; canvas 98 = nos 27–44; canvas 99 = nos 45–53 and "17 Stolas from page". Theurgia Goetia follows (canvas 110 = Baruchas and his dukes). Canvases 146–195 are Lenain's *Sacred and Divine Cabal* (72 Shem-angel characters on pasted slips) — not Goetic seals.
- This witness has **53 spirits, numbered 1–53 in its own order**: 1 Bael, 2 Agares, 3 Vas-sago, 4 Marbas, 5 Gamigin, 6 Valefor, 7 Amon, 8 Barbatos, 9 Paimon, 10 Buer, 11 Gusoin, 12 Sitri, 13 Beleth, 14 Gaap, 15 Furfur, 16 Marchosias, 17 Stolas, 18 Phenix, 19 Halphas, 20 Malphas, 21 Raum, 22 Focalor, 23 Vepar, 24 Sabnack, 25 Shax, 26 Vine, 27 Bifrons, 28 Vuall, 29 Haagenti, 30 Procell, 31 Furcas, 32 Balam, 33 Allocer, 34 Caim, 35 Murmur, 36 Orobas, 37 Gemory, 38 Ose, 39 Amy, 40 Orias, 41 Vapula, 42 Zagan, 43 Valac, 44 Andras, 45 Hauras, 46 Andrealphus, 47 Cimeries, 48 Amduscias, 49 Belial, 50 Seer, 51 Decarabia, 52 Dantalion, 53 Andromalius. The nineteen spirits Leraje–Asmoday (standard nos 14–32) are absent, Marbas/Gamigin and Seere/Decarabia are transposed. Compare Peterson (weyer.htm) on Hockley's exemplar: "This actually does seem to be the case with Hockley's ms. of the Goetia (Wellcome 4665), where each spirit is described on a separate leaf…".
- Downloaded: canvases 12 (title leaf), 95, 96, 97, 98, 99 at `/full/full/` (`wellcome_ms3203/canvasNNN_*.jpg`), and 54 cell crops cut server-side with IIIF region requests (`wellcome_ms3203/cells/`, file names `NN_name_ms3203noMM_canvasNNN.jpg`, NN = standard number, MM = the manuscript's own number; the Stolas box on canvas 97 is an empty cross-reference and is marked `_placeholder`). Cell coordinates were measured by hand on 900-px renders and may include the red rule lines.
- Also digitised at Wellcome but not Goetia catalogues (not downloaded): Hockley, *Four experiments of the Spirits Birto, Agares, Bealpharos and Vassago* (work tn85wpcb, manifest b19291978) and *Book of Good Angels* (brkmxbxh, b18595534). Wellcome MS 4665 (Hockley's own Goetia) was not found through the API (`"MS.4665"` → 0 results).

---

## 4. Negative evidence: do the earlier "Offices of Spirits" texts carry seals?

**Weyer, *Pseudomonarchia Daemonum* (1563/1577).** Peterson's edition at https://www.esotericarchives.com/solomon/weyer.htm (saved `negative_evidence/weyer_peterson.html`) prints the Latin with Scot's English in parallel ("Except as noted in [], translation is from Reginald Scot, The Discoverie of Witchcraft (1584), probably by prolific translator Abraham Fleming") and contains no seal images at all (the only `<img>` on the page is an advertising pixel). Peterson's own statement, lemegeton.htm: "In Weyer's text there are no demonic seals, and the demons are invoked by a simple conjuration, not the elaborate ritual found in the Lemegeton." The weyer.htm introduction adds that the only related sigils he knows in an earlier manuscript do not match: "Some demon sigils also occur earlier in the manuscript [Florence, Plut. 89 Sup 38], but they do not match those in the Lesser Key of Solomon / Goetia manuscripts." **Answer: no seals in Weyer.**

**Scot, *Discoverie of Witchcraft* (1584), Book 15.** Peterson's Scot material is at https://www.esotericarchives.com/solomon/scot16.htm ("Reginald Scot's collection of magical texts", saved `negative_evidence/scot16_peterson.html`; the URLs `solomon/scot15.htm` and `solomon/scot.htm` return 404); the Book 15 ch. 2 inventory of spirits itself is given as the parallel translation inside weyer.htm. The only seals Peterson reproduces from Scot's Book 15 belong to ch. 7, "The characters of the angels of the seaven daies, with their names: of figures, seales and periapts", on which he comments "Names and seals of the planetary angels: Compare Heptameron" and quotes Scot: "These figures are called the seales of the earth, without the which no spirit will appeere, except thou have them with thee." — i.e. planetary-angel seals, none attached to the 69 spirits of the inventory. Checked against scans: the 1665 third edition (archive.org `discoveryofwitch00scot`, Boston College copy; leaves n250–n258, "Heir first and principal King … is called Baell" on n250, Stolas on n258) and the 1886 Nicholson reprint of the 1584 first edition (`discoverieofwitc00scot`, Princeton copy; inventory leaves n410–n422) show plain text with marginal names and no figures; medium-size page images saved in `negative_evidence/scot_pages/`. The 1584 original is on EEBO (ProQuest, **paywalled**; not consulted); archive.org EEBO microfilm items exist only for the 1651, 1654 and 1665 editions (`bim_early-english-books-1641-1700_…scot-reginald_1651/_1654/_1665`). **Answer: no seals for the inventory's spirits in Scot.**

**Folger Shakespeare Library MS V.b.26 ("Book of Oberon").** Peterson's transcription URL given in the brief (https://www.esotericarchives.com/mss/Vb26.htm) returns **404**; the transcription is now the PDF https://www.esotericarchives.com/folger/v_b_26_transcription.pdf (3,168,516 bytes, "Transcription by Joseph H. Peterson and Dan Harms, copyright 2015. Updated July 12, 2025", saved `negative_evidence/folger_vb26_peterson_transcription.pdf`). Its editorial principles state "Drawings: All drawings are omitted from this transcription." but the text marks their positions with "[figure …]" placeholders throughout (e.g. "[figure, circle]", "[figure, spirit portrait]", "[figure, characters]"). In the section "Officium de spirittibus / The offices of spirits" (manuscript pp. 73–86, 131 numbered entries, beginning "There be 4 kinges of the Ayere Orience R[ex] of the east, Paymon R[ex] of the west, Amaymon R[ex] of the southe, & Egine R[ex] of the North") **no "[figure" placeholder occurs** until the next section begins at p. 85/86 ("[figure, spirit portrait]" and "[figure, pentacle: made in the daye of [sun] …]", which belong to the planetary conjuration of Sunday). Peterson cites this list throughout weyer.htm ("Folger p. 81: 1 Baall", "Folger p. 81: 2 Agaros" …) only for names and descriptions, and his goetia.htm statement covers it: "The spirit sigils do not appear in any of the earlier manuscripts of the Offices of Spirits that I am aware of". The Folger's own images were **not reachable**: https://luna.folger.edu/luna/servlet (and `…/view/search?q=V.b.26`) redirect to https://digitalcollections.folger.edu/turnstile-challenge?destination=%2F (Cloudflare Turnstile bot challenge; `digitalcollections.folger.edu/iiif/` likewise), and https://collections.folger.edu/ did not respond. **Answer: the Offices of Spirits in V.b.26 carries no seals for its spirits (per Peterson's transcription); not verified on the Folger images.**

---

## Not attempted / outside the brief

Bodleian Douce 116 (proto-Lemegeton with sigils), Northwestern University "NWU" manuscript, BL Add. 36674, Sloane 3824 as a whole, Wellcome MS 4665 — not searched beyond what is noted above.
