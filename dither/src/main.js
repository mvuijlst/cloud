import {
  PALETTE_GROUP_LABELS,
  PALETTE_LOOKUP,
  PALETTE_PRESETS,
  generateAdaptivePalette,
} from "./palettes.js";

const methodOptions = [
  { value: "floyd-steinberg", label: "Floyd–Steinberg" },
  { value: "bayer", label: "Bayer (ordered)" },
  { value: "atkinson", label: "Atkinson" },
  { value: "stucki", label: "Stucki" },
  { value: "gradient", label: "Gradient-based" },
  { value: "lattice", label: "Lattice-Boltzmann" },
];

const defaultPaletteId = "grayscale-8";

const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const methodSelect = document.getElementById("methodSelect");
const resizeSelect = document.getElementById("resizeSelect");
const paletteSelect = document.getElementById("paletteSelect");
const variantSelect = document.getElementById("variantSelect");
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
  statusText.textContent = `Done: ${ditheredImageData.width}×${ditheredImageData.height} (${paletteSelect.options[paletteSelect.selectedIndex]?.text ?? "custom"})`;
});

const setStatus = (message) => {
  statusText.textContent = message;
};

const populateMethodSelect = () => {
  methodOptions.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.textContent = option.label;
    methodSelect.append(opt);
  });
  methodSelect.value = methodOptions[0].value;
};

const populatePaletteSelect = () => {
  ["core", "retro", "tiny"].forEach((groupKey) => {
    const group = document.createElement("optgroup");
    group.label = PALETTE_GROUP_LABELS[groupKey];
    PALETTE_PRESETS.filter((preset) => preset.group === groupKey).forEach((preset) => {
      const opt = document.createElement("option");
      opt.value = preset.id;
      opt.textContent = preset.label;
      group.append(opt);
    });
    paletteSelect.append(group);
  });
  paletteSelect.value = defaultPaletteId;
};

const toggleThresholdGroup = () => {
  if (methodSelect.value === "bayer") {
    thresholdGroup.classList.remove("hidden");
  } else {
    thresholdGroup.classList.add("hidden");
  }
};

const updateVariantOptions = () => {
  const preset = PALETTE_LOOKUP[paletteSelect.value];
  const variants = preset?.variants ?? [];
  variantSelect.innerHTML = "";

  if (!variants.length) {
    variantSelect.classList.add("hidden");
    return;
  }

  variants.forEach((variant) => {
    const opt = document.createElement("option");
    opt.value = variant.id;
    opt.textContent = variant.label;
    variantSelect.append(opt);
  });

  const stored = variantSelections[paletteSelect.value];
  const fallback = variants[0].id;
  variantSelect.value = stored && variants.some((v) => v.id === stored) ? stored : fallback;
  variantSelections[paletteSelect.value] = variantSelect.value;
  variantSelect.classList.remove("hidden");
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

const resolvePalette = (imageData) => {
  const preset = PALETTE_LOOKUP[paletteSelect.value];
  if (!preset) return createFallbackPalette();

  if (preset.kind === "adaptive") {
    return generateAdaptivePalette(imageData, preset.size);
  }

  if (preset.variants?.length) {
    const variantId = variantSelections[paletteSelect.value] ?? preset.variants[0].id;
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

  const { width, height } = computeResizeDimensions(originalCanvas.width, originalCanvas.height);
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.drawImage(originalCanvas, 0, 0, width, height);

  let imageData = tempCtx.getImageData(0, 0, width, height);
  const palette = resolvePalette(imageData);
  if (!palette || !palette.length) {
    setStatus("Palette could not be generated.");
    return;
  }

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
      paletteId: paletteSelect.value,
      threshold: Number(thresholdRange.value),
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

paletteSelect.addEventListener("change", () => {
  updateVariantOptions();
  applyDithering();
});

variantSelect.addEventListener("change", (event) => {
  variantSelections[paletteSelect.value] = event.target.value;
  applyDithering();
});

populateMethodSelect();
populatePaletteSelect();
updateVariantOptions();
toggleThresholdGroup();
thresholdValue.textContent = thresholdRange.value;
setStatus("Load an image to begin.");
