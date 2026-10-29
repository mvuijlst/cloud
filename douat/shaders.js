// GLSL for the floor. The stone and mortar model (material.js) is evaluated once per
// floor into textures; the 3D view then draws real stones from those textures.
// Millimetres: x to the right, y down the default view, z up out of the floor.
import { MATERIAL } from './material.js';

const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
`;

export const QUAD_VS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// ---------------------------------------------------------------- bakes
// One square slot per cell holds both of its stones, in cell coordinates.
// o0: albedo (sRGB target) and roughness. o1: normal xy, cavity, and which stone owns
// the texel (0.5 + (coverage of stone 0 - coverage of stone 1) / 2).
export const BAKE_STONE_FS = `${HEAD}
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
${MATERIAL}
uniform int uSlotCols;
uniform float uSlotPx;
uniform float uMargin;

void main() {
  vec2 px = gl_FragCoord.xy;
  ivec2 slot = ivec2(floor(px / uSlotPx));
  int idx = slot.y * uSlotCols + slot.x;
  ivec2 cell = ivec2(idx % uGrid.x, idx / uGrid.x);
  o0 = vec4(0.0);
  o1 = vec4(0.5, 0.5, 1.0, 0.5);
  if (cell.y >= uGrid.y) return;
  uvec4 cd = cellAt(cell);
  if (cd.r == 255u) return;
  float span = uPitch + 2.0 * uMargin;
  float texel = span / uSlotPx;
  vec2 q = (px - vec2(slot) * uSlotPx) / uSlotPx * span - uMargin;
  Stone s0 = makeStone(cell, 0, cd);
  Stone s1 = s0;
  float c0, c1 = 0.0;
  float d0 = stoneSD(s0, q, texel, c0);
  float d1 = 1e9;
  if (s0.tri) { s1 = makeStone(cell, 1, cd); d1 = stoneSD(s1, q, texel, c1); }
  float cov0 = clamp(0.5 - d0 / texel, 0.0, 1.0);
  float cov1 = clamp(0.5 - d1 / texel, 0.0, 1.0);
  o1.a = 0.5 + 0.5 * (cov0 - cov1);
  if (min(d0, d1) > 3.0 * texel + 4.0) return;
  Stone s = s0;
  float ch = c0, dd = d0;
  if (d1 < d0) { s = s1; ch = c1; dd = d1; }
  float e = texel * 0.75;
  float h0 = 0.0, h1 = 0.0, h2 = 0.0, det = 0.0, pit = 0.0;
  for (int j = 0; j < 3 * uLoop; j++) {
    vec2 p = q + (j == 1 ? vec2(e, 0.0) : (j == 2 ? vec2(0.0, e) : vec2(0.0)));
    float c, dt, pt;
    float d = stoneSD(s, p, texel, c);
    float h = stoneHeight(s, p, d, c, texel, dt, pt);
    if (j == 0) { h0 = h; det = dt; pit = pt; } else if (j == 1) h1 = h; else h2 = h;
  }
  vec3 n = normalize(vec3(-(h1 - h0) / e, -(h2 - h0) / e, 1.0));
  float rough;
  vec3 alb = stoneSurface(s, q, dd, ch, det, pit, texel, rough);
  o0 = vec4(alb, rough);
  o1 = vec4(n.xy * 0.5 + 0.5, clamp(1.0 + det * 0.5, 0.6, 1.0), o1.a);
}
`;

// The lime-sand bed over the whole floor area. o0: albedo, o1: normal xy.
export const BAKE_BED_FS = `${HEAD}
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
${MATERIAL}
uniform vec4 uBedRect;
uniform vec2 uBedSize;

void main() {
  vec2 p = mix(uBedRect.xy, uBedRect.zw, gl_FragCoord.xy / uBedSize);
  float texel = (uBedRect.z - uBedRect.x) / uBedSize.x;
  float e = texel * 0.75;
  float h0 = 0.0, h1 = 0.0, h2 = 0.0;
  vec3 a = vec3(0.0);
  for (int j = 0; j < 3 * uLoop; j++) {
    vec2 q = p + (j == 1 ? vec2(e, 0.0) : (j == 2 ? vec2(0.0, e) : vec2(0.0)));
    float h;
    vec3 c = albedoBed(q, texel, h);
    if (j == 0) { a = c; h0 = h; } else if (j == 1) h1 = h; else h2 = h;
  }
  vec3 n = normalize(vec3(-(h1 - h0) / e, -(h2 - h0) / e, 1.0));
  o0 = vec4(a, 1.0);
  o1 = vec4(n.xy * 0.5 + 0.5, 1.0, 1.0);
}
`;

// ---------------------------------------------------------------- 3D view
// Stone vertices: rest pose in world mm. info: stone half (k), kind (0 top, 1 side).
export const STONE_VS = `#version 300 es
in vec3 aPos;
in vec3 aNrm;
in vec3 aTan;
in vec2 aUV;
in vec2 aInfo;
uniform mat4 uVP;
uniform int uFly;
uniform vec3 uPivot;
uniform mat3 uFlyRot;
uniform vec3 uFlyT;
out vec3 vPos;
out vec3 vNrm;
out vec3 vTan;
out vec2 vUV;
flat out vec2 vInfo;
void main() {
  vec3 p = aPos, n = aNrm, t = aTan;
  if (uFly == 1) { p = uPivot + uFlyRot * (aPos - uPivot) + uFlyT; n = uFlyRot * aNrm; t = uFlyRot * aTan; }
  vPos = p; vNrm = n; vTan = t; vUV = aUV; vInfo = aInfo;
  gl_Position = uVP * vec4(p, 1.0);
}`;

export const GROUND_VS = `#version 300 es
in vec3 aPos;
uniform mat4 uVP;
out vec3 vPos;
void main() { vPos = aPos; gl_Position = uVP * vec4(aPos, 1.0); }`;

const VIEW = `
uniform vec3 uEye;
uniform vec2 uRes;
uniform float uFade;
uniform sampler2D uShadow;      // sun depth over the laid floor
uniform mat4 uLightVP;
uniform vec2 uLightDepth;       // depth range in mm of the sun's orthographic view
uniform float uLightTexel;      // mm per shadow texel
uniform sampler2D uFlyShadow;   // sun depth of the stone in flight only
uniform mat4 uFlyVP;
uniform vec2 uFlyDepth;
uniform float uFlyTexel;
uniform int uFlyOn;
uniform sampler2D uMask;        // coverage of laid stone tops seen from above, mipmapped
uniform vec4 uMaskRect;

const vec2 DISK[12] = vec2[12](
  vec2(-0.326, -0.406), vec2(-0.840, -0.074), vec2(-0.696, 0.457), vec2(-0.203, 0.621),
  vec2(0.962, -0.195), vec2(0.473, -0.480), vec2(0.519, 0.767), vec2(0.185, -0.893),
  vec2(0.507, 0.064), vec2(0.896, 0.412), vec2(-0.322, -0.933), vec2(-0.792, -0.598));

float spin() {
  vec3 g = rnd3(uvec3(uvec2(gl_FragCoord.xy), 977u));
  return g.x * 6.2831853;
}

// Percentage-closer soft shadow: the penumbra grows with the gap between blocker and
// receiver, so a stone held high casts a soft shadow that hardens as it is set down.
float softShadow(sampler2D map, mat4 vp, vec2 range, float texel, vec3 p, float minPen) {
  vec4 lp = vp * vec4(p, 1.0);
  vec3 c = lp.xyz / lp.w * 0.5 + 0.5;
  if (c.x < 0.0 || c.y < 0.0 || c.x > 1.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  float a = spin();
  mat2 R = mat2(cos(a), sin(a), -sin(a), cos(a));
  float bias = 0.6 / (range.y - range.x);
  float search = 24.0 / texel;
  float sum = 0.0, n = 0.0;
  for (int i = 0; i < 12; i++) {
    float d = texture(map, c.xy + R * DISK[i] * search / vec2(textureSize(map, 0))).r;
    if (d < c.z - bias) { sum += d; n += 1.0; }
  }
  if (n < 0.5) return 1.0;
  float gap = (c.z - sum / n) * (range.y - range.x);
  float pen = max(minPen, gap * uSunSoft) / texel;
  float lit = 0.0;
  for (int i = 0; i < 12; i++) {
    float d = texture(map, c.xy + R * DISK[i] * pen / vec2(textureSize(map, 0))).r;
    lit += d < c.z - bias ? 0.0 : 1.0;
  }
  return lit / 12.0;
}

float sunShadow(vec3 p, vec3 n) {
  vec3 q = p + n * 0.4;
  float s = softShadow(uShadow, uLightVP, uLightDepth, uLightTexel, q, 0.8);
  if (uFlyOn == 1) s = min(s, softShadow(uFlyShadow, uFlyVP, uFlyDepth, uFlyTexel, q, 0.8));
  return s;
}

// How much laid stone surrounds p, from the mipmapped coverage map: 0 open, 1 enclosed.
float enclosure(vec2 p, float radiusMm) {
  vec2 uv = (p - uMaskRect.xy) / (uMaskRect.zw - uMaskRect.xy);
  float texel = (uMaskRect.z - uMaskRect.x) / float(textureSize(uMask, 0).x);
  return textureLod(uMask, uv, log2(max(radiusMm / texel, 1.0))).r;
}

vec4 finish(vec3 c, float a) {
  c = tonemap(c);
  vec2 ndc = gl_FragCoord.xy / uRes * 2.0 - 1.0;
  c *= 1.0 - 0.20 * pow(clamp(length(ndc * vec2(0.85, 1.0)) / 1.3, 0.0, 1.0), 2.2);
  vec3 g = rnd3(uvec3(uvec2(gl_FragCoord.xy), uSeed ^ 0x1234567u));
  c += (g.x + g.y - 1.0) * 0.010;
  return vec4(c * uFade, a);
}
`;

export const STONE_FS = `${HEAD}
out vec4 fragColor;
${MATERIAL}
${VIEW}
uniform sampler2D uAtlas0, uAtlas1;
uniform float uAlpha;            // fade-in of the stone in flight, as dithered coverage
in vec3 vPos;
in vec3 vNrm;
in vec3 vTan;
in vec2 vUV;
flat in vec2 vInfo;

void main() {
  vec3 V = normalize(uEye - vPos);
  vec3 N = normalize(vNrm);
  vec3 c;
  float cover = 1.0;
  if (vInfo.y < 0.5) {
    vec4 a1 = texture(uAtlas1, vUV);
    cover = vInfo.x < 0.5 ? clamp(a1.a * 2.0 - 1.0, 0.0, 1.0) : clamp(1.0 - a1.a * 2.0, 0.0, 1.0);
    cover *= uAlpha;
    if (cover < 0.02) discard;
    vec4 a0 = texture(uAtlas0, vUV);
    vec3 nm = vec3(a1.xy * 2.0 - 1.0, 0.0);
    nm.z = sqrt(max(1.0 - dot(nm.xy, nm.xy), 0.02));
    vec3 T = normalize(vTan - N * dot(vTan, N));
    vec3 B = cross(N, T);
    vec3 n = normalize(T * nm.x + B * nm.y + N * nm.z);
    c = shade(a0.rgb, n, V, a0.a, sunShadow(vPos, N), a1.z, vPos.xy);
  } else {
    // sawn or split side: the stone's own tone, rougher and a shade darker
    vec3 a = textureLod(uAtlas0, vUV, 4.0).rgb;
    vec2 along = vec2(dot(vPos.xy, vec2(-N.y, N.x)), vPos.z);
    a *= 0.82 * (1.0 + 0.16 * gnoise(along / 3.0, 31u) + 0.08 * gnoise(along / 0.8, 37u));
    float ao = 0.45 + 0.55 * smoothstep(0.0, uThick * 0.8, vPos.z);
    ao *= 1.0 - 0.75 * enclosure(vPos.xy + N.xy * 5.0, 3.0);
    c = shade(a, N, V, 0.9, sunShadow(vPos, N), ao, vPos.xy);
    cover = uAlpha;
    if (cover < 0.02) discard;
  }
  fragColor = finish(c, cover);
}
`;

export const GROUND_FS = `${HEAD}
out vec4 fragColor;
${MATERIAL}
${VIEW}
uniform sampler2D uBed0, uBed1;
uniform vec4 uBedRect;
uniform vec4 uFloorRect;         // the laid area: beyond it the bed fades into the room's dark
uniform int uGround;             // 0 bed, 1 joint filling
in vec3 vPos;

void main() {
  vec2 p = vPos.xy;
  if (uGround == 1) {
    ivec2 c = ivec2(floor((p - uOrigin) / uPitch));
    if (cellAt(c).b < 128u) discard;
  }
  vec2 uv = (p - uBedRect.xy) / (uBedRect.zw - uBedRect.xy);
  vec3 b0 = texture(uBed0, uv).rgb;
  vec3 b1 = texture(uBed1, uv).rgb;
  vec3 n = vec3(b1.xy * 2.0 - 1.0, 0.0);
  n.z = sqrt(max(1.0 - dot(n.xy, n.xy), 0.02));
  vec3 V = normalize(uEye - vPos);
  vec3 alb;
  float ao;
  float encl = 0.6 * enclosure(p, 3.0) + 0.4 * enclosure(p, 14.0);
  if (uGround == 1) {
    float l = dot(b0, vec3(0.3, 0.6, 0.1)) / dot(uBedAlb, vec3(0.3, 0.6, 0.1));
    alb = uFillAlb * (0.7 + 0.3 * l);
    n = normalize(mix(vec3(0.0, 0.0, 1.0), n, 0.5));
    ao = 1.0 - 0.45 * encl;
  } else {
    alb = b0;
    ao = 1.0 - 0.85 * encl;
  }
  vec3 c = shade(alb, n, V, 0.95, sunShadow(vPos, vec3(0.0, 0.0, 1.0)), ao, p);
  // the light falls off away from the work into the room's shadow
  vec2 out2 = max(max(uFloorRect.xy - p, p - uFloorRect.zw), 0.0);
  float far = length(out2);
  c *= exp(-far / 1300.0) * (1.0 - smoothstep(1500.0, 2250.0, far));
  fragColor = finish(c, 1.0);
}
`;

// Depth for the sun's shadow maps (uMaskMode 0), or top coverage seen from above (1).
export const DEPTH_FS = `${HEAD}
out vec4 o;
uniform sampler2D uAtlas1;
uniform int uMaskMode;
in vec3 vPos;
in vec3 vNrm;
in vec3 vTan;
in vec2 vUV;
flat in vec2 vInfo;
void main() {
  if (vInfo.y < 0.5) {
    float a = texture(uAtlas1, vUV).a;
    float own = vInfo.x < 0.5 ? clamp(a * 2.0 - 1.0, 0.0, 1.0) : clamp(1.0 - a * 2.0, 0.0, 1.0);
    if (uMaskMode == 0 && own < 0.5) discard;
    o = vec4(own);
  } else {
    if (uMaskMode == 1) discard;
    o = vec4(1.0);
  }
}
`;
