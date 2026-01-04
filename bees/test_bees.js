
const hexGrid = [];
const maxRings = 20;

function hexRing(q, r, radius) {
  const results = [];
  if (radius === 0) return [{ q, r }];
  
  let hex = { q: q + radius, r: r - radius };
  const directions = [
    { q: 0, r: 1 },
    { q: -1, r: 1 },
    { q: -1, r: 0 },
    { q: 0, r: -1 },
    { q: 1, r: -1 },
    { q: 1, r: 0 }
  ];
  
  for (let d = 0; d < 6; d++) {
    for (let step = 0; step < radius; step++) {
      results.push({ ...hex });
      hex.q += directions[d].q;
      hex.r += directions[d].r;
    }
  }
  return results;
}

function initHexGrid() {
  // Create all potential cells
  for (let ring = 0; ring <= maxRings; ring++) {
    const hexes = ring === 0 ? [{q: 0, r: 0}] : hexRing(0, 0, ring);
    for (const hex of hexes) {
      hexGrid.push({
        q: hex.q,
        r: hex.r,
        built: false,
        type: 'empty',
        capped: false,
        buildProgress: 0.0
      });
    }
  }
  
  // Start with small asymmetric cluster at top center
  const startCells = [
    {q: 0, r: 0},
    {q: 1, r: 0},
    {q: 0, r: 1},
    {q: -1, r: 1},
    {q: 1, r: -1},
    {q: 0, r: -1},
    {q: -1, r: 0},
    {q: 2, r: -1},
    {q: 1, r: 1}
  ];
  
  for (const start of startCells) {
    const hex = hexGrid.find(h => h.q === start.q && h.r === start.r);
    if (hex) {
      hex.built = true;
      hex.buildProgress = 1.0;
      hex.type = 'brood';
    }
  }
}

function getNeighbors(q, r) {
  return [
    { q: q + 1, r: r },
    { q: q - 1, r: r },
    { q: q, r: r + 1 },
    { q: q, r: r - 1 },
    { q: q + 1, r: r - 1 },
    { q: q - 1, r: r + 1 }
  ];
}

initHexGrid();
console.log("Total hexes:", hexGrid.length);
console.log("Built hexes:", hexGrid.filter(h => h.built).length);

const unbuilt = hexGrid.filter(h => !h.built && h.buildProgress < 1.0);
console.log("Unbuilt hexes:", unbuilt.length);

const candidates = unbuilt.filter(h => {
  const neighbors = getNeighbors(h.q, h.r);
  return neighbors.some(n => {
    const neighbor = hexGrid.find(hx => hx.q === n.q && hx.r === n.r);
    return neighbor && neighbor.built;
  });
});

console.log("Candidates found:", candidates.length);

// Simulate one tick of building
const buildersCount = 14;
const dtDays = 0.2;
const cellsPerBuilderPerDay = 1.0;
const buildCapacity = buildersCount * cellsPerBuilderPerDay * dtDays;
console.log("Build Capacity:", buildCapacity);

const activeBuildSites = Math.min(8, Math.max(2, Math.floor(buildersCount / 6)));
const capacityPerSite = buildCapacity / Math.max(1, activeBuildSites);
console.log("Active Sites:", activeBuildSites);
console.log("Capacity Per Site:", capacityPerSite);

if (candidates.length > 0) {
    // Sort candidates (simplified)
    const sortedCandidates = candidates.map(h => ({hex: h, priority: 1})).sort((a,b) => b.priority - a.priority);
    
    for (let i = 0; i < Math.min(activeBuildSites, sortedCandidates.length); i++) {
        const hex = sortedCandidates[i].hex;
        const progressGain = capacityPerSite * (1.0 - i * 0.1);
        console.log(`Building on (${hex.q}, ${hex.r}) gain: ${progressGain}`);
        hex.buildProgress += progressGain;
        if (hex.buildProgress >= 1.0) {
            hex.built = true;
            console.log("Cell built!");
        }
    }
}

console.log("Built hexes after tick:", hexGrid.filter(h => h.built).length);
