/* global createCanvas, windowWidth, windowHeight, resizeCanvas, background, deltaTime, random, createVector, dist, fill, stroke, strokeWeight, noStroke, ellipse, beginShape, vertex, endShape, pop, push, translate, color, text, textSize, textAlign, LEFT, CENTER, rect, width, height, lerp, line, mouseIsPressed, mouseX, mouseY */

// Zone-based hive simulation following simulation.md spec

// === CONSTANTS ===
const DAYS_PER_SEC = 1.0;  // 1 day per real second for faster observation
const FAST_MULT = 5;       // Fast mode is 5x
const FIXED_DT = 0.2;

// Hexagonal grid
let hexGrid = [];
let hexSize = 11;
let maxRings = 20;
let centerX, centerY;

// Zones
const ZONES = {
  OUTSIDE: { cap: 99999, x: 0.5, y: 0.85, r: 40, color: '#1a1f1c' },
  ENTRANCE: { cap: 25, x: 0.5, y: 0.7, r: 25, color: '#2a3f3a' },
  VESTIBULE: { cap: 150, x: 0.5, y: 0.58, r: 45, color: '#3a2f2a' },
  UNLOAD: { cap: 100, x: 0.38, y: 0.48, r: 35, color: '#4a3820' },
  BROOD_CORE: { cap: 350, x: 0.5, y: 0.38, r: 50, color: '#f3e5b5' },
  BROOD_RING: { cap: 300, x: 0.52, y: 0.25, r: 55, color: '#e2c585' },
  STORES: { cap: 400, x: 0.68, y: 0.38, r: 48, color: '#b88420' },
  BUILD_FRONT: { cap: 180, x: 0.72, y: 0.18, r: 38, color: '#6a5830' }
};

// Edges: [from, to, throughputPerHour]
const EDGES = [
  ['OUTSIDE', 'ENTRANCE', 12],
  ['ENTRANCE', 'VESTIBULE', 18],
  ['VESTIBULE', 'UNLOAD', 25],
  ['UNLOAD', 'STORES', 25],
  ['VESTIBULE', 'BROOD_RING', 35],
  ['BROOD_RING', 'BROOD_CORE', 35],
  ['BROOD_RING', 'STORES', 30],
  ['STORES', 'BUILD_FRONT', 22]
];

// Age buckets: [0-2, 3-11, 12-18, 19-40, 41+]
const BUCKETS = ['B0', 'B1', 'B2', 'B3', 'B4'];
const BUCKET_WIDTHS = [3, 9, 7, 22, 999];
const BUCKET_MORTALITY = [600, 500, 400, 200, 50]; // mean lifetime (days) - much longer lived

// Roles
const ROLES = ['NURSE', 'BUILDER', 'PROCESSOR', 'GUARD', 'FORAGER'];
const ROLE_COLORS = {
  NURSE: '#ff6b6b',      // Red/Pink (Brood care)
  BUILDER: '#51cf66',    // Green (Building)
  PROCESSOR: '#cc5de8',  // Purple (Processing)
  GUARD: '#fcc419',      // Orange (Guarding)
  FORAGER: '#339af0'     // Blue (Foraging)
};

// Age eligibility weights [B0, B1, B2, B3, B4]
const ELIGIBILITY = {
  NURSE: [0.2, 1.0, 0.4, 0.1, 0.0],
  BUILDER: [0.0, 0.2, 1.0, 0.2, 0.1],
  PROCESSOR: [0.1, 0.5, 0.8, 0.3, 0.1],
  GUARD: [0.0, 0.1, 0.2, 0.7, 0.5],
  FORAGER: [0.0, 0.0, 0.1, 1.0, 0.8]
};

// === STATE ===
let bees = {}; // bees[zone][bucket][role] = count (float)
let brood = { egg: 0, larva: 0, pupa: 0 }; // counts
let stores = { honey: 0, pollen: 0, nectar: 0 }; // units
let builtCells = 120;
let maxCells = 5000;
let queen = { hunger: 0.4, layRate: 500 }; // eggs/day when fed - much more productive

let simAccumulator = 0;
let fastTime = false;
let simTime = 0; // total days elapsed

// Noise field for cell patterns
let noiseSeed;

// Optimization caches
let builtHexesCache = [];
let zoneHexesCache = {};

// === INIT ===
function setup() {
  createCanvas(windowWidth, windowHeight);
  textAlign(CENTER, CENTER);
  centerX = width / 2;
  centerY = height / 2;
  noiseSeed = random(1000);
  
  // Initialize hexagonal grid
  initHexGrid();
  
  // Initialize bee population
  for (const z of Object.keys(ZONES)) {
    bees[z] = {};
    for (const b of BUCKETS) {
      bees[z][b] = {};
      for (const r of ROLES) {
        bees[z][b][r] = 0;
      }
    }
  }
  
  // Seed initial colony in BROOD_CORE
  const zone = 'BROOD_CORE';
  bees[zone]['B0']['NURSE'] = 15;
  bees[zone]['B1']['NURSE'] = 35;
  bees[zone]['B1']['BUILDER'] = 10;
  bees[zone]['B2']['BUILDER'] = 25;
  bees[zone]['B2']['PROCESSOR'] = 15;
  bees[zone]['B3']['GUARD'] = 12;
  bees[zone]['B3']['FORAGER'] = 8;
  
  // Initial stores
  stores.honey = 15;
  stores.pollen = 10;
  stores.nectar = 0;
  
  // Initial brood
  brood.egg = 20;
  brood.larva = 35;
  brood.pupa = 40;
}

function initHexGrid() {
  hexGrid = [];
  builtHexesCache = [];
  zoneHexesCache = {};
  for (const z of Object.keys(ZONES)) zoneHexesCache[z] = [];
  
  // Create a rectangular grid of hexes that covers the screen
  // Estimate range based on window size and hex size
  const cols = Math.ceil(width / (hexSize * 1.5)) + 2;
  const rows = Math.ceil(height / (hexSize * Math.sqrt(3))) + 2;
  
  // Center is at (0,0) in axial coords
  // We need to scan a large enough range of q and r
  const range = Math.max(cols, rows);
  
  for (let q = -range; q <= range; q++) {
    for (let r = -range; r <= range; r++) {
      // Check if this hex is within the screen bounds
      const pos = hexToPixel(q, r);
      if (pos.x >= -hexSize && pos.x <= width + hexSize && 
          pos.y >= -hexSize && pos.y <= height + hexSize) {
        
        const hex = {
          q: q,
          r: r,
          built: false,
          type: 'empty',
          capped: false,
          buildProgress: 0.0,
          density: 0,
          simZone: getHexZone(q, r),
          roleColor: null
        };
        hexGrid.push(hex);
      }
    }
  }
  
  // Start with small asymmetric cluster at top center
  const startCells = [
    {q: 0, r: 0},
    {q: 1, r: 0},
    {q: 0, r: 1},
    {q: -1, r: 1},
    {q: 1, r: -1},
    {q: 0, r: -1},
    {q: -1, r: 0},
    {q: 2, r: -1},
    {q: 1, r: 1}
  ];
  
  for (const start of startCells) {
    const hex = hexGrid.find(h => h.q === start.q && h.r === start.r);
    if (hex) {
      hex.built = true;
      hex.buildProgress = 1.0;
      hex.type = 'brood';
      builtHexesCache.push(hex);
      if (zoneHexesCache[hex.simZone]) zoneHexesCache[hex.simZone].push(hex);
    }
  }
}

function getHexZone(q, r) {
  const dist = Math.sqrt(q*q + q*r + r*r);
  // Entrance: roughly below center
  if (r > 2 && Math.abs(q) < r) return 'ENTRANCE'; 
  if (dist < 5) return 'BROOD_CORE';
  if (dist < 8) return 'BROOD_RING';
  return 'STORES'; 
}

// Count frontier slots (unbuilt neighbors of any built cell)
function frontierSlots() {
  const builtSet = new Set(hexGrid.filter(h => h.built).map(h => `${h.q},${h.r}`));
  let count = 0;
  for (const h of hexGrid) {
    if (h.built) continue;
    const neighbors = getNeighbors(h.q, h.r);
    if (neighbors.some(n => builtSet.has(`${n.q},${n.r}`))) count += 1;
  }
  return count;
}

function recalcBuiltCells() {
  return builtHexesCache.length;
}

// Hex coordinate helpers
function hexRing(q, r, radius) {
  const results = [];
  if (radius === 0) return [{ q, r }];
  
  let hex = { q: q + radius, r: r - radius };
  const directions = [
    { q: 0, r: 1 },
    { q: -1, r: 1 },
    { q: -1, r: 0 },
    { q: 0, r: -1 },
    { q: 1, r: -1 },
    { q: 1, r: 0 }
  ];
  
  for (let d = 0; d < 6; d++) {
    for (let step = 0; step < radius; step++) {
      results.push({ ...hex });
      hex.q += directions[d].q;
      hex.r += directions[d].r;
    }
  }
  return results;
}

function hexToPixel(q, r) {
  const x = hexSize * (3/2 * q);
  const y = hexSize * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
  return { x: centerX + x, y: centerY + y };
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  centerX = width / 2;
  centerY = height / 2;
  initHexGrid(); // Re-initialize grid to cover new size
}

function draw() {
  const frameDt = (deltaTime || 16) / 1000;
  const speed = fastTime ? FAST_MULT : 1;
  simAccumulator += frameDt;
  
  while (simAccumulator >= FIXED_DT) {
    const dtDays = FIXED_DT * DAYS_PER_SEC * speed;
    const dtHours = dtDays * 24;
    updateSimulation(dtDays, dtHours);
    simTime += dtDays;
    simAccumulator -= FIXED_DT;
  }
  
  render();
}

function mousePressed() {
  fastTime = !fastTime;
}

// === SIMULATION ===
function updateSimulation(dtDays, dtHours) {
  // Sync built cell count each tick so demands/build logic stays correct
  builtCells = recalcBuiltCells();

  // 1. Age all bees and handle mortality
  ageBees(dtDays);
  
  // 2. Update brood
  updateBrood(dtDays);
  
  // 3. Queen laying
  queenLay(dtDays);
  
  // 4. Compute role demands
  const demands = computeDemands();
  
  // 5. Allocate roles based on demand
  allocateRoles(demands, dtDays);
  
  // 6. Forager cycle (OUTSIDE ↔ entrance)
  foragerCycle(dtHours);
  
  // 7. Update hexagonal cell building and contents
  updateCellTypes(dtDays);

  // Sync built cells after construction
  builtCells = recalcBuiltCells();
  
  // 8. Process nectar → honey
  processNectar(dtDays);
  
  // 9. Flow bees between zones
  flowBees(dtHours);
  
  // 10. Consume stores for maintenance
  consumeStores(dtDays);
}

function ageBees(dtDays) {
  for (const z of Object.keys(ZONES)) {
    for (let i = 0; i < BUCKETS.length; i++) {
      const bucket = BUCKETS[i];
      const nextBucket = BUCKETS[i + 1];
      const width = BUCKET_WIDTHS[i];
      const tau = BUCKET_MORTALITY[i];
      
      for (const r of ROLES) {
        const count = bees[z][bucket][r];
        if (count <= 0) continue;
        
        // Mortality
        const pDie = 1 - Math.exp(-dtDays / tau);
        const died = count * pDie;
        bees[z][bucket][r] -= died;
        
        // Age progression to next bucket
        if (nextBucket) {
          const pAge = 1 - Math.exp(-dtDays / width);
          const aged = bees[z][bucket][r] * pAge;
          bees[z][bucket][r] -= aged;
          bees[z][nextBucket][r] += aged;
        }
      }
    }
  }
}

function updateBrood(dtDays) {
  // Egg → Larva (2 days instead of 3)
  const eggRate = 1 - Math.exp(-dtDays / 2);
  const hatchedEggs = brood.egg * eggRate;
  brood.egg -= hatchedEggs;
  brood.larva += hatchedEggs;
  
  // Larva → Pupa (4 days instead of 6, with support)
  const larvaSupport = computeLarvaSupport();
  const effectiveDevTime = 4 / Math.max(0.6, larvaSupport); // faster base, higher min support
  const larvaPupateRate = 1 - Math.exp(-dtDays / effectiveDevTime);
  const pupatedLarva = brood.larva * larvaPupateRate;
  brood.larva -= pupatedLarva;
  brood.pupa += pupatedLarva;
  
  // Pupa → Adult (8 days instead of 12)
  const pupaRate = 1 - Math.exp(-dtDays / 8);
  const emerged = brood.pupa * pupaRate;
  brood.pupa -= emerged;
  
  // Add emerged bees to B0 NURSE in BROOD_CORE
  bees['BROOD_CORE']['B0']['NURSE'] += emerged;
}

function computeLarvaSupport() {
  const nurses = countByRole('NURSE');
  const larvaCount = Math.max(1, brood.larva);
  const larvaDemand = larvaCount * 0.5; // reduced demand
  const nurseSupply = nurses * 5.0; // nurses are more effective
  const pollenNeed = larvaCount * 0.1; // less pollen needed
  const honeyNeed = larvaCount * 0.08; // less honey needed
  
  const support = Math.min(
    1.2, // can be over-supported
    nurseSupply / Math.max(0.1, larvaDemand),
    stores.pollen / Math.max(0.3, pollenNeed),
    stores.honey / Math.max(0.3, honeyNeed)
  );
  
  return Math.max(0.7, support); // High minimum support
}

function queenLay(dtDays) {
  // Calculate available brood space (60% of cells for brood)
  const maxBroodCells = Math.max(20, builtCells * 0.6);
  const usedBroodCells = brood.egg + brood.larva + brood.pupa;
  const emptyBroodCells = Math.max(0, maxBroodCells - usedBroodCells);
  
  if (emptyBroodCells <= 0) return;
  if (queen.hunger > 2.0) return; // only stop if very hungry
  
  // Lay eggs proportional to available space and food
  const maxEggs = queen.layRate * dtDays;
  const actualEggs = Math.min(maxEggs, emptyBroodCells);
  brood.egg += actualEggs;
  
  queen.hunger += dtDays * 0.2; // slower hunger increase
}

function computeDemands() {
  const D = {};
  const currentForagers = countByRole('FORAGER');
  const totalBees = countAllBees();
  const honeyTarget = 500;
  const pollenTarget = 200;
  const frontier = frontierSlots();

  // Foraging: high when stores are low, relaxed when abundant
  const forageNeed = Math.max(0, honeyTarget - stores.honey) * 1.2;
  const baselineForagers = totalBees * 0.15; // keep ~15% as foragers even when rich
  D.FORAGER = Math.max(80, forageNeed, baselineForagers);

  // Nursing: driven by brood
  D.NURSE = Math.max(30, (brood.larva + brood.egg * 0.4) * 4.0);

  // Processing: driven by nectar backlog and forager throughput
  D.PROCESSOR = Math.max(15, stores.nectar * 2.0, currentForagers * 0.4);

  // Builders: driven by frontier and missing cells
  const missingCells = Math.max(0, maxCells - builtCells);
  D.BUILDER = Math.max(20, frontier * 3.0, missingCells * 0.05);

  // Guards: minimal
  D.GUARD = Math.max(2, currentForagers * 0.02);

  return D;
}

function allocateRoles(demands, dtDays) {
  // Compute target role distribution from demands
  const totalDemand = Object.values(demands).reduce((a, b) => a + b, 1);
  const targets = {};
  for (const r of ROLES) {
    targets[r] = (demands[r] || 0) / totalDemand;
  }
  
  // Role switching rate (slower = more stable)
  const pSwitch = 1 - Math.exp(-dtDays / 0.5);
  
  // For each zone and age bucket, redistribute roles toward targets
  for (const z of Object.keys(ZONES)) {
    for (const b of BUCKETS) {
      const bucketIdx = BUCKETS.indexOf(b);
      const totalInBucket = ROLES.reduce((sum, r) => sum + bees[z][b][r], 0);
      if (totalInBucket < 0.1) continue;
      
      // Calculate how many bees want to switch
      const switchingPool = totalInBucket * pSwitch;
      
      // Calculate target counts based on eligibility
      const eligibleTargets = {};
      let totalEligibility = 0;
      for (const r of ROLES) {
        const eligibility = ELIGIBILITY[r][bucketIdx];
        eligibleTargets[r] = targets[r] * eligibility;
        totalEligibility += eligibleTargets[r];
      }
      
      // Normalize
      if (totalEligibility > 0) {
        for (const r of ROLES) {
          eligibleTargets[r] /= totalEligibility;
        }
      }
      
      // Redistribute switching bees
      const newCounts = {};
      for (const r of ROLES) {
        const keepFraction = 1 - pSwitch;
        const targetCount = switchingPool * eligibleTargets[r];
        newCounts[r] = bees[z][b][r] * keepFraction + targetCount;
      }
      
      // Apply new counts
      for (const r of ROLES) {
        bees[z][b][r] = Math.max(0, newCounts[r]);
      }

      // Renormalize to preserve bucket total
      const newTotal = ROLES.reduce((sum, r) => sum + bees[z][b][r], 0);
      if (newTotal > 0.0001) {
        for (const r of ROLES) {
          bees[z][b][r] *= totalInBucket / newTotal;
        }
      }
    }
  }
}

function foragerCycle(dtHours) {
  // Foragers in OUTSIDE return (mean 2 hours)
  const returnRate = 1 - Math.exp(-dtHours / 2);
  let returning = 0;
  for (const b of BUCKETS) {
    const count = bees['OUTSIDE'][b]['FORAGER'];
    const ret = count * returnRate;
    bees['OUTSIDE'][b]['FORAGER'] -= ret;
    bees['ENTRANCE'][b]['FORAGER'] += ret;
    returning += ret;
  }
  
  // Returning foragers bring resources
  stores.nectar += returning * 0.5 * dtHours;
  stores.pollen += returning * 0.2 * dtHours;
  
  // Foragers in BROOD/STORES leave for OUTSIDE (mean 3 hours)
  const leaveRate = 1 - Math.exp(-dtHours / 3);
  for (const z of ['BROOD_CORE', 'BROOD_RING', 'STORES']) {
    for (const b of BUCKETS) {
      const leaving = bees[z][b]['FORAGER'] * leaveRate * 0.3;
      bees[z][b]['FORAGER'] -= leaving;
      bees['OUTSIDE'][b]['FORAGER'] += leaving;
    }
  }
}

function processNectar(dtDays) {
  const processors = countByRole('PROCESSOR');
  const capacity = processors * 2.0 * dtDays; // increased processing rate
  const processed = Math.min(stores.nectar, capacity);
  stores.nectar -= processed;
  stores.honey += processed * 0.85; // better conversion ratio
}

function flowBees(dtHours) {
  // Simple diffusion-based flow toward work zones
  const flowRate = 0.1; // fraction moving per edge per hour
  
  for (const [from, to, throughput] of EDGES) {
    const limit = throughput * dtHours;
    
    for (const b of BUCKETS) {
      for (const r of ROLES) {
        // Flow based on role preference for destination
        const preference = getZonePreference(r, to) - getZonePreference(r, from);
        if (preference <= 0) continue;
        
        const available = bees[from][b][r];
        const space = Math.max(0, ZONES[to].cap - getZoneOccupancy(to));
        const flow = Math.min(available * flowRate * preference, limit * 0.1, space * 0.1);
        
        if (flow > 0.01) {
          bees[from][b][r] -= flow;
          bees[to][b][r] += flow;
        }
      }
    }
  }
}

function getZonePreference(role, zone) {
  const prefs = {
    NURSE: { BROOD_CORE: 1.0, BROOD_RING: 0.8, VESTIBULE: 0.3 },
    BUILDER: { BUILD_FRONT: 1.0, STORES: 0.5, BROOD_RING: 0.4 },
    PROCESSOR: { UNLOAD: 1.0, STORES: 0.8, VESTIBULE: 0.4 },
    GUARD: { ENTRANCE: 1.0, VESTIBULE: 0.7, BROOD_RING: 0.2 },
    FORAGER: { OUTSIDE: 0.5, ENTRANCE: 0.4, STORES: 0.3 }
  };
  return (prefs[role] && prefs[role][zone]) || 0.1;
}

function getZoneOccupancy(zone) {
  let total = 0;
  for (const b of BUCKETS) {
    for (const r of ROLES) {
      total += bees[zone][b][r];
    }
  }
  return total;
}

function consumeStores(dtDays) {
  const totalBees = countAllBees();
  const consumption = totalBees * 0.003 * dtDays; // much lower consumption
  stores.honey = Math.max(0, stores.honey - consumption);
  
  // Feed queen generously
  if (stores.honey > 0.2) {
    queen.hunger = Math.max(0, queen.hunger - dtDays * 1.5); // feed queen very well
    stores.honey -= 0.03 * dtDays; // queen eats less
  }
}

// === HELPERS ===
function countByRole(role) {
  let total = 0;
  for (const z of Object.keys(ZONES)) {
    for (const b of BUCKETS) {
      total += bees[z][b][role];
    }
  }
  return total;
}

function countAllBees() {
  let total = 0;
  for (const z of Object.keys(ZONES)) {
    for (const b of BUCKETS) {
      for (const r of ROLES) {
        total += bees[z][b][r];
      }
    }
  }
  return total;
}

// === RENDERING ===
let lastRenderUpdate = 0;

function render() {
  background(25, 20, 15);
  
  // Throttle expensive updates (run every 5 frames)
  if (frameCount % 5 === 0) {
    updateCellRenderTypes();
    updateBeeDensity();
  }
  
  // Draw hexagonal cells
  // Optimization: Only iterate built cells cache for the main hive structure
  // This skips the thousands of empty background cells
  for (let i = 0; i < builtHexesCache.length; i++) {
    const hex = builtHexesCache[i];
    const pos = hexToPixel(hex.q, hex.r);
    drawHexCell(pos.x, pos.y, hex);
  }
  
  // Draw candidates (construction sites) separately if needed, 
  // but for "ruthless optimization" let's just stick to the built cache 
  // plus maybe a quick check for active construction if we really want to see it.
  // (Skipping unbuilt construction sites for now to save cycles, they appear when built)
  
  // UI overlay
  fill(245, 220, 160);
  textAlign(LEFT, CENTER);
  textSize(12);
  let yPos = 25;
  
  const totalBees = Math.floor(countAllBees());
  const nurses = Math.floor(countByRole('NURSE'));
  const builders = Math.floor(countByRole('BUILDER'));
  const processors = Math.floor(countByRole('PROCESSOR'));
  const guards = Math.floor(countByRole('GUARD'));
  const foragers = Math.floor(countByRole('FORAGER'));
  
  text(`Day ${simTime.toFixed(1)} | Speed: ${fastTime ? 'FAST' : 'normal'}`, 20, yPos); yPos += 18;
  text(`Bees: ${totalBees}`, 20, yPos); yPos += 15;
  text(`├ Nurses: ${nurses}`, 20, yPos); yPos += 15;
  text(`├ Builders: ${builders}`, 20, yPos); yPos += 15;
  text(`├ Processors: ${processors}`, 20, yPos); yPos += 15;
  text(`├ Guards: ${guards}`, 20, yPos); yPos += 15;
  text(`└ Foragers: ${foragers}`, 20, yPos); yPos += 18;
  
  text(`Brood: ${Math.floor(brood.egg)}e / ${Math.floor(brood.larva)}l / ${Math.floor(brood.pupa)}p`, 20, yPos); yPos += 15;
  text(`Cells: ${Math.floor(builtCells)} / ${maxCells}`, 20, yPos); yPos += 15;
  text(`Stores:`, 20, yPos); yPos += 15;
  text(`├ Honey: ${stores.honey.toFixed(1)}`, 20, yPos); yPos += 15;
  text(`├ Pollen: ${stores.pollen.toFixed(1)}`, 20, yPos); yPos += 15;
  text(`└ Nectar: ${stores.nectar.toFixed(1)}`, 20, yPos); yPos += 15;
  text(`Queen hunger: ${queen.hunger.toFixed(2)}`, 20, yPos); yPos += 15;
  
  textSize(10);
  fill(200, 180, 140);
  text('Click to toggle speed', 20, height - 20);
}

function drawHexCell(x, y, hex) {
  // Optimization: Simple culling
  if (x < -hexSize || x > width + hexSize || y < -hexSize || y > height + hexSize) return;

  const alpha = 255; // Built cells are always visible
  
  // Cell fill color based on type
  let fillColor;
  if (hex.type === 'brood') {
    fillColor = hex.capped ? color(210, 180, 130) : color(245, 230, 190);
  } else if (hex.type === 'honey') {
    fillColor = color(230, 180, 50);
  } else if (hex.type === 'pollen') {
    fillColor = color(255, 200, 80);
  } else {
    fillColor = color(160, 145, 115);
  }
  
  // Draw hexagon
  fill(fillColor);
  stroke(40, 35, 25);
  strokeWeight(1);
  
  beginShape();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i;
    const vx = x + hexSize * Math.cos(angle);
    const vy = y + hexSize * Math.sin(angle);
    vertex(vx, vy);
  }
  endShape();

  // Draw bee density glow - Optimized to use ellipse instead of shape
  if (hex.density > 0.1) {
    const glowAlpha = Math.min(200, hex.density * 40); 
    noStroke();
    
    // Create color object safely
    let c = hex.roleColor ? color(hex.roleColor) : color(255, 230, 150);
    c.setAlpha(glowAlpha);
    fill(c);
    
    // Simple circle is much faster than 6-vertex polygon
    ellipse(x, y, hexSize * 1.5, hexSize * 1.5);
  }

  // Draw entrance marker (Red borders)
  if (hex.simZone === 'ENTRANCE') {
    noFill();
    stroke(255, 50, 50, 200);
    strokeWeight(2);
    // Draw a simple circle for entrance instead of hex to save vertices
    ellipse(x, y, hexSize * 1.5, hexSize * 1.5);
  }
  
  // Draw capping pattern - Simplified to a single dot or line if needed, 
  // but let's skip detailed pattern for performance if zoomed out.
  // Keeping it simple for now.
}

function updateCellTypes(dtDays) {
  // Determine which cells to build next (organic growth)
  const unbuilt = hexGrid.filter(h => !h.built && h.buildProgress < 1.0);
  const buildersCount = countByRole('BUILDER');
  
  // Build capacity per simulation.md: cellsPerBuilderPerDay * builders * dt
  const cellsPerBuilderPerDay = 1.0; // faster building
  const honeyCostPerCell = 0.3; // cheaper cells
  const buildCapacity = buildersCount * cellsPerBuilderPerDay * dtDays;
  
  if (buildersCount > 0 && unbuilt.length > 0 && builtCells < maxCells && stores.honey > honeyCostPerCell) {
    // Find cells adjacent to built cells
    const candidates = unbuilt.filter(h => {
      const neighbors = getNeighbors(h.q, h.r);
      return neighbors.some(n => {
        const neighbor = hexGrid.find(hx => hx.q === n.q && hx.r === n.r);
        return neighbor && neighbor.built;
      });
    }).map(h => {
      // Prefer downward expansion (positive r), slight outward bias
      // Use noise to make growth direction organic and patchy
      const noiseVal = noise(h.q * 0.1 + noiseSeed, h.r * 0.1 + noiseSeed);
      
      // Directional bias: Downward (positive y) is roughly positive r and q
      // Let's just use screen Y coordinate for downward bias
      const pos = hexToPixel(h.q, h.r);
      const relY = (pos.y - centerY) / (height/2); // -1 to 1
      
      const downwardBias = relY > 0 ? 1.5 : 0.8;
      const organicFactor = noiseVal * 2.0;
      
      // Count built neighbors (prefer attaching to multiple cells)
      const neighbors = getNeighbors(h.q, h.r);
      const builtNeighbors = neighbors.filter(n => {
        const neighbor = hexGrid.find(hx => hx.q === n.q && hx.r === n.r);
        return neighbor && neighbor.built;
      }).length;
      
      const neighborBonus = builtNeighbors * 1.5;
      const randomness = Math.random() * 0.5;
      
      return {
        hex: h,
        priority: downwardBias * organicFactor * neighborBonus + randomness
      };
    }).sort((a, b) => b.priority - a.priority);
    
    if (candidates.length > 0) {
      // Distribute build capacity across active sites
      const activeBuildSites = Math.min(8, Math.max(2, Math.floor(buildersCount / 6)));
      const capacityPerSite = buildCapacity / Math.max(1, activeBuildSites);
      
      let cellsBuiltThisTick = 0;
      for (let i = 0; i < Math.min(activeBuildSites, candidates.length); i++) {
        const hex = candidates[i].hex;
        const progressGain = capacityPerSite * (1.0 - i * 0.1); // Lower priority builds slower
        hex.buildProgress += progressGain;
        
        if (hex.buildProgress >= 1.0) {
          hex.built = true;
          hex.buildProgress = 1.0;
          cellsBuiltThisTick++;
          builtHexesCache.push(hex);
          if (zoneHexesCache[hex.simZone]) zoneHexesCache[hex.simZone].push(hex);
          
          // Consume honey for wax production
          stores.honey = Math.max(0, stores.honey - honeyCostPerCell);
          if (stores.honey < honeyCostPerCell) break; // Stop if out of honey
        }
      }
    }
  }
}

function updateCellRenderTypes() {
  if (builtHexesCache.length === 0) return;

  let neededBrood = Math.floor(brood.egg + brood.larva + brood.pupa);
  let neededHoney = Math.floor(stores.honey);
  let neededPollen = Math.floor(stores.pollen);

  // Reset all to empty first
  for (let i = 0; i < builtHexesCache.length; i++) {
    builtHexesCache[i].type = 'empty';
    builtHexesCache[i].capped = false;
  }

  // Assign types based on noise and distance, ensuring needs are met
  // This is a greedy algorithm and might not be perfect, but it's more organic
  for (let i = 0; i < builtHexesCache.length; i++) {
    const hex = builtHexesCache[i];
    const dist = Math.sqrt(hex.q * hex.q + hex.q * hex.r + hex.r * hex.r);
    const noiseVal = noise(hex.q * 0.2 + noiseSeed, hex.r * 0.2 + noiseSeed);

    // Strong bias for brood in the center, stores outside
    const broodScore = (1 - dist / maxRings) * 0.7 + noiseVal * 0.3;
    const honeyScore = (dist / maxRings) * 0.6 + noiseVal * 0.4;
    const pollenScore = (dist / maxRings) * 0.5 + (1 - noiseVal) * 0.5;

    if (broodScore > honeyScore && broodScore > pollenScore && neededBrood > 0) {
      hex.type = 'brood';
      // Capping logic needs to be smarter, but for now, we'll cap pupae
      if (neededBrood <= brood.pupa) {
        hex.capped = true;
      }
      neededBrood--;
    } else if (honeyScore > pollenScore && neededHoney > 0) {
      hex.type = 'honey';
      hex.capped = true; // Honey is always capped
      neededHoney--;
    } else if (neededPollen > 0) {
      hex.type = 'pollen';
      neededPollen--;
    }
  }
}

function getNeighbors(q, r) {
  return [
    { q: q + 1, r: r },
    { q: q - 1, r: r },
    { q: q, r: r + 1 },
    { q: q, r: r - 1 },
    { q: q + 1, r: r - 1 },
    { q: q - 1, r: r + 1 }
  ];
}

function updateBeeDensity() {
  // Reset density for all built hexes
  for (let i = 0; i < builtHexesCache.length; i++) {
    builtHexesCache[i].density = 0;
    builtHexesCache[i].roleColor = null;
  }

  // Calculate bees per zone and dominant role
  for (const z of Object.keys(ZONES)) {
    let totalBees = 0;
    let maxRoleCount = 0;
    let dominantRole = 'FORAGER';

    for (const b of BUCKETS) {
      for (const r of ROLES) {
        const count = bees[z][b][r];
        totalBees += count;
        if (count > maxRoleCount) {
          maxRoleCount = count;
          dominantRole = r;
        }
      }
    }

    if (totalBees <= 0) continue;

    // Map Sim Zones to Visual Zones
    let visualZone = z;
    if (z === 'VESTIBULE' || z === 'UNLOAD') visualZone = 'ENTRANCE'; // Map these to entrance area
    if (z === 'BUILD_FRONT') visualZone = 'STORES'; // Map build front to stores area

    const targetHexes = zoneHexesCache[visualZone];
    if (targetHexes && targetHexes.length > 0) {
      const densityPerHex = totalBees / targetHexes.length;
      const roleCol = ROLE_COLORS[dominantRole];
      
      for (let i = 0; i < targetHexes.length; i++) {
        targetHexes[i].density += densityPerHex;
        // Blend or set color? Simple set for now, last write wins (or maybe average?)
        // Since we map multiple sim zones to one visual zone, we might overwrite.
        // Let's just take the color of the zone with the most bees if we wanted to be perfect,
        // but overwriting is fast and acceptable for "ruthless optimization".
        targetHexes[i].roleColor = roleCol; 
      }
    }
  }
}

