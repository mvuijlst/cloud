import { BasicRuntime } from "./interpreter.js";

const SCREEN_COLUMNS = 64;
const SCREEN_ROWS = 16;
const PROMPT_PREFIX = "] ";
const CONTINUE_PROMPT = "?CONTINUE";
const SPEED_SEQUENCE = ["slow", "normal", "turbo"];
const SPEED_LABELS = {
  slow: "SLOW",
  normal: "NORMAL",
  turbo: "TURBO",
};
const STORAGE_INDEX_KEY = "trs80.basic.directory";
const STORAGE_PROGRAM_PREFIX = "trs80.basic.program.";

const terminal = document.querySelector("#terminal");
const form = document.querySelector("#prompt-form");
const input = document.querySelector("#command-input");
const clock = document.querySelector("#clock");
const speedSwitch = document.querySelector("#speed-switch");
const speedValue = document.querySelector("#speed-value");

const demoProgram = [
  [5, "DIM SX(127),SY(127)"],
  [10, "CLS"],
  [20, 'PRINT @0,"SCORE ";S;"    HI ";H;"                    HUNT THE @";'],
  [30, 'PRINT @64,"+-------------------------------------------------------------+ ";'],
  [40, 'PRINT @960,"+-------------------------------------------------------------+ ";'],
  [50, "FOR Y=2 TO 14"],
  [60, 'PRINT @(Y*64),"|";'],
  [70, 'PRINT @(Y*64+62),"|";'],
  [80, "NEXT Y"],
  [90, "IF S>H THEN H=S"],
  [100, "LET S=0"],
  [110, "LET L=6"],
  [120, "LET DX=1"],
  [130, "LET DY=0"],
  [140, "LET FX=0"],
  [150, "LET X0=30"],
  [160, "LET Y0=8"],
  [170, "FOR I=0 TO L-1"],
  [180, "LET SX(I)=X0-I"],
  [190, "LET SY(I)=Y0"],
  [200, 'PRINT @(Y0*64+X0-I),"#";'],
  [210, "NEXT I"],
  [220, "IF FX=0 THEN 580"],
  [230, "LET HX=SX(0)"],
  [240, "LET HY=SY(0)"],
  [250, "IF ABS(FX-HX)<ABS(FY-HY) THEN 300 ELSE 260"],
  [260, "IF FX>HX THEN 270 ELSE 280"],
  [270, "IF DX=-1 THEN 340 ELSE 275"],
  [275, "LET DX=1"],
  [276, "LET DY=0"],
  [277, "GOTO 340"],
  [280, "IF FX<HX THEN 290 ELSE 320"],
  [290, "IF DX=1 THEN 340 ELSE 295"],
  [295, "LET DX=-1"],
  [296, "LET DY=0"],
  [297, "GOTO 340"],
  [300, "IF FY>HY THEN 310 ELSE 320"],
  [310, "IF DY=-1 THEN 340 ELSE 315"],
  [315, "LET DX=0"],
  [316, "LET DY=1"],
  [317, "GOTO 340"],
  [320, "IF FY<HY THEN 330 ELSE 340"],
  [330, "IF DY=1 THEN 340 ELSE 335"],
  [335, "LET DX=0"],
  [336, "LET DY=-1"],
  [340, "LET NX=HX+DX"],
  [350, "LET NY=HY+DY"],
  [360, "IF NX<1 THEN 10"],
  [370, "IF NX>61 THEN 10"],
  [380, "IF NY<2 THEN 10"],
  [390, "IF NY>14 THEN 10"],
  [400, "LET HIT=0"],
  [410, "FOR I=0 TO L-2"],
  [420, "IF SX(I)=NX THEN IF SY(I)=NY THEN HIT=1"],
  [430, "NEXT I"],
  [440, "IF HIT=0 THEN 470 ELSE 10"],
  [470, "IF NX<>FX THEN 490"],
  [480, "IF NY=FY THEN 500"],
  [490, 'IF FX<>0 THEN PRINT @(SY(L-1)*64+SX(L-1))," ";'],
  [495, "GOTO 520"],
  [500, "LET S=S+1"],
  [502, "LET FX=0"],
  [504, "IF L<120 THEN L=L+1"],
  [520, "FOR I=L-1 TO 1 STEP -1"],
  [530, "LET SX(I)=SX(I-1)"],
  [540, "LET SY(I)=SY(I-1)"],
  [550, "NEXT I"],
  [560, "LET SX(0)=NX"],
  [570, "LET SY(0)=NY"],
  [580, 'PRINT @(NY*64+NX),"#";'],
  [590, 'PRINT @0,"SCORE ";S;"    HI ";H;"                    HUNT THE @";'],
  [600, "IF FX<>0 THEN 220"],
  [610, "LET FX=INT(RND(1)*61)+1"],
  [620, "LET FY=INT(RND(1)*13)+2"],
  [630, "LET OK=1"],
  [640, "FOR I=0 TO L-1"],
  [650, "IF SX(I)=FX THEN IF SY(I)=FY THEN OK=0"],
  [660, "NEXT I"],
  [670, "IF OK=0 THEN 610"],
  [680, 'PRINT @(FY*64+FX),"@";'],
  [690, "GOTO 220"],
];

let booting = true;
let ready = false;
let suppressReadyEcho = true;
let interpreterPaused = false;
let continuePromptActive = false;
let pendingOutputContinuation = null;
let executionSpeed = "normal";
let inputBuffer = "";
let screenBuffer = createScreenBuffer();
let cursorRow = 0;
let cursorColumn = 0;

function createScreenBuffer() {
  return Array.from({ length: SCREEN_ROWS }, () => Array(SCREEN_COLUMNS).fill(" "));
}

function resetScreenBuffer() {
  screenBuffer = createScreenBuffer();
  cursorRow = 0;
  cursorColumn = 0;
}

function clearTerminal() {
  resetScreenBuffer();
  renderScreen();
}

function syncControls() {
  const locked = !ready || interpreterPaused;
  input.disabled = locked;

  for (const button of document.querySelectorAll(".deck-key")) {
    const action = button.dataset.action;
    button.disabled = locked && action !== "break";
  }
}

function readDirectoryIndex() {
  try {
    const raw = localStorage.getItem(STORAGE_INDEX_KEY);
    if (!raw) {
      return [];
    }

    const names = JSON.parse(raw);
    return Array.isArray(names) ? names.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeDirectoryIndex(names) {
  localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(names));
}

function saveProgramToStorage(name, lines) {
  try {
    localStorage.setItem(`${STORAGE_PROGRAM_PREFIX}${name}`, JSON.stringify(lines));

    const nextDirectory = Array.from(new Set([...readDirectoryIndex(), name])).sort((left, right) =>
      left.localeCompare(right),
    );
    writeDirectoryIndex(nextDirectory);
  } catch {
    throw new Error("SAVE FAILED");
  }
}

function loadProgramFromStorage(name) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PROGRAM_PREFIX}${name}`);
    if (!raw) {
      return null;
    }

    const lines = JSON.parse(raw);
    if (!Array.isArray(lines)) {
      return null;
    }

    return lines
      .map((line) => {
        const match = String(line).match(/^(\d+)\s*(.*)$/);
        if (!match) {
          return null;
        }
        return [Number(match[1]), match[2]];
      })
      .filter(Boolean);
  } catch {
    return null;
  }
}

function listProgramsInStorage() {
  return readDirectoryIndex();
}

function applyExecutionSpeed(mode) {
  executionSpeed = mode;
  runtime.setExecutionMode(mode);
  speedSwitch.dataset.speed = mode;
  speedValue.textContent = SPEED_LABELS[mode];
}

function cycleExecutionSpeed() {
  const currentIndex = SPEED_SEQUENCE.indexOf(executionSpeed);
  const nextMode = SPEED_SEQUENCE[(currentIndex + 1) % SPEED_SEQUENCE.length];
  applyExecutionSpeed(nextMode);
}

function setCursorFromPosition(position) {
  cursorRow = Math.floor(position / SCREEN_COLUMNS);
  cursorColumn = position % SCREEN_COLUMNS;
}

function moveToNextLineOrPage(resumeOutput) {
  if (cursorRow < SCREEN_ROWS - 1) {
    cursorRow += 1;
    cursorColumn = 0;
    return true;
  }

  continuePromptActive = true;
  pendingOutputContinuation = resumeOutput;
  runtime.pause();
  renderScreen();
  return false;
}

function advanceUiLine() {
  if (cursorRow < SCREEN_ROWS - 1) {
    cursorRow += 1;
    cursorColumn = 0;
    return;
  }

  resetScreenBuffer();
}

function writeOutput(
  text = "",
  options = {},
  startIndex = 0,
  newlinePending = !options.suppressNewline,
  positionApplied = false,
) {
  const source = String(text);
  let index = startIndex;

  if (!positionApplied && options.position !== undefined) {
    setCursorFromPosition(options.position);
    positionApplied = true;
  }

  while (index < source.length) {
    if (cursorColumn >= SCREEN_COLUMNS) {
      if (!moveToNextLineOrPage(() => writeOutput(source, options, index, newlinePending, true))) {
        return false;
      }
    }

    const char = source[index];
    if (char === "\n") {
      if (!moveToNextLineOrPage(() => writeOutput(source, options, index + 1, newlinePending, true))) {
        return false;
      }
      index += 1;
      continue;
    }

    screenBuffer[cursorRow][cursorColumn] = char;
    cursorColumn += 1;
    index += 1;
  }

  if (newlinePending) {
    if (cursorColumn >= SCREEN_COLUMNS) {
      if (!moveToNextLineOrPage(null)) {
        return false;
      }
    } else if (!moveToNextLineOrPage(null)) {
      return false;
    }
  }

  renderScreen();
  return true;
}

function printText(text = "", options = {}) {
  writeOutput(text, options);
}

function overlayVirtualText(rows, startRow, startColumn, text) {
  let row = startRow;
  let column = startColumn;

  for (const char of text) {
    if (char === "\n") {
      row += 1;
      column = 0;
      if (row >= SCREEN_ROWS) {
        return;
      }
      continue;
    }

    if (column >= SCREEN_COLUMNS) {
      row += 1;
      column = 0;
      if (row >= SCREEN_ROWS) {
        return;
      }
    }

    rows[row][column] = char;
    column += 1;
  }
}

function renderScreen() {
  const rows = screenBuffer.map((row) => [...row]);

  if (continuePromptActive) {
    overlayVirtualText(rows, SCREEN_ROWS - 1, 0, CONTINUE_PROMPT);
  } else if (ready && !booting && cursorColumn < SCREEN_COLUMNS) {
    const available = Math.max(0, SCREEN_COLUMNS - cursorColumn - PROMPT_PREFIX.length);
    const visibleInput = inputBuffer.slice(0, available);
    const promptText = `${PROMPT_PREFIX}${visibleInput}`;

    overlayVirtualText(rows, cursorRow, cursorColumn, promptText);

    const caretColumn = cursorColumn + Math.min(promptText.length, SCREEN_COLUMNS - cursorColumn - 1);
    if (caretColumn < SCREEN_COLUMNS) {
      rows[cursorRow][caretColumn] = "_";
    }
  }

  terminal.textContent = rows.map((row) => row.join("")).join("\n");
}

function clampInput() {
  const maxLength = Math.max(0, SCREEN_COLUMNS - cursorColumn - PROMPT_PREFIX.length);
  if (input.value.length > maxLength) {
    input.value = input.value.slice(0, maxLength);
  }
  inputBuffer = input.value;
  renderScreen();
}

function ensurePromptLine() {
  if (cursorColumn !== 0 || cursorColumn >= SCREEN_COLUMNS) {
    advanceUiLine();
  }
}

function setReadyState(isReady) {
  ready = isReady;
  syncControls();

  if (isReady && !booting) {
    if (!suppressReadyEcho) {
      printText("READY.");
    }
    suppressReadyEcho = false;
    ensurePromptLine();
    input.value = "";
    inputBuffer = "";
    if (!interpreterPaused) {
      queueMicrotask(() => input.focus());
    }
  } else if (!isReady) {
    input.value = "";
    inputBuffer = "";
  }

  renderScreen();
}

const runtime = new BasicRuntime({
  executionMode: executionSpeed,
  saveProgram(name, lines) {
    saveProgramToStorage(name, lines);
  },
  loadProgram(name) {
    return loadProgramFromStorage(name);
  },
  listPrograms() {
    return listProgramsInStorage();
  },
  output(text, tone = "default", options = {}) {
    const content = tone === "error" ? `?${text}` : text;
    printText(content, options);
  },
  clearScreen() {
    clearTerminal();
  },
  onPauseStateChange(isPaused) {
    interpreterPaused = isPaused;
    syncControls();
    if (!isPaused && ready && !continuePromptActive) {
      queueMicrotask(() => input.focus());
    }
  },
  onReadyStateChange(isReady) {
    setReadyState(isReady);
  },
});

function commitInputLine(source) {
  const line = `${PROMPT_PREFIX}${source}`.slice(0, SCREEN_COLUMNS);

  for (const char of line) {
    if (cursorColumn >= SCREEN_COLUMNS) {
      break;
    }
    screenBuffer[cursorRow][cursorColumn] = char;
    cursorColumn += 1;
  }

  advanceUiLine();
  renderScreen();
}

function executeCommand(source) {
  commitInputLine(source);

  try {
    suppressReadyEcho = source.trim().toUpperCase() === "CLS";
    runtime.enter(source);
  } catch (error) {
    printText(`?${error.message}`);
  } finally {
    input.value = "";
    inputBuffer = "";
    if (!input.disabled) {
      input.focus();
    }
    renderScreen();
  }
}

function installDemo() {
  runtime.loadProgram(demoProgram);
  printText("DEMO PROGRAM LOADED.");
}

function resumeContinuedOutput() {
  if (!continuePromptActive) {
    return;
  }

  const continuation = pendingOutputContinuation;
  continuePromptActive = false;
  pendingOutputContinuation = null;
  resetScreenBuffer();
  renderScreen();

  continuation?.();
  if (!continuePromptActive) {
    runtime.resume();
  }
}

function handleBreak() {
  if (continuePromptActive) {
    continuePromptActive = false;
    pendingOutputContinuation = null;
    clearTerminal();
  }

  runtime.stop();
}

function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function bootSequence() {
  clearTerminal();
  setReadyState(false);
  printText("MICRO COLOR 8 ROM V2.1");
  printText("SELF TEST................OK");
  printText("64K RAM..................READY");
  printText("CASSETTE INTERFACE.......READY");
  printText("");

  const messages = [
    "COLOR BASIC",
    "COPYRIGHT 1983 HOME MICRO DEVICES",
    "READY.",
    'TRY: 10 PRINT "HELLO"',
  ];

  messages.forEach((message, index) => {
    setTimeout(() => {
      printText(message);
      if (index === messages.length - 1) {
        booting = false;
        suppressReadyEcho = true;
        setReadyState(true);
      }
    }, 420 * (index + 1));
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const source = input.value;
  if (!source.trim()) {
    input.value = "";
    inputBuffer = "";
    renderScreen();
    return;
  }
  executeCommand(source);
});

input.addEventListener("input", () => {
  clampInput();
});

document.addEventListener("click", () => {
  if (!input.disabled) {
    input.focus();
  }
});

document.addEventListener("keydown", (event) => {
  if (continuePromptActive) {
    if (event.key === "Escape") {
      event.preventDefault();
      handleBreak();
      return;
    }

    if (!event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      resumeContinuedOutput();
    }
    return;
  }

  if (event.key === "Escape") {
    handleBreak();
  }
});

document.querySelectorAll(".deck-key").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;

    if (action === "break") {
      handleBreak();
      return;
    }

    if (action === "demo") {
      installDemo();
      input.focus();
      return;
    }

    executeCommand(action.toUpperCase());
  });
});

speedSwitch.addEventListener("click", () => {
  cycleExecutionSpeed();
});

applyExecutionSpeed(executionSpeed);
updateClock();
setInterval(updateClock, 1000);
bootSequence();
