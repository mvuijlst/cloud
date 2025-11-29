let simSpeedSlider, growthSlider, fireBurnSlider, fireSpreadSlider, recoverySlider;
let scaleSlider, waterSlider, mountainSlider, fpsDiv;
let riverTiles = new Set();
let treeCounts = new Map(); // Stores count of trees per tile
let burningTiles = new Set(); // Stores burning tiles
let recoveringTiles = new Map(); // Stores recovery progress 0.0 to 1.0
let growableTiles = new Set(); // Tiles that can grow trees
let heatMap = new Map(); // Reused for fire simulation
let nextFire = new Set(); // Reused for fire simulation
let treeHistory = [];
let isGrowing = false;
let hexSize = 30;
let simulationParams = {
  growthRate: 0.05,
  fireBurnRate: 0.5,
  fireSpreadChance: 0.3,
  recoveryRate: 0.005
};
let terrainBuffer;
let gridData = new Map(); // key -> {x, y, h, color, maxTrees, isRiver}
let palette = [
  "#6E4619", // High
  "#7D5528",
  "#AF7846",
  "#F5AA5A",
  "#FFD787",
  "#AFC850",
  "#91B93C",
  "#C3E6FA", 
  "#A5D2FF", 
  "#6EC3FA", 
  "#4BB9FF", 
  "#28AAF5"  // Low
];

function setup() {
  pixelDensity(1); // Optimization for high-DPI screens
  createCanvas(windowWidth, windowHeight);
  // noLoop(); // Always loop for FPS
  noiseDetail(8, 0.5); // Increase octaves for more realistic terrain 

  let ui = createDiv('');
  ui.position(20, 20);
  ui.style('color', 'white');
  ui.style('font-family', 'monospace');
  ui.style('background', 'rgba(0,0,0,0.5)');
  ui.style('padding', '10px');
  ui.style('border-radius', '5px');
  ui.style('min-width', '220px');

  // Header with toggle button
  let header = createDiv('').parent(ui);
  header.style('display', 'flex');
  header.style('justify-content', 'space-between');
  header.style('align-items', 'center');
  header.style('margin-bottom', '5px');
  
  let title = createDiv('Controls').parent(header);
  
  fpsDiv = createDiv('FPS: --').parent(header);
  fpsDiv.style('font-size', '12px');
  fpsDiv.style('margin-right', '10px');
  fpsDiv.style('color', '#aaa');

  let toggleBtn = createButton('X').parent(header);
  toggleBtn.style('width', '30px');
  toggleBtn.style('cursor', 'pointer');
  
  // Container for controls
  let controls = createDiv('').parent(ui);
  
  toggleBtn.mousePressed(() => {
    if (controls.style('display') === 'none') {
      controls.style('display', 'block');
      toggleBtn.html('X');
      title.html('Controls');
      ui.style('background', 'rgba(0,0,0,0.5)');
      ui.style('min-width', '220px');
    } else {
      controls.style('display', 'none');
      toggleBtn.html('+');
      title.html('');
      ui.style('background', 'rgba(0,0,0,0.2)');
      ui.style('min-width', '0px');
    }
  });
  
  let savedScale = getItem('noiseScale');
  if (savedScale === null) savedScale = 0.005;
  
  let savedWater = getItem('waterLevel');
  if (savedWater === null) savedWater = 0;
  
  let savedMount = getItem('mountainHeight');
  if (savedMount === null) savedMount = 1;
  
  createDiv('Hex Size').parent(controls);
  let sizeSelect = createSelect().parent(controls);
  sizeSelect.option('Very Large', 30);
  sizeSelect.option('Large', 20);
  sizeSelect.option('Medium', 15);
  sizeSelect.option('Small', 10);
  sizeSelect.option('Tiny', 5);
  
  // Set initial selection based on current hexSize
  if (hexSize === 30) sizeSelect.selected('Very Large');
  else if (hexSize === 20) sizeSelect.selected('Large');
  else if (hexSize === 15) sizeSelect.selected('Medium');
  else if (hexSize === 10) sizeSelect.selected('Small');
  else if (hexSize === 5) sizeSelect.selected('Tiny');
  else sizeSelect.selected('Small'); // Default fallback

  sizeSelect.changed(() => {
    hexSize = parseInt(sizeSelect.value());
    riverTiles.clear();
    treeCounts.clear();
    burningTiles.clear();
    recoveringTiles.clear();
    isGrowing = false;
    cacheTerrain();
    redraw();
  });

  function addSlider(label, min, max, val, step) {
    let row = createDiv().parent(controls).style('display', 'flex').style('justify-content', 'space-between').style('margin-top', '5px');
    createDiv(label).parent(row);
    let valDiv = createDiv(String(val)).parent(row);
    let s = createSlider(min, max, val, step).parent(controls);
    s.style('width', '100%');
    s.style('margin-bottom', '5px');
    s.input(() => valDiv.html(s.value()));
    return s;
  }

  simSpeedSlider = addSlider('Sim Speed', 1, 10, 1, 1);
  growthSlider = addSlider('Growth Chance', 0, 0.001, 0.0001, 0.00001);
  fireBurnSlider = addSlider('Fire Burn Speed', 0, 1, 0.5, 0.01);
  fireSpreadSlider = addSlider('Fire Spread Chance', 0, 1, 0.3, 0.01);
  recoverySlider = addSlider('Recovery Speed', 0, 0.1, 0.005, 0.001);

  let btn = createButton('Grow Trees').parent(controls);
  btn.style('margin-top', '10px');
  btn.style('margin-bottom', '10px');
  btn.style('width', '100%');
  btn.mousePressed(startGrowingTrees);

  createDiv('Noise Scale').parent(controls);
  scaleSlider = createSlider(0.001, 0.005, float(savedScale), 0.0001).parent(controls);
  scaleSlider.style('width', '200px');
  scaleSlider.input(updateTerrain);
  
  createDiv('Water Level').parent(controls);
  waterSlider = createSlider(-0.5, 0.5, float(savedWater), 0.01).parent(controls);
  waterSlider.style('width', '200px');
  waterSlider.input(updateTerrain);
  
  createDiv('Mountain Height').parent(controls);
  mountainSlider = createSlider(0.1, 5, float(savedMount), 0.1).parent(controls);
  mountainSlider.style('width', '200px');
  mountainSlider.input(updateTerrain);

  frameRate(60);
  cacheTerrain();
}

// Removed updateSimulationParams function as it is no longer used
function cacheTerrain() {
  if (terrainBuffer) terrainBuffer.remove();
  terrainBuffer = createGraphics(width, height);
  gridData.clear();
  growableTiles.clear();
  
  terrainBuffer.background(20);
  terrainBuffer.stroke(50, 50, 50, 15);
  terrainBuffer.strokeWeight(1);

  let hexWidth = Math.sqrt(3) * hexSize;
  let hexHeight = 2 * hexSize;
  let ySpacing = hexHeight * 0.75;
  let xSpacing = hexWidth;
  
  let rows = Math.ceil(height / ySpacing) + 1;
  let cols = Math.ceil(width / xSpacing) + 1;

  let scale = scaleSlider.value();
  let water = waterSlider.value();
  let mount = mountainSlider.value();

  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      let x = c * xSpacing;
      let y = r * ySpacing;
      
      if (r % 2 !== 0) {
        x += xSpacing / 2;
      }
      
      let n = noise(x * scale, y * scale);
      n = pow(n, mount);
      n -= water;
      n = constrain(n, 0, 1);
      
      let key = `${r},${c}`;
      let isRiver = riverTiles.has(key);
      
      let tileColor;
      let maxTrees = 0;
      
      /*
      if (isRiver) {
        tileColor = color("#C3E6FA");
        maxTrees = 0;
      } else {
      */
        let colorIndex = floor(map(n, 0, 1, palette.length, 0));
        colorIndex = constrain(colorIndex, 0, palette.length - 1);
        tileColor = color(palette[colorIndex]);
        
        if (colorIndex >= 7) {
            maxTrees = 0; // Water
        } else if (colorIndex === 6) {
            maxTrees = 10; // Target green
        } else if (colorIndex < 6) {
            maxTrees = floor(map(colorIndex, 0, 6, 3, 10));
        }
      // }
      
      let neighbors = getNeighbors(r, c).map(n => `${n.r},${n.c}`);
      
      // Pre-calculate tree positions
      let treeCache = [];
      for(let i=0; i<maxTrees; i++) {
          let offset = getTreePos(r, c, i, hexSize);
          let tx = x + offset.x;
          let ty = y + offset.y;
          
          let seed = (r * 997 + c * 97 + i * 7) * 123.45;
          let rand1 = Math.abs((Math.sin(seed + 1) * 10000) % 1);
          let rand2 = Math.abs((Math.cos(seed + 2) * 10000) % 1);
          
          let sizeMult = map(rand2, 0, 1, 0.95, 1.05);
          let h = hexSize * 0.7 * sizeMult;
          let w = hexSize * 0.2 * sizeMult;
          
          let trunkH = h * 0.2;
          let trunkW = w * 0.6;
          
          let alpha = 150 + map(rand1, 0, 1, -13, 13);
          
          treeCache.push({
              tx, ty, h, w, trunkH, trunkW, alpha
          });
      }

      gridData.set(key, {
          x, y, h: n, color: tileColor, maxTrees, isRiver, 
          neighbors, treeCache
      });

      if (maxTrees > 0) {
          growableTiles.add(key);
      }
      
      // Draw to buffer
      terrainBuffer.fill(tileColor);
      
      terrainBuffer.beginShape();
      for (let i = 0; i < 6; i++) {
        let angle = PI / 3 * i + PI / 6; 
        let xOffset = cos(angle) * hexSize;
        let yOffset = sin(angle) * hexSize;
        terrainBuffer.vertex(x + xOffset, y + yOffset);
      }
      terrainBuffer.endShape(CLOSE);
    }
  }
}

function updateTerrain() {
  storeItem('noiseScale', scaleSlider.value());
  storeItem('waterLevel', waterSlider.value());
  storeItem('mountainHeight', mountainSlider.value());
  riverTiles.clear();
  treeCounts.clear();
  burningTiles.clear();
  recoveringTiles.clear();
  growableTiles.clear();
  isGrowing = false;
  cacheTerrain();
  redraw();
}

function draw() {
  if (fpsDiv && frameCount % 10 === 0) fpsDiv.html('FPS: ' + floor(frameRate()));

  let steps = simSpeedSlider.value();
  
  // Update params from sliders
  simulationParams.growthRate = growthSlider.value();
  simulationParams.fireBurnRate = fireBurnSlider.value();
  simulationParams.fireSpreadChance = fireSpreadSlider.value();
  simulationParams.recoveryRate = recoverySlider.value();

  if (isGrowing) {
    for(let i=0; i<steps; i++) {
        growStep();
        simulateFire();
    }
  }

  image(terrainBuffer, 0, 0);
  
  // Draw recovering tiles
  for (let [key, progress] of recoveringTiles) {
      let data = gridData.get(key);
      if (data) {
          let darkGrey = color(50);
          fill(lerpColor(darkGrey, data.color, progress));
          stroke(50, 50, 50, 15);
          strokeWeight(1);
          drawHex(data.x, data.y, hexSize);
      }
  }

  // Draw trees
  noStroke();
  
  // Pass 1: Trunks
  fill(101, 67, 33);
  for (let [key, count] of treeCounts) {
      let data = gridData.get(key);
      if (data) {
        for (let i = 0; i < count; i++) {
            let t = data.treeCache[i];
            if (!t) continue;
            rect(t.tx - t.trunkW/2, t.ty - t.trunkH, t.trunkW, t.trunkH);
        }
      }
  }

  // Pass 2: Leaves
  fill(48, 91, 19, 150);
  for (let [key, count] of treeCounts) {
      let data = gridData.get(key);
      if (data) {
        for (let i = 0; i < count; i++) {
            let t = data.treeCache[i];
            if (!t) continue;
            // fill(48, 91, 19, t.alpha); // Optimization: Use constant alpha
            triangle(t.tx, t.ty - t.h - t.trunkH, t.tx - t.w, t.ty - t.trunkH, t.tx + t.w, t.ty - t.trunkH);
        }
      }
  }

  // Draw fire
  for (let key of burningTiles) {
      let data = gridData.get(key);
      if (data) {
        fill(255, 100, 0); // Orange
        stroke(50, 50, 50, 15);
        strokeWeight(1);
        drawHex(data.x, data.y, hexSize);
      }
  }
  
  // Keep looping if growing OR burning OR recovering
  if (!isGrowing && burningTiles.size === 0 && recoveringTiles.size === 0) {
      // noLoop(); // Keep looping to show FPS
  }
  
  // Update and draw chart
  let totalTrees = 0;
  for (let count of treeCounts.values()) {
    totalTrees += count;
  }
  treeHistory.push(totalTrees);
  if (treeHistory.length > 1000) {
    treeHistory.shift();
  }
  drawChart();
}

function drawChart() {
  let chartWidth = 200;
  let chartHeight = 100;
  let x = 20;
  let y = height - 20 - chartHeight;
  
  // Background
  fill(0, 150);
  noStroke();
  rect(x, y, chartWidth, chartHeight);
  
  if (treeHistory.length < 2) return;
  
  stroke(0, 255, 0);
  strokeWeight(2);
  noFill();
  
  let maxTrees = -Infinity;
  let minTrees = Infinity;

  for(let t of treeHistory) {
      if(t > maxTrees) maxTrees = t;
      if(t < minTrees) minTrees = t;
  }
  
  if (maxTrees === minTrees) {
      maxTrees = minTrees + 1;
  }

  beginShape();
  for (let i = 0; i < treeHistory.length; i++) {
    let px = map(i, 0, treeHistory.length - 1, x, x + chartWidth);
    let py = map(treeHistory[i], minTrees, maxTrees, y + chartHeight, y);
    vertex(px, py);
  }
  endShape();
  
  // Text
  fill(255);
  noStroke();
  textAlign(LEFT, TOP);
  text("Trees: " + treeHistory[treeHistory.length-1], x + 5, y + 5);
}

function drawHex(x, y, size) {
  beginShape();
  for (let i = 0; i < 6; i++) {
    // Pointy topped hexagon
    // Angles: 30, 90, 150, 210, 270, 330 degrees
    let angle = PI / 3 * i + PI / 6; 
    let xOffset = cos(angle) * size;
    let yOffset = sin(angle) * size;
    vertex(x + xOffset, y + yOffset);
  }
  endShape(CLOSE);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  cacheTerrain();
  redraw();
}

function mousePressed() {
  // Check if click is on UI (approximate check)
  if (mouseX < 250 && mouseY < 250) return;

  let hexWidth = Math.sqrt(3) * hexSize;
  let hexHeight = 2 * hexSize;
  let ySpacing = hexHeight * 0.75;
  let xSpacing = hexWidth;
  
  let rows = Math.ceil(height / ySpacing) + 1;
  let cols = Math.ceil(width / xSpacing) + 1;
  
  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      let x = c * xSpacing;
      let y = r * ySpacing;
      if (r % 2 !== 0) x += xSpacing / 2;
      
      if (dist(mouseX, mouseY, x, y) < hexSize * 0.8) {
        // generateRiver(r, c);
        // redraw();
        return;
      }
    }
  }
}

function generateRiver(r, c) {
  let currR = r;
  let currC = c;
  
  let maxSteps = 1000;
  let steps = 0;
  let currentPath = new Set();
  let pathList = [];
  let foundWater = false;
  
  while (steps < maxSteps) {
    let key = `${currR},${currC}`;
    
    // If we hit an existing river, we merge and stop
    if (riverTiles.has(key)) {
       foundWater = true;
       break;
    }
    
    if (currentPath.has(key)) break; // Loop prevention

    currentPath.add(key);
    pathList.push(key);
    
    let h = getHeight(currR, currC);
    
    // Check if water (index >= 7)
    let colorIndex = floor(map(h, 0, 1, palette.length, 0));
    colorIndex = constrain(colorIndex, 0, palette.length - 1);
    if (colorIndex >= 7) {
        foundWater = true;
        break; 
    }
    
    let neighbors = getNeighbors(currR, currC);
    let candidates = [];
    
    for (let n of neighbors) {
      let nKey = `${n.r},${n.c}`;
      if (currentPath.has(nKey)) continue; // Don't go back
      
      let isMerge = riverTiles.has(nKey);
      let touchesOther = false;
      
      if (!isMerge) {
        // Check if this neighbor touches any OTHER river tile
        let nNeighbors = getNeighbors(n.r, n.c);
        for (let nn of nNeighbors) {
          let nnKey = `${nn.r},${nn.c}`;
          if (nnKey === key) continue; // Ignore current tile
          
          if (riverTiles.has(nnKey) || currentPath.has(nnKey)) {
            touchesOther = true;
            break;
          }
        }
      }
      
      if (isMerge || !touchesOther) {
        candidates.push({n: n, h: getHeight(n.r, n.c)});
      }
    }
    
    if (candidates.length === 0) break; // Stuck or blocked by width constraint
    
    let minH = 100;
    for (let c of candidates) {
      if (c.h < minH) minH = c.h;
    }
    
    let bestMoves = candidates.filter(c => Math.abs(c.h - minH) < 0.00001);
    
    if (bestMoves.length > 0) {
      let lowest = random(bestMoves);
      currR = lowest.n.r;
      currC = lowest.n.c;
    } else {
      break;
    }
    steps++;
  }

  if (foundWater) {
      for (let k of pathList) {
          riverTiles.add(k);
      }
      cacheTerrain();
  }
}

function getHeight(r, c) {
  let key = `${r},${c}`;
  if (riverTiles.has(key)) return -1;

  let hexWidth = Math.sqrt(3) * hexSize;
  let hexHeight = 2 * hexSize;
  let ySpacing = hexHeight * 0.75;
  let xSpacing = hexWidth;
  
  let x = c * xSpacing;
  let y = r * ySpacing;
  if (r % 2 !== 0) x += xSpacing / 2;
  
  let scale = scaleSlider.value();
  let water = waterSlider.value();
  let mount = mountainSlider.value();

  let n = noise(x * scale, y * scale);
  n = pow(n, mount);
  n -= water;
  return constrain(n, 0, 1);
}

function getNeighbors(r, c) {
  let neighbors = [];
  let isOdd = (r % 2 !== 0);
  
  neighbors.push({r: r, c: c-1});
  neighbors.push({r: r, c: c+1});
  
  if (isOdd) {
    neighbors.push({r: r-1, c: c});
    neighbors.push({r: r-1, c: c+1});
    neighbors.push({r: r+1, c: c});
    neighbors.push({r: r+1, c: c+1});
  } else {
    neighbors.push({r: r-1, c: c-1});
    neighbors.push({r: r-1, c: c});
    neighbors.push({r: r+1, c: c-1});
    neighbors.push({r: r+1, c: c});
  }
  
  return neighbors;
}

function startGrowingTrees() {
    treeCounts.clear();
    burningTiles.clear();
    recoveringTiles.clear();
    treeHistory = [];
    isGrowing = true;
    loop();
}

function growStep() {
  // Update recovery
  for (let [key, progress] of recoveringTiles) {
    if (progress < 1) {
        recoveringTiles.set(key, progress + simulationParams.recoveryRate); 
    } else {
        recoveringTiles.delete(key);
        // Ensure it's marked as growable when recovery ends
        let data = gridData.get(key);
        if (data && data.maxTrees > 0) {
            growableTiles.add(key);
        }
    }
  }

  let changes = 0;
  let potentialGrowth = false;
  let fullTiles = [];

  for (let key of growableTiles) {
      // Don't grow if burning
      if (burningTiles.has(key)) continue;
      
      // Don't grow if recovering and not halfway done
      if (recoveringTiles.has(key) && recoveringTiles.get(key) < 0.5) continue;

      let data = gridData.get(key);
      if (!data) continue;

      let maxTrees = data.maxTrees;
      let current = treeCounts.get(key) || 0;
      
      if (current < maxTrees) {
          potentialGrowth = true;
          
          let amount = 0;
          if (simulationParams.growthRate >= 1) {
              amount = floor(simulationParams.growthRate);
          } else {
              if (random() < simulationParams.growthRate) amount = 1;
          }

          if (amount > 0) {
              let next = min(current + amount, maxTrees);
              if (next > current) {
                  treeCounts.set(key, next);
                  changes++;
                  if (next >= maxTrees) {
                      fullTiles.push(key);
                  }
              }
          }
      } else {
          fullTiles.push(key);
      }
  }

  for (let k of fullTiles) {
      growableTiles.delete(k);
  }
  
  // Don't stop growing if fire is active or recovering
  if (!potentialGrowth && burningTiles.size === 0 && recoveringTiles.size === 0) {
      // Check if we are truly full? 
      // For now, let's just stop if nothing happened and no fire
      isGrowing = false;
  } else {
      isGrowing = true; // Keep growing if fire is active or trees are growing
  }
}

function simulateFire() {
  let hexWidth = Math.sqrt(3) * hexSize;
  let hexHeight = 2 * hexSize;
  let ySpacing = hexHeight * 0.75;
  let xSpacing = hexWidth;
  
  let rows = Math.ceil(height / ySpacing) + 1;
  let cols = Math.ceil(width / xSpacing) + 1;

  // Lightning
  if (random() < 0.05) {
      let r = floor(random(-1, rows));
      let c = floor(random(-1, cols));
      let key = `${r},${c}`;
      
      if (treeCounts.has(key) && treeCounts.get(key) > 0) {
          burningTiles.add(key);
          recoveringTiles.delete(key); // Stop recovery if burning again
          isGrowing = true; // Ensure loop continues
      }
  }

  // Fire Logic
  nextFire.clear();
  for (let k of burningTiles) nextFire.add(k);
  
  heatMap.clear();
  
  for (let key of burningTiles) {
      let count = treeCounts.get(key) || 0;
      
      if (count > 0) {
          // Fire consumes trees
          let burnAmount = 0;
          if (simulationParams.fireBurnRate >= 1) {
              burnAmount = floor(simulationParams.fireBurnRate);
          } else {
              if (random() < simulationParams.fireBurnRate) burnAmount = 1;
          }
          
          if (burnAmount > 0) {
              treeCounts.set(key, max(0, count - burnAmount));
              growableTiles.add(key); // Space opened up
          }
          
          // Spread
          let data = gridData.get(key);
          if (data && data.neighbors) {
              for (let nKey of data.neighbors) {
                  if (!burningTiles.has(nKey)) {
                      // Track heat from neighbors
                      heatMap.set(nKey, (heatMap.get(nKey) || 0) + 1);
    
                      let nCount = treeCounts.get(nKey) || 0;
                      if (nCount > 4) {
                          // Spread chance
                          if (random() < simulationParams.fireSpreadChance) {
                              nextFire.add(nKey);
                              recoveringTiles.delete(nKey); // Stop recovery
                          }
                      }
                  }
              }
          }
      } else {
          // No more trees, fire stops
          nextFire.delete(key);
          recoveringTiles.set(key, 0); // Start recovery
      }
  }

  // Apply "3 neighbors" rule
  for (let [key, burningNeighbors] of heatMap) {
      if (burningNeighbors >= 3) {
          let count = treeCounts.get(key) || 0;
          if (count > 0) { // Needs fuel to burn
              nextFire.add(key);
              recoveringTiles.delete(key);
          }
      }
  }

  let temp = burningTiles;
  burningTiles = nextFire;
  nextFire = temp;
}

function getTreePos(r, c, i, size) {
    // Simple hash based on coords and tree index
    let seed = (r * 997 + c * 97 + i * 7) * 123.45;
    
    // Pseudo-random values 0-1
    let v1 = Math.abs((Math.sin(seed) * 10000) % 1);
    let v2 = Math.abs((Math.cos(seed) * 10000) % 1);
    
    let angle = v1 * TWO_PI;
    // sqrt for uniform distribution in circle, 0.8 to stay within hex
    let dist = Math.sqrt(v2) * size * 0.8; 
    
    return {
        x: Math.cos(angle) * dist, 
        y: Math.sin(angle) * dist
    };
}
