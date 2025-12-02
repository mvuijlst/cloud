import { ZX_SPECTRUM_BRIGHT_SET, ZX_SPECTRUM_NORMAL_SET } from "./palettes.js";
import {
  BLUE_NOISE_MASK_64,
  BLUE_NOISE_MASK_64_HEIGHT,
  BLUE_NOISE_MASK_64_WIDTH,
} from "./blueNoiseMask64.js";

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

const RIEMERSMA_QUEUE_SIZE = 16;
const RIEMERSMA_MAX_WEIGHT = 16;
const RIEMERSMA_DIRECTIONS = {
  NONE: 0,
  LEFT: 1,
  RIGHT: 2,
  UP: 3,
  DOWN: 4,
};

const createRiemersmaWeights = (size, maxWeight) => {
  if (size <= 1) {
    return [maxWeight];
  }
  const multiplier = Math.exp(Math.log(maxWeight) / (size - 1));
  const weights = [];
  let value = 1;
  for (let index = 0; index < size; index += 1) {
    weights.push(Math.round(value));
    value *= multiplier;
  }
  return weights;
};

const computeHilbertLevel = (value) => {
  let level = 0;
  let size = 1;
  while (size < value) {
    size <<= 1;
    level += 1;
  }
  return level;
};

export function riemersmaDithering(imageData, palette) {
  const { data, width, height } = imageData;
  if (!width || !height || !palette?.length) {
    return imageData;
  }

  const queueSize = RIEMERSMA_QUEUE_SIZE;
  const weights = createRiemersmaWeights(queueSize, RIEMERSMA_MAX_WEIGHT);
  const errorQueue = Array.from({ length: queueSize }, () => ({ r: 0, g: 0, b: 0 }));
  const maxDimension = Math.max(width, height);
  const level = computeHilbertLevel(maxDimension);

  let curX = 0;
  let curY = 0;

  const applyCurrentPixel = () => {
    if (curX < 0 || curX >= width || curY < 0 || curY >= height) {
      return;
    }
    const index = (curY * width + curX) * 4;
    const oldColor = [data[index], data[index + 1], data[index + 2]];
    let accR = 0;
    let accG = 0;
    let accB = 0;
    for (let i = 0; i < errorQueue.length; i += 1) {
      const weight = weights[i];
      const entry = errorQueue[i];
      accR += entry.r * weight;
      accG += entry.g * weight;
      accB += entry.b * weight;
    }
    const adjustedColor = [
      clampByte(oldColor[0] + accR / RIEMERSMA_MAX_WEIGHT),
      clampByte(oldColor[1] + accG / RIEMERSMA_MAX_WEIGHT),
      clampByte(oldColor[2] + accB / RIEMERSMA_MAX_WEIGHT),
    ];
    const newColor = findClosestColor(adjustedColor, palette);
    data[index] = newColor[0];
    data[index + 1] = newColor[1];
    data[index + 2] = newColor[2];
    const newError = {
      r: oldColor[0] - newColor[0],
      g: oldColor[1] - newColor[1],
      b: oldColor[2] - newColor[2],
    };
    errorQueue.shift();
    errorQueue.push(newError);
  };

  const move = (direction) => {
    applyCurrentPixel();
    switch (direction) {
      case RIEMERSMA_DIRECTIONS.LEFT:
        curX -= 1;
        break;
      case RIEMERSMA_DIRECTIONS.RIGHT:
        curX += 1;
        break;
      case RIEMERSMA_DIRECTIONS.UP:
        curY -= 1;
        break;
      case RIEMERSMA_DIRECTIONS.DOWN:
        curY += 1;
        break;
      default:
        break;
    }
  };

  const hilbertLevel = (currentLevel, direction) => {
    if (currentLevel <= 0) {
      return;
    }
    if (currentLevel === 1) {
      switch (direction) {
        case RIEMERSMA_DIRECTIONS.LEFT:
          move(RIEMERSMA_DIRECTIONS.RIGHT);
          move(RIEMERSMA_DIRECTIONS.DOWN);
          move(RIEMERSMA_DIRECTIONS.LEFT);
          break;
        case RIEMERSMA_DIRECTIONS.RIGHT:
          move(RIEMERSMA_DIRECTIONS.LEFT);
          move(RIEMERSMA_DIRECTIONS.UP);
          move(RIEMERSMA_DIRECTIONS.RIGHT);
          break;
        case RIEMERSMA_DIRECTIONS.UP:
          move(RIEMERSMA_DIRECTIONS.DOWN);
          move(RIEMERSMA_DIRECTIONS.RIGHT);
          move(RIEMERSMA_DIRECTIONS.UP);
          break;
        case RIEMERSMA_DIRECTIONS.DOWN:
          move(RIEMERSMA_DIRECTIONS.UP);
          move(RIEMERSMA_DIRECTIONS.LEFT);
          move(RIEMERSMA_DIRECTIONS.DOWN);
          break;
        default:
          break;
      }
      return;
    }

    switch (direction) {
      case RIEMERSMA_DIRECTIONS.LEFT:
        hilbertLevel(currentLevel - 1, RIEMERSMA_DIRECTIONS.UP);
        move(RIEMERSMA_DIRECTIONS.RIGHT);
        hilbertLevel(currentLevel - 1, RIEMERSMA_DIRECTIONS.LEFT);
        move(RIEMERSMA_DIRECTIONS.DOWN);
        hilbertLevel(currentLevel - 1, RIEMERSMA_DIRECTIONS.LEFT);
        move(RIEMERSMA_DIRECTIONS.LEFT);
        hilbertLevel(currentLevel - 1, RIEMERSMA_DIRECTIONS.DOWN);
        break;
      case RIEMERSMA_DIRECTIONS.RIGHT:
        hilbertLevel(currentLevel - 1, RIEMERSMA_DIRECTIONS.DOWN);
        move(RIEMERSMA_DIRECTIONS.LEFT);
        hilbertLevel(currentLevel - 1, RIEMERSMA_DIRECTIONS.RIGHT);
        move(RIEMERSMA_DIRECTIONS.UP);
        hilbertLevel(currentLevel - 1, RIEMERSMA_DIRECTIONS.RIGHT);
        move(RIEMERSMA_DIRECTIONS.RIGHT);
        hilbertLevel(currentLevel - 1, RIEMERSMA_DIRECTIONS.UP);
        break;
      case RIEMERSMA_DIRECTIONS.UP:
        hilbertLevel(currentLevel - 1, RIEMERSMA_DIRECTIONS.LEFT);
        move(RIEMERSMA_DIRECTIONS.DOWN);
        hilbertLevel(currentLevel - 1, RIEMERSMA_DIRECTIONS.UP);
        move(RIEMERSMA_DIRECTIONS.RIGHT);
        hilbertLevel(currentLevel - 1, RIEMERSMA_DIRECTIONS.UP);
        move(RIEMERSMA_DIRECTIONS.UP);
        hilbertLevel(currentLevel - 1, RIEMERSMA_DIRECTIONS.RIGHT);
        break;
      case RIEMERSMA_DIRECTIONS.DOWN:
        hilbertLevel(currentLevel - 1, RIEMERSMA_DIRECTIONS.RIGHT);
        move(RIEMERSMA_DIRECTIONS.UP);
        hilbertLevel(currentLevel - 1, RIEMERSMA_DIRECTIONS.DOWN);
        move(RIEMERSMA_DIRECTIONS.LEFT);
        hilbertLevel(currentLevel - 1, RIEMERSMA_DIRECTIONS.DOWN);
        move(RIEMERSMA_DIRECTIONS.DOWN);
        hilbertLevel(currentLevel - 1, RIEMERSMA_DIRECTIONS.LEFT);
        break;
      default:
        break;
    }
  };

  if (level > 0) {
    hilbertLevel(level, RIEMERSMA_DIRECTIONS.UP);
  }
  move(RIEMERSMA_DIRECTIONS.NONE);

  return imageData;
}


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

const colorLuminance = (color) =>
  color[0] * GRAYSCALE_WEIGHTS[0] +
  color[1] * GRAYSCALE_WEIGHTS[1] +
  color[2] * GRAYSCALE_WEIGHTS[2];

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

export function blueNoiseMaskDithering(imageData, palette) {
  const { width, height, data } = imageData;
  if (!palette?.length) {
    return imageData;
  }
  const output = new Uint8ClampedArray(data.length);
  const mask = BLUE_NOISE_MASK_64;
  const maskWidth = BLUE_NOISE_MASK_64_WIDTH;
  const maskHeight = BLUE_NOISE_MASK_64_HEIGHT;

  for (let y = 0; y < height; y++) {
    const maskY = y % maskHeight;
    for (let x = 0; x < width; x++) {
      const maskX = x % maskWidth;
      const maskValue = mask[maskY * maskWidth + maskX];
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const bias = ((maskValue + 0.5) / 256 - 0.5) * 255;
      const candidate = [clampByte(r + bias), clampByte(g + bias), clampByte(b + bias)];
      const chosen = findClosestColor(candidate, palette);
      output[i] = chosen[0];
      output[i + 1] = chosen[1];
      output[i + 2] = chosen[2];
      output[i + 3] = 255;
    }
  }

  return new ImageData(output, width, height);
}

const DOT_DIFFUSION_CLASS_MATRIX_8 = [
  [0, 48, 12, 60, 3, 51, 15, 63],
  [32, 16, 44, 28, 35, 19, 47, 31],
  [8, 56, 4, 52, 11, 59, 7, 55],
  [40, 24, 36, 20, 43, 27, 39, 23],
  [2, 50, 14, 62, 1, 49, 13, 61],
  [34, 18, 46, 30, 33, 17, 45, 29],
  [10, 58, 6, 54, 9, 57, 5, 53],
  [42, 26, 38, 22, 41, 25, 37, 21],
];

const DOT_DIFFUSION_CLASS_MATRIX_16 = [
  [26, 237, 153, 90, 204, 223, 250, 95, 9, 49, 158, 134, 176, 118, 251, 83],
  [163, 50, 112, 185, 25, 127, 76, 136, 212, 117, 73, 18, 103, 220, 164, 148],
  [78, 225, 141, 11, 170, 107, 38, 161, 22, 228, 241, 41, 201, 57, 14, 66],
  [42, 192, 252, 63, 218, 196, 235, 56, 186, 104, 150, 181, 91, 232, 129, 213],
  [13, 124, 31, 100, 84, 146, 5, 70, 206, 125, 65, 4, 140, 34, 109, 171],
  [105, 210, 180, 156, 43, 119, 174, 254, 93, 30, 222, 172, 247, 189, 71, 152],
  [238, 58, 74, 242, 203, 229, 17, 135, 155, 44, 197, 81, 120, 47, 219, 21],
  [19, 149, 2, 130, 27, 89, 64, 193, 110, 244, 15, 101, 160, 8, 205, 88],
  [114, 190, 217, 165, 108, 183, 39, 211, 75, 168, 142, 216, 59, 133, 239, 144],
  [79, 40, 96, 52, 248, 143, 224, 123, 0, 53, 230, 28, 184, 111, 37, 169],
  [177, 137, 234, 198, 67, 10, 154, 98, 236, 187, 126, 92, 200, 245, 77, 54],
  [208, 29, 121, 16, 86, 175, 48, 202, 80, 36, 151, 68, 12, 159, 102, 3],
  [227, 99, 157, 188, 215, 113, 243, 23, 162, 106, 253, 214, 45, 139, 226, 209],
  [72, 46, 255, 60, 147, 33, 128, 221, 138, 61, 173, 20, 191, 115, 178, 62],
  [116, 179, 131, 1, 233, 94, 69, 182, 6, 199, 122, 97, 231, 82, 35, 167],
  [195, 24, 85, 207, 166, 194, 55, 246, 87, 32, 240, 51, 132, 7, 249, 145],
];

const ACTIVE_DOT_DIFFUSION_CLASS_MATRIX = DOT_DIFFUSION_CLASS_MATRIX_16;

const DOT_DIFFUSION_NEIGHBORS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: 1 },
  { dx: -1, dy: 1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: -1 },
];

export function dotDiffusionDithering(imageData, palette) {
  const { width, height, data } = imageData;
  if (!palette?.length) {
    return imageData;
  }
  const totalPixels = width * height;
  const working = new Float32Array(totalPixels * 3);
  for (let idx = 0; idx < totalPixels; idx += 1) {
    const base = idx * 4;
    working[idx * 3] = data[base];
    working[idx * 3 + 1] = data[base + 1];
    working[idx * 3 + 2] = data[base + 2];
  }

  const output = new Uint8ClampedArray(data.length);
  const classMatrix = ACTIVE_DOT_DIFFUSION_CLASS_MATRIX;
  const cmHeight = classMatrix.length;
  const cmWidth = classMatrix[0].length;
  const maxClass = cmWidth * cmHeight - 1;

  for (let cls = 0; cls <= maxClass; cls += 1) {
    for (let y = 0; y < height; y += 1) {
      const row = classMatrix[y % cmHeight];
      for (let x = 0; x < width; x += 1) {
        if (row[x % cmWidth] !== cls) {
          continue;
        }
        const index = y * width + x;
        const base3 = index * 3;
        const current = [working[base3], working[base3 + 1], working[base3 + 2]];
        const chosen = findClosestColor(current, palette);
        const err = [current[0] - chosen[0], current[1] - chosen[1], current[2] - chosen[2]];
        const outBase = index * 4;
        output[outBase] = chosen[0];
        output[outBase + 1] = chosen[1];
        output[outBase + 2] = chosen[2];
        output[outBase + 3] = 255;

        const recipients = [];
        for (const neighbor of DOT_DIFFUSION_NEIGHBORS) {
          const nx = x + neighbor.dx;
          const ny = y + neighbor.dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            continue;
          }
          const nClass = classMatrix[ny % cmHeight][nx % cmWidth];
          if (nClass <= cls) {
            continue;
          }
          recipients.push({ nx, ny });
        }

        if (!recipients.length) {
          continue;
        }

        const weight = 1 / recipients.length;
        for (const recipient of recipients) {
          const neighborIndex = recipient.ny * width + recipient.nx;
          const neighborBase3 = neighborIndex * 3;
          working[neighborBase3] += err[0] * weight;
          working[neighborBase3 + 1] += err[1] * weight;
          working[neighborBase3 + 2] += err[2] * weight;
        }
      }
    }
  }

  return new ImageData(output, width, height);
}

