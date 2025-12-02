import {
  PALETTE_GROUP_LABELS,
  PALETTE_LOOKUP,
  PALETTE_PRESETS,
  MULTITONE_DEFAULTS,
  createGrayscalePalette,
  generateAdaptivePalette,
} from "./palettes.js";

const methodOptions = [
  { value: "floyd-steinberg", label: "Floyd–Steinberg" },
  { value: "bayer", label: "Bayer (ordered)" },
  { value: "atkinson", label: "Atkinson" },
  { value: "stucki", label: "Stucki" },
  { value: "jjn", label: "Jarvis–Judice–Ninke" },
  { value: "knoll", label: "Knoll" },
  { value: "sierra", label: "Sierra" },
  { value: "stevenson-arce", label: "Stevenson–Arce" },
  { value: "gradient", label: "Gradient-based" },
  { value: "lattice", label: "Lattice-Boltzmann" },
];

const DEFAULT_PAPER_COLOR = [255, 255, 255];

const defaultPaletteId = "grayscale-variable";

const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const methodSelect = document.getElementById("methodSelect");
const resizeSelect = document.getElementById("resizeSelect");
const paletteGroupSelect = document.getElementById("paletteGroupSelect");
const palettePresetSelect = document.getElementById("palettePresetSelect");
const variantSelect = document.getElementById("variantSelect");
const adaptiveGroup = document.getElementById("adaptiveGroup");
const adaptiveRange = document.getElementById("adaptiveRange");
const adaptiveValue = document.getElementById("adaptiveValue");
const adaptiveLabel = document.getElementById("adaptiveLabel");
const multitoneGroup = document.getElementById("multitoneGroup");
const multitonePickers = document.getElementById("multitonePickers");
const multitoneColorCountRange = document.getElementById("multitoneColorCount");
const multitoneColorCountValue = document.getElementById("multitoneColorCountValue");
const multitoneStepsRange = document.getElementById("multitoneSteps");
const multitoneStepsValue = document.getElementById("multitoneStepsValue");
const thresholdGroup = document.getElementById("thresholdGroup");
const thresholdRange = document.getElementById("thresholdRange");
const thresholdValue = document.getElementById("thresholdValue");
const statusText = document.getElementById("statusText");
const downloadButton = document.getElementById("downloadButton");
const originalCanvas = document.getElementById("originalCanvas");
const ditheredCanvas = document.getElementById("ditheredCanvas");

const originalCtx = originalCanvas.getContext("2d");
const ditheredCtx = ditheredCanvas.getContext("2d");

let hasImage = false;
let jobCounter = 0;
const variantSelections = {};
const paletteSelections = {};
const paletteSizeSelections = {};
const multitoneColorSelections = {};
const multitoneSettings = {};
const MULTITONE_COLOR_LIMITS = { min: 2, max: 4 };
const MULTITONE_STEP_LIMITS = { min: 1, max: 4 };
const DEFAULT_MULTITONE_COLORS = MULTITONE_DEFAULTS?.quadtone ?? ["#050505", "#5E5234", "#B58E44", "#F8DB7B"];
const defaultPaletteGroup = PALETTE_LOOKUP[defaultPaletteId]?.group ?? "core";

const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
worker.addEventListener("message", (event) => {
  const { jobId, ditheredImageData } = event.data;
  if (jobId !== jobCounter) {
    return;
  }
  ditheredCanvas.width = ditheredImageData.width;
  ditheredCanvas.height = ditheredImageData.height;
  ditheredCtx.putImageData(ditheredImageData, 0, 0);
  const dataUrl = ditheredCanvas.toDataURL("image/png");
  downloadButton.href = dataUrl;
  downloadButton.removeAttribute("disabled");
  statusText.textContent = `Done: ${ditheredImageData.width}×${ditheredImageData.height} (${getCurrentPaletteLabel()})`;
});

const setStatus = (message) => {
  statusText.textContent = message;
};

const supportsSizeSlider = (preset) => preset && (preset.kind === "adaptive" || preset.kind === "grayscale");

const getSizeBounds = (preset) => ({
  min: preset?.min ?? 2,
  max: preset?.max ?? 32,
});

const clampSizeForPreset = (value, preset) => {
  const { min, max } = getSizeBounds(preset);
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return preset?.size ?? min;
  }
  return Math.max(min, Math.min(max, Math.round(numeric)));
};

const hexToRgb = (hex) => {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
};

const rgbToHex = (rgb) =>
  `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;

const clampToBounds = (value, bounds) => {
  const numeric = Number(value);
  const fallback = Number.isNaN(numeric) ? bounds.min : numeric;
  return Math.max(bounds.min, Math.min(bounds.max, Math.round(fallback)));
};

const getMultitoneSettings = (preset) => {
  if (!preset) return null;
  if (!multitoneSettings[preset.id]) {
    multitoneSettings[preset.id] = {
      colors: MULTITONE_COLOR_LIMITS.min,
      steps: MULTITONE_STEP_LIMITS.min,
    };
  }
  const settings = multitoneSettings[preset.id];
  settings.colors = clampToBounds(settings.colors, MULTITONE_COLOR_LIMITS);
  settings.steps = clampToBounds(settings.steps, MULTITONE_STEP_LIMITS);
  return settings;
};

const ensureMultitoneSelection = (presetId) => {
  if (!multitoneColorSelections[presetId]) {
    multitoneColorSelections[presetId] = [...DEFAULT_MULTITONE_COLORS];
  }
  const selection = multitoneColorSelections[presetId];
  while (selection.length < MULTITONE_COLOR_LIMITS.max) {
    selection.push("#FFFFFF");
  }
  return selection;
};

const getCurrentPaletteLabel = () => {
  const preset = getCurrentPalettePreset();
  if (!preset) return "custom";
  if (supportsSizeSlider(preset)) {
    const size = paletteSizeSelections[preset.id] ?? clampSizeForPreset(preset.size, preset);
    const base = preset.label.replace(/\s*\(.*?\)/, "").trim() || preset.label;
    const suffix = preset.kind === "grayscale" ? "steps" : "colors";
    return `${base} (${size} ${suffix})`;
  }
  if (preset.kind === "multitone") {
    const settings = getMultitoneSettings(preset);
    if (settings) {
      return `${preset.label} (${settings.colors} colors, ${settings.steps} steps)`;
    }
  }
  if (preset.variants?.length) {
    const variantId = variantSelections[preset.id];
    const variant = preset.variants.find((entry) => entry.id === variantId);
    if (variant) {
      return `${preset.label} – ${variant.label}`;
    }
  }
  return preset.label;
};

const getCurrentPalettePreset = () => PALETTE_LOOKUP[palettePresetSelect.value];

const populateMethodSelect = () => {
  methodOptions.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.textContent = option.label;
    methodSelect.append(opt);
  });
  methodSelect.value = methodOptions[0].value;
};

const populatePaletteGroupSelect = () => {
  paletteGroupSelect.innerHTML = "";
  Object.entries(PALETTE_GROUP_LABELS).forEach(([key, label]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = label;
    paletteGroupSelect.append(opt);
  });
  paletteGroupSelect.value = defaultPaletteGroup;
};

const populatePalettePresetSelect = () => {
  const groupKey = paletteGroupSelect.value || defaultPaletteGroup;
  palettePresetSelect.innerHTML = "";
  const presets = PALETTE_PRESETS.filter((preset) => preset.group === groupKey);
  presets.forEach((preset) => {
    const opt = document.createElement("option");
    opt.value = preset.id;
    opt.textContent = preset.label;
    palettePresetSelect.append(opt);
  });

  const stored = paletteSelections[groupKey];
  const fallback = groupKey === defaultPaletteGroup ? defaultPaletteId : presets[0]?.id;
  const target = presets.some((preset) => preset.id === stored) ? stored : fallback;
  if (target) {
    palettePresetSelect.value = target;
    paletteSelections[groupKey] = target;
  }
};

const toggleThresholdGroup = () => {
  if (methodSelect.value === "bayer") {
    thresholdGroup.classList.remove("hidden");
  } else {
    thresholdGroup.classList.add("hidden");
  }
};

const updateSizeControls = (preset) => {
  if (!supportsSizeSlider(preset)) {
    adaptiveGroup.classList.add("hidden");
    return;
  }

  const bounds = getSizeBounds(preset);
  adaptiveRange.min = bounds.min;
  adaptiveRange.max = bounds.max;
  const stored = paletteSizeSelections[preset.id] ?? clampSizeForPreset(preset.size, preset);
  const value = clampSizeForPreset(stored, preset);
  paletteSizeSelections[preset.id] = value;
  adaptiveRange.value = value;
  adaptiveValue.textContent = value;
  adaptiveLabel.textContent = preset.kind === "grayscale" ? "Grayscale steps" : "Adaptive colors";
  adaptiveGroup.classList.remove("hidden");
};

const updateMultitoneControls = (preset) => {
  if (!preset || preset.kind !== "multitone") {
    multitoneGroup.classList.add("hidden");
    multitonePickers.innerHTML = "";
    return;
  }

  const settings = getMultitoneSettings(preset);
  if (!settings) {
    multitoneGroup.classList.add("hidden");
    multitonePickers.innerHTML = "";
    return;
  }

  multitoneColorCountRange.value = settings.colors;
  multitoneColorCountValue.textContent = settings.colors;
  multitoneStepsRange.value = settings.steps;
  multitoneStepsValue.textContent = settings.steps;

  const colors = ensureMultitoneSelection(preset.id);
  multitonePickers.innerHTML = "";

  colors.slice(0, settings.colors).forEach((hex, index) => {
    const wrapper = document.createElement("label");
    wrapper.className = "multitone-picker";
    wrapper.textContent = `Ink ${index + 1}`;

    const input = document.createElement("input");
    input.type = "color";
    input.value = hex;
    input.dataset.index = String(index);
    input.addEventListener("input", () => {
      const selection = ensureMultitoneSelection(preset.id);
      selection[index] = input.value;
      applyDithering();
    });

    wrapper.append(input);
    multitonePickers.append(wrapper);
  });

  multitoneGroup.classList.remove("hidden");
};

const updateVariantOptions = () => {
  const preset = getCurrentPalettePreset();
  if (!preset) {
    variantSelect.classList.add("hidden");
    variantSelect.innerHTML = "";
    updateSizeControls(null);
    updateMultitoneControls(null);
    return;
  }
  const variants = preset?.variants ?? [];
  variantSelect.innerHTML = "";

  if (!variants.length) {
    variantSelect.classList.add("hidden");
  } else {
    variants.forEach((variant) => {
      const opt = document.createElement("option");
      opt.value = variant.id;
      opt.textContent = variant.label;
      variantSelect.append(opt);
    });

    const stored = variantSelections[preset.id];
    const fallback = variants[0].id;
    variantSelect.value = stored && variants.some((v) => v.id === stored) ? stored : fallback;
    variantSelections[preset.id] = variantSelect.value;
    variantSelect.classList.remove("hidden");
  }

  updateSizeControls(preset);
  updateMultitoneControls(preset);
};

const buildMultitonePalette = (preset) => {
  const settings = getMultitoneSettings(preset);
  if (!settings) return [];
  const hexColors = ensureMultitoneSelection(preset.id).slice(0, settings.colors);
  if (!hexColors.length) return [];
  return hexColors.map(hexToRgb);
};

const handleMultitoneColorCountInput = () => {
  const preset = getCurrentPalettePreset();
  if (!preset || preset.kind !== "multitone") return;
  const nextValue = clampToBounds(multitoneColorCountRange.value, MULTITONE_COLOR_LIMITS);
  const settings = getMultitoneSettings(preset);
  settings.colors = nextValue;
  multitoneColorCountValue.textContent = nextValue;
  updateMultitoneControls(preset);
};

const handleMultitoneStepsInput = () => {
  const preset = getCurrentPalettePreset();
  if (!preset || preset.kind !== "multitone") return;
  const nextValue = clampToBounds(multitoneStepsRange.value, MULTITONE_STEP_LIMITS);
  const settings = getMultitoneSettings(preset);
  settings.steps = nextValue;
  multitoneStepsValue.textContent = nextValue;
};

const readFile = (file) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => loadImage(reader.result);
  reader.readAsDataURL(file);
};

const loadImage = (src) => {
  const img = new Image();
  img.onload = () => {
    originalCanvas.width = img.width;
    originalCanvas.height = img.height;
    originalCtx.clearRect(0, 0, img.width, img.height);
    originalCtx.drawImage(img, 0, 0);
    hasImage = true;
    setStatus(`Image loaded (${img.width}×${img.height}). Applying dithering...`);
    applyDithering();
  };
  img.onerror = () => setStatus("Failed to load that image. Try another?");
  img.src = src;
};

const resolvePalette = (preset, imageData) => {
  if (!preset) return createFallbackPalette();

  if (preset.kind === "adaptive") {
    const size = paletteSizeSelections[preset.id] ?? clampSizeForPreset(preset.size, preset);
    return generateAdaptivePalette(imageData, size);
  }

  if (preset.kind === "grayscale") {
    const size = paletteSizeSelections[preset.id] ?? clampSizeForPreset(preset.size, preset);
    return createGrayscalePalette(size);
  }

  if (preset.kind === "multitone") {
    const palette = buildMultitonePalette(preset);
    return palette.length ? palette : createFallbackPalette();
  }

  if (preset.variants?.length) {
    const variantId = variantSelections[preset.id] ?? preset.variants[0].id;
    const variant = preset.variants.find((entry) => entry.id === variantId) ?? preset.variants[0];
    return variant.colors;
  }

  return preset.colors;
};

const createFallbackPalette = () => {
  const steps = 4;
  return Array.from({ length: steps }, (_, index) => {
    const value = Math.round((index / (steps - 1)) * 255);
    return [value, value, value];
  });
};

const computeResizeDimensions = (width, height) => {
  const value = resizeSelect.value;
  if (value === "original") {
    return { width, height };
  }
  const targetWidth = parseInt(value, 10);
  if (!targetWidth || targetWidth >= width) {
    return { width, height };
  }
  const aspect = height / width;
  return { width: targetWidth, height: Math.round(targetWidth * aspect) };
};

const applyDithering = () => {
  if (!hasImage) {
    setStatus("Load an image before dithering.");
    return;
  }

  const preset = getCurrentPalettePreset();
  const { width, height } = computeResizeDimensions(originalCanvas.width, originalCanvas.height);
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.drawImage(originalCanvas, 0, 0, width, height);

  let imageData = tempCtx.getImageData(0, 0, width, height);
  const palette = resolvePalette(preset, imageData);
  if (!palette || !palette.length) {
    setStatus("Palette could not be generated.");
    return;
  }

  const paletteKind = preset?.kind ?? "fixed";
  const multitoneSettingsForJob = paletteKind === "multitone" ? getMultitoneSettings(preset) : null;
  const multitoneConfig = paletteKind === "multitone" && palette.length >= 2
    ? {
        inks: palette,
        steps: multitoneSettingsForJob?.steps ?? MULTITONE_STEP_LIMITS.min,
        paper: DEFAULT_PAPER_COLOR,
      }
    : null;

  jobCounter += 1;
  const jobId = jobCounter;
  setStatus("Dithering...");
  downloadButton.setAttribute("disabled", "true");

  worker.postMessage(
    {
      jobId,
      imageData,
      ditherMethod: methodSelect.value,
      palette,
      paletteId: palettePresetSelect.value,
      threshold: Number(thresholdRange.value),
      paletteKind,
      multitoneConfig,
    },
    [imageData.data.buffer]
  );
};

const handleDropZoneClick = () => fileInput.click();
const preventDefaults = (event) => {
  event.preventDefault();
  event.stopPropagation();
};

const handleDragOver = (event) => {
  preventDefaults(event);
  dropZone.classList.add("dragging");
};

const handleDragLeave = (event) => {
  preventDefaults(event);
  dropZone.classList.remove("dragging");
};

const handleDrop = (event) => {
  preventDefaults(event);
  dropZone.classList.remove("dragging");
  const file = event.dataTransfer?.files?.[0];
  if (file && file.type.startsWith("image/")) {
    readFile(file);
  } else {
    setStatus("Drop a valid image file.");
  }
};

fileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  readFile(file);
});

dropZone.addEventListener("click", handleDropZoneClick);
["dragenter", "dragover"].forEach((type) => dropZone.addEventListener(type, handleDragOver));
["dragleave", "dragend"].forEach((type) => dropZone.addEventListener(type, handleDragLeave));
dropZone.addEventListener("drop", handleDrop);

dropZone.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "Enter") {
    event.preventDefault();
    handleDropZoneClick();
  }
});

methodSelect.addEventListener("change", () => {
  toggleThresholdGroup();
  applyDithering();
});

resizeSelect.addEventListener("change", () => applyDithering());
thresholdRange.addEventListener("input", () => {
  thresholdValue.textContent = thresholdRange.value;
});
thresholdRange.addEventListener("change", () => applyDithering());

paletteGroupSelect.addEventListener("change", () => {
  populatePalettePresetSelect();
  updateVariantOptions();
  applyDithering();
});

palettePresetSelect.addEventListener("change", () => {
  paletteSelections[paletteGroupSelect.value] = palettePresetSelect.value;
  updateVariantOptions();
  applyDithering();
});

variantSelect.addEventListener("change", (event) => {
  const preset = getCurrentPalettePreset();
  if (!preset) return;
  variantSelections[preset.id] = event.target.value;
  updateMultitoneControls(preset);
  applyDithering();
});

adaptiveRange.addEventListener("input", () => {
  const preset = getCurrentPalettePreset();
  if (!supportsSizeSlider(preset)) {
    return;
  }
  const value = clampSizeForPreset(adaptiveRange.value, preset);
  adaptiveRange.value = value;
  adaptiveValue.textContent = value;
  paletteSizeSelections[preset.id] = value;
});

adaptiveRange.addEventListener("change", () => {
  if (supportsSizeSlider(getCurrentPalettePreset())) {
    applyDithering();
  }
});

multitoneColorCountRange.addEventListener("input", handleMultitoneColorCountInput);
multitoneColorCountRange.addEventListener("change", () => {
  if (getCurrentPalettePreset()?.kind === "multitone") {
    applyDithering();
  }
});

multitoneStepsRange.addEventListener("input", () => {
  handleMultitoneStepsInput();
});
multitoneStepsRange.addEventListener("change", () => {
  if (getCurrentPalettePreset()?.kind === "multitone") {
    applyDithering();
  }
});

populateMethodSelect();
populatePaletteGroupSelect();
populatePalettePresetSelect();
updateVariantOptions();
toggleThresholdGroup();
thresholdValue.textContent = thresholdRange.value;
adaptiveValue.textContent = adaptiveRange.value;
setStatus("Load an image to begin.");
