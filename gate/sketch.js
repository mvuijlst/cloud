// ── Shape definitions ──
// Each shape is a polygon with localPts (relative to center) + animation state
let shapes = [];
let font;
let word = 'GATEKEEPER';

let fontSize = 90;
let bgColor = '#f0ea21';
let hullColor = '#2680f0';

function preload() {
    font = loadFont('Roboto-Bold.ttf');
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    pixelDensity(1);
    textFont(font);
    textAlign(CENTER, CENTER);

    document.getElementById('animBtn').addEventListener('click', () => {
        word = document.getElementById('wordInput').value.toUpperCase();
        initShapes();
    });

    initShapes();
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    initShapes();
}

function mousePressed() {
    // Ignore clicks on the controls
    if (mouseY < 50) return;
    randomizeColors();
    initShapes();
}

function randomizeColors() {
    // Pick a random hue, then use complementary for high contrast
    let bgHue = random(360);
    let hullHue = (bgHue + 120 + random(-30, 30)) % 360;
    colorMode(HSB, 360, 100, 100);
    bgColor = color(bgHue, random(70, 95), random(85, 100));
    hullColor = color(hullHue, random(70, 95), random(55, 80));
    colorMode(RGB, 255);
    // Update HTML background to match
    let r = Math.round(red(bgColor)), g = Math.round(green(bgColor)), b = Math.round(blue(bgColor));
    let bgHex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    document.body.style.backgroundColor = bgHex;
    document.getElementById('controls').style.backgroundColor = bgHex;
    // Set attribution text to a contrasting color
    let lum = r * 0.299 + g * 0.587 + b * 0.114;
    let textCol = lum > 140 ? '#333' : '#ddd';
    let attrEl = document.getElementById('attribution');
    attrEl.style.color = textCol;
    attrEl.querySelector('a').style.color = textCol;
}

// Convert a single letter to a polygon shape (outline points centered on 0,0)
function letterToShape(char, fSize) {
    // Get path at origin to find glyph center
    let pathAtOrigin = font.font.getPath(char, 0, 0, fSize);

    // Sample points along bezier curves for smooth hull
    let pts = [];
    let curX = 0, curY = 0;
    const STEPS = 8; // subdivisions per curve segment
    for (let cmd of pathAtOrigin.commands) {
        if (cmd.type === 'M' || cmd.type === 'L') {
            pts.push({x: cmd.x, y: cmd.y});
            curX = cmd.x; curY = cmd.y;
        } else if (cmd.type === 'Q') {
            for (let i = 1; i <= STEPS; i++) {
                let t = i / STEPS;
                let mt = 1 - t;
                pts.push({
                    x: mt * mt * curX + 2 * mt * t * cmd.x1 + t * t * cmd.x,
                    y: mt * mt * curY + 2 * mt * t * cmd.y1 + t * t * cmd.y
                });
            }
            curX = cmd.x; curY = cmd.y;
        } else if (cmd.type === 'C') {
            for (let i = 1; i <= STEPS; i++) {
                let t = i / STEPS;
                let mt = 1 - t;
                pts.push({
                    x: mt*mt*mt*curX + 3*mt*mt*t*cmd.x1 + 3*mt*t*t*cmd.x2 + t*t*t*cmd.x,
                    y: mt*mt*mt*curY + 3*mt*mt*t*cmd.y1 + 3*mt*t*t*cmd.y2 + t*t*t*cmd.y
                });
            }
            curX = cmd.x; curY = cmd.y;
        } else if (cmd.type === 'Z') {
            // close path, no new points
        }
    }
    if (pts.length === 0) return null;

    // Compute geometric center from the actual path vertices
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let p of pts) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    }
    let cx = (minX + maxX) / 2;
    let cy = (minY + maxY) / 2;

    // Get a centered path (shifted so glyph center is at 0,0) for rendering
    let centeredPath = font.font.getPath(char, -cx, -cy, fSize);

    // Center the hull points the same way
    let centered = pts.map(p => ({x: p.x - cx, y: p.y - cy}));
    let hull = convexHull(centered);

    return {
        localPts: hull,
        path: centeredPath,
        halfH: (maxY - minY) / 2,
        halfW: (maxX - minX) / 2,
        char: char
    };
}

function initShapes() {
    shapes = [];
    let n = word.length;
    if (n === 0) return;

    // On landscape/wide screens, constrain to a square centered on screen
    // On portrait/tall screens, use full dimensions
    let areaW = width;
    let areaH = height;
    if (areaW > areaH) {
        areaW = areaH; // square constraint on wide screens
    }

    // Compute font size so all letters fit vertically with spacing
    let usableH = areaH * 0.85;
    let spacingRatio = 1.15; // spacing = fontSize * spacingRatio
    fontSize = usableH / (n * spacingRatio);
    fontSize = Math.min(fontSize, 300); // cap at reasonable max

    let spacing = fontSize * spacingRatio;
    let totalH = n * spacing;
    let topY = (height - totalH) / 2 + spacing / 2 - fontSize * 0.5;

    // Max horizontal oscillation: constrain so letters + their width stay on screen
    // We'll compute per-letter after building shapes
    let maxHalfW = 0;

    // First pass: build letter data
    let letterDatas = [];
    for (let i = 0; i < n; i++) {
        let ld = letterToShape(word[i], fontSize);
        if (!ld) continue;
        letterDatas.push(ld);
        maxHalfW = Math.max(maxHalfW, ld.halfW);
    }

    // Max horizontal displacement: letter center can go from halfW to width-halfW
    let maxOffset = (areaW / 2) - maxHalfW - 20; // 20px margin
    maxOffset = Math.max(maxOffset, fontSize * 0.5); // minimum travel

    for (let i = 0; i < letterDatas.length; i++) {
        let letterData = letterDatas[i];
        let oA = random(-maxOffset, -maxOffset * 0.3);
        let oB = random(maxOffset * 0.3, maxOffset);

        // Set rollR so the letter completes exact full rotations
        // between offsetA and offsetB (upright at both extremes)
        let travel = oB - oA;
        let naturalR = letterData.halfH;
        let numRot = Math.max(1, Math.round(travel / (TWO_PI * naturalR)));
        let rollR = travel / (TWO_PI * numRot);

        shapes.push({
            type: 'polygon',
            localPts: letterData.localPts,
            path: letterData.path,
            char: letterData.char,
            baseX: width / 2,
            baseY: topY + i * spacing,
            offsetA: oA,
            offsetB: oB,
            freq: random(0.003, 0.006),
            phase: random(1.0),
            angle: 0,
            x: 0,
            y: 0,
            rollR: rollR,
            pts: [] // world-space points computed each frame
        });
    }
}

// ── Animation timing constants ──
const ANTIC_FRAC = 0.10;    // fraction of half-cycle for anticipation windup
const ANTIC_AMOUNT = 0.03;  // how far back the anticipation goes (fraction of travel)
const OVER_FRAC = 0.08;     // fraction of half-cycle for overshoot settle
const OVER_AMOUNT = 0.04;   // how far past 1.0 the overshoot goes
const END_HOLD = 0.02;      // fraction of half-cycle to hold at rest after overshoot
const MOVE_FRAC = 1 - ANTIC_FRAC - OVER_FRAC - END_HOLD;

// Map a 0→1 half-cycle progress into a position value with anticipation + move + overshoot + hold
function animCurve(p) {
    if (p < ANTIC_FRAC) {
        // Anticipation: smoothstep back (fluid start and end)
        let at = p / ANTIC_FRAC; // 0→1
        let eased = at * at * (3 - 2 * at); // smoothstep
        return -ANTIC_AMOUNT * eased;
    } else if (p < ANTIC_FRAC + MOVE_FRAC) {
        // Main move: from -ANTIC_AMOUNT to 1 + OVER_AMOUNT
        let mt = (p - ANTIC_FRAC) / MOVE_FRAC; // 0→1
        let eased = mt * mt * (3 - 2 * mt); // smoothstep
        return lerp(-ANTIC_AMOUNT, 1 + OVER_AMOUNT, eased);
    } else if (p < ANTIC_FRAC + MOVE_FRAC + OVER_FRAC) {
        // Overshoot settle: ease from 1 + OVER_AMOUNT back to 1
        let ot = (p - ANTIC_FRAC - MOVE_FRAC) / OVER_FRAC; // 0→1
        let eased = ot * ot * (3 - 2 * ot); // smoothstep
        return lerp(1 + OVER_AMOUNT, 1, eased);
    } else {
        // Hold at rest
        return 1;
    }
}

// ── Update shape positions each frame ──
function updateShapes() {
    for (let s of shapes) {
        // Ping-pong timer: ramp 0→1→0 over the period
        let raw = (frameCount * s.freq + s.phase) % 1;
        let halfPhase, forward;
        if (raw < 0.5) {
            halfPhase = raw * 2; // 0→1 (moving A→B)
            forward = true;
        } else {
            halfPhase = (raw - 0.5) * 2; // 0→1 (moving B→A)
            forward = false;
        }

        let curve = animCurve(halfPhase);
        let t = forward ? curve : 1 - curve;

        let dx = lerp(s.offsetA, s.offsetB, t);

        s.x = s.baseX + dx;
        s.y = s.baseY;

        // Rolling angle: realistic roll from leftmost extreme
        // rollR is tuned so (offsetB - offsetA) / rollR = exact multiple of 2π
        s.angle = (dx - s.offsetA) / s.rollR;

        // Compute world-space pts from localPts + rotation + translation
        let ca = cos(s.angle), sa = sin(s.angle);
        s.pts = s.localPts.map(p => ({
            x: p.x * ca - p.y * sa + s.x,
            y: p.x * sa + p.y * ca + s.y
        }));
    }
}

// ── Sample boundary points from all shapes ──
function getBoundaryPoints(shape) {
    return shape.pts.map(p => ({x: p.x, y: p.y, shape: shape}));
}

// ── Convex hull (Andrew's monotone chain) ──
function convexHull(points) {
    if (points.length < 3) return points.slice();
    let pts = points.slice().sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    let lower = [];
    for (let p of pts) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
        lower.push(p);
    }
    let upper = [];
    for (let i = pts.length - 1; i >= 0; i--) {
        let p = pts[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
        upper.push(p);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
}

// ── Draw the hull ──
function drawHull(hull) {
    fill(hullColor);
    stroke('#000');
    strokeWeight(4);
    strokeJoin(ROUND);

    beginShape();
    for (let pt of hull) {
        vertex(pt.x, pt.y);
    }
    endShape(CLOSE);
}

function draw() {
    background(bgColor);

    updateShapes();

    // Compute global hull from all shapes' boundary points
    let allPts = [];
    for (let s of shapes) {
        allPts = allPts.concat(getBoundaryPoints(s));
    }
    let hull = convexHull(allPts);

    // Draw hull behind
    drawHull(hull);

    // Draw letters on top using the same centered opentype paths as the hull
    for (let s of shapes) {
        push();
        translate(s.x, s.y);
        rotate(s.angle);
        drawingContext.lineJoin = 'round';
        s.path.fill = '#ffffff';
        s.path.stroke = '#222222';
        s.path.strokeWidth = 3;
        s.path.draw(drawingContext);
        pop();
    }
}