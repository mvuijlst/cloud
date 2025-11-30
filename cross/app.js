const alphabet = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
const gridEl = document.getElementById("grid");
const alphabetEl = document.getElementById("alphabet");
const statusEl = document.getElementById("status");
const roundLabelEl = document.getElementById("round-label");
const resetBtn = document.getElementById("reset-round");
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
const desktopInput = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
const MANIFEST_URL = "data/manifest.json";
const SCORE_RULES = {
  START: 200,
  GUESS_COST: 2,
  LOCK_REWARD: 10,
  LOCK_PENALTY: 10,
  HINT_COST: 50,
};

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

resetBtn.addEventListener("click", resetCurrentRound);
nextRoundBtn.addEventListener("click", () => {
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
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && helpModalOpen) {
    toggleHelpModal(false);
  }
});

updateBuyButtonState();

init();
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
    applyRoundState();
  } catch (error) {
    console.error(error);
    statusEl.textContent = "Failed to load next puzzle.";
  }
}

function resetCurrentRound() {
  if (!currentRound) {
    return;
  }
  applyRoundState();
}

function applyRoundState() {
  if (!currentRound) {
    return;
  }
  highlightedLetter = null;
  highlightedCell = null;
  lettersInPlay = new Set();
  givenLetters = new Set(currentRound.freebies);
  usedLetters = new Set(currentRound.freebies);
  resetScore();
  statusEl.textContent = "";
  nextRoundBtn.hidden = true;
  renderMeta(currentRound.puzzle);
  renderGrid(currentRound.gridLines);
  renderAlphabet();
  roundLabelEl.textContent = `Round ${roundCounter}`;
  updateLockButtonState();
  updateBuyButtonState();
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
    await loadNextRound();
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
      cell.dataset.letter = char;
      if (char === "#") {
        cell.classList.add("block");
        cell.tabIndex = -1;
      } else {
        lettersInPlay.add(char);
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
  highlightedCell = cell;
  highlightedLetter = cell.dataset.letter;
  cell.focus();
  updateHighlights();
  updateLockButtonState();
  const count = [...gridEl.querySelectorAll(`[data-letter="${highlightedLetter}"]`)].length;
  statusEl.textContent = `Selected group has ${count} square${count === 1 ? "" : "s"}.`;
}

function updateHighlights() {
  gridEl.querySelectorAll(".cell").forEach((cell) => {
    if (cell.classList.contains("block")) return;
    if (cell.dataset.letter === highlightedLetter) {
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
    } else if (result.isCorrect) {
      adjustScore(SCORE_RULES.LOCK_REWARD);
      statusEl.textContent = `Locked correctly! +${SCORE_RULES.LOCK_REWARD} points.`;
    } else {
      adjustScore(-SCORE_RULES.LOCK_PENALTY);
      markGuessWrong(highlightedLetter);
      unlockGroup(highlightedLetter);
      statusEl.textContent = `Locked wrong. -${SCORE_RULES.LOCK_PENALTY} points. Try again.`;
    }
  }
  updateLockButtonState();
  updateBuyButtonState();
  checkRoundCompletion();
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

function fillLetter(actualLetter, guessLetter) {
  gridEl.querySelectorAll(`[data-letter="${actualLetter}"]`).forEach((cell) => {
    if (cell.dataset.locked === "true") return;
    cell.textContent = guessLetter;
    cell.dataset.guess = guessLetter;
    cell.classList.remove("guess-wrong");
    if (guessLetter && guessLetter === cell.dataset.letter) {
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
  adjustScore(-SCORE_RULES.GUESS_COST);
  updateHighlights();
  updateLockButtonState();
  updateBuyButtonState();
  checkRoundCompletion();
}

function clearGroup(actualLetter) {
  const cells = [...gridEl.querySelectorAll(`[data-letter="${actualLetter}"]`)];
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
  const cell = gridEl.querySelector(`[data-letter="${actualLetter}"]`);
  if (!cell || cell.dataset.locked === "true") {
    return "";
  }
  return cell.dataset.guess || "";
}

function checkRoundCompletion() {
  if (!isRoundSolved()) {
    return;
  }
  const completionMessage = "Round complete!";
  const existing = (statusEl.textContent || "").trim();
  statusEl.textContent = existing && !existing.endsWith(completionMessage)
    ? `${existing} ${completionMessage}`
    : completionMessage;
  nextRoundBtn.hidden = false;
  nextRoundBtn.textContent = "Next puzzle";
}

function isRoundSolved() {
  return ![...gridEl.querySelectorAll(".cell")].some((cell) => {
    if (cell.classList.contains("block")) return false;
    if (cell.dataset.locked === "true") {
      if (cell.dataset.lockType === "player") {
        return cell.dataset.guess !== cell.dataset.letter;
      }
      return false;
    }
    return cell.dataset.guess !== cell.dataset.letter;
  });
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
  usedLetters.delete(removedLetter);
  enableAlphabetLetter(removedLetter);
  if (!isRoundSolved()) {
    nextRoundBtn.hidden = true;
    nextRoundBtn.dataset.mode = "next";
    nextRoundBtn.textContent = "Next round";
    statusEl.textContent = "";
  }
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
  adjustScore(-SCORE_RULES.HINT_COST);
  revealLetter(choice);
  statusEl.textContent = `Bought letter ${choice}. -${SCORE_RULES.HINT_COST} points.`;
  updateHighlights();
  updateLockButtonState();
  updateBuyButtonState();
  checkRoundCompletion();
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
  const letters = new Set();
  if (!gridEl.children.length) {
    return [];
  }
  gridEl.querySelectorAll(".cell").forEach((cell) => {
    if (cell.classList.contains("block")) {
      return;
    }
    if (cell.dataset.lockType === "given" || cell.dataset.lockType === "hint") {
      return;
    }
    if (cell.dataset.guess === cell.dataset.letter && cell.dataset.guess) {
      return;
    }
    letters.add(cell.dataset.letter);
  });
  return [...letters];
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
  document.body.classList.toggle("modal-open", shouldOpen);
  if (shouldOpen) {
    const target = helpModal.querySelector(".modal-content");
    if (target) {
      target.focus();
    }
  } else if (helpOpenBtn) {
    helpOpenBtn.focus();
  }
}

function resetScore() {
  score = SCORE_RULES.START;
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

function getCellsForLetter(actualLetter) {
  if (!actualLetter) {
    return [];
  }
  return [...gridEl.querySelectorAll(`[data-letter="${actualLetter}"]`)].filter((cell) => !cell.classList.contains("block"));
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
    isCorrect = cells.every((cell) => cell.dataset.guess === cell.dataset.letter);
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

