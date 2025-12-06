// Calm Bookcase Game - Vanilla JS for Performance
// Drag books around to create pleasing arrangements

const canvas = document.getElementById('canvas');
const canvasWrapper = document.getElementById('canvas-wrapper');
const casesValueEl = document.getElementById('cases-value');
const shelvesValueEl = document.getElementById('shelves-value');
const casesIncBtn = document.getElementById('cases-inc');
const casesDecBtn = document.getElementById('cases-dec');
const shelvesIncBtn = document.getElementById('shelves-inc');
const shelvesDecBtn = document.getElementById('shelves-dec');
const fillSlider = document.getElementById('fill-slider');
const fillLabel = document.getElementById('fill-label');
const goBtn = document.getElementById('go-btn');
const startOverBtn = document.getElementById('start-over');

const ctx = canvas.getContext('2d', { alpha: true });

let bookcases = [];
let books = [];
let draggedBook = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let needsRedraw = true;

const SHELF_HEIGHT = 100;
const SHELF_THICKNESS = 4;
const BOOKCASE_WIDTH = 240;
const BOOKCASE_PADDING = 10;
const STORAGE_KEY = 'books-state-v9';

// User-adjustable settings
const DEFAULT_SETTINGS = {
  cases: 3,
  shelves: 6,
  fill: 0.6
};

const settings = { ...DEFAULT_SETTINGS };

let currentScale = 1;
let previewMode = true;

// ========================================
// CONFIGURATION - Customize book appearance here
// ========================================

const CONFIG = {
  // Book width distribution (percentages should add up to 100)
  width: {
    thin: { percent: 20, min: 8, max: 10 },
    medium: { percent: 75, min: 10, max: 15 },
    thick: { percent: 5, min: 15, max: 25 }
  },
  
  // Book height distribution (percentages should add up to 100)
  height: {
    short: { percent: 75, min: 50, max: 70 },
    medium: { percent: 20, min: 70, max: 75 },
    tall: { percent: 5, min: 75, max: 90 }
  },
  
  // Color distribution (percentages should add up to 100)
  colors: [
    { 
      name: 'black',
      percent: 16,
      hue: { min: 0, max: 360 },
      saturation: { min: 5, max: 15 },
      brightness: { min: 8, max: 18 }
    },
    { 
      name: 'white',
      percent: 15,
      hue: { min: 0, max: 360 },
      saturation: { min: 0, max: 10 },
      brightness: { min: 65, max: 95 }
    },
    { 
      name: 'green',
      percent: 6,
      hue: { min: 110, max: 145 },
      saturation: { min: 20, max: 70 },
      brightness: { min: 20, max: 60 }
    },
    { 
      name: 'yellow',
      percent: 16,
      hue: { min: 45, max: 65 },
      saturation: { min: 40, max: 90 },
      brightness: { min: 45, max: 80 }
    },
    { 
      name: 'light blue',
      percent: 17,
      hue: { min: 180, max: 210 },
      saturation: { min: 50, max: 75 },
      brightness: { min: 30, max: 70 }
    },
    { 
      name: 'red',
      percent: 19,
      hue: { min: 0, max: 15, alt: { min: 345, max: 360 } },
      saturation: { min: 65, max: 85 },
      brightness: { min: 45, max: 65 }
    },
    { 
      name: 'magenta',
      percent: 2,
      hue: { min: 290, max: 320 },
      saturation: { min: 60, max: 80 },
      brightness: { min: 50, max: 70 }
    },
    { 
      name: 'dark blue',
      percent: 9,
      hue: { min: 220, max: 260 },
      saturation: { min: 60, max: 80 },
      brightness: { min: 30, max: 50 }
    }
  ]
};

// ========================================
// END CONFIGURATION
// ========================================

// Utility functions
function random(min, max) {
  if (max === undefined) {
    max = min;
    min = 0;
  }
  return Math.random() * (max - min) + min;
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function getOrientedSize(book) {
  return book.isHorizontal ? { width: book.height, height: book.width } : { width: book.width, height: book.height };
}

function setBookOrientation(book, isHorizontal) {
  const before = getOrientedSize(book);
  const cx = book.x + before.width * 0.5;
  const cy = book.y + before.height * 0.5;
  book.isHorizontal = isHorizontal;
  const after = getOrientedSize(book);
  book.x = cx - after.width * 0.5;
  book.y = cy - after.height * 0.5;
}

function getBookRect(book) {
  const size = getOrientedSize(book);
  return { x: book.x, y: book.y, width: size.width, height: size.height };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

function getFloorArea() {
  if (!bookcases.length) return null;
  const last = bookcases[bookcases.length - 1];
  const rightEdge = last.x + last.width;
  const x = rightEdge + BOOKCASE_PADDING;
  const availableWidth = canvas.width - x - BOOKCASE_PADDING;
  const baseline = last.y + last.height; // align to bookcase bottom
  const floorTop = Math.max(baseline - 12 * currentScale, baseline - 1); // shallow band just above baseline
  const height = Math.max(canvas.height - baseline - BOOKCASE_PADDING, 24 * currentScale);
  if (availableWidth <= 10 || height <= 10) return null;
  return { x, y: floorTop, width: availableWidth, height, baseline };
}

function placeBookOnFloor(book, pos = null) {
  const area = getFloorArea();
  if (!area) return;

  setBookOrientation(book, true);
  book.isOnFloor = true;
  book.bookcaseIndex = null;
  book.shelfIndex = null;

  const size = getOrientedSize(book);
  const maxX = Math.max(area.x, area.x + area.width - size.width);
  const xRange = Math.max(area.width - size.width, 1);
  let targetX = clamp(area.x + random(0, xRange), area.x, maxX);
  if (pos) {
    targetX = clamp(pos.x - size.width * 0.5, area.x, maxX);
  }

  const stackHeight = books
    .filter(b => b.isOnFloor && b !== book)
    .reduce((h, b) => {
      const r = getBookRect(b);
      const overlap = !(targetX + size.width <= r.x || targetX >= r.x + r.width);
      return overlap ? h + r.height : h;
    }, 0);

  book.x = targetX;
  book.y = area.baseline - stackHeight - size.height;
}

function dropOverflowOnFloor(list) {
  for (const book of list) {
    placeBookOnFloor(book);
  }
}

function saveState() {
  try {
    const state = {
      version: 3,
      settings: { ...settings },
      previewMode,
      scale: currentScale,
      books: books.map(b => ({
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        hue: b.hue,
        saturation: b.saturation,
        brightness: b.brightness,
        shelfIndex: b.shelfIndex,
        bookcaseIndex: b.bookcaseIndex,
        isVerticalTitle: b.isVerticalTitle,
        isTwoTone: b.isTwoTone,
        toneSplit: b.toneSplit,
        isHorizontal: b.isHorizontal,
        isOnFloor: b.isOnFloor,
        secondaryColor: b.secondaryColor,
        color: b.color
      }))
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Could not save state', err);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== 3) return null;
    return parsed;
  } catch (err) {
    console.warn('Could not load state', err);
    return null;
  }
}

function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Could not clear state', err);
  }
}

class Book {
  constructor(x, y, width, height, hue, saturation, brightness) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.hue = hue;
    this.saturation = saturation;
    this.brightness = brightness;
    this.shelfIndex = null;
    this.bookcaseIndex = null;
    this.isVerticalTitle = Math.random() < 0.28; // Some books have vertical titles
    this.isTwoTone = Math.random() < 0.12; // Small portion get two-color spines
    this.toneSplit = this.isTwoTone ? clamp(random(0.25, 0.75), 0.2, 0.8) : 0;
    this.isHorizontal = false;
    this.isOnFloor = false;
    
    // Pre-calculate colors
    this.color = hslToRgb(hue, saturation, brightness);
    if (this.isTwoTone) {
      const toneHue = (hue + random(-12, 12) + 360) % 360;
      const toneSat = clamp(saturation + random(-10, 10), 0, 100);
      const toneBright = clamp(brightness + random(-18, 18), 0, 100);
      this.secondaryColor = hslToRgb(toneHue, toneSat, toneBright);
    }
    this.highlightColor = hslToRgb(hue, Math.max(0, saturation - 20), Math.min(100, brightness + 20));
    this.shadowColor = hslToRgb(hue, Math.min(100, saturation + 20), Math.max(0, brightness - 20));
    // Contrast-aware title color: light books get darker titles, dark books get lighter titles
    if (brightness > 55) {
      this.titleColor = hslToRgb(hue, Math.min(100, saturation + 10), Math.max(0, brightness - 40));
    } else {
      this.titleColor = hslToRgb(hue, Math.max(0, saturation - 40), Math.min(100, brightness + 35));
    }
  }

  draw(ctx) {
    const orientedSize = getOrientedSize(this);
    const cx = this.x + orientedSize.width * 0.5;
    const cy = this.y + orientedSize.height * 0.5;

    let drawX = this.x;
    let drawY = this.y;

    if (this.isHorizontal) {
      drawX = cx - this.width * 0.5;
      drawY = cy - this.height * 0.5;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-Math.PI / 2);
      ctx.translate(-cx, -cy);
    } else {
      ctx.save();
    }

    // Book spine
    ctx.fillStyle = `rgb(${this.color[0]},${this.color[1]},${this.color[2]})`;
    ctx.fillRect(drawX, drawY, this.width, this.height);
    if (this.isTwoTone) {
      const split = this.height * this.toneSplit;
      ctx.fillStyle = `rgb(${this.secondaryColor[0]},${this.secondaryColor[1]},${this.secondaryColor[2]})`;
      ctx.fillRect(drawX, drawY, this.width, split);
    }
    
    // Highlight
    ctx.strokeStyle = `rgb(${this.highlightColor[0]},${this.highlightColor[1]},${this.highlightColor[2]})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(drawX + 2, drawY);
    ctx.lineTo(drawX + 2, drawY + this.height);
    ctx.stroke();
    
    // Shadow
    ctx.strokeStyle = `rgb(${this.shadowColor[0]},${this.shadowColor[1]},${this.shadowColor[2]})`;
    ctx.beginPath();
    ctx.moveTo(drawX + this.width - 2, drawY);
    ctx.lineTo(drawX + this.width - 2, drawY + this.height);
    ctx.stroke();
    
    // Title lines
    ctx.fillStyle = `rgb(${this.titleColor[0]},${this.titleColor[1]},${this.titleColor[2]})`;
    if (this.isVerticalTitle) {
      const cxn = drawX + this.width * 0.5;
      const top = drawY + this.height * 0.15;
      const h1 = this.height * 0.7;
      ctx.fillRect(cxn - 1, top, 2, h1);
    } else {
      const lineY = drawY + this.height * 0.3;
      ctx.fillRect(drawX + this.width * 0.2, lineY, this.width * 0.6, 2);
      ctx.fillRect(drawX + this.width * 0.15, lineY + 8, this.width * 0.7, 2);
    }

    ctx.restore();
  }

  contains(px, py) {
    const rect = getBookRect(this);
    return px >= rect.x && px <= rect.x + rect.width &&
           py >= rect.y && py <= rect.y + rect.height;
  }
}

class Bookcase {
  constructor(x, y, shelves, shelfHeight, thickness, padding, width) {
    this.x = x;
    this.y = y;
    this.shelves = shelves;
    this.shelfHeight = shelfHeight;
    this.thickness = thickness;
    this.padding = padding;
    this.width = width;
    this.height = shelves * shelfHeight;
  }

  draw(ctx) {
    // Bookcase frame
    const frameColor = hslToRgb(35, 35, 45); // oak-ish tone
    ctx.strokeStyle = `rgb(${frameColor[0]},${frameColor[1]},${frameColor[2]})`;
    ctx.lineWidth = this.thickness * 2.4;
    ctx.strokeRect(this.x, this.y, this.width, this.height);
    
    // Shelves
    ctx.lineWidth = this.thickness * 1.6;
    ctx.beginPath();
    for (let i = 1; i < this.shelves; i++) {
      const shelfY = this.y + i * this.shelfHeight;
      ctx.moveTo(this.x, shelfY);
      ctx.lineTo(this.x + this.width, shelfY);
    }
    ctx.stroke();
  }

  getShelfY(shelfIndex) {
    return this.y + (shelfIndex + 1) * this.shelfHeight - this.thickness;
  }

  getShelfAtY(y) {
    if (y < this.y || y > this.y + this.height) return -1;
    return Math.floor((y - this.y) / this.shelfHeight);
  }
}

function initCanvas(restoredState = null) {
  // Fit canvas to wrapper
  canvas.width = canvasWrapper.clientWidth;
  canvas.height = canvasWrapper.clientHeight;

  // Compute scale to fit cases and shelves
  const cases = settings.cases;
  const shelves = settings.shelves;
  const availableW = canvas.width - (cases + 1) * BOOKCASE_PADDING;
  const targetHeightScale = (canvas.height * 0.9) / (shelves * SHELF_HEIGHT);
  const targetWidthScale = Math.max(availableW / (cases * BOOKCASE_WIDTH), 0.5);
  const baseScale = Math.min(targetHeightScale, targetWidthScale);
  const boost = previewMode ? 1.0 : 0.82;
  const computedScale = clamp(baseScale * boost, 0.2, 3.0);
  const canUseRestoredScale = previewMode && restoredState && restoredState.scale;
  currentScale = canUseRestoredScale ? restoredState.scale : computedScale;

  const caseWidth = BOOKCASE_WIDTH * currentScale;
  const shelfHeight = SHELF_HEIGHT * currentScale;
  const thickness = SHELF_THICKNESS * currentScale;
  const padding = 10 * currentScale;

  // Create bookcases centered
  bookcases = [];
  const totalWidth = cases * caseWidth + (cases + 1) * BOOKCASE_PADDING;
  const minStart = BOOKCASE_PADDING;
  const maxStart = Math.max(BOOKCASE_PADDING, canvas.width - totalWidth - BOOKCASE_PADDING);
  const targetStart = canvas.width * 0.1; // bias to the left
  const startX = clamp(targetStart, minStart, maxStart);
  const totalHeight = shelves * shelfHeight;
  const startY = Math.max(BOOKCASE_PADDING, (canvas.height - totalHeight) / 2);
  
  for (let i = 0; i < cases; i++) {
    bookcases.push(new Bookcase(
      startX + i * (caseWidth + BOOKCASE_PADDING),
      startY,
      shelves,
      shelfHeight,
      thickness,
      padding,
      caseWidth
    ));
  }
  
  const scaleDiffAcceptable = restoredState && restoredState.scale ? Math.abs(restoredState.scale - computedScale) / computedScale < 0.01 : false;
  if (restoredState && restoredState.books && scaleDiffAcceptable && previewMode) {
    books = restoredState.books.map(b => {
      const book = new Book(
        b.x,
        b.y,
        b.width,
        b.height,
        b.hue,
        b.saturation,
        b.brightness
      );
      book.shelfIndex = b.shelfIndex;
      book.bookcaseIndex = b.bookcaseIndex;
      book.isVerticalTitle = !!b.isVerticalTitle;
      book.isTwoTone = !!b.isTwoTone;
      book.toneSplit = b.toneSplit ?? 0;
      book.isHorizontal = !!b.isHorizontal;
      book.isOnFloor = !!b.isOnFloor;
      if (b.secondaryColor) book.secondaryColor = b.secondaryColor;
      if (b.color) book.color = b.color;
      return book;
    });
  } else {
    generateBooks();
  }
  saveState();
  needsRedraw = true;
}

function getRandomColor() {
  const rand = Math.random() * 100;
  let cumulative = 0;
  
  for (const colorConfig of CONFIG.colors) {
    cumulative += colorConfig.percent;
    if (rand < cumulative) {
      let hue;
      if (colorConfig.hue.alt && Math.random() > 0.5) {
        hue = random(colorConfig.hue.alt.min, colorConfig.hue.alt.max);
      } else {
        hue = random(colorConfig.hue.min, colorConfig.hue.max);
      }
      
      const saturation = random(colorConfig.saturation.min, colorConfig.saturation.max);
      const brightness = random(colorConfig.brightness.min, colorConfig.brightness.max);
      
      return { hue, saturation, brightness };
    }
  }
  
  // Fallback (should never reach here if percentages add up to 100)
  return { hue: 0, saturation: 50, brightness: 50 };
}

function getRandomBookWidth() {
  const rand = Math.random() * 100;
  const widthConfig = CONFIG.width;
  
  if (rand < widthConfig.thin.percent) {
    return random(widthConfig.thin.min, widthConfig.thin.max);
  } else if (rand < widthConfig.thin.percent + widthConfig.medium.percent) {
    return random(widthConfig.medium.min, widthConfig.medium.max);
  } else {
    return random(widthConfig.thick.min, widthConfig.thick.max);
  }
}

function getRandomBookHeight() {
  const rand = Math.random() * 100;
  const heightConfig = CONFIG.height;
  
  if (rand < heightConfig.short.percent) {
    return random(heightConfig.short.min, heightConfig.short.max);
  } else if (rand < heightConfig.short.percent + heightConfig.medium.percent) {
    return random(heightConfig.medium.min, heightConfig.medium.max);
  } else {
    return random(heightConfig.tall.min, heightConfig.tall.max);
  }
}

function generateBooks() {
  books = [];
  
  for (let bcIndex = 0; bcIndex < bookcases.length; bcIndex++) {
    const bc = bookcases[bcIndex];

    // Compute usable space per shelf and total
    const shelvesMeta = [];
    let totalUsable = 0;
    for (let shelf = 0; shelf < bc.shelves; shelf++) {
      const startX = bc.x + bc.padding;
      const shelfMaxX = bc.x + bc.width - bc.padding;
      const usable = shelfMaxX - startX;
      shelvesMeta.push({ startX, shelfMaxX, usable });
      totalUsable += usable;
    }

    // Total target width for this bookcase
    const totalTarget = totalUsable * settings.fill;

    // Create weights per shelf (normal-ish positive noise), then normalize to totalTarget
    const weights = shelvesMeta.map(() => Math.max(0.2, 1 + (Math.random() * 0.6 - 0.3))); // ~N(1,0.3), min 0.2
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const targets = weights.map(w => (w / weightSum) * totalTarget);

    for (let shelf = 0; shelf < bc.shelves; shelf++) {
      const shelfY = bc.getShelfY(shelf);
      const { startX, shelfMaxX, usable } = shelvesMeta[shelf];
      const targetWidth = Math.min(targets[shelf] * random(0.97, 1.03), usable);
      let remaining = targetWidth;

      // Small random leading gap for variety
      let currentX = startX + random(0, 4 * currentScale);
      const minWidth = CONFIG.width.thin.min * currentScale;

      while (remaining > minWidth && currentX < shelfMaxX - minWidth) {
        const bookWidth = getRandomBookWidth() * currentScale;
        const bookHeight = getRandomBookHeight() * currentScale;
        const gap = random(1 * currentScale, 3.5 * currentScale);

        // Stop if this book would overflow the shelf
        if (currentX + bookWidth > shelfMaxX) break;

        // If this book would exceed target by more than 12%, consider stopping
        if (remaining - bookWidth < -0.12 * targetWidth) break;

        const color = getRandomColor();
        const book = new Book(
          currentX,
          shelfY - bookHeight,
          bookWidth,
          bookHeight,
          color.hue,
          color.saturation,
          color.brightness
        );
        book.shelfIndex = shelf;
        book.bookcaseIndex = bcIndex;
        books.push(book);

        currentX += bookWidth + gap;
        remaining -= bookWidth;

        // Occasional slight underfill to keep variety
        if (remaining < minWidth && Math.random() < 0.4) break;
      }
    }
  }
}

function draw() {
  if (!needsRedraw) return;
  
  // Clear canvas (keep underlying CSS background visible)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.filter = previewMode ? 'grayscale(1)' : 'none';
  
  // Draw bookcases
  for (const bc of bookcases) {
    bc.draw(ctx);
  }
  
  // Draw books (except dragged one)
  for (const book of books) {
    if (book !== draggedBook) {
      book.draw(ctx);
    }
  }
  
  // Draw dragged book on top
  if (draggedBook) {
    draggedBook.draw(ctx);
  }
  
  ctx.restore();
  needsRedraw = false;
}

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function updateUI() {
  casesValueEl.textContent = settings.cases;
  shelvesValueEl.textContent = settings.shelves;
  fillSlider.value = Math.round(settings.fill * 100);
  fillLabel.textContent = `${Math.round(settings.fill * 100)}%`;
}

function setMode(isPreview) {
  previewMode = isPreview;
  document.body.classList.toggle('preview', isPreview);
  document.body.classList.toggle('live', !isPreview);
}

function applySettingsAndRefresh() {
  initCanvas();
}

casesIncBtn.addEventListener('click', () => {
  settings.cases = clamp(settings.cases + 1, 1, 6);
  updateUI();
  applySettingsAndRefresh();
});

casesDecBtn.addEventListener('click', () => {
  settings.cases = clamp(settings.cases - 1, 1, 6);
  updateUI();
  applySettingsAndRefresh();
});

shelvesIncBtn.addEventListener('click', () => {
  settings.shelves = clamp(settings.shelves + 1, 1, 10);
  updateUI();
  applySettingsAndRefresh();
});

shelvesDecBtn.addEventListener('click', () => {
  settings.shelves = clamp(settings.shelves - 1, 1, 10);
  updateUI();
  applySettingsAndRefresh();
});

fillSlider.addEventListener('input', () => {
  settings.fill = clamp(Number(fillSlider.value) / 100, 0, 1);
  updateUI();
  initCanvas();
});

goBtn.addEventListener('click', () => {
  setMode(false);
  // On live view, recompute scale fresh and regenerate layout
  clearState();
  initCanvas();
  saveState();
});

startOverBtn.addEventListener('click', () => {
  clearState();
  Object.assign(settings, DEFAULT_SETTINGS);
  setMode(true);
  updateUI();
  initCanvas();
});

// Reflow all shelves in a bookcase starting from startShelf, keeping gaps and only pushing right to resolve overlap.
// Overflow now goes straight to the floor (no cascading to other shelves).
function cascadeReflow(bcIndex, startShelf) {
  const bc = bookcases[bcIndex];
  const padding = bc.padding;
  const shelfMaxX = bc.x + bc.width - padding;

  const gap = 2 * currentScale;

  for (let shelf = startShelf; shelf < bc.shelves; shelf++) {
    // Gather books on this shelf, keep their current x as ordering hint
    const shelfBooks = books.filter(b => 
      b.bookcaseIndex === bcIndex && 
      b.shelfIndex === shelf
    );

    shelfBooks.sort((a, b) => a.x - b.x);

    let cursor = bc.x + padding;
    const overflow = [];

    for (const book of shelfBooks) {
      // Do not pull books left; only push right if overlapping
      setBookOrientation(book, false);
      book.isOnFloor = false;

      const size = getOrientedSize(book);
      const startX = Math.max(book.x, cursor);
      if (startX + size.width <= bc.x + bc.width - padding) {
        book.x = startX;
        book.y = bc.getShelfY(shelf) - size.height;
        book.shelfIndex = shelf;
        book.bookcaseIndex = bcIndex;
        cursor = startX + size.width + gap;
      } else {
        overflow.push(book);
      }
    }

    if (overflow.length > 0) {
      dropOverflowOnFloor(overflow);
    }
  }
}

canvas.addEventListener('mousedown', (e) => {
  if (previewMode) return;
  const pos = getMousePos(e);
  
  for (let i = books.length - 1; i >= 0; i--) {
    if (books[i].contains(pos.x, pos.y)) {
      draggedBook = books[i];
      if (draggedBook.isOnFloor) {
        setBookOrientation(draggedBook, false);
        draggedBook.isOnFloor = false;
      }

      const rect = getBookRect(draggedBook);
      dragOffsetX = pos.x - rect.x;
      dragOffsetY = pos.y - rect.y;
      
      books.splice(i, 1);
      books.push(draggedBook);
      
      canvas.classList.add('dragging');
      needsRedraw = true;
      break;
    }
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (previewMode) return;
  if (draggedBook) {
    const pos = getMousePos(e);
    draggedBook.x = pos.x - dragOffsetX;
    draggedBook.y = pos.y - dragOffsetY;
    needsRedraw = true;
  }
});

canvas.addEventListener('mouseup', (e) => {
  if (previewMode) return;
  if (draggedBook) {
    const pos = getMousePos(e);
    let placed = false;
    
    for (let bcIndex = 0; bcIndex < bookcases.length; bcIndex++) {
      const bc = bookcases[bcIndex];
      if (pos.x >= bc.x && pos.x <= bc.x + bc.width &&
          pos.y >= bc.y && pos.y <= bc.y + bc.height) {
        
        const shelfIndex = bc.getShelfAtY(pos.y);
        if (shelfIndex >= 0 && shelfIndex < bc.shelves) {
          setBookOrientation(draggedBook, false);
          draggedBook.isOnFloor = false;
          draggedBook.x = pos.x - dragOffsetX;
          const size = getOrientedSize(draggedBook);
          draggedBook.y = bc.getShelfY(shelfIndex) - size.height;
          draggedBook.shelfIndex = shelfIndex;
          draggedBook.bookcaseIndex = bcIndex;

          cascadeReflow(bcIndex, shelfIndex);
          placed = true;
          break;
        }
      }
    }
    
    if (!placed) {
      placeBookOnFloor(draggedBook, pos);
    }
    
    canvas.classList.remove('dragging');
    draggedBook = null;
    saveState();
    needsRedraw = true;
  }
});

window.addEventListener('resize', () => {
  initCanvas(loadState());
});

// Animation loop - only redraws when needed
function animate() {
  draw();
  requestAnimationFrame(animate);
}

// Initialize
const restoredState = loadState();

if (restoredState && restoredState.settings) {
  Object.assign(settings, restoredState.settings);
}

setMode(!(restoredState && restoredState.previewMode === false));
updateUI();
initCanvas(restoredState);
animate();
