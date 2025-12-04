let pivotPos;
let bobPos;
const pivotRadius = 15;
const hingeRadius = 15;
const bobRadius = 10;
const minSlice = 0.05; // fraction of the area removed
const maxSlice = 0.98;
const defaultSpanDeg = 75;
const defaultSlice = 1 - defaultSpanDeg / 360;
const minSwingDeg = 10;
const minSpanFraction = minSwingDeg / 360;
const dragSensitivity = 0.004;
const minRodLength = 80;

let arms = [];
let hingePositions = [];
let activeHingeIndex = -1;
let goButton;
let stopButton;
let addArmButton;
let removeArmButton;
let bobButtonsVisible = false;
let arrowVisible = false;
let isSwinging = false;
let swingStartTime = 0;
const swingPeriod = 2600; // milliseconds per full oscillation

function setup() {
	createCanvas(windowWidth, windowHeight);
	angleMode(RADIANS);
	pivotPos = createVector(width / 2, pivotRadius + 20);
	initArms();
	setupButtons();
}

function draw() {
	background(0);
	updateGeometry();
	const phase = ((millis() - swingStartTime) / swingPeriod) * TWO_PI;
	const armStates = computeArmStates(phase);
	drawArms(armStates);
	drawHinges();
	drawArrowIndicator();
	updateBobButtons();
	drawReadout();
}

function initArms() {
	arms = [
		{
			length: calcRodLength(),
			sliceFraction: defaultSlice,
		},
	];
	bobPos = null;
	hingePositions = [pivotPos.copy()];
	activeHingeIndex = -1;
	bobButtonsVisible = false;
	arrowVisible = false;
}

function setupButtons() {
	goButton = createButton('Go!');
	styleButton(goButton, '#1f6de2');
	goButton.mousePressed(startSwing);

	stopButton = createButton('Stop');
	styleButton(stopButton, '#c24040');
	stopButton.mousePressed(stopSwing);

	addArmButton = createButton('+');
	styleButton(addArmButton, '#33a852');
	addArmButton.size(36, 30);
	addArmButton.hide();
	addArmButton.mousePressed(() => {
		addChildArm();
	});

	removeArmButton = createButton('-');
	styleButton(removeArmButton, '#d93025');
	removeArmButton.size(36, 30);
	removeArmButton.hide();
	removeArmButton.mousePressed(() => {
		removeLastArm();
	});
}
function styleButton(btn, backgroundColor) {
	btn.size(70, 32);
	btn.style('border', 'none');
	btn.style('border-radius', '6px');
	btn.style('font-family', 'IBMPlexMono, monospace');
	btn.style('font-size', '14px');
	btn.style('color', '#ffffff');
	btn.style('background', backgroundColor);
	btn.style('cursor', 'pointer');
}

function computeArmStates(phase) {
	const states = [];
	hingePositions = [];
	let currentPos = pivotPos.copy();
	hingePositions.push(currentPos.copy());
	let absoluteAngle = 0;

	for (let i = 0; i < arms.length; i += 1) {
		const arm = arms[i];
		const remainingFraction = 1 - arm.sliceFraction;
		const swingDegrees = max(minSwingDeg, 360 * remainingFraction);
		const amplitude = radians(swingDegrees / 2);
		const relativeAngle = isSwinging ? amplitude * Math.sin(phase) : 0;
		absoluteAngle += relativeAngle;
		const bobX = currentPos.x + arm.length * Math.sin(absoluteAngle);
		const bobY = currentPos.y + arm.length * Math.cos(absoluteAngle);
		const bobVector = createVector(bobX, bobY);
		states.push({
			arm,
			hingePos: currentPos.copy(),
			bobPos: bobVector,
			swingDegrees,
		});
		currentPos = bobVector;
		hingePositions.push(currentPos.copy());
	}

	bobPos = hingePositions[hingePositions.length - 1] || null;
	return states;
}

function drawArms(states) {
	stroke('#4e6c8f');
	strokeWeight(4);
	strokeCap(ROUND);
	states.forEach((state, idx) => {
		line(state.hingePos.x, state.hingePos.y, state.bobPos.x, state.bobPos.y);
		if (idx === states.length - 1) {
			noStroke();
			fill('#f5c400');
			ellipse(state.bobPos.x, state.bobPos.y, bobRadius * 2);
		}
	});
}

function drawHinges() {
	for (let i = 0; i < arms.length; i += 1) {
		const pos = hingePositions[i];
		if (!pos) continue;
		drawHingeCircle(pos, arms[i].sliceFraction, activeHingeIndex === i);
	}
}

function drawArrowIndicator() {
	if (!arrowVisible || activeHingeIndex < 1) return;
	if (activeHingeIndex >= hingePositions.length) return;
	const pos = hingePositions[activeHingeIndex];
	if (!pos) return;
	push();
	translate(pos.x - hingeRadius - 18, pos.y);
	stroke('#ffd84d');
	strokeWeight(2);
	line(0, -12, 0, 12);
	line(-5, -7, 0, -12);
	line(5, -7, 0, -12);
	line(-5, 7, 0, 12);
	line(5, 7, 0, 12);
	pop();
}

function drawHingeCircle(position, sliceFraction, highlight) {
	push();
	translate(position.x, position.y);
	noStroke();
	fill(highlight ? '#ffd84d' : '#f5c400');
	ellipse(0, 0, hingeRadius * 2);
	fill(0);
	const sliceAngle = sliceFraction * TWO_PI;
	const halfSlice = sliceAngle / 2;
	arc(0, 0, hingeRadius * 2, hingeRadius * 2, -HALF_PI - halfSlice, -HALF_PI + halfSlice, PIE);
	pop();
}

function drawReadout() {
	if (!arms.length) return;
	const infoIndex = activeHingeIndex === -1 ? 0 : min(activeHingeIndex, arms.length - 1);
	const targetArm = arms[constrain(infoIndex, 0, arms.length - 1)];
	const remainingFraction = 1 - targetArm.sliceFraction;
	const swingDegrees = max(minSwingDeg, 360 * remainingFraction);

	noStroke();
	fill(255, 160);
	textFont('IBMPlexMono');
	textSize(14);
	textAlign(LEFT, TOP);
	const textLines = [
		`Arms: ${arms.length}`,
		`Span: ${swingDegrees.toFixed(0)}°`,
		activeHingeIndex === -1 ? 'Select a hinge' : 'Drag arrow: ↑ length, → span',
	];
	text(textLines.join('\n'), 24, 24);

	if (goButton) goButton.position(width - 200, 30);
	if (stopButton) stopButton.position(width - 110, 30);
}

function mousePressed() {
	const hingeIndex = findHingeIndex(mouseX, mouseY);
	if (hingeIndex !== -1) {
		selectHinge(hingeIndex);
		return;
	}

	activeHingeIndex = -1;
	arrowVisible = false;
	hideBobButtons();
}

function mouseDragged() {
	if (activeHingeIndex === -1) return;
	const dx = movedX || 0;
	const dy = movedY || 0;

	if (activeHingeIndex >= 1 && dy !== 0) {
		adjustArmLength(activeHingeIndex - 1, dy);
	}

	if (dx !== 0) {
		adjustSwingAmplitude(activeHingeIndex, dx);
	}
}

function mouseReleased() {}

function selectHinge(index) {
	activeHingeIndex = index;
	isSwinging = false;
	arrowVisible = index >= 1;
	if (index === arms.length) {
		showBobButtons();
	} else {
		hideBobButtons();
	}
}

function adjustArmLength(armIndex, deltaY) {
	if (armIndex < 0 || armIndex >= arms.length) return;
	const maxLen = getMaxLengthForArm(armIndex);
	const proposed = arms[armIndex].length + deltaY;
	arms[armIndex].length = constrain(proposed, minRodLength, maxLen);
	clampChildLengths(armIndex + 1);
}

function adjustSwingAmplitude(hingeIndex, deltaX) {
	if (!arms.length || hingeIndex < 0) return;
	const armIndex = constrain(hingeIndex, 0, arms.length - 1);
	const arm = arms[armIndex];
	const delta = deltaX * dragSensitivity;
	arm.sliceFraction = constrain(arm.sliceFraction + delta, minSlice, maxSliceAllowed());
}

function clampChildLengths(startIndex) {
	for (let i = startIndex; i < arms.length; i += 1) {
		const maxLen = getMaxLengthForArm(i);
		arms[i].length = constrain(arms[i].length, minRodLength, maxLen);
	}
}

function getMaxLengthForArm(index) {
	if (index === 0) return calcRodLength();
	return arms[index - 1].length;
}

function touchStarted() {
	mousePressed();
	return false;
}

function touchMoved() {
	mouseDragged();
	return false;
}

function touchEnded() {
	mouseReleased();
	return false;
}

function startSwing() {
	swingStartTime = millis();
	isSwinging = true;
	hideBobButtons();
	activeHingeIndex = -1;
	arrowVisible = false;
}

function stopSwing() {
	isSwinging = false;
	hideBobButtons();
}

function addChildArm() {
	if (!arms.length) return;
	const parent = arms[arms.length - 1];
	const newLength = max(minRodLength, parent.length / 2);
	arms.push({ length: newLength, sliceFraction: defaultSlice });
	isSwinging = false;
	hideBobButtons();
	activeHingeIndex = -1;
	arrowVisible = false;
}

function removeLastArm() {
	if (arms.length <= 1) return;
	arms.pop();
	isSwinging = false;
	const maxIndex = arms.length; // bob index
	if (activeHingeIndex > maxIndex) {
		activeHingeIndex = maxIndex;
	}
	arrowVisible = activeHingeIndex >= 1;
	if (activeHingeIndex === maxIndex) {
		showBobButtons();
	} else {
		hideBobButtons();
	}
}

function updateGeometry() {
	pivotPos.set(width / 2, hingeRadius + 20);
	const baseMax = calcRodLength();
	if (!arms.length) return;
	arms[0].length = constrain(arms[0].length, minRodLength, baseMax);
	for (let i = 1; i < arms.length; i += 1) {
		const prevLen = arms[i - 1].length;
		arms[i].length = constrain(arms[i].length, minRodLength, prevLen);
	}
}

function calcRodLength() {
	return max(minRodLength, min(height * 0.65, width * 0.45));
}

function maxSliceAllowed() {
	return min(maxSlice, 1 - minSpanFraction);
}

function findHingeIndex(x, y) {
	for (let i = 0; i < hingePositions.length; i += 1) {
		const pos = hingePositions[i];
		if (!pos) continue;
		const radius = i === arms.length ? bobRadius : hingeRadius;
		if (dist(x, y, pos.x, pos.y) <= radius) {
			return i;
		}
	}
	return -1;
}

function showBobButtons() {
	bobButtonsVisible = true;
}

function hideBobButtons() {
	bobButtonsVisible = false;
	if (addArmButton) addArmButton.hide();
	if (removeArmButton) removeArmButton.hide();
}

function updateBobButtons() {
	if (!bobButtonsVisible || !bobPos) {
		if (addArmButton) addArmButton.hide();
		if (removeArmButton) removeArmButton.hide();
		return;
	}
	if (addArmButton) {
		addArmButton.show();
		addArmButton.position(bobPos.x + 14, bobPos.y - 18);
	}
	if (removeArmButton) {
		if (arms.length > 1) {
			removeArmButton.show();
			removeArmButton.position(bobPos.x + 14, bobPos.y + 12);
		} else {
			removeArmButton.hide();
		}
	}
}

function windowResized() {
	resizeCanvas(windowWidth, windowHeight);
}