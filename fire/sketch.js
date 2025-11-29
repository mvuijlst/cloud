let scaleSlider, waterSlider, mountainSlider;
let riverTiles = new Set();
let treeCounts = new Map(); // Stores count of trees per tile
let burningTiles = new Set(); // Stores burning tiles
let recoveringTiles = new Map(); // Stores recovery progress 0.0 to 1.0
let treeHistory = [];
let isGrowing = false;
let hexSize = 30;
let treeGrowthRate = 0.001;
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
  createCanvas(windowWidth, windowHeight);
  noLoop(); 
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
    redraw();
  });

  createDiv('Tree Speed').parent(controls);
  let speedSelect = createSelect().parent(controls);
  speedSelect.option('Very Fast', 3.0);
  speedSelect.option('Fast', 0.5);
  speedSelect.option('Normal', 0.05);
  speedSelect.option('Slow', 0.005);
  speedSelect.option('Very Slow', 0.0005);
  speedSelect.selected('Slow');
  
  speedSelect.changed(() => {
    treeGrowthRate = float(speedSelect.value());
  });

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
}

function updateTerrain() {
  storeItem('noiseScale', scaleSlider.value());
  storeItem('waterLevel', waterSlider.value());
  storeItem('mountainHeight', mountainSlider.value());
  riverTiles.clear();
  treeCounts.clear();
  burningTiles.clear();
  recoveringTiles.clear();
  isGrowing = false;
  redraw();
}

function draw() {
  if (isGrowing) {
    growStep();
    simulateFire();
  }

  background(20);
  stroke(50, 50, 50, 15);
  strokeWeight(1);

  let hexWidth = Math.sqrt(3) * hexSize;
  let hexHeight = 2 * hexSize;
  
  // Vertical distance between rows is 3/4 of the height
  let ySpacing = hexHeight * 0.75;
  // Horizontal distance is the full width
  let xSpacing = hexWidth;

  // Calculate how many rows and cols we need to fill the screen
  // Add a buffer to ensure edges are covered
  let rows = Math.ceil(height / ySpacing) + 1;
  let cols = Math.ceil(width / xSpacing) + 1;

  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      let x = c * xSpacing;
      let y = r * ySpacing;
      
      // Offset every odd row
      if (r % 2 !== 0) {
        x += xSpacing / 2;
      }
      
      // Use Perlin noise for color
      let scale = scaleSlider.value();
      let water = waterSlider.value();
      let mount = mountainSlider.value();

      let n = noise(x * scale, y * scale);
      n = pow(n, mount);
      n -= water;
      n = constrain(n, 0, 1);
      
      let key = `${r},${c}`;
      let isBurning = burningTiles.has(key);
      let recovery = recoveringTiles.get(key);
      
      let tileColor;
      
      if (riverTiles.has(key)) {
        tileColor = color("#C3E6FA");
      } else {
        // Map noise to palette index
        let colorIndex = floor(map(n, 0, 1, palette.length, 0));
        colorIndex = constrain(colorIndex, 0, palette.length - 1);
        tileColor = color(palette[colorIndex]);
      }

      if (isBurning) {
          fill(255, 100, 0); // Orange
      } else if (recovery !== undefined) {
          let darkGrey = color(50);
          fill(lerpColor(darkGrey, tileColor, recovery));
      } else {
          fill(tileColor);
      }

      // Simple distance check for mouse hover
      let d = dist(mouseX, mouseY, x, y);
      if (d < hexSize * 0.8) {
        fill(255);
      }
      
      drawHex(x, y, hexSize);

      if (treeCounts.has(key)) {
        let count = treeCounts.get(key);
        push();
        noStroke();
        for (let i = 0; i < count; i++) {
            let offset = getTreePos(r, c, i, hexSize);
            let tx = x + offset.x;
            let ty = y + offset.y;
            
            // Generate stable random values for this specific tree
            let seed = (r * 997 + c * 97 + i * 7) * 123.45;
            let rand1 = Math.abs((Math.sin(seed + 1) * 10000) % 1); // 0 to 1
            let rand2 = Math.abs((Math.cos(seed + 2) * 10000) % 1); // 0 to 1
            
            // Size: Base 1.0, +/- 5%
            let sizeMult = map(rand2, 0, 1, 0.95, 1.05);
            let h = hexSize * 0.7 * sizeMult;
            let w = hexSize * 0.2 * sizeMult;
            
            let trunkH = h * 0.2;
            let trunkW = w * 0.6;

            // Trunk
            fill(101, 67, 33);
            rect(tx - trunkW/2, ty - trunkH, trunkW, trunkH);

            // Opacity: Base 150, +/- 5% (approx +/- 13)
            let alpha = 150 + map(rand1, 0, 1, -13, 13);
            fill(48, 91, 19, alpha);
            
            // Upright elongated larger triangle with randomness
            triangle(tx, ty - h - trunkH, tx - w, ty - trunkH, tx + w, ty - trunkH);
        }
        pop();
      }
      
      // Removed old burning overlay
    }
  }
  
  // Keep looping if growing OR burning OR recovering
  if (!isGrowing && burningTiles.size === 0 && recoveringTiles.size === 0) {
      noLoop();
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
        generateRiver(r, c);
        redraw();
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
        recoveringTiles.set(key, progress + 0.005); 
    } else {
        recoveringTiles.delete(key);
    }
  }

  let hexWidth = Math.sqrt(3) * hexSize;
  let hexHeight = 2 * hexSize;
  let ySpacing = hexHeight * 0.75;
  let xSpacing = hexWidth;
  
  let rows = Math.ceil(height / ySpacing) + 1;
  let cols = Math.ceil(width / xSpacing) + 1;

  let changes = 0;
  let potentialGrowth = false;

  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      let key = `${r},${c}`;
      
      // Don't grow if burning
      if (burningTiles.has(key)) continue;
      
      // Don't grow if recovering and not halfway done
      if (recoveringTiles.has(key) && recoveringTiles.get(key) < 0.5) continue;

      let h = getHeight(r, c);
      if (h === -1) continue; // River

      let colorIndex = floor(map(h, 0, 1, palette.length, 0));
      colorIndex = constrain(colorIndex, 0, palette.length - 1);
      
      let maxTrees = 0;
      if (colorIndex >= 7) {
        maxTrees = 0; // Water
      } else if (colorIndex === 6) {
        maxTrees = 10; // Target green
      } else if (colorIndex < 6) {
        // Decline towards high mountains (index 0)
        maxTrees = floor(map(colorIndex, 0, 6, 3, 10));
      }
      
      let current = treeCounts.get(key) || 0;
      
      if (current < maxTrees) {
          potentialGrowth = true;
          // Growth probability
          if (random() < treeGrowthRate) {
              treeCounts.set(key, current + 1);
              changes++;
          }
      }
    }
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
  let nextFire = new Set(burningTiles);
  let heatMap = new Map(); // Counts burning neighbors for non-burning tiles
  
  for (let key of burningTiles) {
      let count = treeCounts.get(key) || 0;
      
      if (count > 0) {
          // Fire consumes trees
          if (frameCount % 2 === 0) {
              treeCounts.set(key, count - 1);
          }
          
          // Spread
          let [r, c] = key.split(',').map(Number);
          let neighbors = getNeighbors(r, c);
          for (let n of neighbors) {
              let nKey = `${n.r},${n.c}`;
              if (!burningTiles.has(nKey)) {
                  // Track heat from neighbors
                  heatMap.set(nKey, (heatMap.get(nKey) || 0) + 1);

                  let nCount = treeCounts.get(nKey) || 0;
                  if (nCount > 4) {
                      // Spread chance
                      if (random() < 0.3) {
                          nextFire.add(nKey);
                          recoveringTiles.delete(nKey); // Stop recovery
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

  burningTiles = nextFire;
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
