import { ZX_SPECTRUM_BRIGHT_SET, ZX_SPECTRUM_NORMAL_SET } from "./palettes.js";

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

      const weight = 1 / 9;
      distributeError(data, width, x + 1, y, errR, errG, errB, weight);
      distributeError(data, width, x - 1, y + 1, errR, errG, errB, weight);
      distributeError(data, width, x, y + 1, errR, errG, errB, weight);
      distributeError(data, width, x + 1, y + 1, errR, errG, errB, weight);
      distributeError(data, width, x - 1, y, errR, errG, errB, weight);
      distributeError(data, width, x + 1, y - 1, errR, errG, errB, weight);
      distributeError(data, width, x, y - 1, errR, errG, errB, weight);
      distributeError(data, width, x - 1, y - 1, errR, errG, errB, weight);
      distributeError(data, width, x + 2, y, errR, errG, errB, weight);
    }
  }
  return imageData;
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

const colorDistanceSq = (a, b) => {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
};

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
