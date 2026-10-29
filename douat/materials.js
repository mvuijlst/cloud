// Stone pairings. Colours are sRGB albedos measured from photographs of reclaimed
// floors (see NOTES.md); the shader converts them to linear light.
//   darkP:  tone spread, pale haze, fossil debris, calcite vein share
//   lightP: tone spread, share of weathered stones, weathering depth, crack share
export const MATERIALS = [
  {
    id: 'reclaimed', weight: 5, family: 'stone',
    name: 'reclaimed bluestone and cream limestone, tight joints',
    dark: [80, 82, 82], light: [208, 193, 168], bed: [158, 151, 138], fill: [44, 41, 38],
    darkP: [0.70, 0.55, 0.0, 0.10], lightP: [0.20, 0.30, 1.0, 0.10],
    joint: 1.0, fillDepth: 1.4, edge: 1.0, grime: 0.26, scratches: 1.0,
  },
  {
    id: 'petit-granit', weight: 3, family: 'stone',
    name: 'honed petit granit and grey limestone',
    dark: [70, 72, 75], light: [194, 189, 177], bed: [156, 151, 141], fill: [72, 70, 68],
    darkP: [0.40, 0.22, 1.0, 0.35], lightP: [0.16, 0.05, 0.5, 0.05],
    joint: 1.4, fillDepth: 1.0, edge: 0.6, grime: 0.14, scratches: 0.6,
  },
  {
    id: 'lime', weight: 2, family: 'stone',
    name: 'worn bluestone and limestone in lime mortar',
    dark: [72, 74, 75], light: [209, 191, 166], bed: [162, 154, 139], fill: [190, 180, 162],
    darkP: [0.70, 0.65, 0.0, 0.08], lightP: [0.26, 0.55, 1.25, 0.10],
    joint: 6.0, fillDepth: 0.7, edge: 1.7, grime: 0.30, scratches: 1.2,
  },
];

// Cement tiles (carreaux de ciment): two pigments poured into one tile, as made in Belgium,
// France and Spain from the 1850s; colours aged, dusty and a little faded.
const CEMENT_BASE = {
  family: 'cement', dark: [70, 72, 75], light: [200, 192, 176], darkP: [0.3, 0.3, 0, 0], lightP: [0.15, 0, 0, 0],
  joint: 1.6, fillDepth: 0.6, edge: 0.6, grime: 0.26, scratches: 0.9,
};
MATERIALS.push(
  { ...CEMENT_BASE, id: 'cement-black', weight: 4, name: 'black and white cement tiles',
    cement: { a: [212, 205, 190], b: [52, 54, 58], body: [132, 129, 122] }, bed: [158, 151, 138], fill: [104, 100, 93] },
  { ...CEMENT_BASE, id: 'cement-oxblood', weight: 2, name: 'oxblood and cream cement tiles',
    cement: { a: [210, 197, 174], b: [116, 56, 47], body: [134, 127, 118] }, bed: [158, 151, 138], fill: [110, 103, 94] },
  { ...CEMENT_BASE, id: 'cement-blue', weight: 2, name: 'slate blue and white cement tiles',
    cement: { a: [207, 204, 194], b: [64, 84, 106], body: [130, 128, 123] }, bed: [156, 151, 140], fill: [104, 101, 96] },
  { ...CEMENT_BASE, id: 'cement-ochre', weight: 1, name: 'ochre and black cement tiles',
    cement: { a: [198, 168, 118], b: [58, 56, 54], body: [134, 128, 116] }, bed: [158, 150, 136], fill: [108, 101, 90] },
);

// A named material if it suits the family, otherwise one drawn by weight from the family.
export function pickMaterial(rng, id, family = 'stone') {
  const fits = MATERIALS.filter(m => m.family === family);
  const named = fits.find(x => x.id === id);
  if (named) return named;
  const total = fits.reduce((a, m) => a + m.weight, 0);
  let r = rng() * total;
  for (const m of fits) { r -= m.weight; if (r <= 0) return m; }
  return fits[0];
}

// Daylight from a window at the top left of the room.
export function daylight(rng) {
  const az = Math.PI * (1.18 + 0.14 * (rng() - 0.5));      // towards the light, y down
  const el = (22 + 10 * rng()) * Math.PI / 180;
  const dir = [Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)];
  const warm = rng();
  const sunL = 2.3, skyL = 0.8;
  const col = [1.0, 0.965 - 0.02 * warm, 0.92 - 0.05 * warm].map(c => c * sunL);
  const sky = [0.88, 0.91, 0.96].map(c => c * skyL);
  const exposure = 1 / (sunL * Math.sin(el) + skyL * 0.86);
  return { dir, col, sky, soft: 0.14, exposure };
}
