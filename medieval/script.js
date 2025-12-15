// Support Values (SV) from the README
const supportValues = [
    { name: "Shoemakers", sv: 150 },
    { name: "Furriers", sv: 250 },
    { name: "Maidservants", sv: 250 },
    { name: "Tailors", sv: 250 },
    { name: "Barbers", sv: 350 },
    { name: "Jewelers", sv: 400 },
    { name: "Taverns/Restaurants", sv: 400 },
    { name: "Old-Clothes", sv: 400 },
    { name: "Pastrycooks", sv: 500 },
    { name: "Masons", sv: 500 },
    { name: "Carpenters", sv: 550 },
    { name: "Weavers", sv: 600 },
    { name: "Chandlers", sv: 700 },
    { name: "Mercers", sv: 700 },
    { name: "Coopers", sv: 700 },
    { name: "Bakers", sv: 800 },
    { name: "Watercarriers", sv: 850 },
    { name: "Scabbardmakers", sv: 850 },
    { name: "Wine-Sellers", sv: 900 },
    { name: "Hatmakers", sv: 950 },
    { name: "Saddlers", sv: 1000 },
    { name: "Chicken Butchers", sv: 1000 },
    { name: "Pursemakers", sv: 1100 },
    { name: "Butchers", sv: 1200 },
    { name: "Fishmongers", sv: 1200 },
    { name: "Beer-Sellers", sv: 1400 },
    { name: "Buckle Makers", sv: 1400 },
    { name: "Plasterers", sv: 1400 },
    { name: "Spice Merchants", sv: 1400 },
    { name: "Blacksmiths", sv: 1500 },
    { name: "Painters", sv: 1500 },
    { name: "Doctors", sv: 1700 },
    { name: "Roofers", sv: 1800 },
    { name: "Locksmiths", sv: 1900 },
    { name: "Bathers", sv: 1900 },
    { name: "Ropemakers", sv: 1900 },
    { name: "Inns", sv: 2000 },
    { name: "Tanners", sv: 2000 },
    { name: "Copyists", sv: 2000 },
    { name: "Sculptors", sv: 2000 },
    { name: "Rugmakers", sv: 2000 },
    { name: "Harness-Makers", sv: 2000 },
    { name: "Bleachers", sv: 2100 },
    { name: "Hay Merchants", sv: 2300 },
    { name: "Cutlers", sv: 2300 },
    { name: "Glovemakers", sv: 2400 },
    { name: "Woodsellers", sv: 2400 },
    { name: "Woodcarvers", sv: 2400 },
    { name: "Magic-Shops", sv: 2800 },
    { name: "Bookbinders", sv: 3000 },
    { name: "Booksellers", sv: 6300 },
    { name: "Illuminators", sv: 3900 },
    // Special cases mentioned in text
    { name: "Noble Households", sv: 200 },
    { name: "Advocates (Lawyers)", sv: 650 },
    { name: "Clergy", sv: 40 },
    { name: "Priests", sv: 1000 } // Calculated: 1 per 25-30 clergy (approx 40 * 25 = 1000)
];

// Utility functions
function roll(dice, sides) {
    let total = 0;
    for (let i = 0; i < dice; i++) {
        total += Math.floor(Math.random() * sides) + 1;
    }
    return total;
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// DOM Elements
const generateBtn = document.getElementById('generateBtn');
const densityMode = document.getElementById('densityMode');
const customDensityInput = document.getElementById('customDensity');
const resultsArea = document.getElementById('resultsArea');
const areaInput = document.getElementById('area');
const areaPreset = document.getElementById('areaPreset');

// Event Listeners
areaPreset.addEventListener('change', () => {
    if (areaPreset.value) {
        areaInput.value = areaPreset.value;
    }
});

densityMode.addEventListener('change', () => {
    if (densityMode.value === 'custom') {
        customDensityInput.classList.remove('hidden');
    } else {
        customDensityInput.classList.add('hidden');
    }
});

generateBtn.addEventListener('click', generateKingdom);

function generateKingdom() {
    const name = document.getElementById('kingdomName').value || "Unnamed Kingdom";
    const area = parseInt(document.getElementById('area').value) || 230000;
    const age = document.getElementById('age').value;
    
    let density;
    if (densityMode.value === 'custom') {
        density = parseInt(customDensityInput.value) || 29;
    } else {
        // Roll 6d4 * 2 (approx conversion from * 5 miles)
        let multiplier = 2;
        if (age === 'wilderness') multiplier = 1; // Lower for wilderness
        if (age === 'ancient') multiplier = 3; // Higher for ancient
        
        density = roll(6, 4) * multiplier;
    }

    const totalPopulation = area * density;
    
    // Generate Cities
    // Largest city: P * M, where P = sqrt(pop), M = 2d4+10
    const P = Math.sqrt(totalPopulation);
    const M = roll(2, 4) + 10;
    const largestCityPop = Math.floor(P * M);

    const cities = [];
    cities.push({ name: "City 1 (Capital)", pop: largestCityPop, type: "Big City" });

    // Second city: 20-80% of largest
    let currentCityPop = Math.floor(largestCityPop * ((roll(2, 4) * 10) / 100));
    let cityCount = 2;
    
    while (currentCityPop >= 8000) {
        cities.push({ name: `City ${cityCount}`, pop: currentCityPop, type: "City" });
        
        // Next city: 10-40% smaller (so 60-90% of current)
        const reduction = (roll(2, 4) * 5) / 100; // 0.10 to 0.40
        currentCityPop = Math.floor(currentCityPop * (1 - reduction));
        cityCount++;
    }

    // Generate Towns
    // Number of towns = number of cities * 2d8
    const numTowns = cities.length * roll(2, 8);
    const towns = [];
    
    // Town populations range from 1000-8000. 
    // We can distribute them somewhat randomly or follow a curve. 
    // The text implies they are just "smaller settlements".
    // Let's generate random town sizes between 1000 and 8000.
    for (let i = 0; i < numTowns; i++) {
        // Bias towards smaller towns? Text says typical is 2500.
        // Let's use a weighted random or just simple range for now.
        // A simple bell curve around 2500 might be good.
        // 1d8 * 1000 gives 1000-8000, avg 4500 (too high).
        // Let's try (1d4 + 1d4) * 1000 -> 2000-8000, avg 5000.
        // Let's try to hit the 2500 avg.
        // 1d4 * 500 + 500 -> 1000-2500.
        // Let's just pick random between 1000 and 8000, but weighted lower.
        let townPop = Math.floor(Math.random() * 7000) + 1000;
        // Adjust to favor ~2500
        if (Math.random() > 0.5) townPop = Math.floor(Math.random() * 3000) + 1000;
        
        towns.push({ name: `Town ${i + 1}`, pop: townPop, type: "Town" });
    }

    // Sort settlements by population
    const allSettlements = [...cities, ...towns].sort((a, b) => b.pop - a.pop);

    // Calculate stats
    const urbanPop = allSettlements.reduce((sum, s) => sum + s.pop, 0);
    const ruralPop = totalPopulation - urbanPop;
    const urbanPercent = ((urbanPop / totalPopulation) * 100).toFixed(1);
    
    // Agriculture stats
    // 1 sq mile supports 180 people -> 1 sq km supports ~69.5 people
    const arableLandNeeded = totalPopulation / 69.5;
    const arablePercent = ((arableLandNeeded / area) * 100).toFixed(1);
    const wilderness = area - arableLandNeeded;

    // Display Results
    document.getElementById('resultName').textContent = name;
    document.getElementById('totalPop').textContent = formatNumber(totalPopulation);
    document.getElementById('resDensity').textContent = density;
    document.getElementById('resArea').textContent = formatNumber(area);
    document.getElementById('arableLand').textContent = formatNumber(Math.floor(arableLandNeeded));
    document.getElementById('arablePercent').textContent = arablePercent;
    document.getElementById('wilderness').textContent = formatNumber(Math.floor(wilderness));
    document.getElementById('urbanPop').textContent = formatNumber(urbanPop);
    document.getElementById('urbanPercent').textContent = urbanPercent;
    document.getElementById('ruralPop').textContent = formatNumber(ruralPop);

    renderSettlements(allSettlements);
    
    // Generate Map
    generateMap(allSettlements, parseFloat(arablePercent), area);

    resultsArea.style.display = 'block';
}

// Map Logic
const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const hexRadius = 6; // Smaller hexes for more detail
const hexHeight = hexRadius * 2;
const hexWidth = Math.sqrt(3) * hexRadius;
const vertDist = hexHeight * 0.75;
const horizDist = hexWidth;
let currentGrid = []; // Store grid for click detection

// Add click handler
canvas.addEventListener('click', handleMapClick);

function handleMapClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Find clicked hex
    // Simple distance check is fast enough for < 5000 hexes
    let clickedHex = null;
    let minDist = hexRadius;

    for (const hex of currentGrid) {
        const dx = hex.x - x;
        const dy = hex.y - y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < minDist) {
            minDist = dist;
            clickedHex = hex;
        }
    }

    if (clickedHex && clickedHex.settlement) {
        selectSettlement(clickedHex.settlement);
    }
}

function selectSettlement(settlement) {
    // Update UI
    showBusinesses(settlement);
    
    // Highlight list item
    document.querySelectorAll('.settlement-item').forEach(el => {
        el.classList.remove('selected');
        if (el.dataset.name === settlement.name) {
            el.classList.add('selected');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    // Redraw map to show selection (optional, but nice)
    drawMap(currentGrid, settlement);
}

// Simple Value Noise Implementation
class SimpleNoise {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.grid = [];
        for(let i=0; i<width*height; i++) {
            this.grid.push(Math.random());
        }
    }

    get(x, y) {
        // Bilinear interpolation
        const x0 = Math.floor(x);
        const x1 = (x0 + 1) % this.width;
        const y0 = Math.floor(y);
        const y1 = (y0 + 1) % this.height;

        const sx = x - x0;
        const sy = y - y0;

        const n0 = this.dotGridGradient(x0, y0, x, y);
        const n1 = this.dotGridGradient(x1, y0, x, y);
        const ix0 = this.lerp(n0, n1, sx);

        const n2 = this.dotGridGradient(x0, y1, x, y);
        const n3 = this.dotGridGradient(x1, y1, x, y);
        const ix1 = this.lerp(n2, n3, sx);

        return this.lerp(ix0, ix1, sy);
    }
    
    // Simplified value noise (not gradient noise, just interpolation)
    getValue(x, y) {
        const x0 = Math.floor(x);
        const x1 = (x0 + 1) % this.width;
        const y0 = Math.floor(y);
        const y1 = (y0 + 1) % this.height;

        const sx = x - x0;
        const sy = y - y0;

        const v00 = this.grid[y0 * this.width + x0];
        const v10 = this.grid[y0 * this.width + x1];
        const v01 = this.grid[y1 * this.width + x0];
        const v11 = this.grid[y1 * this.width + x1];

        const ix0 = this.lerp(v00, v10, sx);
        const ix1 = this.lerp(v01, v11, sx);

        return this.lerp(ix0, ix1, sy);
    }

    lerp(a, b, t) {
        return a + t * (b - a);
    }
}

function generateMap(settlements, arablePercent, totalArea) {
    // Calculate grid size
    const cols = Math.floor(canvas.width / horizDist) - 1;
    const rows = Math.floor(canvas.height / vertDist) - 1;
    
    // Initialize Grid
    const grid = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            grid.push({
                r, c,
                x: c * horizDist + (r % 2) * (horizDist / 2) + horizDist/2 + 10,
                y: r * vertDist + vertDist/2 + 10,
                terrain: 'water',
                settlement: null
            });
        }
    }

    // Generate Land Shape using Noise
    // We want a few large landmasses or one interesting one.
    // Use low frequency noise for shape.
    const noiseW = 10;
    const noiseH = 10;
    const noise = new SimpleNoise(noiseW, noiseH);
    const detailNoise = new SimpleNoise(20, 20);

    // Center bias to avoid land touching edges too much
    const centerX = cols / 2;
    const centerY = rows / 2;
    const maxDist = Math.sqrt(centerX*centerX + centerY*centerY);

    let landHexes = [];

    grid.forEach(hex => {
        // Normalize coords
        const nx = hex.c / cols;
        const ny = hex.r / rows;

        // Noise value
        let n = noise.getValue(nx * noiseW, ny * noiseH);
        let dn = detailNoise.getValue(nx * 20, ny * 20);
        
        // Combine noise
        let val = n * 0.8 + dn * 0.2;

        // Apply radial mask (distance from center)
        const dx = hex.c - centerX;
        const dy = hex.r - centerY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const mask = 1 - Math.pow(dist / (maxDist * 0.8), 2); // Quadratic falloff
        
        val = val * mask;

        // Threshold
        if (val > 0.35) {
            hex.terrain = 'wilderness';
            landHexes.push(hex);
        }
    });

    // Ensure we have enough land, if not, lower threshold or just accept it
    // (Noise is random, but usually safe with these params)

    const totalHexes = grid.length;
    const landCount = landHexes.length;
    const areaPerHex = totalArea / Math.max(1, landCount);
    
    document.getElementById('hexInfo').textContent = `Map Grid: ${cols}x${rows}. Land Area: ~${formatNumber(landCount)} hexes. 1 Hex ≈ ${formatNumber(Math.floor(areaPerHex))} sq. km`;

    // Arable Land Generation (Noise based for patches)
    const arableNoise = new SimpleNoise(15, 15);
    const targetArableCount = Math.floor(landCount * (arablePercent / 100));
    
    // Assign arable scores
    landHexes.forEach(hex => {
        const nx = hex.c / cols;
        const ny = hex.r / rows;
        hex.arableScore = arableNoise.getValue(nx * 15, ny * 15);
    });

    // Sort by score and pick top N
    landHexes.sort((a, b) => b.arableScore - a.arableScore);
    for(let i=0; i<targetArableCount; i++) {
        if(landHexes[i]) landHexes[i].terrain = 'arable';
    }

    // Place Settlements (Only on Land)
    const placedSettlements = [];
    // Shuffle land hexes for random placement
    const availableLand = [...landHexes].sort(() => Math.random() - 0.5);

    settlements.forEach(settlement => {
        let hex;
        let placeAttempts = 0;
        
        // Try to find a good spot
        for(let i=0; i<availableLand.length; i++) {
            const candidate = availableLand[i];
            if(candidate.settlement) continue;

            const isCity = settlement.type.includes("City");
            const prefArable = isCity ? 0.95 : 0.90;
            
            // Preference check
            if(candidate.terrain === 'wilderness' && Math.random() < prefArable) continue;

            // Distance check
            if(isCity) {
                const tooClose = placedSettlements.some(p => {
                    if(p.type.includes("City")) {
                        const dist = getDist(candidate, p.hex);
                        return dist < 8; 
                    }
                    return false;
                });
                if(tooClose) continue;
            }

            hex = candidate;
            break;
        }
        
        if(hex) {
            hex.settlement = settlement;
            placedSettlements.push({hex, type: settlement.type});
        }
    });

    currentGrid = grid;
    drawMap(grid);
}

function getNeighbors(hex, grid, cols, rows) {
    // Simple distance based neighbor check for the grid generation
    // Hexes are neighbors if distance is approx 1 hex width
    // Optimization: Calculate indices based on odd-r offset
    const neighbors = [];
    
    // Odd-r offset directions
    const evenDirs = [[1,0], [0,-1], [-1,-1], [-1,0], [-1,1], [0,1]];
    const oddDirs = [[1,0], [1,-1], [0,-1], [-1,0], [0,1], [1,1]];
    
    const useDirs = hex.r % 2 === 0 ? evenDirs : oddDirs;
    
    for(let d of useDirs) {
        const nc = hex.c + d[0];
        const nr = hex.r + d[1];
        if(nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
            const idx = nr * cols + nc;
            if(grid[idx]) neighbors.push(grid[idx]);
        }
    }
    return neighbors;
}

function getDist(h1, h2) {
    const dx = h1.x - h2.x;
    const dy = h1.y - h2.y;
    return Math.sqrt(dx*dx + dy*dy) / horizDist;
}

function drawMap(grid, selectedSettlement = null) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Water Background
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0,0, canvas.width, canvas.height);

    // Draw Hexes
    grid.forEach(hex => {
        if (hex.terrain !== 'water') {
            drawHex(hex.x, hex.y, hexRadius, hex.terrain === 'arable' ? '#90EE90' : '#228B22');
        }
    });

    // Draw Settlements
    grid.forEach(hex => {
        if(hex.settlement) {
            const isSelected = selectedSettlement && selectedSettlement.name === hex.settlement.name;
            
            if(hex.settlement.type.includes("City")) {
                // City
                ctx.fillStyle = isSelected ? '#ff0000' : '#d32f2f';
                ctx.beginPath();
                ctx.arc(hex.x, hex.y, hexRadius * 0.8, 0, Math.PI*2);
                ctx.fill();
                ctx.strokeStyle = isSelected ? '#ffff00' : 'white';
                ctx.lineWidth = isSelected ? 3 : 1;
                ctx.stroke();
            } else {
                // Town
                ctx.fillStyle = isSelected ? '#000000' : '#333';
                ctx.beginPath();
                ctx.arc(hex.x, hex.y, hexRadius * 0.5, 0, Math.PI*2);
                ctx.fill();
                if (isSelected) {
                    ctx.strokeStyle = '#ffff00';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }
        }
    });
}

function drawHex(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = 2 * Math.PI / 6 * (i + 0.5); // Rotate 30 deg for pointy top
        const x_i = x + r * Math.cos(angle);
        const y_i = y + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x_i, y_i);
        else ctx.lineTo(x_i, y_i);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function renderSettlements(settlements) {
    const list = document.getElementById('settlementList');
    list.innerHTML = '';
    
    settlements.forEach((s, index) => {
        const div = document.createElement('div');
        div.className = 'settlement-item';
        div.dataset.name = s.name; // For selection lookup
        div.innerHTML = `<strong>${s.name}</strong> (${s.type}) - Pop: ${formatNumber(s.pop)}`;
        div.onclick = () => {
            selectSettlement(s);
        };
        list.appendChild(div);
    });

    // Select first one by default
    if (settlements.length > 0) {
        selectSettlement(settlements[0]);
    }
}

function showBusinesses(settlement) {
    document.getElementById('selectedSettlementName').textContent = settlement.name;
    const list = document.getElementById('businessList');
    list.innerHTML = '';

    supportValues.forEach(biz => {
        let count = Math.floor(settlement.pop / biz.sv);
        
        // If count is 0, check for probability
        if (count === 0) {
            const chance = (settlement.pop / biz.sv);
            if (Math.random() < chance) {
                count = 1;
            }
        }

        if (count > 0) {
            const div = document.createElement('div');
            div.className = 'business-item';
            div.innerHTML = `<strong>${biz.name}:</strong> ${count}`;
            list.appendChild(div);
        }
    });
    
    // Add a note if no businesses found (e.g. very small village)
    if (list.children.length === 0) {
        list.innerHTML = '<div class="business-item">Population too small for specialized businesses.</div>';
    }
}
