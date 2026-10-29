// WebGL 2 renderer for the floor. Per floor, the stone and mortar model is baked into
// textures; each frame then draws real stones (tops and sides) with sun shadows.
import { QUAD_VS, BAKE_STONE_FS, BAKE_BED_FS, STONE_VS, STONE_FS, GROUND_VS, GROUND_FS, DEPTH_FS } from './shaders.js';
import { makeRndBytes, Rnd, RND_N } from './stonelib.js';
import { atlasLayout, buildStones, buildGround, slotTables, FLOATS } from './geometry.js';
import { sunView, ortho } from './camera.js';

const U = {
  FLOAT: 0x1406, VEC2: 0x8B50, VEC3: 0x8B51, VEC4: 0x8B52, INT: 0x1404, IVEC2: 0x8B53,
  UINT: 0x1405, BOOL: 0x8B56, MAT3: 0x8B5B, MAT4: 0x8B5C, SAMPLER: 0x8B5E, USAMPLER: 0x8DD2,
};
const STONE_ATTRS = ['aPos', 'aNrm', 'aTan', 'aUV', 'aInfo'];
// texture units
const TU = { slotF: 0, rnd: 1, atlas0: 2, atlas1: 3, bed0: 4, bed1: 5, mask: 6, shadow: 7, fly: 8, slotU: 9 };

export class Renderer {
  constructor(canvas, { lowPower = false } = {}) {
    const gl = canvas.getContext('webgl2', {
      antialias: true, alpha: false, depth: true, stencil: true,
      preserveDrawingBuffer: false, powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('This page needs WebGL 2.');
    this.gl = gl;
    this.canvas = canvas;
    this.lowPower = lowPower;
    this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.par = gl.getExtension('KHR_parallel_shader_compile');
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    this.t0 = performance.now();
    this.progs = [
      this.program(QUAD_VS, BAKE_STONE_FS, 'stone bake'),
      this.program(QUAD_VS, BAKE_BED_FS, 'bed bake'),
      this.program(STONE_VS, STONE_FS, 'stones', STONE_ATTRS),
      this.program(GROUND_VS, GROUND_FS, 'ground', ['aPos']),
      this.program(STONE_VS, DEPTH_FS, 'depth', STONE_ATTRS),
    ];
    [this.pBakeStone, this.pBakeBed, this.pStone, this.pGround, this.pDepth] = this.progs;
    this.ready = false;
    this.quadVao = gl.createVertexArray();
    this.rndBytes = makeRndBytes();
    this.rnd = new Rnd(this.rndBytes);
    this.rndTex = this.texture(RND_N, RND_N, gl.RGBA8, 1, gl.NEAREST, gl.NEAREST);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, RND_N, RND_N, gl.RGBA, gl.UNSIGNED_BYTE, this.rndBytes);
    this.fade = 0;
    this.nLaid = 0;
    this.flying = null;
    this.owned = [];
    this.stats = { frames: 0 };
  }

  // ------------------------------------------------------------ GL plumbing
  program(vs, fs, name, attrs = []) {
    const gl = this.gl;
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const p = gl.createProgram();
    const v = mk(gl.VERTEX_SHADER, vs), f = mk(gl.FRAGMENT_SHADER, fs);
    gl.attachShader(p, v); gl.attachShader(p, f);
    attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    return { p, u: null, name, shaders: [v, f] };
  }

  poll() {
    if (this.ready) return true;
    const gl = this.gl;
    if (this.par && !this.progs.every(pr => gl.getProgramParameter(pr.p, this.par.COMPLETION_STATUS_KHR))) return false;
    for (const pr of this.progs) {
      if (!gl.getProgramParameter(pr.p, gl.LINK_STATUS)) {
        const logs = pr.shaders.map(s => gl.getShaderInfoLog(s)).filter(Boolean).join('\n');
        throw new Error(`${pr.name} shader: ${logs || gl.getProgramInfoLog(pr.p)}`);
      }
      pr.u = {};
      const n = gl.getProgramParameter(pr.p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(pr.p, i);
        pr.u[info.name.replace(/\[0\]$/, '')] = { loc: gl.getUniformLocation(pr.p, info.name), type: info.type };
      }
    }
    this.ready = true;
    this.compileMs = performance.now() - this.t0;
    console.log(`shaders ready in ${this.compileMs.toFixed(0)} ms`);
    return true;
  }

  use(pr, values) {
    const gl = this.gl;
    gl.useProgram(pr.p);
    for (const [k, v] of Object.entries(values)) {
      const e = pr.u[k];
      if (!e) continue;
      switch (e.type) {
        case U.FLOAT: gl.uniform1f(e.loc, v); break;
        case U.VEC2: gl.uniform2fv(e.loc, v); break;
        case U.VEC3: gl.uniform3fv(e.loc, v); break;
        case U.VEC4: gl.uniform4fv(e.loc, v); break;
        case U.INT: case U.BOOL: case U.SAMPLER: case U.USAMPLER: gl.uniform1i(e.loc, v); break;
        case U.IVEC2: gl.uniform2iv(e.loc, v); break;
        case U.UINT: gl.uniform1ui(e.loc, v); break;
        case U.MAT3: gl.uniformMatrix3fv(e.loc, false, v); break;
        case U.MAT4: gl.uniformMatrix4fv(e.loc, false, v); break;
        default: throw new Error('uniform type ' + e.type);
      }
    }
  }

  texture(w, h, fmt, levels, min, mag) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, levels, fmt, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  framebuffer(colors, depth) {
    const gl = this.gl;
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    colors.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
    if (depth) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
    gl.drawBuffers(colors.length ? colors.map((_, i) => gl.COLOR_ATTACHMENT0 + i) : [gl.NONE]);
    if (!colors.length) gl.readBuffer(gl.NONE);
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incomplete: 0x' + st.toString(16));
    return fb;
  }

  bind(unit, tex) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }

  release() {
    const gl = this.gl;
    for (const [kind, o] of this.owned) {
      if (kind === 't') gl.deleteTexture(o);
      else if (kind === 'f') gl.deleteFramebuffer(o);
      else if (kind === 'b') gl.deleteBuffer(o);
      else if (kind === 'v') gl.deleteVertexArray(o);
    }
    this.owned = [];
  }
  own(kind, o) { this.owned.push([kind, o]); return o; }

  resize(w, h) {
    this.canvas.width = w; this.canvas.height = h;
    this.W = w; this.H = h;
    this.dirty = true;
  }

  // ------------------------------------------------------------ a new floor
  setFloor(floor) {
    const gl = this.gl;
    this.release();
    this.floor = floor;
    const v = floor.view, m = floor.material, s = floor.sun;
    const lin = c => c.map(x => Math.pow(x / 255, 2.2));
    // the baked-stone table: polygon, sizes, design (floats) and hash, flags (uints) per slot
    const tab = slotTables(floor.pool);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    this.slotF = this.own('t', this.texture(5, tab.n, gl.RGBA32F, 1, gl.NEAREST, gl.NEAREST));
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 5, tab.n, gl.RGBA, gl.FLOAT, tab.f);
    this.slotU = this.own('t', this.texture(1, tab.n, gl.RGBA32UI, 1, gl.NEAREST, gl.NEAREST));
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, tab.n, gl.RGBA_INTEGER, gl.UNSIGNED_INT, tab.u);
    const cem = m.cement || { a: [200, 190, 175], b: [60, 60, 62], body: [140, 138, 132] };
    this.mat = {
      uPitch: v.pitch, uThick: v.thick, uJoint: m.joint, uOrigin: v.roomOrigin,
      uSlotF: TU.slotF, uSlotU: TU.slotU, uRnd: TU.rnd, uSeed: floor.seed >>> 0, uLoop: 1,
      uCementA: lin(cem.a), uCementB: lin(cem.b), uCementBody: lin(cem.body),
      uDarkAlb: lin(m.dark), uLightAlb: lin(m.light), uBedAlb: lin(m.bed), uFillAlb: lin(m.fill),
      uDarkP: m.darkP, uLightP: m.lightP, uMisc: [m.fillDepth, m.edge, m.grime, m.scratches],
      uSunDir: s.dir, uSunCol: s.col, uSkyCol: s.sky, uSunSoft: s.soft, uExposure: s.exposure,
      uFloorC: [0, 0], uFloorR: v.floorR,
    };

    // stone atlas: one slot per baked stone, about a millimetre to the texel
    const span = Math.max(...floor.pool.entries.map(e => e.span));
    const slot = Math.min(this.lowPower ? 192 : 384, Math.ceil(span / (this.lowPower ? 1.6 : 0.95)));
    const A = this.atlas = atlasLayout(tab.n, slot, Math.min(this.maxTex, 8192));
    const lv = 6;
    this.atlas0 = this.own('t', this.texture(A.W, A.H, gl.SRGB8_ALPHA8, lv, gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, lv - 1);
    if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    this.atlas1 = this.own('t', this.texture(A.W, A.H, gl.RGBA8, lv, gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, lv - 1);
    this.atlasFb = this.own('f', this.framebuffer([this.atlas0, this.atlas1]));

    // mortar bed under the floor and a margin around it
    const [x0, y0, x1, y1] = v.roomRect;
    const bm = 1300;
    this.bedRect = [x0 - bm, y0 - bm, x1 + bm, y1 + bm];
    const cap = Math.min(this.maxTex, this.lowPower ? 2048 : 4096);
    const bt = Math.max(2.5, (this.bedRect[2] - this.bedRect[0]) / cap, (this.bedRect[3] - this.bedRect[1]) / cap);
    const bw = Math.ceil((this.bedRect[2] - this.bedRect[0]) / bt), bh = Math.ceil((this.bedRect[3] - this.bedRect[1]) / bt);
    this.bedSize = [bw, bh];
    const bl = Math.floor(Math.log2(Math.max(bw, bh))) + 1;
    this.bed0 = this.own('t', this.texture(bw, bh, gl.SRGB8_ALPHA8, bl, gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR));
    if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    this.bed1 = this.own('t', this.texture(bw, bh, gl.RGBA8, bl, gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR));
    this.bedFb = this.own('f', this.framebuffer([this.bed0, this.bed1]));

    // coverage of laid tops seen from above, blurred by its mipmaps into joint darkness
    this.maskRect = [x0 - 60, y0 - 60, x1 + 60, y1 + 60];
    const mt = Math.max(1.5, (this.maskRect[2] - this.maskRect[0]) / cap, (this.maskRect[3] - this.maskRect[1]) / cap);
    const mw = Math.ceil((this.maskRect[2] - this.maskRect[0]) / mt), mh = Math.ceil((this.maskRect[3] - this.maskRect[1]) / mt);
    this.maskSize = [mw, mh];
    this.mask = this.own('t', this.texture(mw, mh, gl.R8, Math.floor(Math.log2(Math.max(mw, mh))) + 1, gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR));
    this.maskFb = this.own('f', this.framebuffer([this.mask]));
    this.maskVP = ortho(this.maskRect[0], this.maskRect[2], this.maskRect[1], this.maskRect[3], -1000, 1000);

    // sun shadow maps: the laid floor, and the stone in flight
    this.shadowSize = this.lowPower ? 2048 : 4096;
    this.shadow = this.own('t', this.texture(this.shadowSize, this.shadowSize, gl.DEPTH_COMPONENT32F, 1, gl.NEAREST, gl.NEAREST));
    this.shadowFb = this.own('f', this.framebuffer([], this.shadow));
    this.flySize = 1024;
    this.flyShadow = this.own('t', this.texture(this.flySize, this.flySize, gl.DEPTH_COMPONENT32F, 1, gl.NEAREST, gl.NEAREST));
    this.flyFb = this.own('f', this.framebuffer([], this.flyShadow));
    const box = [];
    for (const x of [x0 - 300, x1 + 300]) for (const y of [y0 - 300, y1 + 300]) for (const z of [0, v.thick + 60]) box.push([x, y, z]);
    const sv = sunView(s.dir, box);
    this.light = { vp: sv.vp, depth: sv.depth, texel: sv.texelMm / this.shadowSize };

    // geometry
    this.mesh = buildStones(floor, this.rnd, A);
    this.stoneVbo = this.own('b', gl.createBuffer());
    gl.bindBuffer(gl.ARRAY_BUFFER, this.stoneVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.mesh.data, gl.STATIC_DRAW);
    this.stoneVao = this.own('v', gl.createVertexArray());
    gl.bindVertexArray(this.stoneVao);
    const stride = FLOATS * 4;
    [[0, 3, 0], [1, 3, 3], [2, 3, 6], [3, 2, 9], [4, 2, 11]].forEach(([loc, n, off]) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, n, gl.FLOAT, false, stride, off * 4);
    });
    const ground = buildGround(v, m, this.bedRect);
    this.groundVbo = this.own('b', gl.createBuffer());
    gl.bindBuffer(gl.ARRAY_BUFFER, this.groundVbo);
    gl.bufferData(gl.ARRAY_BUFFER, ground, gl.STATIC_DRAW);
    this.groundVao = this.own('v', gl.createVertexArray());
    gl.bindVertexArray(this.groundVao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.bindVertexArray(null);

    this.jobs = [{ kind: 'bed', rows: bh, done: 0 }, { kind: 'atlas', rows: A.H, done: 0 }];
    this.baked = false;
    this.nLaid = 0;
    this.pointR = -1;
    this.flying = null;
    this.staticDirty = true;
    this.dirty = true;
  }

  // Bake some rows of the current texture; true when every bake is finished.
  bakeStep(budget = 1.5e6) {
    if (!this.poll() || !this.floor) return false;
    if (this.baked) return true;
    const gl = this.gl;
    const job = this.jobs.find(j => j.done < j.rows);
    if (!job) {
      this.baked = true;
      this.dirty = true;
      return true;
    }
    const bed = job.kind === 'bed';
    const w = bed ? this.bedSize[0] : this.atlas.W, h = job.rows;
    const n = Math.max(1, Math.min(h - job.done, Math.floor(budget / w)));
    gl.bindFramebuffer(gl.FRAMEBUFFER, bed ? this.bedFb : this.atlasFb);
    gl.viewport(0, 0, w, h);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, job.done, w, n);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    this.bind(TU.slotF, this.slotF);
    this.bind(TU.slotU, this.slotU);
    this.bind(TU.rnd, this.rndTex);
    if (bed) this.use(this.pBakeBed, { ...this.mat, uBedRect: this.bedRect, uBedSize: this.bedSize });
    else this.use(this.pBakeStone, { ...this.mat, uSlotCols: this.atlas.cols, uSlotPx: this.atlas.S, uSlots: this.floor.pool.entries.length });
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.SCISSOR_TEST);
    job.done += n;
    if (job.done >= job.rows) {
      for (const t of bed ? [this.bed0, this.bed1] : [this.atlas0, this.atlas1]) {
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.generateMipmap(gl.TEXTURE_2D);
      }
    }
    return false;
  }

  get bakeProgress() {
    if (!this.jobs) return 0;
    const all = this.jobs.reduce((a, j) => a + j.rows, 0), done = this.jobs.reduce((a, j) => a + j.done, 0);
    return done / all;
  }

  setLaid(n) {
    if (n !== this.nLaid) { this.nLaid = n; this.staticDirty = true; this.dirty = true; }
  }

  // joints are filled out to this distance from the centre
  setPointing(r) {
    if (r !== this.pointR) { this.pointR = r; this.dirty = true; }
  }

  // The stone in flight: index in laying order, displacement (mm), turn and tilts (rad), fade.
  setFlying(f) { this.flying = f; this.dirty = true; }

  flyTransform(f) {
    const cz = Math.cos(f.yaw), sz = Math.sin(f.yaw);
    const cx = Math.cos(f.tiltX), sx = Math.sin(f.tiltX), cy = Math.cos(f.tiltY), sy = Math.sin(f.tiltY);
    // Rz(yaw) * Rx(tiltX) * Ry(tiltY), column-major
    const Ry = [cy, 0, -sy, 0, 1, 0, sy, 0, cy];
    const Rx = [1, 0, 0, 0, cx, sx, 0, -sx, cx];
    const Rz = [cz, sz, 0, -sz, cz, 0, 0, 0, 1];
    const m3 = (a, b) => {
      const o = new Array(9);
      for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) {
        o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2];
      }
      return o;
    };
    return { rot: new Float32Array(m3(Rz, m3(Rx, Ry))), pivot: this.mesh.pivots[f.index], t: [f.dx, f.dy, f.lift] };
  }

  // ------------------------------------------------------------ drawing
  drawStones(range, fly) {
    const gl = this.gl;
    if (range[1] > 0) gl.drawArrays(gl.TRIANGLES, range[0], range[1]);
  }

  laidRanges() {
    const n = this.nLaid, m = this.mesh;
    if (n === 0) return { tops: [0, 0], walls: [m.topVerts, 0] };
    const lt = m.top[n - 1], lw = m.wall[n - 1];
    return { tops: [0, lt[0] + lt[1]], walls: [m.topVerts, lw[0] + lw[1] - m.topVerts] };
  }

  flyUniforms(fly) {
    if (!fly) return { uFly: 0 };
    return { uFly: 1, uPivot: fly.pivot, uFlyRot: fly.rot, uFlyT: fly.t };
  }

  renderStatic() {
    const gl = this.gl, r = this.laidRanges();
    gl.bindVertexArray(this.stoneVao);
    this.bind(TU.atlas1, this.atlas1);
    // sun depth of the laid floor
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFb);
    gl.viewport(0, 0, this.shadowSize, this.shadowSize);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.5, 4);
    this.use(this.pDepth, { uVP: this.light.vp, uAtlas1: TU.atlas1, uMaskMode: 0, uFly: 0 });
    this.drawStones(r.tops);
    this.drawStones(r.walls);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    // coverage seen from above
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.maskFb);
    gl.viewport(0, 0, this.maskSize[0], this.maskSize[1]);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    this.use(this.pDepth, { uVP: this.maskVP, uMaskMode: 1 });
    this.drawStones(r.tops);
    gl.blendEquation(gl.FUNC_ADD);
    gl.disable(gl.BLEND);
    gl.bindTexture(gl.TEXTURE_2D, this.mask);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.staticDirty = false;
  }

  renderFlyShadow(fly) {
    const gl = this.gl, s = this.floor.sun, f = this.flying;
    const c = [fly.pivot[0] + fly.t[0], fly.pivot[1] + fly.t[1]];
    const box = [];
    for (const dx of [-230, 230]) for (const dy of [-230, 230]) for (const z of [0, f.lift + this.floor.view.thick + 60]) box.push([c[0] + dx, c[1] + dy, z]);
    const sv = sunView(s.dir, box);
    this.flyLight = { vp: sv.vp, depth: sv.depth, texel: sv.texelMm / this.flySize };
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.flyFb);
    gl.viewport(0, 0, this.flySize, this.flySize);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.5, 4);
    gl.bindVertexArray(this.stoneVao);
    this.bind(TU.atlas1, this.atlas1);
    this.use(this.pDepth, { uVP: sv.vp, uAtlas1: TU.atlas1, uMaskMode: 0, ...this.flyUniforms(fly) });
    this.drawStones(this.mesh.top[f.index]);
    this.drawStones(this.mesh.wall[f.index]);
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }

  // Draw a frame if anything changed. cam: { vp, eye, version }.
  frame(cam) {
    if (!this.poll() || !this.floor || !this.baked) return false;
    const gl = this.gl;
    const key = cam.version + ':' + this.fade;
    if (!this.dirty && !this.flying && !this.staticDirty && key === this.lastKey) return false;
    this.lastKey = key;
    this.dirty = false;
    if (this.staticDirty) this.renderStatic();
    const f = this.flying;
    const fly = f ? this.flyTransform(f) : null;
    if (fly) this.renderFlyShadow(fly);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
    gl.clearColor(0, 0, 0, 1);
    gl.clearStencil(0);
    gl.depthMask(true);
    gl.stencilMask(0xff);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    for (const [unit, t] of [[TU.slotF, this.slotF], [TU.slotU, this.slotU], [TU.rnd, this.rndTex], [TU.atlas0, this.atlas0], [TU.atlas1, this.atlas1],
      [TU.bed0, this.bed0], [TU.bed1, this.bed1], [TU.mask, this.mask], [TU.shadow, this.shadow], [TU.fly, this.flyShadow]]) this.bind(unit, t);
    const fl = this.flyLight || this.light;
    const view = {
      ...this.mat, uVP: cam.vp, uEye: cam.eye, uRes: [this.W, this.H], uFade: this.fade,
      uShadow: TU.shadow, uLightVP: this.light.vp, uLightDepth: this.light.depth, uLightTexel: this.light.texel,
      uFlyShadow: TU.fly, uFlyVP: fl.vp, uFlyDepth: fl.depth, uFlyTexel: fl.texel, uFlyOn: fly ? 1 : 0,
      uMask: TU.mask, uMaskRect: this.maskRect,
      uAtlas0: TU.atlas0, uAtlas1: TU.atlas1, uBed0: TU.bed0, uBed1: TU.bed1, uBedRect: this.bedRect,
      uFloorRect: this.floor.view.rect,
    };
    const r = this.laidRanges();
    gl.bindVertexArray(this.stoneVao);
    // tops mark the stencil so the joint filling never shows over a stone
    gl.enable(gl.STENCIL_TEST);
    gl.stencilFunc(gl.ALWAYS, 1, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    this.use(this.pStone, { ...view, uFly: 0, uAlpha: 1 });
    this.drawStones(r.tops);
    if (fly) {
      this.use(this.pStone, { ...this.flyUniforms(fly), uAlpha: f.alpha });
      this.drawStones(this.mesh.top[f.index]);
    }
    gl.stencilMask(0);
    this.use(this.pStone, { uFly: 0, uAlpha: 1 });
    this.drawStones(r.walls);
    if (fly) {
      this.use(this.pStone, { ...this.flyUniforms(fly), uAlpha: f.alpha });
      this.drawStones(this.mesh.wall[f.index]);
    }
    gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    // the bed, then the filling wherever no stone top covers it
    gl.bindVertexArray(this.groundVao);
    gl.stencilFunc(gl.ALWAYS, 0, 0xff);
    this.use(this.pGround, { ...view, uGround: 0 });
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.stencilFunc(gl.NOTEQUAL, 1, 0xff);
    this.use(this.pGround, { uGround: 1, uPointR: this.pointR });
    gl.drawArrays(gl.TRIANGLES, 6, 6);
    gl.disable(gl.STENCIL_TEST);
    gl.stencilMask(0xff);
    gl.bindVertexArray(null);
    this.stats.frames++;
    return true;
  }
}
