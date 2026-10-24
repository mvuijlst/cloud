# Sources for Agrippa, De occulta philosophia II.22 (planetary squares, names, seals)

All fetches made with curl on **2026-10-24** (Europe). Everything fetched is treated as data; nothing
downloaded was executed. Raw downloads are kept under `raw/` (HTML, JSON, OCR, two original JP2 files);
the page images are in `woodcuts/`.

## Deliverables in this folder

| File | What it is |
|---|---|
| `agrippa_II22_latin.txt` | Latin text of II.22 (pp. CXLV-CLIII of the 1533 edition), built from the MDZ and Wellcome OCR and corrected by eye against the Wellcome page images; plus the printed name tables and woodcut captions. |
| `agrippa_II22_freake.html` | Chapter xxii only, from Joseph H. Peterson's digital edition of the 1651 English translation by J. F[reake]. |
| `agrippa_II22_tables.json` | The seven squares (Arabic and Hebrew), stated and recomputed sums, the 14 intelligence/spirit names and the divine names with Hebrew, transliteration, printed values and recounted gematria; printing errors flagged. |
| `woodcuts/*.jpg` | Full page images (4959 x 6601 px, 600 ppi) of pp. CXLV-CLIII from the Wellcome copy. |
| `raw/` | Everything fetched, unmodified (see below). |

## 1. Latin text

**No clean online transcription of Book II chapter 22 was found.** Checked:

- Joseph H. Peterson, Twilit Grotto / Esoteric Archives. His Agrippa pages are English (Freake 1651) with notes;
  there is no Latin text of Book II there.
  - https://www.esotericarchives.com/agrippa/agrippa2.htm (200; English, Book II part 1)
  - https://www.esotericarchives.com/agrippa/agripp2b.htm (200; English, Book II part 2, contains chap. xxii)
  - https://www.esotericarchives.com/agrippa/op2.htm (200; complete English Book II with Peterson's notes,
    including notes on ch. 22: "Asboga: octonarius extensus ... A=1+Z=7, B=2+V=6, G=3+H=5", and
    "Lat: Tabula Saturni in abaco; in notis Hebraicis ... abacus is a table on which numbers are ...")
  - https://www.esotericarchives.com/agrippa/index.html (200), https://www.esotericarchives.com/esoteric.htm (200)
  - https://www.esotericarchives.com/agrippa/index.htm (404)
- Bibliotheca Augustana (hs-augsburg.de/~harsch), which might carry a Latin Agrippa: **unreachable**,
  HTTP 503 "upstream connect error" on every attempt (agr_intr.html and the site index, retried over ~20 min).
- Latin Wikisource: https://la.wikisource.org/wiki/De_occulta_philosophia - **404, no such page**.
- WebSearch (discovery only; result pages not fetched unless listed): queries for the Latin incipit
  ("sacras tabulas planetarum"), for Corpus Corporum / Bibliotheca Augustana / Wikisource hosting, and for
  "Tabula Saturni" "Agiel" Latin text returned no transcription, only manuscripts, modern books and the
  scans listed below. Peterson himself refers readers for the Latin to UB Basel kf II 24 (Lyon 1550).

**What was used instead:** the OCR text layers of two digitised 1533 copies, corrected against the images.

- MDZ / Bayerische Staatsbibliothek, copy bsb11193457 (owner: Augsburg, Staats- und Stadtbibliothek,
  call number `2 Alt 3#(Beibd.`; catalogue BV004380621; URN urn:nbn:de:bvb:12-bsb11193457-1).
  - Catalogue record used to find the digital id: https://opacplus.bsb-muenchen.de/title/BV004380621?format=rdf (200)
  - IIIF manifest: https://api.digitale-sammlungen.de/iiif/presentation/v2/bsb11193457/manifest (200; 376 canvases;
    licence rightsstatements NoC-NC 1.0)
  - hOCR per page: https://api.digitale-sammlungen.de/ocr/bsb11193457/159 ... /167 (200 each) =
    scans 0159-0167 = pp. CXLV-CLIII. Saved as `raw/mdz_ocr/bsb11193457_<n>.hocr.html` and `.txt`.
    This OCR is good (long s, ligatures, even some Hebrew).
  - Viewer: https://www.digitale-sammlungen.de/view/bsb11193457?page=159
- Internet Archive, Wellcome copy (see 2.) OCR: `..._djvu.txt` and `..._djvu.xml` (poor OCR, used as a second reading).
- Internet Archive, Jung copy OCR `..._djvu.xml` (third reading, barely used).

Transcription conventions are stated at the top of `agrippa_II22_latin.txt`.

## 2. Woodcut page images

**Edition:** [Cologne: Johann Soter], [July] 1533, folio, [12] p., CCCLXII p.; VD16 ZV 269; first complete
edition (several typographical issues of the same year exist; the Wellcome record calls its copy "one of
variant printings, not authoritatively identified, of first ed.", Mansell 5:302, Mayer 230.I).

**Copy used:** Wellcome Collection, London, Sierra system number b21416412 (item i18664611, closed stores);
digitised by ProQuest "Early European Books" at 600 ppi, mirrored on the Internet Archive as
`hin-wel-all-00001912-001` (388 leaves; "Images reproduced by courtesy of The Wellcome Trust, London",
"Early European Books, Copyright 2011 ProQuest LLC" footer on every scan).

- Item: https://archive.org/details/hin-wel-all-00001912-001
- Metadata: https://archive.org/metadata/hin-wel-all-00001912-001 (200)
- Scandata (leaf list): https://archive.org/download/hin-wel-all-00001912-001/hin-wel-all-00001912-001_scandata.xml (200)
- OCR: https://archive.org/download/hin-wel-all-00001912-001/hin-wel-all-00001912-001_djvu.txt (200),
  https://archive.org/download/hin-wel-all-00001912-001/hin-wel-all-00001912-001_djvu.xml (200)
- Wellcome catalogue record: https://api.wellcomecollection.org/catalogue/v2/works/wsthg632?include=items,identifiers,notes,production (200)
  (public page: https://wellcomecollection.org/works/wsthg632)
- IIIF image info (shows 4959 x 6601 native size):
  https://iiif.archive.org/iiif/3/hin-wel-all-00001912-001%24170/info.json (200)
- Page images, IIIF Image API 3, full/max:
  `https://iiif.archive.org/image/iiif/3/hin-wel-all-00001912-001%2fhin-wel-all-00001912-001_jp2.zip%2fhin-wel-all-00001912-001_jp2%2fhin-wel-all-00001912-001_<NNNN>.jp2/full/max/0/default.jpg`
  with NNNN = 0167 ... 0175. Leaves 0167, 0168, 0170, 0171, 0174, 0175 came back 200. Leaves 0169, 0172 and 0173
  returned **HTTP 500** repeatedly (4 retries each). 0173 then succeeded with `/full/4959,/0/default.jpg`;
  for 0169 and 0172 the original JP2 files were downloaded out of the zip instead
  (`https://archive.org/download/hin-wel-all-00001912-001/hin-wel-all-00001912-001_jp2.zip/hin-wel-all-00001912-001_jp2%2Fhin-wel-all-00001912-001_0169.jp2`, same for 0172; kept in `raw/jp2/`)
  and converted to JPEG (quality 92) locally with Pillow. All nine images are 4959 x 6601 px.

| File in `woodcuts/` | IA leaf (file no.) | Printed page | Contents |
|---|---|---|---|
| `text_p145_CXLV_leaf167.jpg` | 167 (_0167) | CXLV | end of ch. 21; heading and first lines of ch. 22 |
| `text_p146_CXLVI_leaf168.jpg` | 168 | CXLVI | ch. 22 text: Saturn, Jupiter, Mars |
| `text_p147_CXLVII_leaf169.jpg` | 169 | CXLVII | ch. 22 text: Sun, Venus, Mercury, Moon |
| `names_saturn-mercury_p148_CXLVIII_leaf170.jpg` | 170 | CXLVIII | end of text; name/value/Hebrew tables for Saturn, Jupiter, Mars, Sun, Venus, Mercury |
| `saturn_jupiter_p149_CXLIX_leaf171.jpg` | 171 | CXLIX (running head misprinted "CLXIX") | Moon names; Saturn: square in Arabic numerals, square in Hebrew letters, seal, character of the intelligence, character of the spirit; Jupiter: the same five |
| `mars_sol_p150_CL_leaf172.jpg` | 172 | CL | Mars: both squares + three characters; Sun: both squares + three characters |
| `venus_p151_CLI_leaf173.jpg` | 173 | CLI | Venus: both squares; seal; characters of the intelligence, the spirit and the intelligences (Bne Seraphim) |
| `mercury_p152_CLII_leaf174.jpg` | 174 | CLII | Mercury: both squares; seal; characters of intelligence and spirit |
| `luna_p153_CLIII_leaf175.jpg` | 175 | CLIII | Moon: both squares; seal; characters of the spirit, of the spirit of spirits, of the intelligence of intelligences |

Mapping: IA leaf = printed page + 22 (leaf 11 is the title page). Chapter 23 begins on p. CLIIII (leaf 176).

**Alternatives located but not downloaded** (lower resolution):

- e-rara, copy of the Stiftung der Werke von C. G. Jung, Zürich: https://www.e-rara.ch/cgj/content/titleinfo/1343192
  (DOI https://doi.org/10.3931/e-rara-4309; Public Domain Mark). IIIF manifest
  https://www.e-rara.ch/i3f/v20/1343192/manifest (200; 393 canvases, 2550 x 3675 px). pp. CXLV-CLIII are canvases
  with image services https://www.e-rara.ch/i3f/v20/1343358 ... /1343366 (p. CXLV = 1343358, CLIII = 1343366).
  Also fetched: https://www.e-rara.ch/search/quick?query=agrippa+occulta+philosophia (200),
  https://www.e-rara.ch/cgj/content/structure/1343192 (200; Liber secundus starts image [118] = p. XCIX),
  https://www.e-rara.ch/cgj/content/pageview/1343435 (200), https://www.e-rara.ch/cgj/download/fulltext/plain/1343435 (404).
  The same copy is mirrored on IA as `DeOccultaPhilosophiaJungCollection1533` (450 ppi; metadata fetched).
- MDZ bsb11193457 (above): image service `https://api.digitale-sammlungen.de/iiif/image/v2/bsb11193457_00159` ...
  `_00167`, about 2200 x 3560 px; licence NoC-NC (non-commercial).
- IA `DeOccultaPhilosophiaLoc1533` (Library of Congress copy, 400 ppi; metadata fetched only).
- IA search used to find these: https://archive.org/advancedsearch.php?q=agrippa+AND+%28occulta+philosophia%29&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=date&fl%5B%5D=publisher&fl%5B%5D=language&rows=100&output=json (200).
  (The IA item `17219451458888bsb-10192450` is the 1531 Antwerp/Paris printing of Book I only.)

## 3. Tables, names and values

Transcribed from the Wellcome images (full-resolution crops of every square and of the Hebrew column; 3x zooms
where letters were doubtful), cross-read with the MDZ OCR and with Freake 1651 (Peterson). See
`agrippa_II22_tables.json`. Headline results:

- Arabic-numeral squares: all seven are correct magic squares; constants 15 / 34 / 65 / 111 / 175 / 260 / 369,
  totals 45 / 136 / 325 / 666 / 1225 / 2080 / 3321, exactly as the text states. The 1533 Mercury table is correct
  in both scripts (Peterson notes he had to correct the 1651 English Mercury table in 2004).
- Hebrew-letter squares: same layout as the Arabic ones, cell for cell (not mirrored; read left to right they
  reproduce the Arabic rows). All agree with the Arabic tables except one cell of the Moon table (row 1, 8th
  cell from the left = 2nd from the right: מה 45 printed for נד 54).
  15 is written יה in the larger tables but טו in Jupiter's; 16 is always יו.
- Values printed against names that do not match the printed Hebrew: Kedemel 157 (קדמאל = 175, a transposition);
  Barzabel 325 but spelt ברצאבאל = 326; Hasmodai 369 but spelt השמודאי (initial he) = 366. Bne Seraphim 1252 and
  the two long Moon names 3321 are correct only when final mem/nun are counted as 600/700.
- Spellings that differ between 1533 and Freake 1651 (Peterson): Abba / "Abab"; Schartathan / "Scharthathan";
  "betharsisim ... schehakim" / "betharsism ... schehalim".

## 4. Secondary: how the characters are traced on the squares

- Donald Tyson (ed.), *Three Books of Occult Philosophy* (Llewellyn, 1993; reprinted 2005). **The book itself is
  not online**; Google Books API query https://www.googleapis.com/books/v1/volumes?q=intitle%3A%22Three+Books+of+Occult+Philosophy%22+inauthor%3ATyson
  returned HTTP 429 (rate-limited) and was not retried. A single second-hand statement was found:
  https://digitalambler.com/2011/06/24/derp-derp/ (via https://digitalambler.com/tag/tyson/, 200) says that in
  "Tyson's edition of Agrippa, Appendix V describes in full detail the construction of the squares, the sigils",
  and that the lunar sigils are the hard ones to reproduce. Unverified against the book.
- David Rankine, "Agrippa and the Magic Squares" (first published in *Howlings*, Scarlet Imprint 2008; re-posted
  2024-10-12 with sigil illustrations): https://www.davidrankine.com/post/agrippa-and-the-magic-squares (200).
  Claims, briefly: the Hebrew name is written on the kamea and the sigil is made by joining, in order, the cells
  whose numbers equal the letter values; letters whose value exceeds the square's range are reduced by the
  Aiq Bekar (nine chambers) table to the highest available power (e.g. Agiel on Saturn: 1-3-1-1-3; Kedemel on
  Venus: 100 reduced to 10, 40 and 30 kept); the first cell is marked with a small circle, the last with a bar
  or circle; repeated consecutive values get a loop; Agrippa himself is inconsistent (he often adds I+A to make
  11 instead of using 10 and 1, combines other letters, and reduces 200 to 2 instead of 20 even when 20 exists
  in the kamea). The essay's bibliography cites the Llewellyn Tyson edition (2005 printing).
- Wikipedia, https://en.wikipedia.org/wiki/Three_Books_of_Occult_Philosophy (200): bibliography only; nothing on tracing.
- Seen in search results but not fetched: Lyndl Hall, *Magic Squares: Some Notes on the Tables of Agrippa*
  (Hildegard Press, 2025) at goodpress.co.uk / tique.space; Quest magazine review of Tyson's edition
  (theosophical.org); PhilPapers record AGRTBO (Tyson/Freake, 1993).

## Unreachable or absent (summary)

- Bibliotheca Augustana (hs-augsburg.de/~harsch): HTTP 503 throughout.
- la.wikisource.org: no page for De occulta philosophia (404).
- Peterson's site: no Latin text of Book II (English only).
- IA IIIF `full/max` for leaves 0169, 0172, 0173: HTTP 500 (worked around as described; nothing substituted from
  another copy).
- e-rara plain full text endpoint: 404 (not needed).
- Google Books API: 429.
- Tyson's Appendix V: not reachable online; only the blog claim above.

## Raw files kept in `raw/`

`agripp2b.htm`, `agrippa2.htm`, `op2.htm`, `index.html`, `esoteric.htm`, `agrippa_index.htm` (404 page) - Peterson;
`archive_search.json`, `ia_meta_*.json`, `wellcome1533_djvu.txt`, `wellcome1533_scandata.xml`, `wellcome1533_djvu.xml`,
`wellcome1533_pages.txt` (OCR split per leaf), `jung1533_djvu.xml`, `jung1533_pages.txt`, `ocr_chapter22_both.txt`,
`ia_iiif_info_170.json`, `wellcome_work_wsthg632.json` - Internet Archive / Wellcome;
`erara_search.html`, `erara_1343192_manifest.json`, `erara_https___www.e-rara.ch_cgj_content_*` - e-rara;
`bsb_BV004380621.rdf`, `mdz_bsb11193457_manifest.json`, `mdz_ocr/` - BSB/MDZ;
`jp2/` - the two original JP2 page files; `wikisource_la.html` (404 page); `aug_*.html` (503 bodies);
`rankine_agrippa_squares.html`, `digitalambler_tyson.html`, `wiki_three_books.html`, `gbooks_tyson_vols.json` (429 body).
