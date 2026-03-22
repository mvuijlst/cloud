// ─── Globals ────────────────────────────────────────────
let state, king, running, paused, timeoutId, attractTimer, autoRestartTimer, revealTimer;
let chosenSpeed = 3, chosenPersonalityIdx = -1, chosenSuccessors = 1;
let pendingResult, selectedBuild = '';

// ─── Constants ──────────────────────────────────────────
const START_POP = 5000;
const START_GRAIN = 270000;
const START_ACRES = 30000;
const FEED_PER_PERSON = 11;
const PLANT_PER_PERSON = 10; // max acres one person can farm
const SEED_RATE = 2; // 1 bushel seeds 2 acres
const AUTO_START_MS = 4500;
const END_SCREEN_DELAY_MS = 3200;
const AUTO_RESTART_MS = 10000;
const MAX_HEADLINES = 8;

const KING_NAMES = [
  "Anu-Sharrukin","Rimush","Naram-Sin","Shar-Kali","Ibbi-Sin",
  "Ur-Nammu","Shulgi","Lipit-Ishtar","Hammurabi","Samsu-Iluna",
  "Ammi-Ditana","Sumu-Abum","Sin-Muballit","Enlil-Bani","Iddin-Dagan",
  "Ishme-Dagan","Gungunum","Abisare","Nur-Adad","Kudur-Mabuk",
  "Abi-Sare","Shu-Sin","Amar-Sin","Rim-Anum","Warad-Sin",
  "Sin-Iddinam","Bur-Sin","Damiq-Ilishu","Erra-Imitti","Zambiya"
];
const EPITHETS = [
  "the Wise","the Bold","the Cautious","the Ambitious","the Merciful",
  "the Stern","the Generous","the Cunning","the Pious","the Restless",
  "the Steadfast","the Dreamer","the Unyielding","the Patient",
  "the Magnificent","the Terrible","the Just","the Conqueror",
  "the Builder","the Shepherd of Ur"
];
const PERSONALITIES = [
  { name:"Mortal",       feedRatio:0, landBias:0, plantRatio:0, desc:"You alone mandate the decrees.", isPlayer:true, buildPriority:[] },
  { name:"Expansionist", feedRatio:1.04,landBias:0.8, plantRatio:0.8, desc:"Favors acquiring vast lands", buildPriority:['walls','irrigation','granary','temple'] },
  { name:"Benevolent",   feedRatio:0.99, landBias:0.3, plantRatio:0.6, desc:"Puts people above all else", buildPriority:['temple','granary','irrigation','walls'] },
  { name:"Balanced",     feedRatio:0.99,landBias:0.5, plantRatio:0.7, desc:"Seeks measured prosperity",  buildPriority:['granary','temple','walls','irrigation'] },
  { name:"Agrarian",     feedRatio:0.97, landBias:0.2, plantRatio:0.95,desc:"Devoted to the harvest",     buildPriority:['irrigation','granary','temple','walls'] },
  { name:"Hoarder",      feedRatio:0.98, landBias:0.4, plantRatio:0.5, desc:"Stockpiles grain obsessively",buildPriority:['granary','walls','temple','irrigation'] },
  { name:"Reckless",     feedRatio:1.00,landBias:0.7, plantRatio:0.9, desc:"Acts on impulse and whim",   buildPriority:['walls','irrigation','temple','granary'] },
  { name:"Philosopher",  feedRatio:0.94,landBias:0.35,plantRatio:0.65,desc:"Rules through contemplation", buildPriority:['temple','irrigation','granary','walls'] },
];

// Buildings: counted, not leveled. Cost increases with each one built.
const BUILDINGS = {
  granary:    { name:'Granary',       plural:'Granaries',      icon:'\u{1F3DB}\uFE0F', baseCost:3000,  costScale:1500, desc:'Reduces rat & rot losses' },
  walls:      { name:'Fortification', plural:'Fortifications', icon:'\u{1F3F0}',       baseCost:5000,  costScale:2500, desc:'Strengthens defenses' },
  temple:     { name:'Temple',        plural:'Temples',        icon:'\u26E9\uFE0F',    baseCost:4000,  costScale:2000, desc:'Boosts loyalty, wards plague' },
  irrigation: { name:'Canal',         plural:'Canals',         icon:'\u{1F4A7}',       baseCost:6000,  costScale:3000, desc:'Improves harvest yields' },
};

const WEATHER_ICONS = { normal:'\u2600\uFE0F', drought:'\u{1F3DC}\uFE0F', flood:'\u{1F30A}', bountiful:'\u{1F308}' };
const WEATHER_LABELS = { normal:'Fair Skies', drought:'Drought', flood:'Floods', bountiful:'Bountiful Rains' };

// ─── Flavor & Atmosphere ────────────────────────────────
const FLAVOR_LINES = {
  normal: [
    'Children played in the shadow of the ziggurat as the sun crossed a cloudless sky.',
    'Merchants bartered loudly in the market square, their voices carrying over mud-brick walls.',
    'The scent of fresh-baked flatbread drifted from the ovens of the lower quarter.',
    'Fishermen hauled their catch from the canals as egrets circled overhead.',
    'Elders gathered beneath the date palms to argue the merits of the king\u2019s policies.',
    'A traveling musician played a haunting melody on a reed flute at the city gates.',
    'Potters fired their kilns along the riverbank, the smoke curling into a pale sky.',
    'Scribes bent over wet clay tablets, recording the season\u2019s accounts in careful cuneiform.',
    'The temple astronomers reported favorable alignments of the stars.',
    'Laughter echoed from the beer halls as the workday ended.',
    'An old woman sold amulets at the crossroads, each one blessed against the evil eye.',
    'The bread ovens of the temple quarter smoked from dawn to dusk, feeding both priests and petitioners.',
    'Boys raced their reed boats along the canals while women washed linen at the stone steps.',
    'A caravan of donkeys waited at the weighing station while clerks tallied bales of wool.',
    'The evening air carried the sound of a lyre and the smell of roasting mutton from the palace kitchens.',
    'Workers repaired the mud-brick walls of the outer quarter, singing as they mixed straw and clay.',
    'A dispute over water rights between two farmers was settled at the city gate by an elder scribe.',
    'Date wine flowed freely at a wedding feast, and the whole neighborhood danced until the stars appeared.',
    'Copper traders from the east displayed their wares in the courtyard of the merchant guild.',
    'An apprentice scribe cracked his first tablet and wept; his master made him start again on fresh clay.',
    'The canal inspector walked the banks at dawn, noting which sluices needed mending.',
    'Weavers stretched their looms in the shade of the outer wall, their shuttles clicking in rhythm.',
    'Temple slaves carried jars of barley beer to the storerooms beneath the ziggurat.',
    'The night watchman made his rounds, calling the hours and the state of the sky.',
    'A juggler entertained the crowd at the festival of the new moon while children clapped.',
  ],
  drought: [
    'The canals ran low, and dust devils spiraled across the parched fields.',
    'Farmers watched the sky with desperate eyes, praying for clouds that never came.',
    'Cracks split the baked earth like the lines on an old man\u2019s face.',
    'Wells ran dry in the outer villages, and families carried water from the river in clay jars.',
    'The date palms drooped, their fronds brittle and yellow in the relentless heat.',
    'Livestock gathered in the diminishing shade, their ribs showing beneath hides.',
    'Dust coated every surface in the city. Even the temple offerings tasted of grit.',
    'The riverbed showed its bones\u2014stones and old foundations long buried beneath the current.',
    'Children no longer played outside after midday; the heat drove every living thing to shelter.',
    'Water bearers charged double for a jug, and fights broke out at the public cistern.',
    'The air shimmered above the baked fields. Nothing green survived between the canal banks.',
    'Old women burned incense at the river shrine, begging the waters to return.',
    'Birds abandoned the dried marshes. The silence in the reed beds felt like a curse.',
    'Carcasses of fish lay white along the canal margins, and the stench reached the palace.',
  ],
  flood: [
    'The rivers swelled beyond their banks, turning fields into shallow lakes.',
    'Reed boats replaced ox-carts as the waters claimed the lower roads.',
    'Families moved to rooftops and higher ground, watching their gardens submerge.',
    'The waters brought rich silt, but also swept away fences and boundary markers.',
    'Frogs sang in enormous choruses through the flooded nights.',
    'Driftwood and drowned livestock tumbled past the city walls in the brown current.',
    'The temple foundation seeped water, and priests moved the sacred tablets to higher vaults.',
    'Children paddled clay bowls through the flooded streets, laughing at the world turned upside down.',
    'Snakes sought higher ground, and every rooftop seemed to harbor a coiled guest.',
    'The new silt line stood a hand\u2019s breadth above last year\u2019s mark on the granary wall.',
    'When the waters finally drained, boundary disputes erupted across every quarter.',
    'Fishermen hauled enormous catches from the swollen canals\u2014silver bellies flashing in the murk.',
  ],
  bountiful: [
    'Rain fell soft and steady, and the fields shimmered with promise.',
    'Every orchard bowed under the weight of its fruit, as if the earth itself was generous.',
    'The granaries could scarcely contain the bounty, and children ate figs from the branch.',
    'Wildflowers burst across the plains in colors the painters struggled to capture.',
    'The rivers ran clear and strong, and the fish leapt freely.',
    'Birdsong filled the mornings, and the people took it as a sign of divine favor.',
    'Barley grew so thick that workers could barely walk between the rows at harvest time.',
    'Bees swarmed the flowering canal banks, and honey became cheap in every market.',
    'The evening breeze carried the scent of blossoms from the palace gardens to the lowest quarter.',
    'Even the poorest families had meat with their bread this season, and no child went hungry.',
    'Farmers sang harvest hymns as they carried golden sheaves to the threshing floors.',
    'Traders said the abundance of Ur was spoken of as far away as Dilmun and Magan.',
    'The temple granaries overflowed, and the surplus was stacked in the courtyards under woven mats.',
    'Old men said they had not seen such plenty since the reign two kings before.',
    'A double rainbow appeared over the ziggurat, and the priests declared a day of thanksgiving.',
    'So great was the harvest that grain was used to pay debts, settle disputes, and fund festivals.',
    'Mothers set out extra bowls at the evening meal, in case the gods wished to share in the bounty.',
  ],
};

const OMENS = [
  '\u{1F319} The priests reported an unusual alignment of stars\u2014an omen of change.',
  '\u{1F54A}\uFE0F A white dove was seen circling the ziggurat three times before flying east.',
  '\u{1F40D} A two-headed serpent was found near the temple foundations. The augurs debated its meaning.',
  '\u2604\uFE0F A streak of light crossed the night sky. Some called it divine, others called it dread.',
  '\u{1F319} The moon turned the color of copper. The astrologers spoke in worried whispers.',
  '\u{1F3BA} Strange trumpet sounds echoed from the desert at dawn, though no army was in sight.',
  '\u{1F54A}\uFE0F Flocks of birds reversed their migration, wheeling back south in great confusion.',
  '\u{1F30B} The ground trembled briefly. Clay jars fell from shelves and dogs howled through the night.',
  '\u{1F409} Travelers spoke of a great beast seen wading through the marshes at twilight.',
  '\u{1F9D9} A wandering sage arrived at court, offering cryptic counsel before vanishing at dawn.',
  '\u{1F319} The river ran red for a single morning. The priests debated whether it was clay or a sign.',
  '\u{1F54A}\uFE0F An eagle dropped a live fish onto the altar during the morning sacrifice.',
  '\u{1F30C} The sky shimmered green at dusk. Old sailors said the gods were forging something new.',
  '\u{1F319} A child born during the eclipse was said to carry the fate of the dynasty on her brow.',
  '\u{1F40D} Scorpions swarmed the temple steps at midnight and vanished before dawn.',
  '\u2604\uFE0F A stone fell from the sky and was found still warm in a barley field. The priests sealed it in the vault.',
  '\u{1F319} Three stars appeared where the astronomers had mapped only two. The tablets were amended in silence.',
  '\u{1F3BA} The sacred drum in the inner temple split its skin without being struck.',
  '\u{1F54A}\uFE0F A lamb was born with markings that resembled cuneiform. The diviners argued for three days.',
  '\u{1F30B} Steam rose from a crack in the courtyard flagstones. Workers poured libations and backed away.',
  '\u{1F319} The well in the old quarter tasted of honey for a week, then returned to normal.',
  '\u{1F409} A shadow moved across the ziggurat at noon, though the sky was clear.',
  '\u{1F9D9} An ancient tablet was found sealed in a wall during repairs. Its prophecy concerned a city resembling Ur.',
  '\u{1F319} The wind blew from the east for forty days straight. The sailors refused to launch.',
  '\u{1F54A}\uFE0F Crows gathered in unusual numbers on the palace roof. The king ordered extra sacrifices.',
];

const WORLD_AGES = [
  {
    name: 'Age of Caravans',
    icon: '\u{1F42A}',
    desc: 'Trade roads hum with movement and merchants enrich the realm.',
    years: [3, 5],
    immMult: 1.25,
    attackMult: 0.85,
    eventMult: 1.2,
    landPriceDelta: 1,
    weatherBias: { bountiful: 1 }
  },
  {
    name: 'Border Tension',
    icon: '\u2694\uFE0F',
    desc: 'The frontier bristles with rivals and every weakness draws eyes.',
    years: [3, 5],
    attackMult: 1.65,
    loyaltyDelta: -2,
    immMult: 0.75,
    eventMult: 1.15,
    weatherBias: { drought: 1 }
  },
  {
    name: 'Temple Revival',
    icon: '\u26E9\uFE0F',
    desc: 'Priests command unusual devotion and the populace seeks omens everywhere.',
    years: [3, 4],
    plagueMult: 0.65,
    loyaltyDelta: 3,
    eventMult: 1.05
  },
  {
    name: 'Canal Fever',
    icon: '\u{1F4A7}',
    desc: 'Engineers and laborers race to tame the waters for greater harvests.',
    years: [3, 5],
    harvestDelta: 1,
    floodDamageMult: 0.8,
    eventMult: 1.05,
    weatherBias: { flood: 1, bountiful: 1 }
  },
  {
    name: 'Dry Cycle',
    icon: '\u{1F3DC}\uFE0F',
    desc: 'The sky withholds its favor and the land hardens under relentless heat.',
    years: [3, 5],
    harvestDelta: -1,
    attackMult: 1.15,
    eventMult: 1.1,
    weatherBias: { drought: 3, bountiful: -1 }
  },
  {
    name: 'River Blessing',
    icon: '\u{1F308}',
    desc: 'The rivers run kind and the fields answer with abundance.',
    years: [3, 4],
    harvestDelta: 1,
    immMult: 1.2,
    eventMult: 0.95,
    weatherBias: { bountiful: 3, flood: 1 }
  },
  {
    name: 'Courtly Excess',
    icon: '\u{1F37B}',
    desc: 'The palace grows indulgent while waste and intrigue seep through every hall.',
    years: [2, 4],
    loyaltyDelta: -3,
    rotRateMult: 1.25,
    eventMult: 1.25,
    plagueMult: 1.1
  },
  {
    name: 'Settlers\' Rush',
    icon: '\u{1F6B6}',
    desc: 'New families arrive in waves, eager to claim work, land, and safety.',
    years: [2, 4],
    immMult: 1.5,
    loyaltyDelta: 1,
    landPriceDelta: 1,
    eventMult: 1.1
  }
];

const DYNASTY_STYLES = [
  'The Reed Throne', 'The River-Born Court', 'The Bronze Standard', 'The House of Dust and Grain',
  'The Canal Crown', 'The Clay Tablet Dynasty', 'The Horned Crown', 'The Ziggurat Court',
  'The Barley Scepter', 'The Lapis Crown', 'The House of the River Gate'
];

// ─── Age-Specific Flavor ────────────────────────────────
const AGE_FLAVOR = {
  'Age of Caravans': [
    'Camel trains stretched to the horizon, their bells chiming a slow rhythm of commerce.',
    'Foreign merchants haggled in six languages at the weighing stones near the west gate.',
    'The smell of exotic spices\u2014cardamom, cumin, frankincense\u2014drifted through the market streets.',
    'Maps were redrawn as new trade routes opened through the northern passes.',
    'Silver flowed into the city faster than the scribes could tally it.',
    'The caravan master\u2019s guild held more influence at court than some of the old noble families.',
    'A merchant prince built a private granary larger than the temple\u2019s. The priests took note.',
    'Teamsters and guides crowded the beer halls, swapping tales of distant cities and desert bandits.',
  ],
  'Border Tension': [
    'Soldiers drilled in the courtyard at dawn, their bronze spear-tips catching the first light.',
    'Scouts returned from the frontier with reports of campfires and the distant sound of drums.',
    'The smiths worked double shifts, forging arrowheads and repairing shields.',
    'Families near the border packed their valuables and slept with one eye open.',
    'A captured spy was paraded through the streets before being sent to the interrogators.',
    'The king held council late into the night, the map table covered with clay markers and worry.',
    'Veterans gathered at the gate, comparing old scars and speculating about the next campaign.',
    'Watch fires burned along the walls all night. No one complained about the smoke.',
  ],
  'Temple Revival': [
    'Processions wound through every quarter, the priests chanting hymns that shook the ground.',
    'New votives appeared at every shrine\u2014clay figurines, bread offerings, small jars of oil.',
    'The high priest\u2019s word carried more weight in court than the general\u2019s.',
    'Pilgrims from distant cities filled the guest houses and overflowed into tent camps outside the walls.',
    'A new hymn to Nanna was composed, and the whole city learned it within a week.',
    'Omens were read in everything\u2014the flights of birds, the patterns in spilled oil, the shape of clouds.',
    'Temple construction employed hundreds. The ziggurat\u2019s new facing gleamed white in the sun.',
    'Fasting days were declared more frequently, and the beer halls stood quieter than usual.',
  ],
  'Canal Fever': [
    'Surveyors waded through the marshes, planting stakes and arguing over gradients.',
    'The sound of picks and shovels echoed from dawn to dusk along the new canal route.',
    'Engineers sketched plans on damp clay tablets, then tested their designs with wooden models.',
    'Laborers sang work songs as they hauled baskets of earth from the deepening channels.',
    'The smell of fresh-turned mud hung over the city like a second sky.',
    'Disputes over water rights clogged the courts. Every farmer wanted the canal closer to his fields.',
    'A section of new canal collapsed overnight. The engineers blamed the soil; the priests blamed the gods.',
    'When the first water flowed through the completed channel, a crowd gathered to watch and cheer.',
  ],
  'Dry Cycle': [
    'The sky was a pale, merciless white from horizon to horizon, day after day.',
    'Water sellers became the richest merchants in the city. Their donkeys carried liquid gold.',
    'Trees planted in the last good years stood leafless, their bark splitting in the heat.',
    'The priests performed rain ceremonies three times a week. The sky did not answer.',
    'Dust storms swept in from the west, burying fields and blocking roads for days.',
    'Animals crowded the shrinking waterholes, and fights broke out between herders.',
    'The old canals ran at half depth, and the new ones stood dry as bone.',
    'People spoke of moving elsewhere, but no one could agree on where the rains still fell.',
  ],
  'River Blessing': [
    'The river ran generous and clear, and even the oldest farmers smiled at its banks.',
    'Water stood in the fields exactly as long as it was needed, then drained away obediently.',
    'Ducks and geese returned to the marshes in numbers not seen in a generation.',
    'The fishing was so good that catches were salted and stacked for the lean years ahead.',
    'Gardens spilled over their walls with squash, onions, and lentils enough for three cities.',
    'The irrigation officials had little to do; the river did their work for them.',
    'Children swam in the canals every afternoon, and their laughter carried across the fields.',
    'Boatmen raced their reed skiffs on the swollen channels, wagering barley beer on the outcome.',
  ],
  'Courtly Excess': [
    'The palace consumed more beer in a week than the common quarter drank in a month.',
    'Courtiers competed to throw the most lavish feasts, importing delicacies from three kingdoms.',
    'Rumors of financial misconduct in the treasury circulated through the lower quarters.',
    'The king\u2019s wardrobe was said to require twelve servants just to maintain the garments.',
    'A new wing was added to the palace. The workers whispered about the cost.',
    'Officials arrived at court in sedan chairs, their robes heavier with gold each season.',
    'Artists and poets flourished under patronage, but the granaries noticed the withdrawals.',
    'Gossip traveled faster than royal decrees. Every servant had a story; every story had a price.',
  ],
  "Settlers' Rush": [
    'New faces appeared at every corner\u2014families with bundles, craftsmen with tools, hopeful eyes.',
    'Tent cities sprang up outside the walls as newcomers waited for housing to be built.',
    'The population registry grew so fast that the scribes ran out of fresh tablets.',
    'Land disputes multiplied as settlers claimed fields that locals considered common ground.',
    'The newcomers brought unfamiliar customs, foods, and gods. The old residents watched with mixed feelings.',
    'Construction crews worked around the clock, raising new quarters of mud-brick and reed.',
    'The market expanded to accommodate new stalls. A whole street was given over to weavers from the north.',
    'Children of settlers and locals played together in the canals, oblivious to their parents\u2019 tensions.',
  ],
};

// ─── Scribe Asides (quiet years) ────────────────────────
const SCRIBE_ASIDES = [
  'The scribe notes that this year passed without remark in any neighboring chronicle.',
  'Let it be recorded that the granaries were neither full nor empty\u2014a rare equilibrium.',
  'The chronicler pauses to sharpen his stylus. Some years deserve only a line.',
  'This season\u2019s accounts were tallied without error. The chief scribe received a bonus of beer.',
  'The tablet for this year was stored in the second archive, among the routine records.',
  'A marginal note in the scribe\u2019s hand reads: \u201CNothing unusual. The gods were elsewhere.\u201D',
  'The record-keeper observed that the population count matched the previous year\u2019s within a dozen souls.',
  'An apprentice scribe wrote this year\u2019s entry. His master corrected only the date.',
  'The senior archivist filed this tablet under \u201CMiscellaneous\u2014Unremarkable Seasons.\u201D',
  'Let the record show: the people lived, the fields were tended, and the king still sat the throne.',
  'The scribe writes quickly. There are many years yet to record, and the clay dries fast.',
  'A brief notation accompanies this entry: \u201CSteady as the river in its banks.\u201D',
  'The chronicler notes this year alongside seven others of similar character. A stable stretch.',
  'The accounting tablets from this season survive in good condition. Their contents are unremarkable.',
  'In the margin: \u201CAnother year under the same sky. The dynasty endures.\u201D',
];

// ─── Temple Pronouncements ──────────────────────────────
const TEMPLE_VOICE = [
  'The high priest declared the omens favorable and urged the king to proceed with confidence.',
  'The temple augurs examined the liver of a sacrificial sheep and found signs of moderate fortune.',
  'A prayer of thanksgiving was composed for the season. The congregation sang with genuine feeling.',
  'The priests warned that the gods require generosity from those who have been blessed with plenty.',
  'Incense burned day and night in the inner sanctum as the clergy sought guidance for the realm.',
  'The temple astronomers noted the position of the wandering stars and predicted a turning of fortunes.',
  'A new hymn was sung at the equinox ceremony, praising the dynasty\u2019s endurance.',
  'The priests reminded the court that the gods reward patience and punish greed alike.',
  'Sacred bread was distributed to the poor at the temple gates\u2014a tradition older than the dynasty itself.',
  'The diviners read the smoke of the incense and reported: \u201CThe gods are watching, but they are not angry.\u201D',
  'A temple festival marked the changing season. For three days, even the slaves ate meat.',
  'The high priestess spoke to the court of duty, sacrifice, and the weight that crowns impose on mortal heads.',
];

// ─── Market Gossip ──────────────────────────────────────
const MARKET_GOSSIP = [
  '\u201CThe price of barley hasn\u2019t moved in three markets. I don\u2019t know if that\u2019s good or bad.\u201D \u2014a grain trader',
  '\u201CHave you seen the new fortifications? My cousin helped lay the bricks. Says the mortar\u2019s good.\u201D \u2014a laborer',
  '\u201CThe king\u2019s tax collector came through yesterday. Took less than last time, if you can believe it.\u201D \u2014a farmer',
  '\u201CI heard the northern tribes are restless. My brother-in-law saw soldiers heading for the border.\u201D \u2014a weaver',
  '\u201CMy grandmother says this dynasty is no better and no worse than the last one. I say that\u2019s something.\u201D \u2014a potter',
  '\u201CThe fish are running well. If the fields do half as good, we\u2019ll eat through winter.\u201D \u2014a fisherman',
  '\u201CWord at the docks is that copper is cheap this year. Good time to buy tools.\u201D \u2014a smith',
  '\u201CAnother year, another harvest. Still breathing, still planting.\u201D \u2014an old farmer',
  '\u201CThe palace hired thirty new servants this month. Either they\u2019re building something or they\u2019re wasting grain.\u201D \u2014a baker',
  '\u201CMy son starts as a scribe\u2019s apprentice next season. If the dynasty lasts, he\u2019ll keep its records.\u201D \u2014a mother',
  '\u201CThe beer\u2019s thin this season. The brewers blame the barley; I blame the brewers.\u201D \u2014a canal worker',
  '\u201CYou can always tell how the realm is doing by the length of the bread queue. Today it was short.\u201D \u2014a housewife',
];

// ─── Military Reports ───────────────────────────────────
const MILITARY_REPORTS = [
  'The frontier garrison reported no incidents. The walls hold and the sentries remain alert.',
  'A patrol encountered nomadic herders near the border. No hostilities\u2014only wary glances exchanged.',
  'The armory inventory was completed. Stocks of bronze and leather are adequate for the current force.',
  'New recruits were drilled in formation and spear work. The commander reported satisfactory progress.',
  'Scouts mapped a new route along the eastern ridge. It could serve as a retreat path if needed.',
  'The watchtower at the southern pass was repaired after storm damage. Visibility is now excellent.',
  'A small skirmish with bandits ended quickly. Two soldiers were wounded; the bandits scattered.',
  'The general requested additional grain for the border force. The court debated the allocation.',
  'Veterans of the last campaign gathered at the barracks to train the younger soldiers.',
  'A diplomatic envoy passed through the garrison without incident.',
];

// ─── Court Whispers ─────────────────────────────────────
const COURT_WHISPERS = [
  'Whispers in the court suggested the chief advisor had quietly amassed considerable personal wealth.',
  'The queen\u2019s household grew more influential. Her opinions shaped at least two major decrees.',
  'A minor noble was caught forging grain receipts and was quietly exiled to avoid a scandal.',
  'The chamberlain reorganized the palace staff, dismissing several officials of questionable loyalty.',
  'Two noble houses disputed a marriage contract, and the king was forced to arbitrate over dinner.',
  'The royal astrologer fell from favor after an inaccurate prediction, but was later quietly reinstated.',
  'A foreign ambassador was entertained lavishly, though the cost drew murmurs from treasury officials.',
  'An anonymous clay tablet left at the palace gate accused an official of grain theft.',
  'The royal physician treated the king for a minor ailment. The court held its breath for three days.',
  'The heir was seen training with soldiers rather than studying with scribes. Opinions were divided.',
];

// ─── Chronicler Commentary (major events) ───────────────
const CHRONICLER_MAJOR = [
  'Let this year be marked with red clay. It will be remembered.',
  'The scribe\u2019s hand trembled as he pressed the account into the wet tablet. Some years weigh more than others.',
  'This entry was sealed separately and stored in the innermost archive. Future scholars will need it.',
  'The chief chronicler dictated this passage himself, rather than leaving it to an apprentice.',
  'A special tablet was commissioned for this year. The events demanded their own clay.',
  'The senior scribe summoned witnesses to verify the account before sealing the tablet.',
  'This record was copied twice\u2014once for the palace archive and once for the temple vault.',
  'History turns on years like this one. The scribe records it with care.',
  'Let the scholars who follow us read this with attention. The dynasty\u2019s course changed here.',
  'The chronicler marks this year with the sign of the bull\u2014strength tested, outcome uncertain.',
];

// ─── Succession Ceremonies ──────────────────────────────
const SUCCESSION_CEREMONY = [
  'The old king is dead. Three days of mourning were observed before the throne was claimed.',
  'The funeral rites were performed at the ziggurat steps. The body was wrapped in fine linen and laid with jars of beer and grain.',
  'Trumpets sounded from every tower as the new ruler\u2019s name was proclaimed across the city.',
  'The priests anointed the new king with oil pressed from sacred olives. The crowd knelt in silence.',
  'The reed crown was placed upon the successor\u2019s brow. A single dove was released over the palace.',
  'The new ruler\u2019s first act was to pour a libation at the grave of the predecessor.',
  'Courtiers jostled for position around the new throne. Old alliances dissolved; new ones formed by nightfall.',
  'The city held its breath. Succession is never certain, and the first days reveal everything.',
  'The transition was proclaimed in every market square. The public response was measured.',
  'The sacred drum was struck three times. The old reign ended. The new reign began.',
];

// ─── Reign Summaries ────────────────────────────────────
const REIGN_SUMMARIES = {
  good: [
    'The reign of RULER was a time of relative plenty. The granaries grew, the people multiplied, and the borders held.',
    'RULER ruled with a steady hand. Not every year was golden, but the trend was upward. The dynasty is stronger for this reign.',
    'Under RULER, the realm found its footing. Harvests were more good than bad, and the court functioned without scandal.',
  ],
  poor: [
    'The reign of RULER tested the dynasty\u2019s endurance. Harvests faltered, granaries thinned, and the people grew uneasy.',
    'RULER\u2019s tenure was marked by difficulty. Fewer people, less grain, lower loyalty. The next ruler inherits a weakened realm.',
    'Under RULER, the realm contracted. Fields were lost, mouths went unfed, and the court struggled to maintain order.',
  ],
  mixed: [
    'The reign of RULER was a story of two halves\u2014seasons of promise interrupted by seasons of crisis.',
    'RULER leaves behind a mixed record. Some years showed wisdom; others revealed poor fortune or poor judgment.',
    'Under RULER, the realm neither soared nor collapsed. It simply persisted, absorbing shocks and small triumphs alike.',
  ],
};

// ─── Age Transition Ceremonies ──────────────────────────
const AGE_TRANSITION_CEREMONY = [
  'The air itself seemed to shift. Astrologers noted the change; merchants felt it in the markets.',
  'The old mood passed like a season. What came next was different in texture\u2014a new rhythm in the court and the streets.',
  'The chronicler marks a line across the tablet here. What follows belongs to a different era.',
  'Priests performed purification rites at the turn of the age. Whether the gods responded is a matter of faith.',
  'The transition was subtle at first. Only in hindsight could the scribes pinpoint when everything changed.',
  'A new age arrived not with trumpets, but with a slow shift in what the wind carried.',
  'Market prices shifted. Diplomatic tones changed. The generals read different maps. A new age had begun.',
];

// ─── Dynasty Memory Callbacks ───────────────────────────
const MEMORY_CALLBACKS = {
  famine: [
    'The elders still speak of the famine in Year YEAR, when DETAIL perished. The memory tightens every belt.',
    'Scars of the Year YEAR hunger remain\u2014empty houses in the outer quarter, fields still unclaimed.',
    'The granary regulations introduced after the Year YEAR famine remain in force. The court remembers.',
  ],
  plague: [
    'The plague pits from Year YEAR have not yet fully grown over. The city still avoids that quarter.',
    'Survivors of the Year YEAR pestilence are few and graying now. They gather at the temple each equinox.',
    'The temple\u2019s plague hymn, composed after Year YEAR, was sung again this season. Some wept.',
  ],
  invasion: [
    'The breach in the walls from the Year YEAR invasion has been repaired, but the scar is visible.',
    'Veterans of the Year YEAR defense still gather at the barracks to share stories and strong beer.',
    'The captured banners from the Year YEAR invaders hang in the throne room as a warning.',
  ],
  golden: [
    'The older farmers compare every good harvest to the bounty of Year YEAR. Few seasons match it.',
    'The prosperity of Year YEAR set a standard the court still measures itself against.',
    'Songs from the Year YEAR celebrations are still sung at festivals. The melody carries hope.',
  ],
  building: [
    'The DETAIL raised in Year YEAR still stands firm. Workers point to it with pride.',
    'The DETAIL from Year YEAR still serves the realm. Its builders\u2019 names are carved at the base.',
  ],
  succession: [
    'The transition from DETAIL is still discussed at court. Opinions remain divided.',
    'Courtiers who served the old ruler have mostly adapted to the new order. Mostly.',
  ],
};

// ─── Dynasty Reputation ─────────────────────────────────
const DYNASTY_REPUTATIONS = {
  builder: [
    'The dynasty of builders\u2014their works rise above the plain for all to see.',
    'Stone and brick define this line of kings. Their monuments outlast their memories.',
  ],
  feeder: [
    'A dynasty that kept the people fed. Not the stuff of legend, but the foundation of loyalty.',
    'The bread-givers\u2014this line of rulers fed more mouths than any rival.',
  ],
  warlike: [
    'The iron dynasty\u2014their walls stood firm and their enemies learned to fear the name.',
    'A dynasty forged in conflict. The peace they won was always temporary, always hard.',
  ],
  pious: [
    'The gods\u2019 favorites\u2014or so the priests said. The temples prospered under their patronage.',
    'Sacred and solemn, this line of rulers placed the temple above the market.',
  ],
  unstable: [
    'A dynasty of reversals\u2014golden years followed by disaster, recovery followed by collapse.',
    'Unpredictable as the river itself\u2014this dynasty\u2019s legacy is a chronicle of surprises.',
  ],
};

function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function escHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function buildCost(key, current) { return BUILDINGS[key].baseCost + current * BUILDINGS[key].costScale; }
function plainText(html) { var d = document.createElement('div'); d.innerHTML = html; return d.textContent || d.innerText || ''; }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function ageYears(age) { return randInt(age.years[0], age.years[1]); }

// ─── Dynasty Memory System ──────────────────────────────
function addMemory(type, data) {
  if (!state || !state.memory) return;
  state.memory.push({ year: state.year, type: type, data: data || {} });
  if (state.memory.length > 25) state.memory.shift();
}

function getMemoryCallback() {
  if (!state || !state.memory || state.memory.length === 0) return null;
  if (Math.random() > 0.22) return null;
  var m = pick(state.memory);
  var templates = MEMORY_CALLBACKS[m.type];
  if (!templates) return null;
  var text = pick(templates);
  text = text.replace(/YEAR/g, String(m.year));
  text = text.replace(/DETAIL/g, m.data.detail || 'the event');
  return text;
}

function getAgeFlavor() {
  if (!state || !state.worldAge) return null;
  var pool = AGE_FLAVOR[state.worldAge.name];
  return pool ? pick(pool) : null;
}

function getVoiceSnippet(s) {
  // Pick a contextual voice based on game state
  var foodPerCap = s.population > 0 ? s.grain / s.population : 0;
  var pool;
  if (s.worldAge && s.worldAge.name === 'Border Tension') pool = MILITARY_REPORTS;
  else if (s.worldAge && s.worldAge.name === 'Temple Revival') pool = TEMPLE_VOICE;
  else if (s.worldAge && s.worldAge.name === 'Courtly Excess') pool = COURT_WHISPERS;
  else if (foodPerCap > 30 && s.loyalty > 50) pool = MARKET_GOSSIP;
  else if (s.buildings.temple >= 2) pool = TEMPLE_VOICE;
  else if (s.buildings.walls >= 2) pool = MILITARY_REPORTS;
  else pool = pick([MARKET_GOSSIP, TEMPLE_VOICE, COURT_WHISPERS]);
  return pick(pool);
}

function getDynastyReputation(s) {
  var bTotal = s.buildings.granary + s.buildings.walls + s.buildings.temple + s.buildings.irrigation;
  var feedRatio = s.population > 0 ? s.grain / (s.population * FEED_PER_PERSON) : 0;
  if (bTotal >= 6) return pick(DYNASTY_REPUTATIONS.builder);
  if (feedRatio > 3 && s.totalStarved < 500) return pick(DYNASTY_REPUTATIONS.feeder);
  if (s.buildings.walls >= 3) return pick(DYNASTY_REPUTATIONS.warlike);
  if (s.buildings.temple >= 3) return pick(DYNASTY_REPUTATIONS.pious);
  if (s.records && s.records.totalShocks >= 4) return pick(DYNASTY_REPUTATIONS.unstable);
  return null;
}

function generateReignSummary(ruler, startPop, endPop, startGrain, endGrain, startLoyalty, endLoyalty) {
  var popDelta = endPop - startPop;
  var grainDelta = endGrain - startGrain;
  var loyDelta = endLoyalty - startLoyalty;
  var quality = (popDelta > 0 ? 1 : -1) + (grainDelta > 0 ? 1 : -1) + (loyDelta > -10 ? 1 : -1);
  var cat = quality >= 2 ? 'good' : quality <= -1 ? 'poor' : 'mixed';
  var text = pick(REIGN_SUMMARIES[cat]);
  text = text.replace(/RULER/g, ruler.name + ' ' + ruler.epithet);
  return text;
}

function clearAmbientTimers() {
  clearTimeout(attractTimer);
  clearTimeout(autoRestartTimer);
  clearTimeout(revealTimer);
}

function setStartAttractNote(text) {
  var el = document.getElementById('start-attract-note');
  if (el) el.textContent = text || '';
}

function cancelAttractMode() {
  clearTimeout(attractTimer);
  setStartAttractNote('');
}

function scheduleAttractMode() {
  clearTimeout(attractTimer);
  if (!document.getElementById('screen-start').classList.contains('active')) return;
  setStartAttractNote('Ambient mode will begin shortly if left alone.');
  attractTimer = setTimeout(function() {
    if (!document.getElementById('screen-start').classList.contains('active')) return;
    prepareAmbientReign();
    beginReign(true);
  }, AUTO_START_MS);
}

function prepareAmbientReign() {
  selectPersonality(-1);
  chosenSpeed = randInt(3, 5);
  document.querySelectorAll('#speed-options .speed-opt').forEach(function(el) {
    el.classList.toggle('selected', parseInt(el.dataset.speed) === chosenSpeed);
  });
  var slider = document.getElementById('successors-slider');
  if (slider) {
    slider.value = String(randInt(2, 8));
    slider.dispatchEvent(new Event('input'));
  }
  rerollName();
  rerollEpithet();
}

function makeRecords() {
  return {
    peakPop: START_POP,
    peakGrain: START_GRAIN,
    lowestLoyalty: 50,
    bestHarvest: 0,
    worstStarved: 0,
    bestNoStarveStreak: 0,
    noStarveStreak: 0,
    biggestProject: null,
    darkestYear: null,
    totalShocks: 0
  };
}

function pushHeadline(text, tone) {
  if (!state) return;
  state.headlines = state.headlines || [];
  state.headlines.unshift({ year: state.year || 0, text: text, tone: tone || 'neutral' });
  state.headlines = state.headlines.slice(0, MAX_HEADLINES);
  state.currentHeadline = text;
}

function getWeatherPool(age) {
  var counts = { normal: 5, drought: 2, flood: 1, bountiful: 2 };
  var bias = age && age.weatherBias ? age.weatherBias : {};
  Object.keys(bias).forEach(function(k) {
    counts[k] = Math.max(0, (counts[k] || 0) + bias[k]);
  });
  var pool = [];
  Object.keys(counts).forEach(function(k) {
    for (var i = 0; i < counts[k]; i++) pool.push(k);
  });
  return pool.length ? pool : ['normal'];
}

function shiftWorldAge(initial) {
  var oldAge = state.worldAge;
  var options = WORLD_AGES.filter(function(age) {
    return !state.worldAge || age.name !== state.worldAge.name;
  });
  var age = pick(options.length ? options : WORLD_AGES);
  state.worldAge = Object.assign({}, age, {
    startYear: Math.max(1, state.year || 1),
    endYear: Math.max(1, state.year || 1) + ageYears(age) - 1
  });
  if (!initial) {
    var ceremony = pick(AGE_TRANSITION_CEREMONY);
    var html = '<div class="chronicle-divider">' + (oldAge ? oldAge.icon + ' ' + oldAge.name + ' passes' : '\u2500\u2500\u2500') + '</div>';
    html += '<div class="year-entry ceremonial-entry major-entry tone-warn">';
    html += '<div class="year-heading">' + state.worldAge.icon + ' The ' + state.worldAge.name + ' Begins</div>';
    html += '<p class="event-neutral">' + ceremony + '</p>';
    html += '<p class="event-neutral">' + state.worldAge.desc + '</p>';
    // Dynasty context in the new age
    var rep = getDynastyReputation(state);
    if (rep) html += '<p class="scribe-aside">' + rep + '</p>';
    html += '</div>';
    appendChronicle(html);
    pushHeadline(state.worldAge.name + ' begins', 'warn');
  }
}

function updateRecords(r) {
  if (!state || !state.records) return;
  var rec = state.records;
  rec.peakPop = Math.max(rec.peakPop, state.population);
  rec.peakGrain = Math.max(rec.peakGrain, state.grain);
  rec.lowestLoyalty = Math.min(rec.lowestLoyalty, state.loyalty);
  rec.bestHarvest = Math.max(rec.bestHarvest, r.harvestYield);
  rec.worstStarved = Math.max(rec.worstStarved, r.starvedThisTurn);
  if (r.starvedThisTurn === 0) {
    rec.noStarveStreak++;
    rec.bestNoStarveStreak = Math.max(rec.bestNoStarveStreak, rec.noStarveStreak);
  } else {
    rec.noStarveStreak = 0;
  }
  if (r.builtThis && (!rec.biggestProject || r.builtThis.count > rec.biggestProject.count)) {
    rec.biggestProject = { key: r.builtThis.key, count: r.builtThis.count };
  }
  if (r.plagueStruck || (r.threat && !r.threat.repelled) || r.revolt) rec.totalShocks++;
  if (!rec.darkestYear || r.starvedThisTurn > rec.darkestYear.starved) {
    rec.darkestYear = { year: state.year, starved: r.starvedThisTurn };
  }
}

function summarizeRealm(s) {
  var foodPerCap = s.population > 0 ? s.grain / s.population : 0;
  var hist = s.history || [];
  var prev = hist.length > 1 ? hist[hist.length - 2] : null;
  var popDelta = prev ? s.population - prev.pop : 0;
  var grainDelta = prev ? s.grain - prev.grain : 0;
  var rulerCount = s.rulers ? s.rulers.length : 1;
  var curRuler = s.rulers ? s.rulers[s.rulers.length - 1] : null;
  var reignYr = curRuler ? s.year - curRuler.startYear + 1 : s.year;

  // Determine realm mood in chronicle language
  var mood = 'The Realm Holds Steady';
  var sub = 'Neither golden age nor crisis defines this moment. The court waits for the next turn of fate.';

  if (s.loyalty < 20) {
    mood = 'A Realm on the Brink';
    sub = 'The people are near breaking point. Whispers of revolt travel faster than the king\u2019s messengers.';
  } else if (foodPerCap < 12) {
    mood = 'Hunger Stalks the Kingdom';
    sub = 'Granaries are thin and each decree now carries the weight of survival. The scribes record with grim faces.';
  } else if (s.worldAge && s.worldAge.name === 'Border Tension' && s.buildings.walls < 2) {
    mood = 'The Frontier Trembles';
    sub = 'The kingdom watches the borders more closely than the markets. The walls may not be enough.';
  } else if (popDelta > 250 && grainDelta > 5000 && s.loyalty >= 60) {
    mood = 'A Dynasty Ascendant';
    sub = 'Population, stores, and confidence rise together. The scribes dip their styluses in approval.';
  } else if (popDelta < -250 || grainDelta < -15000) {
    mood = 'Fortune Turns Against the Throne';
    sub = 'The recent seasons have turned against the dynasty. Recovery is not assured.';
  } else if (s.worldAge && s.worldAge.name === 'River Blessing') {
    mood = 'The River Smiles on Ur';
    sub = 'The waters favor the realm and every good year builds on the last. Wise rulers save for what follows.';
  } else if (s.loyalty >= 75 && foodPerCap >= 30) {
    mood = 'A Court Well-Loved';
    sub = 'The people speak well of the dynasty. The grain is plentiful and the court commands loyalty.';
  }

  var chips = [];
  chips.push({ text: foodPerCap >= 50 ? 'Stores Overflowing' : foodPerCap >= 24 ? 'Food Secure' : foodPerCap >= 14 ? 'Stores Tight' : 'Bread Crisis', tone: foodPerCap < 14 ? 'bad' : foodPerCap < 24 ? 'warn' : 'good' });
  chips.push({ text: s.loyalty >= 70 ? 'Beloved Court' : s.loyalty >= 45 ? 'Loyalty Holding' : s.loyalty >= 25 ? 'People Uneasy' : 'Unrest Building', tone: s.loyalty < 25 ? 'bad' : s.loyalty < 45 ? 'warn' : 'good' });
  chips.push({ text: s.buildings.walls >= 3 ? 'Walls Strong' : s.buildings.walls > 0 ? 'Defenses Rising' : 'Open Frontier', tone: s.buildings.walls === 0 ? 'warn' : 'neutral' });
  if (rulerCount > 1) chips.push({ text: 'Ruler ' + rulerCount + ', Year ' + reignYr, tone: 'neutral' });

  var watch = [
    '<div class="sb-line"><strong>Court reads:</strong> ' + mood + '</div>',
    '<div class="sb-line"><strong>Chief worry:</strong> ' + (s.loyalty < 25 ? 'the people may rise against the throne' : foodPerCap < 14 ? 'famine and the disorders it brings' : s.worldAge && s.worldAge.name === 'Border Tension' ? 'the armies massing beyond the frontier' : 'the unknowable shock of succession') + '</div>',
    '<div class="sb-line"><strong>Trend:</strong> ' + (popDelta > 150 ? 'the population grows' : popDelta < -150 ? 'the population thins' : grainDelta > 5000 ? 'the granaries fill' : grainDelta < -10000 ? 'the stores drain quickly' : 'the realm holds its course') + '</div>'
  ].join('');

  var records = s.records || makeRecords();
  var recordLines = [
    '<div class="sb-line"><strong>Peak souls:</strong> ' + records.peakPop.toLocaleString() + '</div>',
    '<div class="sb-line"><strong>Richest store:</strong> ' + records.peakGrain.toLocaleString() + '</div>',
    '<div class="sb-line"><strong>Best yield:</strong> ' + records.bestHarvest + ' per acre</div>',
    '<div class="sb-line"><strong>Longest calm:</strong> ' + records.bestNoStarveStreak + ' years</div>',
    records.darkestYear && records.darkestYear.starved > 0 ? '<div class="sb-line"><strong>Darkest hour:</strong> Year ' + records.darkestYear.year + ' (' + records.darkestYear.starved.toLocaleString() + ' dead)</div>' : ''
  ].join('');

  var ageYearsLeft = s.worldAge ? Math.max(0, s.worldAge.endYear - s.year) : 0;
  var ageSummary = s.worldAge
    ? '<div class="sb-line"><strong>' + s.worldAge.icon + ' ' + s.worldAge.name + '</strong></div><div class="sb-line">' + s.worldAge.desc + '</div>' + (ageYearsLeft <= 1 ? '<div class="sb-line" style="opacity:0.55;font-style:italic;">The age is waning\u2026</div>' : '')
    : '<div class="sb-line">The next age has not yet taken shape.</div>';

  return { mood: mood, subline: sub, chips: chips, watch: watch, records: recordLines, ageSummary: ageSummary };
}

function updateSpectatorPanel(s) {
  var summary = summarizeRealm(s);
  document.getElementById('spectator-headline').textContent = s.currentHeadline || summary.mood;
  document.getElementById('spectator-subline').textContent = summary.subline;
  document.getElementById('spectator-chips').innerHTML = summary.chips.map(function(chip) {
    return '<span class="s-chip ' + chip.tone + '">' + chip.text + '</span>';
  }).join('');
  document.getElementById('spectator-watch').innerHTML = summary.watch;
  document.getElementById('spectator-records').innerHTML = summary.records;
  document.getElementById('age-summary').innerHTML = summary.ageSummary;
  document.getElementById('news-ticker').innerHTML = (s.headlines || []).map(function(item) {
    return '<div class="news-item ' + item.tone + '"><small>Y' + item.year + '</small>' + item.text + '</div>';
  }).join('');
}

function headlineForTurn(r) {
  if (r.plagueStruck) return { text: 'Pestilence halved the realm', tone: 'bad' };
  if (r.revolt) return { text: 'Riots erupted across the settlements', tone: 'bad' };
  if (r.threat && !r.threat.repelled) return { text: 'The frontier was breached', tone: 'bad' };
  if (r.threat && r.threat.repelled) return { text: 'Invaders were thrown back at the walls', tone: 'good' };
  if (r.starvedThisTurn > 600) return { text: 'Hunger carved deep into the population', tone: 'bad' };
  if (r.harvestYield >= 9) return { text: 'A harvest for the tablets', tone: 'good' };
  if (r.builtThis && r.builtThis.count >= 3) return { text: 'A major work now defines the capital', tone: 'good' };
  if (r.extraEvent && r.extraEvent.text) return { text: plainText(r.extraEvent.text), tone: r.extraEvent.type === 'bad' ? 'bad' : 'good' };
  return { text: summarizeRealm(state).mood, tone: 'neutral' };
}

// ─── Start-screen init ──────────────────────────────────
(function initStartScreen() {
  var grid = document.getElementById('personality-grid');
  var rnd = document.createElement('div');
  rnd.className = 'personality-opt selected';
  rnd.dataset.idx = '-1';
  rnd.innerHTML = '<div class="p-name">\u{1F3B2} Random</div><div class="p-desc p-random">Let fate decide</div>';
  rnd.onclick = function() { selectPersonality(-1); };
  grid.appendChild(rnd);

  PERSONALITIES.forEach(function(p, i) {
    var el = document.createElement('div');
    el.className = 'personality-opt';
    el.dataset.idx = String(i);
    el.innerHTML = '<div class="p-name">' + p.name + '</div><div class="p-desc">' + p.desc + '</div>';
    el.onclick = function() { selectPersonality(i); };
    grid.appendChild(el);
  });

  document.querySelectorAll('#speed-options .speed-opt').forEach(function(el) {
    el.onclick = function() {
      document.querySelectorAll('#speed-options .speed-opt').forEach(function(e) { e.classList.remove('selected'); });
      el.classList.add('selected');
      chosenSpeed = parseInt(el.dataset.speed);
    };
  });

  // Successors slider
  var slider = document.getElementById('successors-slider');
  var valEl = document.getElementById('successors-val');
  var descEl = document.getElementById('successors-desc');
  function updateSuccDesc() {
    var n = parseInt(slider.value);
    chosenSuccessors = n;
    valEl.textContent = n;
    var rulers = n + 1;
    descEl.textContent = rulers + ' ruler' + (rulers > 1 ? 's' : '') + ' across the ages';
  }
  slider.addEventListener('input', updateSuccDesc);
  updateSuccDesc();

  rerollName();
  rerollEpithet();
})();

function selectPersonality(idx) {
  chosenPersonalityIdx = idx;
  document.querySelectorAll('#personality-grid .personality-opt').forEach(function(el) {
    el.classList.toggle('selected', parseInt(el.dataset.idx) === idx);
  });
}
function rerollName() { document.getElementById('inp-name').value = pick(KING_NAMES); }
function rerollEpithet() { document.getElementById('inp-epithet').value = pick(EPITHETS); }

// ─── Screen transitions ─────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}
function goToStart() {
  clearAmbientTimers();
  showScreen('screen-start');
  rerollName();
  rerollEpithet();
}
function reviewChronicle() {
  clearTimeout(autoRestartTimer);
  showScreen('screen-game');
  var area = document.getElementById('chronicle');
  requestAnimationFrame(function() { area.scrollTop = area.scrollHeight; });
}

// ─── Narrative ──────────────────────────────────────────
function narrateOpening(k) {
  return pick([
    '<span class="emoji-icon">\u{1F305}</span> In the ancient cities of Mesopotamia, a new ruler ascends. ' + k.name + ', ' + k.epithet + ', gazes upon the sun-baked fields and teeming settlements, shoulders heavy with the fate of thousands.',
    '<span class="emoji-icon">\u2728</span> The priests have spoken. The stars have aligned. ' + k.name + ', ' + k.epithet + ', claims dominion over the grain stores, farmlands, and walled cities. The people watch, hopeful yet wary.',
    '<span class="emoji-icon">\u{1F30A}</span> As the great rivers Tigris and Euphrates flood and retreat, a new chapter begins. ' + k.name + ', ' + k.epithet + ', takes the scepter. Thousands look to their sovereign for guidance through the years ahead.',
    '<span class="emoji-icon">\u{1F3DB}\uFE0F</span> From the steps of the great ziggurat, ' + k.name + ', ' + k.epithet + ', surveys a kingdom of mud-brick and ambition. The air smells of river clay and burning incense. A new age beckons.',
    '<span class="emoji-icon">\u{1F3BA}</span> The horns sound across the plains. ' + k.name + ', ' + k.epithet + ', is crowned beneath the watchful eyes of a thousand citizens and the silent gaze of the gods carved in stone.',
    '<span class="emoji-icon">\u{1F54A}\uFE0F</span> A white bird circles the palace as ' + k.name + ', ' + k.epithet + ', takes the reed throne. The scribes dip their styluses. A new chapter is pressed into clay.',
  ]);
}

function narrateStatus(s) {
  var lines = [];
  if (s.starvedThisTurn > 0) {
    lines.push({ text: '<span class="emoji-icon">\u{1F480}</span> <span class="disaster-text">' + pick([
      'Tragedy darkened the year\u2014' + s.starvedThisTurn.toLocaleString() + ' souls perished from hunger, their cries echoing through empty granaries across the realm.',
      'Famine\u2019s cold hand claimed ' + s.starvedThisTurn.toLocaleString() + ' lives. The wailing of the bereaved filled the streets of every settlement.',
      'The grain ran short. ' + s.starvedThisTurn.toLocaleString() + ' of the king\u2019s subjects starved beneath an indifferent sky.',
      s.starvedThisTurn.toLocaleString() + ' mouths went unfed. The weakest fell first\u2014the old, the young, the forgotten. Their memory lingers like dust.',
      'Empty bowls and silent hearths. ' + s.starvedThisTurn.toLocaleString() + ' souls slipped away before the next harvest could save them.',
    ]) + '</span>', cls: 'event-disaster' });
  }
  if (s.immigrants > 0) {
    lines.push({ text: '<span class="emoji-icon">\u{1F6B6}</span> ' + pick([
      'Word of the kingdom spread, and ' + s.immigrants.toLocaleString() + ' newcomers arrived at the city gates, seeking fortune and shelter.',
      s.immigrants.toLocaleString() + ' wanderers from distant lands joined the populace, drawn by rumor of Sumerian prosperity.',
      'The population swelled as ' + s.immigrants.toLocaleString() + ' immigrants settled among the cities, bringing new hands for the fields.',
      'Dust-covered families, ' + s.immigrants.toLocaleString() + ' in number, arrived with their belongings on their backs, hoping for a better life here.',
      s.immigrants.toLocaleString() + ' newcomers crossed the river at dawn\u2014farmers, weavers, and dreamers seeking the safety of the city walls.',
    ]), cls: 'event-neutral' });
  }
  if (s.plagueStruck) {
    lines.push({ text: '<span class="emoji-icon">\u{1F9A0}</span> <span class="disaster-text">' + pick([
      'Then came the pestilence\u2014a horrible plague swept the cities. Half the population was lost to its merciless grip.',
      'Darkness fell upon the realm. A terrible plague ravaged settlement after settlement, claiming half the people.',
      'The gods turned wrathful. Disease crept through the mudbrick quarters, and when it passed, half the kingdom lay still.',
      'A sickness none could name spread through the water. By season\u2019s end, half the realm had perished, and the streets smelled of cedar smoke and grief.',
    ]) + '</span>', cls: 'event-disaster' });
  }
  return lines;
}

function narrateHarvest(s) {
  if (s.harvestYield >= 5) return '<span class="emoji-icon">\u{1F33E}</span> ' + pick([
    'The fields bore abundantly\u2014' + s.harvestYield + ' bushels per acre, a gift from Enlil himself. The granaries swelled with ' + s.totalHarvest.toLocaleString() + ' bushels.',
    'A magnificent harvest! Each acre yielded ' + s.harvestYield + ' bushels, filling the stores with ' + s.totalHarvest.toLocaleString() + ' bushels of golden grain.',
    'The farmers sang as they carried ' + s.totalHarvest.toLocaleString() + ' bushels from the fields\u2014' + s.harvestYield + ' per acre, a harvest worthy of the gods\u2019 approval.',
    'Golden sheaves covered every threshing floor. At ' + s.harvestYield + ' bushels per acre, the total harvest reached ' + s.totalHarvest.toLocaleString() + ' bushels.',
  ]);
  if (s.harvestYield >= 3) return '<span class="emoji-icon">\u{1F33E}</span> ' + pick([
    'The harvest proved adequate\u2014' + s.harvestYield + ' bushels per acre, ' + s.totalHarvest.toLocaleString() + ' bushels carried to the granaries.',
    'A modest yield of ' + s.harvestYield + ' bushels per acre. The farmers gathered ' + s.totalHarvest.toLocaleString() + ' bushels, enough to carry on.',
    'Neither feast nor famine\u2014the earth gave ' + s.harvestYield + ' bushels per acre, totaling ' + s.totalHarvest.toLocaleString() + ' bushels.',
  ]);
  return '<span class="emoji-icon">\u{1F342}</span> ' + pick([
    'The earth was unyielding. Only ' + s.harvestYield + ' bushels per acre\u2014a meager ' + s.totalHarvest.toLocaleString() + ' bushels reaped from the parched soil.',
    'Drought scarred the land. The harvest yielded a pitiful ' + s.harvestYield + ' bushels per acre, leaving the stores dangerously thin.',
    'The farmers worked until their hands bled, but the soil gave only ' + s.harvestYield + ' bushels per acre\u2014' + s.totalHarvest.toLocaleString() + ' bushels in all. Hard times lie ahead.',
  ]);
}

function narrateRats(s) {
  if (s.ratsAte <= 0) return null;
  return '<span class="emoji-icon">\u{1F400}</span> <span class="disaster-text">' + pick([
    'Vermin infested the granaries. Rats devoured ' + s.ratsAte.toLocaleString() + ' bushels before they could be driven out.',
    'Under cover of night, rats ravaged the stores\u2014' + s.ratsAte.toLocaleString() + ' bushels lost to their insatiable hunger.',
    'Despite the guards\u2019 vigil, rats consumed ' + s.ratsAte.toLocaleString() + ' bushels. The king ordered every storehouse sealed with fresh clay.',
  ]) + '</span>';
}

function narrateDecision(s, king) {
  var parts = [];
  if (s.acresBought > 0) parts.push(pick([
    'acquired ' + s.acresBought.toLocaleString() + ' acres of fertile land at ' + s.landPrice + ' bushels each',
    'expanded the kingdom by ' + s.acresBought.toLocaleString() + ' acres, trading grain for soil',
    'purchased ' + s.acresBought.toLocaleString() + ' acres from neighboring tribes',
  ]));
  if (s.acresSold > 0) parts.push(pick([
    'sold ' + s.acresSold.toLocaleString() + ' acres to raise ' + (s.acresSold * s.landPrice).toLocaleString() + ' bushels',
    'parted with ' + s.acresSold.toLocaleString() + ' acres of land, filling coffers with grain',
    'traded away ' + s.acresSold.toLocaleString() + ' acres to bolster the stores',
  ]));
  parts.push(pick([
    'allocated ' + s.bushelsToFeed.toLocaleString() + ' bushels to feed the people',
    'distributed ' + s.bushelsToFeed.toLocaleString() + ' bushels among the hungry populace',
    'set aside ' + s.bushelsToFeed.toLocaleString() + ' bushels for the people\u2019s sustenance',
  ]));
  parts.push(pick([
    'commanded that ' + s.acresPlanted.toLocaleString() + ' acres be sown with seed',
    'ordered ' + s.acresPlanted.toLocaleString() + ' acres planted for the coming harvest',
    'directed the farmers to till and seed ' + s.acresPlanted.toLocaleString() + ' acres',
  ]));
  return king.name + ' ' + parts.join(', ') + '.';
}

function narrateVerdict(result, s, king) {
  var rulerCount = s.rulers ? s.rulers.length : 1;
  var eraWord = rulerCount > 1 ? 'dynasty' : 'reign';
  var lastRuler = s.rulers && s.rulers.length > 0 ? s.rulers[s.rulers.length - 1] : king;
  var years = s.year - (s.startYear || 1);
  var v = {
    impeached: [
      'The chronicle of this ' + eraWord + ' ends in disgrace. ' + s.totalStarved.toLocaleString() + ' souls perished under ruinous rule. The last ruler was dragged from the throne and cast into exile\u2014forever branded unfit to reign.',
      'History remembers this ' + eraWord + ' only with contempt. The starvation of the many proved too great a sin. The people rose, and the throne was overturned in fury and shame.',
      'The clay tablets recording this ' + eraWord + ' are smashed by the victorious mob. ' + s.totalStarved.toLocaleString() + ' bones in unmarked graves testify to a reign the scribes would rather forget.',
      'The throne Room stands empty now. ' + years + ' years of misrule ended not with a battle but with a procession of the starving, their silence louder than any war drum. The ' + eraWord + ' is expunged from the royal registers.',
      'Even the temple priests refuse to intercede. When ' + s.totalStarved.toLocaleString() + ' of the faithful perish with grain still locked in royal stores, the gods themselves turn away. This ' + eraWord + ' earns only ash.',
      'They burned the royal standard at the crossroads. Children will learn this ' + eraWord + ' as a cautionary tale\u2014what happens when rulers forget that grain is not gold, but life itself.',
      'The merchants of Ur say a proverb will outlive this ' + eraWord + ': "Better a dog with scraps than a king with empty granaries." The scribes write nothing more.',
    ],
    legendary: [
      'This ' + eraWord + ' is hailed through the ages as the greatest era Sumeria has ever known. Visionary wisdom surpassed Charlemagne, Disraeli, and Jefferson combined. Songs of this golden era echo for millennia.',
      'The ' + eraWord + ' becomes legend. Prosperity, wisdom, and compassion defined every generation. Scribes carve the tale into eternal clay\u2014the finest sovereignty to ever grace the reed throne.',
      'Poets will struggle for centuries to capture the magnificence of this ' + eraWord + '. The granaries overflowed, the people thrived, and the gods themselves seemed to smile upon the realm.',
      years + ' years that will be studied by every prince who dreams of greatness. The land yielded, the people multiplied, and the coffers swelled. This was not merely good governance\u2014it was art.',
      'When traders from distant lands ask what Ur was like in its glory days, the old ones simply point to the ' + eraWord + ' of ' + lastRuler.name + ' and fall silent. Words would only diminish it.',
      'The temple archives overflow with records of abundance. ' + s.population.toLocaleString() + ' souls fed, the granaries heavy, the canals flowing. This ' + eraWord + ' set a standard against which all others will be measured\u2014and found wanting.',
      'Scholars will debate whether it was wisdom, fortune, or divine favor. The people care not for such distinctions. They know only that they lived in a golden age, and they were grateful.',
    ],
    decent: [
      'An imperfect but genuine ' + eraWord + '. The kingdom endured, the people survived, and history records rulers who tried. Yet ' + Math.floor(s.population * 0.8 * Math.random()).toLocaleString() + ' souls quietly wished for different hands on the scepter.',
      'An adequate ' + eraWord + ' draws to its close. The realm was governed with neither brilliance nor cruelty. The historians note the era with reserved respect\u2014could have been worse, could have been better.',
      'The people will remember this ' + eraWord + ' with a shrug and a sigh. Not the golden age they hoped for, but far from the worst they feared. Life goes on by the rivers.',
      'Competence without inspiration. The ' + eraWord + ' kept the granaries half-full, the people half-content, and the borders half-secure. History grants it the most ambiguous of verdicts: acceptable.',
      years + ' years of governance that produced neither songs nor curses. The scribes record the facts plainly\u2014' + s.population.toLocaleString() + ' subjects remain, the land persists, the story continues. It is enough.',
      'The elders will tell their grandchildren: "We survived." Not thriving, not suffering\u2014merely enduring. In Mesopotamia, where empires rise and crumble like river banks, even endurance deserves respect.',
      'One cannot fault the effort, only the result. The rulers meant well, the decisions were sound enough, and yet greatness remained always just out of reach. The kingdom stands, which is more than many can claim.',
    ],
    tyrant: [
      'The people who remain speak of this ' + eraWord + ' only in whispers of disdain. Heavy hands and hollow granaries defined a dark era. The memory smacks of Nero and Ivan the Terrible.',
      'This ' + eraWord + ' is remembered as a time of suffering. The survivors\u2014few as they are\u2014curse every royal name upon empty plates. History\u2019s judgment is merciless.',
      'The scribes record a bleak ' + eraWord + '. Cruelty and incompetence in equal measure. The fields lay barren, the storehouses empty, and the people\u2019s eyes hollow as the promises made to them.',
      'What remains of Ur after ' + years + ' years of this ' + eraWord + '? A diminished people, depleted fields, and a throne nobody wishes to inherit. The damage will take generations to undo.',
      'The temple walls will be etched with a single damning line: "Under their rule, the strong became weak and the weak became bones." The verdict requires no elaboration.',
      'Traders from Lagash and Eridu will speak of Ur with pity now. A kingdom that once held promise, ground down by rulers who took more than they gave and planted less than they reaped.',
      'Only ' + s.population.toLocaleString() + ' souls remain where once thousands thrived. The mathematics of tyranny are simple: subtract grain, subtract people, subtract hope. The ' + eraWord + ' subtracted all three.',
    ],
  };
  return pick(v[result] || v.decent);
}

// ─── AI Decision Engine ─────────────────────────────────
function makeDecisions(st, k) {
  var p = k.personality;
  var pop = st.population, gr = st.grain, ac = st.acres, lp = st.landPrice;
  var jitter = function() { return 0.92 + Math.random() * 0.16; };

  var bought = 0, sold = 0;

  // Sell land if grain is very low
  if (Math.random() > 0.6 && ac > pop * 5) {
    sold = Math.floor((ac - pop * 5) * (0.1 + Math.random() * 0.3));
    sold = Math.min(sold, ac - 1);
    gr += sold * lp;
  }

  // Feed people
  var feed = Math.floor(pop * FEED_PER_PERSON * p.feedRatio * jitter());
  feed = Math.min(feed, gr);
  feed = Math.max(feed, 0);
  gr -= feed;

  // Buy land
  if (Math.random() < p.landBias && gr > lp * 50) {
    bought = Math.max(0, Math.floor((gr / lp) * (0.1 + Math.random() * 0.25)));
    gr -= bought * lp;
  }

  // Plant
  var curAc = ac + bought - sold;
  var maxSeed = Math.floor(gr * SEED_RATE);
  var maxP = Math.min(maxSeed, pop * PLANT_PER_PERSON, curAc);
  var planted = Math.max(0, Math.min(Math.floor(maxP * p.plantRatio * jitter()), maxP));
  gr -= Math.floor(planted / SEED_RATE);

  // Build — pick one project
  var buildChoice = null;
  if (p.buildPriority && p.buildPriority.length > 0) {
    for (var bi = 0; bi < p.buildPriority.length; bi++) {
      var bk = p.buildPriority[bi];
      var cost = buildCost(bk, st.buildings[bk]);
      if (gr >= cost && Math.random() < 0.45) { buildChoice = bk; break; }
    }
  }

  return { bushelsToFeed: feed, acresBought: bought, acresSold: sold, acresPlanted: planted, buildProject: buildChoice };
}

// ─── Simulation ─────────────────────────────────────────
function simulateYear(st, dec) {
  var age = st.worldAge || {};
  st.acres += dec.acresBought - dec.acresSold;
  st.grain -= dec.acresBought * st.landPrice;
  st.grain += dec.acresSold * st.landPrice;
  st.grain -= dec.bushelsToFeed;
  st.grain -= Math.floor(dec.acresPlanted / SEED_RATE);

  // Build
  var builtThis = null;
  if (dec.buildProject) {
    var bk = dec.buildProject;
    var cost = buildCost(bk, st.buildings[bk]);
    if (st.grain >= cost) {
      st.grain -= cost;
      st.buildings[bk]++;
      builtThis = { key: bk, count: st.buildings[bk], cost: cost };
    }
  }

  // Harvest: base yield 3-7, modified by weather + canals
  var hy = randInt(6, 9);
  if (st.weather === 'drought') hy = Math.max(1, hy - 2);
  else if (st.weather === 'bountiful') hy += 1;
  else if (st.weather === 'flood') hy += 1;
  hy += age.harvestDelta || 0;
  // Canal bonus: each canal adds +0.5, max +4
  hy += Math.min(4, Math.floor(st.buildings.irrigation * 0.5));
  hy = Math.max(1, hy);

  var th = dec.acresPlanted * hy;
  st.grain = Math.max(0, st.grain);

  // Rats: reduced by granaries (each -10%, max 85%)
  var rf = randInt(1, 5), rats = 0;
  if (rf % 2 === 0) {
    rats = Math.floor(st.grain / rf);
    var ratReduce = Math.min(0.85, st.buildings.granary * 0.10);
    rats = Math.floor(rats * (1 - ratReduce));
  }
  st.grain = st.grain - rats + th;

  // Immigration: 1-3% of population, modified by loyalty
  var baseImm = Math.floor(st.population * (0.012123466103882425 + Math.random() * 0.021950812216602295));
  baseImm = Math.floor(baseImm * (age.immMult || 1));
  if (st.loyalty >= 75) baseImm = Math.floor(baseImm * 1.5);
  else if (st.loyalty < 25) baseImm = Math.max(1, Math.floor(baseImm * 0.3));
  var imm = Math.max(1, baseImm);

  // Starvation
  var fed = Math.floor(dec.bushelsToFeed / FEED_PER_PERSON);
  var died = 0, imp = false;
  if (st.population > fed) {
    died = st.population - fed;
    if (died > 0.45 * st.population) imp = true;
    st.totalStarved += died;
    st.avgStarvedPct = ((st.year - 1) * st.avgStarvedPct + died * 100 / st.population) / st.year;
    st.population = fed;
  }
  st.population += imm;

  // Plague: ~8% base chance, reduced by temples (each -10%, max 85%)
  var plague = false;
  if (Math.random() < 0.077 * (age.plagueMult || 1)) {
    var templeBlock = Math.min(0.85, st.buildings.temple * 0.10);
    if (Math.random() >= templeBlock) { st.population = Math.floor(st.population / 2); plague = true; }
  }

  st.landPrice = clamp(randInt(11, 14) + (age.landPriceDelta || 0), 8, 18);

  // Grain rot: granaries help
  var rotAmount = 0;
  if (st.grain > 78000) {
    var rotRate = (0.03 + Math.random() * 0.10) * (age.rotRateMult || 1);
    var rotReduce = Math.min(0.80, st.buildings.granary * 0.10);
    rotRate *= (1 - rotReduce);
    rotAmount = Math.floor((st.grain - 78000) * rotRate);
    st.grain -= rotAmount;
  }

  // Loyalty
  var loyDelta = 0;
  if (died === 0 && st.population > 0) {
    var fRat = dec.bushelsToFeed / (st.population * FEED_PER_PERSON);
    if (fRat >= 1.2) loyDelta += 8;
    else if (fRat >= 0.9) loyDelta += 3;
    else loyDelta -= 2;
  }
  if (died > 0) loyDelta -= Math.min(20, Math.floor(died / (died + st.population) * 30));
  loyDelta += Math.min(8, st.buildings.temple * 2); // temple loyalty bonus
  if (plague) loyDelta -= 10;
  if (builtThis) loyDelta += 4;
  loyDelta += age.loyaltyDelta || 0;
  st.loyalty = Math.max(0, Math.min(100, st.loyalty + loyDelta));

  // Military threat: walls provide defense (each +30)
  var threat = null;
  if (!plague && Math.random() < 0.128 * (age.attackMult || 1)) {
    var tStr = randInt(50, 200 + st.year * 8);
    var def = st.buildings.walls * 30 + st.population * 0.01;
    if (def >= tStr) {
      threat = { repelled: true };
      st.loyalty = Math.min(100, st.loyalty + 5);
    } else {
      var tPop = Math.max(1, Math.floor(st.population * (0.012 + Math.random() * 0.022)));
      var tGr = Math.floor(st.grain * (0.05 + Math.random() * 0.10));
      var tAc = Math.min(randInt(100, 500), Math.max(0, st.acres - 1));
      st.population = Math.max(1, st.population - tPop);
      st.grain = Math.max(0, st.grain - tGr);
      st.acres = Math.max(1, st.acres - tAc);
      threat = { repelled: false, lostPop: tPop, lostGrain: tGr, lostAcres: tAc };
      st.loyalty = Math.max(0, st.loyalty - 8);
    }
  }

  // Flood land damage
  var floodAcres = 0;
  if (st.weather === 'flood' && Math.random() < 0.35) {
    floodAcres = Math.min(randInt(200, 1200), Math.max(0, st.acres - 1));
    floodAcres = Math.floor(floodAcres * (age.floodDamageMult || 1));
    st.acres -= floodAcres;
  }

  // Revolt
  var revolt = null;
  if (st.loyalty < 20 && Math.random() < 0.2 && !plague) {
    var rLoss = Math.max(1, Math.floor(st.population * 0.1));
    st.population = Math.max(1, st.population - rLoss);
    revolt = { lostPop: rLoss };
    st.loyalty = Math.min(100, st.loyalty + 15);
  }

  // Random events (expanded)
  var extraEvent = null;
  if (!plague && !threat && Math.random() < 0.35 * (age.eventMult || 1)) {
    var ev = randInt(1, 18);
    if (ev === 1) {
      var bLoss = Math.floor(st.grain * (0.03 + Math.random() * 0.07));
      var wMit = Math.max(0.05, 1 - st.buildings.walls * 0.08);
      bLoss = Math.floor(bLoss * wMit);
      st.grain = Math.max(0, st.grain - bLoss);
      extraEvent = { type: 'bad', text: '<span class="emoji-icon">\u{1F5E1}\uFE0F</span> <span class="disaster-text">' + pick(['Bandits raided outlying settlements','Marauders struck the trade roads','Brigands descended from the hills']) + (st.buildings.walls > 0 ? ', but the fortifications held \u2014 only ' : ' \u2014 ') + bLoss.toLocaleString() + ' bushels lost.</span>' };
    } else if (ev === 2) {
      var cGr = randInt(2000, 8000); st.grain += cGr; st.loyalty = Math.min(100, st.loyalty + 2);
      extraEvent = { type: 'good', text: '<span class="emoji-icon">\u{1F42A}</span> ' + pick(['A great merchant caravan paid a toll of','Traders from distant Dilmun delivered','A flotilla of reed boats brought']) + ' ' + cGr.toLocaleString() + ' bushels ' + pick(['at the city gates.','as tribute and trade goods.','in exchange for passage through the realm.']) };
    } else if (ev === 3) {
      var fA = Math.min(randInt(300, 1500), Math.max(0, st.acres - 1)); st.acres -= fA;
      extraEvent = { type: 'bad', text: '<span class="emoji-icon">\u{1F30A}</span> <span class="disaster-text">Floodwaters washed away boundary stones \u2014 ' + fA.toLocaleString() + ' acres lost.</span>' };
    } else if (ev === 4) {
      var fP = randInt(50, 300); st.population += fP; st.loyalty = Math.min(100, st.loyalty + 3);
      extraEvent = { type: 'good', text: '<span class="emoji-icon">\u{1F38A}</span> ' + pick(['A grand festival attracted','A religious pilgrimage brought','Word of the kingdom\u2019s prosperity drew']) + ' ' + fP.toLocaleString() + ' new settlers to the realm!' };
    } else if (ev === 5) {
      var lLoss = Math.floor(th * (0.1 + Math.random() * 0.2)); st.grain = Math.max(0, st.grain - lLoss);
      extraEvent = { type: 'bad', text: '<span class="emoji-icon">\u{1F997}</span> <span class="disaster-text">A locust swarm consumed ' + lLoss.toLocaleString() + ' bushels of the harvest.</span>' };
    } else if (ev === 6) {
      var treas = randInt(5000, 15000); st.grain += treas;
      extraEvent = { type: 'good', text: '<span class="emoji-icon">\u{1F48E}</span> ' + pick(['Workers unearthed an ancient cache','Miners struck a sealed chamber','A collapsed wall revealed a forgotten vault']) + ' \u2014 ' + treas.toLocaleString() + ' bushels of preserved grain!' };
    } else if (ev === 7) {
      var mPop = randInt(100, 500); st.population += mPop; st.loyalty = Math.min(100, st.loyalty + 8);
      extraEvent = { type: 'good', text: '<span class="emoji-icon">\u{1F451}</span> A diplomatic marriage brought ' + mPop.toLocaleString() + ' retainers and craftsmen, lifting morale across the realm.' };
    } else if (ev === 8) {
      var dKeys = ['granary', 'walls', 'temple', 'irrigation'].filter(function(k) { return st.buildings[k] > 0; });
      if (dKeys.length > 0) {
        var dk = pick(dKeys); st.buildings[dk]--;
        extraEvent = { type: 'bad', text: '<span class="emoji-icon">\u{1F4A5}</span> <span class="disaster-text">An earthquake toppled a ' + BUILDINGS[dk].name.toLowerCase() + '!</span>' };
      } else {
        var qA = Math.min(randInt(100, 500), Math.max(0, st.acres - 1)); st.acres -= qA;
        extraEvent = { type: 'bad', text: '<span class="emoji-icon">\u{1F4A5}</span> <span class="disaster-text">An earthquake swallowed ' + qA.toLocaleString() + ' acres into fissures.</span>' };
      }
      st.loyalty = Math.max(0, st.loyalty - 5);
    } else if (ev === 9) {
      // Skilled refugees
      var ref = randInt(80, 400); st.population += ref;
      var refGr = randInt(1000, 4000); st.grain += refGr;
      extraEvent = { type: 'good', text: '<span class="emoji-icon">\u{1F3DA}\uFE0F</span> ' + ref.toLocaleString() + ' refugees from a fallen city-state arrived bearing ' + refGr.toLocaleString() + ' bushels and knowledge of distant crafts.' };
    } else if (ev === 10) {
      // Inspiring priest/prophet
      st.loyalty = Math.min(100, st.loyalty + randInt(8, 15));
      extraEvent = { type: 'good', text: '<span class="emoji-icon">\u{1F54C}</span> A charismatic priest arose among the people, preaching unity and devotion. Loyalty surged across the realm.' };
    } else if (ev === 11) {
      // River changes course
      var lostA = Math.min(randInt(500, 2000), Math.max(0, st.acres - 1));
      var gainA = randInt(200, lostA);
      st.acres = st.acres - lostA + gainA;
      extraEvent = { type: 'bad', text: '<span class="emoji-icon">\u{1F30A}</span> <span class="disaster-text">The great river shifted its course! ' + lostA.toLocaleString() + ' acres were submerged, though ' + gainA.toLocaleString() + ' new acres of silt emerged downstream.</span>' };
    } else if (ev === 12) {
      // Artisan boom
      var boost = randInt(3000, 10000); st.grain += boost; st.loyalty = Math.min(100, st.loyalty + 3);
      extraEvent = { type: 'good', text: '<span class="emoji-icon">\u{1F3A8}</span> A flowering of artisans and craftspeople enriched the markets. Trade boomed, netting ' + boost.toLocaleString() + ' extra bushels in commerce.' };
    } else if (ev === 13) {
      // Corrupt officials
      var stolen = Math.floor(st.grain * (0.04 + Math.random() * 0.06));
      st.grain = Math.max(0, st.grain - stolen); st.loyalty = Math.max(0, st.loyalty - 5);
      extraEvent = { type: 'bad', text: '<span class="emoji-icon">\u{1F3AD}</span> <span class="disaster-text">Corrupt officials were discovered siphoning ' + stolen.toLocaleString() + ' bushels from the royal stores! Trust in the court wavered.</span>' };
    } else if (ev === 14) {
      // Foreign emissary
      var gift = randInt(3000, 12000); st.grain += gift; st.loyalty = Math.min(100, st.loyalty + 4);
      extraEvent = { type: 'good', text: '<span class="emoji-icon">\u{1F4DC}</span> An emissary from ' + pick(['Elam','Dilmun','Magan','Meluhha','Akkad','Lagash']) + ' arrived bearing gifts of ' + gift.toLocaleString() + ' bushels and proposals of alliance.' };
    } else if (ev === 15) {
      // Wild fire in fields
      var burnedA = Math.min(randInt(200, 800), Math.max(0, st.acres - 1));
      var burnedG = Math.floor(st.grain * (0.02 + Math.random() * 0.04));
      st.acres -= burnedA; st.grain = Math.max(0, st.grain - burnedG);
      extraEvent = { type: 'bad', text: '<span class="emoji-icon">\u{1F525}</span> <span class="disaster-text">Wildfires swept through the dry grasslands, consuming ' + burnedA.toLocaleString() + ' acres and ' + burnedG.toLocaleString() + ' bushels stored in field granaries.</span>' };
    } else if (ev === 16) {
      // Bountiful fishing season
      var fishGr = randInt(2000, 6000); st.grain += fishGr;
      extraEvent = { type: 'good', text: '<span class="emoji-icon">\u{1F41F}</span> The rivers teemed with fish this season! The catch supplemented the stores by ' + fishGr.toLocaleString() + ' bushels\u2019 worth.' };
    } else if (ev === 17) {
      // Epidemic (not plague, just sickness)
      var sick = Math.max(1, Math.floor(st.population * (0.03 + Math.random() * 0.05)));
      st.population = Math.max(1, st.population - sick);
      extraEvent = { type: 'bad', text: '<span class="emoji-icon">\u{1F912}</span> <span class="disaster-text">A fever spread through the crowded quarters. ' + sick.toLocaleString() + ' perished before the sickness abated.</span>' };
    } else if (ev === 18) {
      // Astronomical discovery
      st.loyalty = Math.min(100, st.loyalty + randInt(5, 10));
      extraEvent = { type: 'good', text: '<span class="emoji-icon">\u{1F320}</span> The temple astronomers predicted the flooding of the rivers with uncanny accuracy. The people\u2019s faith in the kingdom\u2019s wisdom deepened.' };
    }
  }

  // Flavor line and omen
  var flavor = pick(FLAVOR_LINES[st.weather] || FLAVOR_LINES.normal);
  var omen = Math.random() < 0.18 ? pick(OMENS) : null;

  return {
    harvestYield: hy, totalHarvest: th, ratsAte: rats, immigrants: imm,
    starvedThisTurn: died, plagueStruck: plague, impeached: imp,
    landPrice: st.landPrice, acresBought: dec.acresBought, acresSold: dec.acresSold,
    bushelsToFeed: dec.bushelsToFeed, acresPlanted: dec.acresPlanted,
    extraEvent: extraEvent, rotAmount: rotAmount, builtThis: builtThis,
    weather: st.weather, threat: threat, floodAcres: floodAcres,
    revolt: revolt, loyaltyDelta: loyDelta,
    flavor: flavor, omen: omen
  };
}

// ─── UI Helpers ─────────────────────────────────────────
function updateStats(s) {
  document.getElementById('s-year').textContent = s.year || '\u2014';
  document.getElementById('s-pop').textContent = s.population.toLocaleString();
  document.getElementById('s-grain').textContent = s.grain.toLocaleString();
  document.getElementById('s-acres').textContent = s.acres.toLocaleString();
  document.getElementById('s-price').textContent = s.landPrice;
  document.getElementById('s-yield').textContent = s.lastYield || '\u2014';
  var se = document.getElementById('s-starved');
  se.textContent = s.totalStarved.toLocaleString();
  se.className = 'ss-val' + (s.totalStarved > 0 ? ' negative' : '');

  document.getElementById('s-progress').textContent = 'Year ' + (s.year || 1);
  document.getElementById('reign-fill').style.display = 'none';

  // Ruler info
  var ri = document.getElementById('bar-ruler-info');
  if (ri && s.rulers && s.rulers.length > 1) {
    var cur = s.rulers[s.rulers.length - 1];
    var reignYr = s.year - cur.startYear + 1;
    ri.textContent = 'Ruler ' + s.rulers.length + ' \u2014 Year ' + reignYr + ' of reign';
    ri.style.display = '';
  } else if (ri) {
    ri.style.display = 'none';
  }

  // Loyalty
  var loy = s.loyalty != null ? s.loyalty : 50;
  document.getElementById('s-loyalty-label').textContent = 'Loyalty: ' + loy;
  var lf = document.getElementById('loyalty-fill');
  lf.style.width = loy + '%';
  lf.style.background = loy >= 60 ? '#7b9e59' : loy >= 30 ? 'var(--gold)' : '#c45a5a';

  // Buildings — show counts
  var bd = document.getElementById('buildings-display');
  if (bd && s.buildings) {
    var bh = '';
    ['granary', 'walls', 'temple', 'irrigation'].forEach(function(k) {
      var b = BUILDINGS[k], ct = s.buildings[k];
      bh += '<div class="b-tag' + (ct > 0 ? ' active' : '') + '">' +
        b.icon + ' <span class="b-lvl">' + (ct > 0 ? '\u00D7' + ct : '\u2014') + '</span></div>';
    });
    bd.innerHTML = bh;
  }

  updateSpectatorPanel(s);
}

function appendChronicle(html) {
  var area = document.getElementById('chronicle');
  var d = document.createElement('div');
  d.innerHTML = html;
  area.appendChild(d);
  while (area.children.length > 48) {
    area.removeChild(area.firstElementChild);
  }
  if (window.innerWidth >= 1060) {
    area.scrollTop = area.scrollHeight;
  } else {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }
}

function getDelay() {
  var v = parseInt(document.getElementById('speed-slider').value);
  return [5000, 3500, 2200, 1200, 600][v - 1];
}

// ─── Begin Reign ────────────────────────────────────────
function beginReign(isAuto) {
  clearAmbientTimers();
  setStartAttractNote('');
  var nameVal = document.getElementById('inp-name').value.trim();
  var epithetVal = document.getElementById('inp-epithet').value.trim();
  var pIdx = chosenPersonalityIdx;

  var aiPersonalities = PERSONALITIES.filter(function(p) { return !p.isPlayer; });
  king = {
    name: escHtml(nameVal || pick(KING_NAMES)),
    epithet: escHtml(epithetVal || pick(EPITHETS)),
    personality: pIdx >= 0 ? PERSONALITIES[pIdx] : pick(aiPersonalities),
  };

  // Generate reign lengths for all rulers
  var numRulers = chosenSuccessors + 1;
  var reignLengths = [];
  for (var i = 0; i < numRulers; i++) {
    reignLengths.push(randInt(6, 18));
  }
  var successionYears = [];
  var cumulative = 0;
  for (var i = 0; i < reignLengths.length - 1; i++) {
    cumulative += reignLengths[i];
    successionYears.push(cumulative + 1);
  }
  var totalYears = reignLengths.reduce(function(a, b) { return a + b; }, 0);

  document.getElementById('speed-slider').value = chosenSpeed;
  document.getElementById('bar-name').textContent = king.name;
  document.getElementById('bar-epithet').textContent = king.epithet;

  state = {
    year: 0,
    population: START_POP,
    grain: START_GRAIN,
    acres: START_ACRES,
    landPrice: randInt(8, 18),
    totalStarved: 0,
    avgStarvedPct: 0,
    lastYield: null,
    loyalty: 50,
    buildings: { granary: 0, walls: 0, temple: 0, irrigation: 0 },
    weather: 'normal',
    history: [{ pop: START_POP, grain: START_GRAIN, acres: START_ACRES, loyalty: 50 }],
    dynastyYears: totalYears,
    successionYears: successionYears,
    reignLengths: reignLengths,
    rulers: [{ name: king.name, epithet: king.epithet, personality: king.personality.name, startYear: 1 }],
    rulerIdx: 0,
    isPlayerDynasty: pIdx === 0,
    headlines: [],
    currentHeadline: 'A new dynasty has taken the throne.',
    records: makeRecords(),
    dynastyStyle: pick(DYNASTY_STYLES),
    autoManaged: !!isAuto || pIdx !== 0,
    memory: [],
  };

  shiftWorldAge(true);
  pushHeadline(king.name + ' ' + king.epithet + ' begins a new dynasty', 'neutral');

  document.getElementById('chronicle').innerHTML = '';
  updateStats(state);
  running = true;
  paused = false;
  document.getElementById('btn-pause').textContent = 'Pause';
  document.getElementById('btn-pause').disabled = false;

  var speedSlider = document.getElementById('speed-slider');
  if (king.personality.isPlayer) { speedSlider.style.display = 'none'; } else { speedSlider.style.display = ''; }

  showScreen('screen-game');

  appendChronicle(
    '<div class="year-entry ceremonial-entry">' +
    '<div class="year-heading">\u{1F451} The Ascension</div>' +
    '<div class="pull-quote">' + king.name + ', ' + king.epithet + ', takes the throne of Ur</div>' +
    '<p>' + narrateOpening(king) + '</p>' +
    '<p class="event-neutral">The realm holds <strong>' + START_POP.toLocaleString() + '</strong> souls, <strong>' + START_ACRES.toLocaleString() + '</strong> acres of farmland, and <strong>' + START_GRAIN.toLocaleString() + '</strong> bushels in the royal granaries. Loyalty stands at <strong>50</strong>.</p>' +
    '<p class="event-neutral">' + king.name + '\u2019s temperament: <em>' + king.personality.name + '</em> \u2014 ' + king.personality.desc.toLowerCase() + '. This court calls itself <em>' + state.dynastyStyle + '</em>.</p>' +
    '<p class="event-neutral">The opening mood is <strong>' + state.worldAge.icon + ' ' + state.worldAge.name + '</strong>: ' + state.worldAge.desc + '</p>' +
    '<p class="scribe-aside">The length of this dynasty is known only to the gods. The chronicler dips his stylus and begins.</p>' +
    '</div>'
  );

  timeoutId = setTimeout(nextYear, getDelay());
}

// ─── Succession ─────────────────────────────────────────
function triggerSuccession() {
  var oldRuler = state.rulers[state.rulerIdx];
  oldRuler.endYear = state.year - 1;
  var reignStart = oldRuler.startYear;
  var startSnap = state.history[Math.max(0, reignStart - 1)] || state.history[0];
  var endSnap = state.history[state.history.length - 1] || startSnap;

  var loyDrop = randInt(15, 25);
  state.loyalty = Math.max(0, state.loyalty - loyDrop);

  var grainTax = Math.floor(state.grain * (0.10 + Math.random() * 0.10));
  state.grain = Math.max(0, state.grain - grainTax);

  var newName = pick(KING_NAMES);
  var newEpithet = pick(EPITHETS);
  var aiPersonalities = PERSONALITIES.filter(function(p) { return !p.isPlayer; });
  var newPersonality;

  if (state.isPlayerDynasty) {
    newPersonality = PERSONALITIES[0];
  } else {
    newPersonality = pick(aiPersonalities);
  }

  // Generate reign summary before swapping ruler
  var reignSummary = generateReignSummary(
    oldRuler, startSnap.pop, endSnap.pop, startSnap.grain, endSnap.grain, startSnap.loyalty, endSnap.loyalty
  );

  king.name = newName;
  king.epithet = newEpithet;
  king.personality = newPersonality;

  state.rulerIdx++;
  state.rulers.push({ name: newName, epithet: newEpithet, personality: newPersonality.name, startYear: state.year });

  document.getElementById('bar-name').textContent = king.name;
  document.getElementById('bar-epithet').textContent = king.epithet;
  if (king.personality.isPlayer) {
    document.getElementById('speed-slider').style.display = 'none';
  } else {
    document.getElementById('speed-slider').style.display = '';
  }

  // Rival claimant (~30%)
  var rivalText = '';
  if (Math.random() < 0.3) {
    var rivalLoss = Math.max(1, Math.floor(state.population * 0.06));
    state.population = Math.max(1, state.population - rivalLoss);
    rivalText = '<p class="event-disaster"><span class="emoji-icon">\u2694\uFE0F</span> <span class="disaster-text">A rival claimant challenged the throne! ' + rivalLoss.toLocaleString() + ' souls were lost in the brief but bloody struggle.</span></p>';
  }

  var ceremony = pick(SUCCESSION_CEREMONY);
  var reignYears = (oldRuler.endYear || state.year) - reignStart + 1;

  // Build ceremonial succession entry
  var html = '<div class="chronicle-divider">\u2500\u2500\u2500 End of Reign \u2500\u2500\u2500</div>';
  html += '<div class="year-entry ceremonial-entry succession-entry">';
  html += '<div class="year-heading">\u{1F451} Succession \u2014 Year ' + state.year + '</div>';
  html += '<div class="reign-banner">' + oldRuler.name + ' ' + oldRuler.epithet + ' \u2014 ' + reignYears + ' year' + (reignYears !== 1 ? 's' : '') + ' on the throne</div>';
  html += '<div class="reign-summary">' + reignSummary + '</div>';
  html += '<p class="event-neutral">' + ceremony + '</p>';
  html += '<p class="event-neutral">' + pick([
    newName + ', ' + newEpithet + ', ascends amid uncertainty and whispered plots.',
    newName + ', ' + newEpithet + ', takes the scepter. The court watches with guarded eyes.',
    newName + ', ' + newEpithet + ', inherits a kingdom in transition. Old alliances dissolve.',
    'The reed throne stands empty for three days before ' + newName + ', ' + newEpithet + ', claims it.',
    newName + ', ' + newEpithet + ', is anointed with sacred oil. The scribes note the date.',
  ]) + '</p>';
  html += '<p class="event-disaster"><span class="emoji-icon">\u{1F4C9}</span> <span class="disaster-text">Loyalty dropped by ' + loyDrop + ' amid the transition. ' + grainTax.toLocaleString() + ' bushels were lost to succession taxes and courtly plunder.</span></p>';
  if (rivalText) html += rivalText;
  html += '<p class="event-neutral">The new ruler\u2019s temperament: <em>' + newPersonality.name + '</em> \u2014 ' + newPersonality.desc.toLowerCase() + '.</p>';
  html += '</div>';

  appendChronicle(html);
  addMemory('succession', { detail: oldRuler.name + ' to ' + newName });
  pushHeadline('Succession: ' + newName + ' ' + newEpithet + ' takes the throne', 'warn');
  updateStats(state);
}

// ─── Game Loop ──────────────────────────────────────────
function nextYear() {
  if (!running) return;
  if (paused) { timeoutId = setTimeout(nextYear, 300); return; }

  state.year++;
  if (state.year > state.dynastyYears) { endGame(); return; }

  // Check for succession
  if (state.successionYears.indexOf(state.year) !== -1) {
    triggerSuccession();
  }

  if (!state.worldAge || state.year > state.worldAge.endYear) {
    shiftWorldAge(false);
  }

  // Roll weather
  var weathers = getWeatherPool(state.worldAge);
  state.weather = pick(weathers);

  if (king.personality.isPlayer) {
    promptPlayerTurn();
  } else {
    var dec = makeDecisions(state, king);
    processTurn(dec);
  }
}

function selectBuild(el, key) {
  document.querySelectorAll('.build-opt').forEach(function(o) { o.classList.remove('selected'); });
  el.classList.add('selected');
  selectedBuild = key;
  var bi = document.getElementById('pl-build');
  if (bi) bi.value = key;
  updateForecast();
}

function updateForecast() {
  var landInput = parseInt(document.getElementById('pl-land').value) || 0;
  var feedInput = parseInt(document.getElementById('pl-feed').value) || 0;
  var plantInput = parseInt(document.getElementById('pl-plant').value) || 0;

  var g = state.grain;
  var a = state.acres;
  var p = state.population;
  var lp = state.landPrice;

  g -= landInput * lp;
  a += landInput;
  g -= feedInput;
  g -= Math.floor(plantInput / SEED_RATE);

  // Building cost
  var buildKey = selectedBuild || '';
  if (buildKey) {
    g -= buildCost(buildKey, state.buildings[buildKey]);
  }

  var valid = (g >= 0 && a >= 0 && a >= plantInput && p * PLANT_PER_PERSON >= plantInput &&
    (landInput >= 0 ? state.grain >= landInput * lp : state.acres >= -landInput) &&
    feedInput >= 0 && plantInput >= 0);

  document.getElementById('f-grain').textContent = Math.floor(g).toLocaleString();
  document.getElementById('f-grain').style.color = g < 0 ? '#d47a7a' : 'inherit';
  document.getElementById('f-land').textContent = Math.floor(a).toLocaleString();
  document.getElementById('f-land').style.color = a < 0 ? '#d47a7a' : 'inherit';
  document.getElementById('f-valid').textContent = valid ? 'Yes' : 'No';
  document.getElementById('f-valid').style.color = valid ? '#9ec47a' : '#d47a7a';
  document.getElementById('btn-enact').disabled = !valid;
}

function promptPlayerTurn() {
  document.getElementById('btn-pause').disabled = true;
  var wBadge = '<span class="weather-badge ' + state.weather + '">' + WEATHER_ICONS[state.weather] + ' ' + WEATHER_LABELS[state.weather] + '</span>';

  var html = '<div class="year-entry" id="player-prompt-' + state.year + '">';
  html += '<div class="year-heading">Year ' + state.year + ' \u2014 Await Your Decrees ' + wBadge + '</div>';
  html += '<div class="decision-box">';

  html += '<div class="field-group" style="margin-bottom: 0.8rem;"><label class="field-label">Land to Buy/Sell (+ Buy / - Sell) [Price: ' + state.landPrice + '/acre]</label>';
  html += '<input type="number" id="pl-land" class="field-input" value="0" style="padding: 0.4rem;" oninput="updateForecast()" /></div>';

  html += '<div class="field-group" style="margin-bottom: 0.8rem;"><label class="field-label">Grain to Feed People (needs ' + FEED_PER_PERSON + ' per person, ' + (state.population * FEED_PER_PERSON).toLocaleString() + ' to feed all)</label>';
  html += '<input type="number" id="pl-feed" class="field-input" value="0" style="padding: 0.4rem;" oninput="updateForecast()" /></div>';

  html += '<div class="field-group" style="margin-bottom: 0.8rem;"><label class="field-label">Acres to Plant (1 bushel seeds ' + SEED_RATE + ' acres, max ' + (state.population * PLANT_PER_PERSON).toLocaleString() + ' by labor)</label>';
  html += '<input type="number" id="pl-plant" class="field-input" value="0" style="padding: 0.4rem;" oninput="updateForecast()" /></div>';

  // Building selection — shows count and next cost
  html += '<div class="build-section"><label class="field-label">Build Project (optional)</label>';
  html += '<div class="build-grid">';
  ['granary', 'walls', 'temple', 'irrigation'].forEach(function(k) {
    var b = BUILDINGS[k], ct = state.buildings[k];
    var cost = buildCost(k, ct);
    html += '<div class="build-opt" data-build="' + k + '" onclick="selectBuild(this,\'' + k + '\')">';
    html += '<div class="bo-icon">' + b.icon + '</div>';
    html += '<div class="bo-name">' + (ct > 0 ? b.plural + ' (\u00D7' + ct + ')' : b.name) + '</div>';
    html += '<div class="bo-cost">' + cost.toLocaleString() + ' bushels</div>';
    html += '<div class="bo-desc">' + b.desc + '</div>';
    html += '</div>';
  });
  html += '<div class="build-opt selected" data-build="" onclick="selectBuild(this,\'\')"><div class="bo-icon">\u2014</div><div class="bo-name">None</div><div class="bo-cost">Save grain</div></div>';
  html += '</div></div>';
  html += '<input type="hidden" id="pl-build" value="">';

  html += '<div id="pl-forecast" style="margin-top:0.8rem; padding: 0.5rem; background:rgba(0,0,0,0.3); border:1px dashed var(--gold-dark); font-size:0.85rem;">';
  html += 'Projected Grain: <span id="f-grain">' + state.grain.toLocaleString() + '</span> | Projected Land: <span id="f-land">' + state.acres.toLocaleString() + '</span> | Valid: <span id="f-valid" style="color:#9ec47a">Yes</span>';
  html += '</div>';

  html += '<button id="btn-enact" class="btn-end primary" style="margin-top: 0.8rem; padding: 0.6rem 1.2rem; font-size: 0.8rem;" onclick="submitPlayerTurn()">Enact Decree</button>';
  html += '</div></div>';

  selectedBuild = '';
  appendChronicle(html);
  updateForecast();

  ['pl-land', 'pl-feed', 'pl-plant'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !document.getElementById('btn-enact').disabled) submitPlayerTurn();
    });
  });
}

function submitPlayerTurn() {
  var landInput = parseInt(document.getElementById('pl-land').value) || 0;
  var feedInput = parseInt(document.getElementById('pl-feed').value) || 0;
  var plantInput = parseInt(document.getElementById('pl-plant').value) || 0;

  var bought = landInput > 0 ? landInput : 0;
  var sold = landInput < 0 ? -landInput : 0;

  sold = Math.min(sold, state.acres);
  var maxBuy = Math.floor(state.grain / state.landPrice);
  if (bought > maxBuy) bought = maxBuy;

  var tmpGrain = state.grain - bought * state.landPrice + sold * state.landPrice;
  var feed = Math.max(0, Math.min(feedInput, tmpGrain));
  tmpGrain -= feed;

  var maxPlantForGrain = Math.floor(tmpGrain * SEED_RATE);
  var maxPlantForPop = state.population * PLANT_PER_PERSON;
  var maxPlantForAcres = state.acres + bought - sold;
  var maxP = Math.min(maxPlantForGrain, maxPlantForPop, maxPlantForAcres);

  var plant = Math.max(0, Math.min(plantInput, maxP));

  var buildChoice = selectedBuild || null;
  selectedBuild = '';

  var promptDiv = document.getElementById('player-prompt-' + state.year);
  if (promptDiv) promptDiv.parentNode.removeChild(promptDiv);

  document.getElementById('btn-pause').disabled = false;
  processTurn({ bushelsToFeed: feed, acresBought: bought, acresSold: sold, acresPlanted: plant, buildProject: buildChoice });
}

function processTurn(dec) {
  var r = simulateYear(state, dec);
  state.lastYield = r.harvestYield;
  state.history.push({ pop: state.population, grain: state.grain, acres: state.acres, loyalty: state.loyalty });
  updateRecords(r);
  var headline = headlineForTurn(r);
  pushHeadline(headline.text, headline.tone);

  // ── Pacing: determine entry weight ──
  var isQuiet = r.starvedThisTurn === 0 && !r.plagueStruck && !r.threat && !r.revolt &&
    !r.extraEvent && r.harvestYield >= 3 && r.harvestYield <= 7 &&
    Math.abs(r.loyaltyDelta) < 10 && !r.builtThis && r.ratsAte < 3000;
  var isMajor = r.plagueStruck || r.revolt || (r.threat && !r.threat.repelled) ||
    r.starvedThisTurn > 400 || r.harvestYield >= 9 || (r.builtThis && r.builtThis.count >= 3);

  // ── Store dynasty memories for callbacks ──
  if (r.plagueStruck) addMemory('plague', { detail: 'half the realm' });
  if (r.starvedThisTurn > 300) addMemory('famine', { detail: r.starvedThisTurn.toLocaleString() });
  if (r.threat && !r.threat.repelled) addMemory('invasion', { detail: 'invaders breached the walls' });
  if (r.harvestYield >= 9) addMemory('golden', { detail: 'a harvest of ' + r.harvestYield + ' per acre' });
  if (r.builtThis) addMemory('building', { detail: BUILDINGS[r.builtThis.key].name.toLowerCase() });

  var wBadge = '<span class="weather-badge ' + r.weather + '">' + WEATHER_ICONS[r.weather] + ' ' + WEATHER_LABELS[r.weather] + '</span>';

  // ── QUIET YEAR: condensed entry ──
  if (isQuiet && Math.random() < 0.55) {
    var qHtml = '<div class="year-entry quiet-entry">';
    qHtml += '<div class="year-heading">Year ' + state.year + ' ' + wBadge + '</div>';
    qHtml += '<div class="decision-box"><div class="decision-label">Royal Decree</div>' + narrateDecision(r, king) + '</div>';
    qHtml += '<p class="event-neutral">' + narrateHarvest(r) + '</p>';
    if (r.immigrants > 50) qHtml += '<p class="event-neutral" style="opacity:0.65;">' + r.immigrants.toLocaleString() + ' newcomers arrived at the gates.</p>';
    // Scribe aside for flavor
    qHtml += '<p class="scribe-aside">' + pick(SCRIBE_ASIDES) + '</p>';
    // Occasionally add a voice snippet or memory callback
    if (Math.random() < 0.35) {
      var callback = getMemoryCallback();
      if (callback) qHtml += '<p class="voice-block">' + callback + '</p>';
      else qHtml += '<p class="voice-block">' + getVoiceSnippet(state) + '</p>';
    }
    qHtml += '</div>';
    appendChronicle(qHtml);
    updateStats(state);
    if (r.impeached) { finishGame('impeached'); return; }
    timeoutId = setTimeout(nextYear, getDelay());
    return;
  }

  // ── STANDARD / MAJOR YEAR: full entry ──
  var entryClass = 'year-entry';
  if (isMajor) {
    entryClass += ' major-entry tone-' + headline.tone;
  } else if (headline.tone === 'bad' || headline.tone === 'good' || headline.tone === 'warn') {
    entryClass += ' major-entry tone-' + headline.tone;
  }
  var html = '<div class="' + entryClass + '">';
  html += '<div class="year-heading">Year ' + state.year + ' of the Reign ' + wBadge + '</div>';

  // Headline as pull-quote for major years
  if (isMajor) {
    html += '<div class="pull-quote">' + headline.text + '</div>';
    html += '<p class="margin-note"><span class="severity-marker ' + (headline.tone === 'bad' ? 'critical' : headline.tone === 'good' ? 'prosperity' : 'warning') + '"></span>' + (headline.tone === 'bad' ? 'Year of Crisis' : headline.tone === 'good' ? 'Year of Triumph' : 'Year of Change') + '</p>';
  } else {
    html += '<p class="event-neutral" style="font-family:Cinzel,serif;font-size:0.74rem;letter-spacing:0.08em;text-transform:uppercase;opacity:0.78;">' + headline.text + '</p>';
  }

  html += '<div class="decision-box"><div class="decision-label">Royal Decree</div>' + narrateDecision(r, king) + '</div>';

  if (r.builtThis) {
    var b = BUILDINGS[r.builtThis.key];
    var countWord = r.builtThis.count === 1 ? 'first' : r.builtThis.count === 2 ? 'second' : r.builtThis.count === 3 ? 'third' : r.builtThis.count + 'th';
    html += '<p class="event-prosperity"><span class="emoji-icon">\u{1F528}</span> The king commanded a great work \u2014 a ' + countWord + ' ' + b.name.toLowerCase() + ' was raised (' + b.desc.toLowerCase() + '), costing ' + r.builtThis.cost.toLocaleString() + ' bushels.</p>';
  }

  html += '<p class="' + (r.harvestYield >= 4 ? 'event-prosperity' : 'event-neutral') + '">' + narrateHarvest(r) + '</p>';
  var rats = narrateRats(r);
  if (rats) html += '<p class="event-disaster">' + rats + '</p>';

  if (r.rotAmount > 0) {
    html += '<p class="event-disaster"><span class="emoji-icon">\u{1F344}</span> <span class="disaster-text">' + r.rotAmount.toLocaleString() + ' bushels of hoarded grain rotted in damp silos.</span></p>';
  }

  narrateStatus(r).forEach(function(e) { html += '<p class="' + e.cls + '">' + e.text + '</p>'; });

  if (r.threat) {
    if (r.threat.repelled) {
      html += '<p class="event-prosperity"><span class="emoji-icon">\u2694\uFE0F</span> A rival city-state marched upon the realm, but the defenders repelled them gloriously!</p>';
    } else {
      html += '<p class="event-disaster"><span class="emoji-icon">\u2694\uFE0F</span> <span class="disaster-text">Invaders breached the defenses! ' + r.threat.lostPop.toLocaleString() + ' slain, ' + r.threat.lostGrain.toLocaleString() + ' bushels seized, ' + r.threat.lostAcres.toLocaleString() + ' acres claimed.</span></p>';
    }
  }

  if (r.floodAcres > 0) {
    html += '<p class="event-disaster"><span class="emoji-icon">\u{1F30A}</span> <span class="disaster-text">Floodwaters carved ' + r.floodAcres.toLocaleString() + ' acres from the kingdom\u2019s edge.</span></p>';
  }

  if (r.revolt) {
    html += '<p class="event-disaster"><span class="emoji-icon">\u{1F525}</span> <span class="disaster-text">Unrest boiled over! ' + r.revolt.lostPop.toLocaleString() + ' citizens fled or perished in riots across the settlements.</span></p>';
  }

  if (r.extraEvent) {
    html += '<p class="' + (r.extraEvent.type === 'bad' ? 'event-disaster' : 'event-prosperity') + '">' + r.extraEvent.text + '</p>';
  }

  // Atmospheric flavor: prefer age-specific, then weather-based
  var ageFl = getAgeFlavor();
  if (ageFl && Math.random() < 0.45) {
    html += '<p class="event-neutral" style="opacity:0.55;font-style:italic;font-size:0.85rem;">' + ageFl + '</p>';
  } else if (r.flavor) {
    html += '<p class="event-neutral" style="opacity:0.55;font-style:italic;font-size:0.85rem;">' + r.flavor + '</p>';
  }

  // Omen (rare)
  if (r.omen) {
    html += '<p class="event-neutral" style="opacity:0.7;font-size:0.85rem;">' + r.omen + '</p>';
  }

  // Voice snippet or memory callback for major entries
  if (isMajor) {
    html += '<p class="scribe-aside">' + pick(CHRONICLER_MAJOR) + '</p>';
    var callback = getMemoryCallback();
    if (callback) html += '<p class="voice-block">' + callback + '</p>';
  } else if (Math.random() < 0.3) {
    html += '<p class="voice-block">' + getVoiceSnippet(state) + '</p>';
  }

  var loyColor = state.loyalty >= 60 ? '#9ec47a' : state.loyalty >= 30 ? 'var(--gold-light)' : '#d47a7a';
  html += '<p class="event-neutral" style="margin-top:0.3rem;opacity:0.6;font-size:0.88rem;">The realm: <strong>' + state.population.toLocaleString() + '</strong> people, <strong>' + state.acres.toLocaleString() + '</strong> acres, <strong>' + state.grain.toLocaleString() + '</strong> bushels. Loyalty: <strong style="color:' + loyColor + '">' + state.loyalty + '</strong></p>';
  html += '</div>';

  appendChronicle(html);
  updateStats(state);

  if (r.impeached) { finishGame('impeached'); return; }
  timeoutId = setTimeout(nextYear, getDelay());
}

function endGame() {
  var app = state.acres / Math.max(state.population, 1);
  var pct = state.avgStarvedPct;
  var loy = state.loyalty;
  var result;
  if (pct > 33 || app < 3 || loy < 10) result = 'impeached';
  else if (pct > 10 || app < 4 || loy < 25) result = 'tyrant';
  else if (pct > 3 || app < 5 || loy < 50) result = 'decent';
  else result = 'legendary';
  finishGame(result);
}

function finishGame(result) {
  running = false;
  clearTimeout(timeoutId);
  clearTimeout(autoRestartTimer);
  clearTimeout(revealTimer);
  pendingResult = result;

  if (state.rulers.length > 0) {
    state.rulers[state.rulers.length - 1].endYear = state.year;
  }

  var icons = { impeached: '\u2620\uFE0F', tyrant: '\u2694\uFE0F', decent: '\u2696\uFE0F', legendary: '\u2728' };
  var rulerCount = state.rulers ? state.rulers.length : 1;
  var eraWord = rulerCount > 1 ? 'dynasty' : 'reign';
  var teasers = {
    impeached: 'The people have spoken. A reckoning awaits.',
    tyrant: 'The ' + eraWord + ' ends in shadow. History will render judgment.',
    decent: 'The ' + eraWord + ' draws to a close. The scribes tally the record.',
    legendary: 'A glorious era ends. Let the final account be read.',
  };

  // Dynasty reputation for the closing
  var rep = typeof getDynastyReputation === 'function' ? getDynastyReputation(state) : '';
  var rulerList = rulerCount > 1
    ? state.rulers.map(function(r) { return r.name + ' ' + r.epithet; }).join(' \u2192 ')
    : king.name + ', ' + king.epithet;

  var html = '<div class="chronicle-divider">\u2500\u2500\u2500 The Chronicle Closes \u2500\u2500\u2500</div>';
  html += '<div class="year-entry ceremonial-entry">';
  html += '<div class="year-heading">' + (icons[result] || '') + ' The ' + (rulerCount > 1 ? 'Dynasty' : 'Reign') + ' Has Ended</div>';
  html += '<div class="pull-quote">' + (teasers[result] || 'The era is over.') + '</div>';
  if (rulerCount > 1) html += '<p class="event-neutral" style="text-align:center;opacity:0.7;font-size:0.85rem;">' + rulerList + '</p>';
  if (rep) html += '<p class="scribe-aside">' + rep + '</p>';
  html += '<div style="margin-top:1rem;text-align:center;">';
  html += '<button onclick="showEndScreen()" style="font-family:Cinzel,serif;font-size:0.95rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--bg-deep);background:linear-gradient(135deg,var(--gold-dark),var(--gold));border:none;border-radius:5px;padding:0.75rem 1.8rem;cursor:pointer;transition:box-shadow 0.25s;"';
  html += ' onmouseover="this.style.boxShadow=\'0 0 20px rgba(201,168,76,0.35)\'" onmouseout="this.style.boxShadow=\'none\'">';
  html += 'View the Reckoning</button></div>';
  html += '</div>';

  appendChronicle(html);
  document.getElementById('btn-pause').textContent = 'Ended';
  document.getElementById('btn-pause').disabled = true;
  revealTimer = setTimeout(showEndScreen, END_SCREEN_DELAY_MS);
}

// ─── Graph ──────────────────────────────────────────────
function drawGraph(data) {
  if (!data || data.length < 2) return '';
  var w = 600, h = 100;

  function getPathAndPoints(key, colorStr) {
    var vals = data.map(function(d) { return Math.max(0, d[key]); });
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    if (max === min) { max += 10; min = Math.max(0, min - 10); }
    var range = max - min;
    min = Math.max(0, min - range * 0.15);
    max = max + range * 0.15;
    range = max - min;

    var pts = vals.map(function(v, i) {
      return { x: (i / (vals.length - 1)) * w, y: h - ((v - min) / range) * h, v: v };
    });
    var dStr = "M " + pts.map(function(p) { return p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" L ");
    return { path: dStr, points: pts, color: colorStr };
  }

  var gPop = getPathAndPoints('pop', 'var(--gold)');
  var gGrain = getPathAndPoints('grain', '#7b9e59');
  var gAcres = getPathAndPoints('acres', '#a67b5b');
  var gLoy = getPathAndPoints('loyalty', '#7a9ed4');

  var html = '<svg viewBox="-40 -25 ' + (w + 80) + ' ' + (h + 50) + '" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;overflow:visible;">';

  html += '<text x="' + (w / 2 - 160) + '" y="-10" style="font-family:\'Cinzel\',serif;font-size:11px;fill:var(--gold);text-anchor:middle;">\u25CF Pop</text>';
  html += '<text x="' + (w / 2 - 55) + '" y="-10" style="font-family:\'Cinzel\',serif;font-size:11px;fill:#7b9e59;text-anchor:middle;">\u25CF Grain</text>';
  html += '<text x="' + (w / 2 + 50) + '" y="-10" style="font-family:\'Cinzel\',serif;font-size:11px;fill:#a67b5b;text-anchor:middle;">\u25CF Acres</text>';
  html += '<text x="' + (w / 2 + 150) + '" y="-10" style="font-family:\'Cinzel\',serif;font-size:11px;fill:#7a9ed4;text-anchor:middle;">\u25CF Loyalty</text>';

  [gAcres, gGrain, gLoy, gPop].forEach(function(g) {
    var isPop = g.color === 'var(--gold)';
    html += '<path stroke="' + g.color + '" fill="none" stroke-width="' + (isPop ? '3' : '2') + '" opacity="' + (isPop ? '1' : '0.4') + '" stroke-linecap="round" stroke-linejoin="round" d="' + g.path + '"/>';

    if (isPop) {
      // Only show points for every Nth data point to avoid clutter on long dynasties
      var step = Math.max(1, Math.floor(g.points.length / 15));
      g.points.forEach(function(p, idx) {
        if (idx % step !== 0 && idx !== g.points.length - 1) return;
        html += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4.5" fill="var(--bg-deep)" stroke="' + g.color + '" stroke-width="2"/>';
        html += '<text x="' + p.x.toFixed(1) + '" y="' + (p.y - 12).toFixed(1) + '" style="font-family:sans-serif;font-size:12px;fill:var(--gold-light);text-anchor:middle;font-weight:bold;">' + Math.floor(p.v).toLocaleString() + '</text>';
      });
    }
  });

  html += '</svg>';
  return html;
}

// ─── History (Hall of Kings) ────────────────────────────
function saveToHistory(record) {
  var hist = JSON.parse(localStorage.getItem('ur_history') || '[]');
  hist.push(record);
  hist.sort(function(a, b) { return b.score - a.score; });
  localStorage.setItem('ur_history', JSON.stringify(hist.slice(0, 10)));
}

function showHistory() {
  var hist = JSON.parse(localStorage.getItem('ur_history') || '[]');
  var html = '';
  if (hist.length === 0) html = '<p style="text-align:center;color:var(--gold-light);opacity:0.7;">No reigns recorded yet.</p>';
  else {
    hist.forEach(function(h, i) {
      html += '<div class="history-entry">';
      html += '<strong style="color:var(--gold);font-family:\'Cinzel\',serif;">#' + (i + 1) + ' ' + h.name + '</strong> &mdash; <em>' + h.verdict + '</em><br>';
      html += '<div style="margin-top:0.3rem;font-size:0.85rem;color:var(--gold-light);opacity:0.8;">Pop: ' + (h.pop || 0).toLocaleString() + ' | Acres: ' + (h.acres || 0).toLocaleString() + ' | Starved: ' + (h.starved || 0).toLocaleString() + (h.years ? ' | ' + h.years + 'yr' : '') + (h.rulers ? ' | ' + h.rulers + ' rulers' : '') + ' | Score: ' + h.score + '</div>';
      html += '</div>';
    });
  }
  document.getElementById('history-list').innerHTML = html;
  document.getElementById('modal-history').classList.add('active');
}

function closeHistory() {
  document.getElementById('modal-history').classList.remove('active');
}

function clearHistory() {
  localStorage.removeItem('ur_history');
  document.getElementById('history-list').innerHTML = '<p style="text-align:center;color:var(--gold-light);opacity:0.7;">No reigns recorded yet.</p>';
}

// ─── End Screen ─────────────────────────────────────────
function showEndScreen() {
  clearTimeout(revealTimer);
  var result = pendingResult;
  var icons = { impeached: '\u2620\uFE0F', tyrant: '\u2694\uFE0F', decent: '\u2696\uFE0F', legendary: '\u2728' };
  var titles = { impeached: 'Downfall & Disgrace', tyrant: 'A Reign of Suffering', decent: 'An Adequate Rule', legendary: 'A Legendary Reign' };
  var rulerCount = state.rulers ? state.rulers.length : 1;

  document.getElementById('end-icon').textContent = icons[result] || '\u2696\uFE0F';
  document.getElementById('end-title').textContent = rulerCount > 1 ? (titles[result] || 'The Reckoning') + ' \u2014 Dynasty' : (titles[result] || 'The Reckoning');
  var kingLine = rulerCount > 1
    ? 'The dynasty of ' + state.rulers.map(function(r) { return r.name + ' ' + r.epithet; }).join(', then ')
    : 'The reign of ' + king.name + ', ' + king.epithet;
  document.getElementById('end-king-line').textContent = kingLine;

  var app = state.population > 0 ? (state.acres / state.population).toFixed(1) : '0';
  var bCount = ['granary', 'walls', 'temple', 'irrigation'].reduce(function(s, k) { return s + state.buildings[k]; }, 0);
  var stats = [
    { v: state.population.toLocaleString(), l: 'Final Population', c: '' },
    { v: state.acres.toLocaleString(), l: 'Acres Held', c: '' },
    { v: state.grain.toLocaleString(), l: 'Grain in Store', c: '' },
    { v: state.totalStarved.toLocaleString(), l: 'Deaths by Famine', c: state.totalStarved > 0 ? ' negative' : '' },
    { v: app, l: 'Acres / Person', c: '' },
    { v: state.avgStarvedPct.toFixed(1) + '%', l: 'Avg Starved / Yr', c: state.avgStarvedPct > 3 ? ' negative' : '' },
    { v: String(state.loyalty), l: 'Final Loyalty', c: state.loyalty < 30 ? ' negative' : '' },
    { v: String(bCount), l: 'Total Buildings', c: '' },
    { v: String(rulerCount), l: 'Rulers', c: '' },
  ];
  document.getElementById('end-stats-grid').innerHTML = stats.map(function(s) {
    return '<div class="end-stat"><div class="es-val' + s.c + '">' + s.v + '</div><div class="es-label">' + s.l + '</div></div>';
  }).join('');

  document.getElementById('end-graph-container').innerHTML = drawGraph(state.history);

  var vc = document.getElementById('end-verdict');
  vc.className = 'verdict-card ' + result;
  vc.innerHTML = '<h3>' + titles[result] + '</h3><p>' + narrateVerdict(result, state, king) + '</p>';

  var score = Math.floor(state.population * 0.4 + state.acres * 0.04 + state.loyalty * 4 + bCount * 150 - state.avgStarvedPct * 40);
  var histName = rulerCount > 1
    ? state.rulers.map(function(r) { return r.name; }).join(' \u2192 ')
    : king.name + ' ' + king.epithet;
  saveToHistory({ name: histName, verdict: titles[result], pop: state.population, acres: state.acres, starved: state.totalStarved, score: score, years: state.dynastyYears, rulers: rulerCount });

  showScreen('screen-end');

  var endNote = document.getElementById('end-autorestart');
  endNote.textContent = '';
}

function togglePause() {
  paused = !paused;
  document.getElementById('btn-pause').textContent = paused ? 'Resume' : 'Pause';
}

document.getElementById('speed-slider').addEventListener('input', function(e) {
  chosenSpeed = parseInt(e.target.value);
  if (running && !paused && !document.getElementById('btn-pause').disabled) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(nextYear, getDelay());
  }
});
