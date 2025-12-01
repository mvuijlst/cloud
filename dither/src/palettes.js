const clampPaletteColor = (value) => Math.max(0, Math.min(255, Math.round(value)));

const hexToRgb = (hex) => {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
};

const createGrayscalePalette = (steps) => {
  const safeSteps = Math.max(2, Math.min(steps, 16));
  return Array.from({ length: safeSteps }, (_, index) => {
    const value = Math.round((index / (safeSteps - 1)) * 255);
    return [value, value, value];
  });
};

const dedupeColors = (colors) => {
  const seen = new Set();
  const unique = [];
  for (const color of colors) {
    const key = color.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(color);
  }
  return unique;
};

const MONO = [
  [0, 0, 0],
  [255, 255, 255],
];

const GRAYSCALE_4 = createGrayscalePalette(4);
const GRAYSCALE_8 = createGrayscalePalette(8);
const GRAYSCALE_16 = createGrayscalePalette(16);

const PICO_8 = [
  "#000000",
  "#1D2B53",
  "#7E2553",
  "#008751",
  "#AB5236",
  "#5F574F",
  "#C2C3C7",
  "#FFF1E8",
  "#FF004D",
  "#FFA300",
  "#FFEC27",
  "#00E436",
  "#29ADFF",
  "#83769C",
  "#FF77A8",
  "#FFCCAA",
].map(hexToRgb);

const VGA_16 = [
  "#000000",
  "#0000AA",
  "#00AA00",
  "#00AAAA",
  "#AA0000",
  "#AA00AA",
  "#AA5500",
  "#AAAAAA",
  "#555555",
  "#5555FF",
  "#55FF55",
  "#55FFFF",
  "#FF5555",
  "#FF55FF",
  "#FFFF55",
  "#FFFFFF",
].map(hexToRgb);

const EGA_16 = [
  "#000000",
  "#0000AA",
  "#00AA00",
  "#00AAAA",
  "#AA0000",
  "#AA00AA",
  "#AA5500",
  "#AAAAAA",
  "#555555",
  "#5555FF",
  "#55FF55",
  "#55FFFF",
  "#FF5555",
  "#FF55FF",
  "#FFFF55",
  "#FFFFFF",
].map(hexToRgb);

const CGA_CYAN_MAGENTA = ["#000000", "#00FFFF", "#FF00FF", "#FFFFFF"].map(hexToRgb);
const CGA_YELLOW_GREEN = ["#000000", "#00FF00", "#FFFF00", "#FFFFFF"].map(hexToRgb);

const GAME_BOY_GREEN = [
  "#0F380F",
  "#306230",
  "#8BAC0F",
  "#9BBC0F",
].map(hexToRgb);

const GAME_BOY_DMG = ["#0B0B0B", "#3E3E3E", "#7B7B7B", "#C2C2C2"].map(hexToRgb);

const GAME_BOY_AMBER = [
  "#1E1405",
  "#7A4A1A",
  "#C0812A",
  "#F1C56F",
].map(hexToRgb);

const COMMODORE_64 = [
  "#000000",
  "#FFFFFF",
  "#883932",
  "#67B6BD",
  "#8B3F96",
  "#55A049",
  "#40318D",
  "#BFCE72",
  "#8B5429",
  "#574200",
  "#B86962",
  "#505050",
  "#787878",
  "#94E089",
  "#7869C4",
  "#9F9F9F",
].map(hexToRgb);

export const ZX_SPECTRUM_NORMAL_SET = [
  "#000000",
  "#0100CE",
  "#CF0100",
  "#CF01CE",
  "#00CF15",
  "#01CFCF",
  "#CFCF15",
  "#CFCFCF",
].map(hexToRgb);

export const ZX_SPECTRUM_BRIGHT_SET = [
  "#000000",
  "#0200FD",
  "#FF0201",
  "#FF02FD",
  "#00FF1C",
  "#02FFFF",
  "#FFFF1D",
  "#FFFFFF",
].map(hexToRgb);

const ZX_SPECTRUM = dedupeColors([
  ...ZX_SPECTRUM_NORMAL_SET,
  ...ZX_SPECTRUM_BRIGHT_SET,
]);

const RGB_3BIT = [
  "#000000",
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
  "#FFFFFF",
].map(hexToRgb);

export const PALETTE_GROUP_LABELS = {
  core: "Core palettes",
  retro: "Retro hardware",
  tiny: "Tiny / bit-depth",
};

export const PALETTE_PRESETS = [
  {
    id: "mono-2",
    label: "1-bit (2 colors)",
    group: "tiny",
    kind: "fixed",
    size: 2,
    colors: MONO,
    description: "Pure black and white for maximum contrast.",
  },
  {
    id: "grayscale-4",
    label: "Grayscale (4)",
    group: "core",
    kind: "fixed",
    size: 4,
    colors: GRAYSCALE_4,
  },
  {
    id: "tiny-grayscale",
    label: "2-bit grayscale (4)",
    group: "tiny",
    kind: "fixed",
    size: 4,
    colors: GRAYSCALE_4,
  },
  {
    id: "grayscale-8",
    label: "Grayscale (8)",
    group: "core",
    kind: "fixed",
    size: 8,
    colors: GRAYSCALE_8,
  },
  {
    id: "grayscale-16",
    label: "Grayscale (16)",
    group: "core",
    kind: "fixed",
    size: 16,
    colors: GRAYSCALE_16,
  },
  {
    id: "adaptive-8",
    label: "Adaptive (8)",
    group: "core",
    kind: "adaptive",
    size: 8,
  },
  {
    id: "adaptive-16",
    label: "Adaptive (16)",
    group: "core",
    kind: "adaptive",
    size: 16,
  },
  {
    id: "pico-8",
    label: "PICO-8 (16)",
    group: "retro",
    kind: "fixed",
    size: 16,
    colors: PICO_8,
  },
  {
    id: "vga-16",
    label: "VGA 16",
    group: "retro",
    kind: "fixed",
    size: 16,
    colors: VGA_16,
  },
  {
    id: "ega-16",
    label: "EGA 16",
    group: "retro",
    kind: "fixed",
    size: 16,
    colors: EGA_16,
  },
  {
    id: "cga-4",
    label: "CGA 4",
    group: "retro",
    kind: "fixed",
    size: 4,
    colors: CGA_CYAN_MAGENTA,
    variants: [
      { id: "cga-cyan-magenta", label: "Cyan & Magenta", colors: CGA_CYAN_MAGENTA },
      { id: "cga-yellow-green", label: "Yellow & Green", colors: CGA_YELLOW_GREEN },
    ],
  },
  {
    id: "game-boy",
    label: "Game Boy",
    group: "retro",
    kind: "fixed",
    size: 4,
    colors: GAME_BOY_GREEN,
    variants: [
      { id: "game-boy-green", label: "Pea green", colors: GAME_BOY_GREEN },
      { id: "game-boy-gray", label: "DMG grey", colors: GAME_BOY_DMG },
      { id: "game-boy-amber", label: "Pocket amber", colors: GAME_BOY_AMBER },
    ],
  },
  {
    id: "commodore-64",
    label: "Commodore 64 (16)",
    group: "retro",
    kind: "fixed",
    size: 16,
    colors: COMMODORE_64,
  },
  {
    id: "zx-spectrum",
    label: "ZX Spectrum (15)",
    group: "retro",
    kind: "fixed",
    size: ZX_SPECTRUM.length,
    colors: ZX_SPECTRUM,
  },
  {
    id: "rgb-3bit",
    label: "3-bit RGB (8)",
    group: "tiny",
    kind: "fixed",
    size: 8,
    colors: RGB_3BIT,
  },
];

export const PALETTE_LOOKUP = PALETTE_PRESETS.reduce((acc, preset) => {
  acc[preset.id] = preset;
  return acc;
}, {});

const MAX_SAMPLES = 2000;
const MAX_ITERATIONS = 10;

const samplePixels = (data, stride) => {
  const samples = [];
  for (let i = 0; i + 2 < data.length; i += stride) {
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  return samples;
};

const pickInitialCentroids = (samples, k) => {
  if (samples.length === 0) return [];
  const step = Math.max(1, Math.floor(samples.length / k));
  const centroids = [];
  for (let i = 0; i < k; i++) {
    const sample = samples[Math.min(samples.length - 1, i * step)];
    centroids.push([...sample]);
  }
  while (centroids.length < k) {
    const fallback = samples[Math.floor(Math.random() * samples.length)];
    centroids.push([...fallback]);
  }
  return centroids;
};

const distanceSq = (a, b) => {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
};

export function generateAdaptivePalette(imageData, colorCount) {
  const data = imageData.data;
  const totalPixels = data.length / 4;
  if (!totalPixels) {
    return createGrayscalePalette(colorCount);
  }

  const targetColors = Math.max(2, Math.min(16, colorCount));
  const stride = Math.max(4, Math.floor((totalPixels * 4) / MAX_SAMPLES) * 4);
  const samples = samplePixels(data, stride || 4);

  if (samples.length <= targetColors) {
    const deduped = samples.filter((color, index) => {
      const key = color.join(",");
      return samples.findIndex((candidate) => candidate.join(",") === key) === index;
    });
    while (deduped.length < targetColors) {
      deduped.push(deduped[deduped.length - 1] ?? [0, 0, 0]);
    }
    return deduped.slice(0, targetColors);
  }

  const centroids = pickInitialCentroids(samples, targetColors);

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const accumulators = Array.from({ length: targetColors }, () => ({ r: 0, g: 0, b: 0, count: 0 }));

    for (const sample of samples) {
      let bestIndex = 0;
      let minDistance = Infinity;
      for (let i = 0; i < centroids.length; i++) {
        const dist = distanceSq(sample, centroids[i]);
        if (dist < minDistance) {
          minDistance = dist;
          bestIndex = i;
        }
      }
      const bucket = accumulators[bestIndex];
      bucket.r += sample[0];
      bucket.g += sample[1];
      bucket.b += sample[2];
      bucket.count++;
    }

    let updated = false;
    for (let i = 0; i < centroids.length; i++) {
      const bucket = accumulators[i];
      if (!bucket.count) {
        const fallback = samples[Math.floor(Math.random() * samples.length)];
        centroids[i] = [...fallback];
        updated = true;
        continue;
      }
      const next = [
        clampPaletteColor(bucket.r / bucket.count),
        clampPaletteColor(bucket.g / bucket.count),
        clampPaletteColor(bucket.b / bucket.count),
      ];
      if (distanceSq(next, centroids[i]) > 0) {
        centroids[i] = next;
        updated = true;
      }
    }

    if (!updated) {
      break;
    }
  }

  return centroids;
}
