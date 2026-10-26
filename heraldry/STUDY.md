# Heraldry as the next generator: feasibility study

26 October 2026. Scope: pick one visual system for a second browser-only procedural generator in the vein of [sigils](../sigils/), from primary artifacts and their catalogue records; infer its construction grammar; fix the success tests before anything is built. No generator is written here.

Target look, fixed by the user during the study: coats of arms rendered as an **engraved, hatched black-and-white armorial page** (the user's "Italian Arms, 67" reference) and as a **flat-colour vector chart** (the user's chart of Scottish earls). Each image is to carry a correct blazon, as the sigils page carries a Goetia description. The painters' hands of the medieval rolls are not the target; the measurements made on them before this was settled are kept as parked evidence (section 5.4).

Every number below comes from a file in [data/](data/) or [survey/](survey/); the scripts are in [tools/](tools/). Access date for all links: 26 October 2026.

The generator built from this study, and the results of the tests in section 8, are in [GENERATOR.md](GENERATOR.md).

## Recommendation

**Go, with one cost driver named.** The composition grammar is the best-documented grammar of any sign system the user could have chosen (period treatises, Fox-Davies, Pastoureau), and its parameter distributions can be counted from free, item-level editions of two medieval rolls (2,657 coded blazons parsed here). Both target looks are mechanical to render for fields, partitions, ordinaries and geometric charges: the engraved look is a documented hatching code (Petra Sancta 1638) whose pitch and line weight were measured on Rolland's 1909 plates; the vector look is measurable in Commons SVGs. The one expensive part is the **charge library**: lions, eagles, birds, objects and human figures make up roughly half of all principal charges in the corpora (section 4.3), and each must be drawn twice (line-art that hatches by tincture, and flat vector) under a licence the site can use. Budget 60 to 100 charges before the output stops looking thin. The held-out reconstruction and blind tests in section 8 are the gates.

## 1. Candidate stage

The brief allowed three candidates. An earlier run of the same brief, outside this app, had already scoped **Truchet/Douat tilings** (its files are in `sign-study/`, untouched here). Two more were surveyed in parallel, **paper watermarks** and **registered cattle brands**, and **heraldry** was added at the user's suggestion. The user then dropped Truchet, watermarks and brands in turn while their surveys were running; those surveys were stopped before their dossiers were written, so only heraldry has a complete evidence file: [survey/DOSSIER.md](survey/DOSSIER.md) (61 links, 41 opened and verified, the rest flagged). Section 9 names what the strongest of the dropped candidates would have offered.

## 2. Primary artifacts and catalogue records

Three groups, because the study needs three different things from its sources: what arms *consist of* (composition), how the engraved tradition *draws* them, and how the vector tradition draws them.

### 2.1 Composition: medieval rolls with item-level editions

| Artifact | Record | Date | Items | Scan and rights | Text edition |
|---|---|---|---|---|---|
| Zürcher Wappenrolle | Schweizerisches Nationalmuseum AG 2760, on e-codices | c. 1335–1345 | 559 arms (450 surviving + 109 from the lost strip via copies) and 28 banners | IIIF, up to 59,724 × 6,389 px per strip face; manifest licence CC0 | Clemmensen, *The Zürich armorial* (armorial.dk, 2009): every item with a coded blazon, e.g. `34 hapspurg … 1 O G lion rampant` |
| Grünenberg, Wappenbuch | BSB Cgm 145 (parchment copy of the 1483 Berlin original) | c. 1480–1483 | 2,293 numbered items | IIIF, 4,187–5,662 × 5,969–7,222 px; Public Domain Mark | Clemmensen, *Grünenberg* (396 pp): coded blazons, 145 "variant" and 4 "misreading" flags, page concordances |
| Wapenboek Gelre | KBR Brussels ms. 15652-56 | c. 1395–1405 | 1,755 arms | IIIF v3, c. 2,580 × 3,870 px; CC0 | no free item-level edition (Pastoureau–Popoff 2012 is commercial); Commons folio pages give French blazons |
| Clemmensen, *Ordinary of Medieval Armorials* 2.x | armorial.dk | 2010s | 87,638 blazons from c. 250 armorials | MS Access .mdb, free, no licence statement | the only machine-readable corpus of *medieval* blazons; collision index for section 8.5 |
| Papworth 1874; Rietstap 1884–87 | archive.org | | c. 100,000 British / European blazons | public domain text | collision index, British and modern-European |

Provenance, dating arguments and copying chains for all of these are in the dossier, section 1, 2 and 4 (Clemmensen's *Survey* of 542 armorials records which rolls copy which; the Grünenberg BSB copy "could only be done from GStA to BSB").

### 2.2 The engraved, hatched look

| Artifact | Record | What it gives | Rights |
|---|---|---|---|
| Rolland, *Planches de l'Armorial général de J.-B. Rietstap* | Paris, Institut héraldique universel; vol. III (1909) on archive.org as `armoiriesdesfami03roll`, 748 images, 400 ppi (Allen County Public Library scan) | 56 engraved, hatched arms per plate with names and provinces: the direct ancestor of the user's "Italian Arms" page. Leaves 21 (Pl. V, Gaillard…) and 251 (Pl. CXX, Guitard…) were opened and measured, section 5.2 | Victor Rolland (fascicules I–XII, d. 1912) is public domain everywhere; Henri Rolland's fascicules XIII–XXXVI (d. 1970) are not free in life-plus-70 jurisdictions until 2041. Use volumes I–XII only |
| Petra Sancta, *Tesserae gentilitiae* (Rome 1638); Vulson de la Colombière (1639) | HathiTrust page images (Online Books Page entry); not opened here | the hatching code itself | public domain |
| Fox-Davies, *A Complete Guide to Heraldry* (1909), pp. 74–76 | archive.org text, verified | the codified mapping and its rule of placement: "The hatchings of the shield and its charges always accommodate themselves to the angle at which the shield is placed" | public domain |
| The user's "Italian Arms, 67" page | source not identified (the only catalogue hit, Society of Antiquaries MSS/0409 "Italian arms", is a coloured manuscript, not this) | 16 engraved Italian arms in the same convention, round-bottomed shields, names in letterspaced capitals | unknown until the book is named |

### 2.3 The flat-colour vector look

| Artifact | Record | What it gives | Rights |
|---|---|---|---|
| Commons, *Arms of William Douglas, 6th Earl of Douglas and Earl of Wigtown.svg* | Euryrel, 2022-03-26 | heater outline, palette and line weights of the Commons heraldic style ([data/commons_svg_notes.json](data/commons_svg_notes.json)) | CC BY-SA 4.0 (share-alike: measure, do not embed) |
| Commons, *Arms of Alexander Stewart, Earl of Mar.svg* | MostEpic, 2023-05-09, drawn after Johnston, *The Heraldry of the Stewarts* (1902, archive.org `heraldryofstewar00john`) | same, with a named printed source | CC BY-SA 4.0 |
| The user's chart of Scottish earls | source not identified; appears assembled from files of this family | 46 arms with names, titles and dates | unknown |

**Access constraints, in one place.** Gallica (Bellenville, Toison d'Or) blocked scripted access; British Library rolls are offline since 2023; the KHM Ingeram Codex is private-use only; WappenWiki art is non-commercial; Commons heraldic art is share-alike. Everything the study relies on is CC0, Public Domain Mark or pre-1912 print. **Cultural and legal constraints:** arms are living property in Scotland (Lyon Court), Canada and, by analogy, Germany; a fictional generator is lawful everywhere, but simple generated arms *will* coincide with real ones (section 8.5), and a few period charges read badly today (Moors' heads, the wolfsangel, sun-wheels); the dossier, section 6, lists the statutes and the ADL entries.

## 3. Construction rules, copying errors and material effects

The tradition wrote its own grammar, which makes the three easy to separate:

- **Construction rules** are documented: blazon order (field, then partitions, ordinaries, principal charges, secondary charges, charges on charges, brisures; Fox-Davies pp. 99–100), the rule of tincture (Pastoureau: "dès le début du XIIe siècle"), and the hatching code. What the sources do *not* give is the frequency of anything; that is measured in section 4.
- **Copying errors** are flagged by the editor: Grünenberg carries 145 "variant" and 4 "misreading" notes ("the lobster a misreading of the nettleleaf"); the Zürich roll's no. 32, painted *gules a bend azure*, is the arms of Lorraine "confounded" (Clemmensen), one of the 17 rule-of-tincture breaches counted below. Witness pairs show real change as well as error: Toggenburg is plain in Zürich (c. 1340) and quartered with Breisgau in Grünenberg (1483) because the house changed its arms; Brederode is plain with a label in Gelre and quartered in Beyeren, by the same herald, ten years apart.
- **Material effects** are of two kinds. In the manuscripts: pigment. The Zürich azure is a teal (CIELAB a ≈ −8, b ≈ +2), the Grünenberg azure a true blue (b ≈ −19); the Nellenburg antlers that Clemmensen codes as azure were painted with the roll's black (a ≈ 0, b ≈ +5, L 27, indistinguishable from the talbot of Toggenburg and the bars of Gütingen), so the edition normalises what the painter did not paint. In the engravings: the burin. Hatch pitch, line thickness and dot pitch are constant across a plate and across the two plates measured (section 5.2), and all 56 shields on a plate share one outline. In the engraved look, therefore, shield shape and hatching are **frame parameters**, not per-arms design; the only design variable is the composition.

## 4. The composition corpus, measured

[tools/parse_clemmensen.py](tools/parse_clemmensen.py) parses the two editions into [data/zurich_items.json](data/zurich_items.json) and [data/grunenberg_items.json](data/grunenberg_items.json); [tools/blazon_stats.py](tools/blazon_stats.py) counts them into [data/blazon_stats.json](data/blazon_stats.json). Coverage: Zürich 558 of 559 items parsed (no. 202 has its codes after the blazon); Grünenberg 2,199 of 2,293 numbers captured (ranges such as "20–51 a series of small shields" are skipped), 2,099 with a coat.

### 4.1 Coats per item and tinctures per coat

| | Zürich (c. 1340) | Grünenberg (1483) |
|---|---|---|
| single coat | 553 of 558 (99.1%) | 1,954 of 2,099 (93.1%) |
| quartered or otherwise combined | 5 | 145 (112 quarterly, 18 two coats, 15 more) |
| tinctures in a single coat: 2 / 3 / 4 / 5+ | 65% / 24% / 9% / 2% | 63% / 22% / 12% / 3% |

Quartering is a late-medieval habit: 1% of items in 1340, 7% in 1483. A generator "in the manner of" either roll must set this rate per roll.

### 4.2 Tinctures

Field tincture of single coats (X = mixed or fur fields):

| | A | O | G | B | S | V | X, Z, E, P |
|---|---|---|---|---|---|---|---|
| Zürich (n = 550) | 32.5% | 20.9% | 20.7% | 12.5% | 6.9% | 1.6% | 4.7% |
| Grünenberg (n = 1,894) | 27.1% | 20.2% | 23.0% | 14.7% | 8.7% | 1.2% | 5.1% |

Principal-charge tincture: Zürich A 146, S 132, G 117, O 72, B 35, V 23; Grünenberg A 559, G 426, S 311, O 307, B 143, V 30. Field-plus-charge pairs: argent–gules leads in both rolls (31% and 33%), then argent–sable (17%, 14%), or–sable (14%, 13%), argent–azure (10%, 12%), or–gules (9%, 13%), azure–or (9%, 11%). Pastoureau's Europe-wide 12th-century figure of 31% for or–gules does not hold in this Swabian–Swiss–Austrian material, where argent–gules takes that place: tincture distributions are regional and must be taken from the roll one is imitating, not from a continental average.

**Rule of tincture**, tested on every single coat whose field and first charge are both plain metals or colours: 17 breaches in 500 in Zürich (3.4%), 51 in 1,686 in Grünenberg (3.0%). The Grünenberg breaches cluster in the attributed arms of biblical and imaginary kings (Abisay, "kung von kaldea", "kung von trappolle"); the real nobility obeys the rule almost without exception. The grammar should break the rule only in an explicit "attributed arms" mode, at about 3%.

### 4.3 Charges and structures (per mille of coats, first coat, several classes may apply)

| class | Zürich | Grünenberg | Pastoureau, Europe |
|---|---|---|---|
| lion | 113 | 123 | 155 |
| fess, bars, barry | 102 | 126 | 82 |
| bend, bendy | 82 | 82 | |
| pale, paly | 29 | 46 | 6 |
| chief | 66 | 70 | |
| cross, saltire | 20 | 36 | |
| partition (per fess, pale, bend, chevron) | 138 | 140 | |
| quarterly, chequy, lozengy, gyronny | 48 | 50 | |
| eagle | 45 | 55 | |
| other beast | 143 | 95 | |
| bird | 52 | 24 | |
| rose, flower, lily | 39 | 58 | |
| star, crescent, sun | 32 | 41 | |
| antler, horn | 59 | 21 | |
| human figure or part | 68 | 32 | |
| object (key, axe, wheel, buckle, castle…) | 163 | 148 | |
| not classified by the keyword lists | 108 | 110 | |

Structural rates: charged ordinaries ("ch.") 82‰ and 72‰; bordure 18‰ and 29‰; label 2‰ and 12‰; semy 2‰ and 20‰; secondary charges ("acc.") 32‰ and 44‰; two charges 113‰ and 97‰, three 133‰ and 135‰, four or more 32‰ and 50‰; crowned or armed beasts 36‰ and 39‰. The commonest whole blazons are plain ordinaries: Zürich *fess* 12, *bend* 10, *chief* 7, *lion rampant* 7, *per pale* 7; Grünenberg *lion rampant* 41, *fess* 32, *chief* 29, *bend* 28, *per pale* 22, *eagle* 21. These are the parameter distributions the grammar samples from, with two corrections to make before use: the keyword classes overlap (an eagle is not a "bird" here, a talbot is a "beast"), and 11% of blazons escape the lists and must be read by hand into the charge taxonomy.

## 5. Worked analyses on the two looks

### 5.1 Annotated sample from the reference pages

Twenty-four arms read from the user's two pages and from Rolland Pl. V, with the structural features a generator must produce and the awkward ones flagged. Readings of hatching at page scale are mine and uncertain where marked; that uncertainty is itself a finding for section 8.2.

| # | Source, name | Reading | Structure | Awkward |
|---|---|---|---|---|
| 1 | Italian 67, Adami | Chief azure with three stars argent; below, a mount of three and a bend, hatched gules/or | chief + charges, mount, bend | hatching of the mount unreadable at this scale (colour on colour if gules) |
| 2 | Italian 67, Agosti | Per fess argent and gules, in chief an eagle displayed sable, in base a chalice or | partition + beast + object | |
| 3 | Italian 67, Amico | Per fess gules and azure, in chief two scissors(?) argent, in base two arms clasped (fede) | partition, pictorial charge | fede (hands) |
| 4 | Italian 67, Barni | Gules a fess or between three helmets argent | ordinary between charges 2+1 | helmet is an object with a drawn interior |
| 5 | Italian 67, Abbondi | Azure a lion passant holding a sword argent; base per fess argent and gules | lion with attribute; three-band field | |
| 6 | Italian 67, Abro d'Pagratide | Argent a dove volant with olive branch within a wreath vert | pictorial, wreath | wreath enclosure, not a bordure |
| 7 | Italian 67, Balsamo | Quarterly or and gules with a serpent and a bird | quarterly + small charges | identity of charges uncertain |
| 8 | Italian 67, Baracca | Argent a horse rampant sable, a chief azure with three stars or | field charge + charged chief | |
| 9 | Italian 67, Adamo | Azure a lion passant argent; base: a fess or over gules with three stars argent | three bands, charges on two | |
| 10 | Italian 67, Acerbo | Gules three cypresses vert on a mount, water in base | landscape charge | trees and water: non-geometric |
| 11 | Italian 67, Baiardi | Or a horse's head couped sable | single pictorial charge | |
| 12 | Italian 67, Bagatti-Valsecchi | Quarterly: soldier; crowned eagle; ox couchant on a terrace; three fleurs-de-lis | quarterly, four different coats | human figure |
| 13 | Italian 67, Abbate | Per fess argent with three stars sable; chequy argent and gules | partition + chequy | |
| 14 | Italian 67, Antonelli | Azure a mermaid blowing a trumpet in a sea | pictorial | the hardest kind of charge |
| 15 | Italian 67, Adda-Salvaterra | Per fess or with a crowned eagle sable; barry wavy argent and azure | partition + wavy lines | wavy partition lines |
| 16 | Italian 67, Baroffio dall'Aglio | Quarterly: griffin; sun in splendour; serpent; bee | four pictorial charges | |
| 17 | Scots, Douglas (Earl of Douglas 1357) | Argent a heart gules, on a chief azure three mullets argent | charged chief | |
| 18 | Scots, Cunningham (Glencairn 1488) | Argent a shakefork sable | rare geometric charge | the shakefork |
| 19 | Scots, Campbell (Argyll 1457) | Gyronny of eight or and sable, quartered with Lorne: argent a lymphad sable | gyronny, quartering, ship | lymphad |
| 20 | Scots, Kennedy (Cassilis 1509) | Argent a chevron gules between three cross crosslets fitchy sable, within a double tressure flory counter-flory gules | ordinary between charges, tressure | double tressure |
| 21 | Scots, Middleton (1656) | Per fess or and gules, a lion rampant within a double tressure flory counter-flory counterchanged | counterchange over a partition | counterchanged tressure |
| 22 | Scots, Stewart (Moray 1562) | Royal arms quartered with Stewart, debruised by a baton sinister | mark of bastardy | overall debruisement |
| 23 | Rolland Pl. V, Gaillard d'Embreville | Or a chevron gules between three cross crosslets | ordinary between charges | |
| 24 | Rolland Pl. V, Gainsborough | Argent a cross between four crosslets, hatched lozengy | fretty/lozengy field | hatching renders lozengy as a lattice |

The sample says what the sigils sample said: a small vocabulary covers most items (fields, partitions, ordinaries, 2-and-1 arrangements, a chief, a bordure), and the tail is pictorial. In the corpora of section 4.3 the pictorial tail (beasts, birds, humans, objects beyond the geometric few) is about 45% of principal charges; in the user's Italian page it is 11 of 16.

### 5.2 The engraved look, measured on Rolland's plates

[tools/plate_measure.py](tools/plate_measure.py) on leaves 21 and 251 of vol. III at 400 ppi (15.75 px/mm): [data/rolland_plate_stats.json](data/rolland_plate_stats.json), [data/rolland_leaf0251_shields.json](data/rolland_leaf0251_shields.json).

| quantity | measured | note |
|---|---|---|
| plate layout | 7 columns × 8 rows = 56 shields, ruled cells, cell pitch 14.2 mm across | counted on the plate; pitch from the vertical rules |
| shield size | 12.6–13.0 mm wide, 14.7–15.9 mm high, H/W 1.18–1.22 (n = 10 shields whose outline closed) | one template per plate; flat top, straight sides to 85–90% of the height, rounded base with a small point |
| outline | 2 px = 0.13 mm | |
| hatch line thickness | 2 px = 0.13 mm | median of short ink runs across lines |
| hatch pitch | 3 px by plate-wide autocorrelation, 4–5 px per shield = 0.19–0.32 mm, i.e. 3 to 5 lines per mm, identical for horizontal (azure), vertical (gules) and diagonal (vert, purpure) | the autocorrelation sits at its minimum lag, so treat 0.19 mm as a floor |
| dot pitch (or) | 7.0–7.7 px = 0.45–0.49 mm, dot area 5 px² (≈ 0.16 mm) | 2,741 and 2,250 dots per plate |
| ink inside the frame | 6–8% of the area | |
| lettering | name in engraved roman with a small italic province line under each shield | not measured |

Automatic shield segmentation on these plates succeeded for only 10 of 112 shields (the outlines are 2 px and touch the cell rules), so the shape numbers rest on those ten and on the eye; the hatching numbers are plate-wide and do not depend on segmentation. The mapping itself is Fox-Davies' Fig. 35: or dots, argent plain, gules vertical, azure horizontal, sable crossed, vert diagonal from dexter chief, purpure diagonal from sinister chief; and the placement rule quoted in 2.2: hatching rotates with the shield, never with the page.

### 5.3 The vector look, measured on Commons files

The two SVGs ([data/commons_svg_notes.json](data/commons_svg_notes.json)) show that the Commons style is not flat: gules is drawn in four tones (`#d30707` base, `#e94545` and `#ee6c6c` light, `#cd0707` dark) with dark-red outlines `#800000`, argent in three greys, azure `#377bc8` with `#2c5aa0` outlines; the Mar file uses `#cb1227`/`#b60d21`/`#e82d38`/`#a60712` for gules, `#ffe25c` for or, `#1353b4` for azure, outline `#810201` at 2.7 px on a 410-px shield. Outer shield outlines are 0.4–1.0 px on 410 × 476 px canvases. The user's chart reads as flat because it is shown small; at that size a single tone per tincture with a dark outline of the same hue reproduces it. The heater is the Commons template (H/W ≈ 1.16 including margins). Both files are share-alike: the generator may copy the *measurements*, not the paths.

### 5.4 Parked: the manuscripts

Before the look was fixed, 13 Zürich, 5 Gelre and 7 Grünenberg shields were cut from the scans (4 Zürich ones by hand polygon, the rest automatically; visually verified) and measured: [data/manuscript_measures_parked.json](data/manuscript_measures_parked.json), [samples/zurich_shield_tiles_parked.jpg](samples/zurich_shield_tiles_parked.jpg). Kept because three of its findings bear on the generator whatever the look: the Nellenburg sable-for-azure case (section 3); charge fill, where a single beast covers 27–37% of the shield and its bounding box 80–93% of the shield's width and height (Habsburg lion 0.90 × 0.80, Bohemia lion 0.82 × 0.93, Nellenburg antlers 0.90 × 0.96); and an ordinary's width, the Lorraine bend at 0.20 of the shield's extent across it. The Zürich shield geometry (hung by its corner, widest at 72% of its height, 37 × 32 mm) is irrelevant to the chosen looks and is not carried forward.

## 6. The construction grammar

Two grammars, one composition and one rendering per look. Evidence labels as in the sigils study: **documented** (in a named source), **measured** (section 4 or 5), **proposed** (a modern convention for the generator).

### 6.1 Composition (the blazon tree)

- **Primitives.** Tinctures: two metals (or, argent), five colours (gules, azure, sable, vert, purpure), furs (ermine, vair) and "proper" as a neutral class, with the measured frequencies of 4.2. Field: plain, or divided by a partition line (per fess, per pale, per bend, per chevron, per saltire, quarterly, gyronny, chequy, lozengy, paly, barry, bendy), lines plain or wavy, indented, embattled, engrailed, nebuly. Ordinaries: fess, bars, pale, bend, chevron, chief, cross, saltire, bordure, pile, with the measured rates of 4.3 and widths to be measured on the held-out plates (the parked manuscript bend is 0.20; textbook engraved practice is a fifth to a third). Charges: a taxonomy with a geometric core (mullet, crescent, roundel, annulet, lozenge, cross crosslet, fleur-de-lis, rose, escallop, heart) and a pictorial tail (lion in its attitudes, eagle, boar's head, talbot, horse, bird, fish, tree, tower, key, axe, horn, human figure), each with a line-art and a flat drawing. Brisures: label, bordure, canton, baton sinister. Tressure as a Scottish-mode enclosure. **documented, measured**
- **Topology.** A coat is a tree: field → (partition with sub-fields) → ordinaries → principal charges (count and arrangement: 1; 2 in fess or pale; 3 as 2-and-1 or in fess, pale, bend; 4+; semy) → secondary charges ("between", "accompanied by") → charges on ordinaries ("charged with") → brisures → overall marks. Quartering nests coats; impalement pairs them. Layering order in rendering follows blazon order. **documented**
- **Placement rules.** Charges fill their region: bounding box 80–93% of the free field for a single beast (measured on the manuscripts, to be re-measured on the plates); 2-and-1 for three; the chief takes the top fifth to third; a bordure a tenth; a charge on an ordinary is scaled to the ordinary's width; hatching follows the shield's own axes. **measured, proposed**
- **Permitted transformations.** Tincture swap under the rule of tincture (3% breaches, attributed arms only); counterchange across a partition; differencing by label, bordure, change of a secondary tincture or addition of a charge (the Gaillard plate shows 56 arms of one name differing by exactly these moves); quartering with a second generated coat; impalement. **documented**
- **Parameter distributions.** Per roll, from section 4: tinctures per coat, field and charge tinctures, pairs, charge classes, charge counts, charged-ordinary, bordure, label and semy rates, quartering rate (1% in 1340, 7% in 1483). Two modes are proposed: *c. 1340* (Zürich weights) and *c. 1480* (Grünenberg weights); an *Italian* or *Scottish* mode needs its own counts from Rietstap or the Dictionary of British Arms before it can be claimed. **measured, proposed**

### 6.2 Rendering, engraved

Shield: the Rolland template (flat top, straight sides, rounded base, H/W 1.20), outline 0.13 mm at plate scale, i.e. about 1% of the shield's width. Tinctures as Petra Sancta hatch patterns in the shield's own frame: pitch 0.19–0.32 mm (1.5–2.5% of shield width), line 0.13 mm (1%), dots on a 0.45–0.49 mm grid (3.6%). Every region (field, sub-field, ordinary, charge) is a clip path over the pattern of its tincture; charges carry their own internal line-art on top, hatched by their tincture where they are large enough and left plain where not (Rolland leaves small charges unhatched, which is why some readings in 5.1 fail). Names below in engraved capitals; the Italian page sets them letterspaced, Rolland in roman with an italic province. **measured, documented**

### 6.3 Rendering, vector

Heater template (H/W ≈ 1.16), one base tone per tincture plus a darker outline of the same hue at about 0.6% of the width, flat fills, charges as filled outlines with no interior shading beyond a single darker line. Palette to be fixed from the user's chart once its file is available; the Commons tones in 5.3 are the fallback. **measured**

### 6.4 The text

A blazon in English generated from the same tree (and optionally French, the language of Rietstap), plus a name. Names can follow the sigils method: an order-2 letter model over a surname corpus of the chosen region with an edit-distance guard against real families in the ordinaries; or the page can print the *real* families that bear the same arms ("also borne by"), which turns the collision problem of 8.5 into content. **proposed**

## 7. What a browser-only generator would need

1. A seeded grammar sampler over the tree of 6.1 with per-roll weights read from `blazon_stats.json`; a canonicaliser that turns a tree into a normalised blazon string for lookup and de-duplication.
2. An SVG renderer with two style modules: clip-path hatching (SVG `<pattern>` per tincture, pattern transform locked to the shield) and flat fills; shield templates; ordinary and partition geometry with the line variants; arrangement logic (2-and-1, in pale, semy with margin).
3. A charge library in two drawings each, own-drawn or CC0 (Armoria's simple charges are CC0; WappenWiki and Commons are not usable as paths): 60–100 charges to match the corpora's tail. This is the cost driver.
4. A collision index: canonical blazons from Clemmensen's Ordinary (87,638), Papworth and Rietstap, hashed and shipped compressed (a few MB), queried in a worker; the page prints matches rather than suppressing them.
5. Text: blazon generator from the tree, name model, and the filters for the sensitive charges of the dossier's section 6.
6. The sigils plumbing: deterministic seeds in the URL, worker rendering, PNG and SVG export, batch page, no server calls after load.

## 8. Success criteria, fixed now

Held-out material, drawn by seed 20261026 before any grammar work and listed in [data/holdout.json](data/holdout.json): six Zürich strip windows (faces 3r, 3v, 2v), Gelre ff. 28, 38, 78, 98, Grünenberg BSB pp. 100, 173, 178, 185, 209, 301, and Rolland vol. III leaves 140, 160, 258, 440, 524, 716. None has been opened. The Zürich and Grünenberg items inside those regions, with their coded blazons, are the composition targets; the Rolland leaves are the rendering targets.

1. **Fit.** The frozen grammar encodes at least 95% of development coats (Zürich and Grünenberg items outside the held-out regions) with no free-text escape; unmodelled charges go to a named bucket whose share is reported.
2. **Held-out reconstruction, composition.** The frozen grammar encodes at least 95% of the held-out coded blazons without new primitives. A custodian who did not work on the grammar maps the held-out regions to Clemmensen numbers.
3. **Held-out reconstruction, rendering.** (a) Round trip: three readers literate in blazon, who did not work on the project, blazon 40 rendered held-out coats, 20 engraved and 20 in colour; pass at 90% agreement on field, ordinaries, charge identity and count, and tinctures, with 85% on tinctures read from hatching alone. (b) Against the plates: for every held-out Rolland arms whose blazon is in Rietstap's text, render it and compare the hatching-decoded tincture map of the plate with the renderer's, after registering the shields; pass at a mean intersection-over-union of 0.90 over regions, computed with the same decoder on both.
4. **Distribution.** As in the sigils acceptance test: a feature vector per coat (field class, charge classes, charge count, tincture count, partition and brisure flags, rule compliance), energy distance between 500 generated and 500 corpus coats no larger than the 95th percentile of 500 corpus halvings, largest per-feature KS likewise, per roll mode.
5. **Diversity and distance from sources.** Mean pairwise feature distance at least 0.8 of the corpus's; no canonical blazon repeated in 500 draws more often than the corpus's own commonest (2.2% for *fess* in Zürich). Every output is looked up in the three ordinaries; the exact-match rate is reported, not hidden, with the target that at least 70% of outputs have no exact match once complexity is tuned. Where a match exists the page says so.
6. **Blind assessment.** Five readers (two armorists, one print or engraving historian, two heraldry-society members), none involved in annotation; 48 cards each: 16 genuine (Rolland crops for the engraved set, Commons renderings for the colour set), 16 generated, 8 negative controls (rule-of-tincture breaches, mis-hatched tinctures, a charge drawn in the wrong style), 8 near-copies of genuine arms; judged for plausibility as a page from the tradition, structural coherence and suspected copying, separately, on five points. Pass when the 95% interval for generated-minus-genuine plausibility lies within ±0.5, negative controls score lower, and copies are recognised above chance; analysed with reader and card effects, not 240 votes. Too little precision is inconclusive, not a pass.
7. **Browser.** Deterministic seeds, offline after load, under 100 ms per coat on an ordinary laptop, SVG export, charge library under 2 MB.

## 9. Verdict

**Go**, conditional on the charge library being budgeted up front and on tests 3 and 6. Reasons: the grammar is documented and its parameters are already counted from free editions; the two looks are measured conventions, not interpretations; licences are clean; the sigils toolchain (seeded grammar, worker renderer, acceptance tests, name model) transfers almost unchanged. What is new relative to DrawShield, Armoria and Heraldicon (dossier, section 5) is exactly what this study supplies: per-roll distributions, an error model from witnesses, two measured period renderings, and pre-registered tests.

**Strongest competing candidate.** Within heraldry: the parked painters'-hand version (section 5.4), which has the richer witness story and CC0 scans but a far costlier renderer. Across systems: cattle brands from registered brand books, whose vernacular grammar (lazy, flying, rocking, bar, quarter-circle) is explicit in the sources, whose public-domain registers pair each mark with owner, county and date, and whose linear marks need no charge library at all; its survey was stopped on the user's instruction before a dossier existed, so this is a judgement, not a finding.

**Observations that would overturn the choice.**
- Readers fail the hatching round trip (test 3a below 85%) because at display size the Petra Sancta code is illegible; my own uncertain readings of items 1 and 7 in 5.1 are the warning sign. The fix is scale, and if scale is not available the engraved look should carry a printed blazon beside every shield, which is in any case the plan.
- The collision rate stays above 50% even at three-element complexity: the generator would then mostly re-issue real arms, and the honest product becomes an "arms of the day" viewer over the ordinaries rather than a generator.
- The charge library cannot be drawn consistently in two styles within budget, or a usable CC0 set does not exist; without it the outputs are geometric and the Italian page's look is out of reach.
- The user turns out to want the Commons shading (four tones per tincture), which makes every charge a small painting rather than a filled outline.
- The sources of the two reference pages, once named, turn out to be in copyright with conventions that differ from Rolland's (a different shield, different pitch); the renderer would then be re-measured on them.

## Files

- [survey/DOSSIER.md](survey/DOSSIER.md), [survey/links.json](survey/links.json), [survey/MANIFEST.md](survey/MANIFEST.md): the evidence file, every link flagged verified or not; the 16 sample scans (115 MB) stayed outside the repository.
- [data/zurich_items.json](data/zurich_items.json), [data/grunenberg_items.json](data/grunenberg_items.json), [data/blazon_stats.json](data/blazon_stats.json): the parsed corpora and their counts.
- [data/holdout.json](data/holdout.json): the held-out draw.
- [data/rolland_plate_stats.json](data/rolland_plate_stats.json), `data/rolland_leaf*_shields.json`, [data/commons_svg_notes.json](data/commons_svg_notes.json): the two looks, measured.
- [data/manuscript_measures_parked.json](data/manuscript_measures_parked.json), [samples/](samples/): the parked manuscript work and plate previews.
- [tools/](tools/): `parse_clemmensen.py`, `blazon_stats.py`, `plate_measure.py`. Tools named for the real annotation pass: VIA (VGG Image Annotator) for shield and charge polygons, OpenCV and scikit-image for masks, hatching autocorrelation and colour clusters as here, Inkscape for tracing charges, DrawShield's grammar as the parser reference, Clemmensen's `.mdb` through mdbtools or pyodbc for the collision index.
