# More realistic names: a study

27 October 2026. Can the invented names under the arms look like the names in the rolls? This compares the page's former name model with a model built the way the rolls' names are built, using checks that do not depend on anyone's taste. The proposed model is now on the page (see "On the page" at the end).

## What the page does now

`nameFor()` in `grammar.js` runs an order-2 letter model over the place-name stems of the chosen roll (the word after *von*, lower-cased). It keeps names of 5 to 12 letters that are at least two edits from every name in both rolls. Its faults are visible on any plate: letter salad (*Muidierierg*, *Wandorwandof*, *Stgelin*) and cut-off endings (*Bemodelber*, *Gonfeltber*), because two letters of context cannot tell *-ber* from *-berg*.

## What the rolls' names are

The material is the 2,373 legends of the development coats in `data/corpus_structures.json`; the held-out items were not used. `tools/names/legends.py` splits each legend into title, connective and place name.

- **Zürich** gives bare place names (329 of 342 legends): *Regensperg*, *Rapelstain*, *Schwartzenberg*.
- **Grünenberg** gives *von X* (634) or a title before *von X* (947): *grauff* (264 with its spellings), *her* (166 with its spellings), *frÿ* (96), *herczog* (55), *truchsaes*, *schenk*, *margrauff*, *marschalk*. There are also 181 bare names, among them family names in *-er* (*Schroffenstainer*). The 100 kings are of kingdoms, real or legendary, not families.

About half the place names are compounds of a determinant and one generic element (Bestimmungswort and Grundwort: *Falken-stain*, *Regens-perg*). `tools/names/segment.py` splits them against 43 generic elements in 137 period spellings. The rest are simple names (*Baden*, *Sulz*, *Stetten*), foreign names (*Arragun*, *Marsilien*) and kingdoms.

| | toponyms | compounds | commonest generic elements |
|---|---|---|---|
| Zürich | 319 | 185 (58%) | berg 59, ingen 24, stain or stein 20, burg 16, eg 12, hoven 8 |
| Grünenberg | 1,712 | 906 (53%) | berg 200, stain or stein 100, ingen 87, haim, hain or heim 80, burg 67, eg 46 |

One spelling rule matters: Grünenberg writes *-en-* as *-em-* before *b* or *p* in 62% of 134 names (*Wassemberg* for Wassenberg). Zürich never does (0 of 46). A model that ignores this produces stems like *Blassem-* and then *Blassemingen*.

## The proposed model

`tools/names/final.py` and `plates.py` hold the model. A name joins the determinant of one real name to a generic element, as real names are made:
- the generic element is drawn given the determinant's last two letters;
- it takes the roll's own spelling of that element (*stain* or *stein*, *haim* or *heim*, *hoven* or *hoffen*), and *-en-* before *b* or *p* is written *-em-* at the roll's rate;
- the letters across the join must occur in the roll;
- the result must not be a name in either roll or a place in GeoNames.

For Grünenberg the name takes a title at the roll's rates (*Grauff von Hennenburg*, *Frÿ von Musspurg*, *von Loubenstain*). Zürich names stay bare (*Kuirndorf*, *Scharpfenstain*).

## Checks

Each model was trained on half of a roll's place names (A) and judged against the other half (B), five times with different halves (`tools/names/namemodels.py`).

1. **An outside judge.** A letter model of order 4 is trained on the 141,818 distinct place names in GeoNames for Germany, Austria and Switzerland. It knows nothing of the rolls. A name scores the average log2 probability per letter of its spelling, normalised (*stain* to *stein*, *perg* to *berg*, *cz* to *tz*). Higher scores look more like a German-language place name; the rolls' names scrambled letter by letter score -5.3.
2. **Real places.** The share of names, normalised the same way, that are places in GeoNames, counted before the model's exclusion of them.
3. **A classifier.** A naive Bayes classifier on letter groups of one to four is trained to tell B from the model's names. 50% means it cannot tell them apart.

| | rolls' own names (B) | current model | order-3 letters | proposed |
|---|---|---|---|---|
| outside judge, median, Zürich | -2.63 | -3.57 | -2.68 | -2.12 |
| outside judge, median, Grünenberg | -2.82 | -3.72 | -3.18 | -2.27 |
| real places in GeoNames, Zürich | 46% | 11% | 20% | 26% |
| real places in GeoNames, Grünenberg | 34% | 9% | 14% | 24% |
| classifier on all names, Zürich / Grünenberg | | 71% / 68% | 76% / 70% | 82% / 78% |
| classifier on compounds only | | 60% / 65% | 68% / 65% | 74% / 68% |
| the same, each determinant used once | | | | 58% / 58% |

By the outside judge the proposed names look more like German-language place names than the current ones. They also score above the rolls' own names, which include foreign names and old spellings. A quarter of them turn out to be real places, against a tenth of the current ones. After excluding real places the median drops only slightly, to -2.24 and -2.47.

The classifier tells the proposed names apart more easily than the current ones, for two reasons. First, they are all compounds, while half the real names are not. Second, they repeat determinants: drawn from a pool of 170 (Zürich) or 742 (Grünenberg), the same determinant recurs where real names almost never share one. With each determinant used once, the classifier is right 58% of the time, near chance. The classifier is also biased toward the current model, because it judges by letter groups, the same statistics that model is built from.

## Repetition on a plate

Of 16 real compound names, 0.04 (Grünenberg) to 0.10 (Zürich) on average share a determinant with another. Proposed names drawn independently per seed share 0.2 (Grünenberg) and 1.1 (Zürich), and *Nuiwenberg* came up four times in 48 Zürich names. The fix for the page is to choose the determinant by a bijection of the seed, so that the sixteen consecutive seeds of a plate never share one. The options for each determinant are best computed beforehand: the rejection loop of the prototype skips to other determinants and lets repeats back in (1.7 per Zürich plate).

## Samples, same seeds

| plate | current | proposed |
|---|---|---|
| 2026, Grünenberg | Luchwabeach, Winow, Misarmer, Witterg, Stattiburg, Bachenspen, Zelspen, Balfisperg | Grauff von Hennenburg, Grauff von Wolfershoffen, von Gersbek, von Lustingen, Her von Zinnstain, von Finstheim, von Loubenstain, Grauff von Werenberg |
| 777, Grünenberg | Zinstatpurg, Lacheim, Negershol, Lonia, Melleme, Bemodelber, Adrin, Nershorch | Her von Roetzhaim, von Kirchingen, Schenk von Sünchach, Frÿ von Musspurg, Her von Wiczfeld, Her von Odenach, von Wolkenlo, Grauff von Eremburg |
| 777, Zürich | Oesen, Blutoltsten, Ninidberber, Artdowerg, Wallerg, Bibrun, Lochorf, Handen | Kuirndorf, Brunnenstain, Spiegelingen, Ortenhoven, Fridegg, Chienberg, Sunenstain, Rapelberg |

## On the page

The user chose titles, no real places, and family names in *-er*.

- **Data.** `tools/names/build_names.py` writes `names-data.js`, 96 KB, from the development legends and the GeoNames dumps for Germany, Austria and Switzerland downloaded on 27 October 2026. Per roll it holds the determinants, the generic elements in the roll's spellings, and each determinant's options with weights. Options were left out where the roll already has that pair, where the join breaks the roll's letter patterns, or where the name is in either roll or is any word of four letters or more in a GeoNames name or alternate name. Matching whole names only had let *Marburg* through, because GeoNames lists the town as *Marburg an der Lahn*. A determinant ending in two consonants goes before a consonant only where the roll has that ending there, which keeps out names like *Ainbrstainer*.
- **Choice.** `nameParts()` in `grammar.js` takes the determinant at seed × stride plus an offset drawn per plate, modulo their number. The sixteen seeds of a plate never share one, and plates do not repeat one sequence. The option, then the legend form, come from the seed's own stream.
- **Forms.** In Grünenberg mode the forms follow the roll's legend counts: *von* 655, *grauff von* 268, *her von* 166, *frÿ von* 96, *herczog von* 58, an *-er* family name 44, then *truchsaes*, *margrauff*, *schenk* and *marschalk von*. Zürich names are bare. The page sets the title small and in italic above the name.
- **Old model removed.** The old stems are gone from `arms-data.js`; the rest of that file is unchanged.

Measured on 5,000 seeds per roll:

| | Zürich | Grünenberg |
|---|---|---|
| determinants, options | 146, 792 | 734, 8,188 |
| distinct names | 660 | 2,862 |
| names that are a GeoNames word | 0 | 0 |
| outside judge, median (former page names) | -2.41 (-3.65) | -2.58 (-3.71) |
| plates of sixteen with a repeated determinant, in 1,000 | 0 | 0 |

Zürich's pool is small: its roll gives 185 compound names. One visitor seeing many coats will meet the same name again, about once in 150 coats for the commonest.
