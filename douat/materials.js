// Stone pairings. Colours are sRGB albedos measured from photographs of reclaimed
// floors (see NOTES.md); the shader converts them to linear light.
//   darkP:  tone spread, pale haze, fossil debris, calcite vein share
//   lightP: tone spread, share of weathered stones, weathering depth, crack share
export const MATERIALS = [
  {
    id: 'reclaimed', weight: 5,
    name: 'reclaimed bluestone and cream limestone, tight joints',
    dark: [80, 82, 82], light: [204, 189, 164], bed: [158, 151, 138], fill: [44, 41, 38],
    darkP: [0.70, 0.55, 0.0, 0.10], lightP: [0.20, 0.30, 1.0, 0.10],
    joint: 1.0, fillDepth: 1.4, edge: 1.0, grime: 0.26, scratches: 1.0,
  },
  {
    id: 'petit-granit', weight: 3,
    name: 'honed petit granit and grey limestone',
    dark: [70, 72, 75], light: [194, 189, 177], bed: [156, 151, 141], fill: [72, 70, 68],
    darkP: [0.40, 0.22, 1.0, 0.35], lightP: [0.16, 0.05, 0.5, 0.05],
    joint: 1.4, fillDepth: 1.0, edge: 0.6, grime: 0.14, scratches: 0.6,
  },
  {
    id: 'lime', weight: 2,
    name: 'worn bluestone and limestone in lime mortar',
    dark: [72, 74, 75], light: [209, 191, 166], bed: [162, 154, 139], fill: [190, 180, 162],
    darkP: [0.70, 0.65, 0.0, 0.08], lightP: [0.26, 0.55, 1.25, 0.10],
    joint: 6.0, fillDepth: 0.7, edge: 1.7, grime: 0.30, scratches: 1.2,
  },
];

export function pickMaterial(rng, id) {
  if (id) {
    const m = MATERIALS.find(x => x.id === id);
    if (m) return m;
  }
  const total = MATERIALS.reduce((a, m) => a + m.weight, 0);
  let r = rng() * total;
  for (const m of MATERIALS) { r -= m.weight; if (r <= 0) return m; }
  return MATERIALS[0];
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
