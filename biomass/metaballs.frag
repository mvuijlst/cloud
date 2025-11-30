#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec3 u_blobs[50];
uniform vec3 u_blobColors[50];
uniform float u_time;

varying vec2 vTexCoord;

// 2D Random
float random (in vec2 st) {
    return fract(sin(dot(st.xy,
                         vec2(12.9898,78.233)))
                 * 43758.5453123);
}

// 2D Noise based on Morgan McGuire @morgan3d
// https://www.shadertoy.com/view/4dS3Wd
float noise (in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    // Four corners in 2D of a tile
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    // Smooth Interpolation

    // Cubic Hermite Curve.  Same as SmoothStep()
    vec2 u = f*f*(3.0-2.0*f);
    // u = smoothstep(0.,1.,f);

    // Mix 4 coorners percentages
    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;
}

void main() {
  // Use vTexCoord for robust coordinate mapping independent of pixel density
  vec2 st = vTexCoord;
  
  // p5.js plane UVs are (0,0) at top-left, matching 2D coordinates
  vec2 pixelPos = st * u_resolution;

  // --- Background ---
  // Layer 1: Base flow (large scale)
  float n1 = noise(pixelPos * 0.002 + vec2(u_time * 0.05, u_time * 0.02));
  
  // Layer 2: Secondary flow (medium scale, opposing direction)
  float n2 = noise(pixelPos * 0.006 - vec2(u_time * 0.08, u_time * 0.03));
  
  // Layer 3: Small particulate/texture (fine scale)
  float n3 = noise(pixelPos * 0.015 + vec2(sin(u_time * 0.1), u_time * 0.1));

  // Base gradient
  vec3 bgDark = vec3(0.1, 0.15, 0.05); // Deep olive
  vec3 bgLight = vec3(0.25, 0.3, 0.12); // Lighter olive
  
  vec3 colorBg = mix(bgDark, bgLight, n1);
  
  // Add layer 2 as subtle variation
  colorBg = mix(colorBg, vec3(0.2, 0.25, 0.1), n2 * 0.4);
  
  // Add layer 3 as faint highlights/particles
  colorBg += vec3(0.05, 0.08, 0.02) * (n3 * n3); // Square it to make it sparser
  
  vec4 finalColor = vec4(colorBg, 1.0);

  // --- Metaballs ---
  float sum = 0.0;
  float maxInf = 0.0;
  float secondMaxInf = 0.0;
  vec3 dominantColor = vec3(1.0);
  vec3 runnerUpColor = vec3(1.0);

  for (int i = 0; i < 50; i++) {
    vec3 b = u_blobs[i];
    // Optimization: if radius is 0, skip (unused slot)
    if (b.z == 0.0) continue;
    vec3 speciesColor = u_blobColors[i];
    
    vec2 d = pixelPos - b.xy;
    float dSq = dot(d, d);
    if (dSq < 1.0) dSq = 1.0;
    float inf = (b.z * b.z) / dSq;
    
    sum += inf;

    if (inf > maxInf) {
      secondMaxInf = maxInf;
      runnerUpColor = dominantColor;
      maxInf = inf;
      dominantColor = speciesColor;
    } else if (inf > secondMaxInf) {
      secondMaxInf = inf;
      runnerUpColor = speciesColor;
    }
  }

  if (sum > 1.8) {
    // Cell Interior tinted by dominant species
    vec3 col = mix(vec3(1.0), dominantColor, 0.7);
    
    // Internal boundaries (Voronoi-like)
    // If the two strongest influences are close, we are at a boundary.
    if (maxInf > 0.0) {
      float ratio = secondMaxInf / maxInf;
      // Create a soft line where influences are similar
      float border = smoothstep(0.75, 1.0, ratio);
      vec3 blendColor = mix(col, runnerUpColor, border * 0.6);
      col = mix(blendColor, vec3(0.0), border * 0.4);
    }
    
    finalColor = vec4(col, 1.0);
  } else if (sum > 1.5) {
    // Cell Wall inherits muted species color
    vec3 edgeColor = mix(vec3(0.0), dominantColor, 0.3);
    finalColor = vec4(edgeColor, 1.0);
  } else if (sum > 1.0) {
    // Shadow: Fading black over background
    float alpha = smoothstep(1.0, 1.5, sum) * 0.8; 
    // Mix background with black based on alpha
    finalColor = vec4(colorBg * (1.0 - alpha), 1.0);
  }

  gl_FragColor = finalColor;
}
