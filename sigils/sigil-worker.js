/* Makes seals off the page's main thread.

   For the seal page, in: { seed, R }. Out, in order:
     { type: 'name', name }
     { type: 'seal', enc, layout }          enc carries its construction trace and novelty result
     { type: 'plate', width, height, data } RGBA, white ink on black (buffer transferred)
   or { type: 'plate-on-page' } when this worker cannot draw the lettering
   (no OffscreenCanvas), so the page renders the plate itself.

   For the batch page, in: { mode: 'png', id, seed, R, ink }. Out:
     { type: 'png', id, seed, name, family, blob }   ink 'black' (on white) or 'white' (on black)
   or { type: 'error', id, seed, message, noCanvas } */
importScripts('sigil-data.js', 'generator.js', 'plate.js');

function canLetter() {
  try {
    const ctx = new OffscreenCanvas(8, 8).getContext('2d');
    return !!(ctx && ctx.fillText);
  } catch (e) {
    return false;
  }
}

async function pngJob({ id, seed, R, ink }) {
  if (!canLetter()) { postMessage({ type: 'error', id, seed, message: 'no OffscreenCanvas in workers', noCanvas: true }); return; }
  try {
    const name = Sigils.nameForSeed(seed), enc = Sigils.sealForSeed(seed);
    const img = Sigils.renderPlate(enc, name, seed, { R });
    if (ink === 'black') {   // as printed: black ink on white
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
    }
    const cv = new OffscreenCanvas(img.width, img.height);
    cv.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
    const blob = await cv.convertToBlob({ type: 'image/png' });
    postMessage({ type: 'png', id, seed, name, family: enc.family, blob });
  } catch (e) {
    postMessage({ type: 'error', id, seed, message: String(e && e.message || e) });
  }
}

onmessage = ({ data }) => {
  if (data.mode === 'png') { pngJob(data); return; }
  const { seed, R } = data;
  const name = Sigils.nameForSeed(seed);
  postMessage({ type: 'name', name });
  const enc = Sigils.sealForSeed(seed, { trace: true });
  const layout = Sigils.plateLayout(enc, name, R);
  postMessage({ type: 'seal', enc, layout });
  if (!canLetter()) { postMessage({ type: 'plate-on-page' }); return; }
  const img = Sigils.renderPlate(enc, name, seed, { R });
  postMessage({ type: 'plate', width: img.width, height: img.height, data: img.data }, [img.data.buffer]);
};
