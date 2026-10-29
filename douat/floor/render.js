import { VS, sceneFS, BLIT_FS, OVERLAY_FS } from './shaders.js';

const T = {
  FLOAT: 0x1406, VEC2: 0x8B50, VEC3: 0x8B51, VEC4: 0x8B52,
  INT: 0x1404, IVEC2: 0x8B53, UINT: 0x1405, BOOL: 0x8B56,
  SAMPLER: 0x8B5E, USAMPLER: 0x8DD2,
};

// Camera above the floor centre looking down, tilted by `tilt` radians towards the top of the screen.
export function makeView(W, H, { pitch, thick, cellsAcross, fovY, tilt }) {
  const tanY = Math.tan(fovY / 2), tanX = tanY * W / H;
  const hc = (cellsAcross * pitch / 2) / tanX;
  const F = [0, -Math.sin(tilt), -Math.cos(tilt)];
  const U = [0, -Math.cos(tilt), Math.sin(tilt)];
  const R = [1, 0, 0];
  const pos = [0, hc * Math.tan(tilt), hc + thick];
  const view = { W, H, tanX, tanY, F, R, U, pos, pitch, thick };
  let hx = 0, hy = 0;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const z of [0, thick]) {
    const p = hitZ(view, rayDir(view, sx, sy), z);
    hx = Math.max(hx, Math.abs(p[0])); hy = Math.max(hy, Math.abs(p[1]));
  }
  view.NX = 2 * Math.ceil(hx / pitch + 0.05);
  view.NY = 2 * Math.ceil(hy / pitch + 0.05);
  view.origin = [-view.NX / 2 * pitch, -view.NY / 2 * pitch];
  view.pxPerMm = W / (2 * tanX * hc);
  view.floorR = Math.hypot(hx, hy);
  return view;
}

function rayDir(v, nx, ny) {
  const d = [0, 1, 2].map(i => v.F[i] + nx * v.tanX * v.R[i] + ny * v.tanY * v.U[i]);
  const l = Math.hypot(...d);
  return d.map(x => x / l);
}
function hitZ(v, d, z) {
  const t = (z - v.pos[2]) / d[2];
  return [v.pos[0] + d[0] * t, v.pos[1] + d[1] * t];
}
export function toScreen(v, x, y, z) {
  const w = [x - v.pos[0], y - v.pos[1], z - v.pos[2]];
  const zc = w[0] * v.F[0] + w[1] * v.F[1] + w[2] * v.F[2];
  const sx = (w[0] * v.R[0] + w[1] * v.R[1] + w[2] * v.R[2]) / (zc * v.tanX);
  const sy = (w[0] * v.U[0] + w[1] * v.U[1] + w[2] * v.U[2]) / (zc * v.tanY);
  return [(sx * 0.5 + 0.5) * v.W, (sy * 0.5 + 0.5) * v.H];
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, depth: false, stencil: false,
      preserveDrawingBuffer: false, powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('This page needs WebGL 2.');
    this.gl = gl;
    this.canvas = canvas;
    // Compile in the background where the browser allows it; the page stays responsive.
    this.par = gl.getExtension('KHR_parallel_shader_compile');
    this.t0 = performance.now();
    this.progs = [this.program(sceneFS(1), 'stones'), this.program(sceneFS(0), 'bed'), this.program(BLIT_FS, 'blit'), this.program(OVERLAY_FS, 'overlay')];
    [this.top, this.bed, this.blit, this.over] = this.progs;
    this.ready = false;
    this.vao = gl.createVertexArray();
    // 512² random bytes: the shader's noise and cell hashes read from it
    const N = 512, bytes = new Uint8Array(N * N * 4);
    let st = 0x9e3779b9;
    for (let i = 0; i < bytes.length; i++) {
      st ^= st << 13; st ^= st >>> 17; st ^= st << 5;
      bytes[i] = st & 255;
    }
    this.rnd = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.rnd);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.queue = [];
    this.urgent = [];
    this.budget = 400000;      // sample-pixels per frame, adapted to the machine
    this.lastFrame = 0;
    this.drewStatic = false;
    this.fade = 0;
    this.lastFade = -1;
    this.active = null;
    this.samples = 4;
    this.stats = { rendered: 0 };
  }

  program(fs, name) {
    const gl = this.gl;
    const mk = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const p = gl.createProgram();
    const vs = mk(gl.VERTEX_SHADER, VS), f = mk(gl.FRAGMENT_SHADER, fs);
    gl.attachShader(p, vs);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    return { p, u: null, name, shaders: [vs, f] };
  }

  // True once every program is linked; throws with the compiler's log on failure.
  poll() {
    if (this.ready) return true;
    const gl = this.gl;
    if (this.par && !this.progs.every(pr => gl.getProgramParameter(pr.p, this.par.COMPLETION_STATUS_KHR))) return false;
    for (const pr of this.progs) {
      if (!gl.getProgramParameter(pr.p, gl.LINK_STATUS)) {
        const logs = pr.shaders.map(s => gl.getShaderInfoLog(s)).filter(Boolean).join('\n');
        throw new Error(`${pr.name} shader: ${logs || gl.getProgramInfoLog(pr.p)}`);
      }
      const u = {};
      const n = gl.getProgramParameter(pr.p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(pr.p, i);
        u[info.name] = { loc: gl.getUniformLocation(pr.p, info.name), type: info.type };
      }
      pr.u = u;
    }
    this.ready = true;
    this.compileMs = performance.now() - this.t0;
    console.log(`shaders ready in ${this.compileMs.toFixed(0)} ms`);
    return true;
  }

  set(prog, values) {
    const gl = this.gl;
    for (const [k, v] of Object.entries(values)) {
      const e = prog.u[k];
      if (!e) continue;
      switch (e.type) {
        case T.FLOAT: gl.uniform1f(e.loc, v); break;
        case T.VEC2: gl.uniform2fv(e.loc, v); break;
        case T.VEC3: gl.uniform3fv(e.loc, v); break;
        case T.VEC4: gl.uniform4fv(e.loc, v); break;
        case T.INT: case T.BOOL: case T.SAMPLER: case T.USAMPLER: gl.uniform1i(e.loc, v); break;
        case T.IVEC2: gl.uniform2iv(e.loc, v); break;
        case T.UINT: gl.uniform1ui(e.loc, v); break;
        default: throw new Error('uniform type ' + e.type);
      }
    }
  }

  target(w, h, linear) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
    const f = linear ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fb };
  }

  // Size in device pixels. Dropping old targets also drops the queue.
  resize(w, h) {
    const gl = this.gl;
    for (const t of [this.stat, this.sprite]) if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }
    this.canvas.width = w; this.canvas.height = h;
    this.W = w; this.H = h;
    this.stat = this.target(w, h, false);
    this.sprite = this.target(w, h, true);
    this.queue = []; this.urgent = [];
  }

  setFloor(floor) {
    const gl = this.gl;
    this.floor = floor;
    const v = floor.view;
    if (this.cells) gl.deleteTexture(this.cells);
    this.cells = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.cells);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, v.NX, v.NY, 0, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, floor.cells);
    const m = floor.material, s = floor.sun;
    const lin = c => c.map(x => Math.pow(x / 255, 2.2));
    this.common = {
      uRes: [this.W, this.H], uCamPos: v.pos, uCamF: v.F, uCamR: v.R, uCamU: v.U, uTan: [v.tanX, v.tanY],
    };
    this.sceneU = {
      ...this.common,
      uPitch: v.pitch, uThick: v.thick, uJoint: m.joint,
      uGrid: [v.NX, v.NY], uOrigin: v.origin, uCells: 0, uSeed: floor.seed >>> 0,
      uDarkAlb: lin(m.dark), uLightAlb: lin(m.light), uBedAlb: lin(m.bed), uFillAlb: lin(m.fill),
      uDarkP: m.darkP, uLightP: m.lightP, uMisc: [m.fillDepth, m.edge, m.grime, m.scratches],
      uSunDir: s.dir, uSunCol: s.col, uSkyCol: s.sky, uSunSoft: s.soft, uExposure: s.exposure,
      uFloorC: [0, 0], uFloorR: v.floorR, uLoop: 1,
    };
    this.queue = []; this.urgent = [];
    this.queueRect(0, 0, this.W, this.H);
    this.active = null;
  }

  // Rewrite one cell of the state texture and schedule the pixels it touches.
  setCell(i, j, rgba, urgent = false) {
    const gl = this.gl, f = this.floor, k = (j * f.view.NX + i) * 4;
    f.cells.set(rgba, k);
    gl.bindTexture(gl.TEXTURE_2D, this.cells);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, i, j, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, f.cells.subarray(k, k + 4));
    const r = this.cellRect(i, j, 40);
    if (r) this.queueRect(...r, urgent);
  }

  // Device-pixel rect (GL, bottom-up) covering cell (i,j) padded by pad mm.
  cellRect(i, j, pad, disp = null, lift = 0) {
    const v = this.floor.view, P = v.pitch;
    const x0 = v.origin[0] + i * P - pad, y0 = v.origin[1] + j * P - pad;
    const pts = [];
    for (const [x, y] of [[x0, y0], [x0 + P + 2 * pad, y0], [x0, y0 + P + 2 * pad], [x0 + P + 2 * pad, y0 + P + 2 * pad]]) {
      let px = x, py = y;
      if (disp) {
        const cx = v.origin[0] + (i + 0.5) * P, cy = v.origin[1] + (j + 0.5) * P;
        const c = Math.cos(disp[2]), s = Math.sin(disp[2]);
        const dx = x - cx, dy = y - cy;
        px = cx + c * dx - s * dy + disp[0]; py = cy + s * dx + c * dy + disp[1];
      }
      for (const z of [lift, lift + v.thick]) pts.push(toScreen(v, px, py, z));
    }
    return this.bbox(pts);
  }

  bbox(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    x0 = Math.max(0, Math.floor(x0) - 2); y0 = Math.max(0, Math.floor(y0) - 2);
    x1 = Math.min(this.W, Math.ceil(x1) + 2); y1 = Math.min(this.H, Math.ceil(y1) + 2);
    if (x1 <= x0 || y1 <= y0) return null;
    return [x0, y0, x1 - x0, y1 - y0];
  }

  queueRect(x, y, w, h, urgent = false) {
    const B = 160;
    for (let yy = y; yy < y + h; yy += B) for (let xx = x; xx < x + w; xx += B) {
      const r = [xx, yy, Math.min(B, x + w - xx), Math.min(B, y + h - yy)];
      (urgent ? this.urgent : this.queue).push(r);
    }
  }

  get pending() { return this.queue.length + this.urgent.length; }

  // Draw a rect sample by sample; each jittered draw is blended into a running average.
  drawScene(rect, fb, mode, extra = {}) {
    const gl = this.gl;
    const J = [[0.375, 0.125], [0.875, 0.375], [0.625, 0.875], [0.125, 0.625]];
    const N = this.samples;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, this.W, this.H);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(...rect);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.rnd);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.cells);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);
    const progs = mode === 1 ? [this.top] : [this.bed, this.top];
    for (let k = 0; k < N; k++) {
      gl.blendColor(0, 0, 0, 1 / (k + 1));
      const jit = N === 1 ? [0.5, 0.5] : J[k % 4];
      for (const pr of progs) {
        gl.useProgram(pr.p);
        this.set(pr, { ...this.sceneU, uRnd: 2, uSamples: N, uJitter: jit, uMode: mode, ...extra });
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    this.stats.rendered += rect[2] * rect[3];
  }

  // Render the stone about to be laid, alone, into the sprite target.
  makeSprite(i, j, k) {
    const gl = this.gl;
    const r = this.cellRect(i, j, 8);
    if (!r) return null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sprite.fb);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(...r);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
    this.drawScene(r, this.sprite.fb, 1, { uActCell: [i, j], uActK: k });
    return r;
  }

  setActive(a) { this.active = a; }

  // One animation frame: refresh what is queued, then composite.
  frame(now) {
    const gl = this.gl;
    if (!this.poll() || !this.floor) return false;
    const dt = this.lastFrame ? now - this.lastFrame : 16;
    this.lastFrame = now;
    if (this.drewStatic) {
      if (dt > 26) this.budget = Math.max(30000, this.budget * 0.8);
      else if (dt < 19) this.budget = Math.min(6e6, this.budget * 1.12);
    }
    this.drewStatic = false;
    while (this.urgent.length) { this.drawScene(this.urgent.shift(), this.stat.fb, 0); this.drewStatic = true; }
    let spent = 0;
    while (this.queue.length && spent < this.budget) {
      const r = this.queue.shift();
      this.drawScene(r, this.stat.fb, 0);
      spent += r[2] * r[3] * this.samples;
      this.drewStatic = true;
    }
    const a = this.active;
    if (!this.drewStatic && !a && this.fade === this.lastFade) return false;
    this.lastFade = this.fade;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
    gl.bindVertexArray(this.vao);
    gl.useProgram(this.blit.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.stat.tex);
    this.set(this.blit, { uTex: 0, uFade: this.fade });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (a) this.drawActive(a);
    return true;
  }

  drawActive(a) {
    const gl = this.gl, v = this.floor.view, s = this.floor.sun, P = v.pitch;
    const disp = [a.dx, a.dy, a.rot];
    // where the lifted stone and its shadow can fall on screen
    const zm = a.lift + v.thick * 0.5;
    const sx = -s.dir[0] / s.dir[2] * zm, sy = -s.dir[1] / s.dir[2] * zm;
    const blur = (zm * s.soft + 1) * 2.2;
    const r1 = this.cellRect(a.i, a.j, 10, disp, a.lift);
    const r2 = this.cellRect(a.i, a.j, 10 + blur, [a.dx + sx, a.dy + sy, a.rot], 0);
    const pts = [];
    for (const r of [r1, r2]) if (r) pts.push([r[0], r[1]], [r[0] + r[2], r[1] + r[3]]);
    const rect = this.bbox(pts);
    if (!rect) return;
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(...rect);
    gl.useProgram(this.over.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.stat.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.sprite.tex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.cells);
    const x0 = v.origin[0] + a.i * P, y0 = v.origin[1] + a.j * P;
    this.set(this.over, {
      uCells: 2, uGrid: [v.NX, v.NY], uOrigin: v.origin, uPitch: P,
      ...this.common, uStatic: 0, uSprite: 1, uThick: v.thick, uFade: this.fade,
      uSunDir: s.dir, uSunSoft: s.soft, uPivot: [x0 + P / 2, y0 + P / 2], uDisp: disp,
      uLift: a.lift, uAlpha: a.alpha, uPxPerMm: v.pxPerMm, uCellBox: [x0, y0, x0 + P, y0 + P],
    });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.SCISSOR_TEST);
    gl.activeTexture(gl.TEXTURE0);
  }
}
