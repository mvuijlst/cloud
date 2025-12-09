const ZX_PALETTE = [
    [0, 0, 0],       // 0: Black
    [1, 0, 206],     // 1: Blue
    [207, 1, 0],     // 2: Red
    [207, 1, 206],   // 3: Magenta
    [0, 207, 21],    // 4: Green
    [1, 207, 207],   // 5: Cyan
    [207, 207, 21],  // 6: Yellow
    [207, 207, 207], // 7: White
];

const ZX_PALETTE_BRIGHT = [
    [0, 0, 0],       // 0: Black
    [2, 0, 253],     // 1: Blue
    [255, 2, 1],     // 2: Red
    [255, 2, 253],   // 3: Magenta
    [0, 255, 28],    // 4: Green
    [2, 255, 255],   // 5: Cyan
    [255, 255, 29],  // 6: Yellow
    [255, 255, 255], // 7: White
];

// Combined palette for dithering (excluding duplicate black)
const FULL_PALETTE = [
    ...ZX_PALETTE,
    ...ZX_PALETTE_BRIGHT.slice(1)
];

const canvas = document.getElementById('zx-canvas');
const ctx = canvas.getContext('2d');
const screenDiv = document.getElementById('screen');
const fileInput = document.getElementById('file-input');
const loadBtn = document.getElementById('load-btn');

let audioCtx;
let source;
let isLoadComplete = false;

// Dithering Helpers
const clampByte = (value) => Math.max(0, Math.min(255, value));

const findClosestColor = (color, palette) => {
    let closest = palette[0];
    let minDistance = Infinity;
    for (const candidate of palette) {
        const dr = color[0] - candidate[0];
        const dg = color[1] - candidate[1];
        const db = color[2] - candidate[2];
        const distance = dr * dr + dg * dg + db * db;
        if (distance < minDistance) {
            minDistance = distance;
            closest = candidate;
        }
    }
    return closest;
};

const distributeError = (data, width, x, y, errR, errG, errB, weight) => {
    if (x < 0 || x >= width || y < 0) return;
    const index = (y * width + x) * 4;
    if (index < 0 || index + 2 >= data.length) return;
    data[index] = clampByte(data[index] + errR * weight);
    data[index + 1] = clampByte(data[index + 1] + errG * weight);
    data[index + 2] = clampByte(data[index + 2] + errB * weight);
};

const getPixelValue = (data, width, x, y) => {
    if (x < 0 || y < 0 || x >= width) return 0;
    const index = (y * width + x) * 4;
    if (index + 2 >= data.length) return 0;
    return (data[index] + data[index + 1] + data[index + 2]) / 3;
};

function gradientBasedDithering(imageData, palette) {
    const { data, width, height } = imageData;
    // Copy data to avoid modifying original if needed, but here we want to modify
    // Actually, let's work on the data directly
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const oldColor = [data[i], data[i + 1], data[i + 2]];
            const newColor = findClosestColor(oldColor, palette);
            
            // We don't set the pixel to the new color yet if we want to keep error diffusion accurate?
            // Standard Floyd-Steinberg sets it.
            // The reference implementation sets it.
            data[i] = newColor[0];
            data[i + 1] = newColor[1];
            data[i + 2] = newColor[2];

            const errR = oldColor[0] - newColor[0];
            const errG = oldColor[1] - newColor[1];
            const errB = oldColor[2] - newColor[2];

            const gradientX = Math.abs(getPixelValue(data, width, x + 1, y) - getPixelValue(data, width, x - 1, y));
            const gradientY = Math.abs(getPixelValue(data, width, x, y + 1) - getPixelValue(data, width, x, y - 1));
            const gradient = Math.sqrt(gradientX * gradientX + gradientY * gradientY);
            const adaptiveFactor = Math.max(0.3, 1 - gradient / 255);

            distributeError(data, width, x + 1, y, errR, errG, errB, (7 / 16) * adaptiveFactor);
            distributeError(data, width, x - 1, y + 1, errR, errG, errB, (3 / 16) * adaptiveFactor);
            distributeError(data, width, x, y + 1, errR, errG, errB, (5 / 16) * adaptiveFactor);
            distributeError(data, width, x + 1, y + 1, errR, errG, errB, (1 / 16) * adaptiveFactor);
        }
    }
    return imageData;
}

// Helper to find closest ZX color index
function getClosestColorIndex(r, g, b) {
    let minDist = Infinity;
    let colorIdx = 0;
    let bright = false;

    // Check normal palette
    for (let i = 0; i < 8; i++) {
        const [pr, pg, pb] = ZX_PALETTE[i];
        const dist = Math.pow(r - pr, 2) + Math.pow(g - pg, 2) + Math.pow(b - pb, 2);
        if (dist < minDist) {
            minDist = dist;
            colorIdx = i;
            bright = false;
        }
    }

    // Check bright palette
    for (let i = 0; i < 8; i++) {
        const [pr, pg, pb] = ZX_PALETTE_BRIGHT[i];
        const dist = Math.pow(r - pr, 2) + Math.pow(g - pg, 2) + Math.pow(b - pb, 2);
        if (dist < minDist) {
            minDist = dist;
            colorIdx = i;
            bright = true;
        }
    }

    return { index: colorIdx, bright: bright };
}

function getBestBlockAttributes(pixels, startIndex, stride) {
    let minError = Infinity;
    let bestAttr = { ink: 0, paper: 0, bright: 0 };

    // Try Normal (Bright=0) and Bright (Bright=1)
    for (let bright = 0; bright < 2; bright++) {
        const palette = bright ? ZX_PALETTE_BRIGHT : ZX_PALETTE;
        
        // Iterate all unique pairs of colors (including solid colors where i==j)
        for (let i = 0; i < 8; i++) {
            for (let j = i; j < 8; j++) { 
                const c1 = palette[i];
                const c2 = palette[j];
                
                let currentError = 0;
                
                for (let y = 0; y < 8; y++) {
                    for (let x = 0; x < 8; x++) {
                        const pIdx = startIndex + (y * stride + x) * 4;
                        const r = pixels[pIdx];
                        const g = pixels[pIdx+1];
                        const b = pixels[pIdx+2];
                        
                        const d1 = (r-c1[0])**2 + (g-c1[1])**2 + (b-c1[2])**2;
                        const d2 = (r-c2[0])**2 + (g-c2[1])**2 + (b-c2[2])**2;
                        
                        currentError += Math.min(d1, d2);
                    }
                }
                
                if (currentError < minError) {
                    minError = currentError;
                    bestAttr = { ink: i, paper: j, bright: bright };
                }
            }
        }
    }
    return bestAttr;
}

function convertToSCR(img) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 256;
    tempCanvas.height = 192;
    const tCtx = tempCanvas.getContext('2d');
    
    // Resize with Black Bars (Letterbox/Pillarbox)
    const aspect = img.width / img.height;
    const targetAspect = 256 / 192;
    let dx, dy, dWidth, dHeight;

    // Fill with black first
    tCtx.fillStyle = '#000000';
    tCtx.fillRect(0, 0, 256, 192);
    
    if (aspect > targetAspect) {
        // Image is wider, fit width
        dWidth = 256;
        dHeight = 256 / aspect;
        dx = 0;
        dy = (192 - dHeight) / 2;
    } else {
        // Image is taller, fit height
        dHeight = 192;
        dWidth = 192 * aspect;
        dx = (256 - dWidth) / 2;
        dy = 0;
    }
    
    tCtx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dWidth, dHeight);
    
    let imageData = tCtx.getImageData(0, 0, 256, 192);
    const pixels = imageData.data;
    const width = 256;
    const height = 192;

    // 1. Calculate Attributes for all blocks (Pre-pass)
    const blockAttrs = new Uint8Array(24 * 32); 
    const blockColors = new Array(24 * 32); // Store [InkColor, PaperColor]
    
    for (let by = 0; by < 24; by++) {
        for (let bx = 0; bx < 32; bx++) {
            const startIndex = (by * 8 * 256 + bx * 8) * 4;
            const attr = getBestBlockAttributes(pixels, startIndex, 256);
            
            // Construct attribute byte
            // Flash(0) Bright(1) Paper(3) Ink(3)
            const attrByte = (0 << 7) | (attr.bright << 6) | (attr.paper << 3) | (attr.ink);
            blockAttrs[by * 32 + bx] = attrByte;
            
            const pal = attr.bright ? ZX_PALETTE_BRIGHT : ZX_PALETTE;
            // Store colors: [Ink, Paper]
            blockColors[by * 32 + bx] = [pal[attr.ink], pal[attr.paper]];
        }
    }
    
    // 2. Dither with constraints
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const oldColor = [pixels[i], pixels[i+1], pixels[i+2]];
            
            // Find allowed colors for this block
            const bx = Math.floor(x / 8);
            const by = Math.floor(y / 8);
            const allowed = blockColors[by * 32 + bx];
            
            // Find closest of the 2 allowed colors
            const newColor = findClosestColor(oldColor, allowed);
            
            pixels[i] = newColor[0];
            pixels[i+1] = newColor[1];
            pixels[i+2] = newColor[2];
            
            // Error Diffusion (Gradient Based)
            const errR = oldColor[0] - newColor[0];
            const errG = oldColor[1] - newColor[1];
            const errB = oldColor[2] - newColor[2];
            
            const gradientX = Math.abs(getPixelValue(pixels, width, x + 1, y) - getPixelValue(pixels, width, x - 1, y));
            const gradientY = Math.abs(getPixelValue(pixels, width, x, y + 1) - getPixelValue(pixels, width, x, y - 1));
            const gradient = Math.sqrt(gradientX * gradientX + gradientY * gradientY);
            const adaptiveFactor = Math.max(0.3, 1 - gradient / 255);

            distributeError(pixels, width, x + 1, y, errR, errG, errB, (7 / 16) * adaptiveFactor);
            distributeError(pixels, width, x - 1, y + 1, errR, errG, errB, (3 / 16) * adaptiveFactor);
            distributeError(pixels, width, x, y + 1, errR, errG, errB, (5 / 16) * adaptiveFactor);
            distributeError(pixels, width, x + 1, y + 1, errR, errG, errB, (1 / 16) * adaptiveFactor);
        }
    }
    
    // 3. Generate SCR Data
    const scrData = new Uint8Array(6912);
    const bitmap = scrData.subarray(0, 6144);
    const attributes = scrData.subarray(6144);

    // Copy attributes
    attributes.set(blockAttrs);

    // Generate bitmap
    for (let by = 0; by < 24; by++) {
        for (let bx = 0; bx < 32; bx++) {
            const allowed = blockColors[by * 32 + bx];
            const inkColor = allowed[0];
            // const paperColor = allowed[1];

            for (let y = 0; y < 8; y++) {
                let byte = 0;
                for (let x = 0; x < 8; x++) {
                    const px = (bx * 8 + x);
                    const py = (by * 8 + y);
                    const i = (py * 256 + px) * 4;
                    
                    // Check if pixel matches Ink color
                    // Since we dithered to exactly these 2 colors, exact match check is safe-ish
                    // But floating point error diffusion might cause slight drift?
                    // No, we set pixels[i] = newColor (which is from allowed array).
                    // But distributeError clamps bytes.
                    // So it might drift by 1 value. Best to check distance again.
                    
                    const r = pixels[i];
                    const g = pixels[i+1];
                    const b = pixels[i+2];
                    
                    const dInk = (r-inkColor[0])**2 + (g-inkColor[1])**2 + (b-inkColor[2])**2;
                    // const dPaper = (r-paperColor[0])**2 + (g-paperColor[1])**2 + (b-paperColor[2])**2;
                    
                    // If closer to Ink (or equal), set bit.
                    // Actually we only have 2 choices.
                    // If we dithered correctly, it should be very close to one of them.
                    // Let's just check if it's the Ink color.
                    
                    if (dInk < 10) { // Tolerance
                        byte |= (1 << (7 - x));
                    }
                }

                // Calculate memory address
                const screenY = by * 8 + y;
                let third, row, line;
                if (screenY < 64) { third = 0; line = screenY % 8; row = Math.floor(screenY / 8); }
                else if (screenY < 128) { third = 1; line = (screenY - 64) % 8; row = Math.floor((screenY - 64) / 8); }
                else { third = 2; line = (screenY - 128) % 8; row = Math.floor((screenY - 128) / 8); }
                
                const addr = (third << 11) | (line << 8) | (row << 5) | bx;
                bitmap[addr] = byte;
            }
        }
    }
    
    return scrData;
}

// Audio Generation
function generateTapeAudio(data, ctx) {
    const sampleRate = ctx.sampleRate;
    const tStateDuration = 1 / 3500000;
    const samplesPerT = sampleRate * tStateDuration;
    
    const pilotPulses = 8064; // Header pilot length
    const pilotLen = 2168;
    const sync1Len = 667;
    const sync2Len = 735;
    const bit0Len = 855;
    const bit1Len = 1710;

    // Calculate exact buffer size
    let totalSamples = 0;
    
    // Pilot
    const pilotSamples = Math.round(pilotLen * samplesPerT) * pilotPulses;
    totalSamples += pilotSamples;
    
    // Sync
    const syncSamples = Math.round(sync1Len * samplesPerT) + Math.round(sync2Len * samplesPerT);
    totalSamples += syncSamples;
    
    // Data
    let dataSamples = 0;
    for (let i = 0; i < data.length; i++) {
        const byte = data[i];
        for (let b = 7; b >= 0; b--) {
            const bit = (byte >> b) & 1;
            const len = bit ? bit1Len : bit0Len;
            dataSamples += Math.round(len * samplesPerT) * 2;
        }
    }
    totalSamples += dataSamples;
    
    // Tail
    const tailSamples = sampleRate; // 1 sec tail
    totalSamples += tailSamples;

    const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
    const channelData = buffer.getChannelData(0);
    
    let offset = 0;
    let currentLevel = 0.5; 
    const high = 0.5; // Amplitude 0.5
    const low = -0.5;
    
    function addPulse(tStates) {
        const numSamples = Math.round(tStates * samplesPerT);
        const val = currentLevel > 0 ? high : low;
        for (let i = 0; i < numSamples; i++) {
            if (offset < totalSamples) channelData[offset++] = val;
        }
        currentLevel = -currentLevel; // Toggle
    }

    // Pilot
    for (let i = 0; i < pilotPulses; i++) {
        addPulse(pilotLen);
    }
    
    // Sync
    addPulse(sync1Len);
    addPulse(sync2Len);
    
    // Data
    for (let i = 0; i < data.length; i++) {
        const byte = data[i];
        for (let b = 7; b >= 0; b--) {
            const bit = (byte >> b) & 1;
            const len = bit ? bit1Len : bit0Len;
            addPulse(len);
            addPulse(len);
        }
    }
    
    return {
        buffer: buffer,
        pilotDuration: pilotSamples / sampleRate,
        syncDuration: syncSamples / sampleRate,
        dataDuration: dataSamples / sampleRate
    };
}

// Main Load Function
loadBtn.addEventListener('click', async () => {
    if (!fileInput.files[0]) {
        alert('Please select an image first.');
        return;
    }
    
    // Init Audio
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
    
    const img = new Image();
    img.src = URL.createObjectURL(fileInput.files[0]);
    img.onload = () => {
        const scrData = convertToSCR(img);
        const audioData = generateTapeAudio(scrData, audioCtx);
        const audioBuffer = audioData.buffer;
        
        source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.start();
        
        const startTime = audioCtx.currentTime;
        const totalDuration = audioBuffer.duration;
        const totalBytes = 6912;
        
        // Use exact durations from audio generation
        const pilotDuration = audioData.pilotDuration;
        const syncDuration = audioData.syncDuration;
        const dataDuration = audioData.dataDuration;
        
        // Persistent ImageData for performance
        const imageData = ctx.createImageData(256, 192);
        const data = imageData.data;
        // Initialize with black/white or default
        for(let i=0; i<data.length; i+=4) {
            data[i] = 0; data[i+1] = 0; data[i+2] = 0; data[i+3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);

        let lastLoaded = 0;

        function updateBorder(type, time) {
            // type 0: Pilot (Red/Cyan), type 1: Data (Blue/Yellow)
            const c1 = type === 0 ? '#D70000' : '#0000D7';
            const c2 = type === 0 ? '#00D7D7' : '#D7D700';
            
            // Stripe width
            // Pilot: ~16 stripes per screen (480px). ~30px cycle.
            // Data: ~32 stripes per screen. ~15px cycle.
            const cycle = type === 0 ? 30 : 15;
            const half = cycle / 2;
            
            // Animate phase
            // Speed: Pilot ~50Hz frame rate, but bars roll.
            // Let's just scroll it fast.
            const offset = Math.floor(time * 500) % cycle;
            
            screenDiv.style.backgroundImage = `repeating-linear-gradient(to bottom, 
                ${c1} 0px, ${c1} ${half}px, 
                ${c2} ${half}px, ${c2} ${cycle}px)`;
            screenDiv.style.backgroundPositionY = `${offset}px`;
        }

        // Animation Loop
        function animate() {
            const now = audioCtx.currentTime - startTime;
            
            if (now > totalDuration) {
                // Ensure final state is rendered
                updateScreenBuffer(totalBytes, scrData, data, lastLoaded);
                ctx.putImageData(imageData, 0, 0);
                screenDiv.style.backgroundImage = 'none';
                screenDiv.style.backgroundColor = '#ccc'; // Reset border
                return;
            }
            
            // Border Effect
            if (now < pilotDuration) {
                updateBorder(0, now);
            } else {
                updateBorder(1, now);
            }
            
            // Data Loading Progress
            let loaded = 0;
            if (now > pilotDuration) {
                // Include sync time in the "data" phase for visual simplicity, 
                // or subtract it if we want to be precise.
                // The data loading starts after pilot + sync.
                const dataTime = now - pilotDuration - syncDuration;
                
                if (dataTime > 0) {
                    loaded = Math.floor((dataTime / dataDuration) * totalBytes);
                    if (loaded > totalBytes) loaded = totalBytes;
                }
            }
            
            if (loaded > lastLoaded) {
                updateScreenBuffer(loaded, scrData, data, lastLoaded);
                ctx.putImageData(imageData, 0, 0);
                lastLoaded = loaded;
            }
            
            requestAnimationFrame(animate);
        }
        
        animate();
    };
});

function updateScreenBuffer(loaded, scrData, data, lastLoaded) {
    // Only update pixels corresponding to bytes between lastLoaded and loaded
    for (let i = lastLoaded; i < loaded; i++) {
        if (i >= 6912) break;

        // If in bitmap area
        if (i < 6144) {
            const byte = scrData[i];
            // We need to find which 8 pixels this byte corresponds to.
            // Inverse of the address mapping.
            // Address = (Third << 11) | (Line << 8) | (Row << 5) | Column
            // i = TLLLRRRCCCCC
            const third = (i >> 11) & 0x03;
            const line = (i >> 8) & 0x07;
            const row = (i >> 5) & 0x07;
            const col = i & 0x1F;
            
            const bx = col;
            const yInThird = row * 8 + line;
            const by = Math.floor((third * 64 + yInThird) / 8); // Block Y
            const y = (third * 64 + yInThird) % 8; // Line within block
            
            // We need the attribute for this block to know the color.
            // But attributes might not be loaded yet!
            // If not loaded, use default (Black/White or Black/Black).
            // Standard behavior: Bitmap appears as black/white (or whatever default attr is)
            // until attributes are loaded.
            // Let's check if attribute for this block is loaded.
            const attrAddr = 6144 + by * 32 + bx;
            let attr = 0x38; // Default Black Ink, White Paper
            
            if (loaded > attrAddr) {
                attr = scrData[attrAddr];
            }
            
            const ink = attr & 0x07;
            const paper = (attr >> 3) & 0x07;
            const bright = (attr >> 6) & 0x01;
            
            const inkColor = bright ? ZX_PALETTE_BRIGHT[ink] : ZX_PALETTE[ink];
            const paperColor = bright ? ZX_PALETTE_BRIGHT[paper] : ZX_PALETTE[paper];
            
            for (let x = 0; x < 8; x++) {
                const bit = (byte >> (7 - x)) & 1;
                const color = bit ? inkColor : paperColor;
                
                const px = bx * 8 + x;
                const py = third * 64 + row * 8 + line;
                const idx = (py * 256 + px) * 4;
                
                data[idx] = color[0];
                data[idx+1] = color[1];
                data[idx+2] = color[2];
                data[idx+3] = 255;
            }
        } 
        // If in attribute area
        else {
            const attr = scrData[i];
            const offset = i - 6144;
            const by = Math.floor(offset / 32);
            const bx = offset % 32;
            
            const ink = attr & 0x07;
            const paper = (attr >> 3) & 0x07;
            const bright = (attr >> 6) & 0x01;
            
            const inkColor = bright ? ZX_PALETTE_BRIGHT[ink] : ZX_PALETTE[ink];
            const paperColor = bright ? ZX_PALETTE_BRIGHT[paper] : ZX_PALETTE[paper];
            
            // Re-render the whole 8x8 block with new colors
            // We need to fetch the bitmap data for this block.
            for (let y = 0; y < 8; y++) {
                // Calculate bitmap address
                const screenY = by * 8 + y;
                let third, row, line;
                if (screenY < 64) { third = 0; line = screenY % 8; row = Math.floor(screenY / 8); }
                else if (screenY < 128) { third = 1; line = (screenY - 64) % 8; row = Math.floor((screenY - 64) / 8); }
                else { third = 2; line = (screenY - 128) % 8; row = Math.floor((screenY - 128) / 8); }
                
                const bitmapAddr = (third << 11) | (line << 8) | (row << 5) | bx;
                
                let byte = 0;
                // Bitmap should be loaded by now if we are in attribute section
                if (loaded > bitmapAddr) {
                    byte = scrData[bitmapAddr];
                }
                
                for (let x = 0; x < 8; x++) {
                    const bit = (byte >> (7 - x)) & 1;
                    const color = bit ? inkColor : paperColor;
                    
                    const px = bx * 8 + x;
                    const py = screenY;
                    const idx = (py * 256 + px) * 4;
                    
                    data[idx] = color[0];
                    data[idx+1] = color[1];
                    data[idx+2] = color[2];
                    data[idx+3] = 255;
                }
            }
        }
    }
}
