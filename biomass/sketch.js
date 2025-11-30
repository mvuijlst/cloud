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

let shaderRes = DESKTOP_SHADER_RES;
let lastClickTime = 0;
let autoPlay = true;
let food = [];
let scaleFactor = 1;
let mobileView = false;
let motionScale = DESKTOP_MOTION_SCALE;
let velocityDamping = DESKTOP_DAMPING;
let maxSpeed = DESKTOP_MAX_SPEED;

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

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  updateViewFlags();
  
  // Calculate scale factor based on screen size (reference: 1280px)
  scaleFactor = min(width, height) / 1280;
  
  // Create a WEBGL buffer for the shader to manage GPU load
  shaderLayer = createGraphics(ceil(width * shaderRes), ceil(height * shaderRes), WEBGL);
  
  // Initialize blobs
  for (let i = 0; i < 10; i++) {
    blobs.push({
      x: random(width),
      y: random(height),
      r: random(40, 80) * scaleFactor, // Radius of influence
      vx: random(-1, 1),
      vy: random(-1, 1)
    });
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
             b.vx += (dx/d) * 0.3 * motionScale;
             b.vy += (dy/d) * 0.3 * motionScale;
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
          b.vx += (dx / d) * 0.8 * motionScale;
          b.vy += (dy / d) * 0.8 * motionScale;
        } else {
          b.vx += random(-1, 1) * motionScale;
          b.vy += random(-1, 1) * motionScale;
        }
      }
    }

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
  let newBlob = {
    x: parent.x + cos(angle) * dist,
    y: parent.y + sin(angle) * dist,
    r: newR,
    vx: 0, vy: 0
  };
  
  // Keep inside bounds
  newBlob.x = constrain(newBlob.x, 0, width);
  newBlob.y = constrain(newBlob.y, 0, height);

  blobs.push(newBlob);
  
  // Connect to parent
  springs.push({ 
    a: parent, 
    b: newBlob, 
    len: (parent.r + newBlob.r) * 0.85 
  });
  
  // Shrink parent back to normal
  parent.r = 60 * scaleFactor;
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
        springs.push({ a: a, b: b, len: (a.r + b.r) * 0.85 });
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
        b.vx += (dx/d) * 0.5 * motionScale;
        b.vy += (dy/d) * 0.5 * motionScale;
      }
      
      // Eat
      if (d < b.r + f.r) {
        let fIndex = food.indexOf(f);
        if (fIndex > -1) {
          food.splice(fIndex, 1);
          birthBlob(b); // Spawn 4th cell
          
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
        springs.push({
          a: a,
          b: b,
          len: (a.r + b.r) * 0.6 // Rest length: pull them into a nice cluster
        });
      }
    }
  }

  // 3. Update positions
  for (let b of blobs) {
    if (b !== draggedBlob) {
      // Add gentle noise to keep them drifting like living things
      b.vx += random(-0.1, 0.1) * motionScale;
      b.vy += random(-0.1, 0.1) * motionScale;

      // Apply damping (friction)
      b.vx *= velocityDamping;
      b.vy *= velocityDamping;

      let speed = sqrt(b.vx * b.vx + b.vy * b.vy);
      if (speed > maxSpeed) {
        let limit = maxSpeed / speed;
        b.vx *= limit;
        b.vy *= limit;
      }

      // Soft boundary repulsion to keep them away from edges
      let margin = 100 * scaleFactor;
      let nudge = 0.2 * scaleFactor * motionScale;
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
  for (let i = 0; i < MAX_BLOBS; i++) {
    if (i < blobs.length) {
      let b = blobs[i];
      blobData.push(b.x);
      blobData.push(b.y);
      blobData.push(b.r);
    } else {
      // Pad with zeros
      blobData.push(0);
      blobData.push(0);
      blobData.push(0);
    }
  }

  shaderLayer.shader(metaballShader);
  // Pass the FULL screen resolution so the math remains correct
  metaballShader.setUniform('u_resolution', [width, height]);
  metaballShader.setUniform('u_time', millis() / 1000.0);
  metaballShader.setUniform('u_blobs', blobData);
  
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

  // Draw nuclei
  fill(0, 200);
  noStroke();
  for (let b of blobs) {
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
    draggedBlob.vx = (mouseX - pmouseX) * 0.2 * motionScale;
    draggedBlob.vy = (mouseY - pmouseY) * 0.2 * motionScale;
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
  
  // Sort and split
  if (varX > varY) {
    cluster.sort((a, b) => a.x - b.x);
  } else {
    cluster.sort((a, b) => a.y - b.y);
  }
  
  let mid = Math.floor(cluster.length / 2);
  groupA = cluster.slice(0, mid);
  groupB = cluster.slice(mid);

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

  let force = 5.0 * scaleFactor * motionScale; // Scale push for smoother mobile splits
  for (let b of groupA) {
    b.vx -= dirX * force;
    b.vy -= dirY * force;
  }
  for (let b of groupB) {
    b.vx += dirX * force;
    b.vy += dirY * force;
  }
}
