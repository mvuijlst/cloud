/* Makes a seal off the page's main thread, so the page can show the making.

   In: { seed, R }. Out, in order:
     { type: 'name', name }
     { type: 'seal', enc, layout }          enc carries its construction trace and novelty result
     { type: 'plate', width, height, data } RGBA, white ink on black (buffer transferred)
   or { type: 'plate-on-page' } when this worker cannot draw the lettering
   (no OffscreenCanvas), so the page renders the plate itself. */
importScripts('sigil-data.js', 'generator.js', 'plate.js');

function canLetter() {
  try {
    const ctx = new OffscreenCanvas(8, 8).getContext('2d');
    return !!(ctx && ctx.fillText);
  } catch (e) {
    return false;
  }
}

onmessage = ({ data: { seed, R } }) => {
  const name = Sigils.nameForSeed(seed);
  postMessage({ type: 'name', name });
  const enc = Sigils.sealForSeed(seed, { trace: true });
  const layout = Sigils.plateLayout(enc, name, R);
  postMessage({ type: 'seal', enc, layout });
  if (!canLetter()) { postMessage({ type: 'plate-on-page' }); return; }
  const img = Sigils.renderPlate(enc, name, seed, { R });
  postMessage({ type: 'plate', width: img.width, height: img.height, data: img.data }, [img.data.buffer]);
};
