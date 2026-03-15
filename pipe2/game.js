(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const statusText = document.getElementById('statusText');
  const modeText = document.getElementById('modeText');
  const overlayText = document.getElementById('overlayText');

  const SCALE = 2;
  const TILE_W = 38 * SCALE;
  const TILE_H = 29 * SCALE;
  const HALF_W = 19 * SCALE;
  const TILE_TOP = 20 * SCALE;
  const STEP_X = 18 * SCALE;
  const STEP_Y = 9 * SCALE;

  const FLOW_SPEED = 76;
  const LOOKAHEAD_TILES = 20;
  const SEARCH_DEPTH = 10;
  const CAMERA_LERP = 5.2;
  const CAMERA_LOOK_AHEAD = 150;
  const FLOOR_RADIUS = 22;
  const RESTART_DELAY = 1.6;
  const PLACE_COOLDOWN = 0.2;

  const DIRS = ['N', 'E', 'S', 'W'];
  const DIR_VECTORS = {
    N: { x: 0, y: -1 },
    E: { x: 1, y: 0 },
    S: { x: 0, y: 1 },
    W: { x: -1, y: 0 }
  };
  const OPPOSITE = {
    N: 'S',
    E: 'W',
    S: 'N',
    W: 'E'
  };
  const ANCHORS = {
    CENTER: { x: 19, y: 10 },
    N: { x: 28.6, y: 5.4 },
    E: { x: 28.6, y: 14.6 },
    S: { x: 9.4, y: 14.6 },
    W: { x: 9.4, y: 5.4 }
  };

  const TILE_TYPES = {
    'cross': { img: 'cross.png', connections: ['N', 'E', 'S', 'W'], weight: 1 },
    'tee-e': { img: 'tee-e.png', connections: ['N', 'E', 'S'], weight: 2 },
    'tee-n': { img: 'tee-n.png', connections: ['E', 'S', 'W'], weight: 2 },
    'tee-s': { img: 'tee-s.png', connections: ['N', 'E', 'W'], weight: 2 },
    'tee-w': { img: 'tee-w.png', connections: ['N', 'S', 'W'], weight: 2 },
    'ew': { img: 'ew.png', connections: ['E', 'W'], weight: 4 },
    'ns': { img: 'ns.png', connections: ['N', 'S'], weight: 4 },
    'elbow-ne': { img: 'elbow-ne.png', connections: ['N', 'E'], weight: 5 },
    'elbow-nw': { img: 'elbow-nw.png', connections: ['N', 'W'], weight: 5 },
    'elbow-se': { img: 'elbow-se.png', connections: ['S', 'E'], weight: 5 },
    'elbow-sw': { img: 'elbow-sw.png', connections: ['S', 'W'], weight: 5 },
    'full': { img: 'full.png', connections: [], weight: 1 },
    'start-e': { img: 'start-e.png', connections: ['E'] },
    'start-n': { img: 'start-n.png', connections: ['N'] },
    'start-s': { img: 'start-s.png', connections: ['S'] },
    'start-w': { img: 'start-w.png', connections: ['W'] }
  };

  const PLAYABLE_TYPES = Object.keys(TILE_TYPES).filter((type) => !type.startsWith('start-'));
  const IMAGE_BASE = '../pipe/images/';
  const PATCH_NAMES = ['patch-nw', 'patch-ne', 'patch-nw-open', 'patch-ne-open'];
  const images = {};

  const state = {
    tiles: new Map(),
    route: [],
    flowDistance: 0,
    headIndex: 0,
    autoplay: true,
    gameState: 'loading',
    camera: { x: 0, y: 0 },
    lastTime: 0,
    restartTimer: 0,
    score: 0,
    rack: [],
    placeCooldown: 0,
    parkCursor: 0
  };

  function tileKey(x, y) {
    return `${x},${y}`;
  }

  function getTile(x, y) {
    return state.tiles.get(tileKey(x, y)) || null;
  }

  function setTile(tile) {
    state.tiles.set(tileKey(tile.x, tile.y), tile);
  }

  function randomChoice(values) {
    return values[Math.floor(Math.random() * values.length)];
  }

  function weightedRandomPlayable() {
    const bag = [];
    for (const type of PLAYABLE_TYPES) {
      const weight = TILE_TYPES[type].weight || 1;
      for (let i = 0; i < weight; i++) bag.push(type);
    }
    return randomChoice(bag);
  }

  function refillRack() {
    while (state.rack.length < 3) {
      state.rack.push(weightedRandomPlayable());
    }
  }

  function consumeRack(index) {
    const type = state.rack.splice(index, 1)[0];
    refillRack();
    return type;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `${IMAGE_BASE}${src}`;
    });
  }

  async function preload() {
    const loads = [];
    for (const [type, def] of Object.entries(TILE_TYPES)) {
      loads.push(loadImage(def.img).then((img) => { images[type] = img; }));
    }
    for (const patch of PATCH_NAMES) {
      loads.push(loadImage(`${patch}.png`).then((img) => { images[patch] = img; }));
    }
    await Promise.all(loads);
  }

  function stepFrom(x, y, dir) {
    const d = DIR_VECTORS[dir];
    return { x: x + d.x, y: y + d.y };
  }

  function tileConnections(type) {
    return TILE_TYPES[type].connections;
  }

  function toWorld(x, y) {
    return {
      x: (x - y) * STEP_X,
      y: (x + y) * STEP_Y
    };
  }

  function toScreenPoint(point) {
    return {
      x: canvas.width * 0.5 + point.x - state.camera.x,
      y: canvas.height * 0.58 + point.y - state.camera.y
    };
  }

  function screenPositionForTile(x, y) {
    return toScreenPoint(toWorld(x, y));
  }

  function worldAnchor(x, y, anchorKey) {
    const base = toWorld(x, y);
    const anchor = ANCHORS[anchorKey];
    return {
      x: base.x - HALF_W + anchor.x * SCALE,
      y: base.y - TILE_TOP + anchor.y * SCALE
    };
  }

  function sampleLine(a, b, steps = 18) {
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t
      });
    }
    return points;
  }

  function sampleQuadratic(a, c, b, steps = 24) {
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      points.push({
        x: mt * mt * a.x + 2 * mt * t * c.x + t * t * b.x,
        y: mt * mt * a.y + 2 * mt * t * c.y + t * t * b.y
      });
    }
    return points;
  }

  function polylineLength(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return total;
  }

  function partialPolyline(points, progress) {
    const p = Math.max(0, Math.min(1, progress));
    if (p <= 0) return [points[0]];
    if (p >= 1) return points.slice();

    const total = polylineLength(points);
    let remaining = total * p;
    const out = [points[0]];

    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (remaining >= seg) {
        out.push(b);
        remaining -= seg;
      } else {
        const t = seg === 0 ? 0 : remaining / seg;
        out.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t
        });
        return out;
      }
    }

    return out;
  }

  function pointAlongPolyline(points, progress) {
    const partial = partialPolyline(points, progress);
    return partial[partial.length - 1];
  }

  function sameAxis(a, b) {
    return ((a === 'N' || a === 'S') && (b === 'N' || b === 'S')) ||
      ((a === 'E' || a === 'W') && (b === 'E' || b === 'W'));
  }

  function preferredTypeForTransition(entry, exit) {
    if (entry === 'CENTER') return `start-${exit.toLowerCase()}`;
    if (sameAxis(entry, exit)) {
      return entry === 'N' || entry === 'S' ? 'ns' : 'ew';
    }

    const pair = [entry, exit].sort().join('-');
    if (pair === 'E-N') return 'elbow-ne';
    if (pair === 'N-W') return 'elbow-nw';
    if (pair === 'E-S') return 'elbow-se';
    return 'elbow-sw';
  }

  function canPieceServeTransition(type, entry, exit) {
    return type === preferredTypeForTransition(entry, exit);
  }

  function buildTileFlowPoints(x, y, entry, exit, previousEndPoint) {
    const center = worldAnchor(x, y, 'CENTER');
    let points;

    if (entry === 'CENTER') {
      points = sampleLine(center, worldAnchor(x, y, exit), 16);
    } else if (sameAxis(entry, exit)) {
      points = sampleLine(worldAnchor(x, y, entry), worldAnchor(x, y, exit), 18);
    } else {
      points = sampleQuadratic(worldAnchor(x, y, entry), center, worldAnchor(x, y, exit), 26);
    }

    if (previousEndPoint) {
      points[0] = { x: previousEndPoint.x, y: previousEndPoint.y };
    }

    return points;
  }

  function appendRouteTile(x, y, entry, exit) {
    const prev = state.route[state.route.length - 1] || null;
    const points = buildTileFlowPoints(x, y, entry, exit, prev ? prev.points[prev.points.length - 1] : null);
    const startDistance = prev ? prev.endDistance : 0;
    const length = polylineLength(points);
    const tile = {
      kind: 'route',
      x,
      y,
      entry,
      exit,
      preferredType: preferredTypeForTransition(entry, exit),
      type: entry === 'CENTER' ? preferredTypeForTransition(entry, exit) : null,
      points,
      startDistance,
      endDistance: startDistance + length
    };

    state.route.push(tile);
    setTile(tile);
  }

  function freeNeighborCount(x, y, visited) {
    let count = 0;
    for (const dir of DIRS) {
      const next = stepFrom(x, y, dir);
      if (getTile(next.x, next.y)) continue;
      if (visited.has(tileKey(next.x, next.y))) continue;
      count++;
    }
    return count;
  }

  function validExitsFor(x, y, entry, visited) {
    const exits = [];
    for (const dir of DIRS) {
      if (dir === entry) continue;
      const next = stepFrom(x, y, dir);
      const nextKey = tileKey(next.x, next.y);
      if (getTile(next.x, next.y) || visited.has(nextKey)) continue;
      exits.push(dir);
    }
    return exits;
  }

  function evaluateBranch(x, y, entry, depth, visited) {
    if (depth <= 0) {
      return freeNeighborCount(x, y, visited) * 6;
    }

    const exits = validExitsFor(x, y, entry, visited);
    if (exits.length === 0) return -1000;

    let best = -Infinity;
    for (const exit of exits) {
      const next = stepFrom(x, y, exit);
      const nextKey = tileKey(next.x, next.y);
      visited.add(nextKey);

      const straightBonus = exit === OPPOSITE[entry] ? 14 : 8;
      const openness = freeNeighborCount(next.x, next.y, visited) * 7;
      const driftPenalty = Math.abs(next.x + next.y) * 0.08;
      const score = straightBonus + openness - driftPenalty + evaluateBranch(next.x, next.y, OPPOSITE[exit], depth - 1, visited);

      visited.delete(nextKey);
      if (score > best) best = score;
    }

    return best;
  }

  function getStraightRunLength() {
    let run = 0;
    for (let i = state.route.length - 1; i > 0; i--) {
      const tile = state.route[i];
      const prev = state.route[i - 1];
      if (!tile || !prev) break;
      if (tile.entry === 'CENTER') break;
      if (!sameAxis(tile.entry, tile.exit) || !sameAxis(prev.entry, prev.exit)) break;
      if (tile.exit !== prev.exit) break;
      run++;
    }
    return run;
  }

  function planNextTile() {
    const tail = state.route[state.route.length - 1];
    const position = stepFrom(tail.x, tail.y, tail.exit);
    const entry = OPPOSITE[tail.exit];
    const visited = new Set(state.tiles.keys());
    const straightRun = getStraightRunLength();
    let best = null;

    for (const exit of validExitsFor(position.x, position.y, entry, visited)) {
      const next = stepFrom(position.x, position.y, exit);
      const nextKey = tileKey(next.x, next.y);
      visited.add(nextKey);

      const isStraight = exit === OPPOSITE[entry];
      const base = isStraight ? 10 - straightRun * 6 : 24;
      const openness = freeNeighborCount(next.x, next.y, visited) * 8;
      const future = evaluateBranch(next.x, next.y, OPPOSITE[exit], SEARCH_DEPTH, visited);
      const variety = !isStraight ? 12 : -Math.max(0, straightRun - 1) * 10;
      const jitter = (Math.random() - 0.5) * 0.5;
      const score = base + openness + future + variety + jitter;

      visited.delete(nextKey);

      if (!best || score > best.score) {
        best = { x: position.x, y: position.y, entry, exit, score };
      }
    }

    return best;
  }

  function ensureLookahead() {
    while (state.route.length - state.headIndex < LOOKAHEAD_TILES) {
      const next = planNextTile();
      if (!next) {
        state.gameState = 'stalled';
        state.restartTimer = RESTART_DELAY;
        return;
      }
      appendRouteTile(next.x, next.y, next.entry, next.exit);
    }
  }

  function currentRouteTile() {
    while (
      state.headIndex < state.route.length - 1 &&
      state.flowDistance >= state.route[state.headIndex].endDistance &&
      state.route[state.headIndex + 1].type
    ) {
      state.headIndex++;
    }
    return state.route[state.headIndex];
  }

  function getHeadPoint() {
    const tile = currentRouteTile();
    if (!tile) return { x: 0, y: 0 };
    const local = tile.endDistance === tile.startDistance
      ? 1
      : (state.flowDistance - tile.startDistance) / (tile.endDistance - tile.startDistance);
    return pointAlongPolyline(tile.points, Math.max(0, Math.min(1, local)));
  }

  function getFlowDirection() {
    const tile = currentRouteTile();
    if (!tile) return { x: 1, y: 0 };

    const local = tile.endDistance === tile.startDistance
      ? 1
      : (state.flowDistance - tile.startDistance) / (tile.endDistance - tile.startDistance);
    const head = pointAlongPolyline(tile.points, Math.max(0, Math.min(1, local)));
    const ahead = pointAlongPolyline(tile.points, Math.min(1, local + 0.06));
    const dx = ahead.x - head.x;
    const dy = ahead.y - head.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  function getUpcomingUnplacedSlots(limit = LOOKAHEAD_TILES) {
    const slots = [];
    for (let i = state.headIndex + 1; i < state.route.length && slots.length < limit; i++) {
      if (!state.route[i].type) {
        slots.push({ index: i, tile: state.route[i] });
      }
    }
    return slots;
  }

  function findBestRackPlacement() {
    const rackType = state.rack[0];
    if (!rackType) return null;

    const slots = getUpcomingUnplacedSlots();
    let best = null;

    for (const { index, tile } of slots) {
      const distanceLeft = tile.startDistance - state.flowDistance;
      const urgency = -distanceLeft * 0.08;

      if (!canPieceServeTransition(rackType, tile.entry, tile.exit)) continue;

      const preferenceBonus = rackType === tile.preferredType ? 16 : 0;
      const varietyBonus = rackType.startsWith('tee-') || rackType === 'cross' ? 8 : 0;
      const latenessPenalty = index * 34;
      const score = 1200 - latenessPenalty + urgency + preferenceBonus + varietyBonus;

      if (!best || score > best.score) {
        best = { slotIndex: index, rackIndex: 0, score };
      }
    }

    return best;
  }

  function placeRackTileOnRoute(slotIndex, rackIndex) {
    const type = consumeRack(rackIndex);
    state.route[slotIndex].type = type;
  }

  function futureUseCount(type) {
    let count = 0;
    for (const { tile } of getUpcomingUnplacedSlots(10)) {
      if (canPieceServeTransition(type, tile.entry, tile.exit)) count++;
    }
    return count;
  }

  function extendRouteForFrontPiece(maxExtraTiles = 28) {
    const front = state.rack[0];
    if (!front || front === 'full') return;

    for (let i = 0; i < maxExtraTiles; i++) {
      if (findBestRackPlacement()) return;

      const next = planNextTile();
      if (!next) {
        state.gameState = 'stalled';
        state.restartTimer = RESTART_DELAY;
        return;
      }
      appendRouteTile(next.x, next.y, next.entry, next.exit);
    }
  }

  function findParkingSpot() {
    const head = currentRouteTile() || state.route[0];
    for (let attempt = 0; attempt < 240; attempt++) {
      const lane = state.parkCursor + attempt;
      const col = lane % 6;
      const row = Math.floor(lane / 6);
      const x = head.x + 8 + col * 2;
      const y = head.y - 10 - row * 2;
      if (!getTile(x, y)) {
        state.parkCursor = lane + 1;
        return { x, y };
      }
    }
    return null;
  }

  function parkRackTile(rackIndex) {
    const spot = findParkingSpot();
    if (!spot) return false;
    const type = consumeRack(rackIndex);
    setTile({ kind: 'parked', x: spot.x, y: spot.y, type });
    return true;
  }

  function maybePlaceFromRack(dt) {
    state.placeCooldown = Math.max(0, state.placeCooldown - dt);
    if (!state.autoplay || state.placeCooldown > 0 || state.gameState !== 'playing') return;

    extendRouteForFrontPiece();
    const candidate = findBestRackPlacement();
    if (candidate) {
      placeRackTileOnRoute(candidate.slotIndex, candidate.rackIndex);
      state.placeCooldown = PLACE_COOLDOWN;
      return;
    }

    if (parkRackTile(0)) {
      state.placeCooldown = PLACE_COOLDOWN * 0.9;
    }
  }

  function advanceFlow(dt) {
    let remaining = FLOW_SPEED * dt;
    while (remaining > 0.0001) {
      const tile = currentRouteTile();
      if (!tile) return;

      const nextTile = state.route[state.headIndex + 1] || null;
      const boundary = nextTile && !nextTile.type ? tile.endDistance : Infinity;
      const target = Math.min(state.flowDistance + remaining, boundary);
      const moved = target - state.flowDistance;
      if (moved <= 0) break;

      state.flowDistance = target;
      remaining -= moved;

      if (target === boundary && nextTile && !nextTile.type) {
        break;
      }
    }

    currentRouteTile();
  }

  function updateHud() {
    if (state.gameState === 'stalled') {
      statusText.textContent = 'Route trapped — rebuilding';
    } else {
      const rackText = state.rack.map((type) => type.toUpperCase()).join(' · ');
      statusText.textContent = `Ordered rack · play left-to-right · ${state.score} tiles survived · ${rackText}`;
    }
    modeText.textContent = state.autoplay ? 'RUNNING' : 'PAUSED';
  }

  function resetGame() {
    state.tiles = new Map();
    state.route = [];
    state.flowDistance = 0;
    state.headIndex = 0;
    state.gameState = 'playing';
    state.restartTimer = 0;
    state.score = 0;
    state.rack = [];
    state.placeCooldown = 0;
    state.parkCursor = 0;

    appendRouteTile(0, 0, 'CENTER', randomChoice(DIRS));
    refillRack();
    ensureLookahead();

    const head = getHeadPoint();
    state.camera.x = head.x;
    state.camera.y = head.y;
    overlayText.textContent = '';
    updateHud();
  }

  function drawFloor() {
    const headTile = currentRouteTile() || { x: 0, y: 0 };
    for (let y = headTile.y - FLOOR_RADIUS; y <= headTile.y + FLOOR_RADIUS; y++) {
      for (let x = headTile.x - FLOOR_RADIUS; x <= headTile.x + FLOOR_RADIUS; x++) {
        const pos = screenPositionForTile(x, y);
        if (pos.x < -60 || pos.x > canvas.width + 60 || pos.y < -60 || pos.y > canvas.height + 90) continue;
        ctx.fillStyle = '#13171e';
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y + 30, 26, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function visiblePlacedTiles() {
    return [...state.tiles.values()]
      .filter((tile) => tile.type)
      .filter((tile) => {
        const pos = screenPositionForTile(tile.x, tile.y);
        return pos.x > -120 && pos.x < canvas.width + 120 && pos.y > -120 && pos.y < canvas.height + 140;
      })
      .sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.x - b.x);
  }

  function drawImageScaled(img, x, y) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, x, y, TILE_W, TILE_H);
  }

  function drawTile(tile) {
    const img = images[tile.type];
    if (!img) return;
    const pos = screenPositionForTile(tile.x, tile.y);
    drawImageScaled(img, pos.x - HALF_W, pos.y - TILE_TOP);
  }

  function getNeighborType(x, y) {
    const tile = getTile(x, y);
    return tile && tile.type ? tile.type : null;
  }

  function drawPatches(tile) {
    const pos = screenPositionForTile(tile.x, tile.y);
    const conns = tileConnections(tile.type);

    const westType = getNeighborType(tile.x - 1, tile.y);
    if (westType) {
      const westConns = tileConnections(westType);
      drawImageScaled(images[conns.includes('W') || westConns.includes('E') ? 'patch-nw-open' : 'patch-nw'], pos.x - HALF_W, pos.y - TILE_TOP);
    }

    const northType = getNeighborType(tile.x, tile.y - 1);
    if (northType) {
      const northConns = tileConnections(northType);
      drawImageScaled(images[conns.includes('N') || northConns.includes('S') ? 'patch-ne-open' : 'patch-ne'], pos.x - HALF_W, pos.y - TILE_TOP);
    }
  }

  function getVisibleFlowPoints() {
    const points = [];
    for (const tile of state.route) {
      if (state.flowDistance <= tile.startDistance) break;
      const progress = Math.min(1, (state.flowDistance - tile.startDistance) / (tile.endDistance - tile.startDistance));
      const segment = progress >= 1 ? tile.points : partialPolyline(tile.points, progress);
      for (let i = 0; i < segment.length; i++) {
        if (points.length > 0 && i === 0) continue;
        points.push(segment[i]);
      }
      if (progress < 1) break;
    }
    return points;
  }

  function tracePolyline(points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
  }

  function drawFlow() {
    const worldPoints = getVisibleFlowPoints();
    if (worldPoints.length < 2) return;

    const points = worldPoints.map(toScreenPoint);
    const head = points[points.length - 1];
    const shimmer = 0.9 + 0.1 * Math.sin(performance.now() * 0.008);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = 'rgba(72, 40, 0, 0.35)';
    ctx.lineWidth = 12;
    tracePolyline(points);
    ctx.stroke();

    ctx.strokeStyle = `rgba(222, 150, 18, ${0.96 * shimmer})`;
    ctx.lineWidth = 8;
    tracePolyline(points);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 235, 156, 0.9)';
    ctx.lineWidth = 3.6;
    tracePolyline(points);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.26)';
    ctx.lineWidth = 1.4;
    tracePolyline(points);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 245, 188, 0.96)';
    ctx.beginPath();
    ctx.ellipse(head.x, head.y, 4.8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 199, 74, 0.76)';
    ctx.beginPath();
    ctx.ellipse(head.x - 1.2, head.y + 0.5, 3.1, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function roundRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  function drawRack() {
    const cardWidth = 112;
    const cardHeight = 76;
    const gap = 14;
    const totalWidth = cardWidth * state.rack.length + gap * (state.rack.length - 1);
    const startX = canvas.width * 0.5 - totalWidth * 0.5;
    const topY = 28;

    ctx.save();
    ctx.font = 'bold 22px Segoe UI';
    ctx.fillStyle = '#eef4ff';
    ctx.fillText('RACK', startX - 84, topY + 46);
    ctx.restore();

    state.rack.forEach((type, index) => {
      const x = startX + index * (cardWidth + gap);
      const y = topY;
      const isNext = index === 0;
      ctx.fillStyle = isNext ? 'rgba(246, 194, 71, 0.16)' : 'rgba(255, 255, 255, 0.1)';
      ctx.strokeStyle = isNext ? 'rgba(246, 194, 71, 0.92)' : 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = isNext ? 2 : 1;
      roundRect(x, y, cardWidth, cardHeight, 18);
      ctx.fill();
      ctx.stroke();

      const img = images[type];
      if (img) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, x + 17, y + 8, TILE_W, TILE_H);
      }

      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = '12px Segoe UI';
      ctx.fillText(type.toUpperCase(), x + 12, y + cardHeight - 12);
      ctx.fillText(isNext ? 'NEXT' : `#${index + 1}`, x + cardWidth - (isNext ? 38 : 28), y + 18);
    });
  }

  function render() {
    ctx.fillStyle = '#05080d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawFloor();

    const tiles = visiblePlacedTiles();
    for (const tile of tiles) drawTile(tile);
    for (const tile of tiles) drawPatches(tile);
    drawFlow();
    drawRack();

    overlayText.textContent = state.gameState === 'stalled' ? 'REBUILDING' : '';
  }

  function updateCamera(dt) {
    const head = getHeadPoint();
    const dir = getFlowDirection();
    const targetX = head.x + dir.x * CAMERA_LOOK_AHEAD;
    const targetY = head.y + dir.y * CAMERA_LOOK_AHEAD * 0.45;
    const t = 1 - Math.exp(-CAMERA_LERP * dt);
    state.camera.x += (targetX - state.camera.x) * t;
    state.camera.y += (targetY - state.camera.y) * t;
  }

  function update(dt) {
    if (state.gameState === 'stalled') {
      state.restartTimer -= dt;
      if (state.restartTimer <= 0) resetGame();
      return;
    }

    if (state.autoplay) {
      ensureLookahead();
      maybePlaceFromRack(dt);
      advanceFlow(dt);
      state.score = Math.max(state.score, state.headIndex + 1);
      updateHud();
    }

    updateCamera(dt);
  }

  function frame(time) {
    const dt = Math.min(0.05, (time - state.lastTime) / 1000 || 0);
    state.lastTime = time;
    if (state.gameState !== 'loading') update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function onKeyDown(event) {
    if (event.key === 'a' || event.key === 'A') {
      state.autoplay = !state.autoplay;
      updateHud();
    }
    if (event.key === 'r' || event.key === 'R') {
      resetGame();
    }
  }

  window.addEventListener('keydown', onKeyDown);

  preload()
    .then(() => {
      resetGame();
      requestAnimationFrame(frame);
    })
    .catch((error) => {
      console.error(error);
      statusText.textContent = 'Failed to load pipe sprites';
      modeText.textContent = 'ERROR';
      overlayText.textContent = 'ASSET ERROR';
      state.gameState = 'error';
      render();
    });
})();
