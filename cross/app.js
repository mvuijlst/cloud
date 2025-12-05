const alphabet = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
const gridEl = document.getElementById("grid");
const alphabetEl = document.getElementById("alphabet");
const statusEl = document.getElementById("status");
const roundLabelEl = document.getElementById("round-label");
const nextRoundBtn = document.getElementById("next-round");
const titleEl = document.getElementById("puzzle-title");
const authorEl = document.getElementById("puzzle-author");
const cellTemplate = document.getElementById("cell-template");
const lockBtn = document.getElementById("lock-letter");
const buyLetterBtn = document.getElementById("buy-letter");
const helpOpenBtn = document.getElementById("open-help");
const helpCloseBtn = document.getElementById("close-help");
const helpModal = document.getElementById("help-modal");
const scoreValueEl = document.getElementById("score-value");
const scoreDeltaEl = document.getElementById("score-delta");
const roundSummaryModal = document.getElementById("round-summary-modal");
const roundSummaryCloseBtn = document.getElementById("close-round-summary");
const roundSummaryDismissBtn = document.getElementById("round-summary-close-btn");
const roundSummaryTitleEl = document.getElementById("round-summary-title");
const roundSummaryScoreEl = document.getElementById("round-summary-score");
const roundSummaryRoundEl = document.getElementById("round-summary-round");
const roundSummaryStatsEl = document.getElementById("round-summary-stats");
const roundSummaryBreakdownEl = document.getElementById("round-summary-breakdown");
const cellLetterMap = new WeakMap();
const letterCellMap = new Map();
const SOUND_PATHS = {
  letter: "sound/letter.wav",
  delete: "sound/delete.wav",
  buyletter: "sound/buyletter.mp3",
  lock: "sound/lock.wav",
  wronglock: "sound/wronglock.wav",
  win: "sound/win.mp3",
  lose: "sound/lose.wav",
};
const audioBuffers = new Map();
const audioBufferPromises = new Map();
let audioCtx = null;
const desktopInput = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
const MANIFEST_URL = "data/manifest.json";
const SCORE_RULES = {
  START: 200,
  GUESS_COST: 2,
  LOCK_CORRECT_COST: 10,
  LOCK_INCORRECT_COST: 20,
  HINT_COST: 50,
  UNLOCKED_LETTER_BONUS: 5,
  NO_LOCKS_BONUS: 50,
  LOW_LOCKS_BONUS: 30,
  LOW_LOCKS_THRESHOLD: 3,
  NEXT_PUZZLE_BASE: 200,
  NEXT_PUZZLE_DECAY: 20,
};
const SAVE_STATE_KEY = "cross-game-state-v1";
const SAVE_STATE_DEBOUNCE_MS = 100;

let manifest = [];
let shardQueue = [];
let puzzleQueue = [];
let currentRound = null;
let roundCounter = 0;
let givenLetters = new Set();
let lettersInPlay = new Set();
let highlightedLetter = null;
let highlightedCell = null;
let usedLetters = new Set();
let gridRows = 0;
let gridCols = 0;
let score = SCORE_RULES.START;
let scoreDeltaTimer = null;
let helpModalOpen = false;
let clearButtonRef = null;
let playerLockAttempts = 0;
let roundSolved = false;
let roundStartingScore = SCORE_RULES.START;
let roundSummaryModalOpen = false;
let roundStats = createRoundStats(SCORE_RULES.START);
let pendingRunReset = false;
let saveGameStateTimer = null;
let restoringState = false;
let lastRoundSummaryContext = { bonusInfo: null, gameOver: false };

nextRoundBtn.addEventListener("click", () => {
  applyNextPuzzleBonus();
  nextRoundBtn.disabled = true;
  loadNextRound().finally(() => {
    nextRoundBtn.disabled = false;
  });
});
if (lockBtn) {
  lockBtn.addEventListener("click", handleLockClick);
}
if (buyLetterBtn) {
  buyLetterBtn.addEventListener("click", handleBuyLetterClick);
}
if (helpOpenBtn) {
  helpOpenBtn.addEventListener("click", () => toggleHelpModal(true));
}
if (helpCloseBtn) {
  helpCloseBtn.addEventListener("click", () => toggleHelpModal(false));
}
if (helpModal) {
  helpModal.addEventListener("click", (event) => {
    if (event.target === helpModal) {
      toggleHelpModal(false);
    }
  });
}
if (roundSummaryCloseBtn) {
  roundSummaryCloseBtn.addEventListener("click", handleRoundSummaryContinue);
}
if (roundSummaryDismissBtn) {
  roundSummaryDismissBtn.addEventListener("click", handleRoundSummaryContinue);
}
if (roundSummaryModal) {
  roundSummaryModal.addEventListener("click", (event) => {
    if (event.target === roundSummaryModal) {
      handleRoundSummaryContinue();
    }
  });
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && helpModalOpen) {
    toggleHelpModal(false);
  } else if (event.key === "Escape" && roundSummaryModalOpen) {
    handleRoundSummaryContinue();
  }
});

updateBuyButtonState();

init();
scheduleAudioPrimeListeners();
if (desktopInput) {
  window.addEventListener("keydown", handleKeydown);
}

async function loadNextRound() {
  try {
    const puzzle = await getNextPuzzle();
    const gridLines = decodeGrid(puzzle.grid);
    const freebies = deriveGivenLetters(gridLines);
    currentRound = { puzzle, gridLines, freebies };
    roundCounter += 1;
    roundStartingScore = score;
    applyRoundState();
  } catch (error) {
    console.error(error);
    statusEl.textContent = "Failed to load next puzzle.";
  }
}

function applyRoundState() {
  if (!currentRound) {
    return;
  }
  pendingRunReset = false;
  highlightedLetter = null;
  setHighlightedCell(null);
  lettersInPlay = new Set();
  givenLetters = new Set(currentRound.freebies);
  usedLetters = new Set(currentRound.freebies);
  playerLockAttempts = 0;
  roundSolved = false;
  roundStats = createRoundStats(roundStartingScore);
  toggleRoundSummaryModal(false);
  resetScore();
  statusEl.textContent = "";
  nextRoundBtn.hidden = true;
  renderMeta(currentRound.puzzle);
  renderGrid(currentRound.gridLines);
  renderAlphabet();
  roundLabelEl.textContent = `Round ${roundCounter}`;
  updateLockButtonState();
  updateBuyButtonState();
  scheduleSaveGameState();
}

async function getNextPuzzle() {
  while (!puzzleQueue.length) {
    if (!shardQueue.length) {
      shardQueue = shuffle([...manifest]);
    }
    if (!shardQueue.length) {
      throw new Error("No shards available");
    }
    const shardMeta = shardQueue.shift();
    try {
      const shard = await fetchJSON(shardMeta.url);
      if (!shard || !Array.isArray(shard.puzzles) || !shard.puzzles.length) {
        continue;
      }
      const puzzles = shard.puzzles.map((puzzle) => ({
        ...puzzle,
        publication: puzzle.publication || shard.publication || shardMeta.publication,
        year: puzzle.year || shard.year || shardMeta.year,
      }));
      puzzleQueue.push(...shuffle(puzzles));
    } catch (error) {
      console.error(error);
    }
  }
  return puzzleQueue.shift();
}

async function fetchJSON(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }
  return response.json();
}

function decodeGrid(encoded) {
  try {
    return atob(encoded).split("\n").filter(Boolean);
  } catch (error) {
    console.error("Failed to decode grid", error);
    return [];
  }
}

function deriveGivenLetters(gridLines, maxLetters = 3) {
  const counts = new Map();
  gridLines.forEach((row) => {
    row.split("").forEach((char) => {
      if (char === "#") return;
      counts.set(char, (counts.get(char) || 0) + 1);
    });
  });
  const sorted = [...counts.entries()].sort((a, b) => {
    if (a[1] === b[1]) {
      return a[0].localeCompare(b[0]);
    }
    return a[1] - b[1];
  });
  const picks = sorted.slice(0, Math.min(maxLetters, sorted.length)).map(([letter]) => letter);
  if (!picks.length && counts.size) {
    picks.push(sorted[0][0]);
  }
  return picks;
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatTitle(puzzle) {
  const raw = (puzzle.title || "").trim();
  if (raw) {
    return raw;
  }
  if (puzzle.publication && puzzle.date) {
    return `${puzzle.publication.toUpperCase()}, ${puzzle.date}`;
  }
  if (puzzle.publication) {
    return puzzle.publication.toUpperCase();
  }
  if (puzzle.date) {
    return puzzle.date;
  }
  return "Untitled";
}

function cleanAuthor(author) {
  if (!author) {
    return "";
  }
  return author.replace(/^[\s\W]*by\s+/i, "").trim();
}

async function init() {
  try {
    const data = await fetchJSON(MANIFEST_URL);
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("No puzzle manifest found");
    }
    manifest = data;
    shardQueue = shuffle([...manifest]);
    const restored = tryRestoreSavedState();
    if (!restored) {
      await loadNextRound();
    }
  } catch (error) {
    console.error(error);
    statusEl.textContent = "Unable to load puzzles.";
  }
}

function renderMeta(puzzle) {
  const titleText = formatTitle(puzzle);
  titleEl.textContent = titleText;
  const normalizedTitle = titleText.toLowerCase();
  const parts = [];
  const author = cleanAuthor(puzzle.author);
  if (author) {
    parts.push(`By ${author}`);
  }
  if (puzzle.publication) {
    const publication = puzzle.publication.toUpperCase();
    if (!normalizedTitle.includes(puzzle.publication.toLowerCase())) {
      parts.push(publication);
    }
  }
  if (puzzle.date) {
    if (!normalizedTitle.includes((puzzle.date || "").toLowerCase())) {
      parts.push(puzzle.date);
    }
  }
  authorEl.textContent = parts.join(" • ");
}

function renderGrid(gridLines) {
  gridEl.innerHTML = "";
  letterCellMap.clear();
  if (!gridLines.length) {
    return;
  }
  lettersInPlay = new Set();
  gridRows = gridLines.length;
  const cols = gridLines[0].length;
  gridCols = cols;
  gridEl.style.setProperty("--cols", cols);
  applyResponsiveCellSize(gridLines.length, cols);
  gridLines.forEach((row, rowIndex) => {
    row.split("").forEach((char, colIndex) => {
      const cell = cellTemplate.content.firstElementChild.cloneNode(true);
      cell.dataset.row = rowIndex;
      cell.dataset.col = colIndex;
      if (char === "#") {
        cell.classList.add("block");
        cell.tabIndex = -1;
      } else {
        lettersInPlay.add(char);
        registerLetterCell(cell, char);
        const isGiven = givenLetters.has(char);
        cell.dataset.locked = isGiven ? "true" : "false";
        cell.dataset.lockType = isGiven ? "given" : "";
        cell.dataset.guess = "";
        if (isGiven) {
          cell.textContent = char;
          cell.classList.add("revealed", "locked", "locked-correct");
          cell.dataset.state = "revealed";
          cell.dataset.guess = char;
        } else {
          cell.textContent = "";
          cell.dataset.state = "hidden";
        }
        cell.addEventListener("click", () => handleCellClick(cell));
      }
      gridEl.appendChild(cell);
    });
  });
}

function applyResponsiveCellSize(rows, cols) {
  const container = gridEl.parentElement;
  const containerWidth = container ? container.clientWidth - 24 : window.innerWidth;
  const maxWidthCell = Math.floor(containerWidth / cols) - 2;
  const viewportHeight = window.innerHeight || 800;
  const maxHeight = viewportHeight * 0.75;
  const maxHeightCell = Math.floor(maxHeight / rows) - 2;
  let cellSize = Math.min(48, maxWidthCell);
  if (maxHeightCell > 0) {
    cellSize = Math.min(cellSize, maxHeightCell);
  }
  cellSize = Math.max(18, cellSize);
  gridEl.style.setProperty("--cell-size", `${cellSize}px`);
}

function renderAlphabet() {
  alphabetEl.innerHTML = "";
  clearButtonRef = null;
  alphabet.forEach((letter) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = letter;
    btn.dataset.letter = letter;
    const absent = !lettersInPlay.has(letter);
    const alreadyUsed = usedLetters.has(letter);
    btn.disabled = absent || alreadyUsed;
    if (absent) {
      btn.title = "Not in this puzzle";
    } else if (alreadyUsed) {
      btn.title = "Already placed";
    } else {
      btn.addEventListener("click", () => handleAlphabetClick(letter, btn));
    }
    alphabetEl.appendChild(btn);
  });
  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.textContent = "DEL";
  clearButton.classList.add("control-key");
  clearButton.title = "Clear highlighted letter";
  clearButton.addEventListener("click", handleClearClick);
  alphabetEl.appendChild(clearButton);
  clearButtonRef = clearButton;
}

function handleCellClick(cell) {
  if (!cell || cell.classList.contains("block")) {
    return;
  }
  setHighlightedCell(cell);
  highlightedLetter = getActualLetter(cell);
  if (!highlightedLetter) {
    return;
  }
  cell.focus();
  updateHighlights();
  updateLockButtonState();
  const count = getCellsForLetter(highlightedLetter).length;
  statusEl.textContent = `Selected group has ${count} square${count === 1 ? "" : "s"}.`;
}

function updateHighlights() {
  gridEl.querySelectorAll(".cell").forEach((cell) => {
    if (cell.classList.contains("block")) return;
    const actualLetter = getActualLetter(cell);
    if (actualLetter && actualLetter === highlightedLetter) {
      cell.classList.add("highlight");
    } else {
      cell.classList.remove("highlight");
    }
  });
}

function handleAlphabetClick(letter, button) {
  if (!highlightedLetter) {
    statusEl.textContent = "Select a square first.";
    flashButton(button);
    return;
  }
  applyLetter(letter);
}

function handleClearClick() {
  clearHighlightedGroup(clearButtonRef);
}

function handleLockClick() {
  let stateChanged = false;
  if (!highlightedLetter) {
    statusEl.textContent = "Select a square before locking.";
    if (lockBtn) {
      flashButton(lockBtn);
    }
    return;
  }
  const cells = getCellsForLetter(highlightedLetter);
  if (!cells.length) {
    statusEl.textContent = "Select a valid letter group.";
    return;
  }
  const lockType = cells[0].dataset.lockType;
  if (lockType === "given") {
    statusEl.textContent = "Given letters are already locked.";
    updateLockButtonState();
    return;
  }
  const isLocked = cells[0].dataset.locked === "true";
  if (isLocked) {
    const unlocked = unlockGroup(highlightedLetter);
    statusEl.textContent = unlocked ? "Selection unlocked. You can edit it again." : "Unable to unlock selection.";
    stateChanged = stateChanged || unlocked;
  } else {
    const guess = cells[0].dataset.guess;
    if (!guess) {
      statusEl.textContent = "Choose a letter before locking.";
      if (lockBtn) {
        flashButton(lockBtn);
      }
      return;
    }
    const result = lockGroup(highlightedLetter, "player");
    if (!result || !result.success) {
      statusEl.textContent = "Unable to lock selection.";
    } else {
      playerLockAttempts += 1;
      const lockCost = result.isCorrect
        ? SCORE_RULES.LOCK_CORRECT_COST
        : SCORE_RULES.LOCK_INCORRECT_COST;
      recordLockAttempt(result.isCorrect);
      adjustScore(-lockCost);
      if (result.isCorrect) {
        statusEl.textContent = `Locked correctly. -${lockCost} points.`;
        playSound("lock");
      } else {
        markGuessWrong(highlightedLetter);
        unlockGroup(highlightedLetter);
        statusEl.textContent = `Locked wrong. -${lockCost} points. Try again.`;
        playSound("wronglock");
      }
      stateChanged = true;
    }
  }
  updateLockButtonState();
  updateBuyButtonState();
  checkRoundCompletion();
  if (stateChanged) {
    scheduleSaveGameState();
  }
}

function handleKeydown(event) {
  if (!desktopInput) {
    return;
  }
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }
  const activeElement = document.activeElement;
  const activeTag = activeElement && activeElement.tagName;
  if (activeTag && ["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) {
    return;
  }
  switch (event.key) {
    case "ArrowUp":
      moveSelection(-1, 0);
      event.preventDefault();
      return;
    case "ArrowDown":
      moveSelection(1, 0);
      event.preventDefault();
      return;
    case "ArrowLeft":
      moveSelection(0, -1);
      event.preventDefault();
      return;
    case "ArrowRight":
      moveSelection(0, 1);
      event.preventDefault();
      return;
    default:
      break;
  }
  if (!highlightedLetter) {
    if (/^[a-zA-Z]$/.test(event.key)) {
      statusEl.textContent = "Select a square first.";
    }
    if (event.key === " " || event.key === "Spacebar" || event.key === "Backspace") {
      event.preventDefault();
    }
    return;
  }
  if (event.key === " " || event.key === "Spacebar" || event.key === "Backspace" || event.key === "Delete") {
    const cleared = clearHighlightedGroup(clearButtonRef);
    if (cleared) {
      event.preventDefault();
    }
    return;
  }
  const letter = event.key.toUpperCase();
  if (!alphabet.includes(letter)) {
    return;
  }
  applyLetter(letter);
  event.preventDefault();
}

function moveSelection(deltaRow, deltaCol) {
  if (!highlightedCell) {
    return;
  }
  let row = Number(highlightedCell.dataset.row);
  let col = Number(highlightedCell.dataset.col);
  while (true) {
    row += deltaRow;
    col += deltaCol;
    if (row < 0 || row >= gridRows || col < 0 || col >= gridCols) {
      return;
    }
    const next = gridEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (!next || next.classList.contains("block")) {
      continue;
    }
    handleCellClick(next);
    return;
  }
}

function setHighlightedCell(cell) {
  if (highlightedCell === cell) {
    return;
  }
  if (highlightedCell) {
    highlightedCell.classList.remove("current-cell");
  }
  highlightedCell = cell;
  if (highlightedCell) {
    highlightedCell.classList.add("current-cell");
  }
  scheduleSaveGameState();
}

function fillLetter(actualLetter, guessLetter) {
  getCellsForLetter(actualLetter).forEach((cell) => {
    if (cell.dataset.locked === "true") return;
    cell.textContent = guessLetter;
    cell.dataset.guess = guessLetter;
    cell.classList.remove("guess-wrong");
    if (guessLetter && guessLetter === getActualLetter(cell)) {
      cell.classList.add("solved");
      cell.dataset.state = "solved";
    } else {
      cell.classList.remove("solved");
      cell.dataset.state = "guess";
    }
  });
}

function applyLetter(letter) {
  if (!highlightedLetter) {
    return;
  }
  const cells = getCellsForLetter(highlightedLetter);
  if (cells.length && cells[0].dataset.locked === "true") {
    statusEl.textContent = cells[0].dataset.lockType === "given" ? "Given letters cannot be changed." : "Unlock this letter before changing it.";
    return;
  }
  if (usedLetters.has(letter) || !lettersInPlay.has(letter)) {
    return;
  }
  const previousGuess = getGroupGuess(highlightedLetter);
  if (previousGuess === letter) {
    return;
  }
  if (previousGuess) {
    usedLetters.delete(previousGuess);
    enableAlphabetLetter(previousGuess);
  }
  fillLetter(highlightedLetter, letter);
  usedLetters.add(letter);
  disableAlphabetLetter(letter);
  playSound("letter");
  recordGuessPenalty(SCORE_RULES.GUESS_COST);
  adjustScore(-SCORE_RULES.GUESS_COST);
  updateHighlights();
  updateLockButtonState();
  updateBuyButtonState();
  checkRoundCompletion();
  scheduleSaveGameState();
}

function clearGroup(actualLetter) {
  const cells = getCellsForLetter(actualLetter);
  if (!cells.length) {
    return null;
  }
  const first = cells[0];
  if (first.dataset.locked === "true") {
    return null;
  }
  const removedLetter = first.dataset.guess;
  if (!removedLetter) {
    return null;
  }
  cells.forEach((cell) => {
    cell.textContent = "";
    cell.dataset.guess = "";
    cell.classList.remove("solved");
    cell.classList.remove("guess-wrong");
    cell.dataset.state = "hidden";
  });
  return removedLetter;
}

function getGroupGuess(actualLetter) {
  const cell = getSampleCell(actualLetter);
  if (!cell || cell.dataset.locked === "true") {
    return "";
  }
  return cell.dataset.guess || "";
}

function checkRoundCompletion() {
  if (roundSolved || !isRoundSolved()) {
    return;
  }
  roundSolved = true;
  const bonusInfo = applyCompletionBonuses();
  const isGameOver = score < 0;
  playSound(isGameOver ? "lose" : "win");
  pendingRunReset = isGameOver;
  let completionMessage = buildCompletionMessage(bonusInfo);
  if (isGameOver) {
    completionMessage = `${completionMessage} Score fell below zero -- game over.`;
  }
  const existing = (statusEl.textContent || "").trim();
  statusEl.textContent = existing ? `${existing} ${completionMessage}` : completionMessage;
  renderRoundSummary(bonusInfo, isGameOver);
  if (nextRoundBtn) {
    nextRoundBtn.hidden = isGameOver;
    nextRoundBtn.disabled = isGameOver;
    nextRoundBtn.textContent = "Next puzzle";
  }
  scheduleSaveGameState();
}

function isRoundSolved() {
  for (const cells of letterCellMap.values()) {
    const needsWork = cells.some((cell) => {
      const actual = getActualLetter(cell);
      if (cell.dataset.locked === "true") {
        if (cell.dataset.lockType === "player") {
          return cell.dataset.guess !== actual;
        }
        return false;
      }
      return cell.dataset.guess !== actual;
    });
    if (needsWork) {
      return false;
    }
  }
  return true;
}

function clearHighlightedGroup(buttonRef = null) {
  if (!highlightedLetter) {
    statusEl.textContent = "Select a square to clear.";
    if (buttonRef) {
      flashButton(buttonRef);
    }
    return null;
  }
  const cells = getCellsForLetter(highlightedLetter);
  if (!cells.length) {
    statusEl.textContent = "Select a valid letter group.";
    return null;
  }
  if (cells[0].dataset.locked === "true") {
    const lockType = cells[0].dataset.lockType;
    statusEl.textContent = lockType === "given" ? "Given letters cannot be cleared." : "Unlock this letter before clearing.";
    if (buttonRef) {
      flashButton(buttonRef);
    }
    return null;
  }
  const removedLetter = clearGroup(highlightedLetter);
  updateHighlights();
  updateLockButtonState();
  updateBuyButtonState();
  if (!removedLetter) {
    return null;
  }
  playSound("delete");
  usedLetters.delete(removedLetter);
  enableAlphabetLetter(removedLetter);
  if (!isRoundSolved()) {
    nextRoundBtn.hidden = true;
    nextRoundBtn.dataset.mode = "next";
    nextRoundBtn.textContent = "Next round";
    statusEl.textContent = "";
  }
  scheduleSaveGameState();
  return removedLetter;
}

function disableAlphabetLetter(letter) {
  const button = alphabetEl.querySelector(`[data-letter="${letter}"]`);
  if (button) {
    button.disabled = true;
    button.title = "Already placed";
  }
}

function enableAlphabetLetter(letter) {
  const button = alphabetEl.querySelector(`[data-letter="${letter}"]`);
  if (button && lettersInPlay.has(letter)) {
    button.disabled = false;
    button.title = "";
  }
}

function flashButton(button) {
  button.classList.add("wrong");
  setTimeout(() => button.classList.remove("wrong"), 450);
}

function markGuessWrong(actualLetter) {
  if (!actualLetter) {
    return;
  }
  getCellsForLetter(actualLetter).forEach((cell) => {
    if (cell.dataset.lockType === "given") {
      return;
    }
    cell.classList.add("guess-wrong");
  });
}

function handleBuyLetterClick() {
  const options = getBuyableLetters();
  if (!options.length) {
    statusEl.textContent = "No letters left to buy.";
    if (buyLetterBtn) {
      flashButton(buyLetterBtn);
    }
    return;
  }
  const choice = options[Math.floor(Math.random() * options.length)];
  recordHintPurchase(SCORE_RULES.HINT_COST);
  adjustScore(-SCORE_RULES.HINT_COST);
  revealLetter(choice);
  playSound("buyletter");
  statusEl.textContent = `Bought letter ${choice}. -${SCORE_RULES.HINT_COST} points.`;
  updateHighlights();
  updateLockButtonState();
  updateBuyButtonState();
  checkRoundCompletion();
  scheduleSaveGameState();
}

function revealLetter(actualLetter) {
  if (!actualLetter) {
    return;
  }
  const previous = getGroupGuess(actualLetter);
  if (previous && previous !== actualLetter) {
    usedLetters.delete(previous);
    enableAlphabetLetter(previous);
  }
  fillLetter(actualLetter, actualLetter);
  usedLetters.add(actualLetter);
  disableAlphabetLetter(actualLetter);
  lockGroup(actualLetter, "hint");
}

function getBuyableLetters() {
  const letters = [];
  letterCellMap.forEach((cells, letter) => {
    const eligible = cells.some((cell) => {
      if (cell.dataset.lockType === "given" || cell.dataset.lockType === "hint") {
        return false;
      }
      const actual = getActualLetter(cell);
      return !(cell.dataset.guess && cell.dataset.guess === actual);
    });
    if (eligible) {
      letters.push(letter);
    }
  });
  return letters;
}

function updateBuyButtonState() {
  if (!buyLetterBtn) {
    return;
  }
  if (!currentRound) {
    buyLetterBtn.disabled = true;
    return;
  }
  const hasOptions = getBuyableLetters().length > 0;
  buyLetterBtn.disabled = !hasOptions;
}

function toggleHelpModal(shouldOpen) {
  if (!helpModal) {
    return;
  }
  helpModalOpen = shouldOpen;
  helpModal.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
  helpModal.classList.toggle("is-visible", shouldOpen);
  helpModal.hidden = !shouldOpen;
  if (shouldOpen) {
    document.body.classList.add("modal-open");
  } else if (!roundSummaryModalOpen) {
    document.body.classList.remove("modal-open");
  }
  if (shouldOpen) {
    const target = helpModal.querySelector(".modal-content");
    if (target) {
      target.focus();
    }
  } else if (helpOpenBtn) {
    helpOpenBtn.focus();
  }
}

function createRoundStats(startScore = SCORE_RULES.START) {
  return {
    startScore,
    guessCount: 0,
    guessPenalty: 0,
    lockCount: 0,
    correctLockCount: 0,
    wrongLockCount: 0,
    lockCostTotal: 0,
    wrongLockPenaltyTotal: 0,
    hintCount: 0,
    hintCostTotal: 0,
  };
}

function recordGuessPenalty(cost) {
  if (!roundStats) {
    return;
  }
  roundStats.guessCount += 1;
  roundStats.guessPenalty += cost;
}

function recordLockAttempt(isCorrect) {
  if (!roundStats) {
    return;
  }
  roundStats.lockCount += 1;
  roundStats.lockCostTotal += SCORE_RULES.LOCK_CORRECT_COST;
  if (isCorrect) {
    roundStats.correctLockCount += 1;
    return;
  }
  roundStats.wrongLockCount += 1;
  const extraPenalty = Math.max(0, SCORE_RULES.LOCK_INCORRECT_COST - SCORE_RULES.LOCK_CORRECT_COST);
  if (extraPenalty > 0) {
    roundStats.wrongLockPenaltyTotal += extraPenalty;
  }
}

function recordHintPurchase(cost) {
  if (!roundStats || typeof cost !== "number") {
    return;
  }
  roundStats.hintCount += 1;
  roundStats.hintCostTotal += cost;
}

function toggleRoundSummaryModal(shouldOpen) {
  if (!roundSummaryModal) {
    return;
  }
  roundSummaryModalOpen = shouldOpen;
  roundSummaryModal.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
  roundSummaryModal.classList.toggle("is-visible", shouldOpen);
  roundSummaryModal.hidden = !shouldOpen;
  if (shouldOpen) {
    document.body.classList.add("modal-open");
  } else if (!helpModalOpen) {
    document.body.classList.remove("modal-open");
  }
  if (shouldOpen) {
    const target = roundSummaryModal.querySelector(".modal-content");
    if (target) {
      target.focus();
    }
  } else if (nextRoundBtn) {
    nextRoundBtn.focus();
  }
  scheduleSaveGameState();
}

function handleRoundSummaryContinue() {
  if (!roundSummaryModalOpen && !pendingRunReset) {
    return;
  }
  if (roundSummaryModalOpen) {
    toggleRoundSummaryModal(false);
  }
  if (pendingRunReset) {
    startNewRun();
    return;
  }
  if (nextRoundBtn && !nextRoundBtn.disabled) {
    nextRoundBtn.click();
  }
}

function startNewRun() {
  pendingRunReset = false;
  if (!manifest.length) {
    statusEl.textContent = "Unable to restart -- no puzzles available.";
    return;
  }
  clearSavedGameState();
  roundCounter = 0;
  roundStartingScore = SCORE_RULES.START;
  score = SCORE_RULES.START;
  roundStats = createRoundStats(score);
  renderScore(0);
  statusEl.textContent = "Score fell below zero. Restarting at round 1.";
  if (nextRoundBtn) {
    nextRoundBtn.hidden = true;
    nextRoundBtn.disabled = true;
  }
  puzzleQueue = [];
  shardQueue = shuffle([...manifest]);
  loadNextRound().finally(() => {
    if (nextRoundBtn) {
      nextRoundBtn.disabled = false;
    }
  });
}

function resetScore() {
  score = roundStartingScore;
  renderScore(0);
}

function adjustScore(delta) {
  if (typeof delta !== "number" || Number.isNaN(delta)) {
    return;
  }
  score += delta;
  renderScore(delta);
}

function renderScore(delta = 0) {
  if (scoreValueEl) {
    scoreValueEl.textContent = score;
  }
  updateScoreDelta(delta);
}

function updateScoreDelta(delta) {
  if (!scoreDeltaEl) {
    return;
  }
  if (!delta) {
    scoreDeltaEl.textContent = "";
    if (scoreDeltaTimer) {
      clearTimeout(scoreDeltaTimer);
      scoreDeltaTimer = null;
    }
    return;
  }
  const formatted = `${delta > 0 ? "+" : ""}${delta}`;
  scoreDeltaEl.textContent = formatted;
  scoreDeltaEl.style.color = delta > 0 ? "var(--score-up)" : "var(--score-down)";
  if (scoreDeltaTimer) {
    clearTimeout(scoreDeltaTimer);
  }
  scoreDeltaTimer = setTimeout(() => {
    scoreDeltaEl.textContent = "";
    scoreDeltaTimer = null;
  }, 2000);
}

function registerLetterCell(cell, actualLetter) {
  cellLetterMap.set(cell, actualLetter);
  if (!letterCellMap.has(actualLetter)) {
    letterCellMap.set(actualLetter, []);
  }
  letterCellMap.get(actualLetter).push(cell);
}

function getActualLetter(cell) {
  return cellLetterMap.get(cell) || "";
}

function getCellsForLetter(actualLetter) {
  if (!actualLetter || !letterCellMap.has(actualLetter)) {
    return [];
  }
  return letterCellMap.get(actualLetter);
}

function getSampleCell(actualLetter) {
  const cells = getCellsForLetter(actualLetter);
  return cells.length ? cells[0] : null;
}

function lockGroup(actualLetter, lockType = "player") {
  const cells = getCellsForLetter(actualLetter);
  if (!cells.length) {
    return { success: false, isCorrect: false };
  }
  let isCorrect = true;
  if (lockType === "player") {
    const guess = cells[0].dataset.guess;
    if (!guess) {
      return { success: false, isCorrect: false };
    }
    isCorrect = cells.every((cell) => cell.dataset.guess === getActualLetter(cell));
  }
  cells.forEach((cell) => {
    cell.dataset.locked = "true";
    cell.dataset.lockType = lockType;
    cell.classList.add("locked");
    const showWrong = lockType === "player" && !isCorrect;
    const showCorrect = lockType !== "player" || (lockType === "player" && isCorrect);
    cell.classList.toggle("locked-wrong", showWrong);
    cell.classList.toggle("locked-correct", showCorrect);
  });
  return { success: true, isCorrect };
}

function unlockGroup(actualLetter) {
  const cells = getCellsForLetter(actualLetter);
  if (!cells.length) {
    return false;
  }
  if (cells.some((cell) => cell.dataset.lockType === "given")) {
    return false;
  }
  cells.forEach((cell) => {
    cell.dataset.locked = "false";
    cell.dataset.lockType = "";
    cell.classList.remove("locked", "locked-wrong", "locked-correct");
  });
  return true;
}

function updateLockButtonState() {
  if (!lockBtn) {
    return;
  }
  if (!highlightedLetter) {
    lockBtn.disabled = true;
    lockBtn.textContent = "Lock selection";
    lockBtn.dataset.mode = "lock";
    return;
  }
  const cells = getCellsForLetter(highlightedLetter);
  if (!cells.length) {
    lockBtn.disabled = true;
    lockBtn.textContent = "Lock selection";
    lockBtn.dataset.mode = "lock";
    return;
  }
  if (cells.some((cell) => cell.dataset.lockType === "given")) {
    lockBtn.disabled = true;
    lockBtn.textContent = "Locked (given)";
    lockBtn.dataset.mode = "locked";
    return;
  }
  const isLocked = cells[0].dataset.locked === "true";
  if (isLocked) {
    lockBtn.disabled = false;
    lockBtn.textContent = "Unlock selection";
    lockBtn.dataset.mode = "unlock";
    return;
  }
  const hasGuess = Boolean(cells[0].dataset.guess);
  lockBtn.disabled = !hasGuess;
  lockBtn.textContent = "Lock selection";
  lockBtn.dataset.mode = "lock";
}

function applyNextPuzzleBonus() {
  if (!roundSolved || !roundCounter) {
    return;
  }
  const bonus = SCORE_RULES.NEXT_PUZZLE_BASE - (SCORE_RULES.NEXT_PUZZLE_DECAY * roundCounter);
  if (!Number.isFinite(bonus)) {
    return;
  }
  adjustScore(bonus);
  const message = `Next puzzle bonus ${bonus >= 0 ? "+" : ""}${bonus} points.`;
  const existing = (statusEl.textContent || "").trim();
  statusEl.textContent = existing ? `${existing} ${message}` : message;
  scheduleSaveGameState();
}

function applyCompletionBonuses() {
  const unlockedLetterCount = countUnlockedLetters();
  const summary = {
    totalBonus: 0,
    unlockedLetterCount,
    unlockedBonus: 0,
    noLockBonus: 0,
    lowLockBonus: 0,
    lockCount: playerLockAttempts,
  };
  if (unlockedLetterCount > 0) {
    summary.unlockedBonus = unlockedLetterCount * SCORE_RULES.UNLOCKED_LETTER_BONUS;
    summary.totalBonus += summary.unlockedBonus;
  }
  if (playerLockAttempts === 0) {
    summary.noLockBonus = SCORE_RULES.NO_LOCKS_BONUS;
    summary.totalBonus += summary.noLockBonus;
  }
  if (playerLockAttempts <= SCORE_RULES.LOW_LOCKS_THRESHOLD) {
    summary.lowLockBonus = SCORE_RULES.LOW_LOCKS_BONUS;
    summary.totalBonus += summary.lowLockBonus;
  }
  if (summary.totalBonus) {
    adjustScore(summary.totalBonus);
  }
  return summary;
}

function countUnlockedLetters() {
  let unlocked = 0;
  letterCellMap.forEach((cells) => {
    const sample = cells[0];
    if (sample && !sample.dataset.lockType) {
      unlocked += 1;
    }
  });
  return unlocked;
}

function buildCompletionMessage(bonusInfo) {
  const base = "Round complete!";
  if (!bonusInfo || !bonusInfo.totalBonus) {
    return base;
  }
  const details = [];
  if (bonusInfo.unlockedBonus) {
    details.push(`+${bonusInfo.unlockedBonus} for ${bonusInfo.unlockedLetterCount} unlocked letters`);
  }
  if (bonusInfo.noLockBonus) {
    details.push(`+${bonusInfo.noLockBonus} no-lock bonus`);
  }
  if (bonusInfo.lowLockBonus) {
    details.push(`+${bonusInfo.lowLockBonus} low-lock bonus`);
  }
  const detailText = details.length ? ` Bonus ${details.join(", ")}.` : "";
  return `${base}${detailText}`;
}

function renderRoundSummary(bonusInfo = {}, gameOver = false) {
  if (!roundSummaryModal || !roundSummaryScoreEl || !roundSummaryStatsEl || !roundSummaryBreakdownEl) {
    return;
  }
  const unlockedLetters = bonusInfo.unlockedLetterCount || 0;
  const stats = [
    { label: "Unlocked letters", value: unlockedLetters },
    { label: "Locks used", value: roundStats.lockCount },
    { label: "Correct locks", value: `${roundStats.correctLockCount}/${roundStats.lockCount || 0}` },
    { label: "Hints bought", value: roundStats.hintCount },
  ];
  if (roundSummaryTitleEl) {
    roundSummaryTitleEl.textContent = gameOver ? "Game over" : "Round complete";
  }
  if (roundSummaryDismissBtn) {
    roundSummaryDismissBtn.textContent = gameOver ? "Start over" : "Play next puzzle";
  }
  if (roundSummaryRoundEl) {
    roundSummaryRoundEl.textContent = `Round ${roundCounter}`;
  }
  roundSummaryStatsEl.innerHTML = stats
    .map((stat) => `<div class="summary-stat"><span>${stat.label}</span><strong>${stat.value}</strong></div>`)
    .join("");
  roundSummaryScoreEl.textContent = score;
  roundSummaryScoreEl.classList.toggle("negative", score < 0);
  roundSummaryBreakdownEl.innerHTML = buildRoundSummaryBreakdown(bonusInfo, unlockedLetters);
  lastRoundSummaryContext = {
    bonusInfo: bonusInfo ? JSON.parse(JSON.stringify(bonusInfo)) : {},
    gameOver,
  };
  toggleRoundSummaryModal(true);
  scheduleSaveGameState();
}

function buildRoundSummaryBreakdown(bonusInfo, unlockedLetters) {
  const entries = [];
  entries.push({ label: "Start", value: roundStats.startScore, signed: false, highlight: false });
  if (roundStats.guessCount > 0) {
    entries.push({ label: "Letter guesses", value: -roundStats.guessPenalty, signed: true, highlight: false });
  }
  if (roundStats.hintCount > 0) {
    entries.push({ label: `Hints (${roundStats.hintCount})`, value: -roundStats.hintCostTotal, signed: true, highlight: false });
  }
  if (roundStats.lockCount > 0) {
    entries.push({ label: "Locks", value: -roundStats.lockCostTotal, signed: true, highlight: false });
  }
  if (roundStats.wrongLockCount > 0 && roundStats.wrongLockPenaltyTotal > 0) {
    entries.push({ label: "Wrong locks", value: -roundStats.wrongLockPenaltyTotal, signed: true, highlight: false });
  }
  if (bonusInfo.unlockedBonus) {
    entries.push({
      label: `Bravery bonus (${unlockedLetters} unlocked)`,
      value: bonusInfo.unlockedBonus,
      signed: true,
      highlight: false,
    });
  }
  if (bonusInfo.noLockBonus) {
    entries.push({ label: "No-lock bonus", value: bonusInfo.noLockBonus, signed: true, highlight: false });
  }
  if (bonusInfo.lowLockBonus) {
    entries.push({ label: "Low-lock bonus", value: bonusInfo.lowLockBonus, signed: true, highlight: false });
  }
  entries.push({ label: "Final", value: score, signed: false, highlight: true, isNegative: score < 0 });
  return entries
    .map((entry) => {
      const valueClass = ["value"];
      if (entry.highlight) {
        valueClass.push(entry.isNegative ? "final-negative" : "final");
      } else if (entry.signed && entry.value > 0) {
        valueClass.push("positive");
      } else if (entry.signed && entry.value < 0) {
        valueClass.push("negative");
      }
      const text = entry.signed ? formatSignedValue(entry.value) : `${entry.value}`;
      return `<li><span class="label">${entry.label}</span><span class="${valueClass.join(" ")}">${text}</span></li>`;
    })
    .join("");
}

function formatSignedValue(value) {
  if (value > 0) {
    return `+${value}`;
  }
  if (value < 0) {
    return `${value}`;
  }
  return "0";
}

function scheduleSaveGameState() {
  if (restoringState) {
    return;
  }
  if (saveGameStateTimer) {
    clearTimeout(saveGameStateTimer);
  }
  saveGameStateTimer = setTimeout(() => {
    saveGameStateTimer = null;
    saveGameState();
  }, SAVE_STATE_DEBOUNCE_MS);
}

function saveGameState() {
  if (restoringState || typeof window === "undefined" || !window.localStorage) {
    return;
  }
  const snapshot = buildGameStateSnapshot();
  if (!snapshot) {
    clearSavedGameState();
    return;
  }
  try {
    window.localStorage.setItem(SAVE_STATE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("Unable to save game state", error);
  }
}

function buildGameStateSnapshot() {
  if (!currentRound || !currentRound.puzzle) {
    return null;
  }
  const letterStates = collectLetterStates();
  const highlighted = highlightedCell
    ? {
        row: Number(highlightedCell.dataset.row),
        col: Number(highlightedCell.dataset.col),
      }
    : null;
  const roundSummarySnapshot = {
    open: roundSummaryModalOpen,
    bonusInfo: lastRoundSummaryContext.bonusInfo || {},
    gameOver: lastRoundSummaryContext.gameOver || false,
  };
  return {
    version: 1,
    timestamp: Date.now(),
    roundCounter,
    roundStartingScore,
    roundSolved,
    score,
    playerLockAttempts,
    statusMessage: statusEl ? statusEl.textContent : "",
    highlightedCell: highlighted,
    highlightedLetter,
    roundStats: roundStats ? JSON.parse(JSON.stringify(roundStats)) : createRoundStats(roundStartingScore),
    currentRound: {
      puzzle: currentRound.puzzle,
      gridLines: currentRound.gridLines,
      freebies: currentRound.freebies,
    },
    givenLetters: Array.from(givenLetters),
    usedLetters: Array.from(usedLetters),
    roundSummary: roundSummarySnapshot,
    pendingRunReset,
    nextRoundBtn: nextRoundBtn
      ? {
          hidden: nextRoundBtn.hidden,
          disabled: nextRoundBtn.disabled,
          text: nextRoundBtn.textContent,
        }
      : null,
    letterStates,
    puzzleQueue,
    shardQueue,
  };
}

function collectLetterStates() {
  const states = [];
  letterCellMap.forEach((cells, letter) => {
    if (!cells || !cells.length) {
      return;
    }
    const sample = cells[0];
    states.push({
      letter,
      guess: sample.dataset.guess || "",
      locked: sample.dataset.locked === "true",
      lockType: sample.dataset.lockType || "",
      state: sample.dataset.state || "",
    });
  });
  return states;
}

function tryRestoreSavedState() {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }
  let raw;
  try {
    raw = window.localStorage.getItem(SAVE_STATE_KEY);
  } catch (error) {
    console.warn("Unable to access saved game state", error);
    return false;
  }
  if (!raw) {
    return false;
  }
  let snapshot;
  try {
    snapshot = JSON.parse(raw);
  } catch (error) {
    console.error("Failed to parse saved game state", error);
    clearSavedGameState();
    return false;
  }
  if (!snapshot || snapshot.version !== 1) {
    clearSavedGameState();
    return false;
  }
  restoringState = true;
  let success = false;
  try {
    restoreFromSnapshot(snapshot);
    success = true;
  } catch (error) {
    console.error("Failed to restore saved game state", error);
    clearSavedGameState();
  } finally {
    restoringState = false;
  }
  if (success) {
    scheduleSaveGameState();
  }
  return success;
}

function restoreFromSnapshot(snapshot) {
  if (!snapshot.currentRound || !snapshot.currentRound.puzzle || !snapshot.currentRound.gridLines) {
    throw new Error("Saved puzzle data is missing");
  }
  currentRound = {
    puzzle: snapshot.currentRound.puzzle,
    gridLines: snapshot.currentRound.gridLines,
    freebies: snapshot.currentRound.freebies || [],
  };
  roundCounter = snapshot.roundCounter || 0;
  roundStartingScore = typeof snapshot.roundStartingScore === "number" ? snapshot.roundStartingScore : SCORE_RULES.START;
  score = typeof snapshot.score === "number" ? snapshot.score : SCORE_RULES.START;
  roundSolved = Boolean(snapshot.roundSolved);
  pendingRunReset = Boolean(snapshot.pendingRunReset);
  playerLockAttempts = snapshot.playerLockAttempts || 0;
  roundStats = normalizeRoundStats(snapshot.roundStats, roundStartingScore);
  if (Array.isArray(snapshot.puzzleQueue)) {
    puzzleQueue = snapshot.puzzleQueue;
  }
  if (Array.isArray(snapshot.shardQueue)) {
    shardQueue = snapshot.shardQueue;
  }
  const letterStates = snapshot.letterStates || [];
  givenLetters = new Set(snapshot.givenLetters || currentRound.freebies || []);
  const derivedUsedLetters = deriveUsedLettersFromStates(letterStates, currentRound.freebies);
  usedLetters = derivedUsedLetters.size ? derivedUsedLetters : new Set(snapshot.usedLetters || currentRound.freebies || []);
  renderMeta(currentRound.puzzle);
  renderGrid(currentRound.gridLines);
  applySavedLetterStates(letterStates);
  renderAlphabet();
  roundLabelEl.textContent = `Round ${roundCounter}`;
  statusEl.textContent = snapshot.statusMessage || "";
  renderScore(0);
  if (nextRoundBtn && snapshot.nextRoundBtn) {
    nextRoundBtn.hidden = Boolean(snapshot.nextRoundBtn.hidden);
    nextRoundBtn.disabled = Boolean(snapshot.nextRoundBtn.disabled);
    if (typeof snapshot.nextRoundBtn.text === "string" && snapshot.nextRoundBtn.text.length) {
      nextRoundBtn.textContent = snapshot.nextRoundBtn.text;
    }
  }
  highlightedLetter = snapshot.highlightedLetter || null;
  if (snapshot.highlightedCell) {
    const selector = `[data-row="${snapshot.highlightedCell.row}"][data-col="${snapshot.highlightedCell.col}"]`;
    const cell = gridEl.querySelector(selector);
    if (cell) {
      setHighlightedCell(cell);
      highlightedLetter = highlightedLetter || getActualLetter(cell);
    } else {
      setHighlightedCell(null);
    }
  } else {
    setHighlightedCell(null);
  }
  const summaryInfo = snapshot.roundSummary || {};
  lastRoundSummaryContext = {
    bonusInfo: summaryInfo.bonusInfo || {},
    gameOver: Boolean(summaryInfo.gameOver),
  };
  if (summaryInfo.open && summaryInfo.bonusInfo) {
    renderRoundSummary(summaryInfo.bonusInfo, Boolean(summaryInfo.gameOver));
  } else {
    toggleRoundSummaryModal(false);
  }
  updateHighlights();
  updateLockButtonState();
  updateBuyButtonState();
}

function applySavedLetterStates(letterStates = []) {
  letterStates.forEach((entry) => {
    if (!entry || entry.lockType === "given") {
      return;
    }
    const cells = getCellsForLetter(entry.letter);
    if (!cells.length) {
      return;
    }
    if (entry.guess) {
      fillLetter(entry.letter, entry.guess);
    } else {
      cells.forEach((cell) => {
        if (cell.dataset.lockType === "given") {
          return;
        }
        cell.textContent = "";
        cell.dataset.guess = "";
        cell.dataset.state = "hidden";
        cell.classList.remove("solved", "guess-wrong");
      });
    }
    cells.forEach((cell) => {
      if (entry.locked) {
        cell.dataset.locked = "true";
        cell.dataset.lockType = entry.lockType || "";
        cell.classList.add("locked");
        const actual = getActualLetter(cell);
        const isPlayerLock = entry.lockType === "player";
        const showWrong = isPlayerLock && entry.guess && entry.guess !== actual;
        const showCorrect = !isPlayerLock || !showWrong;
        cell.classList.toggle("locked-wrong", showWrong);
        cell.classList.toggle("locked-correct", showCorrect);
      } else if (cell.dataset.lockType !== "given") {
        cell.dataset.locked = "false";
        cell.dataset.lockType = "";
        cell.classList.remove("locked", "locked-wrong", "locked-correct");
      }
    });
  });
}

function deriveUsedLettersFromStates(letterStates = [], fallback = []) {
  const derived = new Set(Array.isArray(fallback) ? fallback : []);
  letterStates.forEach((entry) => {
    if (entry && entry.guess) {
      derived.add(entry.guess);
    }
  });
  return derived;
}

function normalizeRoundStats(savedStats, startScore) {
  const base = createRoundStats(startScore);
  if (!savedStats) {
    return base;
  }
  return {
    ...base,
    ...savedStats,
    startScore: savedStats.startScore != null ? savedStats.startScore : startScore,
  };
}

function clearSavedGameState() {
  if (saveGameStateTimer) {
    clearTimeout(saveGameStateTimer);
    saveGameStateTimer = null;
  }
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(SAVE_STATE_KEY);
  } catch (error) {
    console.warn("Unable to clear saved game state", error);
  }
}

function playSound(name) {
  const ctx = ensureAudioContext();
  if (!ctx) {
    return;
  }
  resumeAudioContext();
  const bufferPromise = getAudioBuffer(name, ctx);
  if (!bufferPromise) {
    return;
  }
  bufferPromise
    .then((buffer) => {
      if (!buffer || !ctx) {
        return;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    })
    .catch(() => {});
}

function ensureAudioContext() {
  if (audioCtx) {
    return audioCtx;
  }
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }
  audioCtx = new AudioContextCtor();
  return audioCtx;
}

function resumeAudioContext() {
  if (!audioCtx) {
    return;
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}

function getAudioBuffer(name, ctx) {
  if (!SOUND_PATHS[name]) {
    return null;
  }
  if (audioBuffers.has(name)) {
    return Promise.resolve(audioBuffers.get(name));
  }
  if (audioBufferPromises.has(name)) {
    return audioBufferPromises.get(name);
  }
  const promise = fetch(SOUND_PATHS[name])
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load ${SOUND_PATHS[name]}`);
      }
      return response.arrayBuffer();
    })
    .then((data) => ctx.decodeAudioData(data))
    .then((decoded) => {
      audioBuffers.set(name, decoded);
      return decoded;
    })
    .catch((error) => {
      console.error(error);
      throw error;
    })
    .finally(() => {
      audioBufferPromises.delete(name);
    });
  audioBufferPromises.set(name, promise);
  return promise;
}

function scheduleAudioPrimeListeners() {
  const unlock = () => {
    resumeAudioContext();
    document.removeEventListener("pointerdown", unlock, true);
    document.removeEventListener("keydown", unlock, true);
  };
  document.addEventListener("pointerdown", unlock, true);
  document.addEventListener("keydown", unlock, true);
}

