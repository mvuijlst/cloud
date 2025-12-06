// Simple, fast multi-pendulum with path tracing
let pendulums = [];
let isSwinging = false;
let pathPoints = [];
const maxPathPoints = 800;

let goButton, stopButton, addButton, removeButton;

function setup() {
	createCanvas(windowWidth, windowHeight);
	
	// Single pendulum to start
	pendulums = [createPendulum(width / 2, 60, 200, null)];
	
	// Buttons
	goButton = createButton('Go!');
	styleButton(goButton, 20, 20, '#1f6de2');
	goButton.mousePressed(startSwing);
	
	stopButton = createButton('Stop');
	styleButton(stopButton, 110, 20, '#c24040');
	stopButton.mousePressed(stopSwing);
	
	addButton = createButton('+');
	styleButton(addButton, 200, 20, '#33a852');
	addButton.mousePressed(addPendulum);
	
	removeButton = createButton('-');
	styleButton(removeButton, 250, 20, '#d93025');
	removeButton.mousePressed(removePendulum);
}

function draw() {
	background(0);
	
	if (isSwinging) {
		updatePendulums();
		trackPath();
	}
	
	drawPath();
	drawPendulums();
	drawInfo();
}

function createPendulum(x, y, length, parent) {
	return {
		x: x,
		y: y,
		angle: 0,
		angleVel: 0,
		length: length,
		parent: parent
	};
}

function styleButton(btn, x, y, col) {
	btn.position(x, y);
	btn.style('background', col);
	btn.style('color', '#fff');
	btn.style('border', 'none');
	btn.style('padding', '8px 16px');
	btn.style('border-radius', '4px');
	btn.style('cursor', 'pointer');
	btn.style('font-family', 'monospace');
}

function updatePendulums() {
	const gravity = 1.0;
	const damping = 0.999;
	
	// Calculate angular accelerations based on physics
	for (let i = 0; i < pendulums.length; i++) {
		let p = pendulums[i];
		let angleAcc = 0;
		
		if (p.parent === null) {
			// Simple pendulum equation
			angleAcc = (-gravity / p.length) * sin(p.angle);
		} else {
			// Multi-pendulum physics (simplified)
			angleAcc = (-gravity / p.length) * sin(p.angle);
			
			// Coupling with parent
			let parentAcc = (-gravity / p.parent.length) * sin(p.parent.angle);
			angleAcc += parentAcc * 0.5 * cos(p.angle - p.parent.angle);
		}
		
		p.angleVel += angleAcc;
		p.angleVel *= damping;
		p.angle += p.angleVel;
	}
	
	updatePositions();
}

function updatePositions() {
	let currentX = width / 2;
	let currentY = 60;
	
	for (let p of pendulums) {
		p.x = currentX + p.length * sin(p.angle);
		p.y = currentY + p.length * cos(p.angle);
		
		currentX = p.x;
		currentY = p.y;
	}
}

function drawPendulums() {
	let currentX = width / 2;
	let currentY = 60;
	
	// Draw pivot
	fill('#f5c400');
	noStroke();
	ellipse(currentX, currentY, 20);
	
	for (let i = 0; i < pendulums.length; i++) {
		let p = pendulums[i];
		
		// Draw arm
		stroke('#4e6c8f');
		strokeWeight(3);
		line(currentX, currentY, p.x, p.y);
		
		// Draw joint
		fill('#f5c400');
		noStroke();
		ellipse(p.x, p.y, i === pendulums.length - 1 ? 16 : 20);
		
		currentX = p.x;
		currentY = p.y;
	}
}

function trackPath() {
	if (pendulums.length === 0) return;
	
	let lastP = pendulums[pendulums.length - 1];
	pathPoints.push({x: lastP.x, y: lastP.y});
	
	if (pathPoints.length > maxPathPoints) {
		pathPoints.shift();
	}
}

function drawPath() {
	if (pathPoints.length < 2) return;
	
	noFill();
	stroke('#6ce4ff');
	strokeWeight(2);
	beginShape();
	for (let pt of pathPoints) {
		vertex(pt.x, pt.y);
	}
	endShape();
}

function drawInfo() {
	fill(255);
	noStroke();
	textAlign(LEFT);
	textSize(14);
	textFont('monospace');
	text(`Pendulums: ${pendulums.length}`, 20, height - 20);
}

function startSwing() {
	isSwinging = true;
	pathPoints = [];
	
	// Set initial angles and give a push
	for (let i = 0; i < pendulums.length; i++) {
		pendulums[i].angle = random(-PI/4, PI/4);
		pendulums[i].angleVel = random(-0.05, 0.05);
	}
}

function stopSwing() {
	isSwinging = false;
	pathPoints = [];
	
	// Reset to rest
	for (let p of pendulums) {
		p.angle = 0;
		p.angleVel = 0;
	}
}

function addPendulum() {
	if (pendulums.length >= 5) return; // Max 5 for performance
	
	let parent = pendulums.length > 0 ? pendulums[pendulums.length - 1] : null;
	let length = 150 - pendulums.length * 20; // Shorter each time
	
	let newP = createPendulum(
		parent ? parent.x : width / 2,
		parent ? parent.y : 60,
		max(80, length),
		parent
	);
	
	pendulums.push(newP);
	isSwinging = false;
}

function removePendulum() {
	if (pendulums.length <= 1) return;
	pendulums.pop();
	isSwinging = false;
}

function windowResized() {
	resizeCanvas(windowWidth, windowHeight);
}
