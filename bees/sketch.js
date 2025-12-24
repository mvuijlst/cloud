/* global createCanvas, windowWidth, windowHeight, resizeCanvas, background, deltaTime, random, createVector, dist, fill, stroke, strokeWeight, noStroke, ellipse, beginShape, vertex, endShape, pop, push, translate, color, text, textSize, textAlign, LEFT, CENTER, rect, width, height, lerp, line, mouseIsPressed, mouseX, mouseY */

// Zone-based hive simulation following simulation.md spec

// === CONSTANTS ===
const DAYS_PER_SEC = 0.15;
const FAST_MULT = 3;
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
const BUCKET_MORTALITY = [180, 150, 120, 60, 18]; // mean lifetime (days)

// Roles
const ROLES = ['NURSE', 'BUILDER', 'PROCESSOR', 'GUARD', 'FORAGER'];
const ROLE_COLORS = {
  NURSE: '#ffdf7f',
  BUILDER: '#d4a35c',
  PROCESSOR: '#e5b25d',
  GUARD: '#c2812f',
  FORAGER: '#7ec4c1'
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
let maxCells = 1000;
let queen = { hunger: 0.4, layRate: 180 }; // eggs/day when fed

let simAccumulator = 0;
let fastTime = false;
let simTime = 0; // total days elapsed

// === INIT ===
function setup() {
  createCanvas(windowWidth, windowHeight);
  textAlign(CENTER, CENTER);
  centerX = width / 2;
  centerY = height / 2;
  
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
  
  // Create all potential cells
  for (let ring = 0; ring <= maxRings; ring++) {
    const hexes = ring === 0 ? [{q: 0, r: 0}] : hexRing(0, 0, ring);
    for (const hex of hexes) {
      hexGrid.push({
        q: hex.q,
        r: hex.r,
        built: false,
        type: 'empty',
        capped: false,
        buildProgress: 0.0
      });
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
    }
  }
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
  // Egg → Larva (3 days)
  const eggRate = 1 - Math.exp(-dtDays / 3);
  const hatchedEggs = brood.egg * eggRate;
  brood.egg -= hatchedEggs;
  brood.larva += hatchedEggs;
  
  // Larva → Pupa (6 days, depends on nursing)
  const larvaSupport = computeLarvaSupport();
  const effectiveRate = Math.max(0.25, larvaSupport); // minimum progress
  const larvaPupateRate = 1 - Math.exp(-dtDays / (6 / effectiveRate));
  const pupatedLarva = brood.larva * larvaPupateRate * (larvaSupport > 0.5 ? 1 : 0.3);
  brood.larva -= pupatedLarva;
  brood.pupa += pupatedLarva;
  
  // Pupa → Adult (12 days)
  const pupaRate = 1 - Math.exp(-dtDays / 12);
  const emerged = brood.pupa * pupaRate;
  brood.pupa -= emerged;
  
  // Add emerged bees to B0 NURSE in BROOD_CORE
  bees['BROOD_CORE']['B0']['NURSE'] += emerged;
}

function computeLarvaSupport() {
  const nurses = countByRole('NURSE');
  const larvaDemand = brood.larva * 0.3; // units/day
  const nurseSupply = nurses * 0.4; // units/day per nurse
  const pollenNeed = larvaDemand * 0.1;
  const honeyNeed = larvaDemand * 0.1;
  
  const support = Math.min(
    nurseSupply / Math.max(0.1, larvaDemand),
    stores.pollen / Math.max(0.1, pollenNeed),
    stores.honey / Math.max(0.1, honeyNeed)
  );
  
  return Math.min(1, support);
}

function queenLay(dtDays) {
  const emptyBroodCells = Math.max(0, builtCells * 0.6 - brood.egg - brood.larva - brood.pupa);
  if (emptyBroodCells <= 0) return;
  
  if (queen.hunger > 1.2) return; // too hungry
  
  const maxEggs = queen.layRate * dtDays;
  const actualEggs = Math.min(maxEggs, emptyBroodCells);
  brood.egg += actualEggs;
  
  queen.hunger += dtDays * 0.3;
}

function computeDemands() {
  const D = {};
  D.NURSE = brood.larva * 0.5;
  D.BUILDER = Math.max(0, (maxCells - builtCells) * 0.01);
  D.PROCESSOR = stores.nectar * 0.2;
  D.FORAGER = Math.max(0, 50 - stores.honey) * 0.5;
  D.GUARD = countByRole('FORAGER') * 0.08;
  return D;
}

function allocateRoles(demands, dtDays) {
  // Compute target role distribution
  const total = Object.values(demands).reduce((a, b) => a + b, 0.1);
  const targets = {};
  for (const r of ROLES) {
    const D = demands[r] || 0;
    targets[r] = D / total;
  }
  
  // Adjust role assignments gradually (τ = 1 day)
  const pSwitch = 1 - Math.exp(-dtDays / 1.0);
  
  for (const z of Object.keys(ZONES)) {
    for (const b of BUCKETS) {
      const totalInBucket = ROLES.reduce((sum, r) => sum + bees[z][b][r], 0);
      if (totalInBucket < 0.1) continue;
      
      for (const r of ROLES) {
        const eligibility = ELIGIBILITY[r][BUCKETS.indexOf(b)];
        const targetFrac = targets[r] * eligibility;
        const currentFrac = bees[z][b][r] / totalInBucket;
        const delta = (targetFrac - currentFrac) * totalInBucket * pSwitch * 0.3;
        
        bees[z][b][r] = Math.max(0, bees[z][b][r] + delta);
      }
      
      // Normalize to preserve total
      const newTotal = ROLES.reduce((sum, r) => sum + bees[z][b][r], 0);
      if (newTotal > 0.01) {
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
  const capacity = processors * 0.5 * dtDays;
  const processed = Math.min(stores.nectar, capacity);
  stores.nectar -= processed;
  stores.honey += processed * 0.8;
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
  const consumption = totalBees * 0.015 * dtDays; // honey units/bee/day
  stores.honey = Math.max(0, stores.honey - consumption);
  
  // Feed queen
  if (stores.honey > 0.5) {
    queen.hunger = Math.max(0, queen.hunger - dtDays * 0.4);
    stores.honey -= 0.1 * dtDays;
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
function render() {
  background(25, 20, 15);
  
  // Count built cells
  builtCells = hexGrid.filter(h => h.built).length;
  
  // Update cell types based on zone populations
  updateCellTypes();
  
  // Draw hexagonal cells
  for (const hex of hexGrid) {
    if (hex.buildProgress < 0.1) continue;
    
    const pos = hexToPixel(hex.q, hex.r);
    drawHexCell(pos.x, pos.y, hex);
  }
  
  // Draw bees on cells
  drawBeesOnCells();
  
  // UI overlay
  fill(0, 0, 0, 200);
  noStroke();
  rect(10, 10, 320, 240, 8);
  
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
  const alpha = Math.min(255, hex.buildProgress * 255);
  
  // Cell fill color based on type
  let fillColor;
  if (!hex.built || hex.buildProgress < 1.0) {
    // Partially built - show construction
    fillColor = color(100, 90, 70, alpha * 0.4);
  } else if (hex.type === 'brood') {
    fillColor = hex.capped ? color(210, 180, 130, alpha) : color(245, 230, 190, alpha);
  } else if (hex.type === 'honey') {
    fillColor = color(230, 180, 50, alpha);
  } else if (hex.type === 'pollen') {
    fillColor = color(255, 200, 80, alpha);
  } else {
    fillColor = color(160, 145, 115, alpha * 0.7);
  }
  
  // Draw hexagon
  fill(fillColor);
  stroke(40, 35, 25, alpha * 0.8);
  strokeWeight(hex.buildProgress < 1.0 ? 0.5 : 1);
  
  const scale = hex.buildProgress < 1.0 ? 0.5 + hex.buildProgress * 0.5 : 1.0;
  
  beginShape();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i;
    const vx = x + hexSize * scale * Math.cos(angle);
    const vy = y + hexSize * scale * Math.sin(angle);
    vertex(vx, vy);
  }
  endShape();
  
  // Draw capping pattern
  if (hex.capped && hex.buildProgress > 0.9) {
    stroke(180, 150, 100, alpha * 0.6);
    strokeWeight(0.5);
    for (let i = 0; i < 3; i++) {
      const angle = Math.PI / 3 * i * 2;
      const x1 = x + hexSize * 0.6 * Math.cos(angle);
      const y1 = y + hexSize * 0.6 * Math.sin(angle);
      const x2 = x + hexSize * 0.6 * Math.cos(angle + Math.PI);
      const y2 = y + hexSize * 0.6 * Math.sin(angle + Math.PI);
      line(x1, y1, x2, y2);
    }
  }
}

function updateCellTypes(dtDays) {
  // Determine which cells to build next (organic growth)
  const unbuilt = hexGrid.filter(h => !h.built && h.buildProgress < 1.0);
  const buildersCount = countByRole('BUILDER');
  
  // Build capacity per simulation.md: cellsPerBuilderPerDay * builders * dt
  const cellsPerBuilderPerDay = 0.4;
  const honeyCostPerCell = 0.8; // honey units consumed per cell built
  const buildCapacity = buildersCount * cellsPerBuilderPerDay * dtDays;
  
  if (buildersCount > 3 && unbuilt.length > 0 && builtCells < maxCells && stores.honey > honeyCostPerCell) {
    // Find cells adjacent to built cells
    const candidates = unbuilt.filter(h => {
      const neighbors = getNeighbors(h.q, h.r);
      return neighbors.some(n => {
        const neighbor = hexGrid.find(hx => hx.q === n.q && hx.r === n.r);
        return neighbor && neighbor.built;
      });
    }).map(h => {
      // Calculate priority score for natural growth
      const pos = hexToPixel(h.q, h.r);
      const centerDist = Math.sqrt(h.q * h.q + h.q * h.r + h.r * h.r);
      
      // Prefer downward expansion (positive r), slight outward bias
      const downwardBias = h.r > 0 ? 2.0 : 0.5;
      const sidewaysBias = Math.abs(h.q) > Math.abs(h.r) ? 1.2 : 1.0;
      
      // Count built neighbors (prefer attaching to multiple cells)
      const neighbors = getNeighbors(h.q, h.r);
      const builtNeighbors = neighbors.filter(n => {
        const neighbor = hexGrid.find(hx => hx.q === n.q && hx.r === n.r);
        return neighbor && neighbor.built;
      }).length;
      
      const neighborBonus = builtNeighbors * 1.5;
      const randomness = Math.random() * 0.8;
      
      return {
        hex: h,
        priority: downwardBias * sidewaysBias * neighborBonus + randomness
      };
    }).sort((a, b) => b.priority - a.priority);
    
    if (candidates.length > 0) {
      // Distribute build capacity across active sites
      const activeBuildSites = Math.min(5, Math.max(2, Math.floor(buildersCount / 8)));
      const capacityPerSite = buildCapacity / activeBuildSites;
      
      let cellsBuiltThisTick = 0;
      for (let i = 0; i < Math.min(activeBuildSites, candidates.length); i++) {
        const hex = candidates[i].hex;
        const progressGain = capacityPerSite * (1.0 - i * 0.15); // Lower priority builds slower
        hex.buildProgress += progressGain;
        
        if (hex.buildProgress >= 1.0) {
          hex.built = true;
          hex.buildProgress = 1.0;
          cellsBuiltThisTick++;
          
          // Consume honey for wax production
          stores.honey = Math.max(0, stores.honey - honeyCostPerCell);
          if (stores.honey < honeyCostPerCell) break; // Stop if out of honey
        }
      }
    }
  }
  
  // Update cell contents based on stores and brood
  const builtHexes = hexGrid.filter(h => h.built);
  const broodCells = Math.floor(brood.egg + brood.larva + brood.pupa);
  const honeyCells = Math.floor(stores.honey);
  const pollenCells = Math.floor(stores.pollen);
  
  // Assign types to cells (inner = brood, outer = stores)
  let broodAssigned = 0;
  let honeyAssigned = 0;
  let pollenAssigned = 0;
  
  for (const hex of builtHexes) {
    const distFromCenter = Math.sqrt(hex.q * hex.q + hex.q * hex.r + hex.r * hex.r);
    
    if (distFromCenter < 5 && broodAssigned < broodCells) {
      hex.type = 'brood';
      hex.capped = broodAssigned < brood.pupa;
      broodAssigned++;
    } else if (distFromCenter >= 4 && honeyAssigned < honeyCells) {
      hex.type = 'honey';
      hex.capped = false;
      honeyAssigned++;
    } else if (distFromCenter >= 4 && pollenAssigned < pollenCells) {
      hex.type = 'pollen';
      hex.capped = false;
      pollenAssigned++;
    } else {
      hex.type = 'empty';
      hex.capped = false;
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

function drawBeesOnCells() {
  // Draw bees distributed across zones
  const totalBees = countAllBees();
  if (totalBees === 0) return;
  
  // Sample bees to draw (don't draw all for performance)
  const maxBeesToDraw = 150;
  const drawProbability = Math.min(1, maxBeesToDraw / totalBees);
  
  let beesDrawn = 0;
  for (const z of Object.keys(ZONES)) {
    for (const b of BUCKETS) {
      for (const r of ROLES) {
        const count = bees[z][b][r];
        for (let i = 0; i < count; i++) {
          if (Math.random() > drawProbability) continue;
          if (beesDrawn >= maxBeesToDraw) break;
          
          // Place bee on a random cell based on zone
          const hex = pickHexForZone(z);
          if (hex) {
            const pos = hexToPixel(hex.q, hex.r);
            const jitter = 6;
            const bx = pos.x + (Math.random() - 0.5) * jitter;
            const by = pos.y + (Math.random() - 0.5) * jitter;
            
            fill(ROLE_COLORS[r]);
            noStroke();
            ellipse(bx, by, 3, 3);
            beesDrawn++;
          }
        }
      }
    }
  }
}

function pickHexForZone(zoneName) {
  const builtHexes = hexGrid.filter(h => h.built);
  if (builtHexes.length === 0) return null;
  
  // Map zones to hex regions
  if (zoneName === 'BROOD_CORE' || zoneName === 'BROOD_RING') {
    const broodHexes = builtHexes.filter(h => {
      const dist = Math.sqrt(h.q * h.q + h.q * h.r + h.r * h.r);
      return dist < 5;
    });
    return broodHexes[Math.floor(Math.random() * broodHexes.length)];
  } else if (zoneName === 'STORES' || zoneName === 'BUILD_FRONT') {
    const storeHexes = builtHexes.filter(h => {
      const dist = Math.sqrt(h.q * h.q + h.q * h.r + h.r * h.r);
      return dist >= 4 && dist < 8;
    });
    return storeHexes.length > 0 ? storeHexes[Math.floor(Math.random() * storeHexes.length)] : builtHexes[Math.floor(Math.random() * builtHexes.length)];
  } else if (zoneName === 'ENTRANCE' || zoneName === 'VESTIBULE') {
    // Bottom entrance area
    const entranceHexes = builtHexes.filter(h => {
      const dist = Math.sqrt(h.q * h.q + h.q * h.r + h.r * h.r);
      return dist >= 3 && dist < 6 && h.r > 0;
    });
    return entranceHexes.length > 0 ? entranceHexes[Math.floor(Math.random() * entranceHexes.length)] : builtHexes[Math.floor(Math.random() * builtHexes.length)];
  } else {
    // OUTSIDE, UNLOAD - outer edge
    return builtHexes[Math.floor(Math.random() * builtHexes.length)];
  }
}

