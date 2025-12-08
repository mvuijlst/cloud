/**
 * Elite galaxy generator (planet positions, stats, and descriptions).
 * Ported from txtelite.c (Ian Bell / David Braben algorithms). No trading/gameplay.
 */

const GAL_SIZE = 256;
const BASE_SEED = { w0: 0x5a4a, w1: 0x0248, w2: 0xb753 }; // base seed for galaxy 1

const PAIRS0 =
  "ABOUSEITILETSTONLONUTHNOALLEXEGEZACEBISOUSESARMAINDIREA.ERATENBERALAVETIEDORQUANTEISRION";

const PAIRS =
  "..LEXEGEZACEBISO" +
  "USESARMAINDIREA." +
  "ERATENBERALAVETI" +
  "EDORQUANTEISRION";

// Description fragments for goat soup generator (indices 0x81-0xA4)
const DESC_LIST = [
  ["fabled", "notable", "well known", "famous", "noted"],
  ["very", "mildly", "most", "reasonably", ""],
  ["ancient", "\x95", "great", "vast", "pink"],
  ["\x9E \x9D plantations", "mountains", "\x9C", "\x94 forests", "oceans"],
  ["shyness", "silliness", "mating traditions", "loathing of \x86", "love for \x86"],
  ["food blenders", "tourists", "poetry", "discos", "\x8E"],
  ["talking tree", "crab", "bat", "lobst", "\xB2"],
  ["beset", "plagued", "ravaged", "cursed", "scourged"],
  ["\x96 civil war", "\x9B \x98 \x99s", "a \x9B disease", "\x96 earthquakes", "\x96 solar activity"],
  ["its \x83 \x84", "the \xB1 \x98 \x99", "its inhabitants' \x9A \x85", "\xA1", "its \x8D \x8E"],
  ["juice", "brandy", "water", "brew", "gargle blasters"],
  ["\xB2", "\xB1 \x99", "\xB1 \xB2", "\xB1 \x9B", "\x9B \xB2"],
  ["fabulous", "exotic", "hoopy", "unusual", "exciting"],
  ["cuisine", "night life", "casinos", "sit coms", " \xA1 "],
  ["\xB0", "The planet \xB0", "The world \xB0", "This planet", "This world"],
  ["n unremarkable", " boring", " dull", " tedious", " revolting"],
  ["planet", "world", "place", "little planet", "dump"],
  ["wasp", "moth", "grub", "ant", "\xB2"],
  ["poet", "arts graduate", "yak", "snail", "slug"],
  ["tropical", "dense", "rain", "impenetrable", "exuberant"],
  ["funny", "wierd", "unusual", "strange", "peculiar"],
  ["frequent", "occasional", "unpredictable", "dreadful", "deadly"],
  ["\x82 \x81 for \x8A", "\x82 \x81 for \x8A and \x8A", "\x88 by \x89", "\x82 \x81 for \x8A but \x88 by \x89", "a\x90 \x91"],
  ["\x9B", "mountain", "edible", "tree", "spotted"],
  ["\x9F", "\xA0", "\x87oid", "\x93", "\x92"],
  ["ancient", "exceptional", "eccentric", "ingrained", "\x95"],
  ["killer", "deadly", "evil", "lethal", "vicious"],
  ["parking meters", "dust clouds", "ice bergs", "rock formations", "volcanoes"],
  ["plant", "tulip", "banana", "corn", "\xB2weed"],
  ["\xB2", "\xB1 \xB2", "\xB1 \x9B", "inhabitant", "\xB1 \xB2"],
  ["shrew", "beast", "bison", "snake", "wolf"],
  ["leopard", "cat", "monkey", "goat", "fish"],
  ["\x8C \x8B", "\xB1 \x9F \xA2", "its \x8D \xA0 \xA2", "\xA3 \xA4", "\x8C \x8B"],
  ["meat", "cutlet", "steak", "burgers", "soup"],
  ["ice", "mud", "Zero-G", "vacuum", "\xB1 ultra"],
  ["hockey", "cricket", "karate", "polo", "tennis"],
];

function cloneSeed(seed) {
  return { w0: seed.w0 & 0xffff, w1: seed.w1 & 0xffff, w2: seed.w2 & 0xffff };
}

function rotatel8(x) {
  const temp = x & 0x80;
  return ((x & 0x7f) << 1) | (temp >> 7);
}

function twist16(x) {
  return (((rotatel8(x >> 8) & 0xff) << 8) | (rotatel8(x & 0xff) & 0xff)) & 0xffff;
}

function nextGalaxy(seed) {
  seed.w0 = twist16(seed.w0);
  seed.w1 = twist16(seed.w1);
  seed.w2 = twist16(seed.w2);
}

function tweakSeed(seed) {
  const temp = (seed.w0 + seed.w1 + seed.w2) & 0xffff;
  seed.w0 = seed.w1;
  seed.w1 = seed.w2;
  seed.w2 = temp;
}

function stripDots(str) {
  return str.replace(/\./g, "");
}

function computeSpecies(s0, s1, s2) {
  const s0Hi = (s0 >> 8) & 0xff;
  const s1Hi = (s1 >> 8) & 0xff;
  const s2Hi = (s2 >> 8) & 0xff;
  const s2Lo = s2 & 0xff;

  // Bit 7 of s2_lo clear => Human Colonials
  if ((s2Lo & 0x80) === 0) return "Human Colonials";

  const adjectives = [];

  // size-ish adjective (bits 2-4 of s2_hi)
  const a1 = (s2Hi >> 2) & 0x07;
  const sizeMap = {
    0: "Large",
    1: "Fierce",
    2: "Small",
  };
  if (sizeMap[a1] !== undefined) adjectives.push(sizeMap[a1]);

  // color / temperament (bits 5-7 of s2_hi)
  const a2 = (s2Hi >> 5) & 0x07;
  const colorMap = {
    0: "Green",
    1: "Red",
    2: "Yellow",
    3: "Blue",
    4: "Black",
    5: "Harmless",
  };
  if (colorMap[a2] !== undefined) adjectives.push(colorMap[a2]);

  // physiology (bits 0-2 of s0_hi xor s1_hi)
  const a3 = (s0Hi ^ s1Hi) & 0x07;
  const physMap = {
    0: "Slimy",
    1: "Bug-Eyed",
    2: "Horned",
    3: "Bony",
    4: "Fat",
    5: "Furry",
  };
  if (physMap[a3] !== undefined) adjectives.push(physMap[a3]);

  // species name (add bits 0-1 of s2_hi to a3, take bits 0-2)
  const a4 = (a3 + (s2Hi & 0x03)) & 0x07;
  const speciesMap = {
    0: "Rodents",
    1: "Frogs",
    2: "Lizards",
    3: "Lobsters",
    4: "Birds",
    5: "Humanoids",
    6: "Felines",
    7: "Insects",
  };
  const species = speciesMap[a4] || "";

  return `${adjectives.join(" ")}${adjectives.length ? " " : ""}${species}`.trim();
}

function makeSystem(seed) {
  const sys = {};
  const seedSnapshot = { w0: seed.w0, w1: seed.w1, w2: seed.w2 };
  const longnameflag = seed.w0 & 0x40;

  sys.x = (seed.w1 >> 8) & 0xff;
  sys.y = (seed.w0 >> 8) & 0xff;
  sys.govtype = (seed.w1 >> 3) & 7;

  sys.economy = (seed.w0 >> 8) & 7;
  if (sys.govtype <= 1) sys.economy |= 2;

  sys.techlev = ((seed.w1 >> 8) & 3) + (sys.economy ^ 7);
  sys.techlev += sys.govtype >> 1;
  if (sys.govtype & 1) sys.techlev += 1;

  sys.population = 4 * sys.techlev + sys.economy + sys.govtype + 1;
  sys.productivity = (((sys.economy ^ 7) + 3) * (sys.govtype + 4) * sys.population * 8) >>> 0;
  sys.radius = 256 * (((seed.w2 >> 8) & 0x0f) + 11) + sys.x;

  sys.goatsoupseed = {
    a: seed.w1 & 0xff,
    b: (seed.w1 >> 8) & 0xff,
    c: seed.w2 & 0xff,
    d: (seed.w2 >> 8) & 0xff,
  };

  const pair1 = 2 * (((seed.w2 >> 8) & 31));
  tweakSeed(seed);
  const pair2 = 2 * (((seed.w2 >> 8) & 31));
  tweakSeed(seed);
  const pair3 = 2 * (((seed.w2 >> 8) & 31));
  tweakSeed(seed);
  const pair4 = 2 * (((seed.w2 >> 8) & 31));
  tweakSeed(seed);

  let name =
    PAIRS[pair1] +
    PAIRS[pair1 + 1] +
    PAIRS[pair2] +
    PAIRS[pair2 + 1] +
    PAIRS[pair3] +
    PAIRS[pair3 + 1];

  if (longnameflag) {
    name += PAIRS[pair4] + PAIRS[pair4 + 1];
  }

  sys.name = stripDots(name);

  sys.species = computeSpecies(seedSnapshot.w0, seedSnapshot.w1, seedSnapshot.w2);

  return sys;
}

function buildGalaxy(galaxyNumber = 1, { withDescriptions = true } = {}) {
  const seed = cloneSeed(BASE_SEED);
  for (let i = 1; i < galaxyNumber; i += 1) nextGalaxy(seed);

  const systems = [];
  for (let i = 0; i < GAL_SIZE; i += 1) {
    const sys = makeSystem(seed);
    if (withDescriptions) sys.description = describeSystem(sys);
    systems.push(sys);
  }
  return systems;
}

// RNG for goat soup descriptors
function genRndNumber(rnd) {
  let x = (rnd.a * 2) & 0xff;
  let a = x + rnd.c;
  if (rnd.a > 127) a += 1;
  rnd.a = a & 0xff;
  rnd.c = x;
  a = a >> 8; // carry from the previous add
  x = rnd.b;
  a = (a + x + rnd.d) & 0xff;
  rnd.b = a;
  rnd.d = x;
  return a;
}

function formatName(baseName, dropTrailingVowel) {
  if (!baseName) return "";
  let out = baseName[0].toUpperCase();
  for (let i = 1; i < baseName.length; i += 1) {
    const ch = baseName[i];
    const isLast = i === baseName.length - 1;
    if (dropTrailingVowel && isLast && (ch === "E" || ch === "I")) continue;
    out += ch.toLowerCase();
  }
  if (dropTrailingVowel) out += "ian";
  return out;
}

function randomName(rnd) {
  let result = "";
  const len = genRndNumber(rnd) & 3;
  for (let i = 0; i <= len; i += 1) {
    const x = genRndNumber(rnd) & 0x3e;
    const first = PAIRS0[x];
    const second = PAIRS0[x + 1];
    if (i === 0) result += first.toUpperCase();
    else result += first.toLowerCase();
    result += second.toLowerCase();
  }
  return result;
}

function goatSoup(template, system, rnd) {
  let out = "";
  for (let i = 0; i < template.length; i += 1) {
    const c = template.charCodeAt(i);
    if (c < 0x80) {
      out += template[i];
      continue;
    }
    if (c <= 0xa4) {
      const options = DESC_LIST[c - 0x81];
      const rndVal = genRndNumber(rnd);
      const idx = (rndVal >= 0x33) + (rndVal >= 0x66) + (rndVal >= 0x99) + (rndVal >= 0xcc);
      out += goatSoup(options[idx], system, rnd);
      continue;
    }
    switch (c) {
      case 0xb0:
        out += formatName(system.name, false);
        break;
      case 0xb1:
        out += formatName(system.name, true);
        break;
      case 0xb2:
        out += randomName(rnd);
        break;
      default:
        out += `<bad char ${c.toString(16)}>`;
    }
  }
  return out;
}

function describeSystem(system) {
  const rnd = { ...system.goatsoupseed };
  return goatSoup("\x8F is \x97.", system, rnd);
}

// Expose for Node/CommonJS
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    buildGalaxy,
    describeSystem,
    computeSpecies,
  };
}

// Expose for browsers
if (typeof window !== "undefined") {
  window.EliteGalaxy = {
    buildGalaxy,
    describeSystem,
    computeSpecies,
  };
}

// Demo when run directly: print first five systems of galaxy 1
if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  const galaxy = buildGalaxy(1);
  console.log(galaxy.slice(0, 5).map(({ name, x, y, description }) => ({ name, x, y, description })));
}
