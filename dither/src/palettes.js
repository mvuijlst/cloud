const clampPaletteColor = (value) => Math.max(0, Math.min(255, Math.round(value)));

const hexToRgb = (hex) => {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
};

export const createGrayscalePalette = (steps) => {
  const safeSteps = Math.max(2, Math.min(steps, 32));
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

const AMIGA_DELUXE = [
  "#0A1A3C",
  "#154A8A",
  "#1FA7C9",
  "#28D8DA",
  "#F7F3CC",
  "#F0A35E",
  "#D95B27",
  "#7A1E24",
  "#40121A",
  "#7D4E9B",
  "#C78ADC",
  "#F4C2D7",
].map(hexToRgb);

const NES_PALETTE = [
  "#000000",
  "#7C7C7C",
  "#FCFCFC",
  "#A4E4FC",
  "#3CBCFC",
  "#0078F8",
  "#0000FC",
  "#B8B8F8",
  "#6844FC",
  "#4428BC",
  "#940084",
  "#D800CC",
  "#F878F8",
  "#F8B8F8",
  "#F8D8F8",
  "#F8F8F8",
  "#58F898",
  "#00A800",
  "#005800",
  "#00FC00",
  "#94F858",
  "#F8B858",
  "#F87858",
  "#A80000",
  "#F8A4A4",
  "#F4D8A4",
  "#F8F878",
].map(hexToRgb);

const APPLE_II_HIRES = [
  "#000000",
  "#FFFFFF",
  "#00FF00",
  "#FF00FF",
  "#0000FF",
  "#FF8000",
].map(hexToRgb);

const GAME_BOY_SUNSET = [
  "#1D0F2F",
  "#734675",
  "#F18F01",
  "#F7D488",
  "#F45B69",
  "#9B5DE5",
].map(hexToRgb);

const CPC_MODE0 = [
  "#000000",
  "#0000FF",
  "#FF0000",
  "#FF00FF",
  "#00FF00",
  "#00FFFF",
  "#FFFF00",
  "#FFFFFF",
  "#7F7F7F",
  "#7F00FF",
  "#FF007F",
  "#7FFF00",
  "#00FF7F",
  "#FF7F00",
  "#007FFF",
  "#7FFFFF",
].map(hexToRgb);

const SOLARIZED = [
  "#002B36",
  "#073642",
  "#586E75",
  "#657B83",
  "#839496",
  "#93A1A1",
  "#EEE8D5",
  "#FDF6E3",
  "#B58900",
  "#CB4B16",
  "#DC322F",
  "#D33682",
  "#6C71C4",
  "#268BD2",
  "#2AA198",
  "#859900",
].map(hexToRgb);

const VAPORWAVE = [
  "#2B244D",
  "#5D32A1",
  "#FF52A2",
  "#FFC7C7",
  "#69EBD0",
  "#00AFC1",
  "#FDE74C",
  "#FCCA46",
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

const buildWeb216Palette = () => {
  const steps = [0, 51, 102, 153, 204, 255];
  const colors = [];
  for (const r of steps) {
    for (const g of steps) {
      for (const b of steps) {
        colors.push([r, g, b]);
      }
    }
  }
  return colors;
};

const WEB_216 = buildWeb216Palette();

const CMYK_DUOTONE = [
  "#050505",
  "#1F1C18",
  "#3A3629",
  "#5E5234",
  "#8F733C",
  "#B58E44",
  "#D8B154",
  "#F8DB7B",
  "#F7F1C2",
].map(hexToRgb);

export const MULTITONE_DEFAULTS = {
  duotone: ["#050505", "#F8DB7B"],
  tritone: ["#050505", "#8F733C", "#F8DB7B"],
  quadtone: ["#050505", "#5E5234", "#B58E44", "#F8DB7B"],
};

export const PALETTE_GROUP_LABELS = {
  core: "Core palettes",
  retro: "Retro hardware",
  tiny: "Tiny / bit-depth",
  multitone: "Multitone ramps",
  custom: "Custom sets",
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
    id: "grayscale-variable",
    label: "Grayscale ramp",
    group: "core",
    kind: "grayscale",
    size: 8,
    min: 2,
    max: 32,
    description: "Adjustable neutral grayscale ramp.",
  },
  {
    id: "adaptive-auto",
    label: "Adaptive palette",
    group: "core",
    kind: "adaptive",
    size: 12,
    min: 2,
    max: 32,
    description: "Image-driven palette using adaptive clustering.",
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
  {
    id: "web-216",
    label: "Web-safe 216",
    group: "tiny",
    kind: "fixed",
    size: WEB_216.length,
    colors: WEB_216,
    description: "Classic 6x6x6 web-safe cube.",
  },
  {
    id: "amiga-deluxe",
    label: "Amiga Deluxe (12)",
    group: "retro",
    kind: "fixed",
    size: AMIGA_DELUXE.length,
    colors: AMIGA_DELUXE,
    description: "Copper-bar inspired Deluxe Paint hues.",
  },
  {
    id: "nes-classic",
    label: "NES Classic (27)",
    group: "retro",
    kind: "fixed",
    size: NES_PALETTE.length,
    colors: NES_PALETTE,
    description: "Representative subset of the Nintendo Entertainment System palette.",
  },
  {
    id: "apple2-hires",
    label: "Apple II Hi-Res (6)",
    group: "retro",
    kind: "fixed",
    size: APPLE_II_HIRES.length,
    colors: APPLE_II_HIRES,
  },
  {
    id: "gbc-sunset",
    label: "Game Boy Color Sunset (6)",
    group: "retro",
    kind: "fixed",
    size: GAME_BOY_SUNSET.length,
    colors: GAME_BOY_SUNSET,
    description: "Warm late-90s handheld tones.",
  },
  {
    id: "cpc-mode0",
    label: "Amstrad CPC Mode 0 (16)",
    group: "retro",
    kind: "fixed",
    size: CPC_MODE0.length,
    colors: CPC_MODE0,
  },
  {
    id: "multitone",
    label: "Multitone",
    group: "multitone",
    kind: "multitone",
    description: "Blend 2–4 inks with adjustable ramp steps.",
  },
  {
    id: "solarized",
    label: "Solarized (16)",
    group: "custom",
    kind: "fixed",
    size: SOLARIZED.length,
    colors: SOLARIZED,
  },
  {
    id: "vaporwave",
    label: "Vaporwave (8)",
    group: "custom",
    kind: "fixed",
    size: VAPORWAVE.length,
    colors: VAPORWAVE,
    description: "Jazz-cup pastels for retro-futurism.",
  },
];

export const PALETTE_LOOKUP = PALETTE_PRESETS.reduce((acc, preset) => {
  acc[preset.id] = preset;
  return acc;
}, {});

const MAX_SAMPLES = 2000;
const MAX_ITERATIONS = 12;
const MIN_CENTROID_DISTANCE_SQ = 35 * 35;

const samplePixels = (data, stride) => {
  const samples = [];
  for (let i = 0; i + 2 < data.length; i += stride) {
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  return samples;
};

const computeSaturation = (rgb) => {
  const max = Math.max(rgb[0], rgb[1], rgb[2]);
  const min = Math.min(rgb[0], rgb[1], rgb[2]);
  if (!max) return 0;
  return (max - min) / max;
};

const pickInitialCentroids = (samples, k) => {
  if (samples.length === 0) return [];
  const centroids = [];
  const first = samples[Math.floor(Math.random() * samples.length)];
  centroids.push([...first]);

  while (centroids.length < k) {
    const distances = samples.map((sample) => {
      let minDist = Infinity;
      for (const centroid of centroids) {
        const dist = distanceSq(sample, centroid);
        if (dist < minDist) {
          minDist = dist;
        }
      }
      const saturationBias = 0.5 + 0.5 * computeSaturation(sample);
      return Math.max(minDist, 1) * saturationBias;
    });
    const total = distances.reduce((sum, value) => sum + value, 0);
    let pick = Math.random() * total;
    let chosenIndex = 0;
    for (let i = 0; i < distances.length; i++) {
      pick -= distances[i];
      if (pick <= 0) {
        chosenIndex = i;
        break;
      }
    }
    centroids.push([...samples[chosenIndex]]);
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

  const targetColors = Math.max(2, Math.min(32, colorCount));
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

  // enforce diversity by nudging very similar centroids apart
  for (let i = 0; i < centroids.length; i++) {
    for (let j = i + 1; j < centroids.length; j++) {
      if (distanceSq(centroids[i], centroids[j]) < MIN_CENTROID_DISTANCE_SQ) {
        const fallback = samples[Math.floor(Math.random() * samples.length)];
        centroids[j] = [...fallback];
      }
    }
  }

  return centroids;
}
