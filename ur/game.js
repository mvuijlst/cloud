// ─── Globals ────────────────────────────────────────────
let state, king, running, paused, timeoutId;
let chosenSpeed = 3, chosenPersonalityIdx = -1, chosenSuccessors = 1;
let pendingResult, selectedBuild = '';

// ─── Constants ──────────────────────────────────────────
const START_POP = 5000;
const START_GRAIN = 270000;
const START_ACRES = 30000;
const FEED_PER_PERSON = 11;
const PLANT_PER_PERSON = 10; // max acres one person can farm
const SEED_RATE = 2; // 1 bushel seeds 2 acres

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
  ],
  drought: [
    'The canals ran low, and dust devils spiraled across the parched fields.',
    'Farmers watched the sky with desperate eyes, praying for clouds that never came.',
    'Cracks split the baked earth like the lines on an old man\u2019s face.',
    'Wells ran dry in the outer villages, and families carried water from the river in clay jars.',
    'The date palms drooped, their fronds brittle and yellow in the relentless heat.',
    'Livestock gathered in the diminishing shade, their ribs showing beneath hides.',
  ],
  flood: [
    'The rivers swelled beyond their banks, turning fields into shallow lakes.',
    'Reed boats replaced ox-carts as the waters claimed the lower roads.',
    'Families moved to rooftops and higher ground, watching their gardens submerge.',
    'The waters brought rich silt, but also swept away fences and boundary markers.',
    'Frogs sang in enormous choruses through the flooded nights.',
  ],
  bountiful: [
    'Rain fell soft and steady, and the fields shimmered with promise.',
    'Every orchard bowed under the weight of its fruit, as if the earth itself was generous.',
    'The granaries could scarcely contain the bounty, and children ate figs from the branch.',
    'Wildflowers burst across the plains in colors the painters struggled to capture.',
    'The rivers ran clear and strong, and the fish leapt freely.',
    'Birdsong filled the mornings, and the people took it as a sign of divine favor.',
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
];

function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function escHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function buildCost(key, current) { return BUILDINGS[key].baseCost + current * BUILDINGS[key].costScale; }

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
  showScreen('screen-start');
  rerollName();
  rerollEpithet();
}
function reviewChronicle() {
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
  var v = {
    impeached: [
      'The chronicle of this ' + eraWord + ' ends in disgrace. ' + s.totalStarved.toLocaleString() + ' souls perished under ruinous rule. The last ruler was dragged from the throne and cast into exile\u2014forever branded unfit to reign.',
      'History remembers this ' + eraWord + ' only with contempt. The starvation of the many proved too great a sin. The people rose, and the throne was overturned in fury and shame.',
      'The clay tablets recording this ' + eraWord + ' are smashed by the victorious mob. ' + s.totalStarved.toLocaleString() + ' bones in unmarked graves testify to a reign the scribes would rather forget.',
    ],
    legendary: [
      'This ' + eraWord + ' is hailed through the ages as the greatest era Sumeria has ever known. Visionary wisdom surpassed Charlemagne, Disraeli, and Jefferson combined. Songs of this golden era echo for millennia.',
      'The ' + eraWord + ' becomes legend. Prosperity, wisdom, and compassion defined every generation. Scribes carve the tale into eternal clay\u2014the finest sovereignty to ever grace the reed throne.',
      'Poets will struggle for centuries to capture the magnificence of this ' + eraWord + '. The granaries overflowed, the people thrived, and the gods themselves seemed to smile upon the realm.',
    ],
    decent: [
      'An imperfect but genuine ' + eraWord + '. The kingdom endured, the people survived, and history records rulers who tried. Yet ' + Math.floor(s.population * 0.8 * Math.random()).toLocaleString() + ' souls quietly wished for different hands on the scepter.',
      'An adequate ' + eraWord + ' draws to its close. The realm was governed with neither brilliance nor cruelty. The historians note the era with reserved respect\u2014could have been worse, could have been better.',
      'The people will remember this ' + eraWord + ' with a shrug and a sigh. Not the golden age they hoped for, but far from the worst they feared. Life goes on by the rivers.',
    ],
    tyrant: [
      'The people who remain speak of this ' + eraWord + ' only in whispers of disdain. Heavy hands and hollow granaries defined a dark era. The memory smacks of Nero and Ivan the Terrible.',
      'This ' + eraWord + ' is remembered as a time of suffering. The survivors\u2014few as they are\u2014curse every royal name upon empty plates. History\u2019s judgment is merciless.',
      'The scribes record a bleak ' + eraWord + '. Cruelty and incompetence in equal measure. The fields lay barren, the storehouses empty, and the people\u2019s eyes hollow as the promises made to them.',
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
  // Canal bonus: each canal adds +0.5, max +4
  hy += Math.min(4, Math.floor(st.buildings.irrigation * 0.5));

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
  if (Math.random() < 0.077) {
    var templeBlock = Math.min(0.85, st.buildings.temple * 0.10);
    if (Math.random() >= templeBlock) { st.population = Math.floor(st.population / 2); plague = true; }
  }

  st.landPrice = randInt(11, 14);

  // Grain rot: granaries help
  var rotAmount = 0;
  if (st.grain > 78000) {
    var rotRate = 0.03 + Math.random() * 0.10;
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
  st.loyalty = Math.max(0, Math.min(100, st.loyalty + loyDelta));

  // Military threat: walls provide defense (each +30)
  var threat = null;
  if (!plague && Math.random() < 0.128) {
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
  if (!plague && !threat && Math.random() < 0.35) {
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
}

function appendChronicle(html) {
  var area = document.getElementById('chronicle');
  var d = document.createElement('div');
  d.innerHTML = html;
  area.appendChild(d);
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
function beginReign() {
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
  };

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
    '<div class="year-entry">' +
    '<div class="year-heading">The Ascension</div>' +
    '<p>' + narrateOpening(king) + '</p>' +
    '<p class="event-neutral">The realm holds <strong>' + START_POP.toLocaleString() + '</strong> souls across its cities and settlements, <strong>' + START_ACRES.toLocaleString() + '</strong> acres of farmland, and <strong>' + START_GRAIN.toLocaleString() + '</strong> bushels of grain in the royal granaries. The people\'s loyalty stands at <strong>50</strong>. ' + king.name + '\u2019s temperament: <em>' + king.personality.name + '</em> \u2014 ' + king.personality.desc.toLowerCase() + '. The length of this reign is known only to the gods.</p>' +
    '</div>'
  );

  timeoutId = setTimeout(nextYear, getDelay());
}

// ─── Succession ─────────────────────────────────────────
function triggerSuccession() {
  state.rulers[state.rulerIdx].endYear = state.year - 1;

  var loyDrop = randInt(15, 25);
  state.loyalty = Math.max(0, state.loyalty - loyDrop);

  var grainTax = Math.floor(state.grain * (0.10 + Math.random() * 0.10));
  state.grain = Math.max(0, state.grain - grainTax);

  var newName = pick(KING_NAMES);
  var newEpithet = pick(EPITHETS);
  var aiPersonalities = PERSONALITIES.filter(function(p) { return !p.isPlayer; });
  var newPersonality;

  if (state.isPlayerDynasty) {
    newPersonality = PERSONALITIES[0]; // Mortal
  } else {
    newPersonality = pick(aiPersonalities);
  }

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

  var narratives = [
    'The old king is dead. The throne passes to a new hand. ' + newName + ', ' + newEpithet + ', ascends amid uncertainty and whispered plots.',
    'A new era dawns. ' + newName + ', ' + newEpithet + ', takes the scepter from a predecessor\u2019s cold grasp. The court watches with guarded eyes.',
    'The succession is proclaimed across the cities. ' + newName + ', ' + newEpithet + ', inherits a kingdom in transition. Loyalty wavers as old alliances dissolve.',
    'The reed throne stands empty for three days before ' + newName + ', ' + newEpithet + ', claims it. Some celebrate; others sharpen their knives in the shadows.',
    'The funeral fires still smolder when ' + newName + ', ' + newEpithet + ', is anointed with sacred oil. The scribes note the date. A new age begins\u2014for better or worse.',
  ];
  var html = '<div class="year-entry succession-entry">';
  html += '<div class="year-heading">\u{1F451} Succession \u2014 Year ' + state.year + '</div>';
  html += '<p class="event-neutral">' + pick(narratives) + '</p>';
  html += '<p class="event-disaster"><span class="emoji-icon">\u{1F4C9}</span> <span class="disaster-text">Loyalty dropped by ' + loyDrop + ' amid the transition. ' + grainTax.toLocaleString() + ' bushels were lost to succession taxes and courtly plunder.</span></p>';
  if (rivalText) html += rivalText;
  html += '<p class="event-neutral">The new ruler\u2019s temperament: <em>' + newPersonality.name + '</em> \u2014 ' + newPersonality.desc.toLowerCase() + '.</p>';
  html += '</div>';

  appendChronicle(html);
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

  // Roll weather
  var weathers = ['normal', 'normal', 'normal', 'normal', 'drought', 'drought', 'flood', 'bountiful', 'bountiful', 'normal'];
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

  var wBadge = '<span class="weather-badge ' + r.weather + '">' + WEATHER_ICONS[r.weather] + ' ' + WEATHER_LABELS[r.weather] + '</span>';
  var html = '<div class="year-entry"><div class="year-heading">Year ' + state.year + ' of the Reign ' + wBadge + '</div>';

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

  // Atmospheric flavor line
  if (r.flavor) {
    html += '<p class="event-neutral" style="opacity:0.55;font-style:italic;font-size:0.85rem;">' + r.flavor + '</p>';
  }

  // Omen (rare)
  if (r.omen) {
    html += '<p class="event-neutral" style="opacity:0.7;font-size:0.85rem;">' + r.omen + '</p>';
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
  var html = '<div class="year-entry">';
  html += '<div class="year-heading">' + (icons[result] || '') + ' The ' + (rulerCount > 1 ? 'Dynasty' : 'Reign') + ' Has Ended</div>';
  html += '<p class="event-neutral">' + (teasers[result] || 'The era is over.') + '</p>';
  html += '<div style="margin-top:1rem;text-align:center;">';
  html += '<button onclick="showEndScreen()" style="font-family:Cinzel,serif;font-size:0.95rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--bg-deep);background:linear-gradient(135deg,var(--gold-dark),var(--gold));border:none;border-radius:5px;padding:0.75rem 1.8rem;cursor:pointer;transition:box-shadow 0.25s;"';
  html += ' onmouseover="this.style.boxShadow=\'0 0 20px rgba(201,168,76,0.35)\'" onmouseout="this.style.boxShadow=\'none\'">';
  html += 'View the Reckoning</button></div>';
  html += '</div>';

  appendChronicle(html);
  document.getElementById('btn-pause').textContent = 'Ended';
  document.getElementById('btn-pause').disabled = true;
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
