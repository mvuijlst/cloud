/* Medieval city growth simulation using a simple, stylized cellular approach.
 * Click to pause/resume. Press R to restart.
 */

const TILE = {
  EMPTY: 0,
  ROAD: 1,
  MARKET: 2,
  CHURCH: 3,
  INN: 4,
  SHOP: 5,
  HOUSE: 6,
  PLAZA: 7,
  WALL: 8,
  GATE: 9,
  RIVER: 10,
  FARM: 11,
  PARK: 12,
  WATER: 13
};

const TILE_NAME = {
  [TILE.ROAD]: 'roads',
  [TILE.MARKET]: 'market',
  [TILE.CHURCH]: 'church',
  [TILE.INN]: 'inns',
  [TILE.SHOP]: 'shops',
  [TILE.HOUSE]: 'houses',
  [TILE.PLAZA]: 'plaza',
  [TILE.WALL]: 'walls',
  [TILE.GATE]: 'gates',
  [TILE.RIVER]: 'river',
  [TILE.FARM]: 'farms',
  [TILE.PARK]: 'green'
};

const COLORS = {
  [TILE.EMPTY]: '#111015',
  [TILE.ROAD]: '#4e4032',
  [TILE.MARKET]: '#e6b85c',
  [TILE.CHURCH]: '#d7dff2',
  [TILE.INN]: '#c77a52',
  [TILE.SHOP]: '#e4c28d',
  [TILE.HOUSE]: '#b0c091',
  [TILE.PLAZA]: '#cba36b',
  [TILE.WALL]: '#8b7c6a',
  [TILE.GATE]: '#f6d46b',
  [TILE.RIVER]: '#3b6fa7',
  [TILE.FARM]: '#8a5e35',
  [TILE.PARK]: '#4f7b4a',
  [TILE.WATER]: '#2e4f7d'
};

let sim;

function setup() {
  pixelDensity(1);
  createCanvas(windowWidth, windowHeight);
  sim = new CitySim();
  sim.reset();
}

function draw() {
  background('#0c0b10');
  sim.step();
  sim.render();
}

function mousePressed() {
  sim.togglePause();
}

function keyPressed() {
  if (key === 'r' || key === 'R') {
    sim.reset();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  sim.reset(true);
}

class CitySim {
  constructor() {
    this.cell = 5; // Tile size in pixels
    this.statusEl = document.getElementById('status');
    this.clock = 0;
    this.maxRoads = 0;
    this.wallBuilt = false;
  }

  reset(keepPause = false) {
    this.cols = floor(width / this.cell);
    this.rows = floor(height / this.cell);
    this.grid = new Int16Array(this.cols * this.rows);
    this.age = new Uint16Array(this.cols * this.rows);
    this.center = { x: floor(this.cols * 0.5), y: floor(this.rows * 0.52) };
    this.paused = keepPause ? this.paused : false;
    this.clock = 0;
    this.maxRoads = floor((this.cols + this.rows) * 1.6);
    this.roads = [];
    this.walkers = [];
    this.wallBuilt = false;

    this.seedRiver();
    this.seedCore();
    this.seedRoads();
    this.updateStatus();
  }

  idx(x, y) {
    return x + y * this.cols;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  seedRiver() {
    const amplitude = this.rows * random(0.12, 0.22);
    const baseY = this.rows * random(0.25, 0.68);
    let y = baseY;
    for (let x = 0; x < this.cols; x++) {
      const n = noise(x * 0.014, 3.14 + random(-0.1, 0.1)) * 2 - 1;
      y += n * 0.9 + sin(x * 0.015) * amplitude * 0.02;
      y = constrain(y, this.rows * 0.18, this.rows * 0.82);
      const iy = floor(y);
      this.carveRiver(x, iy, 2 + floor(random(3)));
    }
  }

  carveRiver(x, y, halfWidth) {
    for (let dy = -halfWidth; dy <= halfWidth; dy++) {
      const iy = y + dy;
      if (!this.inBounds(x, iy)) continue;
      const id = this.idx(x, iy);
      this.grid[id] = TILE.RIVER;
    }
  }

  seedCore() {
    // Marketplace plaza at the heart
    this.paintCircle(this.center.x, this.center.y, 4, TILE.PLAZA);
    this.paintCircle(this.center.x, this.center.y, 2, TILE.MARKET);

    // Church slightly offset
    const angle = random(-PI / 3, PI / 3);
    const dist = 10 + random(6);
    const cx = floor(this.center.x + cos(angle) * dist);
    const cy = floor(this.center.y - 6 + sin(angle) * dist);
    this.paintCircle(cx, cy, 2, TILE.CHURCH);
  }

  seedRoads() {
    const walkerCount = 5 + floor(random(3));
    for (let i = 0; i < walkerCount; i++) {
      const ang = random(TWO_PI);
      this.walkers.push({
        x: this.center.x,
        y: this.center.y,
        dir: createVector(cos(ang), sin(ang)),
        life: 200 + random(120)
      });
    }
  }

  paintCircle(cx, cy, r, type) {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r) {
          const ix = cx + x;
          const iy = cy + y;
          if (!this.inBounds(ix, iy)) continue;
          if (random() < 0.05) continue; // jitter edges for organic feel
          const id = this.idx(ix, iy);
          if (this.grid[id] === TILE.RIVER) continue;
          this.grid[id] = type;
        }
      }
    }
  }

  placeRoad(x, y) {
    const id = this.idx(x, y);
    const tile = this.grid[id];
    if (tile === TILE.RIVER || tile === TILE.WATER || tile === TILE.WALL) return false;
    if (tile === TILE.GATE) return true;
    if (tile === TILE.ROAD) return true;
    this.grid[id] = TILE.ROAD;
    this.roads.push({ x, y });
    return true;
  }

  step() {
    if (this.paused) return;
    this.clock++;

    const roadQuota = this.maxRoads - this.roads.length;
    const roadRuns = constrain(roadQuota > 0 ? 8 : 0, 0, 14);
    for (let i = 0; i < roadRuns; i++) this.growRoad();

    for (let i = 0; i < 80; i++) this.growBuilding();

    if (!this.wallBuilt && this.roads.length > this.maxRoads * 0.7) {
      this.buildWalls();
    }

    if (this.clock % 30 === 0) this.updateStatus();
  }

  growRoad() {
    if (this.walkers.length === 0) return;
    const i = floor(random(this.walkers.length));
    const w = this.walkers[i];
    if (w.life-- < 0) {
      this.walkers.splice(i, 1);
      return;
    }

    // Gentle turn jitter
    w.dir.rotate(random(-0.35, 0.35));
    w.dir.normalize();
    w.x += w.dir.x;
    w.y += w.dir.y;

    const ix = floor(w.x);
    const iy = floor(w.y);
    if (!this.inBounds(ix, iy)) {
      this.walkers.splice(i, 1);
      return;
    }

    if (!this.placeRoad(ix, iy)) {
      // bounce off blocked tiles a bit
      w.dir.rotate(PI * 0.5);
      return;
    }

    // Occasional branch creating a new walker
    if (random() < 0.09 && this.walkers.length < 12) {
      this.walkers.push({
        x: ix,
        y: iy,
        dir: w.dir.copy().rotate(random([-PI / 2.5, PI / 2.5])),
        life: 120 + random(120)
      });
    }
  }

  growBuilding() {
    if (this.roads.length === 0) return;
    const anchor = random(this.roads);
    const n = this.neighbors(anchor.x, anchor.y);
    shuffle(n, true);
    for (const { x, y } of n) {
      if (!this.inBounds(x, y)) continue;
      const id = this.idx(x, y);
      if (this.grid[id] !== TILE.EMPTY) continue;
      const t = this.pickBuildingType(x, y);
      this.grid[id] = t;
      this.age[id] = this.clock;
      return;
    }
  }

  pickBuildingType(x, y) {
    const d = dist(x, y, this.center.x, this.center.y) / (min(this.cols, this.rows) * 0.6);
    const nearRiver = this.isNearType(x, y, TILE.RIVER, 3);
    const nearMarket = this.isNearType(x, y, TILE.MARKET, 4) || this.isNearType(x, y, TILE.PLAZA, 4);

    if (d < 0.18) {
      return random() < 0.45 ? TILE.SHOP : (random() < 0.65 ? TILE.INN : TILE.MARKET);
    }
    if (d < 0.3) {
      if (nearMarket) return random() < 0.55 ? TILE.SHOP : TILE.INN;
      return random() < 0.55 ? TILE.SHOP : TILE.HOUSE;
    }
    if (d < 0.55) {
      if (nearRiver && random() < 0.5) return random() < 0.6 ? TILE.SHOP : TILE.INN;
      return random() < 0.62 ? TILE.HOUSE : TILE.FARM;
    }
    return random() < 0.27 ? TILE.PARK : TILE.FARM;
  }

  isNearType(x, y, target, radius) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const ix = x + dx;
        const iy = y + dy;
        if (!this.inBounds(ix, iy)) continue;
        if (this.grid[this.idx(ix, iy)] === target) return true;
      }
    }
    return false;
  }

  buildWalls() {
    const r = min(this.cols, this.rows) * 0.42;
    const gates = [];
    for (let a = 0; a < TWO_PI; a += 0.01) {
      const x = floor(this.center.x + cos(a) * r + random(-1, 1));
      const y = floor(this.center.y + sin(a) * r + random(-1, 1));
      if (!this.inBounds(x, y)) continue;
      const id = this.idx(x, y);
      if (this.grid[id] === TILE.RIVER) continue;
      this.grid[id] = TILE.WALL;
      // Reserve gate positions along cardinal directions
      if (abs(sin(a)) < 0.04 || abs(cos(a)) < 0.04) {
        gates.push({ x, y });
      }
    }
    // Clear openings for gates and connect roads to them
    shuffle(gates, true);
    gates.slice(0, 4).forEach((g) => {
      this.grid[this.idx(g.x, g.y)] = TILE.GATE;
      this.traceRoadToCenter(g.x, g.y);
    });
    this.wallBuilt = true;
  }

  traceRoadToCenter(x, y) {
    let cx = x;
    let cy = y;
    for (let i = 0; i < 200; i++) {
      const dx = this.center.x - cx;
      const dy = this.center.y - cy;
      const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
      const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;
      if (abs(dx) > abs(dy)) cx += stepX; else cy += stepY;
      if (!this.inBounds(cx, cy)) break;
      this.placeRoad(cx, cy);
      if (cx === this.center.x && cy === this.center.y) break;
    }
  }

  neighbors(x, y) {
    return [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 }
    ];
  }

  render() {
    noStroke();
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const id = this.idx(x, y);
        const t = this.grid[id];
        const col = COLORS[t] || '#1a191f';
        const ageFade = this.age[id] ? constrain((this.clock - this.age[id]) / 120, 0.1, 1) : 1;
        const c = color(col);
        c.setAlpha(255 * ageFade);
        fill(c);
        rect(x * this.cell, y * this.cell, this.cell, this.cell);
      }
    }

    // Overlay subtle accents for special tiles
    stroke(0, 20);
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const t = this.grid[this.idx(x, y)];
        if (t === TILE.MARKET || t === TILE.PLAZA || t === TILE.CHURCH) {
          noFill();
          strokeWeight(1);
          rect(x * this.cell + 1, y * this.cell + 1, this.cell - 2, this.cell - 2);
        }
      }
    }
  }

  togglePause() {
    this.paused = !this.paused;
    this.updateStatus();
  }

  updateStatus() {
    if (!this.statusEl) return;
    const counts = this.countTypes();
    const phrases = [
      `${this.paused ? 'Paused' : 'Growing'} · t=${this.clock}`,
      `roads ${counts[TILE.ROAD] || 0}`,
      `market ${counts[TILE.MARKET] || 0}`,
      `church ${counts[TILE.CHURCH] || 0}`,
      `inns ${counts[TILE.INN] || 0}`,
      `shops ${counts[TILE.SHOP] || 0}`,
      `houses ${counts[TILE.HOUSE] || 0}`
    ];
    this.statusEl.textContent = phrases.join(' · ');
  }

  countTypes() {
    const tally = {};
    for (let i = 0; i < this.grid.length; i++) {
      const t = this.grid[i];
      tally[t] = (tally[t] || 0) + 1;
    }
    return tally;
  }
}
