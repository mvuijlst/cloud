// The stone, mortar and light model, shared by the bake shaders and the 3D view.
// Millimetres; x to the right, y down the default view, z up out of the floor.
//
// The bakes are built once per family of material, each with only its own model, which keeps
// each program small enough to compile quickly: FAMILY 0 stone, 1 cement tiles, 2 fired clay,
// 3 glazed tiles.
// The 3D view's programs take no stone model at all (FAMILY -1).
export const MATERIAL = `
#ifndef FAMILY
#define FAMILY -1
#endif
const float PI = 3.14159265;
const float INV32 = 1.0 / 4294967296.0;

uvec3 pcg3(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 rnd3(uvec3 v) { return vec3(pcg3(v)) * INV32; }

uniform float uPitch, uThick, uJoint;
uniform vec2 uOrigin;           // layout grid, for the chalk lines on the bed
uniform uint uSeed;
// One row per baked stone. uSlotF texels: 0-4 polygon vertices (two per texel, mm, about the
// stone's centre, already inset for the joint and corner radius), 5: vertex count, corner radius,
// slot span in mm, design; 6: design size, design variant, two design widths; 7: four more
// design parameters.
// uSlotU: hash xyz, flags (1 dark, 2 cement, 4 middle stone, 8 fired clay).
uniform sampler2D uSlotF;
uniform highp usampler2D uSlotU;
uniform vec3 uCementA, uCementB, uCementC, uCementBody;   // cement tiles: ground, figure, third pigment, body
uniform vec3 uGlaze[6];         // glazed tiles: the ground, four fields, the lines between them
uniform float uFaceLayer;       // mm of a tile's face layer seen on its side (cement 5, glaze 1)

uniform vec3 uDarkAlb, uLightAlb, uMidAlb, uBedAlb, uFillAlb;
uniform vec4 uDarkP;            // tone spread, haze, fossils, calcite veins
uniform vec4 uLightP;           // tone spread, erosion share, erosion strength, crack share
uniform vec4 uMisc;             // fill depth mm, edge radius scale, edge grime, scratches
uniform vec4 uVein;             // marble veins in the light and middle stones, ochre clouding,
                                // smoothness of the honed face (0 stone, towards 1 marble)
uniform vec2 uRough;            // base roughness, dark and light stone
uniform vec3 uSunDir, uSunCol, uSkyCol;
uniform float uSunSoft, uExposure;
uniform vec2 uFloorC;
uniform float uFloorR;
uniform int uLoop;              // always 1. Loop bounds read it so that compilers keep loops
                                // as loops instead of unrolling them into minutes of compile time.

// ---------------------------------------------------------------- noise
// Value noise read from a 512² table of random bytes, with quintic interpolation done
// here in full precision (hardware filtering would quantise the slopes the normals need).
// Each seed starts at its own place in the table.
uniform sampler2D uRnd;
ivec2 rndOff(uint s) {
  uint h = s * 2654435761u;
  return ivec2(int(h & 511u), int((h >> 9) & 511u));
}
vec4 rndAt(ivec2 c, uint s) { return texelFetch(uRnd, (c + rndOff(s)) & 511, 0); }
vec3 hrnd(uvec3 h, uint k) { return rndAt(ivec2(int(h.x & 511u), int(h.y & 511u)), h.z + k).xyz; }
float gnoise(vec2 p, uint s) {
  vec2 i = floor(p);
  vec2 f = p - i;
  ivec2 c = (ivec2(i) + rndOff(s)) & 511;
  ivec2 c1 = (c + 1) & 511;
  float a = texelFetch(uRnd, c, 0).x;
  float b = texelFetch(uRnd, ivec2(c1.x, c.y), 0).x;
  float d = texelFetch(uRnd, ivec2(c.x, c1.y), 0).x;
  float e = texelFetch(uRnd, c1, 0).x;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(a, b, u.x), mix(d, e, u.x), u.y) * 2.0 - 1.0;
}
// fbm whose octaves fade out before they alias. fp: sample footprint in noise units.
float fbm(vec2 p, uint s, int oct, float fp) {
  float sum = 0.0, amp = 0.5, f = 1.0, norm = 0.0;
  for (int i = 0; i < oct * uLoop; i++) {
    norm += amp;
    float w = clamp(2.0 - 3.0 * f * fp, 0.0, 1.0);
    if (w > 0.0) sum += amp * w * gnoise(p, s + uint(i) * 0x9E3779B9u);
    p = mat2(0.8, -0.6, 0.6, 0.8) * p * 2.02 + vec2(13.7, 7.1);
    amp *= 0.5; f *= 2.02;
  }
  return sum / norm;
}

// Random discs on a jittered grid. Returns coverage; depth is a crater profile.
float dots(vec2 p, float cs, float prob, float rmin, float rmax, uint s, float fp, out float depth) {
  vec2 g = p / cs;
  ivec2 c0 = ivec2(floor(g));
  float cov = 0.0;
  depth = 0.0;
  for (int y = -uLoop; y <= uLoop; y++) for (int x = -uLoop; x <= uLoop; x++) {
    ivec2 c = c0 + ivec2(x, y);
    vec3 h = rndAt(c, s).xyz;
    if (h.z >= prob) continue;
    vec3 h2 = rndAt(c, s ^ 0x5bd1e995u).xyz;
    vec2 ctr = (vec2(c) + h.xy) * cs;
    float r = mix(rmin, rmax, h2.x * h2.x);
    float dist = length(p - ctr);
    float e = max(fp, 0.04);
    float k = clamp((r - dist) / e + 0.5, 0.0, 1.0) * min(1.0, r / e);
    cov = max(cov, k);
    depth = max(depth, clamp(1.0 - dist * dist / (r * r), 0.0, 1.0) * (0.4 + 0.6 * h2.y));
  }
  return cov;
}

// Fine scratches: short, slightly bent segments.
float scratches(vec2 p, float cs, float prob, float len, float wid, uint s, float fp) {
  ivec2 c0 = ivec2(floor(p / cs));
  float acc = 0.0;
  for (int y = -uLoop; y <= uLoop; y++) for (int x = -uLoop; x <= uLoop; x++) {
    ivec2 c = c0 + ivec2(x, y);
    vec3 h = rndAt(c, s).xyz;
    if (h.z >= prob) continue;
    vec3 h2 = rndAt(c, s ^ 0x27d4eb2du).xyz;
    vec2 a = (vec2(c) + h.xy) * cs;
    float ang = h2.x * 6.2831853;
    vec2 dir = vec2(cos(ang), sin(ang));
    vec2 nrm = vec2(-dir.y, dir.x);
    float L = len * (0.25 + 0.75 * h2.y);
    vec2 v = p - a;
    float t = dot(v, dir);
    float tc = clamp(t, 0.0, L);
    float bend = (h2.z - 0.5) * 0.012 * tc * (tc - L) / max(L, 1.0);
    float dn = abs(dot(v, nrm) - bend);
    float dist = length(vec2(dn, t - tc));
    float w = wid * (0.4 + 1.2 * fract(h2.z * 37.0));
    float taper = sin(PI * clamp(t / L, 0.0, 1.0));
    float e = max(fp, 0.03);
    acc = max(acc, taper * clamp((w - dist) / e + 0.5, 0.0, 1.0) * min(1.0, w / e));
  }
  return acc;
}

// iq's exact triangle distance
float sdTri(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}

// ---------------------------------------------------------------- stones
#if FAMILY >= 0
struct Stone {
  uvec3 h; bool dark; bool cement; bool mid; bool clay; int nv; vec2 v[10]; float rc; vec2 cen;
  int design; float dsize; float variant; vec2 dp; vec4 d2;
  float dish; float re; float chip; float eros; float ang;
};

Stone makeStone(int slot) {
  Stone s;
  uvec4 u = texelFetch(uSlotU, ivec2(0, slot), 0);
  s.h = u.xyz;
  s.dark = (u.w & 1u) != 0u;
  s.cement = (u.w & 2u) != 0u;
  s.mid = (u.w & 4u) != 0u;
  s.clay = (u.w & 8u) != 0u;
  vec4 t0 = texelFetch(uSlotF, ivec2(0, slot), 0);
  vec4 t1 = texelFetch(uSlotF, ivec2(1, slot), 0);
  vec4 t2 = texelFetch(uSlotF, ivec2(2, slot), 0);
  vec4 t3 = texelFetch(uSlotF, ivec2(3, slot), 0);
  vec4 t9 = texelFetch(uSlotF, ivec2(4, slot), 0);
  s.v[0] = t0.xy; s.v[1] = t0.zw; s.v[2] = t1.xy; s.v[3] = t1.zw; s.v[4] = t2.xy;
  s.v[5] = t2.zw; s.v[6] = t3.xy; s.v[7] = t3.zw; s.v[8] = t9.xy; s.v[9] = t9.zw;
  vec4 t4 = texelFetch(uSlotF, ivec2(5, slot), 0);
  vec4 t5 = texelFetch(uSlotF, ivec2(6, slot), 0);
  s.nv = int(t4.x + 0.5);
  s.rc = t4.y;
  s.design = int(t4.w + 0.5);
  s.dsize = t5.x;
  s.variant = t5.y;
  s.dp = t5.zw;
  s.d2 = texelFetch(uSlotF, ivec2(7, slot), 0);
  s.cen = vec2(0.0);
  vec3 r1 = vec3(s.h) * INV32;
  vec3 r2 = hrnd(s.h, 0x68e31da4u);
  vec3 r4 = hrnd(s.h, 0xa511e9b3u);
  s.dish = r1.y * (s.cement ? 0.4 : 1.5);
  s.re = (0.4 + 1.3 * r4.x) * uMisc.y * (s.clay ? 0.8 : s.dark ? 1.0 : 0.45) * (s.cement ? 0.5 : 1.0);
  s.chip = r4.y * r4.y;
  float e = fract(r4.z * 113.7);
  s.eros = (!s.dark && !s.cement && !s.clay && r4.z < uLightP.y) ? uLightP.z * (0.35 + 0.65 * e) : 0.0;
  s.ang = fract(r1.z * 71.3 + r2.x) * 6.2831853;
  return s;
}

// exact distance to the stone's convex polygon, rounded at the corners by rc (iq's sdPolygon)
float baseSD(Stone s, vec2 q) {
  vec2 d0 = q - s.v[0];
  float d = dot(d0, d0);
  float sg = 1.0;
  for (int i = 0; i < s.nv; i++) {
    int j = i == 0 ? s.nv - 1 : i - 1;
    vec2 vi = s.v[i], vj = s.v[j];
    vec2 e = vj - vi, w = q - vi;
    vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(q.y >= vi.y, q.y < vj.y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) sg *= -1.0;
  }
  return sg * sqrt(d) - s.rc;
}

// Hand-dressed outline: gentle waviness plus chipped bites.
float stoneSD(Stone s, vec2 q, float fp, out float chipF) {
  float d = baseSD(s, q);
  chipF = 0.0;
  if (d > 9.0) return d;
  uint sd = s.h.x;
  float wv = s.cement ? 0.2 : s.clay ? 0.55 : 1.0;   // pressed cement is nearly straight-edged, moulded clay less so
  d += wv * (0.9 * gnoise(q / 85.0, sd) + 0.45 * gnoise(q / 24.0, sd + 1u));
  if (fp < 1.2) d += wv * 0.12 * gnoise(q / 5.0, sd + 2u);
  float cn = gnoise(q / 13.0, sd + 3u) + 0.35 * gnoise(q / 4.0, sd + 4u);
  float thr = 1.15 - 0.5 * s.chip;
  chipF = smoothstep(thr, thr + 0.3, cn) * smoothstep(-14.0, -2.0, d);
  return d + chipF * 1.0;
}

vec2 texCoord(Stone s, vec2 q) {
  vec2 v = q - s.cen;
  float c = cos(s.ang), sn = sin(s.ang);
  return vec2(c * v.x - sn * v.y, sn * v.x + c * v.y);
}

// Surface relief in mm. detail: the fine part, used for cavity darkening.
// Layers, dark stone: swell, grain, smoothed scuffing.
//         light stone: swell, flaking terraces, pitted skin, grain.
const float RD_SC[4] = float[4](95.0, 1.1, 7.0, 1.0);
const int   RD_OC[4] = int[4](2, 2, 3, 0);
const float RL_SC[4] = float[4](95.0, 24.0, 5.0, 0.9);
const int   RL_OC[4] = int[4](2, 4, 3, 2);

float relief(Stone s, vec2 tq, float fp, out float detail, out float pit) {
  uint sd = s.h.y;
  float h = 0.0, det = 0.0;
  float pd;
#if FAMILY == 1
  h = 0.12 * fbm(tq / 80.0, sd, 2, fp / 80.0);
  det = 0.05 * fbm(tq / 1.6, sd + 9u, 2, fp / 1.6);
  pit = dots(tq, 7.0, 0.12, 0.1, 0.45, sd + 17u, fp, pd);
  detail = det - pd * 0.15;
  return h + det - pd * 0.15;
#elif FAMILY == 3
  // glaze: a glassy skin, gently wavy where it flowed, with a few pinholes
  h = 0.10 * fbm(tq / 35.0, sd, 3, fp / 35.0);
  det = 0.012 * fbm(tq / 2.0, sd + 9u, 2, fp / 2.0);
  pit = dots(tq, 11.0, 0.05, 0.08, 0.3, sd + 17u, fp, pd);
  detail = det - pd * 0.1;
  return h + det - pd * 0.1;
#elif FAMILY == 2
  // hand-moulded clay: a cushioned, uneven face, sanded, pitted where air was trapped
  h = 0.3 * fbm(tq / 70.0, sd, 3, fp / 70.0);
  det = 0.10 * fbm(tq / 3.0, sd + 9u, 3, fp / 3.0) + 0.07 * fbm(tq / 0.8, sd + 11u, 2, fp / 0.8);
  // pits of every size, thicker in some parts of the tile than others
  pit = dots(tq, 8.0, 0.12 + 0.18 * smoothstep(-0.3, 0.4, fbm(tq / 50.0, sd + 13u, 2, fp / 50.0)), 0.15, 1.7, sd + 17u, fp, pd);
  detail = det - pd * 0.6;
  return h + det - pd * 0.6;
#else
  for (int i = 0; i < 4 * uLoop; i++) {
    float sc = s.dark ? RD_SC[i] : RL_SC[i];
    int oc = s.dark ? RD_OC[i] : RL_OC[i];
    if (oc == 0) continue;
    float v = fbm(tq / sc, sd + uint(i) * 5u, oc, fp / sc);
    if (i == 0) h += 0.9 * v;
    else if (s.dark) det += (i == 1 ? 0.15 : 0.22) * v;
    else if (i == 1) {
      float t = v * 2.6 + 0.3;
      det += (0.3 + s.eros * 1.1) * (floor(t) + smoothstep(0.3, 0.7, fract(t)));
    } else if (i == 2) det += (0.4 + s.eros * 0.25) * v;
    else det += 0.04 * v;
  }
  // honed marble keeps little of the grain and pitting of stone
  float sm = 1.0 - uVein.w;
  det *= sm;
  h += det;
  float prob = s.dark ? 0.12 : 0.05 + 0.2 * s.eros;
  pit = dots(tq, 24.0, prob, 0.35, 2.6, sd + 17u, fp, pd) * sm;
  h -= pd * 1.4 * sm;
  detail = det - pd * 1.4 * sm;
  return h;
#endif
}

// Height relative to the nominal top of the stone, mm.
float stoneHeight(Stone s, vec2 q, float d, float chipF, float fp, out float detail, out float pit) {
  // worn arris: a soft roll whose width wanders along the edge, steeper where chipped
  float re = s.re * (0.35 + 1.3 * (0.5 + 0.5 * gnoise(q / 32.0, s.h.y + 5u))) + chipF * 3.0;
  float x = d + re;
  float drop = re * 0.5;
  float e = 0.0;
  if (x > 0.0) e = x < re ? -drop * (x / re) * (x / re) : -drop - (x - re) * 6.0;
  vec2 rq = q - s.cen;
  // lippage and tilt are in the geometry; only the worn dish is in the surface
  float base = -s.dish * (1.0 - clamp(dot(rq, rq) / 14400.0, 0.0, 1.0));
  detail = 0.0; pit = 0.0;
  float r = 0.0;
  if (d < 1.5) r = relief(s, texCoord(s, q), fp, detail, pit);
  return base + e + r;
}

// ---------------------------------------------------------------- materials
#if FAMILY == 0
// Colour layers (scale mm, octaves, warp). Dark: two warp fields, clouds, mottle, grain, fossil density.
// Light: two warp fields, clouds, ochre, grey, mottle, grain.
const float AD_SC[7] = float[7](90.0, 90.0, 55.0, 11.0, 2.4, 30.0, 1.0);
const int   AD_OC[7] = int[7](3, 3, 5, 3, 2, 2, 0);
const float AD_WA[7] = float[7](0.0, 0.0, 1.4, 0.0, 0.0, 0.0, 0.0);
const float AL_SC[7] = float[7](70.0, 70.0, 45.0, 38.0, 60.0, 6.0, 2.0);
const int   AL_OC[7] = int[7](3, 3, 4, 4, 3, 3, 2);
const float AL_WA[7] = float[7](0.0, 0.0, 1.2, 1.0, -1.0, 0.0, 0.0);

// Marble veins: bands across a direction of the stone's own, bent by turbulence, so that they
// run on through the stone and wander, as the folded beds of the marble do. Only some bands
// carry a vein, and each fades in and out along its length. White marble: soft grey streaks
// round a darker core, fainter veins across them; red marble: pale calcite and grey clouds.
// amt: strength.
float veinHash(float id, float k) { return fract(sin(id * 12.9898 + k * 78.233) * 43758.5453); }
vec3 marbleVeins(Stone s, vec3 a, vec2 tq, float fp, float amt) {
  uint sd = s.h.z + 101u;
  vec3 rv = hrnd(s.h, 83u);
  float ang = rv.x * PI;
  mat2 R = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
  vec2 p = R * tq;
  float sp = 70.0 + 90.0 * rv.y;
  // bent gently enough that a band never folds back on itself into a loop
  float turb = fbm(p / 320.0, sd, 4, fp / 320.0) + 0.06 * fbm(p / 30.0, sd + 3u, 3, fp / 30.0);
  float t = p.y / sp + 1.1 * turb + rv.z * 7.0;
  float id = floor(t + 0.5);
  float dl = abs(t - id) * sp * 0.85;                 // roughly millimetres
  float along = smoothstep(-0.2, 0.3, fbm(vec2(p.x / 120.0, id * 3.7), sd + 5u, 3, fp / 120.0)) * step(0.4, veinHash(id, rv.x));
  float core = along * smoothstep(0.8 + 1.8 * along + fp, 0.0, dl);
  float halo = along * exp(-dl / (5.0 + 10.0 * along));
  vec2 q = mat2(0.765, 0.644, -0.644, 0.765) * p;
  float sp2 = 35.0 + 25.0 * rv.z;
  float t2 = q.y / sp2 + 0.9 * fbm(q / 90.0, sd + 7u, 3, fp / 90.0);
  float id2 = floor(t2 + 0.5);
  float on2 = step(0.6, veinHash(id2, rv.y + 3.1)) * smoothstep(0.0, 0.4, fbm(vec2(q.x / 70.0, id2 * 2.3), sd + 9u, 2, fp / 70.0));
  float fine = on2 * smoothstep(0.5 + fp, 0.0, abs(t2 - id2) * sp2 * 0.6);
  if (!s.mid) {
    a = mix(a, a * vec3(0.86, 0.87, 0.90), halo * 0.65 * amt);
    a = mix(a, a * vec3(0.60, 0.62, 0.66), core * 0.8 * amt);
    a = mix(a, a * vec3(0.84, 0.86, 0.89), fine * 0.45 * amt);
  } else {
    float cloud = smoothstep(0.05, 0.45, fbm(tq / 70.0 + 5.0, sd + 13u, 4, fp / 70.0));
    a = mix(a, a * vec3(0.78, 0.86, 0.92), cloud * 0.5 * amt);
    a = mix(a, a * vec3(1.12, 1.07, 1.05), halo * 0.4 * amt);
    a = mix(a, vec3(0.50, 0.47, 0.43), core * 0.7 * amt);
    a = mix(a, vec3(0.42, 0.40, 0.38), fine * 0.4 * amt);
  }
  return a;
}
#endif

#if FAMILY == 2
// Fired clay: one clay per tile, its firing different from tile to tile and across the tile
// (the side nearer the fire darker and browner), sand and grog and iron in it, now and then a
// white speck of lime; waxed, paler and duller in the drifts people walk, dirt in the low parts.
// uDarkP: firing spread, flashing, lime specks.
vec3 clayAlbedo(Stone s, vec2 tq, float fp, float d, float detail, float pit, out float rough) {
  uint sd = s.h.z;
  vec3 r = hrnd(s.h, 11u), r2 = hrnd(s.h, 41u), r3 = hrnd(s.h, 53u);
  vec3 base = s.dark ? uDarkAlb : (s.mid ? uMidAlb : uLightAlb);
  float fire = r.x + r.y - 1.0;
  vec3 a = base * exp(fire * uDarkP.x * 2.0) * mix(vec3(1.0), vec3(0.88, 0.82, 0.80), clamp(fire, 0.0, 1.0) * 0.6);
  // and its hue: some tiles more orange or yellow, some redder
  float hz = r.z - 0.5;
  a *= vec3(1.0, 1.0 + 0.18 * hz, 1.0 + 0.12 * hz);
  float fa = r2.x * 6.2831853;
  float side = dot(tq, vec2(cos(fa), sin(fa))) / 140.0 + 0.35 * fbm(tq / 70.0, sd + 3u, 3, fp / 70.0);
  a *= mix(vec3(1.0), vec3(0.76, 0.70, 0.68), smoothstep(0.05, 0.75, side) * r2.y * uDarkP.y);
  // blotches: darker, redder clouds where the clay was richer in iron, paler where sandier
  float c1 = fbm(tq / 45.0, sd + 7u, 4, fp / 45.0), c2 = fbm(tq / 6.0, sd + 9u, 3, fp / 6.0);
  float c3 = fbm(tq / 22.0 + 3.7, sd + 27u, 4, fp / 22.0);
  a *= (1.0 + 0.16 * c1) * (1.0 + 0.12 * c2);
  a = mix(a, a * vec3(0.80, 0.66, 0.60), smoothstep(0.15, 0.55, c3) * 0.6);
  a = mix(a, a * vec3(1.10, 1.12, 1.08), smoothstep(0.2, 0.6, -c3) * 0.4);
  float pd;
  float sand = dots(tq, 1.8, 0.35, 0.10, 0.35, sd + 13u, fp, pd);
  float iron = dots(tq, 4.5, 0.18, 0.12, 0.5, sd + 17u, fp, pd);
  a = mix(a, a * 1.35 + vec3(0.02), sand * 0.45);
  a = mix(a, a * 0.45, iron * 0.6);
  float lime = dots(tq, 38.0, 0.06, 0.6, 2.2, sd + 19u, fp, pd) * step(1.0 - uDarkP.z, r3.x);
  a = mix(a, vec3(0.60, 0.56, 0.50), lime * 0.8);
  float worn = smoothstep(0.0, 0.8, fbm(tq / 60.0 + 4.0, sd + 23u, 4, fp / 60.0)) * (0.3 + 0.7 * r3.y);
  a = mix(a, a * vec3(1.08, 1.06, 1.04), worn * 0.4);
  float sc = scratches(tq, 30.0, 0.45 * uMisc.w, 40.0, 0.12, sd + 59u, fp);
  a = mix(a, a * 1.3, sc * 0.4);
  // dirt: in the pits and low places, and along the worn, rounded edges
  a *= clamp(1.0 + detail * 0.35, 0.72, 1.08);
  a *= 1.0 - 0.55 * pit;
  a *= 1.0 - uMisc.z * (0.5 + 0.6 * r.z) * exp(min(d, 0.0) / 6.0);
  rough = 0.52 - 0.16 * worn + 0.14 * (1.0 - r3.y);
  return a;
}
#endif

#if FAMILY == 0
vec3 stoneAlbedo(Stone s, vec2 tq, float fp, float d, float detail, float pit, out float rough) {
  bool dk = s.dark;
  uint sd = s.h.z;
  vec3 r = hrnd(s.h, 11u);
  vec3 r2 = hrnd(s.h, 41u);
  float n0 = 0.0, n1 = 0.0, n2 = 0.0, n3 = 0.0, n4 = 0.0, n5 = 0.0, n6 = 0.0;
  vec2 w = vec2(0.0);
  for (int i = 0; i < 7 * uLoop; i++) {
    float sc = dk ? AD_SC[i] : AL_SC[i];
    int oc = dk ? AD_OC[i] : AL_OC[i];
    float wa = dk ? AD_WA[i] : AL_WA[i];
    float v = oc > 0 ? fbm(tq / sc + w * wa + vec2(float(i) * 17.31), sd + uint(i) * 7u, oc, fp / sc) : 0.0;
    if (i == 0) n0 = v; else if (i == 1) { n1 = v; w = vec2(n0, n1); }
    else if (i == 2) n2 = v; else if (i == 3) n3 = v; else if (i == 4) n4 = v;
    else if (i == 5) n5 = v; else n6 = v;
  }
  float tone = r.x + r.y - 1.0;
  float hue = r.z - 0.5;
  vec3 a;
  float haze = 0.0, hazeAmt = 0.0, dkk = 0.0;
  if (dk) {
    a = uDarkAlb * exp(tone * uDarkP.x) * vec3(1.0 - hue * 0.14, 1.0 - hue * 0.03, 1.0 + hue * 0.16);
    hazeAmt = uDarkP.y * (0.25 + 1.3 * r2.x * r2.x);
    haze = smoothstep(-0.35, 0.75, n2 + 0.2 * (r2.y - 0.5));
    a = mix(a, a * 1.9 + vec3(0.010, 0.011, 0.012), haze * hazeAmt);
    dkk = smoothstep(-0.25, 0.75, -n2);
    a *= 1.0 - 0.40 * dkk * (0.3 + r2.z);
    a *= exp(0.7 * n0) * (1.0 + 0.30 * n3) * (1.0 + 0.5 * n4);
  } else {
    a = (s.mid ? uMidAlb : uLightAlb) * exp(tone * uLightP.x) * vec3(1.0 + hue * 0.05, 1.0, 1.0 - hue * 0.16);
    a *= exp(0.18 * n0) * (1.0 + 0.14 * n2);
    a = mix(a, a * vec3(1.0, 0.90, 0.74), smoothstep(0.1, 0.6, n3) * (0.15 + 0.6 * r2.x * r2.x) * uVein.z);
    a = mix(a, a * vec3(0.86, 0.87, 0.88), smoothstep(0.15, 0.6, n4) * 0.6 * r2.y);
    a *= (1.0 + 0.13 * n5) * (1.0 + 0.16 * n6);
    float vs = s.mid ? uVein.y : uVein.x;
    if (vs > 0.0) a = marbleVeins(s, a, tq, fp, vs);
  }
  // specks: crinoid debris in petit granit (two sizes), dark grains in limestone
  float spk = 0.0;
  for (int i = 0; i < 2 * uLoop; i++) {
    float prob = dk ? uDarkP.z * (i == 0 ? 0.28 : 0.22) : (i == 0 ? 0.08 : 0.0);
    if (prob <= 0.0) continue;
    float pd;
    float cs = dk ? (i == 0 ? 2.6 : 11.0) : 5.0;
    float r0 = dk ? (i == 0 ? 0.15 : 0.6) : 0.12;
    float r1 = dk ? (i == 0 ? 0.7 : 2.4) : 0.45;
    float cov = dots(tq, cs, prob, r0, r1, sd + 31u + uint(i) * 6u, fp, pd);
    spk = max(spk, cov * (dk && i == 0 ? 0.7 : 1.0));
  }
  if (dk) a = mix(a, vec3(0.20, 0.205, 0.21), clamp(spk * (0.6 + 0.4 * n5), 0.0, 1.0) * 0.75);
  else a *= 1.0 - 0.25 * spk;
  // one line through the stone: a calcite vein in the dark stone, a dirty hairline crack in the light
  bool line = dk ? r2.x < uDarkP.w : (r.y * 0.5 + r2.y * 0.5 < uLightP.w);
  if (line) {
    vec3 rv = hrnd(s.h, 71u);
    float ang = rv.x * PI;
    vec2 nn = vec2(cos(ang), sin(ang));
    float along = dot(tq, vec2(-nn.y, nn.x));
    float ws = dk ? 60.0 : 30.0;
    float dl = abs(dot(tq, nn) - (rv.y - 0.5) * (dk ? 120.0 : 50.0)
               + (dk ? 9.0 : 6.0) * fbm(vec2(along / ws, rv.z * 9.0), sd + 43u, dk ? 3 : 4, fp / ws));
    float g = gnoise(vec2(along / (dk ? 25.0 : 12.0), 3.1), sd + 47u);
    float wl = dk ? 0.18 + 0.35 * (0.5 + 0.5 * g) : 0.22 + 0.15 * g;
    float e = max(fp, 0.04);
    float ln = clamp((wl - dl) / e + 0.5, 0.0, 1.0) * min(1.0, wl / e);
    if (dk) {
      ln *= smoothstep(-0.2, 0.3, gnoise(vec2(along / 90.0, 7.7), sd + 53u));
      a = mix(a, vec3(0.30, 0.31, 0.31), ln * 0.8);
    } else {
      a *= 1.0 - 0.6 * ln - 0.07 * exp(-dl / 1.8);
    }
  }
  // stains on the porous light stone
  if (!dk && r2.z < 0.16) {
    vec3 rs = hrnd(s.h, 97u);
    vec2 c = (rs.xy - 0.5) * 120.0;
    float rr = 10.0 + 35.0 * rs.z;
    float blob = smoothstep(1.0, 0.2, length(tq - c) / rr + 0.8 * fbm(tq / 14.0, sd + 29u, 3, fp / 14.0));
    a *= 1.0 - blob * (0.05 + 0.12 * rs.z) * vec3(1.0, 1.05, 1.12);
  }
  // scuffs and scratches: abraded and pale on the dark stone, faintly dirty on the light
  float sc = 0.0;
  for (int i = 0; i < 2 * uLoop; i++) {
    if (!dk && i == 1) continue;
    float cell = i == 0 ? (dk ? 42.0 : 40.0) : 16.0;
    float prob = (i == 0 ? (dk ? 0.55 : 0.35) : 0.35) * uMisc.w;
    float len = i == 0 ? (dk ? 58.0 : 45.0) : 18.0;
    float wid = i == 0 ? (dk ? 0.16 : 0.12) : 0.10;
    float v = scratches(tq, cell, prob, len, wid, sd + 59u + uint(i) * 2u, fp);
    sc = max(sc, v * (i == 0 ? 1.0 : 0.6));
  }
  if (dk) {
    a = mix(a, a * 2.1 + vec3(0.02), sc * 0.65);
    a *= 1.0 - uMisc.z * (0.5 + r.z) * exp(min(d, 0.0) / 5.0);
    a *= 1.0 - 0.55 * pit;
    a *= clamp(1.0 + detail * 0.9, 0.55, 1.15);
    rough = clamp(uRough.x + 0.25 * haze * hazeAmt - 0.12 * dkk + 0.2 * sc, 0.25, 0.95);
  } else {
    // eroded skins: dirt sits in the low parts
    a *= clamp(1.0 + detail * (0.10 + 0.12 * s.eros), 0.8, 1.06);
    a *= mix(vec3(1.0), vec3(1.0, 0.95, 0.88), clamp(-detail * 0.3, 0.0, 1.0));
    a *= 1.0 - uMisc.z * (0.3 + 0.6 * r.z) * 0.45 * exp(min(d, 0.0) / 1.5) * vec3(1.0, 1.03, 1.08);
    a *= 1.0 - 0.3 * pit;
    a *= 1.0 - 0.18 * sc;
    rough = uRough.y + 0.1 * s.eros;
  }
  return a;
}
#endif
#endif

vec3 albedoFill(vec2 p, float fp) {
  float n = fbm(p / 2.0, uSeed + 71u, 2, fp / 2.0);
  float pd;
  float grains = dots(p, 0.9, 0.5, 0.08, 0.3, uSeed + 73u, fp, pd);
  vec3 a = uFillAlb * (1.0 + 0.18 * n);
  return mix(a, a * 1.5, grains * 0.4);
}

// Lime-sand bed: trowel strokes, sand, clouds, damp patches, chalk-line wobble.
const float BD_SC[5] = float[5](5.0, 0.7, 140.0, 380.0, 9.0);
const int   BD_OC[5] = int[5](3, 2, 3, 2, 3);

vec3 albedoBed(vec2 p, float fp, out float hgt) {
  float ang = 2.2 * gnoise(p / 260.0, uSeed + 41u);
  vec2 rp = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p;
  float n0 = 0.0, n1 = 0.0, n2 = 0.0, n3 = 0.0, n4 = 0.0;
  for (int i = 0; i < 5 * uLoop; i++) {
    vec2 pp = i == 0 ? rp * vec2(5.0 / 40.0, 1.0) : p;
    float v = fbm(pp / BD_SC[i], uSeed + 43u + uint(i) * 4u, BD_OC[i], fp / BD_SC[i]);
    if (i == 0) n0 = v; else if (i == 1) n1 = v; else if (i == 2) n2 = v; else if (i == 3) n3 = v; else n4 = v;
  }
  float pd;
  float grit = dots(p, 3.0, 0.25, 0.2, 0.8, uSeed + 57u, fp, pd);
  vec3 a = uBedAlb * (1.0 + 0.07 * n2 + 0.05 * n0 + 0.22 * n1 + 0.08 * n4);
  a = mix(a, a * vec3(0.78, 0.76, 0.72), grit * 0.5);
  a *= 1.0 - 0.12 * smoothstep(0.0, 0.6, n3);
  // snapped chalk lines every four cells
  vec2 g = (p - uOrigin) / (uPitch * 4.0);
  vec2 dl = abs(fract(g + 0.5) - 0.5) * uPitch * 4.0;
  float line = max(smoothstep(1.4 + fp, 0.6, dl.x), smoothstep(1.4 + fp, 0.6, dl.y));
  line *= 0.25 + 0.75 * smoothstep(-0.3, 0.5, gnoise(p / 30.0, uSeed + 63u));
  a = mix(a, vec3(0.16, 0.24, 0.42), line * 0.45);
  hgt = 0.35 * n0 + 0.16 * n1 + 0.6 * n4 + 0.8 * n2 - 0.3 * pd;
  return a;
}

// ---------------------------------------------------------------- light
vec3 shade(vec3 alb, vec3 n, vec3 V, float rough, float shadow, float ao, vec2 p) {
  vec3 L = uSunDir;
  float NdL = max(dot(n, L), 0.0);
  float NdV = max(dot(n, V), 1e-3);
  vec3 H = normalize(L + V);
  float NdH = max(dot(n, H), 0.0);
  float a = rough * rough;
  float a2 = a * a;
  float dd = NdH * NdH * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * dd * dd);
  float k = a * 0.5;
  float G = NdL / (NdL * (1.0 - k) + k) * NdV / (NdV * (1.0 - k) + k);
  float F = 0.04 + 0.96 * pow(1.0 - max(dot(H, V), 0.0), 5.0);
  float spec = D * G * F / (4.0 * NdV + 1e-3);
  vec2 lx = normalize(L.xy);
  float grad = 1.0 + 0.17 * clamp(dot(p - uFloorC, lx) / uFloorR, -1.0, 1.0);
  vec3 sun = uSunCol * grad;
  vec3 sky = uSkyCol * (0.55 + 0.45 * n.z) * ao * (0.92 + 0.08 * grad);
  vec3 c = alb * (sun * NdL * shadow + sky);
  c += sun * spec * NdL * shadow + uSkyCol * ao * F * (1.0 - rough) * 0.25;
  return c;
}

// ---------------------------------------------------------------- girih straps
#if FAMILY == 1 || FAMILY == 3
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  return length(p - a - ab * clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0));
}
bool segRay(vec2 p, vec2 a, vec2 b) {
  return (a.y > p.y) != (b.y > p.y) && p.x < a.x + (p.y - a.y) * (b.x - a.x) / (b.y - a.y);
}

// From the middle of every edge, two straps at 54° to it. At a convex corner the two that lean
// towards it meet on its bisector, at d = ½ edge · sin 54° / sin(126° − α/2) from it (Hankin's
// method); at the bowtie's reflex corners they run on across the tile to d2. Returns the
// distance to the nearest strap; star: inside an odd number of strap loops, counted along a ray.
float girihStraps(Stone s, vec2 q, out bool star) {
  float dmin = 1e9;
  star = false;
  int nr = 0;
  for (int k = 0; k < 10 * uLoop; k++) {
    if (k >= s.nv) break;
    vec2 a = s.v[k == 0 ? s.nv - 1 : k - 1], b = s.v[k], c = s.v[k + 1 < s.nv ? k + 1 : 0];
    vec2 ma = 0.5 * (a + b), mc = 0.5 * (b + c);
    vec2 p1, p2;
    if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) > 0.0) {
      vec2 na = normalize(a - b), nc = normalize(c - b);
      float al = acos(clamp(dot(na, nc), -1.0, 1.0));
      p1 = b + normalize(na + nc) * (0.5 * length(a - b) * 0.80901699 / sin(2.19911486 - 0.5 * al));
      p2 = p1;
    } else {
      p1 = nr == 0 ? s.d2.xy : s.d2.zw;
      p2 = nr == 0 ? s.d2.zw : s.d2.xy;
      nr++;
    }
    dmin = min(dmin, min(segDist(q, ma, p1), segDist(q, mc, p2)));
    if (segRay(q, ma, p1)) star = !star;
    if (segRay(q, mc, p2)) star = !star;
  }
  return dmin;
}
#endif

// ---------------------------------------------------------------- cement tiles
#if FAMILY == 1
// The figure of a tile in its own frame. x: where the second pigment lies, y: the third.
// Fields (negative distance inside the figure):
//   1  Smith's quarter circles: discs in two opposite corners
//   5  one round corner and one straight one (half Smith, half Truchet)
//   3  hexagon: discs at alternate corners
// Bands (distance to a centre line):
//   2  hexagon: three arcs round alternate corners
//   4  square: two arcs round opposite corners
//   6  rhomb: Penrose's two families of arcs, round (−size, 0) and (size, 0), or on the y axis
//      for variant 1, radii dp.x and dp.y. d2: half widths of the two families; style = lines
//      (1 or 2) + 4 × the second family (0 ring, 1 double ring, 2 disc, 3 disc in a ring,
//      4 none); inks (0 second and third pigment, 1 swapped, 2 one pigment, 3 dark ground)
//   7  girih: straps by Hankin's method on the tile's own corners. dp.x: half width of a strap;
//      dp.y: 0 straps alone, 1 stars filled, 2 the rest filled, plus 4 for double straps.
//      d2: where the straps from the reflex corners of a bowtie cross.
// The variant prints the tile the other way round. dp.x outlines a field in the third pigment,
// or is the width of a square's band; dp.y runs a line of the third pigment along a band.
// The pigments were poured against a brass divider, so borders wander and bleed a little.
// Girih in cement: the straps in one pigment, and the stars or the rest filled with another.
vec2 girihMask(Stone s, vec2 q, float e, float wob) {
  bool star;
  float dmin = girihStraps(s, q, star);
  int style = int(s.dp.y + 0.5);
  float hw = s.dp.x;
  float strap = smoothstep(e, -e, dmin - hw + wob);
  if (style >= 4) strap = max(strap - smoothstep(e, -e, dmin - 0.38 * hw + wob), 0.0);
  float st = star ? 1.0 : 0.0;
  if ((style & 3) == 0) return vec2(strap, 0.0);
  if ((style & 3) == 1) return vec2(st, strap);
  return vec2(1.0 - st, strap);
}

vec2 designMask(Stone s, vec2 q, float fp) {
  float wob = 0.4 * gnoise(q / 4.0, s.h.x + 61u) + 0.06 * gnoise(q / 1.3, s.h.x + 67u);
  float e = max(fp, 0.15) + 0.4;
  if (s.design == 7) return girihMask(s, q, e, wob);
  float h = s.dsize;
  float fig = 1e9, band = 1e9, hw = 0.0;
  if (s.design == 6) {
    vec2 ax = s.variant > 0.5 ? vec2(0.0, h) : vec2(h, 0.0);
    float dB = length(q + ax) - s.dp.x, dC = length(q - ax) - s.dp.y;
    float hb = s.d2.x, hc = s.d2.y;
    int style = int(s.d2.z + 0.5), ink = int(s.d2.w + 0.5);
    int cs = style / 4;
    float ob = hb + 3.0, oc = hc + 3.0;
    float bB = (style & 3) == 2 ? min(abs(dB - ob), abs(dB + ob)) : abs(dB);
    float fB = smoothstep(e, -e, bB - hb + wob);
    float fC = 0.0;
    if (cs == 0) fC = smoothstep(e, -e, abs(dC) - hc + wob);
    else if (cs == 1) fC = smoothstep(e, -e, min(abs(dC - oc), abs(dC + oc)) - hc + wob);
    else if (cs == 2) fC = smoothstep(e, -e, dC + wob);
    else if (cs == 3) fC = max(smoothstep(e, -e, abs(dC) - hc + wob), smoothstep(e, -e, dC + hc + 5.0 + wob));
    if (ink == 1) return vec2(fC, fB);
    if (ink == 2) return vec2(max(fB, fC), 0.0);
    if (ink == 3) return vec2(1.0 - fB, fC);
    return vec2(fB, fC);
  }
  if (s.design == 1) fig = min(length(q - vec2(-h)), length(q - vec2(h))) - h;
  else if (s.design == 5) fig = min(length(q - vec2(-h)) - h, (h - q.x - q.y) * 0.70710678);
  else if (s.design == 4) { band = min(abs(length(q - vec2(-h)) - h), abs(length(q - vec2(h)) - h)); hw = s.dp.x * 0.5; }
  else {
    for (int k = 0; k < 3 * uLoop; k++) {
      float ang = float(k) * 2.0943951;
      float r = length(q - h * vec2(cos(ang), sin(ang)));
      fig = min(fig, r - h * 0.5);
      band = min(band, abs(r - h * 0.5));
    }
    if (s.design == 2) { fig = 1e9; hw = h * 0.15; } else band = 1e9;
  }
  float m, m3 = 0.0;
  if (fig < 1e8) {
    m = smoothstep(e, -e, fig + wob);
    if (s.dp.x > 0.0) m3 = smoothstep(e, -e, abs(fig + wob) - s.dp.x * 0.5);
  } else {
    m = smoothstep(e, -e, band - hw + wob);
    if (s.dp.y > 0.0) m3 = smoothstep(e, -e, band - s.dp.y * 0.5 + 0.5 * wob);
  }
  if (s.variant > 0.5) m = 1.0 - m;
  return vec2(m, m3);
}

vec3 cementAlbedo(Stone s, vec2 q, vec2 tq, float fp, float d, float detail, float pit, out float rough) {
  uint sd = s.h.z;
  vec3 r = hrnd(s.h, 11u), r2 = hrnd(s.h, 29u);
  vec2 mm = designMask(s, q, fp);
  float m = mm.x;
  // every tile its own batch and its own century: some lay under furniture, some by the door
  float age = 0.3 + 0.7 * r2.x;
  vec3 ga = uCementA * exp((r.x - 0.5) * 0.22) * mix(vec3(1.0), vec3(1.0, 0.97, 0.91), r2.y * age);
  vec3 gb = uCementB * exp((r.y - 0.5) * 0.4);
  // poured pigment is cloudy, the dark more so
  float cl = fbm(tq / 40.0, sd, 4, fp / 40.0);
  float fine = fbm(tq / 1.4, sd + 5u, 2, fp / 1.4);
  ga *= 1.0 + 0.06 * cl + 0.06 * fine;
  gb *= 1.0 + 0.24 * cl + 0.12 * fine;
  // traffic thins the waxed face: the figure greys towards the body in drifts,
  // the ground takes up grime there
  float worn = smoothstep(0.0, 0.8, fbm(tq / 55.0 + 9.0, sd + 9u, 4, fp / 55.0)) * age;
  gb = mix(gb, mix(gb, uCementBody * 0.6, 0.5), worn);
  vec3 gc = uCementC * exp((r2.y - 0.5) * 0.3) * (1.0 + 0.2 * cl + 0.1 * fine);
  gc = mix(gc, mix(gc, uCementBody * 0.6, 0.45), worn);
  ga = mix(ga, ga * vec3(0.92, 0.9, 0.86), worn * 0.6);
  float pd;
  float grains = dots(tq, 2.2, 0.22, 0.12, 0.45, sd + 23u, fp, pd);   // marble dust in the face layer
  gb = mix(gb, gb * 2.2 + vec3(0.03), grains * 0.6);
  ga *= 1.0 - 0.12 * grains;
  vec3 a = mix(mix(ga, gb, m), gc, mm.y);
  float sc = scratches(tq, 26.0, (0.3 + 0.5 * age) * uMisc.w, 40.0, 0.1, sd + 59u, fp);
  a = mix(a, a * 1.6 + vec3(0.015), sc * 0.5 * m);
  a *= 1.0 - 0.18 * sc * (1.0 - m);
  // old spills on a few tiles: a soft darker cloud
  float stain = smoothstep(0.3, 0.85, fbm(tq / 90.0 + 3.0, sd + 41u, 3, fp / 90.0)) * step(0.65, r2.z);
  a *= 1.0 - 0.2 * stain * (1.0 - 0.5 * m);
  a *= 1.0 - uMisc.z * (0.6 + 0.6 * age) * exp(min(d, 0.0) / 4.0);
  a *= 1.0 - 0.8 * pit;
  rough = 0.48 + 0.25 * worn + 0.1 * stain;
  return a;
}

#endif

// ---------------------------------------------------------------- glazed tiles
#if FAMILY == 3
// Glazed tiles in the manner of cuerda seca and zellige: each field of the girih in a glaze of
// its own over a red clay body, the straps between them a pale matte line. The variant names
// the stars' glaze (uGlaze[1-4]); the ground round them is uGlaze[0], the lines uGlaze[5]. Each
// tile is its own firing, its glazes a shade lighter or darker, warmer or cooler. Glaze pools
// deeper away from the lines and thins, paler, against them; it carries clouds, a fine craze
// of cracks gone dark with dirt, and pinholes. Feet dull it in drifts and scratch it.
vec3 glazeAlbedo(Stone s, vec2 q, vec2 tq, float fp, float d, float detail, float pit, out float rough) {
  uint sd = s.h.z;
  vec3 r = hrnd(s.h, 11u), r2 = hrnd(s.h, 29u);
  float wob = 0.3 * gnoise(q / 4.0, s.h.x + 61u);
  float e = max(fp, 0.15) + 0.3;
  bool star;
  float dl = girihStraps(s, q, star) - s.dp.x + wob;
  float line = smoothstep(e, -e, dl);
  vec3 g = uGlaze[star ? int(s.variant + 0.5) : 0];
  g *= exp((r.x - 0.5) * 0.25) * vec3(1.0 + 0.08 * (r.y - 0.5), 1.0, 1.0 - 0.08 * (r.y - 0.5));
  g *= mix(1.15, 0.9, smoothstep(0.0, 6.0, dl));
  g *= 1.0 + 0.10 * fbm(tq / 22.0, sd, 4, fp / 22.0);
  float craze = smoothstep(0.012 + fp / 9.0, 0.0, abs(fbm(tq / 9.0 + 2.0, sd + 7u, 3, fp / 9.0))) * (0.3 + 0.7 * r2.x);
  g *= 1.0 - 0.35 * craze;
  float worn = smoothstep(0.1, 0.8, fbm(tq / 60.0 + 4.0, sd + 23u, 4, fp / 60.0)) * (0.2 + 0.8 * r2.y);
  g = mix(g, g * 0.92 + vec3(0.02), worn * 0.5);
  float sc = scratches(tq, 24.0, 0.5 * uMisc.w, 30.0, 0.08, sd + 59u, fp);
  vec3 a = mix(g, uGlaze[5] * (1.0 + 0.08 * fbm(tq / 3.0, sd + 31u, 2, fp / 3.0)), line);
  a = mix(a, a * 1.25 + vec3(0.02), sc * 0.35);
  a *= 1.0 - 0.6 * pit;
  a *= 1.0 - uMisc.z * (0.5 + 0.6 * r.z) * exp(min(d, 0.0) / 2.5);
  // the glaze runs thin over the rounded edge, and the body shows through
  a = mix(a, uCementBody, smoothstep(-1.5, 0.0, d) * 0.35);
  rough = mix(0.10 + 0.30 * worn + 0.2 * sc + 0.15 * craze, 0.65, line);
  return a;
}
#endif

// ---------------------------------------------------------------- surface
#if FAMILY >= 0
vec3 stoneSurface(Stone s, vec2 q, float d, float chipF, float detail, float pit, float fp, out float rough) {
  vec2 tq = texCoord(s, q);
  float ch = chipF * smoothstep(-8.0, -1.0, d);
#if FAMILY == 1
  vec3 a = cementAlbedo(s, q, tq, fp, d, detail, pit, rough);
  // a chipped edge shows the grey concrete body under the pigment layer
  return mix(a, uCementBody * (0.9 + 0.2 * gnoise(q / 2.0, s.h.y + 3u)), ch * 0.85);
#elif FAMILY == 3
  vec3 a = glazeAlbedo(s, q, tq, fp, d, detail, pit, rough);
  // a chip shows the red clay body under the glaze
  rough = mix(rough, 0.85, ch);
  return mix(a, uCementBody * (0.9 + 0.2 * gnoise(q / 2.0, s.h.y + 3u)), ch * 0.9);
#elif FAMILY == 2
  // a chip shows the same clay, unwaxed and a little paler
  vec3 a = clayAlbedo(s, tq, fp, d, detail, pit, rough);
  return mix(a, a * 1.12, ch * 0.6);
#else
  vec3 a = stoneAlbedo(s, tq, fp, d, detail, pit, rough);
  // fresh fracture of chips is paler, then dirt-darkened in the deepest part
  return mix(a, s.dark ? a * 1.9 + vec3(0.02) : a * vec3(1.04, 1.02, 1.0), ch * 0.45);
#endif
}
#endif

vec3 tonemap(vec3 c) {
  c *= uExposure;
  vec3 hi = 0.78 + 0.22 * (1.0 - exp(-(c - 0.78) / 0.22));
  c = mix(c, hi, step(0.78, c));
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}
`;
