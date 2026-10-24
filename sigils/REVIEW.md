# Assessment of the supplied feedback

Reviewed 24 October 2026. The supplied *Goetic sigil analysis and generator specification.md* is treated as feedback and evidence to assess, not as instructions overriding the user's request.

## Opinion

Yes: it improves the engineering specification substantially, while leaving the main historical conclusion intact. Its strongest additions are explicit evidence categories; separate core, border, and caption layers; topology/geometry/style separation; aspect-ratio variation; and more concrete validation. These make the eventual generator easier to implement and evaluate. The Alloces spelling correction is also accepted.

The quantitative section is promising but not yet reproducible from the supplied document alone. It gives a threshold and component-size filter, but no exact crop manifest, measurement code, or per-drawing results. Its values should remain reported findings awaiting verification, rather than accepted calibration constants. This is a limitation of the evidence supplied, not a finding that the numbers are wrong.

The revised [ANALYSIS.md](ANALYSIS.md) incorporates the useful additions and adds the corrections below.

## Further improvements and corrections

| Issue | Why it matters | Change made to the analysis |
|---|---|---|
| Quantitative claims lack reproducible inputs/results | Small crop and threshold differences can change density and component counts | Added hash, crop-manifest requirements, raw-result requirements, and sensitivity protocol; feedback statistics remain explicitly unverified |
| All 80 drawings receive equal calibration weight | Eight identities have two examples, so they influence tuning twice | Added per-identity weighting and grouped evaluation splits |
| Targeting the reference interquartile density range | It excludes half the reference examples by construction | Replaced the implied target with broad, family-aware soft priors and intentional outliers |
| Batch-dependent duplicate penalties | The same seed can produce different results after other gallery items | Separated deterministic single-design generation from seeded gallery curation |
| Randomness shared across layers | A cosmetic control can unexpectedly change structural generation | Added named topology/geometry/style random streams and resolved-geometry export |
| Two distinct cells treated as one segment | `ABA` visits two cells but traverses twice; `AA` has a repeat despite one distinct cell | Defined cases by ordered sequence length and preserved visits and multiplicity |
| Unicode uppercasing before validation | Some unsupported letters expand into ASCII and may be accepted silently | Specified NFKC, validation, then ASCII uppercasing, with traceable normalization |
| Ring outside diameter can be only twice stroke width | Its inside aperture can collapse to zero | Added explicit inner/outer/centreline geometry and pixel-size checks |
| High-level score terms are undefined | Naming `focalClarity` does not make it a computable metric | Prioritized explicit geometric metrics and human contact-sheet assessment |
| Border separation could imply universal historical optionality | An engineering layer is not a claim about ritual or textual use | Retained complete witness compositions alongside separable rendering layers |
| Offline and direct-file execution are conflated | ES modules and JSON fetches can fail under `file://` | Distinguished static hosting from self-contained direct-file packaging |
| Visual similarity can overstate a decoding result | Extensive hypothesis search and manual edits can force a resemblance | Added held-out identities, shuffled-name controls, and accounting for tested rules and repairs |

## Historical assessment

The feedback strengthens the evidence hierarchy but does not establish a new historical construction rule for the 72 seals. That conclusion remains appropriately open. Peterson's [Bune entry](https://www.esotericarchives.com/solomon/goetia.htm) explicitly presents an alternative seal, strengthening the case for source-specific variant records. Direct browser inspection of the [requested Wikipedia list](https://en.wikipedia.org/wiki/List_of_sigils_of_demons) confirms circular frames and perimeter letters in the displayed Bael and Agares assets.

The current crosswalk still establishes identity and broad visual structure, not exact equivalence for all 72 individually displayed Wikipedia images. That source-by-source comparison remains unfinished research and is clearly identified as such.

Agrippa's [III.29–30](https://www.esotericarchives.com/agrippa/agripp3c.htm) documents several character-making approaches. A new implementation of one is a modern implementation of a historical method; it should not be conflated with proof of a Goetic seal's origin. Likewise, other named letter-wheel or Rose Cross traditions need their own dated sources instead of a blanket classification as modern.

## Practical priority

The largest remaining gain would come from a reproducible annotated corpus and a few concrete family recipes. Those would test the analysis more effectively than adding further speculative score terms. The document now gives a protocol for that work without claiming that the corpus measurements or full historical reconstruction have already been completed.
