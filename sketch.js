let wheels = [];
let myFont;

function preload() {
    myFont = loadFont('Metamorphous-Regular.ttf');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont(myFont);
  
  // Define the 6 wheels for HH MM SS
  // Format: offsetX, offsetY, displaySize, spread
  
  // Hours (Large, Top-Leftish)
  wheels.push(new NumberWheel(-50, -80, 110, 200, true)); // H1
  wheels.push(new NumberWheel(10, -80, 110, 200, true));  // H2
  
  // Minutes (Medium, Center-Rightish)
  wheels.push(new NumberWheel(50, -30, 60, 150));   // M1
  wheels.push(new NumberWheel(85, -30, 60, 150));  // M2
  
  // Seconds (Small, Bottom-Rightish)
  wheels.push(new NumberWheel(10, 20, 30, 100));   // S1
  wheels.push(new NumberWheel(30, 20, 30, 100));  // S2
}

function draw() {
  background(0);
  
  // Get current time
  let h = hour();
  let m = minute();
  let s = second();
  
  // Split into digits
  let digits = [
    floor(h / 10), h % 10,
    floor(m / 10), m % 10,
    floor(s / 10), s % 10
  ];
  
  // Update and draw each wheel
  for (let i = 0; i < 6; i++) {
    wheels[i].update(digits[i]);
    wheels[i].draw();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function mousePressed() {
  for (let w of wheels) {
    w.randomize();
  }
}

class NumberWheel {
  constructor(offsetX, offsetY, displaySize, spread, isHeartbeat = false) {
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.displaySize = displaySize;
    this.spread = spread;
    this.isHeartbeat = isHeartbeat;
    
    this.numbers = [];
    this.sourceNumbers = [];
    this.destNumbers = [];
    
    this.currentDigit = 0;
    this.prevDigit = 0;
    this.lastChangeTime = 0;
    this.transitionDuration = 800; // ms for digit change
    
    this.morphStartTime = -10000;
    this.morphDuration = 1000; // ms for randomization morph
    
    // Initial generation
    this.destNumbers = this.generateNumbers();
    this.numbers = this.cloneNumbers(this.destNumbers);
  }

  generateNumbers() {
    let nums = [];
    for (let i = 0; i <= 9; i++) {
      nums.push({
        val: i,
        x: random(-this.spread, this.spread),
        y: random(-this.spread, this.spread),
        size: random(this.displaySize * 0.3, this.displaySize * 1.0),
        rotation: random(TWO_PI),
        baseOpacity: random(15, 40),
        // Idle animation properties
        idle: {
            startTime: random(10000),
            duration: random(3200, 3200),
            type: random(['rotate', 'opacity', 'size']),
            amp: random(0.5, 1.0) * (random() > 0.5 ? 1 : -1)
        }
      });
    }
    return nums;
  }
  
  cloneNumbers(src) {
    return JSON.parse(JSON.stringify(src));
  }

  randomize() {
    this.sourceNumbers = this.cloneNumbers(this.numbers);
    this.destNumbers = this.generateNumbers();
    this.morphStartTime = millis();
  }

  update(val) {
    // If the digit changes, trigger a transition
    if (val !== this.currentDigit) {
      this.prevDigit = this.currentDigit;
      this.currentDigit = val;
      this.lastChangeTime = millis();
    }
  }

  draw() {
    let now = millis();
    
    // Handle Randomization Morph
    let morphElapsed = now - this.morphStartTime;
    if (morphElapsed < this.morphDuration) {
        let amt = morphElapsed / this.morphDuration;
        // Cubic ease out
        let smooth = 1 - pow(1 - amt, 3);
        
        for(let i=0; i<10; i++) {
            let src = this.sourceNumbers[i];
            let dst = this.destNumbers[i];
            let n = this.numbers[i];
            
            n.x = lerp(src.x, dst.x, smooth);
            n.y = lerp(src.y, dst.y, smooth);
            n.size = lerp(src.size, dst.size, smooth);
            n.baseOpacity = lerp(src.baseOpacity, dst.baseOpacity, smooth);
            
            // Rotation interpolation (shortest path)
            let diff = dst.rotation - src.rotation;
            if (diff > PI) diff -= TWO_PI;
            if (diff < -PI) diff += TWO_PI;
            n.rotation = src.rotation + diff * smooth;
        }
    } else if (this.destNumbers.length > 0 && morphElapsed < this.morphDuration + 100) {
        // Ensure we snap to exact destination after morph
        this.numbers = this.cloneNumbers(this.destNumbers);
        // Clear dest to prevent repeated cloning
        this.destNumbers = []; 
    }

    let elapsed = now - this.lastChangeTime;
    let amt = constrain(elapsed / this.transitionDuration, 0, 1);
    
    // Cubic easing for fluid movement
    let smoothAmt = amt < 0.5 ? 4 * amt * amt * amt : 1 - pow(-2 * amt + 2, 3) / 2;

    let currentNum = this.numbers[this.currentDigit];
    let prevNum = this.numbers[this.prevDigit];

    // Interpolate Camera View parameters
    // 1. Position
    let camX = lerp(prevNum.x, currentNum.x, smoothAmt);
    let camY = lerp(prevNum.y, currentNum.y, smoothAmt);
    
    // 2. Rotation (shortest path)
    let prevRot = prevNum.rotation;
    let currRot = currentNum.rotation;
    if (currRot - prevRot > PI) currRot -= TWO_PI;
    if (prevRot - currRot > PI) currRot += TWO_PI;
    let camRot = lerp(prevRot, currRot, smoothAmt);

    // 3. Zoom (scale world so number appears at target displaySize)
    let prevScale = this.displaySize / prevNum.size;
    let currScale = this.displaySize / currentNum.size;
    let camZoom = lerp(prevScale, currScale, smoothAmt);

    push();
    // Move to the wheel's position on screen
    translate(width / 2 + this.offsetX, height / 2 + this.offsetY);
    
    if (this.isHeartbeat) {
        // Heartbeat: once a second
        let t = (millis() % 1000) / 1000;
        let pulse = 1;
        // Sharp pulse in the first 200ms
        if (t < 0.2) {
            pulse = 1 - 0.02 * sin(t * PI / 0.2);
        }
        scale(pulse);
    }
    
    // Apply Camera Transforms
    scale(camZoom);
    rotate(-camRot);
    translate(-camX, -camY);
    
    // Draw connections and numbers
    for (let n of this.numbers) {
       // Calculate opacity
       // Transition from prevDigit (100%) to currentDigit (100%)
       // Others stay at baseOpacity
       
       let startOpacity = (n.val === this.prevDigit) ? 255 : n.baseOpacity;
       let endOpacity = (n.val === this.currentDigit) ? 255 : n.baseOpacity;
       let currentOpacity = lerp(startOpacity, endOpacity, smoothAmt);

       // Idle Animation Logic
       let idleRot = 0;
       let idleSizeMult = 1;
       let idleOpacityMult = 1;

       if (n.val !== this.currentDigit) {
           // Check if cycle ended
           if (now > n.idle.startTime + n.idle.duration) {
               n.idle.startTime = now;
               n.idle.duration = random(1800, 3200);
               n.idle.type = random(['rotate', 'opacity', 'size']);
               n.idle.amp = random(0.5, 1.0) * (random() > 0.5 ? 1 : -1);
           }
           
           let p = (now - n.idle.startTime) / n.idle.duration;
           let wave = sin(p * PI); // 0 -> 1 -> 0
           
           if (n.idle.type === 'rotate') {
               idleRot = radians(5) * n.idle.amp * wave; // Max 5 degrees
           } else if (n.idle.type === 'size') {
               idleSizeMult = 1 + (0.1 * n.idle.amp * wave); // Max 10% size change
           } else if (n.idle.type === 'opacity') {
               idleOpacityMult = 1 + (0.3 * n.idle.amp * wave); // Max 30% opacity change
           }
       }

       // Draw line to center (0,0 of this wheel's world)
       strokeWeight(n.size * idleSizeMult * 0.1);
       stroke(255, 15 * idleOpacityMult); // Faint white line
       line(0, 0, n.x, n.y);

       // Draw number
       push();
       translate(n.x, n.y);
       rotate(n.rotation + idleRot);
       noStroke();
       fill(255, currentOpacity * idleOpacityMult); // White text
       textSize(n.size * idleSizeMult);
       textAlign(CENTER, CENTER);
       text(n.val, 0, 0);
       pop();
    }
    pop();
  }
}
