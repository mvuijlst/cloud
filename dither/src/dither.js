import { ZX_SPECTRUM_BRIGHT_SET, ZX_SPECTRUM_NORMAL_SET } from "./palettes.js";

const clampByte = (value) => Math.max(0, Math.min(255, value));
const clampUnit = (value) => Math.max(0, Math.min(1, value));

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

const distributeErrorSafe = (data, width, height, x, y, errR, errG, errB, weight) => {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const index = (y * width + x) * 4;
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

const srgbToLinear = (value) => {
  if (value <= 0.04045) {
    return value / 12.92;
  }
  return Math.pow((value + 0.055) / 1.055, 2.4);
};

const linearToSrgb = (value) => {
  const clamped = clampUnit(value);
  if (clamped <= 0.0031308) {
    return clampByte(clamped * 12.92 * 255);
  }
  return clampByte((1.055 * Math.pow(clamped, 1 / 2.4) - 0.055) * 255);
};
const toLinearRgb = (rgb) => rgb.map((channel) => srgbToLinear(channel / 255));


export function floydSteinberg(imageData, palette) {
  const { data, width, height } = imageData;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const oldColor = [data[i], data[i + 1], data[i + 2]];
      const newColor = findClosestColor(oldColor, palette);
      data[i] = newColor[0];
      data[i + 1] = newColor[1];
      data[i + 2] = newColor[2];

      const errR = oldColor[0] - newColor[0];
      const errG = oldColor[1] - newColor[1];
      const errB = oldColor[2] - newColor[2];

      distributeError(data, width, x + 1, y, errR, errG, errB, 7 / 16);
      distributeError(data, width, x - 1, y + 1, errR, errG, errB, 3 / 16);
      distributeError(data, width, x, y + 1, errR, errG, errB, 5 / 16);
      distributeError(data, width, x + 1, y + 1, errR, errG, errB, 1 / 16);
    }
  }
  return imageData;
}

export function stuckiDithering(imageData, palette) {
  const { width, height } = imageData;
  const data = new Uint8ClampedArray(imageData.data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const oldColor = [data[i], data[i + 1], data[i + 2]];
      const newColor = findClosestColor(oldColor, palette);
      data[i] = newColor[0];
      data[i + 1] = newColor[1];
      data[i + 2] = newColor[2];

      const errR = oldColor[0] - newColor[0];
      const errG = oldColor[1] - newColor[1];
      const errB = oldColor[2] - newColor[2];

      distributeErrorSafe(data, width, height, x + 1, y, errR, errG, errB, 8 / 42);
      distributeErrorSafe(data, width, height, x + 2, y, errR, errG, errB, 4 / 42);
      distributeErrorSafe(data, width, height, x - 2, y + 1, errR, errG, errB, 2 / 42);
      distributeErrorSafe(data, width, height, x - 1, y + 1, errR, errG, errB, 4 / 42);
      distributeErrorSafe(data, width, height, x, y + 1, errR, errG, errB, 8 / 42);
      distributeErrorSafe(data, width, height, x + 1, y + 1, errR, errG, errB, 4 / 42);
      distributeErrorSafe(data, width, height, x + 2, y + 1, errR, errG, errB, 2 / 42);
      distributeErrorSafe(data, width, height, x - 2, y + 2, errR, errG, errB, 1 / 42);
      distributeErrorSafe(data, width, height, x - 1, y + 2, errR, errG, errB, 2 / 42);
      distributeErrorSafe(data, width, height, x, y + 2, errR, errG, errB, 4 / 42);
      distributeErrorSafe(data, width, height, x + 1, y + 2, errR, errG, errB, 2 / 42);
      distributeErrorSafe(data, width, height, x + 2, y + 2, errR, errG, errB, 1 / 42);
    }
  }
  return new ImageData(data, width, height);
}

export function jarvisJudiceNinkeDithering(imageData, palette) {
  const { width, height } = imageData;
  const data = new Uint8ClampedArray(imageData.data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const oldColor = [data[i], data[i + 1], data[i + 2]];
      const newColor = findClosestColor(oldColor, palette);
      data[i] = newColor[0];
      data[i + 1] = newColor[1];
      data[i + 2] = newColor[2];

      const errR = oldColor[0] - newColor[0];
      const errG = oldColor[1] - newColor[1];
      const errB = oldColor[2] - newColor[2];

      distributeErrorSafe(data, width, height, x + 1, y, errR, errG, errB, 7 / 48);
      distributeErrorSafe(data, width, height, x + 2, y, errR, errG, errB, 5 / 48);

      distributeErrorSafe(data, width, height, x - 2, y + 1, errR, errG, errB, 3 / 48);
      distributeErrorSafe(data, width, height, x - 1, y + 1, errR, errG, errB, 5 / 48);
      distributeErrorSafe(data, width, height, x, y + 1, errR, errG, errB, 7 / 48);
      distributeErrorSafe(data, width, height, x + 1, y + 1, errR, errG, errB, 5 / 48);
      distributeErrorSafe(data, width, height, x + 2, y + 1, errR, errG, errB, 3 / 48);

      distributeErrorSafe(data, width, height, x - 2, y + 2, errR, errG, errB, 1 / 48);
      distributeErrorSafe(data, width, height, x - 1, y + 2, errR, errG, errB, 3 / 48);
      distributeErrorSafe(data, width, height, x, y + 2, errR, errG, errB, 5 / 48);
      distributeErrorSafe(data, width, height, x + 1, y + 2, errR, errG, errB, 3 / 48);
      distributeErrorSafe(data, width, height, x + 2, y + 2, errR, errG, errB, 1 / 48);
    }
  }
  return new ImageData(data, width, height);
}

export function knollDithering(imageData, palette) {
  const { width, height } = imageData;
  const data = new Uint8ClampedArray(imageData.data);
  const offsets = [
    [1, 0, 12 / 136],
    [2, 0, 10 / 136],
    [3, 0, 7 / 136],
    [4, 0, 5 / 136],
    [-1, 1, 12 / 136],
    [0, 1, 12 / 136],
    [1, 1, 8 / 136],
    [2, 1, 5 / 136],
    [3, 1, 3 / 136],
    [4, 1, 0],
    [-2, 2, 10 / 136],
    [-1, 2, 8 / 136],
    [0, 2, 5 / 136],
    [1, 2, 3 / 136],
    [2, 2, 2 / 136],
    [3, 2, 0],
    [4, 2, 0],
    [-3, 3, 7 / 136],
    [-2, 3, 5 / 136],
    [-1, 3, 3 / 136],
    [0, 3, 2 / 136],
    [1, 3, 1 / 136],
    [2, 3, 0],
    [3, 3, 0],
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const oldColor = [data[i], data[i + 1], data[i + 2]];
      const newColor = findClosestColor(oldColor, palette);
      data[i] = newColor[0];
      data[i + 1] = newColor[1];
      data[i + 2] = newColor[2];

      const errR = oldColor[0] - newColor[0];
      const errG = oldColor[1] - newColor[1];
      const errB = oldColor[2] - newColor[2];

      for (const [dx, dy, weight] of offsets) {
        if (!weight) continue;
        distributeErrorSafe(data, width, height, x + dx, y + dy, errR, errG, errB, weight);
      }
    }
  }
  return new ImageData(data, width, height);
}

export function sierraDithering(imageData, palette) {
  const { width, height } = imageData;
  const data = new Uint8ClampedArray(imageData.data);
  const offsets = [
    [1, 0, 5 / 32],
    [2, 0, 3 / 32],
    [-2, 1, 2 / 32],
    [-1, 1, 4 / 32],
    [0, 1, 5 / 32],
    [1, 1, 4 / 32],
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const oldColor = [data[i], data[i + 1], data[i + 2]];
      const newColor = findClosestColor(oldColor, palette);
      data[i] = newColor[0];
      data[i + 1] = newColor[1];
      data[i + 2] = newColor[2];

      const errR = oldColor[0] - newColor[0];
      const errG = oldColor[1] - newColor[1];
      const errB = oldColor[2] - newColor[2];

      for (const [dx, dy, weight] of offsets) {
        distributeErrorSafe(data, width, height, x + dx, y + dy, errR, errG, errB, weight);
      }
    }
  }
  return new ImageData(data, width, height);
}

export function stevensonArceDithering(imageData, palette) {
  const { width, height } = imageData;
  const data = new Uint8ClampedArray(imageData.data);
  const offsets = [
    [2, 0, 32 / 200],
    [3, 0, 12 / 200],
    [-2, 1, 12 / 200],
    [1, 1, 26 / 200],
    [-3, 2, 12 / 200],
    [-1, 2, 26 / 200],
    [1, 2, 12 / 200],
    [3, 2, 12 / 200],
    [-2, 3, 12 / 200],
    [1, 3, 26 / 200],
    [0, 4, 12 / 200],
    [2, 4, 12 / 200],
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const oldColor = [data[i], data[i + 1], data[i + 2]];
      const newColor = findClosestColor(oldColor, palette);
      data[i] = newColor[0];
      data[i + 1] = newColor[1];
      data[i + 2] = newColor[2];

      const errR = oldColor[0] - newColor[0];
      const errG = oldColor[1] - newColor[1];
      const errB = oldColor[2] - newColor[2];

      for (const [dx, dy, weight] of offsets) {
        distributeErrorSafe(data, width, height, x + dx, y + dy, errR, errG, errB, weight);
      }
    }
  }
  return new ImageData(data, width, height);
}

export function gradientBasedDithering(imageData, palette) {
  const { data, width, height } = imageData;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const oldColor = [data[i], data[i + 1], data[i + 2]];
      const newColor = findClosestColor(oldColor, palette);
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

export function latticeBoltzmannDithering(imageData, palette) {
  const { width, height } = imageData;
  const pixelCount = width * height;
  if (!pixelCount) {
    return imageData;
  }

  const working = new Float32Array(imageData.data);
  const lbmDirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 1 },
    { dx: -1, dy: -1 },
  ];
  const weight = 1 / lbmDirs.length;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const base = (y * width + x) * 4;
      const oldColor = [working[base], working[base + 1], working[base + 2]];
      const newColor = findClosestColor(oldColor, palette);
      working[base] = newColor[0];
      working[base + 1] = newColor[1];
      working[base + 2] = newColor[2];

      const errR = oldColor[0] - newColor[0];
      const errG = oldColor[1] - newColor[1];
      const errB = oldColor[2] - newColor[2];

      for (const dir of lbmDirs) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
          continue;
        }
        const neighborIndex = (ny * width + nx) * 4;
        working[neighborIndex] += errR * weight;
        working[neighborIndex + 1] += errG * weight;
        working[neighborIndex + 2] += errB * weight;
      }
    }
  }

  const output = new Uint8ClampedArray(working.length);
  for (let idx = 0; idx < pixelCount; idx++) {
    const base = idx * 4;
    const color = [
      clampByte(working[base]),
      clampByte(working[base + 1]),
      clampByte(working[base + 2]),
    ];
    const snapped = findClosestColor(color, palette);
    output[base] = snapped[0];
    output[base + 1] = snapped[1];
    output[base + 2] = snapped[2];
    output[base + 3] = 255;
  }

  return new ImageData(output, width, height);
}

export function bayerDithering(imageData, palette, threshold = 128) {
  const { data, width, height } = imageData;
  const bayerMatrix = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  const matrixSize = 4;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const bayerValue = bayerMatrix[y % matrixSize][x % matrixSize];
      const normalizedMatrix = (bayerValue + 0.5) / (matrixSize * matrixSize);
      const bias = (normalizedMatrix - 0.5) * 2;
      const strength = threshold / 255;
      const adjust = bias * 255 * strength;
      const candidate = [clampByte(r + adjust), clampByte(g + adjust), clampByte(b + adjust)];
      const newColor = findClosestColor(candidate, palette);
      data[i] = newColor[0];
      data[i + 1] = newColor[1];
      data[i + 2] = newColor[2];
    }
  }
  return imageData;
}

export function atkinsonDithering(imageData, palette) {
  const { data, width, height } = imageData;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const oldColor = [data[i], data[i + 1], data[i + 2]];
      const newColor = findClosestColor(oldColor, palette);
      data[i] = newColor[0];
      data[i + 1] = newColor[1];
      data[i + 2] = newColor[2];

      const errR = oldColor[0] - newColor[0];
      const errG = oldColor[1] - newColor[1];
      const errB = oldColor[2] - newColor[2];

      distributeError(data, width, x + 1, y, errR, errG, errB, 1 / 8);
      distributeError(data, width, x + 2, y, errR, errG, errB, 1 / 8);
      distributeError(data, width, x - 1, y + 1, errR, errG, errB, 1 / 8);
      distributeError(data, width, x, y + 1, errR, errG, errB, 1 / 8);
      distributeError(data, width, x + 1, y + 1, errR, errG, errB, 1 / 8);
      distributeError(data, width, x, y + 2, errR, errG, errB, 1 / 8);
    }
  }
  return imageData;
}

const GRAYSCALE_WEIGHTS = [0.2126, 0.7152, 0.0722];

const colorDistanceSq = (a, b) => {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
};

const createDiscreteGrayPalette = (levels) => {
  const safeLevels = Math.max(2, levels);
  return Array.from({ length: safeLevels }, (_, index) => {
    if (index === safeLevels - 1) {
      return [255, 255, 255];
    }
    const value = Math.floor((index / (safeLevels - 1)) * 255);
    return [value, value, value];
  });
};

const buildColorRamp = (inks, steps) => {
  if (inks.length < 2) {
    return inks.slice();
  }
  const ramp = [];
  for (let i = 0; i < inks.length - 1; i++) {
    const start = inks[i];
    const end = inks[i + 1];
    if (i === 0) {
      ramp.push([...start]);
    }
    for (let step = 1; step <= steps; step++) {
      const t = step / (steps + 1);
      ramp.push([
        Math.round(start[0] + (end[0] - start[0]) * t),
        Math.round(start[1] + (end[1] - start[1]) * t),
        Math.round(start[2] + (end[2] - start[2]) * t),
      ]);
    }
    ramp.push([...end]);
  }
  return ramp;
};

const convertToGrayscale = (imageData) => {
  const { width, height } = imageData;
  const grayData = new Uint8ClampedArray(imageData.data);
  for (let i = 0; i < grayData.length; i += 4) {
    const gray = Math.round(
      grayData[i] * GRAYSCALE_WEIGHTS[0] +
        grayData[i + 1] * GRAYSCALE_WEIGHTS[1] +
        grayData[i + 2] * GRAYSCALE_WEIGHTS[2]
    );
    grayData[i] = gray;
    grayData[i + 1] = gray;
    grayData[i + 2] = gray;
  }
  return new ImageData(grayData, width, height);
};

const remapGrayToRamp = (imageData, ramp) => {
  const { width, height, data } = imageData;
  const output = new Uint8ClampedArray(data.length);
  const maxIndex = ramp.length - 1;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i];
    const index = Math.max(0, Math.min(maxIndex, Math.round((gray / 255) * maxIndex)));
    const color = ramp[index];
    output[i] = color[0];
    output[i + 1] = color[1];
    output[i + 2] = color[2];
    output[i + 3] = 255;
  }
  return new ImageData(output, width, height);
};

export function multitoneHalftone(imageData, config = {}, method = floydSteinberg, threshold = 128) {
  const inks = config.inks ?? [];
  if (inks.length < 2) {
    return imageData;
  }

  const steps = Math.max(1, Math.min(4, Math.round(config.steps ?? 1)));
  const ramp = buildColorRamp(inks, steps);
  const grayscalePalette = createDiscreteGrayPalette(ramp.length);
  const grayscaleImage = convertToGrayscale(imageData);
  const dithered = method(grayscaleImage, grayscalePalette, threshold) ?? grayscaleImage;
  return remapGrayToRamp(dithered, ramp);
}

const ZX_BLOCK_SIZE = 8;

const createColorPairs = (source) => {
  const pairs = [];
  for (let i = 0; i < source.length; i++) {
    for (let j = i; j < source.length; j++) {
      pairs.push([source[i], source[j]]);
    }
  }
  return pairs;
};

const ZX_NORMAL_PAIRS = createColorPairs(ZX_SPECTRUM_NORMAL_SET);
const ZX_BRIGHT_PAIRS = createColorPairs(ZX_SPECTRUM_BRIGHT_SET);

const findBestPairForBlock = (pixels, pairs) => {
  let best = { error: Infinity, pair: pairs[0] };
  for (const pair of pairs) {
    let error = 0;
    for (const pixel of pixels) {
      const distA = colorDistanceSq(pixel, pair[0]);
      const distB = colorDistanceSq(pixel, pair[1]);
      error += Math.min(distA, distB);
      if (error >= best.error) break;
    }
    if (error < best.error) {
      best = { error, pair };
    }
  }
  return best;
};

export function applyZxSpectrumAttributes(imageData) {
  const { data, width, height } = imageData;
  for (let blockY = 0; blockY < height; blockY += ZX_BLOCK_SIZE) {
    for (let blockX = 0; blockX < width; blockX += ZX_BLOCK_SIZE) {
      const blockPixels = [];
      const indices = [];

      for (let y = 0; y < ZX_BLOCK_SIZE && blockY + y < height; y++) {
        for (let x = 0; x < ZX_BLOCK_SIZE && blockX + x < width; x++) {
          const idx = ((blockY + y) * width + (blockX + x)) * 4;
          indices.push(idx);
          blockPixels.push([data[idx], data[idx + 1], data[idx + 2]]);
        }
      }

      if (!blockPixels.length) continue;

      const normalResult = findBestPairForBlock(blockPixels, ZX_NORMAL_PAIRS);
      const brightResult = findBestPairForBlock(blockPixels, ZX_BRIGHT_PAIRS);
      const bestResult = normalResult.error <= brightResult.error ? normalResult : brightResult;

      for (let i = 0; i < indices.length; i++) {
        const pixel = blockPixels[i];
        const [a, b] = bestResult.pair;
        const chosen = colorDistanceSq(pixel, a) <= colorDistanceSq(pixel, b) ? a : b;
        const idx = indices[i];
        data[idx] = chosen[0];
        data[idx + 1] = chosen[1];
        data[idx + 2] = chosen[2];
      }
    }
  }
  return imageData;
}
