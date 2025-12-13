const GRID_SIZE = 6;
const WIN_LENGTH = 4;
const CELL_SIZE = 90;
const RIM = 70;
const BOARD_SIZE = GRID_SIZE * CELL_SIZE;
const CANVAS_WIDTH = BOARD_SIZE + 2 * RIM;
const CANVAS_HEIGHT = BOARD_SIZE + 2 * RIM + 140; // status area
const WIN_SCORE = 100000;
const HARD_DEPTH = 4;
const EXTREME_DEPTH = 5;
const MEDIUM_DEPTH = 2;
const DIFFICULTY_LEVELS = [
  { key: 'very-easy', label: 'Very Easy' },
  { key: 'easy', label: 'Easy' },
  { key: 'medium', label: 'Medium' },
  { key: 'hard', label: 'Hard' },
  { key: 'extreme', label: 'Extreme' }
];

let board;
let currentPlayer;
let winner;
let moveCount;
let aiThinking = false;
let statusLine = "";
let difficulty = 'medium';
let gameState = 'start';

let rowButtons = [];
let colButtons = [];
let resetButton;
let startOverlay;
let endOverlay;
let endMessage;
let playAgainButton;
let changeLevelButton;
let gameContainer;
let animationState = { active: false, move: null, player: 0, progress: 0, callback: null };
let bgImage;
let boardTexture;
let lensMap;
let lensDiameter;

function preload() {
  boardTexture = loadImage('images/board.jpg');
}

function setup() {
  // Create a container for the game to ensure relative positioning works
  gameContainer = createDiv();
  gameContainer.style('position', 'relative');
  gameContainer.style('width', CANVAS_WIDTH + 'px');
  gameContainer.style('height', CANVAS_HEIGHT + 'px');
  gameContainer.id('game-container');

  let c = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  c.parent(gameContainer);
  
  textFont('IBMPlexMono', 14);
  
  // Initialize lens map
  lensDiameter = Math.floor(CELL_SIZE * 0.7);
  createLensMap(lensDiameter);
  
  createBoardImage();
  initGame();
  buildControls();
  buildStartOverlay();
  buildEndOverlay();
  // Ensure start overlay is visible initially
  startOverlay.style('display', 'flex');
  showStartOverlay();
}

function createBoardImage() {
  bgImage = createGraphics(CANVAS_WIDTH, CANVAS_HEIGHT);
  
  // Draw the yellow rim
  bgImage.noStroke();
  
  // Shadow for the rim
  bgImage.fill(0, 0, 0, 40);
  bgImage.rect(12, 12, BOARD_SIZE + 2 * RIM, BOARD_SIZE + 2 * RIM, 16);

  // Yellow rim body
  bgImage.fill('#f0c400');
  bgImage.stroke(0);
  bgImage.strokeWeight(2);
  bgImage.rect(0, 0, BOARD_SIZE + 2 * RIM, BOARD_SIZE + 2 * RIM, 16);

  // Move to board area
  bgImage.push();
  bgImage.translate(RIM, RIM);

  // Board area background
  if (boardTexture) {
    bgImage.image(boardTexture, 0, 0, BOARD_SIZE, BOARD_SIZE);
  } else {
    bgImage.fill(230);
    bgImage.noStroke();
    bgImage.rect(0, 0, BOARD_SIZE, BOARD_SIZE);
  }

  // Static background cells (Overlay with transparency if texture exists, or just draw if not)
  // If we have a texture, we might want to skip the checkerboard or make it very subtle
  // The user said "Use board.jpg as an image for the board".
  // I'll assume the texture replaces the checkerboard colors.
  // But I'll add the grid lines still.
  
  if (!boardTexture) {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const x = c * CELL_SIZE;
        const y = r * CELL_SIZE;
        const dark = (r + c) % 2 === 1;
        bgImage.fill(dark ? '#8a8a8a' : '#dcdcdc');
        bgImage.rect(x, y, CELL_SIZE, CELL_SIZE);
        
        // Inner shadow for depth
        if (dark) {
          bgImage.fill(0, 0, 0, 20);
          bgImage.rect(x, y, CELL_SIZE, 4);
        }
      }
    }
  }
  
  // Grid lines (baked in so they refract)
  bgImage.stroke(0, 0, 0, 40);
  bgImage.strokeWeight(1);
  for (let i = 1; i < GRID_SIZE; i++) {
    bgImage.line(i * CELL_SIZE, 0, i * CELL_SIZE, BOARD_SIZE);
    bgImage.line(0, i * CELL_SIZE, BOARD_SIZE, i * CELL_SIZE);
  }
  
  bgImage.pop();
  
  // Labels (baked in so they refract if near edge)
  bgImage.textAlign(CENTER, CENTER);
  bgImage.textSize(24);
  bgImage.textStyle(BOLD);
  bgImage.fill(0);
  bgImage.noStroke();
  bgImage.textFont('Inter');
  
  // Row numbers
  for (let r = 0; r < GRID_SIZE; r++) {
    const labelY = RIM + r * CELL_SIZE + CELL_SIZE / 2;
    bgImage.text(`${r + 1}`, BOARD_SIZE + RIM + RIM / 2, labelY);
  }
  // Column letters
  for (let c = 0; c < GRID_SIZE; c++) {
    const labelX = RIM + c * CELL_SIZE + CELL_SIZE / 2;
    const letter = String.fromCharCode(65 + c);
    bgImage.text(letter, labelX, BOARD_SIZE + RIM + RIM / 2);
  }
  
  // Prepare pixels for refraction lookup
  bgImage.loadPixels();
}

function createLensMap(d) {
  lensMap = [];
  const r = d / 2;
  const cx = r;
  const cy = r;
  const k = -0.5; // Distortion factor

  for (let y = 0; y < d; y++) {
    const row = [];
    for (let x = 0; x < d; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist >= r) {
        row.push(null);
        continue;
      }
      
      // Simple spherical refraction approximation
      // Map pixel to a position closer to center (magnification)
      const norm = dist / r; // 0 at center, 1 at edge
      
      // Refraction formula from article: f = 1 + k * (1 - norm)^2
      // But we want magnification, so we sample from closer to center.
      // If f < 1, we sample closer to center.
      // k should be negative.
      
      // Let's try a simple zoom: sample at 0.8 * dist
      // const factor = 0.8;
      
      // Using the article's curve:
      const f = 1 + k * Math.pow(norm, 2); // norm is 0 at center. 
      // Wait, article said "1 - norm" where norm was 0 at edge.
      // My norm is 0 at center. So (1-norm) is 1 at center.
      // Article: "greater at edges, zero at center".
      // So distortion should be 0 at center (f=1).
      // My norm is 0 at center.
      // So f = 1 + k * (norm^2) ?
      // If k=-0.5. Center: f=1. Edge: f=0.5.
      // sx = cx + dx * f.
      // At edge, dx=r. sx = cx + r*0.5. We sample halfway to center.
      // This creates magnification.
      
      const u = Math.round(dx * f);
      const v = Math.round(dy * f);
      
      row.push({ u, v });
    }
    lensMap.push(row);
  }
}

function initGame() {
  board = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  currentPlayer = 1; // 1 = red (human), 2 = blue (computer)
  winner = null;
  moveCount = 0;
  aiThinking = false;
  statusLine = "Your turn: place red";
  updateControlStates();
}

function buildControls() {
  // Row buttons (push from right -> pieces slide left)
  for (let r = 0; r < GRID_SIZE; r++) {
    const btn = createButton('>');
    btn.class('game-btn');
    btn.parent(gameContainer);
    btn.position(RIM + BOARD_SIZE + RIM / 2 - 16, RIM + r * CELL_SIZE + CELL_SIZE / 2 - 16);
    btn.mousePressed(() => handleHumanMove({ type: 'row', index: r }));
    rowButtons.push(btn);
  }

  // Column buttons (push from bottom -> pieces slide up)
  for (let c = 0; c < GRID_SIZE; c++) {
    const btn = createButton('^');
    btn.class('game-btn');
    btn.parent(gameContainer);
    btn.position(RIM + c * CELL_SIZE + CELL_SIZE / 2 - 16, RIM + BOARD_SIZE + RIM / 2 - 16);
    btn.mousePressed(() => handleHumanMove({ type: 'col', index: c }));
    colButtons.push(btn);
  }

  resetButton = createButton('Reset');
  resetButton.class('reset-btn');
  resetButton.parent(gameContainer);
  // Position reset button to the right of the status area
  resetButton.position(RIM + BOARD_SIZE - 80, BOARD_SIZE + 2 * RIM + 20);
  resetButton.mousePressed(() => startGame(difficulty));

  updateControlStates();
}

function styleOverlay(container) {
  container.class('overlay');
}

function styleOverlayButton(btn) {
  btn.class('overlay-btn');
}

function buildStartOverlay() {
  startOverlay = createDiv();
  // Parent to body to ensure fixed positioning works relative to viewport
  startOverlay.parent(document.body);
  styleOverlay(startOverlay);
  
  const card = createDiv();
  card.class('overlay-card');
  card.parent(startOverlay);

  const title = createElement('h2', '6x6 Slide');
  title.parent(card);

  const subtitle = createP('Slide pieces to make 4 in a row.<br>Red = You • Blue = Computer');
  subtitle.parent(card);

  const btnGroup = createDiv();
  btnGroup.class('btn-group');
  btnGroup.parent(card);

  DIFFICULTY_LEVELS.forEach(level => {
    const btn = createButton(level.label);
    btn.class('diff-btn');
    btn.parent(btnGroup);
    btn.mousePressed(() => startGame(level.key));
  });
}

function buildEndOverlay() {
  endOverlay = createDiv();
  // Parent to body to ensure fixed positioning works relative to viewport
  endOverlay.parent(document.body);
  styleOverlay(endOverlay);
  
  const card = createDiv();
  card.class('overlay-card');
  card.parent(endOverlay);

  endMessage = createElement('h2', '');
  endMessage.parent(card);

  const btnGroup = createDiv();
  btnGroup.class('btn-group');
  btnGroup.parent(card);

  playAgainButton = createButton('Play Again');
  playAgainButton.class('overlay-btn');
  playAgainButton.parent(btnGroup);
  playAgainButton.mousePressed(() => startGame(difficulty));

  changeLevelButton = createButton('Change Level');
  changeLevelButton.class('overlay-btn secondary');
  changeLevelButton.parent(btnGroup);
  changeLevelButton.mousePressed(() => showStartOverlay());

  endOverlay.style('display', 'none');
}

function showEndOverlay() {
  if (!endOverlay) return;
  const msg = winner === 0
    ? 'Stalemate'
    : winner === 1 ? 'You win!' : 'Computer wins!';
  endMessage.html(`${msg} — Level: ${difficultyLabel(difficulty)}`);
  endOverlay.style('display', 'flex');
}

function showStartOverlay() {
  gameState = 'start';
  hideOverlay(endOverlay);
  statusLine = 'Choose a difficulty to start';
  if (startOverlay) startOverlay.style('display', 'flex');
  updateControlStates();
}

function hideOverlay(overlay) {
  if (overlay) overlay.style('display', 'none');
}

function startGame(levelKey) {
  difficulty = levelKey;
  initGame();
  statusLine = `Difficulty: ${difficultyLabel(levelKey)} — Your turn: place red`;
  gameState = 'playing';
  hideOverlay(startOverlay);
  hideOverlay(endOverlay);
  updateControlStates();
}

function difficultyLabel(key) {
  const entry = DIFFICULTY_LEVELS.find(d => d.key === key);
  return entry ? entry.label : key;
}

function handleHumanMove(move) {
  if (gameState !== 'playing' || winner || aiThinking || currentPlayer !== 1 || animationState.active) return;
  
  startAnimation(move, 1, () => {
    if (!winner) {
      currentPlayer = 2;
      statusLine = "Computer thinking...";
      scheduleAiTurn();
    }
  });
}

function scheduleAiTurn() {
  if (gameState !== 'playing') return;
  aiThinking = true;
  updateControlStates();
  
  // Random thinking time between 1s and 2s
  const delay = random(1000, 2000);
  
  setTimeout(() => {
    if (gameState !== 'playing' || winner || currentPlayer !== 2) {
      aiThinking = false;
      updateControlStates();
      return;
    }
    const aiMove = chooseAiMove(difficulty);
    startAnimation(aiMove, 2, () => {
      aiThinking = false;
      if (!winner) {
        currentPlayer = 1;
        statusLine = "Your turn: place red";
      }
      updateControlStates();
    });
  }, delay);
}

function startAnimation(move, player, callback) {
  animationState = {
    active: true,
    move: move,
    player: player,
    progress: 0,
    callback: callback
  };
  updateControlStates();
}

function updateAnimation() {
  if (!animationState.active) return;
  
  // Animation speed
  animationState.progress += 0.1; // Adjust for speed
  
  if (animationState.progress >= 1) {
    animationState.active = false;
    applyMove(animationState.move, animationState.player);
    if (animationState.callback) {
      animationState.callback();
    }
    animationState.callback = null;
    animationState.move = null;
  }
}

function chooseAiMove(level = 'medium') {
  if (level === 'very-easy') return chooseRandomMove();
  if (level === 'easy') return chooseAiMoveEasy();
  if (level === 'medium') return chooseAiMoveMedium();
  if (level === 'hard') return chooseAiMoveMinimax(HARD_DEPTH);
  if (level === 'extreme') return chooseAiMoveMinimax(EXTREME_DEPTH);
  return chooseAiMoveMedium();
}

function preferenceScore(move) {
  const center = (GRID_SIZE - 1) / 2;
  if (move.type === 'row') return GRID_SIZE - Math.abs(center - move.index);
  return GRID_SIZE - Math.abs(center - move.index);
}

function chooseRandomMove() {
  const moves = listMoves();
  return random(moves);
}

function chooseAiMoveEasy() {
  const moves = listMoves();
  // Block human winning move first, otherwise pick a soft-heuristic move with randomness
  for (const mv of moves) {
    const clone = cloneBoard(board);
    applyMoveOnBoard(clone, mv, 1);
    if (isWin(clone, 1)) return mv;
  }
  const scored = moves.map(mv => {
    const clone = cloneBoard(board);
    applyMoveOnBoard(clone, mv, 2);
    return { mv, score: evaluatePosition(clone) + preferenceScore(mv) * 0.2 };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.max(2, Math.floor(scored.length / 2)));
  return random(top).mv;
}

function chooseAiMoveMedium() {
  const moves = listMoves();
  // Try to win immediately
  for (const mv of moves) {
    const clone = cloneBoard(board);
    applyMoveOnBoard(clone, mv, 2);
    if (isWin(clone, 2)) return mv;
  }
  // Block human winning move
  for (const mv of moves) {
    const clone = cloneBoard(board);
    applyMoveOnBoard(clone, mv, 1);
    if (isWin(clone, 1)) return mv;
  }
  // Mixed strategy: shallow minimax with stochastic tie-breaks + heuristic noise
  const scored = moves.map(mv => {
    const clone = cloneBoard(board);
    applyMoveOnBoard(clone, mv, 2);
    // 50% of the time, use shallow search; otherwise heuristic
    const useSearch = random() < 0.5;
    const baseScore = useSearch
      ? minimax(clone, MEDIUM_DEPTH - 1, false, -Infinity, Infinity, MEDIUM_DEPTH)
      : evaluatePosition(clone);
    // Add small noise to avoid predictability
    const noise = random(-2, 2);
    return { mv, score: baseScore + preferenceScore(mv) * 0.1 + noise };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, max(2, floor(scored.length / 2)));
  return random(top).mv;
}

function chooseAiMoveMinimax(depthLimit) {
  const moves = listMoves();
  let bestMove = moves[0];
  let bestScore = -Infinity;
  for (const mv of moves) {
    const clone = cloneBoard(board);
    applyMoveOnBoard(clone, mv, 2);
    const score = minimax(clone, depthLimit - 1, false, -Infinity, Infinity, depthLimit);
    if (score > bestScore) {
      bestScore = score;
      bestMove = mv;
    }
  }
  return bestMove;
}

function minimax(state, depth, maximizingPlayer, alpha, beta, maxDepth) {
  if (isWin(state, 2)) return WIN_SCORE - (maxDepth - depth);
  if (isWin(state, 1)) return -WIN_SCORE + (maxDepth - depth);
  if (depth === 0) return evaluatePosition(state);

  const moves = listMoves();
  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const mv of moves) {
      const clone = cloneBoard(state);
      applyMoveOnBoard(clone, mv, 2);
      const evalScore = minimax(clone, depth - 1, false, alpha, beta, maxDepth);
      maxEval = max(maxEval, evalScore);
      alpha = max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const mv of moves) {
      const clone = cloneBoard(state);
      applyMoveOnBoard(clone, mv, 1);
      const evalScore = minimax(clone, depth - 1, true, alpha, beta, maxDepth);
      minEval = min(minEval, evalScore);
      beta = min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function evaluatePosition(targetBoard) {
  // Heuristic: score all possible WIN_LENGTH segments.
  let score = 0;
  // Horizontal segments
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c <= GRID_SIZE - WIN_LENGTH; c++) {
      score += scoreSegment(targetBoard, r, c, 0, 1);
    }
  }
  // Vertical
  for (let c = 0; c < GRID_SIZE; c++) {
    for (let r = 0; r <= GRID_SIZE - WIN_LENGTH; r++) {
      score += scoreSegment(targetBoard, r, c, 1, 0);
    }
  }
  // Diagonal down-right
  for (let r = 0; r <= GRID_SIZE - WIN_LENGTH; r++) {
    for (let c = 0; c <= GRID_SIZE - WIN_LENGTH; c++) {
      score += scoreSegment(targetBoard, r, c, 1, 1);
    }
  }
  // Diagonal up-right
  for (let r = WIN_LENGTH - 1; r < GRID_SIZE; r++) {
    for (let c = 0; c <= GRID_SIZE - WIN_LENGTH; c++) {
      score += scoreSegment(targetBoard, r, c, -1, 1);
    }
  }
  return score;
}

function scoreSegment(boardRef, r, c, dr, dc) {
  let countAI = 0;
  let countHuman = 0;
  for (let k = 0; k < WIN_LENGTH; k++) {
    const v = boardRef[r + dr * k][c + dc * k];
    if (v === 2) countAI++;
    else if (v === 1) countHuman++;
  }
  if (countAI > 0 && countHuman > 0) return 0; // blocked segment
  if (countAI === 0 && countHuman === 0) return 0;
  if (countAI > 0) return countAI * countAI * 3;
  return -countHuman * countHuman * 3;
}

function listMoves() {
  const options = [];
  for (let r = 0; r < GRID_SIZE; r++) options.push({ type: 'row', index: r });
  for (let c = 0; c < GRID_SIZE; c++) options.push({ type: 'col', index: c });
  return options;
}

function applyMove(move, player) {
  applyMoveOnBoard(board, move, player);
  moveCount++;
  
  // Check if the current player won
  if (isWin(board, player)) {
    winner = player;
    statusLine = player === 1 ? "You made 4 in a row!" : "Computer made 4 in a row.";
    gameState = 'end';
    showEndOverlay();
  } 
  // Check if the opponent won (e.g. due to shifting)
  else if (isWin(board, 3 - player)) {
    winner = 3 - player;
    statusLine = winner === 1 ? "You win! (Computer helped)" : "Computer wins! (You helped)";
    gameState = 'end';
    showEndOverlay();
  }
  else if (moveCount >= 200) {
    winner = 0; // stalemate flag
    statusLine = "Stalemate.";
    gameState = 'end';
    showEndOverlay();
  }
  updateControlStates();
}

function applyMoveOnBoard(targetBoard, move, player) {
  if (move.type === 'row') {
    const row = targetBoard[move.index];
    for (let c = 0; c < GRID_SIZE - 1; c++) {
      row[c] = row[c + 1];
    }
    row[GRID_SIZE - 1] = player;
  } else {
    for (let r = 0; r < GRID_SIZE - 1; r++) {
      targetBoard[r][move.index] = targetBoard[r + 1][move.index];
    }
    targetBoard[GRID_SIZE - 1][move.index] = player;
  }
}

function isWin(targetBoard, player) {
  // Check lines of WIN_LENGTH horizontally, vertically, diagonally
  // Horizontal
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c <= GRID_SIZE - WIN_LENGTH; c++) {
      let ok = true;
      for (let k = 0; k < WIN_LENGTH; k++) {
        if (targetBoard[r][c + k] !== player) { ok = false; break; }
      }
      if (ok) return true;
    }
  }
  // Vertical
  for (let c = 0; c < GRID_SIZE; c++) {
    for (let r = 0; r <= GRID_SIZE - WIN_LENGTH; r++) {
      let ok = true;
      for (let k = 0; k < WIN_LENGTH; k++) {
        if (targetBoard[r + k][c] !== player) { ok = false; break; }
      }
      if (ok) return true;
    }
  }
  // Diagonal down-right
  for (let r = 0; r <= GRID_SIZE - WIN_LENGTH; r++) {
    for (let c = 0; c <= GRID_SIZE - WIN_LENGTH; c++) {
      let ok = true;
      for (let k = 0; k < WIN_LENGTH; k++) {
        if (targetBoard[r + k][c + k] !== player) { ok = false; break; }
      }
      if (ok) return true;
    }
  }
  // Diagonal up-right
  for (let r = WIN_LENGTH - 1; r < GRID_SIZE; r++) {
    for (let c = 0; c <= GRID_SIZE - WIN_LENGTH; c++) {
      let ok = true;
      for (let k = 0; k < WIN_LENGTH; k++) {
        if (targetBoard[r - k][c + k] !== player) { ok = false; break; }
      }
      if (ok) return true;
    }
  }
  return false;
}

function cloneBoard(src) {
  return src.map(row => row.slice());
}

function updateControlStates() {
  const disable = gameState !== 'playing' || winner !== null || aiThinking || currentPlayer !== 1 || animationState.active;
  rowButtons.forEach(btn => { btn.elt.disabled = disable; });
  colButtons.forEach(btn => { btn.elt.disabled = disable; });
}

function draw() {
  background('#00bf63');
  updateAnimation();
  drawBoard();
  drawStatus();
}

function drawBoard() {
  // Draw the pre-rendered background (Rim, Board, Grid, Labels)
  if (bgImage) {
    image(bgImage, 0, 0);
  }

  push();
  translate(RIM, RIM);

  // Clip to board area for animating pieces
  // Use native context to clip without drawing a shape (prevents black overlay)
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(0, 0, BOARD_SIZE, BOARD_SIZE);
  drawingContext.clip();

  // Draw pieces
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      let x = c * CELL_SIZE;
      let y = r * CELL_SIZE;
      
      // Calculate animation offset for pieces only
      if (animationState.active) {
        if (animationState.move.type === 'row' && animationState.move.index === r) {
          x -= animationState.progress * CELL_SIZE;
        } else if (animationState.move.type === 'col' && animationState.move.index === c) {
          y -= animationState.progress * CELL_SIZE;
        }
      }

      const val = board[r][c];
      if (val !== 0) {
        drawPiece(x, y, val);
      }
    }
  }

  // Draw the new piece sliding in
  if (animationState.active) {
    const move = animationState.move;
    let x, y;
    if (move.type === 'row') {
      x = GRID_SIZE * CELL_SIZE - animationState.progress * CELL_SIZE;
      y = move.index * CELL_SIZE;
    } else {
      x = move.index * CELL_SIZE;
      y = GRID_SIZE * CELL_SIZE - animationState.progress * CELL_SIZE;
    }
    drawPiece(x, y, animationState.player);
  }
  
  drawingContext.restore(); // Remove clip
  pop(); // End translate
}

function drawPiece(x, y, val) {
  // x, y are relative to the board (inside the RIM)
  const globalX = Math.floor(x + RIM);
  const globalY = Math.floor(y + RIM);
  
  const cx = x + CELL_SIZE / 2;
  const cy = y + CELL_SIZE / 2;
  const d = lensDiameter;
  const r = d / 2;
  
  // Top-left of the lens box relative to board
  const lx = Math.round(cx - r);
  const ly = Math.round(cy - r);
  
  // Global top-left of the lens box
  const gx = lx + RIM;
  const gy = ly + RIM;

  const ctx = drawingContext;

  // 1. Cast Shadow (Soft radial gradient)
  ctx.save();
  ctx.translate(cx + 4, cy + 6);
  const shadowGrad = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.1);
  shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
  shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.1, 0, TWO_PI);
  ctx.fill();
  ctx.restore();

  // 2. Refraction (Pixel Manipulation)
  const img = createImage(d, d);
  img.loadPixels();
  
  const bgW = bgImage.width;
  const bgH = bgImage.height;
  const bgPixels = bgImage.pixels;
  
  // Base colors - vibrant and distinct
  const baseColor = val === 1 ? [255, 40, 40] : [40, 100, 255]; 
  
  for (let py = 0; py < d; py++) {
    for (let px = 0; px < d; px++) {
      const mapVal = lensMap[py][px];
      if (!mapVal) continue; // Outside circle
      
      const srcX = Math.floor(gx + r + mapVal.u);
      const srcY = Math.floor(gy + r + mapVal.v);
      
      const sx = Math.max(0, Math.min(bgW - 1, srcX));
      const sy = Math.max(0, Math.min(bgH - 1, srcY));
      
      const idx = 4 * (sy * bgW + sx);
      const r_bg = bgPixels[idx];
      const g_bg = bgPixels[idx + 1];
      const b_bg = bgPixels[idx + 2];
      
      // Improved Blending: "High Opacity Glass"
      // To ensure consistency across light and dark wood textures, we:
      // 1. Suppress the background contrast (multiply by 0.3)
      // 2. Apply the glass color strongly (multiply by 0.7)
      // 3. Add a small brightness boost (+15) to prevent muddy darks
      
      const r_out = Math.min(255, (r_bg * 0.3) + (baseColor[0] * 0.7) + 15);
      const g_out = Math.min(255, (g_bg * 0.3) + (baseColor[1] * 0.7) + 15);
      const b_out = Math.min(255, (b_bg * 0.3) + (baseColor[2] * 0.7) + 15);
      
      const outIdx = 4 * (py * d + px);
      img.pixels[outIdx] = r_out;
      img.pixels[outIdx + 1] = g_out;
      img.pixels[outIdx + 2] = b_out;
      img.pixels[outIdx + 3] = 255;
    }
  }
  img.updatePixels();
  image(img, lx, ly);

  // 3. Inner Body Shadow (Volume)
  // Darken the edges slightly to give volume, independent of background
  ctx.save();
  ctx.translate(cx, cy);
  const bodyGrad = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r);
  bodyGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  bodyGrad.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TWO_PI);
  ctx.fill();
  ctx.restore();

  // 4. Inner Caustic / Glow (Bottom)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.85, 0.5, PI - 0.5); 
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  // 5. Specular Highlight (Top Left)
  ctx.save();
  const highlightGrad = ctx.createRadialGradient(cx - r/2.5, cy - r/2.5, 1, cx - r/2.5, cy - r/2.5, r/2.5);
  highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
  highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = highlightGrad;
  ctx.beginPath();
  ctx.ellipse(cx - r/2.5, cy - r/2.5, r/3, r/4, PI/4, 0, TWO_PI);
  ctx.fill();
  ctx.restore();
  
  // 6. Rim Light (Top Edge)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.9, PI + 0.5, -0.5);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawStatus() {
  fill('#1a1a1a');
  noStroke();
  textFont('Inter');
  textAlign(LEFT, TOP);
  
  // Status area background
  // fill(255, 255, 255, 200);
  // rect(RIM, RIM + BOARD_SIZE + 20, BOARD_SIZE, 100, 8);

  textSize(18);
  textStyle(BOLD);
  const turnText = winner === null
    ? (currentPlayer === 1 ? 'Current Turn: You (Red)' : 'Current Turn: Computer (Blue)')
    : (winner === 0 ? 'Result: Stalemate' : winner === 1 ? 'Result: You Win!' : 'Result: Computer Wins!');
  
  // Position below the yellow rim
  // Yellow rim ends at BOARD_SIZE + 2*RIM
  // Status starts at BOARD_SIZE + 2*RIM + 20
  const statusY = BOARD_SIZE + 2 * RIM + 20;
  const statusX = RIM; // Align with board left edge
  
  text(turnText, statusX, statusY);
  
  textSize(14);
  textStyle(NORMAL);
  fill('#4b5563');
  text(statusLine, statusX, statusY + 25);
  
  // Difficulty badge
  const diffLabel = difficultyLabel(difficulty);
  const badgeWidth = textWidth(diffLabel) + 20;
  fill('#e5e7eb');
  rect(statusX, statusY + 50, badgeWidth, 24, 12);
  fill('#374151');
  textSize(12);
  textAlign(CENTER, CENTER);
  text(diffLabel, statusX + badgeWidth/2, statusY + 62);
  
  // Top instruction
  textAlign(LEFT, BOTTOM);
  textSize(14);
  fill('#1a1a1a');
  text(`Goal: Connect ${WIN_LENGTH}`, RIM, RIM - 10);
}
