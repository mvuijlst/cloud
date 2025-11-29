const cols = 84;
let rows = 48;
const pixelWidth = 7;
const pixelHeight = 9;
const spacing = 1;

let grid = [];
let activeColor;
let inactiveColor;
let shadowColor;

let isLargeMode = false;
const sizeButtonX = 66;

let score = 0;
const digitPatterns = [
  [1,1,1,1,0,1,1,0,1,1,0,1,1,1,1], // 0
  [0,1,0,1,1,0,0,1,0,0,1,0,0,1,0], // 1
  [1,1,1,0,0,1,1,1,1,1,0,0,1,1,1], // 2
  [1,1,1,0,0,1,1,1,1,0,0,1,1,1,1], // 3
  [1,0,1,1,0,1,1,1,1,0,0,1,0,0,1], // 4
  [1,1,1,1,0,0,1,1,1,0,0,1,1,1,1], // 5
  [1,1,1,1,0,0,1,1,1,1,0,1,1,1,1], // 6
  [1,1,1,0,0,1,0,1,0,0,1,0,0,1,0], // 7
  [1,1,1,1,0,1,1,1,1,1,0,1,1,1,1], // 8
  [1,1,1,1,0,1,1,1,1,0,0,1,1,1,1], // 9
  [0,0,0,0,1,0,0,0,0,0,1,0,0,0,0]  // :
];

// Game constants
const gameOffsetX = 2;
const gameOffsetY = 10;
const tileWidth = 4;
const tileHeight = 4;
const tilesX = 20;
let tilesY = 9;

let snake = [];
let food = null;
let dummyTarget = null;
let lastDummyChange = 0;
let eatSounds = [];
let explosionSound;
let isGameOver = false;
let gameOverTime = 0;
let gameStartTime = 0;
let foodSpawnTime = 0;

let autoFoodEnabled = false;
let nextFoodTime = 0;
const buttonPatterns = {
  off: [
    1,1,0,0,0,1,1,
    1,0,0,1,0,0,1,
    1,0,1,0,1,0,1,
    1,0,0,1,0,0,1,
    1,1,0,0,0,1,1
  ],
  on: [
    1,1,0,0,0,1,1,
    1,0,0,0,0,0,1,
    1,0,0,1,0,0,1,
    1,0,0,0,0,0,1,
    1,1,0,0,0,1,1
  ],
  small: [
    1,1,0,0,0,1,1,
    1,0,0,1,0,0,1,
    1,0,1,1,1,0,1,
    1,0,0,1,0,0,1,
    1,1,0,0,0,1,1
  ],
  large: [
    1,1,0,0,0,1,1,
    1,0,0,0,0,0,1,
    1,0,1,1,1,0,1,
    1,0,0,0,0,0,1,
    1,1,0,0,0,1,1
  ]
};
const buttonX = 76;
const buttonY = 0;
const buttonW = 7;
const buttonH = 5;

const snakePatterns = {
  bodyH: [0,0,0,0, 1,1,1,1, 1,1,1,1, 0,0,0,0],
  bodyV: [0,1,1,0, 0,1,1,0, 0,1,1,0, 0,1,1,0],
  corners: {
    topLeft: [0,0,0,0, 0,0,1,1, 0,1,1,1, 0,1,1,0],
    topRight: [0,0,0,0, 1,1,0,0, 1,1,1,0, 0,1,1,0],
    bottomLeft: [0,1,1,0, 0,1,1,1, 0,0,1,1, 0,0,0,0],
    bottomRight: [0,1,1,0, 1,1,1,0, 1,1,0,0, 0,0,0,0]
  },
  head: {
    up: [0,0,0,0, 0,1,1,0, 0,1,1,0, 1,0,1,0],
    down: [1,0,1,0, 0,1,1,0, 0,1,1,0, 0,0,0,0],
    left: [0,0,0,1, 0,1,1,0, 0,1,1,1, 0,0,0,0],
    right: [1,0,0,0, 0,1,1,0, 1,1,1,0, 0,0,0,0]
  },
  headOpen: {
    up: [0,0,0,0, 1,0,0,1, 0,1,1,0, 1,0,1,0],
    down: [1,0,1,0, 0,1,1,0, 1,0,0,1, 0,0,0,0],
    left: [0,1,0,1, 0,0,1,0, 0,0,1,1, 0,1,0,0],
    right: [1,0,1,0, 0,1,0,0, 1,1,0,0, 0,1,0,0]
  },
  tail: {
    up: [0,1,1,0, 0,1,1,0, 0,0,1,0, 0,0,1,0],
    down: [0,0,1,0, 0,0,1,0, 0,1,1,0, 0,1,1,0],
    left: [0,0,0,0, 1,1,0,0, 1,1,1,1, 0,0,0,0],
    right: [0,0,0,0, 0,0,1,1, 1,1,1,1, 0,0,0,0]
  },
  food: [0,1,0,0, 1,0,1,0, 0,1,0,0, 0,0,0,0]
};

function preload() {
  eatSounds.push(loadSound('sound/106392__j1987__carrotnom.wav'));
  eatSounds.push(loadSound('sound/348112__lilmati__crunch.wav'));
  eatSounds.push(loadSound('sound/682095__henkonen__bite-2.wav'));
  explosionSound = loadSound('sound/explosion.wav');
}

function calculateGrid() {
  // Calculate available space inside the container
  // We want to target 90% of the viewport, minus padding
  // Horizontal padding: 20+20 = 40px
  // Vertical padding: 30+20 = 50px
  
  let availableWidth = (window.innerWidth * 0.9) - 40;
  let availableHeight = (window.innerHeight * 0.9) - 50;
  
  // Safety clamp
  if (availableWidth < 100) availableWidth = 100;
  if (availableHeight < 100) availableHeight = 100;

  if (isLargeMode) {
    // In Large Mode, we want to fill the available height with as many tiles as possible
    // while maintaining the width constraint.
    
    // 1. Calculate the scale if we were to fit the width exactly
    // nativeWidth = cols * pixelWidth
    // scale = availableWidth / nativeWidth
    let scale = availableWidth / (cols * pixelWidth);
    
    // 2. Calculate how many native pixels height fits in availableHeight at this scale
    // availableHeight = nativeHeight * scale
    // nativeHeight = availableHeight / scale
    let maxNativeHeight = availableHeight / scale;
    
    // 3. Convert to rows
    let maxGridRows = floor(maxNativeHeight / pixelHeight);
    
    // 4. Calculate tilesY
    let possibleTilesY = floor((maxGridRows - gameOffsetY - 2) / tileHeight);
    tilesY = max(9, possibleTilesY); // At least 9
  } else {
    tilesY = 9;
  }
  
  rows = gameOffsetY + (tilesY * tileHeight) + 2;
}

function styleCanvas() {
  let availableWidth = (window.innerWidth * 0.9) - 40;
  let availableHeight = (window.innerHeight * 0.9) - 50;
  
  if (availableWidth < 100) availableWidth = 100;
  if (availableHeight < 100) availableHeight = 100;

  let nativeW = cols * pixelWidth;
  let nativeH = rows * pixelHeight;
  
  // Fit nativeW/nativeH into availableWidth/availableHeight (Contain)
  let scale = Math.min(availableWidth / nativeW, availableHeight / nativeH);
  
  let cssW = floor(nativeW * scale);
  let cssH = floor(nativeH * scale);
  
  // Apply to canvas element
  let cnv = select('canvas');
  if (cnv) {
    cnv.style('width', cssW + 'px');
    cnv.style('height', cssH + 'px');
  }
}

function toggleSize() {
  isLargeMode = !isLargeMode;
  localStorage.setItem('snake_isLargeMode', isLargeMode);
  calculateGrid();
  resizeCanvas(cols * pixelWidth, rows * pixelHeight);
  styleCanvas();
  clearGrid();
  initGame();
}

function setup() {
  if (localStorage.getItem('snake_isLargeMode') === 'true') {
    isLargeMode = true;
  }
  calculateGrid();
  let cnv = createCanvas(cols * pixelWidth, rows * pixelHeight);
  cnv.parent('game-container');
  styleCanvas();
  noStroke();
  frameRate(10);

  activeColor = color('#262819');
  inactiveColor = color('#6F9562'); // Slightly darker than background
  shadowColor = color('#262819');
  shadowColor.setAlpha(60); // Transparent shadow
  
  clearGrid();
  initGame();
}

function initGame() {
  snake = [{x: 5, y: 4}, {x: 4, y: 4}, {x: 3, y: 4}];
  score = 0;
  food = null;
  dummyTarget = null;
  lastDummyChange = millis();
  isGameOver = false;
  gameStartTime = millis();
  foodSpawnTime = 0;
  setNextFoodTime();
}

function setNextFoodTime() {
  nextFoodTime = millis() + random(1000, 1100);
}

function draw() {
  if (isGameOver) {
    if (millis() - gameOverTime > 3000) {
      initGame();
    }
  } else {
    updateGame();
  }
  
  clearGrid();
  drawScore();
  drawTime();
  drawUI();
  drawGame();
  drawScreen();
}

function mousePressed() {
  let vx = floor(mouseX / pixelWidth);
  let vy = floor(mouseY / pixelHeight);
  
  if (vx >= buttonX && vx < buttonX + buttonW && vy >= buttonY && vy < buttonY + buttonH) {
    autoFoodEnabled = !autoFoodEnabled;
    if (autoFoodEnabled) {
      setNextFoodTime();
    }
    return;
  }

  if (vx >= sizeButtonX && vx < sizeButtonX + buttonW && vy >= buttonY && vy < buttonY + buttonH) {
    toggleSize();
    return;
  }
  
  let gx = floor((vx - gameOffsetX) / tileWidth);
  let gy = floor((vy - gameOffsetY) / tileHeight);
  
  if (gx >= 0 && gx < tilesX && gy >= 0 && gy < tilesY) {
    // Place food if not on snake
    let onSnake = false;
    for (let segment of snake) {
      if (segment.x === gx && segment.y === gy) {
        onSnake = true;
        break;
      }
    }
    
    if (!onSnake) {
      food = {x: gx, y: gy};
      foodSpawnTime = millis();
      dummyTarget = null;
      setNextFoodTime();
    }
  }
}

function touchStarted() {
  mousePressed();
  return false;
}

function isPathSafe(path, startSnake) {
  let virtualSnake = [...startSnake];
  
  for (let i = 0; i < path.length; i++) {
    let nextPos = path[i];
    virtualSnake.unshift(nextPos);
    
    if (food && nextPos.x === food.x && nextPos.y === food.y) {
       // Grow
    } else {
       virtualSnake.pop();
    }
  }
  
  let vHead = virtualSnake[0];
  let vTail = virtualSnake[virtualSnake.length - 1];
  
  return findPath(vHead, vTail, virtualSnake) !== null;
}

function evaluateMove(move, currentSnake, target) {
  // Simulate one step
  let virtualSnake = [...currentSnake];
  virtualSnake.unshift(move);
  
  if (food && move.x === food.x && move.y === food.y) {
    // Ate food, so we don't pop (grow)
  } else {
    virtualSnake.pop();
  }

  let newHead = virtualSnake[0];
  let newTail = virtualSnake[virtualSnake.length - 1];

  // 1. Connectivity to tail
  // Check if path exists from newHead to newTail
  let pathToTail = findPath(newHead, newTail, virtualSnake);
  let isSafeToTail = (pathToTail !== null);

  // 2. Reachability and distance to food
  let foodReachable = false;
  let distToFood = Infinity;
  if (target) {
      let pathToFood = findPath(newHead, target, virtualSnake);
      if (pathToFood !== null) {
          if (isPathSafe(pathToFood, virtualSnake)) {
            foodReachable = true;
            distToFood = pathToFood.length;
          }
      }
  }

  // 3. Free-space heuristic
  let reachableArea = countReachable(newHead, virtualSnake);

  return {
    move: move,
    isSafeToTail: isSafeToTail,
    foodReachable: foodReachable,
    distToFood: distToFood,
    reachableArea: reachableArea
  };
}

function updateGame() {
  let head = snake[0];
  
  // Determine current direction
  let currentDir = null;
  if (snake.length > 1) {
    currentDir = { x: head.x - snake[1].x, y: head.y - snake[1].y };
  }
  
  if (autoFoodEnabled && !food && millis() > nextFoodTime) {
    let newFood = getRandomReachableTile();
    if (newFood) {
      food = newFood;
      foodSpawnTime = millis();
      dummyTarget = null;
      setNextFoodTime();
    }
  }

  if (food && millis() - foodSpawnTime > 20000) {
    isGameOver = true;
    gameOverTime = millis();
    explosionSound.play();
    return;
  }

  let target = food;

  if (!target) {
    if (!dummyTarget || (head.x === dummyTarget.x && head.y === dummyTarget.y) || (millis() - lastDummyChange > 4000)) {
       dummyTarget = getRandomReachableTile();
       lastDummyChange = millis();
    }
    target = dummyTarget;
  }
  
  let neighbors = getNeighbors(head);
  let candidates = [];

  for (let move of neighbors) {
    if (isValidMove(move, snake)) {
      let evaluation = evaluateMove(move, snake, target);
      candidates.push(evaluation);
    }
  }

  let bestMove = null;

  // Sort function helper
  const sortMoves = (moves, criteria) => {
    moves.sort((a, b) => {
      // Primary criteria
      if (criteria === 'p1') {
        // Minimize distToFood
        if (a.distToFood !== b.distToFood) return a.distToFood - b.distToFood;
      } else if (criteria === 'p2') {
        // Maximize reachableArea
        if (a.reachableArea !== b.reachableArea) return b.reachableArea - a.reachableArea;
        // Secondary: minimize distToFood
        if (a.distToFood !== b.distToFood) return a.distToFood - b.distToFood;
      } else if (criteria === 'p3') {
        // Maximize reachableArea
        if (a.reachableArea !== b.reachableArea) return b.reachableArea - a.reachableArea;
      }

      // Tie-breaking: Prefer current direction
      if (currentDir) {
        let dirA = { x: a.move.x - head.x, y: a.move.y - head.y };
        let dirB = { x: b.move.x - head.x, y: b.move.y - head.y };
        let sameDirA = (dirA.x === currentDir.x && dirA.y === currentDir.y);
        let sameDirB = (dirB.x === currentDir.x && dirB.y === currentDir.y);
        if (sameDirA && !sameDirB) return -1;
        if (!sameDirA && sameDirB) return 1;
      }
      
      return 0;
    });
  };

  // Priority 1: Safe to tail && Food reachable. Minimize dist to food.
  let p1Moves = candidates.filter(c => c.isSafeToTail && c.foodReachable);
  if (p1Moves.length > 0) {
    sortMoves(p1Moves, 'p1');
    bestMove = p1Moves[0].move;
  }

  // Priority 2: Safe to tail. Maximize reachable area.
  if (!bestMove) {
    let p2Moves = candidates.filter(c => c.isSafeToTail);
    if (p2Moves.length > 0) {
      sortMoves(p2Moves, 'p2');
      bestMove = p2Moves[0].move;
    }
  }

  // Priority 3: Maximize reachable area.
  if (!bestMove && candidates.length > 0) {
    sortMoves(candidates, 'p3');
    bestMove = candidates[0].move;
  }

  if (!bestMove) {
    // Force a move to simulate crash
    if (currentDir) {
      bestMove = {x: head.x + currentDir.x, y: head.y + currentDir.y};
    } else {
      bestMove = neighbors[0];
    }
  }

  // Move snake
  snake.unshift(bestMove);
  
  // Check for crash
  let crashed = false;
  if (bestMove.x < 0 || bestMove.x >= tilesX || bestMove.y < 0 || bestMove.y >= tilesY) {
    crashed = true;
  } else {
    // Check collision with body (excluding tail, as it would move away if we didn't crash)
    // But since we are here because no valid moves existed, we know we aren't moving into the tail.
    for (let i = 1; i < snake.length - 1; i++) {
      if (bestMove.x === snake[i].x && bestMove.y === snake[i].y) {
        crashed = true;
        break;
      }
    }
  }

  if (crashed) {
    isGameOver = true;
    gameOverTime = millis();
    explosionSound.play();
    return;
  }
    
  // Check if ate food
  if (food && bestMove.x === food.x && bestMove.y === food.y) {
    score++;
    food = null;
    dummyTarget = null;
    random(eatSounds).play();
    setNextFoodTime();
  } else {
    snake.pop();
    // Check if reached dummy target
    if (dummyTarget && bestMove.x === dummyTarget.x && bestMove.y === dummyTarget.y) {
        dummyTarget = null;
    }
  }
}

function getRandomReachableTile() {
  let head = snake[0];
  let reachable = [];
  let queue = [head];
  let visited = new Set();
  
  // Mark snake as obstacles
  for (let s of snake) {
    visited.add(s.x + "," + s.y);
  }

  while (queue.length > 0) {
    let current = queue.shift();
    let neighbors = getNeighbors(current);
    
    for (let n of neighbors) {
      if (n.x >= 0 && n.x < tilesX && n.y >= 0 && n.y < tilesY) {
        let key = n.x + "," + n.y;
        if (!visited.has(key)) {
          visited.add(key);
          queue.push(n);
          reachable.push(n);
        }
      }
    }
  }
  
  if (reachable.length > 0) {
    return random(reachable);
  }
  return null;
}

function countReachable(start, currentSnake) {
  let queue = [start];
  let visited = new Set();
  visited.add(start.x + "," + start.y);
  
  // Mark snake as obstacles
  for (let i = 0; i < currentSnake.length - 1; i++) {
    visited.add(currentSnake[i].x + "," + currentSnake[i].y);
  }
  
  let count = 0;
  while (queue.length > 0) {
    let current = queue.shift();
    count++;
    
    let neighbors = getNeighbors(current);
    for (let n of neighbors) {
      if (n.x >= 0 && n.x < tilesX && n.y >= 0 && n.y < tilesY && 
          !visited.has(n.x + "," + n.y)) {
        visited.add(n.x + "," + n.y);
        queue.push(n);
      }
    }
  }
  return count;
}

function isValidMove(pos, currentSnake) {
  if (pos.x < 0 || pos.x >= tilesX || pos.y < 0 || pos.y >= tilesY) return false;
  
  // Check collision with snake body (excluding tail which moves)
  for (let i = 0; i < currentSnake.length - 1; i++) {
    if (pos.x === currentSnake[i].x && pos.y === currentSnake[i].y) return false;
  }
  return true;
}

function getNeighbors(pos) {
  return [
    {x: pos.x, y: pos.y - 1},
    {x: pos.x, y: pos.y + 1},
    {x: pos.x - 1, y: pos.y},
    {x: pos.x + 1, y: pos.y}
  ];
}

function findPath(start, target, currentSnake) {
  let queue = [[start]];
  let visited = new Set();
  visited.add(start.x + "," + start.y);
  
  // Mark snake body as visited (obstacles)
  // Exclude tail because it will move (or because it's the target)
  for (let i = 0; i < currentSnake.length - 1; i++) {
    visited.add(currentSnake[i].x + "," + currentSnake[i].y);
  }

  while (queue.length > 0) {
    let path = queue.shift();
    let current = path[path.length - 1];
    
    if (current.x === target.x && current.y === target.y) {
      return path.slice(1);
    }
    
    let neighbors = getNeighbors(current);
    
    for (let neighbor of neighbors) {
      if (neighbor.x >= 0 && neighbor.x < tilesX && 
          neighbor.y >= 0 && neighbor.y < tilesY && 
          !visited.has(neighbor.x + "," + neighbor.y)) {
        visited.add(neighbor.x + "," + neighbor.y);
        let newPath = [...path, neighbor];
        queue.push(newPath);
      }
    }
  }
  return null;
}

function drawGame() {
  // Draw Food
  if (food) {
    drawTile(food.x, food.y, snakePatterns.food);
  }
  
  // Draw Snake
  for (let i = 0; i < snake.length; i++) {
    let segment = snake[i];
    let pattern;
    
    if (i === 0) {
      // Head
      let next = snake[1];
      let useOpenMouth = false;
      
      if (food) {
        let dx = food.x - segment.x;
        let dy = food.y - segment.y;
        
        // Check if food is adjacent (1 tile away)
        if (abs(dx) + abs(dy) === 1) {
           // Check if facing food
           if (segment.y < next.y && dy === -1) useOpenMouth = true; // Moving Up
           else if (segment.y > next.y && dy === 1) useOpenMouth = true; // Moving Down
           else if (segment.x < next.x && dx === -1) useOpenMouth = true; // Moving Left
           else if (segment.x > next.x && dx === 1) useOpenMouth = true; // Moving Right
        }
      }

      let patterns = useOpenMouth ? snakePatterns.headOpen : snakePatterns.head;

      if (segment.y < next.y) pattern = patterns.up;
      else if (segment.y > next.y) pattern = patterns.down;
      else if (segment.x < next.x) pattern = patterns.left;
      else pattern = patterns.right;
    } else if (i === snake.length - 1) {
      // Tail
      let prev = snake[i - 1];
      if (prev.y < segment.y) pattern = snakePatterns.tail.up;
      else if (prev.y > segment.y) pattern = snakePatterns.tail.down;
      else if (prev.x < segment.x) pattern = snakePatterns.tail.left;
      else pattern = snakePatterns.tail.right;
    } else {
      // Body
      let prev = snake[i - 1];
      let next = snake[i + 1];
      
      if (prev.x !== next.x && prev.y !== next.y) {
        // Corner
        let dx = (prev.x - segment.x) + (next.x - segment.x);
        let dy = (prev.y - segment.y) + (next.y - segment.y);
        
        if (dx === 1 && dy === 1) pattern = snakePatterns.corners.topLeft;
        else if (dx === -1 && dy === 1) pattern = snakePatterns.corners.topRight;
        else if (dx === 1 && dy === -1) pattern = snakePatterns.corners.bottomLeft;
        else if (dx === -1 && dy === -1) pattern = snakePatterns.corners.bottomRight;
      } else {
        // Straight
        if (prev.x !== next.x) pattern = snakePatterns.bodyH;
        else pattern = snakePatterns.bodyV;
      }
    }
    
    if (pattern) {
      drawTile(segment.x, segment.y, pattern);
    }
  }
}

function drawTile(tx, ty, pattern) {
  let startX = gameOffsetX + tx * tileWidth;
  let startY = gameOffsetY + ty * tileHeight;
  
  for (let i = 0; i < 16; i++) {
    if (pattern[i] === 1) {
      let px = i % 4;
      let py = floor(i / 4);
      setPixel(startX + px, startY + py, true);
    }
  }
}

function drawUI() {
  // Filled line at row 6 (row 5 is empty)
  for (let i = 0; i < cols; i++) {
    setPixel(i, 6, true);
  }

  // Game area border
  // Line at 6, gap at 7, border starts at 8
  for (let x = 0; x < cols; x++) {
    setPixel(x, 8, true);
    setPixel(x, rows - 1, true);
  }
  for (let y = 8; y < rows; y++) {
    setPixel(0, y, true);
    setPixel(cols - 1, y, true);
  }

  // Draw button
  let pattern = autoFoodEnabled ? buttonPatterns.on : buttonPatterns.off;
  for (let i = 0; i < 35; i++) {
    if (pattern[i] === 1) {
      let px = i % 7;
      let py = floor(i / 7);
      setPixel(buttonX + px, buttonY + py, true);
    }
  }

  // Draw size button
  let sizePattern = isLargeMode ? buttonPatterns.large : buttonPatterns.small;
  for (let i = 0; i < 35; i++) {
    if (sizePattern[i] === 1) {
      let px = i % 7;
      let py = floor(i / 7);
      setPixel(sizeButtonX + px, buttonY + py, true);
    }
  }
}

function drawScore() {
  let str = score.toString();
  let startX = 1; // Left aligned with 1px padding
  
  for (let i = 0; i < str.length; i++) {
    let digit = parseInt(str[i]);
    drawDigit(startX + i * 4, 0, digit);
  }
}

function drawTime() {
  let currentTime = isGameOver ? gameOverTime : millis();
  let elapsed = currentTime - gameStartTime;
  let totalSeconds = floor(elapsed / 1000);
  let h = floor(totalSeconds / 3600);
  let m = floor((totalSeconds % 3600) / 60);
  let s = totalSeconds % 60;

  let hStr = nf(h, 2);
  let mStr = nf(m, 2);
  let sStr = nf(s, 2);
  
  // Align to the left of the size button with 2px padding
  let endX = sizeButtonX - 2;

  if (h > 0) {
    let startX = endX - 32;
    drawDigit(startX, 0, parseInt(hStr.charAt(0)));
    drawDigit(startX + 4, 0, parseInt(hStr.charAt(1)));
    drawDigit(startX + 8, 0, 10); // Colon
    drawDigit(startX + 12, 0, parseInt(mStr.charAt(0)));
    drawDigit(startX + 16, 0, parseInt(mStr.charAt(1)));
    drawDigit(startX + 20, 0, 10); // Colon
    drawDigit(startX + 24, 0, parseInt(sStr.charAt(0)));
    drawDigit(startX + 28, 0, parseInt(sStr.charAt(1)));
  } else if (m > 0) {
    let startX = endX - 20;
    drawDigit(startX, 0, parseInt(mStr.charAt(0)));
    drawDigit(startX + 4, 0, parseInt(mStr.charAt(1)));
    drawDigit(startX + 8, 0, 10); // Colon
    drawDigit(startX + 12, 0, parseInt(sStr.charAt(0)));
    drawDigit(startX + 16, 0, parseInt(sStr.charAt(1)));
  } else {
    let startX = endX - 8;
    drawDigit(startX, 0, parseInt(sStr.charAt(0)));
    drawDigit(startX + 4, 0, parseInt(sStr.charAt(1)));
  }
}

function drawDigit(x, y, d) {
  let pattern = digitPatterns[d];
  for (let i = 0; i < 15; i++) {
    if (pattern[i] === 1) {
      let col = i % 3;
      let row = floor(i / 3);
      setPixel(x + col, y + row, true);
    }
  }
}

function clearGrid() {
  for (let i = 0; i < cols; i++) {
    grid[i] = [];
    for (let j = 0; j < rows; j++) {
      grid[i][j] = false;
    }
  }
}

function setPixel(x, y, active) {
  if (x >= 0 && x < cols && y >= 0 && y < rows) {
    grid[x][y] = active;
  }
}

function drawScreen() {
  background('#749C66');

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let x = i * pixelWidth + spacing * 0.5;
      let y = j * pixelHeight + spacing * 0.5;
      let w = pixelWidth - spacing;
      let h = pixelHeight - spacing;

      if (grid[i][j]) {
        // Shadow
        fill(shadowColor);
        rect(x + 1, y + 1, w, h);

        // Active pixel
        fill(activeColor);
        rect(x, y, w, h);
      } else {
        // Inactive pixel (ghosting)
        fill(inactiveColor);
        rect(x, y, w, h);
      }
    }
  }
}

function windowResized() {
  calculateGrid();
  resizeCanvas(cols * pixelWidth, rows * pixelHeight);
  styleCanvas();
  if (isLargeMode) {
    // In large mode, resizing might change the grid size significantly.
    // To prevent the snake from being out of bounds, we should probably reset if the grid shrinks.
    // But for a smooth experience, we'll try to keep it running.
    // If the snake is out of bounds, the game loop will handle it (or it might crash).
    // Let's check if the snake is out of bounds and reset if so.
    let maxY = tilesY;
    let outOfBounds = snake.some(s => s.y >= maxY);
    if (outOfBounds) {
      initGame();
    }
  }
}