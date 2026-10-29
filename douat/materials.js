// Stone pairings. Colours are sRGB albedos measured from photographs of reclaimed
// floors (see NOTES.md); the shader converts them to linear light.
//   darkP:  tone spread, pale haze, fossil debris, calcite vein share
//   lightP: tone spread, share of weathered stones, weathering depth, crack share
export const MATERIALS = [
  {
    id: 'reclaimed', weight: 5, family: 'stone',
    name: 'reclaimed bluestone and cream limestone, tight joints', short: 'bluestone and cream limestone',
    dark: [80, 82, 82], light: [208, 193, 168], mid: [146, 141, 131], bed: [158, 151, 138], fill: [44, 41, 38],
    darkP: [0.70, 0.55, 0.0, 0.10], lightP: [0.20, 0.30, 1.0, 0.10],
    joint: 1.0, fillDepth: 1.4, edge: 1.0, grime: 0.26, scratches: 1.0,
  },
  {
    id: 'petit-granit', weight: 3, family: 'stone',
    name: 'honed petit granit and grey limestone', short: 'petit granit and grey limestone',
    dark: [70, 72, 75], light: [194, 189, 177], mid: [138, 137, 133], bed: [156, 151, 141], fill: [72, 70, 68],
    darkP: [0.40, 0.22, 1.0, 0.35], lightP: [0.16, 0.05, 0.5, 0.05],
    joint: 1.4, fillDepth: 1.0, edge: 0.6, grime: 0.14, scratches: 0.6,
  },
  {
    id: 'lime', weight: 2, family: 'stone',
    name: 'worn bluestone and limestone in lime mortar', short: 'stones in lime mortar',
    dark: [72, 74, 75], light: [209, 191, 166], mid: [150, 143, 131], bed: [162, 154, 139], fill: [190, 180, 162],
    darkP: [0.70, 0.65, 0.0, 0.08], lightP: [0.26, 0.55, 1.25, 0.10],
    joint: 6.0, fillDepth: 0.7, edge: 1.7, grime: 0.30, scratches: 1.2,
  },
  // Marble as in the halls and churches of the Low Countries: white Carrara, black marble
  // from the Meuse (Golzinne, Mazy) and red from Rance in Hainaut, honed and dulled by use.
  //   veins: strength in the light and middle stones, ochre clouding (1 = limestone),
  //          smoothness of the honed face (0 = stone)
  //   rough: base roughness of the dark and the light stones
  {
    id: 'marble', weight: 3, family: 'stone',
    name: 'white Carrara, Belgian black and Rance red marble, honed and worn', short: 'black and white marble',
    dark: [50, 51, 53], light: [216, 214, 207], mid: [140, 86, 76], bed: [158, 151, 138], fill: [96, 94, 90],
    darkP: [0.22, 0.30, 0.0, 0.12], lightP: [0.06, 0.0, 0.0, 0.04],
    veins: [0.9, 0.8, 0.25, 0.75], rough: [0.38, 0.40],
    joint: 0.8, fillDepth: 1.0, edge: 0.5, grime: 0.16, scratches: 1.3,
  },
];

// Cement tiles (carreaux de ciment): pigments poured into one tile, as made in Belgium,
// France and Spain from the 1850s; colours aged, dusty and a little faded. a is the ground,
// b the figure, c a third pigment for outlines and centre lines.
const CEMENT_BASE = {
  family: 'cement', dark: [70, 72, 75], light: [200, 192, 176], darkP: [0.3, 0.3, 0, 0], lightP: [0.15, 0, 0, 0],
  joint: 1.6, fillDepth: 0.6, edge: 0.6, grime: 0.26, scratches: 0.9,
};
MATERIALS.push(
  { ...CEMENT_BASE, id: 'cement-black', weight: 4, name: 'black and white cement tiles', short: 'black and white cement',
    cement: { a: [212, 205, 190], b: [52, 54, 58], c: [132, 66, 52], body: [132, 129, 122] }, bed: [158, 151, 138], fill: [104, 100, 93] },
  { ...CEMENT_BASE, id: 'cement-oxblood', weight: 2, name: 'oxblood and cream cement tiles', short: 'oxblood and cream cement',
    cement: { a: [210, 197, 174], b: [116, 56, 47], c: [50, 51, 54], body: [134, 127, 118] }, bed: [158, 151, 138], fill: [110, 103, 94] },
  { ...CEMENT_BASE, id: 'cement-blue', weight: 2, name: 'slate blue and white cement tiles', short: 'slate blue and white cement',
    cement: { a: [207, 204, 194], b: [64, 84, 106], c: [176, 138, 74], body: [130, 128, 123] }, bed: [156, 151, 140], fill: [104, 101, 96] },
  { ...CEMENT_BASE, id: 'cement-ochre', weight: 1, name: 'ochre and black cement tiles', short: 'ochre and black cement',
    cement: { a: [198, 168, 118], b: [58, 56, 54], c: [214, 206, 188], body: [134, 128, 116] }, bed: [158, 150, 136], fill: [108, 101, 90] },
  { ...CEMENT_BASE, id: 'cement-green', weight: 2, name: 'green and cream cement tiles', short: 'green and cream cement',
    cement: { a: [206, 198, 178], b: [80, 106, 90], c: [54, 55, 57], body: [132, 128, 120] }, bed: [158, 151, 138], fill: [106, 102, 94] },
  { ...CEMENT_BASE, id: 'cement-red', weight: 2, name: 'red oxide and grey cement tiles', short: 'red and grey cement',
    cement: { a: [178, 175, 168], b: [148, 70, 52], c: [52, 53, 56], body: [130, 127, 121] }, bed: [156, 150, 140], fill: [104, 100, 95] },
  { ...CEMENT_BASE, id: 'cement-grey', weight: 2, name: 'grey and white cement tiles', short: 'grey and white cement',
    cement: { a: [212, 208, 198], b: [108, 107, 104], c: [150, 74, 56], body: [132, 129, 123] }, bed: [158, 151, 138], fill: [104, 100, 94] },
);

// Fired clay, hand-moulded and waxed: dark is the red clay, light the yellow, mid a third
// (blue-grey from a reducing kiln, or brown from an overfired one). Old floors have narrow
// joints gone dark with dirt.
//   darkP: firing spread from tile to tile, flashing (the side nearer the fire), lime specks
const CLAY_BASE = {
  family: 'clay', lightP: [0, 0, 0, 0], joint: 4.0, fillDepth: 1.4, edge: 1.3, grime: 0.42, scratches: 0.8,
};
MATERIALS.push(
  { ...CLAY_BASE, id: 'clay-boom', weight: 2, name: 'red and yellow clay tiles from Boom', short: 'Boom red and yellow',
    dark: [146, 74, 56], light: [198, 162, 114], mid: [100, 99, 101], bed: [160, 152, 138], fill: [96, 88, 80], darkP: [0.30, 0.6, 0.4, 0] },
  { ...CLAY_BASE, id: 'clay-tomette', weight: 2, name: 'waxed terracotta, red, ochre and brown', short: 'terracotta',
    dark: [158, 80, 54], light: [196, 140, 86], mid: [110, 66, 50], bed: [160, 152, 138], fill: [84, 72, 62], darkP: [0.30, 0.5, 0.25, 0] },
);

// Glazed tiles: tin and alkaline glazes coloured with minerals, as in Persian, Timurid and
// Moroccan work: cobalt blue, copper turquoise, antimony and iron yellows and ochres, iron
// reds, manganese aubergine. glaze: the ground, four colours for the fields, and the lines
// between them; cement.body is the red clay under the glaze, seen at chips and on the sides.
const GLAZE_BASE = {
  family: 'glaze', dark: [60, 60, 62], light: [200, 196, 186], darkP: [0, 0, 0, 0], lightP: [0, 0, 0, 0],
  joint: 2.0, fillDepth: 0.7, edge: 0.5, grime: 0.18, scratches: 0.7, bed: [158, 151, 138], fill: [176, 170, 158],
};
const BODY = { a: [200, 190, 175], b: [60, 60, 62], c: [120, 62, 50], body: [168, 102, 72] };
MATERIALS.push(
  { ...GLAZE_BASE, id: 'glaze-turquoise', weight: 3, name: 'glazed tiles in turquoise, cobalt, gold and oxblood', short: 'turquoise and cobalt glaze',
    glaze: [[38, 140, 150], [204, 146, 44], [30, 56, 128], [22, 32, 72], [146, 42, 38], [228, 220, 198]], cement: BODY },
  { ...GLAZE_BASE, id: 'glaze-cobalt', weight: 3, name: 'glazed tiles in cobalt, turquoise, ochre and bole red', short: 'cobalt glaze',
    glaze: [[30, 60, 140], [226, 220, 202], [52, 158, 166], [196, 140, 52], [168, 52, 40], [222, 214, 192]], cement: BODY },
  { ...GLAZE_BASE, id: 'glaze-oxblood', weight: 2, name: 'glazed tiles in oxblood, burgundy, gold and turquoise', short: 'oxblood glaze',
    glaze: [[112, 32, 34], [210, 160, 60], [84, 34, 58], [40, 128, 138], [30, 50, 112], [224, 212, 186]], cement: BODY },
  { ...GLAZE_BASE, id: 'glaze-ochre', weight: 2, name: 'glazed tiles in ochre, red, cobalt and turquoise', short: 'ochre glaze',
    glaze: [[198, 142, 54], [172, 52, 40], [36, 70, 150], [60, 168, 174], [36, 104, 70], [232, 226, 210]], cement: BODY },
);

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
