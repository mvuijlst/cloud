// Headless Chrome screenshot via the DevTools protocol.
// node shot.mjs <url> <out.png> [width height dpr] [--wait=<js condition>] [--eval=<js>] [--timeout=s] [--clip=x,y,w,h]
//   [--drag=x0,y0,x1,y1[,button]] [--wheel=x,y,deltaY] [--click=x,y[;x,y...]] [--mobile=1]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const i = a.indexOf('='); return [a.slice(2, i), a.slice(i + 1)]; }));
const pos = args.filter(a => !a.startsWith('--'));
const [url, out, W = '1600', H = '900', DPR = '1'] = pos;
const port = 9333 + Math.floor(Math.random() * 400);
const prof = join(tmpdir(), 'douat-floor-shot-profile');
mkdirSync(prof, { recursive: true });
const chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`,
  '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let list;
for (let i = 0; i < 60; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.length) break; } catch {} await sleep(250); }
const page = list.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const waiting = new Map();
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  else if (m.method === 'Runtime.consoleAPICalled') console.log('[console]', m.params.type, m.params.args.map(a => a.value ?? a.description).join(' '));
  else if (m.method === 'Runtime.exceptionThrown') console.log('[exception]', m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJS = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description; };
await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: +DPR, mobile: 'mobile' in flags });
if ('mobile' in flags) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
const t0 = Date.now();
await send('Page.navigate', { url });
const timeout = (+flags.timeout || 90) * 1000;
const cond = flags.wait || "window.douat && douat.renderer.pending === 0 && douat.renderer.fade >= 1";
let ok = false;
while (Date.now() - t0 < timeout) { await sleep(400); try { if (await evalJS(`(()=>{try{return !!(${cond})}catch(e){return false}})()`) === true) { ok = true; break; } } catch {} }
console.log(ok ? `ready after ${((Date.now() - t0) / 1000).toFixed(1)} s` : 'timed out waiting');
console.log('gpu:', await evalJS(`(()=>{const g=document.createElement('canvas').getContext('webgl2');const e=g&&g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'?'})()`));
// --drag=x0,y0,x1,y1[,button] and --wheel=x,y,deltaY act on the page like a mouse
if (flags.drag) {
  const [x0, y0, x1, y1, b = 0] = flags.drag.split(',').map(Number);
  const button = b === 2 ? 'right' : 'left';
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button, buttons: b === 2 ? 2 : 1, clickCount: 1 });
  for (let i = 1; i <= 12; i++) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * i / 12, y: y0 + (y1 - y0) * i / 12, button, buttons: b === 2 ? 2 : 1 });
    await sleep(16);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button, buttons: 0, clickCount: 1 });
  await sleep(200);
}
// --click=x,y presses and releases the left button there
if (flags.click) {
  for (const xy of flags.click.split(';')) {
    const [x, y] = xy.split(',').map(Number);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(250);
  }
}
if (flags.wheel) {
  const [x, y, d] = flags.wheel.split(',').map(Number);
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: d });
  await sleep(200);
}
if (flags.eval) console.log('eval:', JSON.stringify(await evalJS(flags.eval)));
await sleep(300);
const shotParams = { format: 'png' };
if (flags.clip) { const [x, y, w, h] = flags.clip.split(',').map(Number); shotParams.clip = { x, y, width: w, height: h, scale: 1 }; }
const s = await send('Page.captureScreenshot', shotParams);
writeFileSync(out, Buffer.from(s.result.data, 'base64'));
console.log('wrote', out);
await send('Browser.close').catch(() => {});
ws.close(); chrome.kill();
process.exit(0);
