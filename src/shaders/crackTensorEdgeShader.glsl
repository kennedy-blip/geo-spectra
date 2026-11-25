// GEO-SPECTRA · crackTensorEdgeShader.glsl
// WebGL2 fragment shader — 2D Hessian structure-tensor eigenvalue
// decomposition (Frangi vesselness) isolating hairline structural cracks
// from rough concrete / brick texture and colour-coding aperture width.
// Uniforms: uTex (camera / image), uTexel, uScaleMmPerPx, uGain.
#version 300 es
precision highp float;

uniform sampler2D uTex;
uniform vec2  uTexel;
uniform float uScaleMmPerPx; // physical mm per pixel from Camera2 intrinsics
uniform float uGain;
out vec4 fragColor;

// luminance + simple gradient helpers
float lum(vec2 uv){ vec3 c = texture(uTex, uv).rgb; return dot(c, vec3(0.299, 0.587, 0.114)); }

void main(){
  vec2 uv = gl_FragCoord.xy / vec2(textureSize(uTex, 0));
  vec3 src = texture(uTex, uv).rgb;

  // central-difference gradients
  float gx = (lum(uv + vec2(uTexel.x, 0.0)) - lum(uv - vec2(uTexel.x, 0.0))) * 0.5;
  float gy = (lum(uv + vec2(0.0, uTexel.y)) - lum(uv - vec2(0.0, uTexel.y))) * 0.5;

  // Hessian second derivatives
  float c  = lum(uv);
  float dxx = lum(uv + vec2(uTexel.x, 0.0)) - 2.0 * c + lum(uv - vec2(uTexel.x, 0.0));
  float dyy = lum(uv + vec2(0.0, uTexel.y)) - 2.0 * c + lum(uv - vec2(0.0, uTexel.y));
  float dxy = (lum(uv + vec2(uTexel.x, uTexel.y)) - lum(uv + vec2(uTexel.x, -uTexel.y))
             - lum(uv + vec2(-uTexel.x, uTexel.y)) + lum(uv - vec2(uTexel.x, uTexel.y))) * 0.25;

  // eigenvalues of the 2x2 Hessian
  float tr = dxx + dyy;
  float det = dxx * dyy - dxy * dxy;
  float disc = sqrt(max(tr * tr * 0.25 - det, 0.0));
  float l1 = tr * 0.5 + disc;
  float l2 = tr * 0.5 - disc;

  // Frangi vesselness (dark ridge on bright background → negative eigenvalues)
  float S = sqrt(l1 * l1 + l2 * l2);                 // structureness
  float RA = abs(l2) / max(abs(l1), 1e-6);           // plate vs line
  float RB = abs(tr) / max(S, 1e-6);                 // blob vs line
  float vessel = (1.0 - exp(-RA * RA / (2.0 * 0.5 * 0.5)))
               * exp(-RB * RB / (2.0 * 0.5 * 0.5))
               * (1.0 - exp(-S * S / (2.0 * 0.5 * 0.5)));
  float crack = clamp(vessel * uGain, 0.0, 1.0);

  // aperture width estimate: ridge strength → mm via photogrammetric scale
  float widthMm = clamp(S * 900.0 * uScaleMmPerPx, 0.0, 25.0);

  // false-colour width heatmap: cyan hairline → amber → crimson wide
  vec3 heat = vec3(0.0);
  heat = mix(vec3(0.22, 0.83, 0.97), vec3(0.96, 0.62, 0.04), smoothstep(0.1, 1.5, widthMm));
  heat = mix(heat, vec3(0.96, 0.24, 0.37), smoothstep(1.5, 8.0, widthMm));

  vec3 col = src * 0.55 + heat * crack * 1.6;
  // edge highlight from gradient magnitude
  col += vec3(1.0) * clamp(length(vec2(gx, gy)) * 2.0, 0.0, 0.35) * crack;
  fragColor = vec4(col, 1.0);
}
