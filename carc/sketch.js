// description of pieces

const pieces = {
    "0r0c R0+M 1.png": { top: "g", right: "g", bottom: "g", left: "g", pennant: false },
    "0r0c R0+M 2.png": { top: "g", right: "g", bottom: "g", left: "g", pennant: false },
    "0r0c R0+M 3.png": { top: "g", right: "g", bottom: "g", left: "g", pennant: false },
    "0r0c R0+M 4.png": { top: "g", right: "g", bottom: "g", left: "g", pennant: false },
    "0r0c R1 1.png": { top: "g", right: "g", bottom: "r", left: "g", pennant: false },
    "0r0c R1 2.png": { top: "g", right: "g", bottom: "r", left: "g", pennant: false },
    "0r0c R2 (A) 1.png": { top: "g", right: "r", bottom: "g", left: "r", pennant: false },
    "0r0c R2 (A) 2.png": { top: "g", right: "r", bottom: "g", left: "r", pennant: false },
    "0r0c R2 (B) 1.png": { top: "g", right: "g", bottom: "r", left: "r", pennant: false },
    "0r0c R2 (B) 2.png": { top: "g", right: "g", bottom: "r", left: "r", pennant: false },
    "0r1c R0 1.png": { top: "c", right: "g", bottom: "g", left: "g", pennant: false },
    "0r1c R0 2.png": { top: "c", right: "g", bottom: "g", left: "g", pennant: false },
    "0r1c R0 3.png": { top: "c", right: "g", bottom: "g", left: "g", pennant: false },
    "0r1c R0 4.png": { top: "c", right: "g", bottom: "g", left: "g", pennant: false },
    "0r1c R0 5.png": { top: "c", right: "g", bottom: "g", left: "g", pennant: false },
    "0r2c R0 (A) 1.png": { top: "c", right: "g", bottom: "c", left: "g", pennant: false },
    "0r2c R0 (A) 2.png": { top: "c", right: "g", bottom: "c", left: "g", pennant: false },
    "0r2c R0 (A) 3.png": { top: "c", right: "g", bottom: "c", left: "g", pennant: false },
    "0r2c R0 (B) 1.png": { top: "c", right: "c", bottom: "g", left: "g", pennant: false },
    "0r2c R0 (B) 2.png": { top: "c", right: "c", bottom: "g", left: "g", pennant: false },
    "0r2c R0 (C).png": { top: "g", right: "c", bottom: "g", left: "c", pennant: false },
    "0r2c R0 (C)+C 1.png": { top: "g", right: "c", bottom: "g", left: "c", pennant: true },
    "0r2c R0 (C)+C 2.png": { top: "g", right: "c", bottom: "g", left: "c", pennant: true },
    "0r2c R0 (D) 1.png": { top: "c", right: "c", bottom: "g", left: "g", pennant: false },
    "0r2c R0 (D) 2.png": { top: "c", right: "c", bottom: "g", left: "g", pennant: false },
    "0r2c R0 (D) 3.png": { top: "c", right: "c", bottom: "g", left: "g", pennant: false },
    "0r2c R0 (D)+C 1.png": { top: "c", right: "c", bottom: "g", left: "g", pennant: true },
    "0r2c R0 (D)+C 2.png": { top: "c", right: "c", bottom: "g", left: "g", pennant: true },
    "0r2c R2 (A).png": { top: "c", right: "r", bottom: "c", left: "r", pennant: false },
    "0r2c R2 (B).png": { top: "c", right: "c", bottom: "r", left: "r", pennant: false },
    "0r3c R0 1.png": { top: "c", right: "c", bottom: "g", left: "c", pennant: false },
    "0r3c R0 2.png": { top: "c", right: "c", bottom: "g", left: "c", pennant: false },
    "0r3c R0 3.png": { top: "c", right: "c", bottom: "g", left: "c", pennant: false },
    "0r3c R0+C.png": { top: "c", right: "c", bottom: "g", left: "c", pennant: true },
    "0r4c R0+C.png": { top: "c", right: "c", bottom: "c", left: "c", pennant: true },
    "1r0c R0+M 1.png": { top: "g", right: "g", bottom: "w", left: "g", pennant: false },
    "1r0c R0+M 2.png": { top: "g", right: "g", bottom: "w", left: "g", pennant: false },
    "1r0c R2+M.png": { top: "g", right: "r", bottom: "w", left: "r", pennant: false },
    "1r1c R2.png": { top: "c", right: "r", bottom: "w", left: "r", pennant: false },
    "1r3c R0.png": { top: "c", right: "c", bottom: "w", left: "c", pennant: false },
    "1r3c R0+C 1.png": { top: "c", right: "c", bottom: "w", left: "c", pennant: true },
    "1r3c R0+C 2.png": { top: "c", right: "c", bottom: "w", left: "c", pennant: true },
    "2r0c R0 (A) 1.png": { top: "g", right: "w", bottom: "g", left: "w", pennant: false },
    "2r0c R0 (A) 2.png": { top: "g", right: "w", bottom: "g", left: "w", pennant: false },
    "2r0c R0 (A) 3.png": { top: "g", right: "w", bottom: "g", left: "w", pennant: false },
    "2r0c R0 (A) 4.png": { top: "g", right: "w", bottom: "g", left: "w", pennant: false },
    "2r0c R0 (A) 5.png": { top: "g", right: "w", bottom: "g", left: "w", pennant: false },
    "2r0c R0 (A) 6.png": { top: "g", right: "w", bottom: "g", left: "w", pennant: false },
    "2r0c R0 (A) 7.png": { top: "g", right: "w", bottom: "g", left: "w", pennant: false },
    "2r0c R0 (A) 8.png": { top: "g", right: "w", bottom: "g", left: "w", pennant: false },
    "2r0c R0 (B) 1.png": { top: "g", right: "g", bottom: "w", left: "w", pennant: false },
    "2r0c R0 (B) 2.png": { top: "g", right: "g", bottom: "w", left: "w", pennant: false },
    "2r0c R0 (B) 3.png": { top: "g", right: "g", bottom: "w", left: "w", pennant: false },
    "2r0c R0 (B) 4.png": { top: "g", right: "g", bottom: "w", left: "w", pennant: false },
    "2r0c R0 (B) 5.png": { top: "g", right: "g", bottom: "w", left: "w", pennant: false },
    "2r0c R0 (B) 6.png": { top: "g", right: "g", bottom: "w", left: "w", pennant: false },
    "2r0c R0 (B) 7.png": { top: "g", right: "g", bottom: "w", left: "w", pennant: false },
    "2r0c R0 (B) 8.png": { top: "g", right: "g", bottom: "w", left: "w", pennant: false },
    "2r0c R0 (B) 9.png": { top: "g", right: "g", bottom: "w", left: "w", pennant: false },
    "2r0c R2 (B).png": { top: "w", right: "w", bottom: "r", left: "r", pennant: false },
    "2r1c R0 (A) 1.png": { top: "c", right: "w", bottom: "g", left: "w", pennant: false },
    "2r1c R0 (A) 2.png": { top: "c", right: "w", bottom: "g", left: "w", pennant: false },
    "2r1c R0 (A) 3.png": { top: "c", right: "w", bottom: "g", left: "w", pennant: false },
    "2r1c R0 (A) 4.png": { top: "c", right: "w", bottom: "g", left: "w", pennant: false },
    "2r1c R0 (B) 1.png": { top: "c", right: "g", bottom: "w", left: "w", pennant: false },
    "2r1c R0 (B) 2.png": { top: "c", right: "g", bottom: "w", left: "w", pennant: false },
    "2r1c R0 (B) 3.png": { top: "c", right: "g", bottom: "w", left: "w", pennant: false },
    "2r1c R0 (C) 1.png": { top: "c", right: "w", bottom: "w", left: "g", pennant: false },
    "2r1c R0 (C) 2.png": { top: "c", right: "w", bottom: "w", left: "g", pennant: false },
    "2r1c R0 (C) 3.png": { top: "c", right: "w", bottom: "w", left: "g", pennant: false },
    "2r2c R0 1.png": { top: "c", right: "c", bottom: "w", left: "w", pennant: false },
    "2r2c R0 2.png": { top: "c", right: "c", bottom: "w", left: "w", pennant: false },
    "2r2c R0 3.png": { top: "c", right: "c", bottom: "w", left: "w", pennant: false },
    "2r2c R0+C 1.png": { top: "c", right: "c", bottom: "w", left: "w", pennant: true },
    "2r2c R0+C 2.png": { top: "c", right: "c", bottom: "w", left: "w", pennant: true },
    "3r0c R0+V 1.png": { top: "g", right: "w", bottom: "w", left: "w", pennant: false },
    "3r0c R0+V 2.png": { top: "g", right: "w", bottom: "w", left: "w", pennant: false },
    "3r0c R0+V 3.png": { top: "g", right: "w", bottom: "w", left: "w", pennant: false },
    "3r0c R0+V 4.png": { top: "g", right: "w", bottom: "w", left: "w", pennant: false },
    "3r1c R0+V 1.png": { top: "c", right: "w", bottom: "w", left: "w", pennant: false },
    "3r1c R0+V 2.png": { top: "c", right: "w", bottom: "w", left: "w", pennant: false },
    "3r1c R0+V 3.png": { top: "c", right: "w", bottom: "w", left: "w", pennant: false },
    "4r0c R0+V.png": { top: "w", right: "w", bottom: "w", left: "w", pennant: false }
};

let pieceImages = {};
let meepleImages = {};
let deck = [];
let deckSequence = [];
let currentDeckIndex = 0;
let isRiverPhase = true;
let isMapMode = false;
let optimizeCitySize = false;
let optimizeRoadLength = false;
let placedTiles = new Map(); // "x,y" -> {x, y, piece, rotation, features: []}
let frontier = new Set(); // "x,y"
let players = [];
let currentPlayerIdx = 0;
let minX = 0, maxX = 0, minY = 0, maxY = 0;
let tileSize = 64;
let state = "INIT"; // INIT, DRAW, PLACE, MEEPLE, SCORE, END
let currentTile = null;
let currentTilePos = null; // {x, y, rotation}
let lastPlacedTile = null;
let completedCities = []; // Store completed city components for field scoring

const PLAYER_COLORS = ['#000000', '#ff00ff', '#ffff00', '#00ffff', '#ffffff'];
const NUM_PLAYERS = 5; // Configurable 2-5

function preload() {
  for (let key in pieces) {
    pieceImages[key] = loadImage('images/' + key);
  }
  for (let i = 1; i <= 5; i++) {
      meepleImages[i-1] = loadImage(`images/p${i}.png`);
  }
}

let camScale = 1;
let camX = 0;
let camY = 0;
let targetSpeed = 30;
let lastMoveTime = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  noSmooth();
  textFont('IBMPlexMono');
  state = "MENU";
  frameRate(60);
}

window.startGame = function(playerIds, numDecks, speed, mapMode, optCity, optRoad) {
  isMapMode = mapMode;
  optimizeCitySize = optCity;
  optimizeRoadLength = optRoad;
  targetSpeed = speed;
  // Init Players
  players = [];
  for(let id of playerIds) {
      players.push({
          id: id,
          color: PLAYER_COLORS[id],
          score: 0,
          meeples: 7
      });
  }
  
  deckSequence = [];
  
  for(let d=0; d<numDecks; d++) {
      let riverBody = [];
      let riverSource = null;
      let riverLake = null;
      let normal = [];
      
      let allKeys = Object.keys(pieces);
      for (let key of allKeys) {
          let p = pieces[key];
          let hasRiver = Object.values(p).includes('r');
          let tile = { key: key, edges: [p.top, p.right, p.bottom, p.left], pennant: p.pennant };
          
          if (hasRiver) {
              // Identify Source and Lake by edge count
              let riverEdges = 0;
              if (p.top === 'r') riverEdges++;
              if (p.right === 'r') riverEdges++;
              if (p.bottom === 'r') riverEdges++;
              if (p.left === 'r') riverEdges++;
              
              if (riverEdges === 1) {
                  if (!riverSource) {
                      riverSource = tile;
                      riverSource.isRiverSource = true;
                  }
                  else riverLake = tile;
              } else {
                  riverBody.push(tile);
              }
          } else {
              normal.push(tile);
          }
      }
      
      // Setup River Deck
      // Order: Source (placed/top), then Body (shuffled), then Lake (last/bottom)
      // Deck is popped, so Lake should be at index 0
      let rDeck = [];
      if (riverLake) rDeck.push(riverLake);
      shuffle(riverBody, true);
      rDeck.push(...riverBody);
      
      // Handle Source
      if (d === 0) {
          // First deck: Place Source immediately
          if (riverSource) {
              placeTile(0, 0, riverSource, floor(random(4)));
          }
      } else {
          // Subsequent decks: Add Source to the deck (popped last -> pushed last)
          if (riverSource) rDeck.push(riverSource);
      }
      
      deckSequence.push({ type: 'river', cards: rDeck });
      
      // Prepare Normal Deck
      shuffle(normal, true);
      deckSequence.push({ type: 'normal', cards: normal });
  }
  
  currentDeckIndex = 0;
  deck = deckSequence[0].cards;
  isRiverPhase = (deckSequence[0].type === 'river');
  
  state = "DRAW";
  // frameRate(speed); // Decoupled
  lastMoveTime = millis();
}

window.setGameSpeed = function(speed) {
    targetSpeed = speed;
}

function draw() {
  if (state === "MENU") {
      background(0);
      return;
  }

  background(50);
  
  // Game Logic Throttling
  let interval = 1000 / targetSpeed;
  if (millis() - lastMoveTime > interval) {
      lastMoveTime = millis();
      updateGameLogic();
  }
  
  drawBoard();
  drawUI();
}

function updateGameLogic() {
  if (state === "DRAW") {
      if (deck.length > 0) {
          currentTile = deck.pop();
          state = "PLACE";
      } else {
          // Switch to next deck in sequence
          currentDeckIndex++;
          if (currentDeckIndex < deckSequence.length) {
              deck = deckSequence[currentDeckIndex].cards;
              isRiverPhase = (deckSequence[currentDeckIndex].type === 'river');
              
              if (deck.length > 0) {
                  currentTile = deck.pop();
                  state = "PLACE";
              } else {
                  state = "END";
                  scoreEndGame();
                  noLoop();
              }
          } else {
              state = "END";
              scoreEndGame();
              noLoop();
          }
      }
  } else if (state === "PLACE") {
      // Find valid moves
      let moves = getValidMoves(currentTile);
      if (moves.length > 0) {
          // Pick best move (AI)
          let chosenMove = getBestMove(moves, currentTile, players[currentPlayerIdx]);
          placeTile(chosenMove.x, chosenMove.y, currentTile, chosenMove.rotation);
          currentTilePos = chosenMove;
          lastPlacedTile = placedTiles.get(`${chosenMove.x},${chosenMove.y}`);
          state = "MEEPLE";
      } else {
          // Discard
          console.log("Tile discarded, no valid moves");
          state = "DRAW";
      }
  } else if (state === "MEEPLE") {
      if (isMapMode) {
          state = "SCORE";
          return;
      }
      // AI Decision: Place meeple?
      let player = players[currentPlayerIdx];
      if (player.meeples > 0) {
          let features = getAvailableFeatures(lastPlacedTile);
          if (features.length > 0) {
              // Heuristic: Place if feature is valuable or strategic
              let bestFeature = getBestFeatureToClaim(lastPlacedTile, features, player);
              if (bestFeature) {
                  placeMeeple(player, lastPlacedTile, bestFeature);
              }
          }
      }
      state = "SCORE";
  } else if (state === "SCORE") {
      scoreFeatures();
      currentPlayerIdx = (currentPlayerIdx + 1) % players.length;
      state = "DRAW";
  }
}

function drawBoard() {
    let boardW = (maxX - minX + 5) * tileSize;
    let boardH = (maxY - minY + 5) * tileSize;
    let targetScale = min(width / boardW, height / boardH);
    if (targetScale > 1.5) targetScale = 1.5;
    
    // Smooth camera
    camScale = lerp(camScale, targetScale, 0.1);
    
    let targetCX = (minX + maxX) / 2 * tileSize;
    let targetCY = (minY + maxY) / 2 * tileSize;
    
    camX = lerp(camX, targetCX, 0.1);
    camY = lerp(camY, targetCY, 0.1);
    
    push();
    translate(width/2, height/2);
    scale(camScale);
    translate(-camX, -camY);
    
    for (let tile of placedTiles.values()) {
        let px = tile.x * tileSize;
        let py = tile.y * tileSize;
        
        push();
        translate(px, py);
        
        // Tile
        push();
        translate(tileSize/2, tileSize/2);
        rotate(HALF_PI * tile.rotation);
        imageMode(CENTER);
        image(pieceImages[tile.piece.key], 0, 0, tileSize, tileSize);
        pop();
        
        // Meeples
        if (tile.meeples) {
            for (let m of tile.meeples) {
                // Position based on feature type (simplified center offset)
                let mx = tileSize/2, my = tileSize/2;
                if (m.feature.type === 'c') my -= 15;
                if (m.feature.type === 'w') my += 15;
                if (m.feature.type === 'g') { mx += 15; my += 15; } // Farmer
                
                push();
                translate(mx, my);
                if (m.feature.type === 'g') {
                    // Farmer lies down - rotate 90 deg
                    rotate(HALF_PI);
                }
                imageMode(CENTER);
                // Tint meeple image with player color? No, images are p1..p5.
                // Assuming p1..p5 are colored images.
                // If they are not colored, we might need tint().
                // User said "Player 1 = black...". Assuming images match.
                image(meepleImages[m.player.id], 0, 0, 24, 24);
                pop();
            }
        }
        
        pop();
    }
    pop();
}

function drawUI() {
    if (isMapMode) return;

    fill(0, 150);
    noStroke();
    rect(0, 0, 250, 180);
    
    fill(255);
    textSize(16);
    textAlign(LEFT, TOP);
    text(`Tiles Left: ${deck.length}`, 10, 10);
    text(`Current Player:`, 10, 30);
    image(meepleImages[players[currentPlayerIdx].id], 140, 30, 20, 20);
    
    let y = 60;
    for (let p of players) {
        fill(255);
        noStroke();
        text(`: ${p.score} pts (${p.meeples}m)`, 40, y);
        image(meepleImages[p.id], 10, y, 20, 20);
        y += 25;
    }
}

function placeTile(x, y, piece, rotation) {
    let tile = {
        x, y, piece, rotation,
        meeples: []
    };
    placedTiles.set(`${x},${y}`, tile);
    frontier.delete(`${x},${y}`);
    
    minX = min(minX, x);
    maxX = max(maxX, x);
    minY = min(minY, y);
    maxY = max(maxY, y);
    
    let neighbors = [[0,-1], [1,0], [0,1], [-1,0]];
    for (let n of neighbors) {
        let nx = x + n[0];
        let ny = y + n[1];
        if (!placedTiles.has(`${nx},${ny}`)) frontier.add(`${nx},${ny}`);
    }
}

function getValidMoves(piece) {
    let moves = [];
    for (let fKey of frontier) {
        let [fx, fy] = fKey.split(',').map(Number);
        for (let r = 0; r < 4; r++) {
            if (canPlace(piece, r, fx, fy)) {
                moves.push({x: fx, y: fy, rotation: r});
            }
        }
    }
    return moves;
}

function canPlace(piece, rotation, x, y) {
    let neighbors = [[0,-1, 0], [1,0, 1], [0,1, 2], [-1,0, 3]]; 
    let hasNeighbor = false;
    let connectsRiver = false;

    for (let n of neighbors) {
        let nx = x + n[0];
        let ny = y + n[1];
        let side = n[2];
        let neighbor = placedTiles.get(`${nx},${ny}`);
        if (neighbor) {
            hasNeighbor = true;
            let myEdge = getEdge(piece, rotation, side);
            let neighborEdge = getEdge(neighbor.piece, neighbor.rotation, (side + 2) % 4);
            if (myEdge !== neighborEdge) return false;
            
            if (isRiverPhase && myEdge === 'r') {
                connectsRiver = true;
            }
        }
    }
    
    if (isRiverPhase && !piece.isRiverSource && !connectsRiver) return false;

    return hasNeighbor;
}

function getEdge(piece, rotation, side) {
    return piece.edges[(side - rotation + 4) % 4];
}

function getAvailableFeatures(tile) {
    let features = [];
    if (tile.piece.key.includes("M")) features.push({type: 'm', side: 'center'});
    
    for(let i=0; i<4; i++) {
        let type = getEdge(tile.piece, tile.rotation, i);
        if (!isFeatureOccupied(tile, i, type)) {
            features.push({type: type, side: i});
        }
    }
    
    let unique = [];
    let typesSeen = new Set();
    for(let f of features) {
        if(!typesSeen.has(f.type)) {
            unique.push(f);
            typesSeen.add(f.type);
        }
    }
    return unique;
}

function isFeatureOccupied(tile, side, type) {
    // For cloisters, it's just the tile itself
    if (type === 'm') {
        if (tile.meeples) {
            for(let m of tile.meeples) {
                if (m.feature.type === 'm') return true;
            }
        }
        return false;
    }

    let visited = new Set();
    let queue = [{x: tile.x, y: tile.y, side: side}];
    // We need to track visited edges to avoid infinite loops, but also tiles
    // Key: "x,y" to track tiles visited
    let visitedTiles = new Set();
    visitedTiles.add(`${tile.x},${tile.y}`);
    
    while(queue.length > 0) {
        let curr = queue.shift();
        let t = placedTiles.get(`${curr.x},${curr.y}`);
        if (!t) continue;
        
        // Check if meeple on this tile matches feature
        if (t.meeples) {
            for(let m of t.meeples) {
                // We need to be careful: is this meeple actually on the SAME connected component?
                // In this simplified model, we assume if the tile has a meeple of the same type,
                // and we reached this tile via a connected path of that type, then it's occupied.
                // However, a tile might have two separate roads.
                // To fix this properly, we need to check if the meeple's specific side is connected to our entry side.
                
                // Simplified check: if meeple is on 'center' (monastery) it doesn't block road/city
                if (m.feature.side === 'center') continue;
                
                // If meeple is on a side, check if that side is connected to our current traversal
                // For this simplified graph, we assume all edges of same type on a tile are connected internally
                // UNLESS it's a special case like "city cap" vs "city tube".
                // But our data structure doesn't have internal connectivity info.
                // So we assume: if type matches, it's connected.
                if (m.feature.type === type) return true; 
            }
        }
        
        // Propagate to neighbors
        // We look at all edges of the current tile that match the type
        for(let i=0; i<4; i++) {
            let edge = getEdge(t.piece, t.rotation, i);
            // Fields ('g') connect across 'g' edges, but also run along rivers ('r') and roads ('w')
            let connects = (edge === type) || (type === 'g' && (edge === 'r' || edge === 'w'));
            
            if (connects) {
                let neighbors = [[0,-1], [1,0], [0,1], [-1,0]];
                let nx = t.x + neighbors[i][0];
                let ny = t.y + neighbors[i][1];
                let nSide = (i + 2) % 4;
                
                if (placedTiles.has(`${nx},${ny}`) && !visitedTiles.has(`${nx},${ny}`)) {
                    // Verify the neighbor actually connects back (it should if placed correctly)
                    let neighbor = placedTiles.get(`${nx},${ny}`);
                    let nEdge = getEdge(neighbor.piece, neighbor.rotation, nSide);
                    let nConnects = (nEdge === type) || (type === 'g' && (nEdge === 'r' || nEdge === 'w'));
                    
                    if (nConnects) {
                        visitedTiles.add(`${nx},${ny}`);
                        queue.push({x: nx, y: ny, side: nSide});
                    }
                }
            }
        }
    }
    return false;
}

function placeMeeple(player, tile, feature) {
    tile.meeples.push({player: player, feature: feature});
    player.meeples--;
}

function scoreFeatures() {
    if (!lastPlacedTile) return;
    
    let typesToCheck = ['w', 'c', 'm'];
    for (let type of typesToCheck) {
        let component = getComponent(lastPlacedTile, type);
        if (component.tiles.length === 0) continue;
        
        if (isComponentComplete(component, type)) {
            let points = calculateScore(component, type, false);
            distributePoints(component, points);
            removeMeeples(component, type);
            
            if (type === 'c') {
                completedCities.push(component);
            }
        }
    }
}

function getComponent(startTile, type) {
    let tiles = [];
    let meeples = [];
    let openEdges = 0;
    
    let visited = new Set();
    let queue = [startTile];
    visited.add(`${startTile.x},${startTile.y}`);
    
    let hasType = false;
    for(let i=0; i<4; i++) if(getEdge(startTile.piece, startTile.rotation, i) === type) hasType = true;
    if (type === 'm' && startTile.piece.key.includes('M')) hasType = true;
    if (!hasType) return {tiles: [], meeples: [], openEdges: 0};

    while(queue.length > 0) {
        let t = queue.shift();
        tiles.push(t);
        
        if (t.meeples) {
            for(let m of t.meeples) {
                if (m.feature.type === type) meeples.push(m);
            }
        }
        
        if (type === 'm') {
            return {tiles: [t], meeples: meeples, isCloister: true};
        }
        
        for(let i=0; i<4; i++) {
            if (getEdge(t.piece, t.rotation, i) === type) {
                let neighbors = [[0,-1], [1,0], [0,1], [-1,0]];
                let nx = t.x + neighbors[i][0];
                let ny = t.y + neighbors[i][1];
                
                if (placedTiles.has(`${nx},${ny}`)) {
                    let neighbor = placedTiles.get(`${nx},${ny}`);
                    if (!visited.has(`${nx},${ny}`)) {
                        visited.add(`${nx},${ny}`);
                        queue.push(neighbor);
                    }
                } else {
                    openEdges++;
                }
            }
        }
    }
    return {tiles, meeples, openEdges};
}

function isComponentComplete(component, type) {
    if (type === 'm') {
        let t = component.tiles[0];
        let count = 0;
        for(let dx=-1; dx<=1; dx++) {
            for(let dy=-1; dy<=1; dy++) {
                if (dx===0 && dy===0) continue;
                if (placedTiles.has(`${t.x+dx},${t.y+dy}`)) count++;
            }
        }
        return count === 8;
    }
    return component.openEdges === 0;
}

function calculateScore(component, type, isEndGame) {
    if (type === 'w') return component.tiles.length; // 1 pt per tile
    if (type === 'c') {
        let pennants = 0;
        for(let t of component.tiles) {
            if (t.piece.pennant) pennants++;
        }
        let ptsPerTile = isEndGame ? 1 : 2;
        let ptsPerPennant = isEndGame ? 1 : 2;
        // Exception: 2-tile city is always 2 points? No, standard rules say 2pts/tile unless small city rule (which varies).
        // User spec: "City, Completed during play: 2 points per tile + 2 points per pennant"
        return (component.tiles.length * ptsPerTile) + (pennants * ptsPerPennant);
    }
    if (type === 'm') {
        let t = component.tiles[0];
        let neighbors = 0;
        for(let dx=-1; dx<=1; dx++) {
            for(let dy=-1; dy<=1; dy++) {
                if (dx===0 && dy===0) continue;
                if (placedTiles.has(`${t.x+dx},${t.y+dy}`)) neighbors++;
            }
        }
        return 1 + neighbors;
    }
    return 0;
}

function distributePoints(component, points) {
    if (component.meeples.length === 0) return;
    
    let counts = {};
    let maxCount = 0;
    for(let m of component.meeples) {
        let pid = m.player.id;
        counts[pid] = (counts[pid] || 0) + 1;
        if (counts[pid] > maxCount) maxCount = counts[pid];
    }
    
    for(let pid in counts) {
        if (counts[pid] === maxCount) {
            players[pid].score += points;
        }
    }
}

function removeMeeples(component, type) {
    for(let t of component.tiles) {
        if (t.meeples) {
            for(let i = t.meeples.length - 1; i >= 0; i--) {
                if (t.meeples[i].feature.type === type) {
                    t.meeples[i].player.meeples++; 
                    t.meeples.splice(i, 1);
                }
            }
        }
    }
}

function scoreEndGame() {
    console.log("Scoring End Game...");
    
    // 1. Score incomplete features
    // We need to iterate ALL tiles and find components.
    // To avoid double scoring, we track visited tiles per feature type.
    
    let visited = { w: new Set(), c: new Set(), m: new Set() };
    
    for (let tile of placedTiles.values()) {
        // Roads
        if (!visited.w.has(`${tile.x},${tile.y}`)) {
            let comp = getComponent(tile, 'w');
            if (comp.tiles.length > 0) {
                for(let t of comp.tiles) visited.w.add(`${t.x},${t.y}`);
                if (comp.meeples.length > 0) {
                    let pts = calculateScore(comp, 'w', true);
                    distributePoints(comp, pts);
                }
            }
        }
        // Cities
        if (!visited.c.has(`${tile.x},${tile.y}`)) {
            let comp = getComponent(tile, 'c');
            if (comp.tiles.length > 0) {
                for(let t of comp.tiles) visited.c.add(`${t.x},${t.y}`);
                if (comp.meeples.length > 0) {
                    let pts = calculateScore(comp, 'c', true);
                    distributePoints(comp, pts);
                }
            }
        }
        // Cloisters
        if (tile.piece.key.includes("M")) {
             let comp = getComponent(tile, 'm');
             if (comp.meeples.length > 0) {
                 let pts = calculateScore(comp, 'm', true);
                 distributePoints(comp, pts);
             }
        }
    }
    
    // 2. Score Fields
    scoreFields();
}

function scoreFields() {
    // Find all field components
    let visited = new Set();
    
    for (let tile of placedTiles.values()) {
        // Check if tile has grass
        let hasGrass = false;
        for(let i=0; i<4; i++) if(getEdge(tile.piece, tile.rotation, i) === 'g') hasGrass = true;
        if (!hasGrass) continue;
        
        if (!visited.has(`${tile.x},${tile.y}`)) {
            let fieldComp = getFieldComponent(tile);
            if (fieldComp.tiles.length > 0) {
                for(let t of fieldComp.tiles) visited.add(`${t.x},${t.y}`);
                
                if (fieldComp.meeples.length > 0) {
                    // Calculate score: 3 pts per completed city touched
                    let touchedCities = new Set();
                    
                    for (let fTile of fieldComp.tiles) {
                        // Check if this tile is part of any completed city
                        for (let cityComp of completedCities) {
                            // Does cityComp contain fTile?
                            // Optimization: Map lookup would be faster, but list is small enough
                            let inCity = cityComp.tiles.some(ct => ct.x === fTile.x && ct.y === fTile.y);
                            if (inCity) {
                                // We found a tile that is both in the field component and in a completed city.
                                // This implies adjacency/touching.
                                // (Simplified logic: if a tile has both grass and city, they touch)
                                touchedCities.add(cityComp);
                            }
                        }
                    }
                    
                    let points = touchedCities.size * 3;
                    distributePoints(fieldComp, points);
                }
            }
        }
    }
}

function getFieldComponent(startTile) {
    // Similar to getComponent but for 'g'
    // Simplified: Connected 'g' edges
    let tiles = [];
    let meeples = [];
    let visited = new Set();
    let queue = [startTile];
    visited.add(`${startTile.x},${startTile.y}`);
    
    while(queue.length > 0) {
        let t = queue.shift();
        tiles.push(t);
        
        if (t.meeples) {
            for(let m of t.meeples) {
                if (m.feature.type === 'g') meeples.push(m);
            }
        }
        
        for(let i=0; i<4; i++) {
            let edge = getEdge(t.piece, t.rotation, i);
            // Fields connect across 'g', 'r', and 'w' edges
            if (edge === 'g' || edge === 'r' || edge === 'w') {
                let neighbors = [[0,-1], [1,0], [0,1], [-1,0]];
                let nx = t.x + neighbors[i][0];
                let ny = t.y + neighbors[i][1];
                
                if (placedTiles.has(`${nx},${ny}`)) {
                    let neighbor = placedTiles.get(`${nx},${ny}`);
                    if (!visited.has(`${nx},${ny}`)) {
                        visited.add(`${nx},${ny}`);
                        queue.push(neighbor);
                    }
                }
            }
        }
    }
    return {tiles, meeples};
}

// --- AI Heuristics ---

function getBestMove(moves, piece, player) {
    // Simple heuristic: Maximize immediate points or potential
    let bestMove = moves[0];
    let maxScore = -1;
    
    for (let move of moves) {
        // Simulate move
        // We can't easily simulate full game state, so we approximate
        let score = 0;
        
        if (isMapMode) {
            // Heuristic for Map Mode
            
            // 1. Fill holes / Maximize neighbors (Base score)
            let neighbors = 0;
            let nCoords = [[0,-1], [1,0], [0,1], [-1,0]];
            for(let n of nCoords) {
                if (placedTiles.has(`${move.x+n[0]},${move.y+n[1]}`)) neighbors++;
            }
            score = neighbors * 10;
            
            // 2. Optimize City Size
            if (optimizeCitySize) {
                // Check if this move extends or completes a city
                // We can check edges of the piece being placed
                for(let i=0; i<4; i++) {
                    if (getEdge(piece, move.rotation, i) === 'c') {
                        score += 5; // Bonus for placing city tile
                        
                        // Check if it connects to an existing city
                        let nx = move.x + nCoords[i][0];
                        let ny = move.y + nCoords[i][1];
                        let neighbor = placedTiles.get(`${nx},${ny}`);
                        if (neighbor && getEdge(neighbor.piece, neighbor.rotation, (i+2)%4) === 'c') {
                            score += 10; // Bonus for connecting
                        }
                    }
                }
            }
            
            // 3. Optimize Road Length
            if (optimizeRoadLength) {
                for(let i=0; i<4; i++) {
                    if (getEdge(piece, move.rotation, i) === 'w') {
                        score += 5; // Bonus for placing road tile
                        
                        // Check if it connects to an existing road
                        let nx = move.x + nCoords[i][0];
                        let ny = move.y + nCoords[i][1];
                        let neighbor = placedTiles.get(`${nx},${ny}`);
                        if (neighbor && getEdge(neighbor.piece, neighbor.rotation, (i+2)%4) === 'w') {
                            score += 10; // Bonus for connecting
                        }
                    }
                }
            }
            
        } else {
            // 1. Does it extend a feature I own?
            // 2. Does it complete a feature?
            // 3. Does it block an opponent?
            
            // Random factor to keep it interesting
            score += random(0, 5);
        }
        
        if (score > maxScore) {
            maxScore = score;
            bestMove = move;
        }
    }
    return bestMove;
}

function getBestFeatureToClaim(tile, features, player) {
    // Prioritize:
    // 1. Cities (high points)
    // 2. Fields (long term)
    // 3. Roads
    
    // Filter out features that are already occupied (handled by getAvailableFeatures)
    
    // Sort features by value
    features.sort((a, b) => {
        let valA = getFeatureValue(a.type);
        let valB = getFeatureValue(b.type);
        return valB - valA;
    });
    
    // Don't always place. Conserve meeples if low.
    if (player.meeples < 3 && random() < 0.5) return null;
    
    return features[0];
}

function getFeatureValue(type) {
    if (type === 'c') return 10;
    if (type === 'g') return 8;
    if (type === 'm') return 6;
    if (type === 'w') return 4;
    return 0;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
