let blobs = [];
let springs = [];
let draggedBlob = null;
let shaderLayer;
let metaballShader;

const DESKTOP_SHADER_RES = 0.2; // Render at 1/5 resolution on larger screens for added detail
const MOBILE_SHADER_RES = 0.25; // Higher fidelity for smaller displays
const DESKTOP_MOTION_SCALE = 1;
const MOBILE_MOTION_SCALE = 0.6;
const DESKTOP_DAMPING = 0.98;
const MOBILE_DAMPING = 0.94;
const DESKTOP_MAX_SPEED = 6;
const MOBILE_MAX_SPEED = 3;
const MAX_BLOBS = 50;
const MAX_FOOD = 3;

const SPECIES_DEFS = [
  {
    key: 'warden',
    color: [0.72, 0.93, 0.78],
    motionBias: 0.85,
    dampingBias: 1.2,
    speedBias: 0.9,
    dominance: 1,
    hostileWith: ['harvester'],
    splitBias: 'cohesive',
    role: 'anchor',
    conversionResistance: 0.4,
    minShare: 0.28
  },
  {
    key: 'harvester',
    color: [1.0, 0.64, 0.42],
    motionBias: 1.25,
    dampingBias: 0.85,
    speedBias: 1.2,
    dominance: 3,
    hostileWith: [],
    splitBias: 'aggressive',
    role: 'hunter',
    conversionResistance: 0.7,
    minShare: 0.3
  },
  {
    key: 'weaver',
    color: [0.6, 0.82, 1.0],
    motionBias: 1.0,
    dampingBias: 1.0,
    speedBias: 1.0,
    dominance: 2,
    hostileWith: [],
    splitBias: 'balanced',
    role: 'support',
    mediator: true,
    conversionResistance: 0.2,
    minShare: 0.2
  }
];

const SPECIES_BY_KEY = SPECIES_DEFS.reduce((acc, spec) => {
  acc[spec.key] = spec;
  return acc;
}, {});

let shaderRes = DESKTOP_SHADER_RES;
let lastClickTime = 0;
let autoPlay = true;
let food = [];
let scaleFactor = 1;
let mobileView = false;
let motionScale = DESKTOP_MOTION_SCALE;
let velocityDamping = DESKTOP_DAMPING;
let maxSpeed = DESKTOP_MAX_SPEED;
let lastBalanceFrame = 0;

function preload() {
  metaballShader = loadShader('metaballs.vert', 'metaballs.frag');
}

function updateViewFlags() {
  mobileView = min(windowWidth, windowHeight) <= 900;
  shaderRes = mobileView ? MOBILE_SHADER_RES : DESKTOP_SHADER_RES;
  motionScale = mobileView ? MOBILE_MOTION_SCALE : DESKTOP_MOTION_SCALE;
  velocityDamping = mobileView ? MOBILE_DAMPING : DESKTOP_DAMPING;
  maxSpeed = mobileView ? MOBILE_MAX_SPEED : DESKTOP_MAX_SPEED;
}

function blobMotionScale(blob) {
  return motionScale * (blob?.traits?.motionBias || 1);
}

function blobDampingFactor(blob) {
  const bias = blob?.traits?.dampingBias || 1;
  const baseLoss = 1 - velocityDamping;
  const adjustedLoss = baseLoss * bias;
  return constrain(1 - adjustedLoss, 0.9, 0.9999);
}

function blobMaxSpeed(blob) {
  return maxSpeed * (blob?.traits?.speedBias || 1);
}

function pickSpeciesKey() {
  const idx = Math.floor(Math.random() * SPECIES_DEFS.length);
  return SPECIES_DEFS[idx].key;
}

function setBlobSpecies(blob, key) {
  const spec = SPECIES_BY_KEY[key] || SPECIES_DEFS[0];
  blob.species = spec.key;
  blob.traits = spec;
  blob.speciesColor = spec.color;
}

function createBlob(x, y, radius, preferredSpecies) {
  const blob = {
    x,
    y,
    r: radius !== undefined ? radius : random(40, 80) * scaleFactor,
    vx: random(-1, 1),
    vy: random(-1, 1)
  };
  const speciesKey = preferredSpecies || pickSpeciesKey();
  setBlobSpecies(blob, speciesKey);
  return blob;
}

function isRole(blob, role) {
  return blob?.traits?.role === role;
}

function tryConvertBlob(blob, targetSpecies) {
  if (!blob || blob.species === targetSpecies) return true;
  const resistance = blob?.traits?.conversionResistance || 0;
  if (random() < resistance) return false;
  setBlobSpecies(blob, targetSpecies);
  return true;
}

function findNearestFoodFor(blob) {
  if (!blob || food.length === 0) return null;
  let nearest = null;
  let bestDist = Infinity;
  for (let f of food) {
    const d = dist(blob.x, blob.y, f.x, f.y);
    if (d < bestDist) {
      bestDist = d;
      nearest = f;
    }
  }
  return nearest;
}

function findClosestBlob(source, predicate) {
  let best = null;
  let bestDist = Infinity;
  for (let other of blobs) {
    if (other === source) continue;
    if (predicate && !predicate(other)) continue;
    const d = dist(source.x, source.y, other.x, other.y);
    if (d < bestDist) {
      bestDist = d;
      best = other;
    }
  }
  return best;
}

function areBlobsConnected(a, b) {
  if (!a || !b) return false;
  for (let s of springs) {
    if ((s.a === a && s.b === b) || (s.a === b && s.b === a)) {
      return true;
    }
  }
  return false;
}

function applySpeciesBehavior(blob, neighborList) {
  if (!blob?.traits) return;
  if (isRole(blob, 'hunter')) {
    const target = blob.huntingFood || findNearestFoodFor(blob);
    if (target) {
      const dx = target.x - blob.x;
      const dy = target.y - blob.y;
      const d = sqrt(dx * dx + dy * dy) || 1;
      const accel = 0.35 * blobMotionScale(blob);
      blob.vx += (dx / d) * accel;
      blob.vy += (dy / d) * accel;
    } else if (neighborList.length === 0) {
      blob.vx += random(-0.3, 0.3) * blobMotionScale(blob);
      blob.vy += random(-0.3, 0.3) * blobMotionScale(blob);
    }
  } else if (isRole(blob, 'anchor') && neighborList.length > 0) {
    let avgX = 0;
    let avgY = 0;
    for (let nb of neighborList) {
      avgX += nb.x;
      avgY += nb.y;
    }
    avgX /= neighborList.length;
    avgY /= neighborList.length;
    blob.vx += (avgX - blob.x) * 0.002;
    blob.vy += (avgY - blob.y) * 0.002;
    blob.vx *= 0.96;
    blob.vy *= 0.96;
  } else if (blob.traits.mediator) {
    if (frameCount % 90 === 0) {
      const target = findClosestBlob(blob, other => other.species !== blob.species);
      if (target && !areBlobsConnected(blob, target)) {
        const bridge = {
          a: blob,
          b: target,
          len: (blob.r + target.r) * 0.7
        };
        springs.push(bridge);
        handleSpeciesMerge(blob, target, bridge);
      }
    }
    const driftTarget = findClosestBlob(blob, other => other.species !== blob.species);
    if (driftTarget) {
      const dx = driftTarget.x - blob.x;
      const dy = driftTarget.y - blob.y;
      const d = sqrt(dx * dx + dy * dy) || 1;
      blob.vx += (dx / d) * 0.12;
      blob.vy += (dy / d) * 0.12;
    }
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  updateViewFlags();
  
  // Calculate scale factor based on screen size (reference: 1280px)
  scaleFactor = min(width, height) / 1280;
  
  // Create a WEBGL buffer for the shader to manage GPU load
  shaderLayer = createGraphics(ceil(width * shaderRes), ceil(height * shaderRes), WEBGL);
  
  // Initialize blobs with diverse species
  for (let i = 0; i < 10; i++) {
    blobs.push(createBlob(random(width), random(height)));
  }
  
  noSmooth();

}

function updateGameLogic() {
  // Identify neighbors
  let neighbors = new Map();
  for (let b of blobs) neighbors.set(b, []);
  
  for (let s of springs) {
    neighbors.get(s.a).push(s.b);
    neighbors.get(s.b).push(s.a);
  }

  // Apply rules
  for (let i = blobs.length - 1; i >= 0; i--) {
    let b = blobs[i];
    let myNeighbors = neighbors.get(b);
    let n = myNeighbors.length;
    
    const moveScale = blobMotionScale(b);

    // Auto Play Logic
    if (autoPlay) {
      if (n <= 1) {
        // Lonely: Seek nearest neighbor
        let nearest = null;
        let minD = Infinity;
        for (let other of blobs) {
          if (other === b) continue;
          let d = dist(b.x, b.y, other.x, other.y);
          if (d < minD) { minD = d; nearest = other; }
        }
        if (nearest) {
           let dx = nearest.x - b.x;
           let dy = nearest.y - b.y;
           let d = sqrt(dx*dx + dy*dy);
           if (d > 0) {
             b.vx += (dx/d) * 0.3 * moveScale;
             b.vy += (dy/d) * 0.3 * moveScale;
           }
        }
      } else if (n >= 5) {
        // Overcrowded: Move away from the center of the crowd
        let avgX = 0;
        let avgY = 0;
        for (let nb of myNeighbors) {
          avgX += nb.x;
          avgY += nb.y;
        }
        avgX /= n;
        avgY /= n;
        
        let dx = b.x - avgX;
        let dy = b.y - avgY;
        let d = sqrt(dx*dx + dy*dy);
        
        // Strong push away from the center
        if (d > 0) {
          b.vx += (dx / d) * 0.8 * moveScale;
          b.vy += (dy / d) * 0.8 * moveScale;
        } else {
          b.vx += random(-1, 1) * moveScale;
          b.vy += random(-1, 1) * moveScale;
        }
      }
    }

    applySpeciesBehavior(b, myNeighbors);

    if (n <= 1) {
      // Dies of loneliness
      b.r -= 0.02 * scaleFactor;
      if (b.r < 20 * scaleFactor) killBlob(b);
    } else if (n === 2 || n === 3) {
      // Stays alive, stable
    } else if (n === 4) {
      // Grows
      b.r += 0.05 * scaleFactor;
      if (b.r > 90 * scaleFactor) {
        birthBlob(b);
      }
    } else if (n >= 5) {
      // Dies of overcrowding
      b.r -= 0.04 * scaleFactor;
      if (b.r < 20 * scaleFactor) killBlob(b);
    }
  }

  checkSplitting(neighbors);

  if (frameCount - lastBalanceFrame > 300) {
    ensureSpeciesBalance();
    lastBalanceFrame = frameCount;
  }
}

function killBlob(blob) {
  let index = blobs.indexOf(blob);
  if (index > -1) {
    blobs.splice(index, 1);
  }
  // Remove connected springs
  for (let i = springs.length - 1; i >= 0; i--) {
    if (springs[i].a === blob || springs[i].b === blob) {
      springs.splice(i, 1);
    }
  }
  if (draggedBlob === blob) draggedBlob = null;
}

function birthBlob(parent) {
  if (blobs.length >= MAX_BLOBS) return;

  let angle = random(TWO_PI);
  let dist = parent.r * 1.2;
  let newR = 40 * scaleFactor;
  let inheritKey = random() < 0.35 ? pickSpeciesKey() : parent.species;
  let newBlob = createBlob(
    parent.x + cos(angle) * dist,
    parent.y + sin(angle) * dist,
    newR,
    inheritKey
  );
  newBlob.vx = 0;
  newBlob.vy = 0;
  
  // Keep inside bounds
  newBlob.x = constrain(newBlob.x, 0, width);
  newBlob.y = constrain(newBlob.y, 0, height);

  blobs.push(newBlob);
  
  // Connect to parent
  const newSpring = { 
    a: parent, 
    b: newBlob, 
    len: (parent.r + newBlob.r) * 0.85 
  };
  springs.push(newSpring);
  handleSpeciesMerge(parent, newBlob, newSpring);
  
  // Shrink parent back to normal
  parent.r = 60 * scaleFactor;
}

function spawnExtraHarvester(parent) {
  if (!parent || blobs.length >= MAX_BLOBS) return;
  const angle = random(TWO_PI);
  const distScale = random(0.8, 1.5);
  const spawnR = 35 * scaleFactor;
  const newborn = createBlob(
    constrain(parent.x + cos(angle) * parent.r * distScale, 0, width),
    constrain(parent.y + sin(angle) * parent.r * distScale, 0, height),
    spawnR,
    'harvester'
  );
  newborn.vx = parent.vx * 0.3 + random(-0.6, 0.6);
  newborn.vy = parent.vy * 0.3 + random(-0.6, 0.6);
  blobs.push(newborn);
}

function rewardHunterSuccess(hunter) {
  if (!isRole(hunter, 'hunter')) return;
  if (random() < 0.6) {
    spawnExtraHarvester(hunter);
  }
}

function spawnFood(x, y) {
  if (food.length >= MAX_FOOD) return;
  
  // Only pick blobs that aren't already hunting
  let availableBlobs = blobs.filter(b => !b.huntingFood);
  if (availableBlobs.length < 3) return; 

  let spawnX = (x !== undefined) ? x : random(50, width - 50);
  let spawnY = (y !== undefined) ? y : random(50, height - 50);

  let f = { 
    x: spawnX, 
    y: spawnY, 
    r: 15 * scaleFactor, 
    hunters: [] 
  };
  
  // Find 3 closest available blobs
  let sortedBlobs = availableBlobs.sort((a, b) => dist(a.x, a.y, f.x, f.y) - dist(b.x, b.y, f.x, f.y));
  let hunters = sortedBlobs.slice(0, 3);
  hunters = enforceHunterDiversity(hunters, availableBlobs);
  
  f.hunters = hunters;
  food.push(f);
  
  for (let h of hunters) {
    h.huntingFood = f;
  }
  
  // Split off: Cut external springs
  for (let i = springs.length - 1; i >= 0; i--) {
    let s = springs[i];
    let aIsHunter = hunters.includes(s.a);
    let bIsHunter = hunters.includes(s.b);
    
    // If one is hunter and other is NOT, cut it
    if ((aIsHunter && !bIsHunter) || (!aIsHunter && bIsHunter)) {
      springs.splice(i, 1);
    }
  }
  
  // Connect hunters to each other (to ensure stability n=2)
  for (let i = 0; i < hunters.length; i++) {
    for (let j = i + 1; j < hunters.length; j++) {
      let a = hunters[i];
      let b = hunters[j];
      // Check if connected
      let connected = false;
      for (let s of springs) {
        if ((s.a === a && s.b === b) || (s.a === b && s.b === a)) {
          connected = true;
          break;
        }
      }
      if (!connected) {
        const supportSpring = { a: a, b: b, len: (a.r + b.r) * 0.85 };
        springs.push(supportSpring);
        handleSpeciesMerge(a, b, supportSpring);
      }
    }
  }
}

function updateFoodLogic() {
  // Spawn food randomly
  if (frameCount % 600 === 0) { // Every ~10 seconds
    spawnFood();
  }

  // Move hunters and check eating
  for (let b of blobs) {
    if (b.huntingFood) {
      // Check if food still exists and is valid
      if (!food.includes(b.huntingFood)) {
         b.huntingFood = null;
         continue;
      }
      
      let f = b.huntingFood;
      let dx = f.x - b.x;
      let dy = f.y - b.y;
      let d = sqrt(dx*dx + dy*dy);
      
      // Move towards food
      if (d > 0) {
        const chaseScale = blobMotionScale(b);
        b.vx += (dx/d) * 0.5 * chaseScale;
        b.vy += (dy/d) * 0.5 * chaseScale;
      }
      
      // Eat
      if (d < b.r + f.r) {
        let fIndex = food.indexOf(f);
        if (fIndex > -1) {
          food.splice(fIndex, 1);
          birthBlob(b); // Spawn 4th cell
          rewardHunterSuccess(b);
          
          // Release all hunters for this food
          for (let h of f.hunters) {
            // Check if h is still in blobs array (might have died)
            if (blobs.includes(h)) {
              h.huntingFood = null;
            }
          }
        }
      }
    }
  }
}

function draw() {
  updateGameLogic();

  // --- Physics Update ---
  
  // 0. Apply Repulsion (keep them apart so they don't smoosh)
  for (let i = 0; i < blobs.length; i++) {
    for (let j = i + 1; j < blobs.length; j++) {
      let a = blobs[i];
      let b = blobs[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d = sqrt(dx * dx + dy * dy);
      let minDist = (a.r + b.r) * 0.85; // Keep them apart

      if (d < minDist && d > 0) {
        let force = (minDist - d) * 0.02; 
        let fx = (dx / d) * force;
        let fy = (dy / d) * force;
        
        if (a !== draggedBlob) {
          a.vx -= fx;
          a.vy -= fy;
        }
        if (b !== draggedBlob) {
          b.vx += fx;
          b.vy += fy;
        }
      }
    }
  }

  // 1. Apply Spring Forces
  for (let i = springs.length - 1; i >= 0; i--) {
    let s = springs[i];
    let a = s.a;
    let b = s.b;

    if (s.decayFrame && frameCount > s.decayFrame) {
      springs.splice(i, 1);
      continue;
    }
    
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let d = sqrt(dx * dx + dy * dy);

    // Break connection if stretched too far (e.g. by dragging)
    if (d > (a.r + b.r) * 2.0) {
      springs.splice(i, 1);
      continue;
    }
    
    if (d === 0) continue;

    // Hooke's Law: F = k * (current_distance - rest_length)
    // k = 0.005 (very gentle spring)
    let force = (d - s.len) * 0.005; 
    
    let fx = (dx / d) * force;
    let fy = (dy / d) * force;

    if (a !== draggedBlob) {
      a.vx += fx;
      a.vy += fy;
    }
    if (b !== draggedBlob) {
      b.vx -= fx;
      b.vy -= fy;
    }
  }

  // 2. Check for new connections
  for (let i = 0; i < blobs.length; i++) {
    for (let j = i + 1; j < blobs.length; j++) {
      let a = blobs[i];
      let b = blobs[j];
      
      // Check if already connected
      let connected = false;
      for (let s of springs) {
        if ((s.a === a && s.b === b) || (s.a === b && s.b === a)) {
          connected = true;
          break;
        }
      }
      if (connected) continue;

      let d = dist(a.x, a.y, b.x, b.y);
      // If they are close enough to start merging visually, connect them
      let mergeThreshold = (a.r + b.r); 
      
      if (d < mergeThreshold) {
        const mergeSpring = {
          a: a,
          b: b,
          len: (a.r + b.r) * 0.6 // Rest length: pull them into a nice cluster
        };
        springs.push(mergeSpring);
        handleSpeciesMerge(a, b, mergeSpring);
      }
    }
  }

  // 3. Update positions
  for (let b of blobs) {
    if (b !== draggedBlob) {
      // Add gentle noise to keep them drifting like living things
      const driftScale = blobMotionScale(b);
      b.vx += random(-0.1, 0.1) * driftScale;
      b.vy += random(-0.1, 0.1) * driftScale;

      // Apply damping (friction)
      const damping = blobDampingFactor(b);
      b.vx *= damping;
      b.vy *= damping;

      let speed = sqrt(b.vx * b.vx + b.vy * b.vy);
      const speedLimit = blobMaxSpeed(b);
      if (speed > speedLimit) {
        let limit = speedLimit / speed;
        b.vx *= limit;
        b.vy *= limit;
      }

      // Soft boundary repulsion to keep them away from edges
      let margin = 100 * scaleFactor;
      let nudge = 0.2 * scaleFactor * driftScale;
      if (b.x < margin) b.vx += nudge;
      if (b.x > width - margin) b.vx -= nudge;
      if (b.y < margin) b.vy += nudge;
      if (b.y > height - margin) b.vy -= nudge;

      b.x += b.vx;
      b.y += b.vy;
      
      // Bounce off walls
      if (b.x < 0) { b.x = 0; b.vx *= -1; }
      if (b.x > width) { b.x = width; b.vx *= -1; }
      if (b.y < 0) { b.y = 0; b.vy *= -1; }
      if (b.y > height) { b.y = height; b.vy *= -1; }
    }
  }

  updateFoodLogic();

  // --- Rendering ---
  
  // Prepare uniform data
  let blobData = [];
  let colorData = [];
  for (let i = 0; i < MAX_BLOBS; i++) {
    if (i < blobs.length) {
      let b = blobs[i];
      blobData.push(b.x);
      blobData.push(b.y);
      blobData.push(b.r);

      const col = b.speciesColor || [1, 1, 1];
      colorData.push(col[0]);
      colorData.push(col[1]);
      colorData.push(col[2]);
    } else {
      // Pad with zeros
      blobData.push(0);
      blobData.push(0);
      blobData.push(0);

      colorData.push(0);
      colorData.push(0);
      colorData.push(0);
    }
  }

  shaderLayer.shader(metaballShader);
  // Pass the FULL screen resolution so the math remains correct
  metaballShader.setUniform('u_resolution', [width, height]);
  metaballShader.setUniform('u_time', millis() / 1000.0);
  metaballShader.setUniform('u_blobs', blobData);
  metaballShader.setUniform('u_blobColors', colorData);
  
  // Draw a plane covering the whole shader layer
  shaderLayer.noStroke();
  shaderLayer.plane(shaderLayer.width, shaderLayer.height);
  
  // Draw the shader output to the main canvas, scaled up
  // In WEBGL mode, (0,0) is center. We draw the image centered.
  image(shaderLayer, -width/2, -height/2, width, height);
  
  // Draw connections
  // Translate to top-left coordinate system for easier drawing
  push();
  translate(-width/2, -height/2);
  
  if (!autoPlay) {
    stroke(0, 50); // Faint black line
    strokeWeight(1);
    for (let s of springs) {
      line(s.a.x, s.a.y, s.b.x, s.b.y);
    }
  }

  // Draw food
  for (let f of food) {
    fill(255, 100, 100); // Reddish color for food
    noStroke();
    circle(f.x, f.y, f.r * 2);
  }

  // Draw nuclei tinted by species
  noStroke();
  for (let b of blobs) {
    const col = b.speciesColor || [0, 0, 0];
    fill(col[0] * 255, col[1] * 255, col[2] * 255, 220);
    circle(b.x, b.y, b.r * 0.25);
  }
  
  pop();
}

function mousePressed() {
  // Check for double tap
  let currentTime = millis();
  let isDoubleTap = (currentTime - lastClickTime < 300);
  lastClickTime = currentTime;

  let clickedBlob = false;

  // Mouse coordinates in WEBGL mode are relative to center if we don't adjust.
  // But p5.js mouseX/mouseY are always relative to top-left of canvas.
  // Since our blobs use 0..width/height, we can use mouseX/mouseY directly.
  for (let b of blobs) {
    let d = dist(mouseX, mouseY, b.x, b.y);
    if (d < b.r) {
      clickedBlob = true;
      if (keyIsDown(CONTROL) || isDoubleTap) {
        killBlob(b);
      } else {
        draggedBlob = b;
        // Stop movement while dragging
        b.vx = 0;
        b.vy = 0;
      }
      break;
    }
  }

  if (!clickedBlob) {
    spawnFood(mouseX, mouseY);
  }
}

function mouseDragged() {
  if (draggedBlob) {
    draggedBlob.x = mouseX;
    draggedBlob.y = mouseY;
  }
}

function mouseReleased() {
  if (draggedBlob) {
    // Give it a little toss, but scaled down for the gentle physics
    const releaseScale = blobMotionScale(draggedBlob);
    draggedBlob.vx = (mouseX - pmouseX) * 0.2 * releaseScale;
    draggedBlob.vy = (mouseY - pmouseY) * 0.2 * releaseScale;
    draggedBlob = null;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateViewFlags();
  scaleFactor = min(width, height) / 800;
  
  // Recreate the shader layer with new dimensions
  shaderLayer = createGraphics(ceil(width * shaderRes), ceil(height * shaderRes), WEBGL);
}

// --- Splitting Logic ---

function checkSplitting(neighbors) {
  let visited = new Set();
  
  for (let b of blobs) {
    if (!visited.has(b)) {
      let cluster = [];
      let q = [b];
      visited.add(b);
      while (q.length > 0) {
        let curr = q.pop();
        cluster.push(curr);
        let myNeighbors = neighbors.get(curr) || [];
        for (let n of myNeighbors) {
          if (!visited.has(n)) {
            visited.add(n);
            q.push(n);
          }
        }
      }
      
      if (cluster.length >= 10) {
        splitCluster(cluster);
      }
    }
  }
}

function splitCluster(cluster) {
  // Calculate center of mass
  let avgX = 0, avgY = 0;
  for (let b of cluster) {
    avgX += b.x;
    avgY += b.y;
  }
  avgX /= cluster.length;
  avgY /= cluster.length;

  // Determine split axis (horizontal or vertical based on spread)
  let varX = 0, varY = 0;
  for (let b of cluster) {
    varX += (b.x - avgX) ** 2;
    varY += (b.y - avgY) ** 2;
  }

  let groupA = [];
  let groupB = [];

  const speciesPartition = partitionClusterBySpecies(cluster);
  if (speciesPartition) {
    groupA = speciesPartition[0];
    groupB = speciesPartition[1];
  } else {
    // Sort and split by axis if species partition failed
    if (varX > varY) {
      cluster.sort((a, b) => a.x - b.x);
    } else {
      cluster.sort((a, b) => a.y - b.y);
    }
    let mid = Math.floor(cluster.length / 2);
    groupA = cluster.slice(0, mid);
    groupB = cluster.slice(mid);
  }

  // Remove springs between groups
  for (let i = springs.length - 1; i >= 0; i--) {
    let s = springs[i];
    let aInA = groupA.includes(s.a);
    let bInA = groupA.includes(s.b);
    let aInB = groupB.includes(s.a);
    let bInB = groupB.includes(s.b);

    // If one is in A and other in B, cut it
    if ((aInA && bInB) || (aInB && bInA)) {
      springs.splice(i, 1);
    }
  }

  // Apply separation force
  // Direction: along the split axis
  let dirX = 0, dirY = 0;
  if (varX > varY) {
    dirX = 1; 
  } else {
    dirY = 1;
  }

  let baseForce = 5.0 * scaleFactor;
  for (let b of groupA) {
    const bias = b?.traits?.splitBias === 'aggressive' ? 1.3 : (b?.traits?.splitBias === 'cohesive' ? 0.8 : 1.0);
    const impulse = baseForce * blobMotionScale(b) * bias;
    b.vx -= dirX * impulse;
    b.vy -= dirY * impulse;
  }
  for (let b of groupB) {
    const bias = b?.traits?.splitBias === 'aggressive' ? 1.3 : (b?.traits?.splitBias === 'cohesive' ? 0.8 : 1.0);
    const impulse = baseForce * blobMotionScale(b) * bias;
    b.vx += dirX * impulse;
    b.vy += dirY * impulse;
  }
}

function partitionClusterBySpecies(cluster) {
  let buckets = new Map();
  for (let b of cluster) {
    if (!buckets.has(b.species)) {
      buckets.set(b.species, []);
    }
    buckets.get(b.species).push(b);
  }
  if (buckets.size <= 1) return null;

  let groupA = [];
  let groupB = [];
  for (let members of buckets.values()) {
    let target;
    let bias = members[0]?.traits?.splitBias || 'balanced';
    if (bias === 'aggressive') {
      target = groupA.length <= groupB.length ? groupA : groupB;
    } else if (bias === 'cohesive') {
      target = groupA.length >= groupB.length ? groupA : groupB;
    } else {
      target = groupA.length <= groupB.length ? groupA : groupB;
    }
    for (let m of members) target.push(m);
  }

  if (groupA.length === 0 || groupB.length === 0) return null;
  return [groupA, groupB];
}

function enforceHunterDiversity(hunters, pool) {
  const hunterCount = hunters.filter(h => isRole(h, 'hunter')).length;
  if (hunterCount === 0) {
    let candidate = pool.find(b => isRole(b, 'hunter') && !hunters.includes(b));
    if (candidate) {
      hunters[hunters.length - 1] = candidate;
    }
  } else if (hunterCount === 1) {
    let candidate = pool.find(b => isRole(b, 'hunter') && !hunters.includes(b));
    if (candidate) {
      let replaceIndex = hunters.findIndex(h => !isRole(h, 'hunter'));
      if (replaceIndex === -1) replaceIndex = hunters.length - 1;
      hunters[replaceIndex] = candidate;
    }
  }
  return hunters;
}

function isHostilePair(a, b) {
  const hostileA = a?.traits?.hostileWith || [];
  const hostileB = b?.traits?.hostileWith || [];
  return hostileA.includes(b?.species) || hostileB.includes(a?.species);
}

function handleSpeciesMerge(a, b, spring) {
  if (!spring || !a || !b) return;
  if (a.species === b.species) return;

  if (isHostilePair(a, b)) {
    spring.decayFrame = frameCount + 240 + random(-60, 60);
    return;
  }

  const specA = a.traits;
  const specB = b.traits;

  if (!specA || !specB) return;

  if (specA.mediator || specB.mediator) {
    resolveMediatorMerge(a, b, spring);
    return;
  }

  if (specA.dominance === specB.dominance) {
    spring.len *= 0.98;
    return;
  }

  const dominantBlob = specA.dominance > specB.dominance ? a : b;
  const submissiveBlob = dominantBlob === a ? b : a;

  if (submissiveBlob?.traits?.role === 'anchor') {
    spring.len *= 1.05;
    return;
  }

  if (!tryConvertBlob(submissiveBlob, dominantBlob.species)) {
    spring.len *= 1.05;
    return;
  }
  dominantBlob.r = min(dominantBlob.r * 1.02, 120 * scaleFactor);
  spring.len *= dominantBlob?.traits?.role === 'anchor' ? 0.9 : 1.0;
}

function resolveMediatorMerge(a, b, spring) {
  const mediator = a.traits?.mediator ? a : b;
  const partner = mediator === a ? b : a;
  const mediatorDom = mediator.traits?.dominance || 0;
  const partnerDom = partner.traits?.dominance || 0;

  let convertPartnerChance = mediatorDom >= partnerDom ? 0.35 : 0.2;
  if (partner.traits?.role === 'hunter') convertPartnerChance += 0.05;
  convertPartnerChance = constrain(convertPartnerChance, 0.1, 0.45);

  if (random() < convertPartnerChance) {
    if (tryConvertBlob(partner, mediator.species)) {
      spring.len *= 0.92;
      return;
    }
  }

  let convertMediatorChance = 0.25;
  if (partner.traits?.role === 'anchor') convertMediatorChance += 0.15;
  if (random() < convertMediatorChance) {
    if (tryConvertBlob(mediator, partner.species)) {
      spring.len *= 0.96;
      return;
    }
  }

  if (partner.traits?.role === 'hunter' && random() < 0.25) {
    tryConvertBlob(partner, 'warden');
  }

  spring.decayFrame = frameCount + 360 + random(-90, 90);
}

function ensureSpeciesBalance() {
  if (blobs.length < 4) return;
  const counts = getSpeciesCounts();
  const total = blobs.length;
  const deficits = SPECIES_DEFS.filter(spec => (counts[spec.key] || 0) / total < spec.minShare);
  if (deficits.length === 0) return;

  const surpluses = SPECIES_DEFS
    .filter(spec => (counts[spec.key] || 0) / total > spec.minShare + 0.12)
    .sort((a, b) => (counts[b.key] || 0) - (counts[a.key] || 0));

  if (surpluses.length === 0) return;

  for (let deficit of deficits) {
    let donor = surpluses.find(spec => (counts[spec.key] || 0) > counts[deficit.key]);
    if (!donor) donor = surpluses[0];
    if (!donor) break;
    const conversions = Math.min(2, Math.ceil((counts[donor.key] - counts[deficit.key]) / 4));
    for (let i = 0; i < conversions; i++) {
      convertRandomBlobTo(deficit.key, b => b.species === donor.key);
    }
  }
}

function getSpeciesCounts() {
  const counts = {};
  for (let spec of SPECIES_DEFS) counts[spec.key] = 0;
  for (let b of blobs) counts[b.species] = (counts[b.species] || 0) + 1;
  return counts;
}

function convertRandomBlobTo(targetSpecies, predicate) {
  const candidates = blobs.filter(predicate);
  if (candidates.length === 0) return;
  for (let i = 0; i < 5; i++) {
    const blob = random(candidates);
    if (tryConvertBlob(blob, targetSpecies)) {
      blob.vx *= 0.45;
      blob.vy *= 0.45;
      return;
    }
  }
}
