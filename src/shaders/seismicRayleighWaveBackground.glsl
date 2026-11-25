// GEO-SPECTRA · seismicRayleighWaveBackground.glsl
// WebGL2 fragment shader — P-wave compressional wavefronts, S-wave shear
// contours and Rayleigh surface-wave interferograms reactive to live PGA
// and HVSR telemetry (uniforms uPga, uKg, uTime).
#version 300 es
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uPga;   // peak ground acceleration, fraction of g (0..1)
uniform float uKg;    // Nakamura vulnerability index (0..~60)
uniform vec3  uTintA; // amber
uniform vec3  uTintB; // cyan
uniform vec3  uTintC; // crimson
out vec4 fragColor;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p  = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float t = uTime * 0.35;

  // epicentre drifts slowly across the plate
  vec2 epi = vec2(0.28 * sin(t * 0.11), 0.22 * cos(t * 0.09));
  float r  = length(p - epi);
  float ang = atan(p.y - epi.y, p.x - epi.x);

  // P-wave: fast, tight compressional rings (vP ~ 6 km/s)
  float pWave = sin(r * 90.0 - t * 14.0) * exp(-r * 1.1);
  // S-wave: slower, broader shear contours (vS ~ 3.5 km/s)
  float sWave = sin(r * 42.0 - t * 7.5 + 1.7) * exp(-r * 0.8);
  // Rayleigh surface wave: dispersive ground roll, angle-modulated
  float ray = sin(r * 26.0 - t * 3.2 + sin(ang * 3.0 + t) * 1.4) * exp(-r * 0.55);

  float amp = clamp(uPga * 3.0, 0.12, 1.0);
  vec3 col = vec3(0.02, 0.03, 0.06);
  col += uTintB * max(pWave, 0.0) * 0.55 * amp;          // P = bedrock cyan
  col += uTintA * max(sWave, 0.0) * 0.65 * amp;          // S = seismic amber
  col += uTintC * max(ray, 0.0)   * 0.50 * amp;          // Rayleigh = fault crimson

  // tectonic fault stress lines (fBm-ish ridged noise)
  float n = 0.0;
  vec2 q = p * 3.0 + vec2(t * 0.05, -t * 0.03);
  n += hash(floor(q * 8.0)) * 0.5 + hash(floor(q * 16.0)) * 0.3 + hash(floor(q * 32.0)) * 0.2;
  float fault = smoothstep(0.86, 0.99, n) * 0.35;
  col += vec3(0.9, 0.7, 0.3) * fault * (0.4 + amp);

  // HVSR resonance glow — soil amplification rings pulse with Kg
  float kgGlow = clamp(uKg / 45.0, 0.0, 1.0);
  float ring = sin(r * 55.0 - t * 5.0) * 0.5 + 0.5;
  col += uTintA * pow(ring, 6.0) * kgGlow * 0.35 * exp(-r * 0.9);

  // vignette
  col *= 1.0 - 0.55 * smoothstep(0.35, 0.95, length(uv - 0.5));
  fragColor = vec4(col, 1.0);
}
