import {
  floydSteinberg,
  bayerDithering,
  atkinsonDithering,
  stuckiDithering,
  gradientBasedDithering,
  latticeBoltzmannDithering,
  applyZxSpectrumAttributes,
} from "./dither.js";

const methodMap = {
  "floyd-steinberg": floydSteinberg,
  bayer: bayerDithering,
  atkinson: atkinsonDithering,
  stucki: stuckiDithering,
  gradient: gradientBasedDithering,
  lattice: latticeBoltzmannDithering,
};

self.addEventListener("message", (event) => {
  const { imageData, ditherMethod, palette, paletteId, threshold, jobId } = event.data;
  const method = methodMap[ditherMethod] ?? floydSteinberg;
  let result = method(imageData, palette, threshold);

  if (paletteId === "zx-spectrum") {
    result = applyZxSpectrumAttributes(result);
  }

  self.postMessage({ jobId, ditheredImageData: result }, [result.data.buffer]);
});
