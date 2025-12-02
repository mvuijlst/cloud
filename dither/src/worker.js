import {
  floydSteinberg,
  bayerDithering,
  atkinsonDithering,
  stuckiDithering,
  jarvisJudiceNinkeDithering,
  knollDithering,
  sierraDithering,
  stevensonArceDithering,
  gradientBasedDithering,
  latticeBoltzmannDithering,
  multitoneHalftone,
  applyZxSpectrumAttributes,
} from "./dither.js";

const methodMap = {
  "floyd-steinberg": floydSteinberg,
  bayer: bayerDithering,
  atkinson: atkinsonDithering,
  stucki: stuckiDithering,
  jjn: jarvisJudiceNinkeDithering,
  knoll: knollDithering,
  sierra: sierraDithering,
  "stevenson-arce": stevensonArceDithering,
  gradient: gradientBasedDithering,
  lattice: latticeBoltzmannDithering,
};

self.addEventListener("message", (event) => {
  const {
    imageData,
    ditherMethod,
    palette,
    paletteId,
    threshold,
    jobId,
    paletteKind,
    multitoneConfig,
  } = event.data;

  const method = methodMap[ditherMethod] ?? floydSteinberg;

  let result;
  if (paletteKind === "multitone" && multitoneConfig?.inks?.length) {
    result = multitoneHalftone(imageData, multitoneConfig, method, threshold);
  } else {
    result = method(imageData, palette, threshold);

    if (paletteId === "zx-spectrum") {
      result = applyZxSpectrumAttributes(result);
    }
  }

  self.postMessage({ jobId, ditheredImageData: result }, [result.data.buffer]);
});
