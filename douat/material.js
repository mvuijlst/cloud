// The stone, mortar and light model, shared by the bake shaders and the 3D view.
// Millimetres; x to the right, y down the default view, z up out of the floor.
export const MATERIAL = `
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
uniform ivec2 uGrid;
uniform vec2 uOrigin;
uniform usampler2D uCells;      // r: state (0-3 half tiles A-D, 4/5 whole dark/light, 255 none)
                                // g: bit k set when stone k is laid; b: joint filled (0-255)
uniform uint uSeed;

uniform vec3 uDarkAlb, uLightAlb, uBedAlb, uFillAlb;
uniform vec4 uDarkP;            // tone spread, haze, fossils, calcite veins
uniform vec4 uLightP;           // tone spread, erosion share, erosion strength, crack share
uniform vec4 uMisc;             // fill depth mm, edge radius scale, edge grime, scratches
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
uvec4 cellAt(ivec2 c) {
  if (c.x < 0 || c.y < 0 || c.x >= uGrid.x || c.y >= uGrid.y) return uvec4(255u, 0u, 0u, 0u);
  return texelFetch(uCells, c, 0);
}

struct Stone {
  ivec2 cell; int k; int st; bool tri; bool dark; float fill;
  uvec3 h; vec2 org; vec2 cen; vec2 off; float rot;
  vec2 v0, v1, v2; float rc;
  float lip; vec2 tilt; float dish; float re; float chip; float eros; float ang;
};

// cell corners, y down: 0 bottom-left, 1 top-left, 2 top-right, 3 bottom-right
vec2 cornerP(int c) {
  float P = uPitch;
  return c == 0 ? vec2(0.0, P) : (c == 1 ? vec2(0.0) : (c == 2 ? vec2(P, 0.0) : vec2(P)));
}

Stone makeStone(ivec2 cell, int k, uvec4 cd) {
  Stone s;
  s.cell = cell; s.k = k; s.st = int(cd.r);
  s.tri = s.st < 4;
  s.dark = s.tri ? (k == 0) : (s.st == 4);
  s.fill = float(cd.b) / 255.0;
  s.h = pcg3(uvec3(uint(cell.x + 4096), uint(cell.y + 4096) * 2u + uint(k), uSeed));
  vec3 r1 = vec3(s.h) * INV32;
  vec3 r2 = hrnd(s.h, 0x68e31da4u);
  vec3 r3 = hrnd(s.h, 0x7fb5d329u);
  vec3 r4 = hrnd(s.h, 0xa511e9b3u);
  s.org = uOrigin + vec2(cell) * uPitch;
  float hj = uJoint * 0.5 + (r3.x - 0.5) * 1.4;
  s.rc = 0.8 + 2.4 * r1.z;
  if (s.tri) {
    int cc = (k == 0) ? s.st : ((s.st + 2) & 3);
    vec2 C = cornerP(cc), A = cornerP((cc + 1) & 3), B = cornerP((cc + 3) & 3);
    float rin = uPitch * (1.0 - 0.70710678);
    vec2 I = C + rin * (normalize(A - C) + normalize(B - C));
    float f = (rin - hj - s.rc) / rin;
    s.v0 = I + (C - I) * f; s.v1 = I + (A - I) * f; s.v2 = I + (B - I) * f;
    s.cen = (C + A + B) / 3.0;
  } else {
    s.cen = vec2(uPitch * 0.5);
    s.v0 = vec2(uPitch * 0.5 - hj - s.rc);
    s.v1 = s.v0; s.v2 = s.v0;
  }
  s.off = (r2.xy - 0.5) * 2.0 * 1.1;
  s.rot = (r2.z - 0.5) * 2.0 * 0.011;
  s.lip = (r1.x - 0.5) * 1.5;
  s.tilt = (r3.yz - 0.5) * 0.03;
  s.dish = r1.y * 1.5;
  s.re = (0.4 + 1.3 * r4.x) * uMisc.y * (s.dark ? 1.0 : 0.45);
  s.chip = r4.y * r4.y;
  float e = fract(r4.z * 113.7);
  s.eros = (!s.dark && r4.z < uLightP.y) ? uLightP.z * (0.35 + 0.65 * e) : 0.0;
  s.ang = fract(r1.z * 71.3 + r2.x) * 6.2831853;
  return s;
}

vec2 toLocal(Stone s, vec2 p) {
  vec2 q = p - s.org - s.cen - s.off;
  float c = cos(s.rot), sn = sin(s.rot);
  return vec2(c * q.x + sn * q.y, -sn * q.x + c * q.y) + s.cen;
}

float baseSD(Stone s, vec2 q) {
  if (s.tri) return sdTri(q, s.v0, s.v1, s.v2) - s.rc;
  vec2 d = abs(q - s.cen) - s.v0;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - s.rc;
}

// Hand-dressed outline: gentle waviness plus chipped bites.
float stoneSD(Stone s, vec2 q, float fp, out float chipF) {
  float d = baseSD(s, q);
  chipF = 0.0;
  if (d > 9.0) return d;
  uint sd = s.h.x;
  d += 0.9 * gnoise(q / 85.0, sd) + 0.45 * gnoise(q / 24.0, sd + 1u);
  if (fp < 1.2) d += 0.12 * gnoise(q / 5.0, sd + 2u);
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
  h += det;
  float pd;
  float prob = s.dark ? 0.12 : 0.05 + 0.2 * s.eros;
  pit = dots(tq, 24.0, prob, 0.35, 2.6, sd + 17u, fp, pd);
  h -= pd * 1.4;
  detail = det - pd * 1.4;
  return h;
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
// Colour layers (scale mm, octaves, warp). Dark: two warp fields, clouds, mottle, grain, fossil density.
// Light: two warp fields, clouds, ochre, grey, mottle, grain.
const float AD_SC[7] = float[7](90.0, 90.0, 55.0, 11.0, 2.4, 30.0, 1.0);
const int   AD_OC[7] = int[7](3, 3, 5, 3, 2, 2, 0);
const float AD_WA[7] = float[7](0.0, 0.0, 1.4, 0.0, 0.0, 0.0, 0.0);
const float AL_SC[7] = float[7](70.0, 70.0, 45.0, 38.0, 60.0, 6.0, 2.0);
const int   AL_OC[7] = int[7](3, 3, 4, 4, 3, 3, 2);
const float AL_WA[7] = float[7](0.0, 0.0, 1.2, 1.0, -1.0, 0.0, 0.0);

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
    a = uLightAlb * exp(tone * uLightP.x) * vec3(1.0 + hue * 0.05, 1.0, 1.0 - hue * 0.16);
    a *= exp(0.18 * n0) * (1.0 + 0.14 * n2);
    a = mix(a, a * vec3(1.0, 0.90, 0.74), smoothstep(0.1, 0.6, n3) * (0.15 + 0.6 * r2.x * r2.x));
    a = mix(a, a * vec3(0.86, 0.87, 0.88), smoothstep(0.15, 0.6, n4) * 0.6 * r2.y);
    a *= (1.0 + 0.13 * n5) * (1.0 + 0.16 * n6);
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
    rough = clamp(0.48 + 0.25 * haze * hazeAmt - 0.12 * dkk + 0.2 * sc, 0.25, 0.95);
  } else {
    // eroded skins: dirt sits in the low parts
    a *= clamp(1.0 + detail * (0.10 + 0.12 * s.eros), 0.8, 1.06);
    a *= mix(vec3(1.0), vec3(1.0, 0.95, 0.88), clamp(-detail * 0.3, 0.0, 1.0));
    a *= 1.0 - uMisc.z * (0.3 + 0.6 * r.z) * 0.45 * exp(min(d, 0.0) / 1.5) * vec3(1.0, 1.03, 1.08);
    a *= 1.0 - 0.3 * pit;
    a *= 1.0 - 0.18 * sc;
    rough = 0.78 + 0.1 * s.eros;
  }
  return a;
}

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
  vec3 a = uBedAlb * (1.0 + 0.12 * n2 + 0.05 * n0 + 0.22 * n1 + 0.08 * n4);
  a = mix(a, a * vec3(0.78, 0.76, 0.72), grit * 0.5);
  a *= 1.0 - 0.24 * smoothstep(0.0, 0.6, n3);
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

// ---------------------------------------------------------------- surface
vec3 stoneSurface(Stone s, vec2 q, float d, float chipF, float detail, float pit, float fp, out float rough) {
  vec2 tq = texCoord(s, q);
  vec3 a;
  a = stoneAlbedo(s, tq, fp, d, detail, pit, rough);
  // fresh fracture of chips is paler, then dirt-darkened in the deepest part
  float ch = chipF * smoothstep(-8.0, -1.0, d);
  a = mix(a, s.dark ? a * 1.9 + vec3(0.02) : a * vec3(1.04, 1.02, 1.0), ch * 0.45);
  return a;
}

vec3 tonemap(vec3 c) {
  c *= uExposure;
  vec3 hi = 0.78 + 0.22 * (1.0 - exp(-(c - 0.78) / 0.22));
  c = mix(c, hi, step(0.78, c));
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}
`;
