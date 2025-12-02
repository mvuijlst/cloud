import {
  PALETTE_GROUP_LABELS,
  PALETTE_LOOKUP,
  PALETTE_PRESETS,
  MULTITONE_DEFAULTS,
  createGrayscalePalette,
  generateAdaptivePalette,
} from "./palettes.js";

const methodOptions = [
  { value: "bayer", label: "Bayer (ordered)" },
  { value: "blue-noise", label: "Blue-noise mask" },
  { value: "atkinson", label: "Atkinson" },
  { value: "knoll", label: "Knoll" },
  { value: "floyd-steinberg", label: "Floyd–Steinberg" },
  { value: "riemersma", label: "Riemersma" },
  { value: "dot-diffusion", label: "SOT / dot diffusion" },
  { value: "sierra", label: "Sierra" },
  { value: "stucki", label: "Stucki" },
  { value: "jjn", label: "Jarvis–Judice–Ninke" },
  { value: "stevenson-arce", label: "Stevenson–Arce" },
  { value: "gradient", label: "Gradient-based" },
  { value: "lattice", label: "Lattice-Boltzmann" },
];

const DEFAULT_PAPER_COLOR = [255, 255, 255];

const defaultPaletteId = "rgb-3bit";
const DEFAULT_METHOD = "gradient";
const STORAGE_KEY = "dither.preferences";
const FALLBACK_RESIZE_OPTION = "256";

const loadPreferences = () => {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Failed to load stored preferences", error);
    return null;
  }
};

const cloneDeep = (value) => {
  if (!value || typeof value !== "object") {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return value;
  }
};

const SAMPLE_IMAGES = [
  "./images/20250309_182228.jpg",
  "./images/20250406_135239.jpg",
  "./images/20251108_160623.jpg",
  "./images/familie.png",
  "./images/mroelandt.jpg",
];

let initialPaletteGroup = null;
let initialPalettePreset = null;
let initialMethodValue = DEFAULT_METHOD;
let initialResizeOption = FALLBACK_RESIZE_OPTION;
let initialThresholdValue = null;
let initialLevelsVisible = false;
let storedPreferences = null;

const fileInput = document.getElementById("fileInput");
const methodSelect = document.getElementById("methodSelect");
const resizeOptions = Array.from(document.querySelectorAll("input[name='resizeOption']"));
const initialResizeRadio = resizeOptions.find((input) => input.value === initialResizeOption);
if (initialResizeRadio) {
  initialResizeRadio.checked = true;
} else {
  const fallbackResizeRadio = resizeOptions.find((input) => input.value === FALLBACK_RESIZE_OPTION);
  if (fallbackResizeRadio) {
    fallbackResizeRadio.checked = true;
  }
}
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
if (initialThresholdValue !== null && thresholdRange) {
  thresholdRange.value = String(initialThresholdValue);
}
const statusText = document.getElementById("statusText");
const downloadButton = document.getElementById("downloadButton");
const originalCanvas = document.getElementById("originalCanvas");
const ditheredCanvas = document.getElementById("ditheredCanvas");
const originalCanvasPanel = document.getElementById("originalCanvasPanel");
const multitoneRampList = document.getElementById("multitoneRampList");
const multitonePresetContainer = document.getElementById("multitonePresetContainer");
const multitonePresetTextarea = document.getElementById("multitonePresetJson");
const levelBlackRange = document.getElementById("levelBlack");
const levelWhiteRange = document.getElementById("levelWhite");
const levelGrayRange = document.getElementById("levelGray");
const levelBlackValue = document.getElementById("levelBlackValue");
const levelWhiteValue = document.getElementById("levelWhiteValue");
const levelGrayValue = document.getElementById("levelGrayValue");
const resetLevelsButton = document.getElementById("resetLevelsButton");
const showLevelsButton = document.getElementById("showLevelsButton");
const levelsControls = document.getElementById("levelsControls");

const savePreferences = () => {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    const payload = {
      method: methodSelect.value,
      paletteGroup: paletteGroupSelect.value,
      palettePreset: palettePresetSelect.value,
      paletteSelections: { ...paletteSelections },
      variantSelections: { ...variantSelections },
      paletteSizeSelections: { ...paletteSizeSelections },
      multitoneColorSelections: cloneDeep(multitoneColorSelections) || {},
      multitoneSettings: cloneDeep(multitoneSettings) || {},
      selectedMultitonePresetId,
      resizeOption: getResizeSelection(),
      threshold: Number(thresholdRange.value),
      levels: { ...levelsSettings },
      levelsVisible: Boolean(levelsControls && !levelsControls.classList.contains("hidden")),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to save preferences", error);
  }
};

const originalCtx = originalCanvas.getContext("2d");
const ditheredCtx = ditheredCanvas.getContext("2d");

let hasImage = false;
let jobCounter = 0;
const variantSelections = {};
const paletteSelections = {};
const paletteSizeSelections = {};
const multitoneColorSelections = {};
const multitoneSettings = {};
let multitoneRampPresets = [];
let multitoneRampLoadState = "idle";
let selectedMultitonePresetId = null;
let pendingAutoSelectColorCount = null;
const MULTITONE_COLOR_LIMITS = { min: 2, max: 4 };
const MULTITONE_STEP_LIMITS = { min: 1, max: 4 };
const MULTITONE_PRESET_ID = "multitone";
const DEFAULT_MULTITONE_COLORS = MULTITONE_DEFAULTS?.quadtone ?? ["#050505", "#5E5234", "#B58E44", "#F8DB7B"];
const defaultPaletteGroup = PALETTE_LOOKUP[defaultPaletteId]?.group ?? "core";
const LEVEL_DEFAULTS = { black: 0, white: 255, gray: 1 };
const levelsSettings = { ...LEVEL_DEFAULTS };
storedPreferences = loadPreferences();

if (storedPreferences?.paletteSelections) {
  Object.assign(paletteSelections, storedPreferences.paletteSelections);
}
if (storedPreferences?.variantSelections) {
  Object.assign(variantSelections, storedPreferences.variantSelections);
}
if (storedPreferences?.paletteSizeSelections) {
  Object.assign(paletteSizeSelections, storedPreferences.paletteSizeSelections);
}
if (storedPreferences?.multitoneColorSelections) {
  Object.assign(multitoneColorSelections, storedPreferences.multitoneColorSelections);
}
if (storedPreferences?.multitoneSettings) {
  Object.assign(multitoneSettings, storedPreferences.multitoneSettings);
}
if (storedPreferences?.levels) {
  Object.assign(levelsSettings, storedPreferences.levels);
}
if (typeof storedPreferences?.selectedMultitonePresetId !== "undefined") {
  selectedMultitonePresetId = storedPreferences.selectedMultitonePresetId;
}

const clampLevelsState = () => {
  levelsSettings.black = Math.max(0, Math.min(levelsSettings.black, 254));
  levelsSettings.white = Math.max(levelsSettings.black + 1, Math.min(255, levelsSettings.white));
  levelsSettings.gray = Math.max(0.1, Math.min(3, levelsSettings.gray));
};

clampLevelsState();

initialPaletteGroup = storedPreferences?.paletteGroup;
initialPalettePreset = storedPreferences?.palettePreset;

if (initialPalettePreset && PALETTE_LOOKUP[initialPalettePreset]) {
  initialPaletteGroup = PALETTE_LOOKUP[initialPalettePreset].group;
}

if (!initialPaletteGroup || !PALETTE_GROUP_LABELS[initialPaletteGroup]) {
  initialPaletteGroup = defaultPaletteGroup;
}

if (!initialPalettePreset || PALETTE_LOOKUP[initialPalettePreset]?.group !== initialPaletteGroup) {
  if (initialPaletteGroup === defaultPaletteGroup) {
    initialPalettePreset = defaultPaletteId;
  } else {
    const fallbackPreset = PALETTE_PRESETS.find((preset) => preset.group === initialPaletteGroup);
    initialPalettePreset = fallbackPreset?.id ?? defaultPaletteId;
  }
}

paletteSelections[initialPaletteGroup] = initialPalettePreset;

initialMethodValue = storedPreferences?.method ?? DEFAULT_METHOD;
initialResizeOption = storedPreferences?.resizeOption ?? FALLBACK_RESIZE_OPTION;
initialThresholdValue = typeof storedPreferences?.threshold === "number" ? storedPreferences.threshold : null;
initialLevelsVisible = Boolean(storedPreferences?.levelsVisible);

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
  //statusText.textContent = `Done: ${ditheredImageData.width}×${ditheredImageData.height} (${getCurrentPaletteLabel()})`;
});

const setStatus = (message) => {
  // statusText.textContent = message;
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

const updateLevelsDisplay = () => {
  if (!levelBlackValue || !levelWhiteValue || !levelGrayValue) return;
  levelBlackValue.textContent = levelsSettings.black;
  levelWhiteValue.textContent = levelsSettings.white;
  levelGrayValue.textContent = levelsSettings.gray.toFixed(2);
};

const syncLevelInputs = () => {
  if (levelBlackRange) levelBlackRange.value = String(levelsSettings.black);
  if (levelWhiteRange) levelWhiteRange.value = String(levelsSettings.white);
  if (levelGrayRange) levelGrayRange.value = String(levelsSettings.gray);
  updateLevelsDisplay();
};

const resetLevelsToDefaults = ({ silent = false } = {}) => {
  Object.assign(levelsSettings, LEVEL_DEFAULTS);
  syncLevelInputs();
  if (!silent) {
    savePreferences();
  }
};

const setLevelsVisibility = (isVisible, { silent = false } = {}) => {
  if (!levelsControls || !showLevelsButton) {
    return;
  }
  if (isVisible) {
    levelsControls.classList.remove("hidden");
    showLevelsButton.classList.add("hidden");
  } else {
    levelsControls.classList.add("hidden");
    showLevelsButton.classList.remove("hidden");
  }
  if (!silent) {
    savePreferences();
  }
};

const hideLevelsControls = (options) => setLevelsVisibility(false, options);
const showLevelsControls = (options) => setLevelsVisibility(true, options);

const getResizeSelection = () => {
  const selected = resizeOptions.find((input) => input.checked);
  return selected?.value ?? "original";
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

const markCustomMultitoneSelection = () => {
  selectedMultitonePresetId = null;
  renderMultitoneRampList();
};

const loadMultitoneRampPresets = async () => {
  if (multitoneRampPresets.length || multitoneRampLoadState === "loading") {
    return multitoneRampPresets;
  }
  multitoneRampLoadState = "loading";
  try {
    const response = await fetch(new URL("../ramps.json", import.meta.url));
    if (!response.ok) {
      throw new Error(`Failed to load ramps (${response.status})`);
    }
    const data = await response.json();
    multitoneRampPresets = (Array.isArray(data) ? data : []).map((entry, index) => ({
      id: entry.id ?? `ramp-${index + 1}`,
      colors: clampToBounds(entry.colors ?? entry.inks?.length ?? 2, MULTITONE_COLOR_LIMITS),
      steps: clampToBounds(entry.steps ?? 1, MULTITONE_STEP_LIMITS),
      inks: (entry.inks ?? []).map((hex) => hex.toUpperCase()),
      label: entry.name ?? `Ramp ${String(index + 1).padStart(2, "0")}`,
    }));
    multitoneRampLoadState = "ready";
  } catch (error) {
    console.error(error);
    multitoneRampLoadState = "error";
  }
  renderMultitoneRampList();
  if (pendingAutoSelectColorCount !== null) {
    tryAutoSelectPresetForColorCount(pendingAutoSelectColorCount);
  }
  return multitoneRampPresets;
};

const renderMultitoneRampList = () => {
  if (!multitoneRampList) return;
  multitoneRampList.innerHTML = "";
  if (multitoneRampLoadState === "loading") {
    const status = document.createElement("p");
    status.className = "ramp-status";
    status.textContent = "Loading ramps...";
    multitoneRampList.append(status);
    return;
  }
  if (multitoneRampLoadState === "error") {
    const status = document.createElement("p");
    status.className = "ramp-status";
    status.textContent = "Failed to load ramps.json";
    multitoneRampList.append(status);
    return;
  }
  if (!multitoneRampPresets.length) {
    const status = document.createElement("p");
    status.className = "ramp-status";
    status.textContent = "No ramps found.";
    multitoneRampList.append(status);
    return;
  }
  const targetColors = clampToBounds(multitoneColorCountRange?.value ?? MULTITONE_COLOR_LIMITS.min, MULTITONE_COLOR_LIMITS);
  const filteredPresets = multitoneRampPresets.filter((preset) => preset.colors === targetColors);
  if (!filteredPresets.length) {
    const status = document.createElement("p");
    status.className = "ramp-status";
    status.textContent = `No ${targetColors}-colour ramps found.`;
    multitoneRampList.append(status);
    return;
  }
  filteredPresets.forEach((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `ramp-option${preset.id === selectedMultitonePresetId ? " selected" : ""}`;
    button.setAttribute("aria-label", `${preset.label} (${preset.colors} colors, ${preset.steps} steps)`);

    const swatches = document.createElement("div");
    swatches.className = "ramp-swatches";
    swatches.setAttribute("aria-hidden", "true");
    preset.inks.slice(0, MULTITONE_COLOR_LIMITS.max).forEach((hex) => {
      const swatch = document.createElement("span");
      swatch.className = "ramp-color";
      swatch.style.background = hex;
      swatches.append(swatch);
    });

    button.title = preset.label;
    button.addEventListener("click", () => applyMultitoneRampPreset(preset));
    button.append(swatches);
    multitoneRampList.append(button);
  });
};

const tryAutoSelectPresetForColorCount = (colorCount) => {
  const target = clampToBounds(colorCount, MULTITONE_COLOR_LIMITS);
  if (!multitoneRampPresets.length) {
    pendingAutoSelectColorCount = target;
    return true;
  }
  const preset = multitoneRampPresets.find((entry) => entry.colors === target);
  if (!preset) {
    return false;
  }
  pendingAutoSelectColorCount = null;
  applyMultitoneRampPreset(preset);
  return true;
};

const ensureMultitoneRampsAvailable = async () => {
  if (!multitoneRampList) return;
  if (!multitoneRampPresets.length && multitoneRampLoadState !== "loading") {
    await loadMultitoneRampPresets();
  } else {
    renderMultitoneRampList();
  }
};

const applyMultitoneRampPreset = (preset) => {
  const basePreset = PALETTE_LOOKUP[MULTITONE_PRESET_ID];
  if (!basePreset) return;
  const settings = getMultitoneSettings(basePreset);
  settings.colors = clampToBounds(preset.colors, MULTITONE_COLOR_LIMITS);
  settings.steps = clampToBounds(preset.steps, MULTITONE_STEP_LIMITS);
  multitoneColorSelections[basePreset.id] = [...preset.inks].slice(0, MULTITONE_COLOR_LIMITS.max);
  ensureMultitoneSelection(basePreset.id);
  selectedMultitonePresetId = preset.id;
  renderMultitoneRampList();
  updateMultitoneControls(basePreset);
  applyDithering();
  savePreferences();
};

const applyLevelsAdjustment = (imageData) => {
  if (!imageData || !imageData.data) return imageData;
  clampLevelsState();
  const black = levelsSettings.black;
  const white = levelsSettings.white;
  const gamma = levelsSettings.gray;
  const invGamma = 1 / gamma;
  const range = Math.max(1, white - black);
  const lookup = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) {
    let normalized = (i - black) / range;
    normalized = Math.max(0, Math.min(1, normalized));
    normalized = Math.pow(normalized, invGamma);
    lookup[i] = Math.round(normalized * 255);
  }
  const { data } = imageData;
  for (let index = 0; index < data.length; index += 4) {
    data[index] = lookup[data[index]];
    data[index + 1] = lookup[data[index + 1]];
    data[index + 2] = lookup[data[index + 2]];
  }
  return imageData;
};

const updateMultitonePresetPreview = (preset) => {
  if (!multitonePresetContainer || !multitonePresetTextarea) return;
  if (!preset || preset.kind !== "multitone") {
    multitonePresetTextarea.value = "Select the Multitone preset to copy its settings.";
    multitonePresetContainer.classList.add("hidden");
    return;
  }
  const settings = getMultitoneSettings(preset);
  if (!settings) {
    multitonePresetContainer.classList.add("hidden");
    return;
  }
  const inks = ensureMultitoneSelection(preset.id).slice(0, settings.colors);
  const payload = {
    colors: settings.colors,
    steps: settings.steps,
    inks,
  };
  multitonePresetTextarea.value = JSON.stringify(payload, null, 2);
  multitonePresetContainer.classList.remove("hidden");
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
  const fallbackMethod = methodOptions[0]?.value;
  const resolvedMethod = methodOptions.some((option) => option.value === initialMethodValue)
    ? initialMethodValue
    : fallbackMethod;
  methodSelect.value = resolvedMethod || fallbackMethod;
};

const populatePaletteGroupSelect = () => {
  paletteGroupSelect.innerHTML = "";
  Object.entries(PALETTE_GROUP_LABELS).forEach(([key, label]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = label;
    paletteGroupSelect.append(opt);
  });
  paletteGroupSelect.value = initialPaletteGroup || defaultPaletteGroup;
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
    updateMultitonePresetPreview(null);
    return;
  }

  const settings = getMultitoneSettings(preset);
  if (!settings) {
    multitoneGroup.classList.add("hidden");
    multitonePickers.innerHTML = "";
    updateMultitonePresetPreview(null);
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
      markCustomMultitoneSelection();
      updateMultitonePresetPreview(preset);
      applyDithering();
      savePreferences();
    });

    wrapper.append(input);
    multitonePickers.append(wrapper);
  });

  multitoneGroup.classList.remove("hidden");
  updateMultitonePresetPreview(preset);
};

const updateVariantOptions = () => {
  const preset = getCurrentPalettePreset();
  if (!preset) {
    variantSelect.classList.add("hidden");
    variantSelect.innerHTML = "";
    updateSizeControls(null);
    updateMultitoneControls(null);
    toggleMultitoneRampList(null);
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
  toggleMultitoneRampList(preset);
};

const toggleMultitoneRampList = (preset) => {
  if (!multitoneRampList) return;
  const isMultitonePreset = preset?.id === MULTITONE_PRESET_ID;
  if (isMultitonePreset) {
    palettePresetSelect.classList.add("hidden");
    const defaultCount = MULTITONE_COLOR_LIMITS.min;
    multitoneColorCountRange.value = defaultCount;
    multitoneColorCountValue.textContent = defaultCount;
    ensureMultitoneRampsAvailable();
    tryAutoSelectPresetForColorCount(defaultCount);
    multitoneRampList.classList.remove("hidden");
  } else {
    palettePresetSelect.classList.remove("hidden");
    multitoneRampList.classList.add("hidden");
  }
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
  multitoneColorCountRange.value = nextValue;
  multitoneColorCountValue.textContent = nextValue;
  renderMultitoneRampList();
};

const handleMultitoneColorCountChange = () => {
  const preset = getCurrentPalettePreset();
  if (!preset || preset.kind !== "multitone") return;
  const desired = clampToBounds(multitoneColorCountRange.value, MULTITONE_COLOR_LIMITS);
  if (tryAutoSelectPresetForColorCount(desired)) {
    return;
  }
  const settings = getMultitoneSettings(preset);
  settings.colors = desired;
  multitoneColorCountValue.textContent = desired;
  markCustomMultitoneSelection();
  updateMultitoneControls(preset);
  renderMultitoneRampList();
  applyDithering();
  savePreferences();
};

const handleMultitoneStepsInput = () => {
  const preset = getCurrentPalettePreset();
  if (!preset || preset.kind !== "multitone") return;
  const nextValue = clampToBounds(multitoneStepsRange.value, MULTITONE_STEP_LIMITS);
  const settings = getMultitoneSettings(preset);
  settings.steps = nextValue;
  multitoneStepsValue.textContent = nextValue;
  markCustomMultitoneSelection();
  updateMultitonePresetPreview(preset);
  savePreferences();
};

const handleLevelChange = (type, rawValue) => {
  if (type === "black") {
    const candidate = Number(rawValue);
    const safeValue = Number.isNaN(candidate) ? levelsSettings.black : candidate;
    const next = Math.min(safeValue, levelsSettings.white - 1);
    levelsSettings.black = Math.max(0, next);
  } else if (type === "white") {
    const candidate = Number(rawValue);
    const safeValue = Number.isNaN(candidate) ? levelsSettings.white : candidate;
    const next = Math.max(safeValue, levelsSettings.black + 1);
    levelsSettings.white = Math.min(255, next);
  } else if (type === "gray") {
    const candidate = Number(rawValue);
    const safeValue = Number.isNaN(candidate) ? levelsSettings.gray : candidate;
    levelsSettings.gray = Math.max(0.1, Math.min(3, safeValue));
  }
  syncLevelInputs();
  if (hasImage) {
    applyDithering();
  }
  savePreferences();
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

const loadRandomSampleImage = () => {
  if (!SAMPLE_IMAGES.length) return;
  const choice = SAMPLE_IMAGES[Math.floor(Math.random() * SAMPLE_IMAGES.length)];
  setStatus("Loading sample image...");
  loadImage(choice);
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
  const value = getResizeSelection();
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
  applyLevelsAdjustment(imageData);
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

const preventDefaults = (event) => {
  event.preventDefault();
  event.stopPropagation();
};

const handleCanvasClick = () => fileInput.click();

const handleCanvasKey = (event) => {
  if (event.code === "Space" || event.code === "Enter") {
    event.preventDefault();
    fileInput.click();
  }
};

const handleCanvasDragOver = (event) => {
  preventDefaults(event);
  originalCanvasPanel.classList.add("dragging");
};

const handleCanvasDragLeave = (event) => {
  preventDefaults(event);
  if (event.type === "dragend" || !originalCanvasPanel.contains(event.relatedTarget)) {
    originalCanvasPanel.classList.remove("dragging");
  }
};

const handleCanvasDrop = (event) => {
  preventDefaults(event);
  originalCanvasPanel.classList.remove("dragging");
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

originalCanvasPanel.addEventListener("click", handleCanvasClick);
originalCanvasPanel.addEventListener("keydown", handleCanvasKey);
["dragenter", "dragover"].forEach((type) => originalCanvasPanel.addEventListener(type, handleCanvasDragOver));
["dragleave", "dragend"].forEach((type) => originalCanvasPanel.addEventListener(type, handleCanvasDragLeave));
originalCanvasPanel.addEventListener("drop", handleCanvasDrop);

methodSelect.addEventListener("change", () => {
  toggleThresholdGroup();
  applyDithering();
  savePreferences();
});

resizeOptions.forEach((input) => {
  input.addEventListener("change", () => {
    applyDithering();
    savePreferences();
  });
});
thresholdRange.addEventListener("input", () => {
  thresholdValue.textContent = thresholdRange.value;
});
thresholdRange.addEventListener("change", () => {
  applyDithering();
  savePreferences();
});

paletteGroupSelect.addEventListener("change", () => {
  populatePalettePresetSelect();
  updateVariantOptions();
  applyDithering();
  savePreferences();
});

palettePresetSelect.addEventListener("change", () => {
  paletteSelections[paletteGroupSelect.value] = palettePresetSelect.value;
  updateVariantOptions();
  applyDithering();
  savePreferences();
});

variantSelect.addEventListener("change", (event) => {
  const preset = getCurrentPalettePreset();
  if (!preset) return;
  variantSelections[preset.id] = event.target.value;
  updateMultitoneControls(preset);
  applyDithering();
  savePreferences();
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
    savePreferences();
  }
});

multitoneColorCountRange.addEventListener("input", handleMultitoneColorCountInput);
multitoneColorCountRange.addEventListener("change", handleMultitoneColorCountChange);

multitoneStepsRange.addEventListener("input", () => {
  handleMultitoneStepsInput();
});
multitoneStepsRange.addEventListener("change", () => {
  if (getCurrentPalettePreset()?.kind === "multitone") {
    applyDithering();
    savePreferences();
  }
});

if (levelBlackRange) {
  levelBlackRange.addEventListener("input", (event) => handleLevelChange("black", event.target.value));
}
if (levelWhiteRange) {
  levelWhiteRange.addEventListener("input", (event) => handleLevelChange("white", event.target.value));
}
if (levelGrayRange) {
  levelGrayRange.addEventListener("input", (event) => handleLevelChange("gray", event.target.value));
}

if (resetLevelsButton) {
  resetLevelsButton.addEventListener("click", (event) => {
    event.preventDefault();
    resetLevelsToDefaults();
    if (hasImage) {
      applyDithering();
    }
    hideLevelsControls();
  });
}

if (showLevelsButton) {
  showLevelsButton.addEventListener("click", (event) => {
    event.preventDefault();
    showLevelsControls();
    resetLevelsButton?.focus();
  });
}

populateMethodSelect();
populatePaletteGroupSelect();
populatePalettePresetSelect();
updateVariantOptions();
toggleThresholdGroup();
thresholdValue.textContent = thresholdRange.value;
adaptiveValue.textContent = adaptiveRange.value;
if (storedPreferences?.levels) {
  syncLevelInputs();
} else {
  resetLevelsToDefaults({ silent: true });
}
if (initialLevelsVisible) {
  showLevelsControls({ silent: true });
} else {
  hideLevelsControls({ silent: true });
}
setStatus("Load an image to begin.");
loadRandomSampleImage();
savePreferences();
