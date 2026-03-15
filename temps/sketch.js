// === French Revolutionary Calendar & Decimal Time ===

const MONTH_NAMES = [
  'Vendémiaire', 'Brumaire', 'Frimaire',
  'Nivôse', 'Pluviôse', 'Ventôse',
  'Germinal', 'Floréal', 'Prairial',
  'Messidor', 'Thermidor', 'Fructidor'
];

const MONTH_DESCRIPTIONS = [
  'mois des vendanges', 'mois des brumes', 'mois du froid',
  'mois de la neige', 'mois de la pluie', 'mois du vent',
  'mois de la germination', 'mois des fleurs', 'mois des prairies',
  'mois des moissons', 'mois de la chaleur', 'mois des fruits'
];

const DAY_NAMES = [
  'Primidi', 'Duodi', 'Tridi', 'Quartidi', 'Quintidi',
  'Sextidi', 'Septidi', 'Octidi', 'Nonidi', 'Décadi'
];

const SANSCULOTTIDES = [
  'Jour de la Vertu', 'Jour du Génie', 'Jour du Travail',
  'Jour de l\'Opinion', 'Jour des Récompenses', 'Jour de la Révolution'
];

// Approximate autumnal equinox for a given Gregorian year
function autumnalEquinox(year) {
  // Simple approximation: Sept 22 or 23
  // More precise: use astronomical formula
  const jde = 2451810.21715 + 365.242189623 * (year - 2000);
  const T = (jde - 2451545.0) / 36525;
  // Rough correction
  const equinox = new Date(year, 8, 22, 12, 0, 0); // Sept 22 noon as fallback
  // Adjust based on known pattern
  const base = new Date(2000, 8, 22, 17, 28, 0); // Sept 22, 2000 equinox UTC
  const yearDiff = year - 2000;
  // Each year the equinox shifts by ~5h 49m, reset every 4 years by leap day
  let hours = 17 + (yearDiff * 5.8155);
  let days = 22 + Math.floor(hours / 24);
  hours = hours % 24;
  // Leap year corrections
  const leapYears = Math.floor(yearDiff / 4) - Math.floor(yearDiff / 100) + Math.floor(yearDiff / 400);
  days -= leapYears;
  while (days > 30) { days -= 30; }
  while (days < 21) { days += 1; }
  return new Date(Date.UTC(year, 8, Math.min(Math.max(days, 21), 24), 0, 0, 0));
}

// Convert Gregorian date to French Revolutionary calendar
function toRevolutionary(date) {
  const year = date.getFullYear();

  // Find the start of the current Republican year
  let equinoxThisYear = new Date(Date.UTC(year, 8, 22));
  let equinoxLastYear = new Date(Date.UTC(year - 1, 8, 22));

  let repYearStart, repYear;
  if (date >= equinoxThisYear) {
    repYearStart = equinoxThisYear;
    repYear = year - 1791;
  } else {
    repYearStart = equinoxLastYear;
    repYear = year - 1792;
  }

  // Day of the republican year (0-indexed)
  const msPerDay = 86400000;
  const dayOfYear = Math.floor((date - repYearStart) / msPerDay);

  if (dayOfYear >= 360) {
    // Sansculottides (complementary days)
    const sansIdx = dayOfYear - 360;
    return {
      year: repYear,
      month: -1,
      monthName: 'Sansculottides',
      day: sansIdx + 1,
      dayName: SANSCULOTTIDES[Math.min(sansIdx, 5)],
      dayOfYear: dayOfYear + 1,
      description: ''
    };
  }

  const month = Math.floor(dayOfYear / 30);
  const dayInMonth = (dayOfYear % 30) + 1;
  const dayOfDecade = ((dayOfYear % 30) % 10);

  return {
    year: repYear,
    month: month,
    monthName: MONTH_NAMES[month] || 'Complémentaires',
    day: dayInMonth,
    dayName: DAY_NAMES[dayOfDecade],
    dayOfYear: dayOfYear + 1,
    description: MONTH_DESCRIPTIONS[month] || ''
  };
}

// Convert to decimal (Republican) time
function toDecimalTime(date) {
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);
  const msSinceMidnight = date - midnight;
  const fractionOfDay = msSinceMidnight / 86400000;

  const totalDecimalSeconds = fractionOfDay * 100000;
  const hours = Math.floor(totalDecimalSeconds / 10000);
  const minutes = Math.floor((totalDecimalSeconds % 10000) / 100);
  const seconds = Math.floor(totalDecimalSeconds % 100);

  return { hours, minutes, seconds, fraction: fractionOfDay };
}

// Roman numeral conversion
function toRoman(num) {
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let result = '';
  for (let i = 0; i < vals.length; i++) {
    while (num >= vals[i]) {
      result += syms[i];
      num -= vals[i];
    }
  }
  return result;
}

// === p5.js Sketch ===

let particles = [];
let bgBuffer;
let digitalMode = false;

// Flap animation state: keyed by position index
// Each entry: { prevChar, newChar, progress (0–1), startTime }
let flapAnims = {};
let prevDigits = '';

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('Playfair Display');
  buildBackground();

  for (let i = 0; i < 40; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      size: random(0.8, 2),
      speed: random(0.05, 0.3),
      drift: random(-0.2, 0.2),
      alpha: random(20, 60)
    });
  }
}

function mousePressed() {
  digitalMode = !digitalMode;
}

function keyPressed() {
  if (key === 'd' || key === 'D') digitalMode = !digitalMode;
}

function buildBackground() {
  bgBuffer = createGraphics(width, height);
  let ctx = bgBuffer.drawingContext;
  // Solid dark base
  ctx.fillStyle = 'rgb(15, 12, 28)';
  ctx.fillRect(0, 0, width, height);
  // Smooth radial vignette using native gradient — no banding
  let cx = width / 2;
  let cy = height * 0.4;
  let r = max(width, height) * 0.55;
  let grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(55, 32, 28, 0.25)');
  grad.addColorStop(0.4, 'rgba(40, 22, 22, 0.12)');
  grad.addColorStop(1, 'rgba(15, 12, 28, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function draw() {
  image(bgBuffer, 0, 0);

  drawParticles();
  drawBorder();

  const now = new Date();
  const rev = toRevolutionary(now);
  const decTime = toDecimalTime(now);

  const landscape = width > height;

  if (landscape) {
    const clockRadius = min(width * 0.25, height * 0.3);
    const clockCx = width * 0.28;
    const clockCy = height * 0.5;
    if (digitalMode) {
      drawDigitalClock(clockCx, clockCy, clockRadius, decTime);
    } else {
      drawClockFace(clockCx, clockCy, clockRadius, decTime);
    }
    drawDate(width * 0.68, height * 0.5, rev);
  } else {
    const clockRadius = min(width, height) * 0.18;
    const cx = width / 2;
    const clockCy = height * 0.25;
    if (digitalMode) {
      drawDigitalClock(cx, clockCy, clockRadius, decTime);
    } else {
      drawClockFace(cx, clockCy, clockRadius, decTime);
    }
    const clockBottom = clockCy + clockRadius * 1.25;
    const bottomMargin = height - 30;
    const dateZoneCy = clockBottom + (bottomMargin - clockBottom) * 0.45;
    drawDate(cx, dateZoneCy, rev);
  }
}

function drawParticles() {
  noStroke();
  for (let p of particles) {
    p.y -= p.speed;
    p.x += p.drift + sin(frameCount * 0.008 + p.x) * 0.15;
    if (p.y < -10) { p.y = height + 10; p.x = random(width); }
    if (p.x < -10) p.x = width + 10;
    if (p.x > width + 10) p.x = -10;
    let flicker = 0.6 + 0.4 * sin(frameCount * 0.015 + p.x * 0.5);
    fill(195, 165, 90, p.alpha * flicker);
    ellipse(p.x, p.y, p.size);
  }
}

function drawBorder() {
  noFill();
  const m = 20;
  const cornerR = 15;

  // Outer border - gold
  stroke(195, 165, 90, 120);
  strokeWeight(2);
  rect(m, m, width - 2 * m, height - 2 * m, cornerR);

  // Inner border - thin gold
  stroke(195, 165, 90, 60);
  strokeWeight(1);
  rect(m + 8, m + 8, width - 2 * (m + 8), height - 2 * (m + 8), cornerR - 4);

  // Corner ornaments
  drawCornerOrnament(m + 8, m + 8, 1, 1);
  drawCornerOrnament(width - m - 8, m + 8, -1, 1);
  drawCornerOrnament(m + 8, height - m - 8, 1, -1);
  drawCornerOrnament(width - m - 8, height - m - 8, -1, -1);
}

function drawCornerOrnament(x, y, dx, dy) {
  push();
  translate(x, y);
  stroke(195, 165, 90, 80);
  strokeWeight(1.5);
  noFill();
  // Small decorative curves
  for (let i = 0; i < 3; i++) {
    let len = 12 + i * 6;
    let offset = i * 4;
    bezier(
      offset * dx, dy * 2,
      dx * len * 0.5, dy * len * 0.3,
      dx * len * 0.3, dy * len * 0.5,
      2 * dx, offset * dy
    );
  }
  pop();
}

function drawClockFace(cx, cy, radius, decTime) {
  push();
  translate(cx, cy);

  // Smooth outer glow using native radial gradient
  let ctx = drawingContext;
  ctx.save();
  let glowR = radius * 1.4;
  let grad = ctx.createRadialGradient(0, 0, radius * 0.95, 0, 0, glowR);
  grad.addColorStop(0, 'rgba(160, 130, 60, 0.15)');
  grad.addColorStop(0.5, 'rgba(140, 110, 40, 0.05)');
  grad.addColorStop(1, 'rgba(140, 110, 40, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, glowR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Clock face background
  fill(20, 16, 32, 230);
  stroke(195, 165, 90, 150);
  strokeWeight(2.5);
  ellipse(0, 0, radius * 2);

  // Inner ring
  noFill();
  stroke(195, 165, 90, 60);
  strokeWeight(1);
  ellipse(0, 0, radius * 1.7);

  // Decorative ring
  stroke(195, 165, 90, 30);
  ellipse(0, 0, radius * 1.85);

  // 10 hour markers
  for (let i = 0; i < 10; i++) {
    let angle = map(i, 0, 10, -HALF_PI, TWO_PI - HALF_PI);
    let innerR = radius * 0.82;
    let outerR = radius * 0.92;

    stroke(195, 165, 90, 200);
    strokeWeight(2.5);
    line(cos(angle) * innerR, sin(angle) * innerR,
         cos(angle) * outerR, sin(angle) * outerR);

    // Hour numbers
    let numR = radius * 0.72;
    noStroke();
    fill(240, 232, 212);
    textAlign(CENTER, CENTER);
    textSize(radius * 0.12);
    textStyle(BOLD);
    text(i, cos(angle) * numR, sin(angle) * numR);
  }

  // 100 minute markers
  for (let i = 0; i < 100; i++) {
    if (i % 10 === 0) continue;
    let angle = map(i, 0, 100, -HALF_PI, TWO_PI - HALF_PI);
    let innerR = radius * 0.88;
    let outerR = radius * 0.92;
    stroke(195, 165, 90, i % 5 === 0 ? 100 : 40);
    strokeWeight(i % 5 === 0 ? 1.5 : 0.8);
    line(cos(angle) * innerR, sin(angle) * innerR,
         cos(angle) * outerR, sin(angle) * outerR);
  }

  // "TEMPS DÉCIMAL" removed for cleaner look

  // Phrygian cap symbol (simplified)
  drawPhrygianCap(0, radius * 0.32, radius * 0.08);

  // Clock hands
  // Hours hand
  let hourAngle = map(decTime.hours + decTime.minutes / 100, 0, 10, -HALF_PI, TWO_PI - HALF_PI);
  stroke(240, 232, 212);
  strokeWeight(3.5);
  strokeCap(ROUND);
  line(0, 0, cos(hourAngle) * radius * 0.45, sin(hourAngle) * radius * 0.45);

  // Minutes hand
  let minAngle = map(decTime.minutes + decTime.seconds / 100, 0, 100, -HALF_PI, TWO_PI - HALF_PI);
  stroke(240, 232, 212);
  strokeWeight(2);
  line(0, 0, cos(minAngle) * radius * 0.65, sin(minAngle) * radius * 0.65);

  // Seconds hand
  let secAngle = map(decTime.seconds, 0, 100, -HALF_PI, TWO_PI - HALF_PI);
  stroke(180, 30, 30);
  strokeWeight(1);
  line(0, 0, cos(secAngle) * radius * 0.72, sin(secAngle) * radius * 0.72);
  // Counter-weight
  line(0, 0, cos(secAngle + PI) * radius * 0.15, sin(secAngle + PI) * radius * 0.15);

  // Center cap
  noStroke();
  fill(195, 165, 90);
  ellipse(0, 0, 8);
  fill(20, 16, 32);
  ellipse(0, 0, 4);

  // Digital readout below the clock
  let timeStr = nf(decTime.hours, 1) + 'h ' +
                nf(decTime.minutes, 2) + 'm ' +
                nf(decTime.seconds, 2) + 's';

  noStroke();
  fill(195, 165, 90, 180);
  textSize(radius * 0.14);
  textStyle(NORMAL);
  textAlign(CENTER, CENTER);
  text(timeStr, 0, radius + radius * 0.22);

  pop();
}

function drawPhrygianCap(x, y, size) {
  push();
  translate(x, y);
  noStroke();
  fill(180, 30, 30, 150);
  // Simplified Phrygian cap shape
  beginShape();
  vertex(-size * 0.6, size * 0.2);
  bezierVertex(-size * 0.6, -size * 0.3, -size * 0.1, -size * 0.8, size * 0.3, -size * 0.9);
  bezierVertex(size * 0.5, -size * 0.5, size * 0.4, 0, size * 0.6, size * 0.2);
  vertex(-size * 0.6, size * 0.2);
  endShape(CLOSE);
  // Brim
  fill(180, 30, 30, 100);
  ellipse(0, size * 0.2, size * 1.4, size * 0.25);
  pop();
}

function drawDate(cx, cy, rev) {
  push();
  translate(cx, cy);

  const s = min(width, height);
  const landscape = width > height;
  const scale = landscape ? 1.3 : 1.4;
  const gap = s * 0.045 * scale;

  // Decorative top line
  stroke(195, 165, 90, 80);
  strokeWeight(1);
  let lw = min(width * 0.35, 260);
  let topLine = -gap * 3.0;
  line(-lw / 2, topLine, lw / 2, topLine);
  noStroke();
  fill(195, 165, 90, 80);
  drawDiamond(0, topLine, 5);

  // Day name
  noStroke();
  fill(240, 232, 212);
  textAlign(CENTER, CENTER);
  textStyle(NORMAL);
  textSize(s * 0.03 * scale);
  text(rev.dayName, 0, -gap * 2.0);

  // Large day number
  fill(195, 165, 90);
  textStyle(BOLD);
  textSize(s * 0.07 * scale);
  text(rev.day, 0, -gap * 0.3);

  // Month name
  fill(240, 232, 212);
  textStyle(NORMAL);
  textSize(s * 0.045 * scale);
  text(rev.monthName, 0, gap * 1.2);

  // Month description
  fill(195, 165, 90, 140);
  textStyle(ITALIC);
  textSize(s * 0.018 * scale);
  text(rev.description, 0, gap * 2.2);

  // Year in Roman numerals
  fill(240, 232, 212, 200);
  textStyle(NORMAL);
  textSize(s * 0.026 * scale);
  text('An ' + toRoman(rev.year), 0, gap * 3.1);

  // Decorative bottom line
  stroke(195, 165, 90, 80);
  strokeWeight(1);
  let botLine = gap * 3.8;
  line(-lw / 2, botLine, lw / 2, botLine);
  noStroke();
  fill(195, 165, 90, 80);
  drawDiamond(0, botLine, 5);

  pop();
}

function drawDiamond(x, y, s) {
  quad(x, y - s, x + s * 0.6, y, x, y + s, x - s * 0.6, y);
}

// Draw a single split-flap card with optional flip animation
function drawFlap(x, y, w, h, char, slotIndex) {
  let r = h * 0.04;
  let ctx = drawingContext;
  let half = h * 0.5;
  let splitGap = h * 0.01;

  let anim = flapAnims[slotIndex];
  let flipping = anim && anim.progress < 1;
  let oldChar = flipping ? anim.prevChar : char;

  push();
  translate(x, y);

  // Housing
  noStroke();
  fill(16, 16, 18);
  rect(-w * 0.05, -h * 0.025, w * 1.1, h * 1.05, r);

  // === TOP HALF — shows new char (revealed behind falling flap) ===
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, w, half - splitGap / 2, [r, r, 0, 0]);
  ctx.clip();

  noStroke();
  fill(50, 50, 54);
  rect(0, 0, w, half);

  // Slight darkening toward the split
  let tg = ctx.createLinearGradient(0, half - h * 0.08, 0, half);
  tg.addColorStop(0, 'rgba(0,0,0,0)');
  tg.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = tg;
  ctx.fillRect(0, 0, w, half);

  noStroke();
  fill(235, 235, 238);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(h * 0.66);
  text(char, w / 2, h * 0.48);

  ctx.restore();

  // === BOTTOM HALF — shows new char ===
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, half + splitGap / 2, w, half - splitGap / 2, [0, 0, r, r]);
  ctx.clip();

  noStroke();
  fill(42, 42, 46);
  rect(0, half + splitGap / 2, w, half);

  // Shadow at top of bottom half
  let bg = ctx.createLinearGradient(0, half, 0, half + h * 0.06);
  bg.addColorStop(0, 'rgba(0,0,0,0.3)');
  bg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, half, w, h * 0.06);

  noStroke();
  fill(215, 215, 218);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(h * 0.66);
  text(char, w / 2, h * 0.48);

  ctx.restore();

  // Split line
  stroke(6, 6, 8);
  strokeWeight(splitGap * 1.2);
  line(0, half, w, half);

  // Side hinges — minimal
  let hw = w * 0.04;
  noStroke();
  fill(30, 30, 32);
  rect(-hw * 0.6, half - h * 0.04, hw, h * 0.08, 1);
  rect(w - hw * 0.4, half - h * 0.04, hw, h * 0.08, 1);
  fill(55, 55, 58);
  ellipse(-hw * 0.1, half, hw * 0.4);
  ellipse(w + hw * 0.1, half, hw * 0.4);

  // === FLIP ANIMATION ===
  if (flipping) {
    let t = anim.progress;
    // Snap easing: fast in the middle, sharp stop
    let eased = t < 0.5
      ? 2 * t * t
      : 1 - pow(-2 * t + 2, 3) / 2;

    if (eased < 0.5) {
      // Top flap falling with old char
      let angle = eased * 2; // 0→1
      let scaleY = cos(angle * HALF_PI);
      if (scaleY > 0.005) {
        ctx.save();
        ctx.translate(0, half);
        ctx.scale(1, scaleY);
        ctx.translate(0, -half);

        ctx.beginPath();
        ctx.roundRect(0, 0, w, half - splitGap / 2, [r, r, 0, 0]);
        ctx.clip();

        noStroke();
        fill(50, 50, 54);
        rect(0, 0, w, half);

        fill(0, 0, 0, (1 - scaleY) * 100);
        rect(0, 0, w, half);

        noStroke();
        let c = lerp(235, 100, 1 - scaleY);
        fill(c, c, c + 3);
        textAlign(CENTER, CENTER);
        textStyle(BOLD);
        textSize(h * 0.66);
        text(oldChar, w / 2, h * 0.48);

        ctx.restore();
      }
    } else {
      // Bottom flap unfolding with new char
      let angle = (1 - eased) * 2; // 1→0
      let scaleY = cos(angle * HALF_PI);
      if (scaleY > 0.005) {
        ctx.save();
        ctx.translate(0, half + splitGap / 2);
        ctx.scale(1, scaleY);

        ctx.beginPath();
        ctx.roundRect(0, 0, w, half - splitGap / 2, [0, 0, r, r]);
        ctx.clip();

        noStroke();
        fill(42, 42, 46);
        rect(0, 0, w, half);

        fill(0, 0, 0, (1 - scaleY) * 80);
        rect(0, 0, w, half);

        noStroke();
        let c = lerp(100, 215, scaleY);
        fill(c, c, c + 3);
        textAlign(CENTER, CENTER);
        textStyle(BOLD);
        textSize(h * 0.66);
        text(char, w / 2, h * 0.48 - (half + splitGap / 2));

        ctx.restore();
      }
    }
  }

  pop();
}

// Draw separator dots between flap groups
function drawFlapSeparator(x, y, h) {
  noStroke();
  fill(195, 165, 90, 140);
  let dotR = h * 0.045;
  ellipse(x, y + h * 0.3, dotR);
  ellipse(x, y + h * 0.6, dotR);
}

function drawDigitalClock(cx, cy, radius, decTime) {
  push();
  translate(cx, cy);

  let h = nf(decTime.hours, 1);
  let m = nf(decTime.minutes, 2);
  let s = nf(decTime.seconds, 2);
  let digits = h + m + s;

  // Update flip animations
  let now = millis();
  let flipDuration = 120; // ms — fast snap
  for (let i = 0; i < digits.length; i++) {
    let prev = prevDigits[i];
    let cur = digits[i];
    if (prev !== undefined && prev !== cur && (!flapAnims[i] || flapAnims[i].newChar !== cur)) {
      flapAnims[i] = { prevChar: prev, newChar: cur, startTime: now };
    }
    if (flapAnims[i]) {
      flapAnims[i].progress = constrain((now - flapAnims[i].startTime) / flipDuration, 0, 1);
    }
  }
  prevDigits = digits;

  // Flap dimensions scaled to radius
  let flapH = radius * 0.7;
  let flapW = flapH * 0.62;
  let flapGap = flapW * 0.12;
  let groupGap = flapW * 0.35;

  // Total width: 1 + gap + 2 + gap + 2 + separators
  let totalW = flapW * 5 + flapGap * 4 + groupGap * 2;
  let startX = -totalW / 2;
  let startY = -flapH / 2;

  // Background panel behind all flaps (dark housing)
  let panelPad = flapW * 0.2;
  noStroke();
  fill(14, 14, 16, 220);
  rect(startX - panelPad, startY - panelPad * 1.2,
       totalW + panelPad * 2, flapH + panelPad * 2.8,
       flapH * 0.06);

  // Subtle inner shadow on panel
  let ctx = drawingContext;
  ctx.save();
  let panelGrad = ctx.createLinearGradient(
    0, startY - panelPad * 1.2,
    0, startY - panelPad * 1.2 + flapH + panelPad * 2.8
  );
  panelGrad.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
  panelGrad.addColorStop(0.1, 'rgba(0, 0, 0, 0.0)');
  panelGrad.addColorStop(0.9, 'rgba(0, 0, 0, 0.0)');
  panelGrad.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
  ctx.fillStyle = panelGrad;
  ctx.fillRect(
    startX - panelPad, startY - panelPad * 1.2,
    totalW + panelPad * 2, flapH + panelPad * 2.8
  );
  ctx.restore();

  // Thin border on panel
  noFill();
  stroke(60, 58, 55, 40);
  strokeWeight(1);
  rect(startX - panelPad, startY - panelPad * 1.2,
       totalW + panelPad * 2, flapH + panelPad * 2.8,
       flapH * 0.06);

  // Draw flaps
  let xPos = startX;

  // Hours (1 digit)
  drawFlap(xPos, startY, flapW, flapH, h, 0);
  xPos += flapW + flapGap;

  // Separator
  drawFlapSeparator(xPos + groupGap * 0.3, startY, flapH);
  xPos += groupGap;

  // Minutes (2 digits)
  drawFlap(xPos, startY, flapW, flapH, m[0], 1);
  xPos += flapW + flapGap;
  drawFlap(xPos, startY, flapW, flapH, m[1], 2);
  xPos += flapW + flapGap;

  // Separator
  drawFlapSeparator(xPos + groupGap * 0.3, startY, flapH);
  xPos += groupGap;

  // Seconds (2 digits)
  drawFlap(xPos, startY, flapW, flapH, s[0], 3);
  xPos += flapW + flapGap;
  drawFlap(xPos, startY, flapW, flapH, s[1], 4);

  // Labels below
  noStroke();
  fill(195, 165, 90, 100);
  textStyle(NORMAL);
  textSize(flapH * 0.12);
  textAlign(CENTER, TOP);
  let labelY = startY + flapH + panelPad * 0.4;

  let hLabelX = startX + flapW * 0.5;
  text('heures', hLabelX, labelY);

  let mLabelX = startX + flapW + flapGap + groupGap + flapW;
  text('minutes', mLabelX, labelY);

  let sLabelX = startX + flapW * 3 + flapGap * 3 + groupGap * 2 + flapW * 0.5 - flapGap * 0.5;
  text('secondes', sLabelX, labelY);

  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  buildBackground();
  particles = [];
  for (let i = 0; i < 40; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      size: random(0.8, 2),
      speed: random(0.05, 0.3),
      drift: random(-0.2, 0.2),
      alpha: random(20, 60)
    });
  }
}
