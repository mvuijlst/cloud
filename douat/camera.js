// Camera maths and orbit controls. World: millimetres, x right, y down the default
// view, z up. The default view looks straight down, as a photograph of a floor would.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };

export function mul4(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}

// View matrix from an orthonormal basis: screen right R, screen up U, forward F.
export function viewFrom(eye, R, U, F) {
  return new Float32Array([
    R[0], U[0], -F[0], 0,
    R[1], U[1], -F[1], 0,
    R[2], U[2], -F[2], 0,
    -dot(R, eye), -dot(U, eye), dot(F, eye), 1,
  ]);
}

export function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

export function ortho(l, r, b, t, n, f) {
  return new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0,
    -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]);
}

// Basis looking along F, with screen up as close to world z as the view allows.
export function basis(F) {
  F = norm(F);
  let R = cross([0, 0, 1], F);
  if (Math.hypot(...R) < 1e-6) R = [1, 0, 0];
  R = norm(R);
  return { R, U: cross(F, R), F };
}

// An orthographic sun view whose box holds every given point.
export function sunView(dir, pts) {
  const { R, U, F } = basis(dir.map(v => -v));
  const V = viewFrom([0, 0, 0], R, U, F);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of pts) {
    const x = dot(R, p), y = dot(U, p), z = -dot(F, p);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  const near = -z1 - 10, far = -z0 + 10;
  return {
    vp: mul4(ortho(x0, x1, y0, y1, near, far), V),
    depth: [near, far],
    texelMm: Math.max(x1 - x0, y1 - y0),          // divided by the map size by the caller
  };
}

// Floor grid and default framing: `cellsAcross` squares fill the width, looking down.
export function makeView(W, H, { pitch, thick, cellsAcross, fovY }) {
  const tanY = Math.tan(fovY / 2), tanX = tanY * W / H;
  const dist = (cellsAcross * pitch / 2) / tanX;
  const hx = dist * tanX + pitch * 0.2, hy = dist * tanY + pitch * 0.2;
  const NX = 2 * Math.ceil(hx / pitch + 0.05), NY = 2 * Math.ceil(hy / pitch + 0.05);
  // far enough out that the whole floor, turned any way, stays in the picture
  const half = Math.min(fovY / 2, Math.atan(tanY * W / H));
  const maxDist = 1.08 * Math.hypot(NX, NY) * pitch / 2 / Math.sin(half);
  // Once the first NX×NY squares are laid, the floor grows by M rings into the room,
  // as far as the light reaches.
  const M = Math.ceil(1250 / pitch);
  const x0 = -NX / 2 * pitch, y0 = -NY / 2 * pitch;
  return {
    W, H, fovY, pitch, thick, NX, NY, dist, maxDist, M, RX: NX + 2 * M, RY: NY + 2 * M,
    origin: [x0, y0],
    rect: [x0, y0, -x0, -y0],
    roomOrigin: [x0 - M * pitch, y0 - M * pitch],
    roomRect: [x0 - M * pitch, y0 - M * pitch, -x0 + M * pitch, -y0 + M * pitch],
    floorR: Math.hypot(hx, hy),
  };
}

export class Orbit {
  static RESUME = 8;       // seconds without input before the view turns again

  constructor(el, onChange) {
    this.el = el;
    this.onChange = onChange;
    this.pointers = new Map();
    this.version = 0;
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => this.down(e));
    el.addEventListener('pointermove', e => this.move(e));
    el.addEventListener('pointerup', e => this.up(e));
    el.addEventListener('pointercancel', e => this.up(e));
    el.addEventListener('wheel', e => { e.preventDefault(); this.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    el.addEventListener('dblclick', () => { this.reset(true); this.idle = Orbit.RESUME; });
  }

  // Home view: the whole floor, a little from the side, turning slowly once every
  // `period` seconds. photo: straight down at the framing of a photograph of the floor.
  // A later floor keeps the camera where it is, held within the new floor's limits.
  setFloor(view, { photo = false, period = 600 } = {}) {
    const first = !this.view;
    this.view = view;
    this.home = photo
      ? { target: [0, 0, view.thick], yaw: Math.PI / 2, pitch: Math.PI / 2 - 0.0005, dist: view.dist, spin: 0 }
      : { target: [0, 0, view.thick], yaw: Math.PI / 2 + 0.35, pitch: 48 * Math.PI / 180, dist: view.maxDist,
        spin: period > 0 ? Math.PI * 2 / period : 0 };
    if (first) this.reset(); else this.changed(false);
    return first;
  }

  reset(user = false) {
    const h = this.home;
    this.target = h.target.slice();
    this.yaw = h.yaw; this.pitch = h.pitch; this.dist = h.dist;
    this.idle = Orbit.RESUME;
    this.changed(user);
  }

  // Turn by itself, easing back in once the viewer has let go for a while.
  tick(dt) {
    this.idle += dt;
    const spin = this.home?.spin || 0;
    if (!spin || this.idle < Orbit.RESUME) return;
    const ramp = Math.min(1, (this.idle - Orbit.RESUME) / 3);
    this.yaw += spin * ramp * ramp * dt;
    this.changed(false);
  }

  // user: the change came from the viewer's hand, not from the page
  changed(user = true) {
    const v = this.view;
    this.pitch = Math.min(Math.PI / 2 - 0.0005, Math.max(0.21, this.pitch));
    this.dist = Math.min(v.maxDist, Math.max(v.dist * 0.1, this.dist));
    const [x0, y0, x1, y1] = v.roomRect;
    this.target[0] = Math.min(x1, Math.max(x0, this.target[0]));
    this.target[1] = Math.min(y1, Math.max(y0, this.target[1]));
    this.version++;
    if (user) { this.idle = 0; this.onChange?.(); }
  }

  zoom(k) { this.dist *= k; this.changed(); }

  down(e) {
    try { this.el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    this.idle = 0;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey || e.ctrlKey });
  }

  up(e) { this.pointers.delete(e.pointerId); }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (this.pointers.size === 2) {
      // pinch: zoom by the change in finger spread, pan by the midpoint
      const [a, b] = [...this.pointers.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      p.x = e.clientX; p.y = e.clientY;
      const after = Math.hypot(a.x - b.x, a.y - b.y);
      if (before > 0 && after > 0) this.dist *= before / after;
      this.pan(dx / 2, dy / 2);
      return;
    }
    p.x = e.clientX; p.y = e.clientY;
    if (p.pan) this.pan(dx, dy);
    else { this.yaw -= dx * 0.006; this.pitch += dy * 0.006; this.changed(); }
  }

  pan(dx, dy) {
    const { R, F } = this.basis();
    const s = this.dist * 2 * Math.tan(this.view.fovY / 2) / this.el.clientHeight;
    const r = norm([R[0], R[1], 0]);
    const fl = Math.hypot(F[0], F[1]) > 0.05 ? norm([F[0], F[1], 0]) : norm([-r[1], r[0], 0]);
    this.target[0] += (-dx * r[0] + dy * fl[0]) * s;
    this.target[1] += (-dx * r[1] + dy * fl[1]) * s;
    this.changed();
  }

  eye() {
    const c = Math.cos(this.pitch);
    return [this.target[0] + this.dist * c * Math.cos(this.yaw),
      this.target[1] + this.dist * c * Math.sin(this.yaw),
      this.target[2] + this.dist * Math.sin(this.pitch)];
  }

  basis() { return basis(sub(this.target, this.eye())); }

  matrices(aspect) {
    const eye = this.eye();
    const { R, U, F } = this.basis();
    const near = Math.max(8, this.dist * 0.04), far = this.dist * 6 + 4000;
    return { eye, vp: mul4(perspective(this.view.fovY, aspect, near, far), viewFrom(eye, R, U, F)) };
  }
}
