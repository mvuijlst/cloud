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

const { Engine, World, Bodies, Body, Runner } = Matter;
let engine = Engine.create({ gravity: { x: 0, y: 1 } });
let runner = Runner.create();
let physicsRunning = false;

function setPhysicsRunning(on) {
  if (on && !physicsRunning) {
    Runner.run(runner, engine);
    physicsRunning = true;
  } else if (!on && physicsRunning) {
    Runner.stop(runner);
    physicsRunning = false;
  }
}

function removeBody(book) {
  if (book.body) {
    World.remove(engine.world, book.body);
    book.body = null;
  }
}

let bookcases = [];
let books = [];
let draggedBook = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let needsRedraw = true;
let floorBaseline = 0;
let floorOrderCounter = 0;

function jitterFromOrder(order) {
  const base = (order ?? 0) * 9973;
  const val = (base % 11) - 5; // range [-5,5]
  return val * 0.9 * currentScale;
}

const SHELF_HEIGHT = 100;
const SHELF_THICKNESS = 4;
const BOOKCASE_WIDTH = 240;
const BOOKCASE_PADDING = 10;
const STORAGE_KEY = 'books-state-v9';
const FLOOR_RIGHT_PADDING = 12;
const FLOOR_LEFT_GAP = 24;

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

function isFinitePositive(n) {
  return Number.isFinite(n) && n > 0;
}

function isValidSavedBook(b) {
  return isFinitePositive(b.width) && isFinitePositive(b.height) && Number.isFinite(b.x) && Number.isFinite(b.y);
}

function isValidSavedState(state) {
  if (!state || !Array.isArray(state.books)) return false;
  if (!isFinitePositive(state.scale)) return false;
  return state.books.every(isValidSavedBook);
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

function clearWorld() {
  World.clear(engine.world, false);
  engine.world.gravity.x = 0;
  engine.world.gravity.y = 1;
}

function getFloorAreaRight() {
  if (!bookcases.length) return null;
  const last = bookcases[bookcases.length - 1];
  const x = last.x + last.width + BOOKCASE_PADDING + FLOOR_LEFT_GAP;
  const width = Math.max(BOOKCASE_PADDING, canvas.width - x - FLOOR_RIGHT_PADDING);
  if (width <= 4) return null;
  return { x, width, baseline: floorBaseline };
}

function restackFloor(excludeBook = null) {
  const area = getFloorAreaRight();
  if (!area) return;

  const floorBooks = books.filter(b => b.isOnFloor && b !== excludeBook);

  // Assign stable order if missing
  floorBooks.forEach(b => {
    if (b.floorOrder == null) {
      floorOrderCounter += 1;
      b.floorOrder = floorOrderCounter;
    }
  });

  floorBooks.sort((a, b) => (a.floorOrder ?? 0) - (b.floorOrder ?? 0));

  const MAX_STACK_HEIGHT = 220 * currentScale;
  const stackGap = 6 * currentScale;
  const stacks = []; // { x, width, height }

  for (const book of floorBooks) {
    setBookOrientation(book, true);
    removeBody(book);
    const size = getOrientedSize(book);

    // Clamp desired x to area
    const desiredX = clamp(book.x, area.x, area.x + Math.max(0, area.width - size.width));

    // Pick a stack that overlaps horizontally and fits height
    let targetStack = null;
    let bestOverlap = -1;
    for (const stack of stacks) {
      const overlapWidth = Math.min(desiredX + size.width, stack.x + stack.width) - Math.max(desiredX, stack.x);
      const minWidth = Math.min(size.width, stack.width);
      const sufficientOverlap = overlapWidth > 0 && overlapWidth >= 0.35 * minWidth;
      if (!sufficientOverlap) continue;
      const projectedHeight = stack.height + size.height;
      if (projectedHeight > MAX_STACK_HEIGHT) continue;
      if (overlapWidth > bestOverlap) {
        bestOverlap = overlapWidth;
        targetStack = stack;
      }
    }

    // If none fit, start a new stack to the rightmost available spot
    if (!targetStack) {
      const rightmost = stacks.length ? Math.max(...stacks.map(s => s.x + s.width)) : area.x;
      const newX = clamp(rightmost + stackGap, area.x, area.x + Math.max(0, area.width - size.width));
      targetStack = { x: newX, width: size.width, height: 0 };
      stacks.push(targetStack);
    }

    // Place on top of chosen stack
    const stackHeight = targetStack.height;
    const jitter = jitterFromOrder(book.floorOrder);
    const maxX = area.x + Math.max(0, area.width - size.width);
    const jitteredX = clamp(targetStack.x + jitter, area.x, maxX);
    book.x = jitteredX;
    book.y = area.baseline - stackHeight - size.height;
    targetStack.height += size.height;
    targetStack.width = Math.max(targetStack.width, size.width);
  }
}

function makeStaticRect(x, y, w, h) {
  return Bodies.rectangle(x + w * 0.5, y + h * 0.5, w, h, { isStatic: true, friction: 0.9, frictionStatic: 1, restitution: 0 });
}

function alignRestoredShelves() {
  for (const book of books) {
    if (book.isOnFloor) continue;
    const bc = bookcases[book.bookcaseIndex];
    if (!bc || book.shelfIndex == null || book.shelfIndex < 0 || book.shelfIndex >= bc.shelves) continue;
    setBookOrientation(book, false);
    const size = getOrientedSize(book);
    const minX = bc.x + bc.padding;
    const maxX = bc.x + bc.width - bc.padding - size.width;
    book.x = clamp(book.x, minX, maxX);
    book.y = bc.getShelfY(book.shelfIndex) - size.height;
    book.isOnFloor = false;
  }
}

function normalizeShelves({ overflowToFloor = true } = {}) {
  const gap = 2 * currentScale;
  for (let bcIndex = 0; bcIndex < bookcases.length; bcIndex++) {
    const bc = bookcases[bcIndex];
    const maxX = bc.x + bc.width - bc.padding;
    for (let shelfIndex = 0; shelfIndex < bc.shelves; shelfIndex++) {
      const shelfBooks = books.filter(b => b.bookcaseIndex === bcIndex && b.shelfIndex === shelfIndex);
      if (!shelfBooks.length) continue;
      shelfBooks.sort((a, b) => a.x - b.x);
      let cursor = bc.x + bc.padding;
      for (const book of shelfBooks) {
        setBookOrientation(book, false);
        book.isOnFloor = false;
        removeBody(book);
        const size = getOrientedSize(book);
        if (cursor + size.width <= maxX) {
          book.x = cursor;
          book.y = bc.getShelfY(shelfIndex) - size.height;
          cursor += size.width + gap;
        } else if (overflowToFloor) {
          placeBookOnFloorPhysics(book);
        } else {
          const clampedX = Math.max(bc.x + bc.padding, maxX - size.width);
          book.x = clampedX;
          book.y = bc.getShelfY(shelfIndex) - size.height;
          cursor = clampedX + size.width + gap;
        }
      }
    }
  }
}

function syncBookFromBody(book) {
  if (!book.body) return;
  const size = getOrientedSize(book);
  const pos = book.body.position;
  book.x = pos.x - size.width * 0.5;
  book.y = pos.y - size.height * 0.5;
}

function rebuildBookBody(book, { isStatic = false } = {}) {
  removeBody(book);
  const size = getOrientedSize(book);
  const center = { x: book.x + size.width * 0.5, y: book.y + size.height * 0.5 };
  book.body = Bodies.rectangle(center.x, center.y, size.width, size.height, {
    friction: 0.9,
    frictionStatic: 1,
    restitution: 0,
    inertia: Infinity,
    isStatic
  });
  Body.setAngle(book.body, book.isHorizontal ? -Math.PI / 2 : 0);
  Body.setVelocity(book.body, { x: 0, y: 0 });
  Body.setAngularVelocity(book.body, 0);
  World.add(engine.world, book.body);
}

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
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
        floorOrder: b.floorOrder,
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
    if (!isValidSavedState(parsed)) return null;
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
    this.floorOrder = null;
    
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
  const safeRestored = restoredState && isValidSavedState(restoredState) ? restoredState : null;
  if (restoredState && !safeRestored) {
    clearState();
  }

  // Fit canvas to wrapper
  canvas.width = canvasWrapper.clientWidth;
  canvas.height = canvasWrapper.clientHeight;

  // Compute scale to fit cases and shelves
  const cases = settings.cases;
  const shelves = settings.shelves;
  const reservedRight = canvas.width * 0.3; // ensure at least 30% width free on right
  const availableW = Math.max(BOOKCASE_PADDING, canvas.width - reservedRight - (cases + 1) * BOOKCASE_PADDING);
  const targetHeightScale = (canvas.height * 0.9) / (shelves * SHELF_HEIGHT);
  const targetWidthScale = Math.max(availableW / (cases * BOOKCASE_WIDTH), 0.5);
  const baseScale = Math.min(targetHeightScale, targetWidthScale);
  const boost = previewMode ? 1.0 : 0.82;
  const computedScale = clamp(baseScale * boost, 0.2, 3.0);
  const restoredScale = safeRestored && isFinitePositive(safeRestored.scale) ? safeRestored.scale : null;
  const scaleFactor = restoredScale ? clamp(computedScale / restoredScale, 0.25, 4) : 1;
  currentScale = computedScale;

  const caseWidth = BOOKCASE_WIDTH * currentScale;
  const shelfHeight = SHELF_HEIGHT * currentScale;
  const thickness = SHELF_THICKNESS * currentScale;
  const padding = 10 * currentScale;

  // Create bookcases centered
  bookcases = [];
  const totalWidth = cases * caseWidth + (cases + 1) * BOOKCASE_PADDING;
  const minStart = BOOKCASE_PADDING;
  const maxShelfArea = canvas.width - reservedRight - BOOKCASE_PADDING;
  const maxStart = Math.max(BOOKCASE_PADDING, maxShelfArea - totalWidth);
  const targetStart = canvas.width * 0.08; // slight left bias
  const startX = clamp(targetStart, minStart, maxStart);
  const totalHeight = shelves * shelfHeight;
  const startY = Math.max(BOOKCASE_PADDING, (canvas.height - totalHeight) / 2);
  floorBaseline = startY + totalHeight;
  
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

  clearWorld();

  // Static boundaries and shelves for physics
  const statics = [];
  statics.push(makeStaticRect(0, floorBaseline, canvas.width, thickness * 2)); // floor across canvas
  statics.push(makeStaticRect(-thickness * 4, 0, thickness * 4, canvas.height)); // left wall
  statics.push(makeStaticRect(canvas.width, 0, thickness * 4, canvas.height)); // right wall

  for (const bc of bookcases) {
    // Case side walls
    statics.push(makeStaticRect(bc.x - bc.thickness * 0.6, bc.y, bc.thickness * 0.6, bc.height + thickness * 2));
    statics.push(makeStaticRect(bc.x + bc.width, bc.y, bc.thickness * 0.6, bc.height + thickness * 2));

    // Shelves as thin static surfaces
    for (let si = 0; si < bc.shelves; si++) {
      const shelfY = bc.getShelfY(si) + bc.thickness * 0.2;
      statics.push(makeStaticRect(bc.x, shelfY, bc.width, bc.thickness * 0.8));
    }
    // Base
    statics.push(makeStaticRect(bc.x, bc.y + bc.height, bc.width, bc.thickness * 1.2));
  }

  statics.forEach(body => World.add(engine.world, body));
  
  if (safeRestored && safeRestored.books) {
    books = safeRestored.books.map(b => {
      const book = new Book(
        (b.x ?? 0) * scaleFactor,
        (b.y ?? 0) * scaleFactor,
        b.width * scaleFactor,
        b.height * scaleFactor,
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
      if (Number.isFinite(b.floorOrder)) book.floorOrder = b.floorOrder;
      if (b.secondaryColor) book.secondaryColor = b.secondaryColor;
      if (b.color) book.color = b.color;
      return book;
    });
    // If a book still has shelf metadata, force it back to shelf (never drop on resize)
    for (const book of books) {
      if (book.bookcaseIndex != null && book.shelfIndex != null) {
        book.isOnFloor = false;
      }
    }
  } else {
    generateBooks();
  }

  // Reset counter to max existing so new floor books stay ordered on top
  floorOrderCounter = books.reduce((m, b) => Math.max(m, b.floorOrder || 0), 0);

  // Normalize layout: align shelves and lay them out left-to-right; overflow goes to floor
  alignRestoredShelves();
  normalizeShelves({ overflowToFloor: true });
  restackFloor();
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
      const targetBoost = settings.fill >= 0.9 ? 1.05 : 1.0;
      const targetWidth = Math.min(targets[shelf] * random(0.99, 1.02) * targetBoost, usable);
      let remaining = targetWidth;

      // Small leading gap; tighter when nearly full
      const leadGapMax = settings.fill >= 0.9 ? 2 * currentScale : 4 * currentScale;
      let currentX = startX + random(0, leadGapMax);
      const minWidth = CONFIG.width.thin.min * currentScale;

      while (remaining > minWidth && currentX < shelfMaxX - minWidth) {
        const bookWidth = getRandomBookWidth() * currentScale;
        const bookHeight = getRandomBookHeight() * currentScale;
        const gap = settings.fill >= 0.9 ? random(0.6 * currentScale, 2.2 * currentScale) : random(1 * currentScale, 3.5 * currentScale);

        // Stop if this book would overflow the shelf
        if (currentX + bookWidth > shelfMaxX) break;

        // If this book would exceed target by more than a small margin, consider stopping (tighter when high fill)
        const overflowTolerance = settings.fill >= 0.9 ? 0.03 : 0.12;
        if (remaining - bookWidth < -overflowTolerance * targetWidth) break;

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

        // Slight underfill only if truly near end and not in high-fill mode
        if (remaining < minWidth && settings.fill < 0.9 && Math.random() < 0.4) break;
      }
    }
  }
}

function draw() {
  if (!needsRedraw) return;
  
  // Clear canvas (keep underlying CSS background visible)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Floor gradient anchored higher up to give depth
  const shelfHeight = bookcases.length > 0 ? bookcases[0].shelfHeight : 0;
  const horizonY = floorBaseline - shelfHeight / 2.5;

  const floorGrad = ctx.createLinearGradient(0, horizonY, 0, canvas.height);
  floorGrad.addColorStop(0, '#222222');
  floorGrad.addColorStop(1, '#000000');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, horizonY, canvas.width, canvas.height - horizonY);

  // Sync positions from physics bodies
  for (const book of books) {
    if (book.body) syncBookFromBody(book);
  }

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
  setPhysicsRunning(!isPreview);
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
  // Keep existing state when entering live; just recompute layout
  const restored = loadState();
  initCanvas(restored);
  saveState();
});

startOverBtn.addEventListener('click', () => {
  clearState();
  Object.assign(settings, DEFAULT_SETTINGS);
  setMode(true);
  updateUI();
  initCanvas();
});


canvas.addEventListener('mousedown', (e) => {
  if (previewMode) return;
  const pos = getMousePos(e);
  
  for (let i = books.length - 1; i >= 0; i--) {
    if (books[i].contains(pos.x, pos.y)) {
      draggedBook = books[i];
      syncBookFromBody(draggedBook);
      if (draggedBook.isOnFloor) {
        setBookOrientation(draggedBook, false);
        draggedBook.isOnFloor = false;
        removeBody(draggedBook);
        restackFloor(draggedBook);
      }
      const rect = getBookRect(draggedBook);
      dragOffsetX = pos.x - rect.x;
      dragOffsetY = pos.y - rect.y;

      removeBody(draggedBook);
      
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

function packShelf(bcIndex, shelfIndex, { keepOverflowOnShelf = false } = {}) {
  const bc = bookcases[bcIndex];
  const padding = bc.padding;
  const shelfBooks = books.filter(b => b.bookcaseIndex === bcIndex && b.shelfIndex === shelfIndex);
  shelfBooks.sort((a, b) => a.x - b.x);

  const maxX = bc.x + bc.width - padding;
  const overflow = [];
  const gap = 2 * currentScale;
  let prevEnd = bc.x + padding - gap;
  const eps = 0.8 * currentScale; // small tolerance to avoid micro nudges

  for (const book of shelfBooks) {
    setBookOrientation(book, false);
    book.isOnFloor = false;
    removeBody(book);
    const size = getOrientedSize(book);
    const minX = prevEnd + gap;
    // Allow minor overlap within eps to avoid shifting existing books
    const desiredX = book.x >= minX - eps ? book.x : minX;
    const startX = desiredX;
    if (startX + size.width <= maxX) {
      book.x = startX;
      book.y = bc.getShelfY(shelfIndex) - size.height;
      prevEnd = startX + size.width;
    } else {
      if (keepOverflowOnShelf) {
        const clampedX = Math.max(bc.x + padding, maxX - size.width);
        book.x = clampedX;
        book.y = bc.getShelfY(shelfIndex) - size.height;
        prevEnd = startX + size.width; // advance to keep ordering
      } else {
        overflow.push(book);
      }
    }
  }

  if (overflow.length) {
    overflow.forEach(b => placeBookOnFloorPhysics(b));
  }
}

function placeBookOnFloorPhysics(book) {
  const area = getFloorAreaRight();
  setBookOrientation(book, true);
  book.isOnFloor = true;
  book.bookcaseIndex = null;
  book.shelfIndex = null;
  floorOrderCounter += 1;
  book.floorOrder = floorOrderCounter;
  removeBody(book);

  if (!area) return;

  const size = getOrientedSize(book);
  const maxX = area.x + Math.max(0, area.width - size.width);
  const jitter = random(-6 * currentScale, 6 * currentScale);
  book.x = clamp(book.x + jitter, area.x, maxX);

  const stackHeight = books
    .filter(b => b !== book && b.isOnFloor)
    .reduce((h, b) => {
      const r = getBookRect(b);
      const overlapWidth = Math.min(book.x + size.width, r.x + r.width) - Math.max(book.x, r.x);
      const minWidth = Math.min(size.width, r.width);
      const sufficientOverlap = overlapWidth > 0 && overlapWidth >= 0.35 * minWidth;
      if (!sufficientOverlap) return h;
      const heightHere = area.baseline - r.y;
      return Math.max(h, heightHere);
    }, 0);

  book.y = area.baseline - stackHeight - size.height;
}

canvas.addEventListener('mouseup', (e) => {
  if (previewMode) return;
  if (!draggedBook) return;

  const pos = getMousePos(e);
  let placed = false;

  for (let bcIndex = 0; bcIndex < bookcases.length; bcIndex++) {
    const bc = bookcases[bcIndex];
    if (pos.x >= bc.x && pos.x <= bc.x + bc.width && pos.y >= bc.y && pos.y <= bc.y + bc.height) {
      const shelfIndex = bc.getShelfAtY(pos.y);
      if (shelfIndex >= 0 && shelfIndex < bc.shelves) {
        setBookOrientation(draggedBook, false);
        draggedBook.isOnFloor = false;
        draggedBook.bookcaseIndex = bcIndex;
        draggedBook.shelfIndex = shelfIndex;
        draggedBook.x = pos.x - dragOffsetX;
        const size = getOrientedSize(draggedBook);
        draggedBook.y = bc.getShelfY(shelfIndex) - size.height;
        removeBody(draggedBook);
        packShelf(bcIndex, shelfIndex);
        placed = true;
        break;
      }
    }
  }

  if (!placed) {
    draggedBook.x = pos.x - dragOffsetX;
    placeBookOnFloorPhysics(draggedBook);
  }

  canvas.classList.remove('dragging');
  draggedBook = null;
  restackFloor();
  saveState();
  needsRedraw = true;
});

window.addEventListener('resize', () => {
  initCanvas(loadState());
});

// Animation loop - only redraws when needed
function animate() {
  if (needsRedraw) {
    draw();
    needsRedraw = false;
  }
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

// Initialize video with random start
const videoFrame = document.getElementById('video-frame');
if (videoFrame) {
  // Random start between 30 minutes (1800s) and 10 hours (36000s)
  const minStart = 1800;
  const maxStart = 36000;
  const start = Math.floor(Math.random() * (maxStart - minStart) + minStart);
  // mute=1 and playsinline=1 are required for mobile autoplay
  videoFrame.src = `https://www.youtube.com/embed/sF80I-TQiW0?autoplay=1&mute=1&playsinline=1&loop=1&playlist=sF80I-TQiW0&start=${start}`;
}

animate();
