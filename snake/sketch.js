const cols = 84;
const rows = 48;
const pixelWidth = 7;
const pixelHeight = 9;
const spacing = 1;

let grid = [];
let activeColor;
let inactiveColor;
let shadowColor;

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
const tilesY = 9;

let snake = [];
let food = null;
let dummyTarget = null;
let lastDummyChange = 0;
let eatSounds = [];
let explosionSound;
let isGameOver = false;
let gameOverTime = 0;
let gameStartTime = 0;

let autoFoodEnabled = false;
let nextFoodTime = 0;
const buttonPatterns = {
  off: [
    1,1,0,0,0,1,1,
    1,0,0,1,0,0,1,
    1,0,1,1,1,0,1,
    1,0,0,1,0,0,1,
    1,1,0,0,0,1,1
  ],
  on: [
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

function setup() {
  createCanvas(cols * pixelWidth, rows * pixelHeight);
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
  nextFoodTime = millis() + random(5000, 20000);
}

function draw() {
  if (isGameOver) {
    if (millis() - gameOverTime > 2000) {
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
      nextFoodTime = millis() + random(5000, 20000);
    }
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
      dummyTarget = null;
      nextFoodTime = millis() + random(5000, 20000);
    }
  }
}

function updateGame() {
  let head = snake[0];
  let nextMove = null;
  
  if (autoFoodEnabled && !food && millis() > nextFoodTime) {
    let newFood = getRandomReachableTile();
    if (newFood) {
      food = newFood;
      dummyTarget = null;
      nextFoodTime = millis() + random(5000, 20000);
    }
  }

  let target = food;

  if (!target) {
    if (!dummyTarget || (head.x === dummyTarget.x && head.y === dummyTarget.y) || (millis() - lastDummyChange > 4000)) {
       dummyTarget = getRandomReachableTile();
       lastDummyChange = millis();
    }
    target = dummyTarget;
  }
  
  // 1. Try to find path to target
  if (target) {
    let pathToTarget = findPath(head, target, snake);
    
    if (pathToTarget && pathToTarget.length > 0) {
      // Check if the first move towards target is safe
      // (i.e., we can reach our tail after taking it)
      let testMove = pathToTarget[0];
      if (isSafe(testMove)) {
        nextMove = testMove;
      }
    }
  }

  // 2. If no safe path to target, try to follow tail to survive
  if (!nextMove) {
    let tail = snake[snake.length - 1];
    let pathToTail = findPath(head, tail, snake);
    if (pathToTail && pathToTail.length > 0) {
      nextMove = pathToTail[0];
    }
  }

  // 3. If still no move, pick the valid neighbor with the most free space
  if (!nextMove) {
    let neighbors = getNeighbors(head);
    let validNeighbors = neighbors.filter(n => isValidMove(n, snake));
    
    // Prioritize safe moves (moves that allow reaching the tail)
    let safeMoves = validNeighbors.filter(n => isSafe(n));
    
    // If we have safe moves, only consider those. Otherwise, consider all valid moves (desperation).
    let candidates = safeMoves.length > 0 ? safeMoves : validNeighbors;
    
    let maxSpace = -1;
    
    for (let n of candidates) {
      let space = countReachable(n, snake);
      if (space > maxSpace) {
        maxSpace = space;
        nextMove = n;
      }
    }
  }

  if (nextMove) {
    // Move snake
    snake.unshift(nextMove);
    
    // Check if ate food
    if (food && nextMove.x === food.x && nextMove.y === food.y) {
      score++;
      food = null;
      dummyTarget = null;
      random(eatSounds).play();
    } else {
      snake.pop();
      // Check if reached dummy target
      if (dummyTarget && nextMove.x === dummyTarget.x && nextMove.y === dummyTarget.y) {
          dummyTarget = null;
      }
    }
  } else {
    // No valid moves - Game Over
    isGameOver = true;
    gameOverTime = millis();
    explosionSound.play();
  }
}

function isSafe(nextPos) {
  // Simulate the move
  let virtualSnake = [...snake];
  virtualSnake.unshift(nextPos);
  
  // If we eat food, we don't pop (grow)
  // If we don't eat, we pop (move)
  if (food && nextPos.x === food.x && nextPos.y === food.y) {
    // Grow: tail stays same
  } else {
    // Move: tail moves
    virtualSnake.pop();
  }
  
  let virtualHead = virtualSnake[0];
  let virtualTail = virtualSnake[virtualSnake.length - 1];
  
  // Check if path to tail exists
  let path = findPath(virtualHead, virtualTail, virtualSnake);
  return (path !== null);
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
  
  let timeOffset = 10;

  if (h > 0) {
    let startX = cols - 32 - timeOffset;
    drawDigit(startX, 0, parseInt(hStr.charAt(0)));
    drawDigit(startX + 4, 0, parseInt(hStr.charAt(1)));
    drawDigit(startX + 8, 0, 10); // Colon
    drawDigit(startX + 12, 0, parseInt(mStr.charAt(0)));
    drawDigit(startX + 16, 0, parseInt(mStr.charAt(1)));
    drawDigit(startX + 20, 0, 10); // Colon
    drawDigit(startX + 24, 0, parseInt(sStr.charAt(0)));
    drawDigit(startX + 28, 0, parseInt(sStr.charAt(1)));
  } else if (m > 0) {
    let startX = cols - 20 - timeOffset;
    drawDigit(startX, 0, parseInt(mStr.charAt(0)));
    drawDigit(startX + 4, 0, parseInt(mStr.charAt(1)));
    drawDigit(startX + 8, 0, 10); // Colon
    drawDigit(startX + 12, 0, parseInt(sStr.charAt(0)));
    drawDigit(startX + 16, 0, parseInt(sStr.charAt(1)));
  } else {
    let startX = cols - 8 - timeOffset;
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