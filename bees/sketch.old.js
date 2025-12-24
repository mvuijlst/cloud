/* global createCanvas, windowWidth, windowHeight, resizeCanvas, background, deltaTime, random, noise, createVector, dist, fill, stroke, strokeWeight, noStroke, ellipse, beginShape, vertex, endShape, PUSH, pop, push, translate, textFont, textSize, textAlign, LEFT, CENTER, color, rectMode, RECTMODE, colorMode, HSB */

// Minimal p5 hive simulation focusing on colony flow with brood, stores, and role shifts.

let cells = [];
let cellByKey = new Map();
let bees = [];
let queen;
let entranceCell;
let origin;
let fastTime = false;
let honeyList = [];
let pollenList = [];
let emptyBroodList = [];
let unbuiltList = [];
let broodCounts = { egg: 0, larva: 0, pupa: 0 };
let simAccumulator = 0;
const FIXED_DT = 0.25; // seconds per physics tick

const HEX_R = 22;
const DAYS_PER_SEC = 0.08; // simulation days advanced per real second when slow
const FAST_MULT = 4;
const HIVE_RADIUS = 6;
const INITIAL_BEES = 120;

const CELL_COLORS = {
  empty: '#1c140f',
  entrance: '#23302c',
  egg: '#f3e5b5',
  larva: '#e2b34d',
  pupa: '#c4852f',
  honey: '#b07500',
  pollen: '#6f4c1e',
  capped: '#8b5a1b',
  vented: '#30444a'
};

const ROLE_COLORS = {
  queen: '#f5c542',
  nurse: '#ffdf7f',
  attendant: '#e5b25d',
  heater: '#c2812f',
  forager: '#7ec4c1',
  cleaner: '#b18c6b',
  builder: '#d4a35c'
};

class Bee {
  constructor(role, cell, ageDays = 0) {
    this.role = role;
    this.cell = cell;
    this.nextCell = cell;
    this.pos = createVector(cell.x, cell.y);
    this.ageDays = ageDays;
    this.moveTimer = 0;
    this.state = 'inside'; // inside, toEntrance, outside, returning
    this.tripTimer = random(2, 4);
    this.tripProgress = 0;
    this.carry = null; // honey or pollen
    this.heat = 0;
  }

  update(dtSec, dtDays) {
    this.ageDays += dtDays;
    if (this.role !== 'queen') {
      const targetRole = roleForAge(this.ageDays);
      if (targetRole !== this.role) this.role = targetRole;
    }

    if (this.role === 'forager') {
      this.updateForager(dtSec, dtDays);
    } else {
      this.wander(dtSec);
      this.doWork(dtDays);
    }
  }

  wander(dtSec) {
    this.moveTimer -= dtSec;
    if (this.moveTimer <= 0) {
      const neighbors = this.cell.neighbors.filter(n => n.built);
      if (neighbors.length) {
        this.nextCell = random(neighbors);
      }
      this.moveTimer = random(0.4, 1.3);
    }
    this.pos.x = lerp(this.pos.x, this.nextCell.x, 0.05);
    this.pos.y = lerp(this.pos.y, this.nextCell.y, 0.05);
    this.cell = this.nextCell;
  }

  doWork(dtDays) {
    if (this.role === 'attendant') {
      if (isNear(this.cell, queen.cell) && queen.hunger > 0.35) {
        if (takeFood('honey', 0.12)) {
          queen.hunger = Math.max(0, queen.hunger - 0.5);
        }
      }
    }
    if (this.role === 'nurse') {
      const larva = findLarvaNeedingFeed(this.cell);
      if (larva && takeFood('pollen', 0.05) && takeFood('honey', 0.05)) {
        larva.feed += 1;
      }
    }
    if (this.role === 'heater') {
      for (const n of this.cell.neighbors) {
        if (isBrood(n)) n.heat = Math.min(n.heat + dtDays * 3, 3);
      }
    }
    if (this.role === 'builder') {
      attemptBuild(this.cell);
    }
  }

  updateForager(dtSec, dtDays) {
    if (this.state === 'inside') {
      this.tripTimer -= dtSec * (fastTime ? FAST_MULT : 1);
      this.wander(dtSec);
      if (this.tripTimer <= 0) {
        this.state = 'toEntrance';
        this.tripProgress = 0;
        this.nextCell = entranceCell;
      }
    } else if (this.state === 'toEntrance') {
      this.tripProgress += dtSec * 0.7 * (fastTime ? FAST_MULT : 1);
      this.pos.x = lerp(this.pos.x, entranceCell.x, 0.25);
      this.pos.y = lerp(this.pos.y, entranceCell.y, 0.25);
      if (dist(this.pos.x, this.pos.y, entranceCell.x, entranceCell.y) < 1.2) {
        this.pos.x = entranceCell.x;
        this.pos.y = entranceCell.y;
        this.cell = entranceCell;
        this.nextCell = entranceCell;
        this.state = 'outside';
        this.tripTimer = random(4, 8);
        this.tripProgress = 0;
      }
    } else if (this.state === 'outside') {
      this.tripTimer -= dtSec * (fastTime ? FAST_MULT : 1);
      // drift outside
      this.pos.x += random(-1, 1);
      this.pos.y += random(-1, 1);
      if (this.tripTimer <= 0) {
        this.state = 'returning';
        this.tripProgress = 0;
        this.carry = random() < 0.7 ? 'honey' : 'pollen';
      }
    } else if (this.state === 'returning') {
      this.tripProgress += dtSec * 0.4 * (fastTime ? FAST_MULT : 1);
      const ent = entranceCell;
      this.pos.x = lerp(this.pos.x, ent.x, 0.18);
      this.pos.y = lerp(this.pos.y, ent.y, 0.18);
      if (this.tripProgress >= 1) {
        if (this.carry) depositFood(this.carry, 0.3);
        this.carry = null;
        this.state = 'inside';
        this.tripTimer = random(3, 6);
        this.cell = ent;
        this.nextCell = ent;
      }
    }
  }

  draw() {
    const size = this.role === 'queen' ? 12 : 7;
    const col = ROLE_COLORS[this.role] || '#cccccc';
    stroke(0, 0, 0, 160);
    strokeWeight(1);
    fill(col);
    ellipse(this.pos.x, this.pos.y, size, size);
  }
}

function setup() {
  frameRate(15);
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.canvas.style.display = 'block';
  buildHive(HIVE_RADIUS);
  seedColony();
  origin = createVector(width / 2, height / 2);
  buildLegend();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  origin = createVector(width / 2, height / 2);
}

function draw() {
  const frameDt = (deltaTime || 16) / 1000;
  simAccumulator += frameDt;
  const speed = fastTime ? FAST_MULT : 1;

  // fixed-step simulation for determinism at larger scales
  while (simAccumulator >= FIXED_DT) {
    const dtSec = FIXED_DT;
    const dtDays = dtSec * DAYS_PER_SEC * speed;
    updateSimulation(dtSec, dtDays);
    simAccumulator -= FIXED_DT;
  }

  background(15, 12, 10);
  push();
  translate(origin.x, origin.y);
  drawCells();
  drawBees();
  pop();
  updateUI();
}

function mousePressed() {
  fastTime = !fastTime;
}

function buildHive(radius) {
  cells = [];
  cellByKey = new Map();
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      // Force entrance at bottom (0, radius) to exist
      const isEntrance = (q === 0 && r === radius);
      if (!isEntrance && random() < 0.14 && Math.abs(q) + Math.abs(r) > radius - 1) continue; // irregular holes
      
      const pos = axialToPixel(q, r);
      const cell = {
        q,
        r,
        built: false,
        x: pos.x,
        y: pos.y,
        ring: Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)),
        kind: 'empty',
        timer: 0,
        feed: 0,
        heat: 0,
        neighbors: []
      };
      cells.push(cell);
      cellByKey.set(cellKey(q, r), cell);
    }
  }
  // neighbors
  for (const c of cells) {
    const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    for (const [dq, dr] of dirs) {
      const n = cellByKey.get(cellKey(c.q + dq, c.r + dr));
      if (n) c.neighbors.push(n);
    }
  }
  // entrance: fixed at bottom
  entranceCell = cellByKey.get(cellKey(0, radius));
  if (entranceCell) {
    entranceCell.kind = 'entrance';
    entranceCell.built = true;
  }

  // seed minimal built patch (center + neighbors + entrance)
  const center = cellByKey.get(cellKey(0, 0));
  if (center) {
    center.built = true;
    for (const n of center.neighbors) n.built = true;
  }
  if (entranceCell) {
    entranceCell.kind = 'entrance';
    entranceCell.store = 0;
  }

  // starter stores: tiny amounts to bootstrap feeding
  if (center) {
    const starter = center.neighbors.slice(0, 2);
    if (starter[0]) { starter[0].kind = 'honey'; starter[0].store = 0.2; }
    if (starter[1]) { starter[1].kind = 'pollen'; starter[1].store = 0.2; }
  }

  rebuildCaches();
}

function seedColony() {
  const center = cellByKey.get(cellKey(0, 0)) || cells[0];
  queen = { cell: center, hunger: 0.4, layTimer: 0 };
  bees = [];
  for (let i = 0; i < INITIAL_BEES; i++) {
    const age = random(0, 18); // start younger to avoid immediate forager dominance
    bees.push(new Bee(roleForAge(age), center, age));
  }
  // a few nurses near brood ring
  for (let i = 0; i < 10; i++) {
    const c = random(center.neighbors);
    bees.push(new Bee('nurse', c, random(3, 9)));
  }
  rebuildCaches();
}

function updateSimulation(dtSec, dtDays) {
  queenStep(dtDays);
  updateCells(dtDays);
  for (let i = bees.length - 1; i >= 0; i--) {
    const b = bees[i];
    b.update(dtSec, dtDays);
    if (b.ageDays > 45 && random() < 0.001 * b.ageDays) {
      bees.splice(i, 1); // lifespan end
    }
  }
}

function queenStep(dtDays) {
  queen.hunger += dtDays * 0.2;
  queen.layTimer -= dtDays;
  if (queen.hunger < 0.9 && queen.layTimer <= 0) {
    let eggs = 0;
    for (let i = 0; i < 6; i++) {
      const target = pickEmptyBroodCell();
      if (!target) break;
      target.kind = 'egg';
      target.timer = 0;
      target.feed = 0;
      eggs++;
    }
    if (eggs > 0) queen.layTimer = random(0.4, 0.9); // days
  }
}

function pickEmptyBroodCell() {
  if (!emptyBroodList.length) return null;
  // pick closest to queen for compact brood nest
  let best = null;
  let bestD = 1e9;
  for (const c of emptyBroodList) {
    const d = dist(c.x, c.y, queen.cell.x, queen.cell.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (best) {
    const idx = emptyBroodList.indexOf(best);
    if (idx >= 0) emptyBroodList.splice(idx, 1);
  }
  return best;
}

function updateCells(dtDays) {
  honeyList.length = 0;
  pollenList.length = 0;
  emptyBroodList.length = 0;
  unbuiltList.length = 0;
  broodCounts.egg = broodCounts.larva = broodCounts.pupa = 0;

  for (const c of cells) {
    if (!c.built) {
      unbuiltList.push(c);
      continue;
    }
    c.heat = Math.max(0, c.heat - dtDays * 1.2);

    if (c.kind === 'egg') {
      c.timer += dtDays;
      if (c.timer >= 3) {
        c.kind = 'larva';
        c.timer = 0;
        c.feed = 0;
      }
      broodCounts.egg++;
    } else if (c.kind === 'larva') {
      c.timer += dtDays;
      if (c.feed >= 3 && c.timer >= 6) {
        c.kind = 'pupa';
        c.timer = 0;
      }
      broodCounts.larva++;
    } else if (c.kind === 'pupa') {
      c.timer += dtDays;
      if (c.timer >= 9) {
        c.kind = 'empty';
        c.timer = 0;
        bees.push(new Bee('cleaner', c, 0));
      }
      if (c.kind === 'pupa') broodCounts.pupa++;
    }

    // storage hydration drift
    if ((c.kind === 'honey' || c.kind === 'pollen') && c.store !== undefined) {
      c.store = Math.max(0, Math.min(1.2, c.store - dtDays * 0.01));
      if (c.store <= 0.02) c.kind = 'empty';
    }

    // rebuild caches
    if (c.kind === 'honey' && c.store > 0.03) honeyList.push(c);
    if (c.kind === 'pollen' && c.store > 0.03) pollenList.push(c);
    if (c.kind === 'empty' && c.ring <= HIVE_RADIUS - 1) emptyBroodList.push(c);
  }
}

function findLarvaNeedingFeed(cell) {
  for (const n of cell.neighbors) {
    if (n.kind === 'larva' && n.feed < 4) return n;
  }
  return null;
}

function isBrood(c) {
  return c.kind === 'egg' || c.kind === 'larva' || c.kind === 'pupa';
}

function takeFood(type, amount) {
  const list = type === 'honey' ? honeyList : pollenList;
  for (let attempts = 0; attempts < 4 && list.length; attempts++) {
    const idx = (list.length * Math.random()) | 0;
    const c = list[idx];
    if (c.store >= amount) {
      c.store -= amount;
      if (c.store < 0.03) list.splice(idx, 1);
      return true;
    }
    list.splice(idx, 1);
  }
  return false;
}

function depositFood(type, amount) {
  const list = type === 'honey' ? honeyList : pollenList;
  if (list.length === 0) {
    // create a new storage cell from empties
    for (let i = 0, n = cells.length; i < n; i++) {
      const c = cells[(Math.random() * n) | 0];
      if (c.built && c.kind === 'empty' && c.ring >= HIVE_RADIUS - 2) { // prefer outer rings for stores
        c.kind = type;
        c.store = 0;
        list.push(c);
        break;
      }
    }
    if (list.length === 0) return false;
  }
  const c = list[(list.length * Math.random()) | 0];
  c.store = Math.min(1.2, (c.store || 0) + amount);
  if (c.store > 0.03 && !list.includes(c)) list.push(c);
  return true;
}

function drawCells() {
  for (const c of cells) {
    if (!c.built) continue;
    const fillCol = CELL_COLORS[c.kind] || CELL_COLORS.empty;
    const heatBoost = c.heat > 0 ? Math.min(40, c.heat * 12) : 0;
    const col = color(fillCol);
    col.setRed(col.levels[0] + heatBoost);
    col.setGreen(col.levels[1] + heatBoost * 0.6);
    noStroke();
    fill(col);
    drawHex(c.x, c.y, HEX_R * 0.98);
    if (c.kind === 'honey' || c.kind === 'pollen') {
      const amount = Math.max(0, Math.min(1, c.store || 0));
      if (amount > 0.05) {
        noStroke();
        fill(0, 0, 0, 40);
        ellipse(c.x, c.y, HEX_R * 0.8, HEX_R * 0.8);
        
        const innerCol = c.kind === 'honey' ? '#d48c00' : '#8a5e26';
        fill(innerCol);
        const r = HEX_R * 0.7 * Math.sqrt(amount);
        ellipse(c.x, c.y, r * 2, r * 2);
      }
    }
    if (c.kind === 'entrance') {
      stroke('#6f9b90');
      noFill();
      strokeWeight(1.5);
      drawHex(c.x, c.y, HEX_R * 1.05);
    }
  }
}

function drawBees() {
  // queen first
  stroke(0);
  strokeWeight(1.5);
  fill(ROLE_COLORS.queen);
  ellipse(queen.cell.x, queen.cell.y, 14, 14);
  for (const b of bees) {
    b.draw();
  }
}

function updateUI() {
  const statsDiv = document.getElementById('stats');
  const legendDiv = document.getElementById('legend');
  if (!statsDiv || !legendDiv) return;
  const counts = countRoles();
  const stores = countStores();
  const dtms = (FIXED_DT * 1000).toFixed(0);
  statsDiv.innerText = [
    `Bees: ${bees.length + 1}`,
    `Roles - nurses ${counts.nurse}, builders ${counts.builder}, attendants ${counts.attendant}, heaters ${counts.heater}, foragers ${counts.forager}`,
    `Brood cells - egg ${stores.egg}, larva ${stores.larva}, pupa ${stores.pupa}`,
    `Stores - honey ${stores.honey.toFixed(1)} frames, pollen ${stores.pollen.toFixed(1)} frames`,
    `Queen hunger: ${(queen.hunger).toFixed(2)} | Time speed: ${fastTime ? 'fast' : 'normal'}`,
    `Tick: ${dtms} ms fixed`
  ].join('\n');
}

function buildLegend() {
  const legend = document.getElementById('legend');
  if (!legend) return;
  const beeEntries = [
    ['Queen', ROLE_COLORS.queen],
    ['Nurse', ROLE_COLORS.nurse],
    ['Attendant', ROLE_COLORS.attendant],
    ['Builder', ROLE_COLORS.builder],
    ['Heater', ROLE_COLORS.heater],
    ['Forager', ROLE_COLORS.forager]
  ];
  const cellEntries = [
    ['Empty', CELL_COLORS.empty],
    ['Egg/Larva/Pupa', CELL_COLORS.egg],
    ['Honey', CELL_COLORS.honey],
    ['Pollen', CELL_COLORS.pollen],
    ['Entrance', CELL_COLORS.entrance]
  ];
  const sectionTitle = title => `<div class="legend-title">${title}</div><div></div>`;
  const row = (name, color) => `<div class="swatch" style="--sw:${color}"></div><div>${name}</div>`;
  legend.innerHTML = [
    sectionTitle('Bees'),
    ...beeEntries.map(([n, c]) => row(n, c)),
    sectionTitle('Cells'),
    ...cellEntries.map(([n, c]) => row(n, c))
  ].join('');
}

function countRoles() {
  const tally = { nurse: 0, attendant: 0, heater: 0, forager: 0, cleaner: 0, builder: 0 };
  for (const b of bees) {
    tally[b.role] = (tally[b.role] || 0) + 1;
  }
  return tally;
}

function countStores() {
  const s = { honey: 0, pollen: 0, egg: broodCounts.egg, larva: broodCounts.larva, pupa: broodCounts.pupa };
  for (const h of honeyList) s.honey += h.store || 0;
  for (const p of pollenList) s.pollen += p.store || 0;
  return s;
}

function drawHex(x, y, r) {
  beginShape();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i;
    vertex(x + r * Math.cos(angle), y + r * Math.sin(angle));
  }
  endShape(CLOSE);
}

function attemptBuild(fromCell) {
  // Builders convert adjacent unbuilt cells into built comb, consuming a small honey cost.
  const frontier = fromCell.neighbors.filter(n => !n.built);
  if (!frontier.length) return;
  if (!takeFood('honey', 0.05)) return;
  const target = random(frontier);
  target.built = true;
  target.kind = 'empty';
  target.store = 0;
  rebuildCaches();
}

function rebuildCaches() {
  honeyList.length = 0;
  pollenList.length = 0;
  emptyBroodList.length = 0;
  unbuiltList.length = 0;
  broodCounts.egg = broodCounts.larva = broodCounts.pupa = 0;
  for (const c of cells) {
    if (!c.built) { unbuiltList.push(c); continue; }
    if (c.kind === 'honey' && c.store > 0.03) honeyList.push(c);
    if (c.kind === 'pollen' && c.store > 0.03) pollenList.push(c);
    if (c.kind === 'empty' && c.ring <= HIVE_RADIUS - 1) emptyBroodList.push(c);
    if (c.kind === 'egg') broodCounts.egg++;
    if (c.kind === 'larva') broodCounts.larva++;
    if (c.kind === 'pupa') broodCounts.pupa++;
  }
}

function axialToPixel(q, r) {
  const x = HEX_R * (3 / 2 * q);
  const y = HEX_R * (Math.sqrt(3) * (r + q / 2));
  return { x, y };
}

function cellKey(q, r) {
  return `${q},${r}`;
}

function ring(cell) {
  return Math.max(Math.abs(cell.q), Math.abs(cell.r), Math.abs(cell.q + cell.r));
}

function outsidePoint() {
  return createVector(entranceCell.x, entranceCell.y + HEX_R * 7);
}

function isNear(a, b) {
  return dist(a.x, a.y, b.x, b.y) < HEX_R * 1.4;
}

function roleForAge(age) {
  if (age < 3) return 'cleaner';
  if (age < 10) return 'nurse';
  if (age < 21) return 'builder';
  if (age < 28) return 'heater';
  if (age < 35) return 'attendant';
  return 'forager';
}
