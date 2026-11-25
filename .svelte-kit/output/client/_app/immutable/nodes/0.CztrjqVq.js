import{s as C,a as x,u as E,g as F,b as L,o as B,d as U}from"../chunks/C808NSGc.js";import{S as W,i as G,d as m,k as q,l as K,a as d,m as _,c as D,e as H,g as M,h as V,j as N}from"../chunks/BJIbnkKj.js";const I=`// GEO-SPECTRA · seismicRayleighWaveBackground.glsl
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
`;function O(r){let t,i,s;const c=r[2].default,e=x(c,r,r[1],null);return{c(){t=V("canvas"),i=N(),e&&e.c(),this.h()},l(a){t=D(a,"CANVAS",{id:!0,"aria-hidden":!0}),H(t).forEach(m),i=M(a),e&&e.l(a),this.h()},h(){_(t,"id","wave-underlay"),_(t,"aria-hidden","true")},m(a,n){d(a,t,n),r[3](t),d(a,i,n),e&&e.m(a,n),s=!0},p(a,[n]){e&&e.p&&(!s||n&2)&&E(e,c,a,a[1],s?L(c,a[1],n,null):F(a[1]),null)},i(a){s||(K(e,a),s=!0)},o(a){q(e,a),s=!1},d(a){a&&(m(t),m(i)),r[3](null),e&&e.d(a)}}}function Y(r,t,i){let{$$slots:s={},$$scope:c}=t,e;B(()=>{const n=e.getContext("webgl2",{antialias:!1,alpha:!1});if(!n)return;const w=`#version 300 es
      layout(location=0) in vec2 aPos;
      void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`,g=(f,u)=>{const l=n.createShader(f);return n.shaderSource(l,u),n.compileShader(l),l},o=n.createProgram();n.attachShader(o,g(n.VERTEX_SHADER,w)),n.attachShader(o,g(n.FRAGMENT_SHADER,I)),n.linkProgram(o),n.useProgram(o);const A=n.createBuffer();n.bindBuffer(n.ARRAY_BUFFER,A),n.bufferData(n.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),n.STATIC_DRAW),n.enableVertexAttribArray(0),n.vertexAttribPointer(0,2,n.FLOAT,!1,0,0);const R=n.getUniformLocation(o,"uRes"),y=n.getUniformLocation(o,"uTime"),T=n.getUniformLocation(o,"uPga"),S=n.getUniformLocation(o,"uKg"),P=n.getUniformLocation(o,"uTintA"),b=n.getUniformLocation(o,"uTintB"),k=n.getUniformLocation(o,"uTintC");n.uniform3f(P,.96,.62,.04),n.uniform3f(b,.22,.74,.97),n.uniform3f(k,.96,.25,.37);let h;const p=()=>{const f=Math.min(window.devicePixelRatio||1,1.5),u=Math.floor(e.clientWidth*f),l=Math.floor(e.clientHeight*f);(e.width!==u||e.height!==l)&&(i(0,e.width=u,e),i(0,e.height=l,e),n.viewport(0,0,u,l)),n.uniform2f(R,e.width,e.height),n.uniform1f(y,performance.now()/1e3);const v=window.__geoDrive||{pga:.08,kg:6};n.uniform1f(T,v.pga),n.uniform1f(S,v.kg),n.drawArrays(n.TRIANGLES,0,3),h=requestAnimationFrame(p)};return p(),()=>cancelAnimationFrame(h)});function a(n){U[n?"unshift":"push"](()=>{e=n,i(0,e)})}return r.$$set=n=>{"$$scope"in n&&i(1,c=n.$$scope)},[e,c,s,a]}class z extends W{constructor(t){super(),G(this,t,Y,O,C,{})}}export{z as component};
