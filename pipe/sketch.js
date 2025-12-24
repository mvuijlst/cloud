
let tileImages = {};
let tileTypes = {
  'cross': { connections: ['N', 'E', 'S', 'W'], img: 'cross.png' },
  'elbow-ne': { connections: ['N', 'E'], img: 'elbow-ne.png' },
  'elbow-nw': { connections: ['N', 'W'], img: 'elbow-nw.png' },
  'elbow-se': { connections: ['S', 'E'], img: 'elbow-se.png' },
  'elbow-sw': { connections: ['S', 'W'], img: 'elbow-sw.png' },
  'ew': { connections: ['E', 'W'], img: 'ew.png' },
  'full': { connections: [], img: 'full.png' },
  'ns': { connections: ['N', 'S'], img: 'ns.png' },
  'start-e': { connections: ['E'], img: 'start-e.png' },
  'start-n': { connections: ['N'], img: 'start-n.png' },
  'start-s': { connections: ['S'], img: 'start-s.png' },
  'start-w': { connections: ['W'], img: 'start-w.png' }
};

let playableTiles = [
  'cross', 'elbow-ne', 'elbow-nw', 'elbow-se', 'elbow-sw', 
  'ew', 'ns', 'full'
];

let grid = [];
let GRID_SIZE = 20;
let TILE_W = 38;
let TILE_H = 29;
let ORIGIN_X;
let ORIGIN_Y;

let hand = [];
let startTile = null;
let endTile = null;
let gameState = 'PLAYING'; // PLAYING, WON, GAMEOVER
let lastGridX = -1;
let lastGridY = -1;
let flowSpeed = 0.02; // Speed of liquid filling per frame
let lastRedraw = 0;
let simTimer = null;
let SIM_INTERVAL_MS = 50; // 20fps simulation tick (efficient)

let patchNW, patchNE;
let hasPatchNW = false;
let hasPatchNE = false;
let patchNWOpen, patchNEOpen;
let hasPatchNWOpen = false;
let hasPatchNEOpen = false;

let liquidImages = {};
let genericLiquidImages = {};
let staticLayer; // Replaces bgLayer, holds all static content
let activeTiles = new Set(); // Optimization: Only update tiles that are flowing

function preload() {
  for (let k in tileTypes) {
    tileImages[k] = loadImage('images/' + tileTypes[k].img);
    
    // Prepare storage for specific liquid images
    liquidImages[k] = {};

    // Load per-tile liquid images (fallback to generic when missing)
    let dirsToLoad = ['CENTER', ...tileTypes[k].connections];
    dirsToLoad.forEach(dir => {
      let fileSuffix = dir.toLowerCase();
      liquidImages[k][dir] = loadImage(
        `images/liquid-${k}-${fileSuffix}.png`,
        () => {
          if (liquidImages[k][dir]) liquidImages[k][dir].ready = true;
        },
        () => {
          liquidImages[k][dir] = null;
        }
      );
      if (liquidImages[k][dir]) liquidImages[k][dir].ready = false;
    });
  }
  
  patchNW = loadImage('images/patch-nw.png');
  patchNE = loadImage('images/patch-ne.png');
  patchNWOpen = loadImage('images/patch-nw-open.png');
  patchNEOpen = loadImage('images/patch-ne-open.png');
  
  // Load generic liquid images as fallback
  function loadGeneric(key, path) {
    genericLiquidImages[key] = loadImage(
      path,
      () => { if (genericLiquidImages[key]) genericLiquidImages[key].ready = true; },
      () => { genericLiquidImages[key] = null; }
    );
    if (genericLiquidImages[key]) genericLiquidImages[key].ready = false;
  }

  loadGeneric('CENTER', 'images/liquid-center.png');
  loadGeneric('N', 'images/liquid-n.png');
  loadGeneric('E', 'images/liquid-e.png');
  loadGeneric('S', 'images/liquid-s.png');
  loadGeneric('W', 'images/liquid-w.png');
}

function isCardinalDir(d) {
  return d === 'N' || d === 'E' || d === 'S' || d === 'W';
}

function isRightHalfDir(d) {
  return d === 'N' || d === 'E';
}

function getTileSpecificLiquidImage(tileType, dir) {
  let img = liquidImages[tileType] ? liquidImages[tileType][dir] : null;
  if (img && img.ready) return img;
  return null;
}

function getAnyTileSpecificLiquidImage(tileType) {
  let bucket = liquidImages[tileType];
  if (!bucket) return null;
  for (let k in bucket) {
    let img = bucket[k];
    if (img && img.ready) return img;
  }
  return null;
}

function resolveLiquidImage(tileType, dir, preferDirs) {
  // preferDirs: optional ordered list (used mainly for CENTER lookups)
  if (dir === 'CENTER') {
    // Center: try tile-specific center, then any preferred (e.g. explicit center), then generic center.
    let img = getTileSpecificLiquidImage(tileType, 'CENTER');
    if (img) return img;
    if (Array.isArray(preferDirs)) {
      for (let d of preferDirs) {
        if (!d) continue;
        let alt = getTileSpecificLiquidImage(tileType, d);
        if (alt) return alt;
      }
    }
    let g = genericLiquidImages['CENTER'];
    if (g && (g.ready === undefined || g.ready)) return g;
    return null;
  }

  // Arms: only exact dir, then generic dir. Avoid using center sprites for arms to prevent misoriented elbows.
  let exact = getTileSpecificLiquidImage(tileType, dir);
  if (exact) return exact;

  let g = genericLiquidImages[dir];
  if (g && (g.ready === undefined || g.ready)) return g;

  return null;
}

// Optimized image drawing helper
function fastImage(targetCtx, img, x, y, w, h, sx, sy, sw, sh) {
  if (!img) return;
  
  // Handle p5.Graphics or p5.Image
  let source = img.canvas ? img.canvas : (img.elt ? img.elt : img);
  
  try {
    if (sx !== undefined) {
      targetCtx.drawImage(source, sx, sy, sw, sh, x, y, w, h);
    } else {
      targetCtx.drawImage(source, x, y);
    }
  } catch (e) {
    // console.error("Draw error", e);
  }
}

function resetCtx(ctx) {
  // When mixing p5 drawing with direct Canvas API calls,
  // ensure we draw in a predictable state.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function setup() {
  p5.disableFriendlyErrors = true;
  createCanvas(800, 600);
  pixelDensity(1);
  frameRate(30);
  noSmooth();
  ORIGIN_X = width / 2;
  ORIGIN_Y = 120;

  // Initialize grid FIRST (Fixes crash in redrawAllStatic)
  for (let y = 0; y < GRID_SIZE; y++) {
    let gridRow = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      gridRow.push(null);
    }
    grid.push(gridRow);
  }

  if (window.IS_TEST_MODE) {
    setupTestGrid();
    // noLoop(); // Allow liquid to flow in test mode too if desired
  } else {
    placeStartAndEnd();
    fillHand();
  }
  
  scanActiveTiles();

  // Render-on-demand only
  noLoop();
  redraw();

  // Start simulation ticking only when liquid is active
  if (!window.IS_TEST_MODE && activeTiles.size > 0) {
    startSimLoop();
  }
}

function startSimLoop() {
  if (simTimer !== null) return;
  simTick();
}

function stopSimLoop() {
  if (simTimer === null) return;
  clearTimeout(simTimer);
  simTimer = null;
}

function simTick() {
  simTimer = null;

  if (gameState === 'PLAYING' && !window.IS_TEST_MODE && activeTiles.size > 0) {
    updateLiquid();
    redraw();
  }

  if (!window.IS_TEST_MODE && activeTiles.size > 0 && gameState === 'PLAYING') {
    simTimer = setTimeout(simTick, SIM_INTERVAL_MS);
  } else {
    stopSimLoop();
  }
}

function scanActiveTiles() {
  activeTiles.clear();
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      let tile = grid[y][x];
      if (tile) {
        let isActive = false;
        if (tile.liquid > 0 && tile.liquid < 1) isActive = true;
        if (tile.liquid >= 0.66 && !tile.flowOut && !tile.isEnd) isActive = true;
        
        if (tile.secondaryLiquids) {
          if (tile.secondaryLiquids.some(sl => (sl.liquid > 0 && sl.liquid < 1) || (sl.liquid >= 0.66 && !sl.flowOut))) {
            isActive = true;
          }
        }
        
        if (isActive) {
          activeTiles.add(`${x},${y}`);
        }
      }
    }
  }
}

function setupTestGrid() {
  let x = 1;
  let y = 1;
  
  // Helper to place a tile and advance cursor
  function place(tileData) {
    if (x >= GRID_SIZE - 1) {
      x = 1;
      y += 2;
    }
    if (y >= GRID_SIZE - 1) return;
    
    grid[y][x] = tileData;
    x += 2;
  }

  // Define valid flow pairs for each tile type based on "Straight Flow" rule
  // Cross and Tees only allow straight passage. Elbows allow turns.
  let validFlows = {
    'cross': [['N', 'S'], ['E', 'W']],
    'elbow-ne': [['N', 'E']],
    'elbow-nw': [['N', 'W']],
    'elbow-se': [['S', 'E']],
    'elbow-sw': [['S', 'W']],
    'ew': [['E', 'W']],
    'ns': [['N', 'S']]
  };

  let types = Object.keys(validFlows);
  
  for (let type of types) {
    let pairs = validFlows[type];
    
    for (let pair of pairs) {
      let p1 = pair[0];
      let p2 = pair[1];
      
      // Flow Direction 1: p1 -> p2
      // Entering (0.33)
      place({ type: type, fixed: true, liquid: 0.33, liquidSource: p1, flowOut: null });
      // Center (0.66)
      place({ type: type, fixed: true, liquid: 0.66, liquidSource: p1, flowOut: null });
      // Leaving (1.00)
      place({ type: type, fixed: true, liquid: 1.00, liquidSource: p1, flowOut: p2 });

      // Flow Direction 2: p2 -> p1
      // Entering (0.33)
      place({ type: type, fixed: true, liquid: 0.33, liquidSource: p2, flowOut: null });
      // Center (0.66)
      place({ type: type, fixed: true, liquid: 0.66, liquidSource: p2, flowOut: null });
      // Leaving (1.00)
      place({ type: type, fixed: true, liquid: 1.00, liquidSource: p2, flowOut: p1 });
    }
    
    // Gap between types
    x = 1;
    y += 2;
  }
  
  // Special Case: Cross Crossing Flows
  // Existing N->S + E Entering
  let nsFlow = { liquid: 1.0, liquidSource: 'N', flowOut: 'S' };
  place({ type: 'cross', fixed: true, ...nsFlow, secondaryLiquids: [{ liquid: 0.33, liquidSource: 'E', flowOut: null }] });
  // Existing N->S + E Leaving (Straight E->W)
  place({ type: 'cross', fixed: true, ...nsFlow, secondaryLiquids: [{ liquid: 1.0, liquidSource: 'E', flowOut: 'W' }] });

  // Existing N->S + W Entering
  place({ type: 'cross', fixed: true, ...nsFlow, secondaryLiquids: [{ liquid: 0.33, liquidSource: 'W', flowOut: null }] });
  // Existing N->S + W Leaving (Straight W->E)
  place({ type: 'cross', fixed: true, ...nsFlow, secondaryLiquids: [{ liquid: 1.0, liquidSource: 'W', flowOut: 'E' }] });

  let ewFlow = { liquid: 1.0, liquidSource: 'E', flowOut: 'W' };

  // Existing E->W + N Entering
  place({ type: 'cross', fixed: true, ...ewFlow, secondaryLiquids: [{ liquid: 0.33, liquidSource: 'N', flowOut: null }] });
  // Existing E->W + N Leaving (Straight N->S)
  place({ type: 'cross', fixed: true, ...ewFlow, secondaryLiquids: [{ liquid: 1.0, liquidSource: 'N', flowOut: 'S' }] });

  // Existing E->W + S Entering
  place({ type: 'cross', fixed: true, ...ewFlow, secondaryLiquids: [{ liquid: 0.33, liquidSource: 'S', flowOut: null }] });
  // Existing E->W + S Leaving (Straight S->N)
  place({ type: 'cross', fixed: true, ...ewFlow, secondaryLiquids: [{ liquid: 1.0, liquidSource: 'S', flowOut: 'N' }] });
}

function draw() {
  let mGrid = null;
  if (gameState === 'PLAYING') {
    mGrid = screenToGrid(mouseX, mouseY);
  }

  // Draw Grid
  drawGrid(mGrid);

  // Draw Hand
  drawHand();
  
  if (gameState === 'WON') {
    fill(255);
    textSize(32);
    textAlign(CENTER, CENTER);
    text("CONNECTED!", width/2, height - 50);
  }

  if (window.IS_TEST_MODE && mGrid && isValidGrid(mGrid.x, mGrid.y)) {
    drawTileInfo(mGrid);
  }

}

function drawTileInfo(mGrid) {
  let tile = grid[mGrid.y][mGrid.x];
  if (!tile) return;

  fill(0, 0, 0, 220);
  noStroke();
  rect(mouseX + 15, mouseY + 15, 220, 160);

  fill(255);
  textSize(12);
  textAlign(LEFT, TOP);
  let info = `Type: ${tile.type}\n`;
  info += `Liquid: ${tile.liquid.toFixed(2)}\n`;
  info += `Source: ${tile.liquidSource}\n`;
  info += `FlowOut: ${tile.flowOut}\n`;
  
  if (tile.secondaryLiquids) {
    info += `\nSecondary:\n`;
    tile.secondaryLiquids.forEach((sl, i) => {
      info += `${i+1}. L:${sl.liquid.toFixed(2)} S:${sl.liquidSource} O:${sl.flowOut}\n`;
    });
  }

  text(info, mouseX + 20, mouseY + 20);
}

function placeStartAndEnd() {
  // Place start and end tiles ensuring they point into the grid
  
  function getRandomPos() {
    return {
      x: floor(random(1, GRID_SIZE - 1)),
      y: floor(random(1, GRID_SIZE - 1))
    };
  }

  function getValidStartType(x, y) {
    let validTypes = [];
    if (y > 0) validTypes.push('start-n'); // Can point North
    if (x < GRID_SIZE - 1) validTypes.push('start-e'); // Can point East
    if (y < GRID_SIZE - 1) validTypes.push('start-s'); // Can point South
    if (x > 0) validTypes.push('start-w'); // Can point West
    return random(validTypes);
  }

  let startPos = getRandomPos();
  let endPos;
  do {
    endPos = getRandomPos();
  } while (dist(startPos.x, startPos.y, endPos.x, endPos.y) < 4);

  let startType = getValidStartType(startPos.x, startPos.y);
  let endType = getValidStartType(endPos.x, endPos.y);

  grid[startPos.y][startPos.x] = { type: startType, fixed: true, liquid: 0.66, liquidSource: 'CENTER' }; // Start full at center
  grid[endPos.y][endPos.x] = { type: endType, fixed: true, isEnd: true, liquid: 0, liquidSource: null };
  
  startTile = { x: startPos.x, y: startPos.y };
  endTile = { x: endPos.x, y: endPos.y };
}

function fillHand() {
  while (hand.length < 3) {
    let r = random(playableTiles);
    hand.unshift(r); // Add to top, we take from bottom
  }
}

function redrawAllStatic() {
  staticLayer.background(20);
  staticLayer.noStroke();
  staticLayer.fill(30);
  
  let ctx = staticLayer.drawingContext;
  resetCtx(ctx);
  
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      redrawTileOnLayer(x, y, ctx);
    }
  }
}

function redrawTileOnLayer(x, y, ctx) {
  if (!isValidGrid(x, y)) return;
  
  let screenPos = gridToScreen(x, y);
  
  // 1. Draw Grid Dot (clears previous tile visually if we assume opaque tiles cover it, but they don't fully)
  // Since we can't easily "clear" a specific tile area in a single layer without clearing the background,
  // we rely on the fact that we are redrawing the whole layer or just adding to it.
  // If we are updating a specific tile, we might need to redraw the background dot first.
  // But wait, if we are RE-drawing a tile, we are drawing ON TOP of the old one.
  // If the new tile is "empty" (null), we need to clear the old one.
  // This is tricky with a single layer.
  // Ideally, we clear the rect. But isometric tiles overlap.
  // For now, let's assume we only ADD tiles or redraw the whole grid on major changes?
  // No, "placeTile" happens often.
  // If we remove a tile, we might need to redraw the whole static layer?
  // Or just redraw the affected area (3x3 grid around it) to be safe?
  // Let's try redrawing the dot first.
  
  // Actually, to properly "clear" a tile in isometric view, we need to redraw the background for that area.
  // But since we have a solid background color (20), we can just draw a "clear" polygon?
  // No, that would erase neighbors.
  // The safest way to update the static layer when a tile changes is to redraw the whole layer?
  // 400 tiles is fast if we do it once per click.
  // Let's try that first. It's much safer than complex dirty rect logic.
  
  // Wait, the user said "Only two tiles ever change".
  // If I redraw 400 tiles on every click, that's fine.
  // But for LIQUID updates (baking), we need to be efficient.
  // Baking liquid adds on top. So we don't need to clear.
  
  // So:
  // 1. Place Tile -> Redraw ALL Static (safe, fast enough for click events).
  // 2. Bake Liquid -> Draw Liquid ON TOP of specific tile (fast, no clear needed).
  
  // Logic for drawing a single tile (used by redrawAllStatic and bakeLiquid)
  
  // Draw Dot
  ctx.fillStyle = '#1e1e1e'; // 30
  ctx.beginPath();
  ctx.ellipse(screenPos.x, screenPos.y + 15, 15, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();

  let tile = grid[y][x];
  if (tile) {
    let img = tileImages[tile.type];
    if (img) fastImage(ctx, img, screenPos.x - 19, screenPos.y - 20);
    
    // Draw Patches (we need to pass the context to drawPatches or reimplement it)
    drawPatchesStatic(x, y, screenPos, ctx, tile.type);
    
    // Draw Static Liquid (if not active)
    // If tile is in activeTiles, we skip drawing liquid here (it's drawn in draw())
    // UNLESS we are baking it?
    // If we are calling this from redrawAllStatic, we should draw liquid if it is NOT active.
    // If it IS active, we skip it here.
    
    let isActive = activeTiles.has(`${x},${y}`);
    if (!isActive && (tile.liquid > 0 || (tile.secondaryLiquids && tile.secondaryLiquids.length > 0))) {
       drawLiquidStatic(x, y, screenPos, ctx, tile);
    }
  }
}

function drawPatchesStatic(x, y, screenPos, ctx, currentType) {
  let conns = tileTypes[currentType].connections;

  // Check West Neighbor (x - 1)
  let westNeighbor = getNeighborType(x - 1, y);
  if (westNeighbor) {
    let neighborConns = tileTypes[westNeighbor].connections;
    if (conns.includes('W') || neighborConns.includes('E')) {
      if (patchNWOpen) fastImage(ctx, patchNWOpen, screenPos.x - 19, screenPos.y - 20);
    } else {
      if (patchNW) fastImage(ctx, patchNW, screenPos.x - 19, screenPos.y - 20);
    }
  }

  // Check North Neighbor (y - 1)
  let northNeighbor = getNeighborType(x, y - 1);
  if (northNeighbor) {
    let neighborConns = tileTypes[northNeighbor].connections;
    if (conns.includes('N') || neighborConns.includes('S')) {
      if (patchNEOpen) fastImage(ctx, patchNEOpen, screenPos.x - 19, screenPos.y - 20);
    } else {
      if (patchNE) fastImage(ctx, patchNE, screenPos.x - 19, screenPos.y - 20);
    }
  }
}

function drawLiquidStatic(x, y, screenPos, ctx, tile) {
  // Similar to drawLiquid but uses ctx
  drawLiquidFlowStatic(screenPos, ctx, tile.type, tile.liquid, tile.liquidSource, tile.flowOut, tile.previewFlowOut);

  if (tile.secondaryLiquids) {
    for (let flow of tile.secondaryLiquids) {
      drawLiquidFlowStatic(screenPos, ctx, tile.type, flow.liquid, flow.liquidSource, flow.flowOut, flow.previewFlowOut);
    }
  }
}

function drawLiquidFlowStatic(screenPos, ctx, type, level, source, flowOut, previewFlowOut) {
  // 1. Incoming
  if (source && source !== 'CENTER') {
    let progress = constrain(map(level, 0, 0.33, 0, 1), 0, 1);
    drawLiquidImageStatic(screenPos, ctx, source, progress, true, type);
  }
  // 2. Center
  if (level > 0.33) {
    let centerProgress = constrain(map(level, 0.33, 0.66, 0, 1), 0, 1);
    let centerInDir = (source && source !== 'CENTER') ? source : null;
    let centerOutDir = flowOut || previewFlowOut || null;
    drawLiquidImageStatic(screenPos, ctx, 'CENTER', centerProgress, false, type, centerInDir, centerOutDir);
  }
  // 3. Outgoing
  if (level > 0.66 || source === 'CENTER') {
    let progress = constrain(map(level, 0.66, 1, 0, 1), 0, 1);
    if (source === 'CENTER') progress = constrain(map(level, 0.66, 1, 0, 1), 0, 1);
    if (flowOut) {
      drawLiquidImageStatic(screenPos, ctx, flowOut, progress, false, type);
    }
  }
}

function drawLiquidImageStatic(screenPos, ctx, dir, progress, isIncoming, tileType, centerInDir, centerOutDir) {
  let img = resolveLiquidImage(tileType, dir, dir === 'CENTER' ? ['CENTER', centerInDir, centerOutDir] : undefined);
  if (!img) return;
  
  if (dir === 'CENTER') {
      let p = constrain(progress, 0, 1);
      if (p <= 0) return;

      let baseX = screenPos.x - 19;
      let baseY = screenPos.y - 20;

      const cx = 19;
      const armLength = 19;
      const hasIn = isCardinalDir(centerInDir);
      const hasOut = isCardinalDir(centerOutDir);
      const inRight = hasIn && isRightHalfDir(centerInDir);
      const outRight = hasOut && isRightHalfDir(centerOutDir);

      if (hasIn && !hasOut) {
        // No out direction yet: keep motion going by wiping the incoming half toward the hub.
        let sw = Math.max(1, Math.floor(armLength * p));
        if (inRight) {
          // Incoming right half: reveal from edge (38) inward to hub (19)
          let sx = (cx + armLength) - sw; // 38 - sw
          fastImage(ctx, img, baseX + sx, baseY, sw, img.height, sx, 0, sw, img.height);
        } else {
          // Incoming left half: reveal from edge (0) inward toward hub (19)
          let sx = 0;
          fastImage(ctx, img, baseX + sx, baseY, sw, img.height, sx, 0, sw, img.height);
        }
        return;
      }

      if (hasIn && hasOut && inRight != outRight) {
        // Two halves worth of pixels: animate incoming half (edge->hub) then outgoing (hub->edge)
        let pIn = Math.min(1, p * 2);
        let pOut = Math.max(0, (p - 0.5) * 2);

        // Incoming half wipe
        let swIn = Math.max(1, Math.floor(armLength * pIn));
        if (inRight) {
          let sxIn = (cx + armLength) - swIn;
          fastImage(ctx, img, baseX + sxIn, baseY, swIn, img.height, sxIn, 0, swIn, img.height);
        } else {
          let sxIn = 0;
          fastImage(ctx, img, baseX + sxIn, baseY, swIn, img.height, sxIn, 0, swIn, img.height);
        }

        // Outgoing half wipe
        if (pOut > 0) {
          let swOut = Math.max(1, Math.floor(armLength * pOut));
          let sxOut = outRight ? cx : (cx - swOut);
          fastImage(ctx, img, baseX + sxOut, baseY, swOut, img.height, sxOut, 0, swOut, img.height);
        }
      } else if (hasOut) {
        // Single half worth of pixels: wipe outgoing from hub.
        let sw = Math.max(1, Math.floor(armLength * p));
        let sx = outRight ? cx : (cx - sw);
        fastImage(ctx, img, baseX + sx, baseY, sw, img.height, sx, 0, sw, img.height);
      } else {
        fastImage(ctx, img, baseX, baseY);
      }
      return;
  }

  let cx = 19;
  let armLength = 19;
  let sx, sw;
  let sy = 0;
  let sh = img.height;
  
  let isRight = (dir === 'N' || dir === 'E');
  
  if (isRight) {
    if (isIncoming) {
      sw = armLength * progress;
      sx = (cx + armLength) - sw;
    } else {
      sx = cx;
      sw = armLength * progress;
    }
  } else {
    if (isIncoming) {
      sx = 0;
      sw = armLength * progress;
    } else {
      sw = armLength * progress;
      sx = cx - sw;
    }
  }
  
  if (sw <= 0) return;
  
  let dx = (screenPos.x - 19) + sx;
  let dy = (screenPos.y - 20) + sy;
  
  fastImage(ctx, img, dx, dy, sw, sh, sx, sy, sw, sh);
}

function drawGrid(mGrid) {
  // Correct isometric draw order: increasing (x+y)
  // screenY = ORIGIN_Y + 9*(x+y) so diagonals are depth layers.
  let ctx = drawingContext;
  resetCtx(ctx);

  // Clear
  ctx.fillStyle = '#141414';
  ctx.fillRect(0, 0, width, height);

  let maxSum = (GRID_SIZE - 1) * 2;
  for (let sum = 0; sum <= maxSum; sum++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      let y = sum - x;
      if (y < 0 || y >= GRID_SIZE) continue;

      let screenPos = gridToScreen(x, y);

      // Grid dot
      ctx.fillStyle = '#1e1e1e';
      ctx.beginPath();
      ctx.ellipse(screenPos.x, screenPos.y + 15, 15, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();

      let tile = grid[y][x];

      // Ghost tile (preview) is drawn at the correct depth among real tiles
      let isGhost = false;
      let type = null;
      if (tile) {
        type = tile.type;
      } else if (mGrid && hand.length > 0 && x === mGrid.x && y === mGrid.y && isValidGrid(x, y)) {
        isGhost = true;
        type = hand[hand.length - 1];
      }

      if (!type) continue;

      let img = tileImages[type];
      if (img) fastImage(ctx, img, screenPos.x - 19, screenPos.y - 20);

      drawPatches(x, y, screenPos, mGrid, type);

      if (!isGhost && tile && (tile.liquid > 0 || (tile.secondaryLiquids && tile.secondaryLiquids.length > 0))) {
        drawLiquid(x, y, screenPos, tile);
      }
    }
  }
}

function drawPatches(x, y, screenPos, mGrid, currentType) {
  let ctx = drawingContext;
  resetCtx(ctx);
  let conns = tileTypes[currentType].connections;

  // Check West Neighbor (x - 1)
  let westNeighbor = getNeighborType(x - 1, y, mGrid);
  if (westNeighbor) {
    let neighborConns = tileTypes[westNeighbor].connections;
    // Use Open Patch if I have a connection OR my neighbor has a connection (mismatch)
    if (conns.includes('W') || neighborConns.includes('E')) {
      if (patchNWOpen) fastImage(ctx, patchNWOpen, screenPos.x - 19, screenPos.y - 20);
    } else {
      if (patchNW) fastImage(ctx, patchNW, screenPos.x - 19, screenPos.y - 20);
    }
  }

  // Check North Neighbor (y - 1)
  let northNeighbor = getNeighborType(x, y - 1, mGrid);
  if (northNeighbor) {
    let neighborConns = tileTypes[northNeighbor].connections;
    // Use Open Patch if I have a connection OR my neighbor has a connection (mismatch)
    if (conns.includes('N') || neighborConns.includes('S')) {
      if (patchNEOpen) fastImage(ctx, patchNEOpen, screenPos.x - 19, screenPos.y - 20);
    } else {
      if (patchNE) fastImage(ctx, patchNE, screenPos.x - 19, screenPos.y - 20);
    }
  }
}

function getNeighborType(x, y, mGrid) {
  if (!isValidGrid(x, y)) return null;
  if (grid[y][x] !== null) return grid[y][x].type;
  if (mGrid && x === mGrid.x && y === mGrid.y) {
    // The ghost tile is here
    if (hand.length > 0) {
      return hand[hand.length - 1];
    }
  }
  return null;
}

function isOccupied(x, y, mGrid) {
  if (!isValidGrid(x, y)) return false;
  if (grid[y][x] !== null) return true;
  if (mGrid && x === mGrid.x && y === mGrid.y) return true;
  return false;
}

function drawHand() {
  // Draw the 3 tiles in hand at the top
  let startX = width / 2 - 60; // Center the 3 tiles (approx 40px each)
  let startY = 30;
  
  fill(200);
  noStroke();
  rect(width / 2 - 80, 10, 160, 60, 10);
  
  for (let i = 0; i < hand.length; i++) {
    let type = hand[i];
    let img = tileImages[type];
    let x = startX + i * 45;
    
    // The last one (index 2) is the active one (rightmost)
    if (i === hand.length - 1) {
      // Highlight the active one
      stroke(255, 255, 0);
      strokeWeight(2);
      noFill();
      rect(x - 20, startY - 15, 40, 40);
    }
    
    if (img) {
      fastImage(drawingContext, img, x - 18, startY - 10);
    }
  }
  
  // Label
  fill(255);
  noStroke();
  textAlign(CENTER);
  textSize(12);
  text("NEXT", width / 2 - 90, 45);
}



function mousePressed() {
  if (gameState !== 'PLAYING') return;

  let mGrid = screenToGrid(mouseX, mouseY);
  
  if (isValidGrid(mGrid.x, mGrid.y)) {
    // Check if empty
    if (grid[mGrid.y][mGrid.x] === null) {
      let type = hand.pop();
      grid[mGrid.y][mGrid.x] = { type: type, fixed: false, liquid: 0, liquidSource: null };
      
      fillHand();

      // If liquid is active, resume animation so it can propagate into the new tile
      scanActiveTiles();
      if (!window.IS_TEST_MODE && activeTiles.size > 0) {
        startSimLoop();
      }

      // Ensure placement is visible even when idle
      redraw();
    }
  }
}

function mouseMoved() {
  let now = millis();

  // When not looping (idle), redraw occasionally to update the ghost tile
  if (!isLooping()) {
    if (now - lastRedraw > 50) {
      redraw();
      lastRedraw = now;
    }
    return;
  }

  // In test mode, cap redraws even while looping
  if (window.IS_TEST_MODE) {
    if (now - lastRedraw > 50) {
      redraw();
      lastRedraw = now;
    }
  }
}

function isValidGrid(x, y) {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}

function gridToScreen(x, y) {
  // East (+x): +18, +9
  // South (+y): -18, +9
  let sx = ORIGIN_X + x * 18 - y * 18;
  let sy = ORIGIN_Y + x * 9 + y * 9;
  return { x: sx, y: sy };
}

function screenToGrid(sx, sy) {
  // Derived from:
  // dx = 18(x - y)
  // dy = 9(x + y)
  // => x = (2dy + dx) / 36
  // => y = (2dy - dx) / 36
  
  let dx = sx - ORIGIN_X;
  let dy = sy - ORIGIN_Y;
  
  let x = Math.round((2 * dy + dx) / 36);
  let y = Math.round((2 * dy - dx) / 36);
  
  return { x: x, y: y };
}

function updateLiquid() {
  // Optimization: Iterate only over active tiles
  let changes = []; // Store changes to apply after iteration
  let finishedTiles = [];

  for (let key of activeTiles) {
    let [x, y] = key.split(',').map(Number);
    let tile = grid[y][x];
    
    if (!tile) {
      finishedTiles.push(key);
      continue;
    }

    let isStillActive = false;

    // Update Primary Liquid
    if (tile.liquid > 0 && tile.liquid < 1) {
      isStillActive = true;

      // While filling the hub (0.33..0.66), compute a preview out direction for smoother animation.
      // This does NOT propagate; it only affects rendering.
      if (!tile.isEnd && !tile.flowOut && tile.liquid >= 0.33 && tile.liquid < 0.66) {
        tile.previewFlowOut = computeFlowOutPreview(x, y, tile);
      }

      // If we are at the "flow out" phase (0.66) but haven't chosen a direction yet,
      // pause filling. Unless it's an end tile (which just fills up).
      if (tile.liquid >= 0.66 && !tile.flowOut && !tile.isEnd) {
         // Do not increment. Wait for propagateLiquid to find a path.
      } else {
        // Pixel-based timing: center sometimes needs 38px (two halves) vs 19px (one half).
        // Slow down the center phase proportionally so pixels-per-tick stays consistent.
        let delta = flowSpeed;
        if (tile.liquid >= 0.33 && tile.liquid < 0.66) {
          let inDir = (tile.liquidSource && tile.liquidSource !== 'CENTER') ? tile.liquidSource : null;
          let outDir = tile.flowOut || tile.previewFlowOut || null;
          if (isCardinalDir(inDir) && isCardinalDir(outDir) && (isRightHalfDir(inDir) != isRightHalfDir(outDir))) {
           delta = flowSpeed * 0.5;
          }
        }
        tile.liquid += delta;
      }
      
      if (tile.liquid > 1) tile.liquid = 1;
    }
    
    if (tile.liquid >= 0.66) {
      // Liquid has reached center, can flow to neighbors
      // Even if liquid is 1, we might still be trying to propagate if flowOut is null (dead end)
      // But if flowOut is set, we are done propagating.
      if (!tile.flowOut && !tile.isEnd) {
         isStillActive = true; // Still trying to find a path
         propagateLiquid(x, y, tile, changes);
      } else if (tile.liquid < 1) {
         // Still filling up to 1
      }
    }

    // Update Secondary Liquids
    if (tile.secondaryLiquids) {
      for (let sl of tile.secondaryLiquids) {
         if (sl.liquid > 0 && sl.liquid < 1) {
             isStillActive = true;

             if (!sl.flowOut && sl.liquid >= 0.33 && sl.liquid < 0.66) {
               sl.previewFlowOut = computeFlowOutPreview(x, y, { type: tile.type, liquidSource: sl.liquidSource, isEnd: false });
             }

             if (sl.liquid >= 0.66 && !sl.flowOut) {
                 // wait
             } else {
                 let delta = flowSpeed;
                 if (sl.liquid >= 0.33 && sl.liquid < 0.66) {
                   let inDir = (sl.liquidSource && sl.liquidSource !== 'CENTER') ? sl.liquidSource : null;
                   let outDir = sl.flowOut || sl.previewFlowOut || null;
                   if (isCardinalDir(inDir) && isCardinalDir(outDir) && (isRightHalfDir(inDir) != isRightHalfDir(outDir))) {
                     delta = flowSpeed * 0.5;
                   }
                 }
                 sl.liquid += delta;
             }
             if (sl.liquid > 1) sl.liquid = 1;
         }
         
         if (sl.liquid >= 0.66) {
             if (!sl.flowOut) {
                isStillActive = true;
                // Prepare proxy for propagateLiquid
                sl.type = tile.type; 
                sl.isEnd = false;
                propagateLiquid(x, y, sl, changes);
             }
         }
      }
    }

    if (!isStillActive) {
      finishedTiles.push(key);
    }
  }

  // Remove finished tiles
  for (let key of finishedTiles) {
    activeTiles.delete(key);
  }

  // Apply changes (new liquid sources)
  for (let c of changes) {
    let t = grid[c.y][c.x];
    if (t) {
      let activated = false;
      if (t.liquid === 0) {
        t.liquid = 0.01; // Start filling
        t.liquidSource = c.source;
        activated = true;
      } else if (t.type === 'cross') {
         // Check if we can add secondary flow
         if (t.liquidSource === c.source) continue; // Same source, ignore
         
         if (!t.secondaryLiquids) t.secondaryLiquids = [];
         
         // Check if we already have this source
         let exists = t.secondaryLiquids.find(sl => sl.liquidSource === c.source);
         if (!exists && t.secondaryLiquids.length === 0) {
             t.secondaryLiquids.push({ liquid: 0.01, liquidSource: c.source, flowOut: null });
             activated = true;
         }
      }
      
      if (activated) {
        activeTiles.add(`${c.x},${c.y}`);
      }
    }
  }
}

function propagateLiquid(x, y, tile, changes) {
  if (tile.flowOut) return; // Already flowing out
  if (tile.isEnd) return; // End tiles don't flow out

  let conns = tileTypes[tile.type].connections;
  let source = tile.liquidSource;
  
  // Determine preferred direction (Straight)
  let preferred = null;
  if (source === 'N') preferred = 'S';
  if (source === 'S') preferred = 'N';
  if (source === 'E') preferred = 'W';
  if (source === 'W') preferred = 'E';
  
  // Helper to try flowing in a direction
  // Returns true if successful
  function tryFlow(dir) {
    if (conns.includes(dir) && source !== dir) {
      // Determine neighbor coordinates
      let nx = x, ny = y;
      let requiredConn = '';
      
      if (dir === 'N') { ny--; requiredConn = 'S'; }
      if (dir === 'S') { ny++; requiredConn = 'N'; }
      if (dir === 'E') { nx++; requiredConn = 'W'; }
      if (dir === 'W') { nx--; requiredConn = 'E'; }
      
      if (checkNeighbor(nx, ny, requiredConn, changes)) {
        tile.flowOut = dir; // Lock flow direction
        return true;
      }
    }
    return false;
  }
  
  // 1. Try preferred direction first
  if (preferred && tryFlow(preferred)) return;
  
  // 2. Try others if preferred failed or didn't exist
  // BUT: For 'cross' tiles, we ONLY allow straight flow.
  if (tile.type === 'cross') return;

  let dirs = ['N', 'E', 'S', 'W'];
  for (let dir of dirs) {
    if (dir !== preferred) {
      if (tryFlow(dir)) return; // Stop after first success (No splitting)
    }
  }
}

function checkNeighbor(nx, ny, requiredConn, changes) {
  if (isValidGrid(nx, ny)) {
    let neighbor = grid[ny][nx];
    if (neighbor) {
      let nConns = tileTypes[neighbor.type].connections;
      if (nConns.includes(requiredConn)) {
        // Case 1: Empty tile
        if (neighbor.liquid === 0) {
          changes.push({ x: nx, y: ny, source: requiredConn });
          return true; // Success
        }
        // Case 2: Cross tile with existing flow
        if (neighbor.type === 'cross') {
            // Check if primary flow is orthogonal
            let src = neighbor.liquidSource;
            let isOrthogonal = (['N','S'].includes(src) && ['E','W'].includes(requiredConn)) ||
                               (['E','W'].includes(src) && ['N','S'].includes(requiredConn));
            
            // Check if secondary flow exists
            let hasSecondary = neighbor.secondaryLiquids && neighbor.secondaryLiquids.length > 0;
            
            if (isOrthogonal && !hasSecondary) {
                 changes.push({ x: nx, y: ny, source: requiredConn });
                 return true;
            }
        }
      }
    }
  }
  return false;
}

function canFlowToNeighbor(nx, ny, requiredConn) {
  if (!isValidGrid(nx, ny)) return false;

  let neighbor = grid[ny][nx];
  if (!neighbor) return false;

  let nConns = tileTypes[neighbor.type].connections;
  if (!nConns.includes(requiredConn)) return false;

  // Case 1: Empty tile
  if (neighbor.liquid === 0) return true;

  // Case 2: Cross tile with existing flow allows orthogonal secondary
  if (neighbor.type === 'cross') {
    let src = neighbor.liquidSource;
    let isOrthogonal = (['N', 'S'].includes(src) && ['E', 'W'].includes(requiredConn)) ||
      (['E', 'W'].includes(src) && ['N', 'S'].includes(requiredConn));

    let hasSecondary = neighbor.secondaryLiquids && neighbor.secondaryLiquids.length > 0;
    if (isOrthogonal && !hasSecondary) return true;
  }

  return false;
}

function computeFlowOutPreview(x, y, tile) {
  if (!tile || tile.isEnd) return null;

  let source = tile.liquidSource;
  if (!source || source === 'CENTER') return null;

  let conns = tileTypes[tile.type].connections;

  // Determine preferred direction (straight)
  let preferred = null;
  if (source === 'N') preferred = 'S';
  if (source === 'S') preferred = 'N';
  if (source === 'E') preferred = 'W';
  if (source === 'W') preferred = 'E';

  function canDir(dir) {
    if (!conns.includes(dir) || source === dir) return false;

    let nx = x, ny = y;
    let requiredConn = '';
    if (dir === 'N') { ny--; requiredConn = 'S'; }
    if (dir === 'S') { ny++; requiredConn = 'N'; }
    if (dir === 'E') { nx++; requiredConn = 'W'; }
    if (dir === 'W') { nx--; requiredConn = 'E'; }

    return canFlowToNeighbor(nx, ny, requiredConn);
  }

  if (preferred && canDir(preferred)) return preferred;

  // Cross tiles only allow straight flow
  if (tile.type === 'cross') return null;

  let dirs = ['N', 'E', 'S', 'W'];
  for (let dir of dirs) {
    if (dir !== preferred && canDir(dir)) return dir;
  }

  return null;
}

function drawLiquid(x, y, screenPos, tile) {
  // Draw liquid based on level and source
  // Level 0..0.5: Source -> Center
  // Level 0.5..1: Center -> Outlets
  
  let cx = screenPos.x;
  let cy = screenPos.y - 12; // Approx center of tile surface
  
  stroke(0, 255, 255); // Cyan
  strokeWeight(6);
  strokeCap(SQUARE);
  
  let level = tile.liquid;
  let source = tile.liquidSource;
  let conns = tileTypes[tile.type].connections;
  
  // 1. Draw Source to Center (if applicable)
  if (source !== 'CENTER') {
    let progress = constrain(map(level, 0, 0.5, 0, 1), 0, 1);
    drawLiquidArm(cx, cy, source, progress);
  } else {
    // Start tile: just fill center? Or assume it's full at center?
    // Let's assume start tile is always full at center.
  }
  
  // 2. Draw Center to Outlets
  if (level > 0.5 || source === 'CENTER') {
    let progress = constrain(map(level, 0.5, 1, 0, 1), 0, 1);
    if (source === 'CENTER') progress = constrain(map(level, 0, 1, 0, 1), 0, 1); // Start tile fills 0..1 outwards

    for (let dir of conns) {
      if (dir !== source) {
        drawLiquidArm(cx, cy, dir, progress);
      }
    }
  }
  
  // Check Win Condition visually (if end tile is full)
  if (tile.isEnd && level >= 1 && gameState !== 'WON') {
    gameState = 'WON';
  }
}

function drawLiquidArm(cx, cy, dir, progress) {
  if (progress <= 0) return;
  
  let tx, ty;
  // Arm lengths: 18, 9
  // N: +18, -9
  // E: +18, +9
  // S: -18, +9
  // W: -18, -9
  
  // But wait, these are directions FROM center TO edge.
  // If drawing Source->Center, we draw FROM edge TO center?
  // Actually, easier to draw line from Center TO Edge, but scale length.
  
  let dx = 0, dy = 0;
  if (dir === 'N') { dx = 18; dy = -9; }
  if (dir === 'E') { dx = 18; dy = 9; }
  if (dir === 'S') { dx = -18; dy = 9; }
  if (dir === 'W') { dx = -18; dy = -9; }
  
  // If this is the source arm, we want to draw from Edge to Center.
  // But visually, a line from Center to Edge * (1-progress) starting at Edge?
  // No, simpler:
  // If it's an outlet: Line from Center to (Center + Dir * progress)
  // If it's a source: Line from (Center + Dir) to (Center + Dir * (1-progress)) ? 
  // No, source fills TOWARDS center.
  // So it starts at Edge (Center + Dir) and ends at (Center + Dir * (1-progress)).
  
  // Let's handle this in the call? No, `drawLiquidArm` is generic.
  // Let's assume `drawLiquidArm` draws the OUTGOING arm.
  // We need a separate logic for INCOMING arm?
  
  // Let's refactor `drawLiquidArm` to just draw a segment.
  line(cx, cy, cx + dx * progress, cy + dy * progress);
}

// Override drawLiquid to handle incoming correctly
function drawLiquid(x, y, screenPos, tile) {
  // Main flow
  drawLiquidFlow(screenPos, tile.type, tile.liquid, tile.liquidSource, tile.flowOut, tile.previewFlowOut);

  // Secondary flows (for testing or complex tiles)
  if (tile.secondaryLiquids) {
    for (let flow of tile.secondaryLiquids) {
      drawLiquidFlow(screenPos, tile.type, flow.liquid, flow.liquidSource, flow.flowOut, flow.previewFlowOut);
    }
  }
  
  // Check Win Condition visually (if end tile is full)
  if (tile.isEnd && tile.liquid >= 1 && gameState !== 'WON') {
    gameState = 'WON';
  }
}

function drawLiquidFlow(screenPos, type, level, source, flowOut, previewFlowOut) {
  // 1. Incoming (Source -> Center)
  // Range: 0.0 to 0.33
  if (source && source !== 'CENTER') {
    let progress = constrain(map(level, 0, 0.33, 0, 1), 0, 1);
    drawLiquidImage(screenPos, source, progress, true, type);
  }
  
  // 2. Center Hub
  // Range: 0.33 to 0.66
  // We just show it if level > 0.33
  if (level > 0.33) {
    let centerProgress = constrain(map(level, 0.33, 0.66, 0, 1), 0, 1);
    let centerOutDir = flowOut || previewFlowOut || null;
    let centerInDir = (source && source !== 'CENTER') ? source : null;
    drawLiquidImage(screenPos, 'CENTER', centerProgress, false, type, centerInDir, centerOutDir);
  }
  
  // 3. Outgoing (Center -> Others)
  // Range: 0.66 to 1.0
  if (level > 0.66 || source === 'CENTER') {
    let progress = constrain(map(level, 0.66, 1, 0, 1), 0, 1);
    if (source === 'CENTER') progress = constrain(map(level, 0.66, 1, 0, 1), 0, 1);

    // Only draw the chosen flowOut direction
    if (flowOut) {
      drawLiquidImage(screenPos, flowOut, progress, false, type);
    }
  }
}

function drawLiquidImage(screenPos, dir, progress, isIncoming, tileType, centerInDir, centerOutDir) {
  let img = resolveLiquidImage(tileType, dir, dir === 'CENTER' ? ['CENTER', centerInDir, centerOutDir] : undefined);
  
  if (!img) return;
  
  // Center blob - just draw it
  if (dir === 'CENTER') {
      let ctx = drawingContext;
      let p = constrain(progress, 0, 1);
      if (p <= 0) return;

      let baseX = screenPos.x - 19;
      let baseY = screenPos.y - 20;

      const cx = 19;
      const armLength = 19;
      const hasIn = isCardinalDir(centerInDir);
      const hasOut = isCardinalDir(centerOutDir);
      const inRight = hasIn && isRightHalfDir(centerInDir);
      const outRight = hasOut && isRightHalfDir(centerOutDir);

      if (hasIn && !hasOut) {
        let sw = Math.max(1, Math.floor(armLength * p));
        if (inRight) {
          let sx = (cx + armLength) - sw;
          fastImage(ctx, img, baseX + sx, baseY, sw, img.height, sx, 0, sw, img.height);
        } else {
          let sx = 0;
          fastImage(ctx, img, baseX + sx, baseY, sw, img.height, sx, 0, sw, img.height);
        }
        return;
      }

      if (hasIn && hasOut && inRight != outRight) {
        let pIn = Math.min(1, p * 2);
        let pOut = Math.max(0, (p - 0.5) * 2);

        let swIn = Math.max(1, Math.floor(armLength * pIn));
        if (inRight) {
          let sxIn = (cx + armLength) - swIn;
          fastImage(ctx, img, baseX + sxIn, baseY, swIn, img.height, sxIn, 0, swIn, img.height);
        } else {
          let sxIn = 0;
          fastImage(ctx, img, baseX + sxIn, baseY, swIn, img.height, sxIn, 0, swIn, img.height);
        }

        if (pOut > 0) {
          let swOut = Math.max(1, Math.floor(armLength * pOut));
          let sxOut = outRight ? cx : (cx - swOut);
          fastImage(ctx, img, baseX + sxOut, baseY, swOut, img.height, sxOut, 0, swOut, img.height);
        }
      } else if (hasOut) {
        let sw = Math.max(1, Math.floor(armLength * p));
        let sx = outRight ? cx : (cx - sw);
        fastImage(ctx, img, baseX + sx, baseY, sw, img.height, sx, 0, sw, img.height);
      } else {
        fastImage(ctx, img, baseX, baseY);
      }
      return;
  }

  // Horizontal Wipe Logic
  // We assume the image is aligned such that the tile center is at x=19 (half of 38)
  let cx = 19;
  let armLength = 19;
  
  let sx, sw;
  let sy = 0;
  let sh = img.height; // Draw full height
  
  // Determine if arm is on Left (W, S) or Right (N, E)
  let isRight = (dir === 'N' || dir === 'E');
  
  if (isRight) {
    // Arm is in x range [19, 38]
    if (isIncoming) {
      // Flow: Right -> Left (Edge -> Center)
      // Reveal from Right Edge (38) inwards
      // Visible range: [38 - len*p, 38]
      sw = armLength * progress;
      sx = (cx + armLength) - sw;
    } else {
      // Flow: Left -> Right (Center -> Edge)
      // Reveal from Center (19) outwards
      // Visible range: [19, 19 + len*p]
      sx = cx;
      sw = armLength * progress;
    }
  } else {
    // Arm is in x range [0, 19]
    if (isIncoming) {
      // Flow: Left -> Right (Edge -> Center)
      // Reveal from Left Edge (0) inwards
      // Visible range: [0, len*p]
      sx = 0;
      sw = armLength * progress;
    } else {
      // Flow: Right -> Left (Center -> Edge)
      // Reveal from Center (19) outwards
      // Visible range: [19 - len*p, 19]
      sw = armLength * progress;
      sx = cx - sw;
    }
  }
  
  // Safety check for zero width
  if (sw <= 0) return;
  
  // Destination coordinates
  let dx = (screenPos.x - 19) + sx;
  let dy = (screenPos.y - 20) + sy;
  
  // Draw cropped using Native Canvas API to avoid p5.js overhead/leaks
  let ctx = drawingContext;
  // p5 image.canvas is the HTMLCanvasElement
  if (img.canvas) {
      ctx.drawImage(img.canvas, sx, sy, sw, sh, dx, dy, sw, sh);
  } else {
      // Fallback if it's an element (unlikely for p5.Image)
      try {
        ctx.drawImage(img.elt, sx, sy, sw, sh, dx, dy, sw, sh);
      } catch (e) {
        // Last resort
        // image(img, dx, dy, sw, sh, sx, sy, sw, sh);
      }
  }
}
