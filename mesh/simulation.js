/*
Run (from repo root):
  python -m http.server
Then open:
  http://localhost:8000/mesh/

This is a deterministic 3D mass-spring (Hooke) ribbon simulator:
- Simulates N particles (across width) over T timesteps (along length)
- Records full trajectory pos[t][i]
- Builds a triangle mesh from the time×particle grid
- Exports OBJ for Blender

p5.js is used only for noise + deterministic seeding (no drawing).
three.js is used for preview rendering.
*/

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------------------------
// Parameters (tweak here)
// ---------------------------

const PARAMS = {
  // Determinism
  seed: 1337,

  // Grid resolution
  N: 80,          // ribbon width resolution (particles across)
  T: 900,         // length resolution (timesteps)

  // Integration
  dt: 1.0,
  damping: 0.992, // Verlet velocity term scale per step (0.98..0.995 typical)
  mass: 1.0,

  // Springs
  structuralSprings: true,
  kStructural: 1.6,
  kRandom: 1.0,
  baseSpacing: 0.08,
  randomSpringsMultiplier: 3.0,   // numRandomSprings ≈ N * multiplier
  restLengthJitter: 0.15,         // +- fraction applied to L0
  maxStretch: 0.35,              // clamp spring stretch to avoid numerical blowups

  // Forces
  gravity: new THREE.Vector3(0, 0, -0.008),
  windStrength: 0.015,
  windScale: 0.12,
  windTimeScale: 0.015,

  // Ribbon init (ordered band)
  initMode: 'arc', // 'arc' | 'line'
  initRadius: 1.2,
  initArcRadians: Math.PI * 0.85,
  initNoise: 0.015,

  // Mesh
  wrapWidth: false,

  // Preview
  background: 0xd8d8d8,
  showRibs: true,
  stepsPerFrame: 6, // higher = faster growth, more CPU
};

// ---------------------------
// Deterministic RNG
// ---------------------------

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rand, a, b) {
  return a + (b - a) * rand();
}

function randNormalish3(rand) {
  // Cheap-ish symmetric noise vector in [-1,1]^3
  return new THREE.Vector3(randRange(rand, -1, 1), randRange(rand, -1, 1), randRange(rand, -1, 1));
}

// ---------------------------
// p5 noise bridge (deterministic)
// ---------------------------

let p5Instance = null;

function createP5Noise(seed) {
  return new Promise((resolve) => {
    // eslint-disable-next-line no-new
    new window.p5((p) => {
      p.setup = () => {
        p.noCanvas();
        p.noiseSeed(seed);
        p.randomSeed(seed);
        p5Instance = p;
        resolve(p);
      };
    });
  });
}

function noise3(p, x, y, z) {
  // p5.noise is 1D/2D/3D depending on args; use 3D form.
  return p.noise(x, y, z);
}

// ---------------------------
// Simulation
// ---------------------------

class Spring {
  constructor(a, b, restLength, k) {
    this.a = a;
    this.b = b;
    this.restLength = restLength;
    this.k = k;
  }
}

function buildInitialBand(rand, pos, prev) {
  const { N, baseSpacing, initMode, initRadius, initArcRadians, initNoise } = PARAMS;

  for (let i = 0; i < N; i++) {
    let x = 0;
    let y = 0;
    let z = 0;

    if (initMode === 'line') {
      x = (i - (N - 1) * 0.5) * baseSpacing;
      y = 0;
      z = 0;
    } else {
      // arc in XY plane, ordered by i across width
      const u = N === 1 ? 0.5 : i / (N - 1);
      const theta = (-initArcRadians * 0.5) + u * initArcRadians;
      x = Math.cos(theta) * initRadius;
      y = Math.sin(theta) * initRadius;
      z = 0;
    }

    x += randRange(rand, -initNoise, initNoise);
    y += randRange(rand, -initNoise, initNoise);
    z += randRange(rand, -initNoise, initNoise);

    const idx = i * 3;
    pos[idx + 0] = x;
    pos[idx + 1] = y;
    pos[idx + 2] = z;

    prev[idx + 0] = x;
    prev[idx + 1] = y;
    prev[idx + 2] = z;
  }
}

function buildSprings(rand, initialPos) {
  const {
    N,
    baseSpacing,
    structuralSprings,
    wrapWidth,
    kStructural,
    kRandom,
    restLengthJitter,
    randomSpringsMultiplier,
  } = PARAMS;

  const springs = [];

  const jitteredFactor = () => {
    const j = randRange(rand, -restLengthJitter, restLengthJitter);
    return 1.0 + j;
  };

  if (structuralSprings) {
    const limit = wrapWidth ? N : (N - 1);
    for (let i = 0; i < limit; i++) {
      const a = i;
      const b = (i + 1) % N;
      springs.push(new Spring(a, b, baseSpacing * jitteredFactor(), kStructural));
    }
  }

  const numRandom = Math.floor(N * randomSpringsMultiplier);
  const targetCount = springs.length + numRandom;
  const used = new Set();
  const key = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);

  let attempts = 0;
  while (springs.length < targetCount && attempts < numRandom * 40) {
    attempts++;
    const a = Math.floor(rand() * N);
    const b = Math.floor(rand() * N);
    if (a === b) continue;

    // Avoid duplicates & avoid immediate neighbor duplicates (structural already handles)
    const k = key(a, b);
    if (used.has(k)) continue;
    used.add(k);

    // Prefer local-ish connections to preserve lamella feel
    const dist = Math.abs(a - b);
    const wrapDist = Math.min(dist, N - dist);
    if (wrapDist < 3) continue;

    // For stability: random-spring rest length is based on the *initial* distance
    // between endpoints, so the system starts near equilibrium.
    const ax = initialPos[a * 3 + 0];
    const ay = initialPos[a * 3 + 1];
    const az = initialPos[a * 3 + 2];
    const bx = initialPos[b * 3 + 0];
    const by = initialPos[b * 3 + 1];
    const bz = initialPos[b * 3 + 2];
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const d0 = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const L0 = d0 * randRange(rand, 0.85, 1.15) * jitteredFactor();
    springs.push(new Spring(a, b, L0, kRandom));
  }

  return springs;
}

function simulateTrajectory(p) {
  const {
    N,
    T,
    dt,
    damping,
    mass,
    gravity,
    windStrength,
    windScale,
    windTimeScale,
  } = PARAMS;

  const rand = mulberry32(PARAMS.seed);

  // Particle state as typed arrays for performance
  let pos = new Float32Array(N * 3);
  let prev = new Float32Array(N * 3);
  let next = new Float32Array(N * 3);
  const forces = new Float32Array(N * 3);

  buildInitialBand(rand, pos, prev);
  const springs = buildSprings(rand, pos);

  // Trajectory: Float32Array storing xyz for each (t,i)
  const traj = new Float32Array(T * N * 3);

  for (let t = 0; t < T; t++) {
    // record full ribbon band at this timestep
    traj.set(pos, t * N * 3);

    // accumulate forces
    for (let i = 0; i < N; i++) {
      const idx = i * 3;
      forces[idx + 0] = gravity.x;
      forces[idx + 1] = gravity.y;
      forces[idx + 2] = gravity.z;

      // wind as mild noise field
      const px = pos[idx + 0] * windScale;
      const py = pos[idx + 1] * windScale;
      const pz = pos[idx + 2] * windScale;
      const tt = t * windTimeScale;

      const nx = noise3(p, px + 17.1, py + 0.0, pz + tt);
      const ny = noise3(p, px + 0.0, py + 31.7, pz + tt);
      const nz = noise3(p, px + 9.2, py + 11.3, pz + tt);

      // map noise [0..1] to [-1..1]
      forces[idx + 0] += (nx * 2 - 1) * windStrength;
      forces[idx + 1] += (ny * 2 - 1) * windStrength;
      forces[idx + 2] += (nz * 2 - 1) * windStrength;
    }

    // springs (Hooke)
    for (const s of springs) {
      const a = s.a;
      const b = s.b;

      const ai = a * 3;
      const bi = b * 3;

      const dx = pos[bi + 0] - pos[ai + 0];
      const dy = pos[bi + 1] - pos[ai + 1];
      const dz = pos[bi + 2] - pos[ai + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-6) continue;
      const invLen = 1.0 / len;
      const dirx = dx * invLen;
      const diry = dy * invLen;
      const dirz = dz * invLen;

      let stretch = len - s.restLength;
      const maxStretch = PARAMS.maxStretch;
      if (stretch > maxStretch) stretch = maxStretch;
      if (stretch < -maxStretch) stretch = -maxStretch;
      const fmag = s.k * stretch;

      const fx = dirx * fmag;
      const fy = diry * fmag;
      const fz = dirz * fmag;

      forces[ai + 0] += fx;
      forces[ai + 1] += fy;
      forces[ai + 2] += fz;

      forces[bi + 0] -= fx;
      forces[bi + 1] -= fy;
      forces[bi + 2] -= fz;
    }

    // Verlet integration
    const dt2_over_m = (dt * dt) / mass;

    for (let i = 0; i < N; i++) {
      const idx = i * 3;

      const x = pos[idx + 0];
      const y = pos[idx + 1];
      const z = pos[idx + 2];

      const px = prev[idx + 0];
      const py = prev[idx + 1];
      const pz = prev[idx + 2];

      const vx = (x - px) * damping;
      const vy = (y - py) * damping;
      const vz = (z - pz) * damping;

      const ax = forces[idx + 0] * dt2_over_m;
      const ay = forces[idx + 1] * dt2_over_m;
      const az = forces[idx + 2] * dt2_over_m;

      next[idx + 0] = x + vx + ax;
      next[idx + 1] = y + vy + ay;
      next[idx + 2] = z + vz + az;
    }

    // rotate buffers: prev <- pos, pos <- next
    const tmpArr = prev;
    prev = pos;
    pos = next;
    next = tmpArr;
  }

  return { traj, springs };
}

function createSimulationRunner(p) {
  const {
    N,
    T,
    dt,
    damping,
    mass,
    gravity,
    windStrength,
    windScale,
    windTimeScale,
  } = PARAMS;

  const rand = mulberry32(PARAMS.seed);

  // Particle state as typed arrays for performance
  let pos = new Float32Array(N * 3);
  let prev = new Float32Array(N * 3);
  let next = new Float32Array(N * 3);
  const forces = new Float32Array(N * 3);

  buildInitialBand(rand, pos, prev);
  const springs = buildSprings(rand, pos);

  // Full trajectory (for OBJ export)
  const traj = new Float32Array(T * N * 3);

  const dt2_over_m = (dt * dt) / mass;
  let t = 0;

  function step() {
    if (t >= T) return false;

    // record
    traj.set(pos, t * N * 3);

    // forces: gravity + wind
    for (let i = 0; i < N; i++) {
      const idx = i * 3;
      forces[idx + 0] = gravity.x;
      forces[idx + 1] = gravity.y;
      forces[idx + 2] = gravity.z;

      const px = pos[idx + 0] * windScale;
      const py = pos[idx + 1] * windScale;
      const pz = pos[idx + 2] * windScale;
      const tt = t * windTimeScale;

      const nx = noise3(p, px + 17.1, py + 0.0, pz + tt);
      const ny = noise3(p, px + 0.0, py + 31.7, pz + tt);
      const nz = noise3(p, px + 9.2, py + 11.3, pz + tt);

      forces[idx + 0] += (nx * 2 - 1) * windStrength;
      forces[idx + 1] += (ny * 2 - 1) * windStrength;
      forces[idx + 2] += (nz * 2 - 1) * windStrength;
    }

    // spring forces
    for (const s of springs) {
      const a = s.a;
      const b = s.b;

      const ai = a * 3;
      const bi = b * 3;

      const dx = pos[bi + 0] - pos[ai + 0];
      const dy = pos[bi + 1] - pos[ai + 1];
      const dz = pos[bi + 2] - pos[ai + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-6) continue;
      const invLen = 1.0 / len;

      let stretch = len - s.restLength;
      const maxStretch = PARAMS.maxStretch;
      if (stretch > maxStretch) stretch = maxStretch;
      if (stretch < -maxStretch) stretch = -maxStretch;

      const fmag = s.k * stretch;
      const fx = (dx * invLen) * fmag;
      const fy = (dy * invLen) * fmag;
      const fz = (dz * invLen) * fmag;

      forces[ai + 0] += fx;
      forces[ai + 1] += fy;
      forces[ai + 2] += fz;

      forces[bi + 0] -= fx;
      forces[bi + 1] -= fy;
      forces[bi + 2] -= fz;
    }

    // integrate
    for (let i = 0; i < N; i++) {
      const idx = i * 3;

      const x = pos[idx + 0];
      const y = pos[idx + 1];
      const z = pos[idx + 2];

      const px = prev[idx + 0];
      const py = prev[idx + 1];
      const pz = prev[idx + 2];

      const vx = (x - px) * damping;
      const vy = (y - py) * damping;
      const vz = (z - pz) * damping;

      const ax = forces[idx + 0] * dt2_over_m;
      const ay = forces[idx + 1] * dt2_over_m;
      const az = forces[idx + 2] * dt2_over_m;

      next[idx + 0] = x + vx + ax;
      next[idx + 1] = y + vy + ay;
      next[idx + 2] = z + vz + az;
    }

    const tmpArr = prev;
    prev = pos;
    pos = next;
    next = tmpArr;

    t++;
    return true;
  }

  return {
    get t() { return t; },
    get T() { return T; },
    get N() { return N; },
    get traj() { return traj; },
    step,
  };
}

// ---------------------------
// Mesh generation (traj grid -> triangles)
// ---------------------------

function buildMeshFromTrajectory(traj) {
  const { N, T, wrapWidth } = PARAMS;

  const vertexCount = N * T;
  const positions = new Float32Array(vertexCount * 3);
  positions.set(traj);

  const quadsAcross = wrapWidth ? N : (N - 1);
  const quadCount = (T - 1) * quadsAcross;
  const indexCount = quadCount * 6;

  const indices = (vertexCount > 65535) ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

  let w = 0;
  for (let t = 0; t < T - 1; t++) {
    for (let i = 0; i < quadsAcross; i++) {
      const i1 = (i + 1) % N;

      const v00 = t * N + i;
      const v10 = t * N + i1;
      const v01 = (t + 1) * N + i;
      const v11 = (t + 1) * N + i1;

      // consistent winding
      indices[w++] = v00;
      indices[w++] = v10;
      indices[w++] = v01;

      indices[w++] = v10;
      indices[w++] = v11;
      indices[w++] = v01;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  geo.computeBoundingBox();

  return geo;
}

function buildPreallocatedRibbonGeometry() {
  const { N, T, wrapWidth } = PARAMS;

  const vertexCount = N * T;
  const positions = new Float32Array(vertexCount * 3);

  const quadsAcross = wrapWidth ? N : (N - 1);
  const quadCount = (T - 1) * quadsAcross;
  const indexCount = quadCount * 6;
  const indices = (vertexCount > 65535) ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

  let w = 0;
  for (let t = 0; t < T - 1; t++) {
    for (let i = 0; i < quadsAcross; i++) {
      const i1 = (i + 1) % N;

      const v00 = t * N + i;
      const v10 = t * N + i1;
      const v01 = (t + 1) * N + i;
      const v11 = (t + 1) * N + i1;

      indices[w++] = v00;
      indices[w++] = v10;
      indices[w++] = v01;

      indices[w++] = v10;
      indices[w++] = v11;
      indices[w++] = v01;
    }
  }

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setIndex(new THREE.BufferAttribute(indices, 1));

  // Start with no faces drawn; we expand drawRange as time advances
  geo.setDrawRange(0, 0);
  return geo;
}

// ---------------------------
// OBJ export
// ---------------------------

function meshToOBJ(traj) {
  const { N, T, wrapWidth } = PARAMS;

  let out = '';
  out += '# mass-spring ribbon export\n';
  out += `# N=${N} T=${T} seed=${PARAMS.seed}\n`;

  // vertices
  for (let t = 0; t < T; t++) {
    for (let i = 0; i < N; i++) {
      const idx = (t * N + i) * 3;
      const x = traj[idx + 0];
      const y = traj[idx + 1];
      const z = traj[idx + 2];
      out += `v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`;
    }
  }

  const quadsAcross = wrapWidth ? N : (N - 1);

  // faces (1-based indices)
  const vid = (t, i) => (t * N + i + 1);

  for (let t = 0; t < T - 1; t++) {
    for (let i = 0; i < quadsAcross; i++) {
      const i1 = (i + 1) % N;

      const v00 = vid(t, i);
      const v10 = vid(t, i1);
      const v01 = vid(t + 1, i);
      const v11 = vid(t + 1, i1);

      out += `f ${v00} ${v10} ${v01}\n`;
      out += `f ${v10} ${v11} ${v01}\n`;
    }
  }

  return out;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------
// three.js preview
// ---------------------------

function makeScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PARAMS.background);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 200);
  camera.position.set(0.0, -6.0, 2.6);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;

  // lights: monochrome, high contrast
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(3.5, -2.0, 4.5);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-4.0, -1.5, 2.0);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.7);
  rim.position.set(-2.0, 4.0, 3.0);
  scene.add(rim);

  const ambient = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambient);

  const groundGeo = new THREE.PlaneGeometry(40, 40);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.85, metalness: 0.0 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -1.25;
  ground.receiveShadow = false;
  scene.add(ground);

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  window.addEventListener('resize', resize);
  resize();

  return { scene, camera, renderer, controls, resize };
}

function buildRibbonObject(geometry) {
  const group = new THREE.Group();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xf0f0f0,
    roughness: 0.28,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, mat);
  group.add(mesh);

  // Ribs are computed once at the end of the sim (EdgesGeometry is expensive to rebuild every frame)
  const lineMat = new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.95 });
  const lines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat);
  lines.visible = false;
  group.add(lines);

  // Center group
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const center = new THREE.Vector3();
  bb.getCenter(center);
  group.position.sub(center);

  // Gentle tilt
  group.rotation.set(0.55, 0.0, 0.25);

  return { group, mesh, lines };
}

// ---------------------------
// App
// ---------------------------

let appState = {
  traj: null,
  geometry: null,
  ribbon: null,
  three: null,
  p: null,
  runner: null,
  ribbonPositionsAttr: null,
  done: false,
};

async function regenerate() {
  const p = appState.p;

  // Build a fresh runner and a preallocated dynamic geometry
  const runner = createSimulationRunner(p);
  const geometry = buildPreallocatedRibbonGeometry();
  const ribbonPositionsAttr = geometry.getAttribute('position');

  // Replace geometry in scene
  if (appState.ribbon) {
    appState.three.scene.remove(appState.ribbon.group);
    appState.ribbon.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  const ribbon = buildRibbonObject(geometry);
  appState.three.scene.add(ribbon.group);

  appState.traj = runner.traj;
  appState.geometry = geometry;
  appState.ribbon = ribbon;
  appState.runner = runner;
  appState.ribbonPositionsAttr = ribbonPositionsAttr;
  appState.done = false;

  // update HUD
  document.getElementById('seed').textContent = String(PARAMS.seed);
  document.getElementById('grid').textContent = `${PARAMS.N}×${PARAMS.T}`;
}

function animate() {
  requestAnimationFrame(animate);
  const { renderer, scene, camera, controls } = appState.three;
  controls.update();

  // Live sim + mesh growth
  if (appState.runner && !appState.done) {
    const { N, wrapWidth } = PARAMS;
    const quadsAcross = wrapWidth ? N : (N - 1);

    // advance several steps per frame
    for (let s = 0; s < PARAMS.stepsPerFrame; s++) {
      const advanced = appState.runner.step();
      if (!advanced) {
        appState.done = true;
        break;
      }

      // Update just-written timestep positions in the geometry
      const tWritten = appState.runner.t - 1;
      const start = tWritten * N * 3;
      const end = start + N * 3;
      appState.ribbonPositionsAttr.array.set(appState.traj.subarray(start, end), start);

      // Expand drawRange: faces exist for timesteps [0..tWritten-1]
      const quads = Math.max(0, (tWritten) * quadsAcross);
      const indexCount = quads * 6;
      appState.geometry.setDrawRange(0, indexCount);
    }

    appState.ribbonPositionsAttr.needsUpdate = true;

    if (appState.done) {
      // Finalize once: normals + bounds + ribs
      appState.geometry.computeVertexNormals();
      appState.geometry.computeBoundingBox();
      appState.geometry.computeBoundingSphere();

      const edges = new THREE.EdgesGeometry(appState.geometry, 15);
      appState.ribbon.lines.geometry.dispose();
      appState.ribbon.lines.geometry = edges;
      appState.ribbon.lines.visible = PARAMS.showRibs;

      // Center group after bounds exist
      appState.geometry.computeBoundingBox();
      const bb = appState.geometry.boundingBox;
      const center = new THREE.Vector3();
      bb.getCenter(center);
      appState.ribbon.group.position.sub(center);
    }
  }

  renderer.render(scene, camera);
}

async function main() {
  const container = document.getElementById('three');

  // p5 for deterministic noise
  appState.p = await createP5Noise(PARAMS.seed);

  // three
  appState.three = makeScene(container);

  // controls
  document.getElementById('regen').addEventListener('click', () => {
    // tweak seed if desired: PARAMS.seed++;
    regenerate();
  });

  document.getElementById('download').addEventListener('click', () => {
    if (!appState.traj) return;
    const obj = meshToOBJ(appState.traj);
    downloadText(`ribbon_seed_${PARAMS.seed}_N${PARAMS.N}_T${PARAMS.T}.obj`, obj);
  });

  document.getElementById('toggleLines').addEventListener('click', () => {
    PARAMS.showRibs = !PARAMS.showRibs;
    if (appState.ribbon) appState.ribbon.lines.visible = PARAMS.showRibs;
  });

  await regenerate();
  animate();
}

main();
