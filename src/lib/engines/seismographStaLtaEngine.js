/**
 * seismographStaLtaEngine.js — Pure ES2024 JavaScript
 * Recursive STA/LTA P-wave vs S-wave arrival picker, epicentral distance,
 * PGA / PGV / Arias Intensity / CAV, Wald USGS MMI mapper and Newmark-Beta
 * (γ=1/2, β=1/4) 5%-damped elastic response spectrum Sa(T). Zero deps.
 */

export const ACCELEROGRAMS = [
  {
    id: 'nearfault',
    name: 'Near-Fault M6.7 Pulse-Like Quake',
    dtSP: 1.9, pgaG: 0.42, pgvCmS: 48, durationS: 24,
    desc: 'Δt S–P = 1.9 s · Distance 15 km · PGA 0.42 g · PGV 48 cm/s'
  },
  {
    id: 'subduction',
    name: 'Distant Subduction M7.8 Basin Wave',
    dtSP: 14.5, pgaG: 0.18, pgvCmS: 32, durationS: 60,
    desc: 'Δt S–P = 14.5 s · Distance 116 km · 0.8–2.0 s high-rise excitation'
  },
  {
    id: 'quarry',
    name: 'Quarry Blast / Pile-Driving Impulse',
    dtSP: 0.4, pgaG: 0.06, pgvCmS: 4, durationS: 8,
    desc: 'High-frequency > 15 Hz · low PGV · shallow source signature'
  },
  {
    id: 'quiet',
    name: 'Quiet Ambient Background Noise',
    dtSP: 0, pgaG: 0.004, pgvCmS: 0.2, durationS: 30,
    desc: 'Microtremor baseline — STA/LTA stays below trigger threshold'
  }
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Epicentral distance D ≈ 8.0 · Δt_S-P (km), vP=6.0, vS=3.5 km/s. */
export function epicentralDistance(dtSP) {
  return 8.0 * Math.max(0, dtSP);
}

/** Wald et al. USGS ShakeMap MMI regression from PGA (g) & PGV (cm/s). */
export function mmiFromGroundMotion(pgaG, pgvCmS) {
  const logPga = Math.log10(Math.max(pgaG, 1e-4) * 100); // %g
  const logPgv = Math.log10(Math.max(pgvCmS, 0.05));
  const mmi = 1.31 * logPga + 1.01 * logPgv - 1.03;
  const clamped = clamp(mmi, 1, 11);
  const roman = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
  return { mmi: clamped, roman: roman[Math.round(clamped) - 1] || 'XI', label: `MMI ${roman[Math.round(clamped) - 1] || 'XI'}` };
}

/**
 * Generate a synthetic 3-axis accelerogram for a preset.
 * Returns { t, ax, ay, az, ah, pPick, sPick, pga, pgv, ia, cav }.
 */
export function synthesizeAccelerogram(preset, { fs = 50 } = {}) {
  const n = Math.round(preset.durationS * fs);
  const t = new Float64Array(n);
  const ax = new Float64Array(n), ay = new Float64Array(n), az = new Float64Array(n);
  const tP = 3.0;
  const tS = tP + preset.dtSP;
  const amp = preset.pgaG * 980.665; // Gal
  for (let i = 0; i < n; i++) {
    const ti = i / fs;
    t[i] = ti;
    let vx = 0, vy = 0, vz = 0;
    // ambient microtremor
    vx += 0.6 * Math.sin(ti * 12.3) + 0.4 * Math.sin(ti * 31.7 + 1.2);
    vy += 0.5 * Math.sin(ti * 11.1 + 0.4) + 0.35 * Math.sin(ti * 27.9);
    vz += 0.5 * Math.sin(ti * 13.7 + 2.0) + 0.3 * Math.sin(ti * 29.3);
    // P-wave: vertical-dominant, high frequency
    if (ti >= tP && ti < tP + 2.2) {
      const env = Math.exp(-(ti - tP) * 1.1) * (1 - Math.exp(-(ti - tP) * 6));
      vz += amp * 0.45 * env * Math.sin((ti - tP) * 2 * Math.PI * 8.0);
      vx += amp * 0.12 * env * Math.sin((ti - tP) * 2 * Math.PI * 8.0 + 0.5);
      vy += amp * 0.10 * env * Math.sin((ti - tP) * 2 * Math.PI * 7.5);
    }
    // S-wave: horizontal-dominant, lower frequency, larger amplitude
    if (ti >= tS && ti < tS + preset.durationS * 0.55) {
      const env = Math.exp(-(ti - tS) * 0.35) * (1 - Math.exp(-(ti - tS) * 3));
      const fS = preset.id === 'subduction' ? 1.2 : 3.2;
      vx += amp * env * Math.sin((ti - tS) * 2 * Math.PI * fS);
      vy += amp * 0.85 * env * Math.sin((ti - tS) * 2 * Math.PI * fS * 0.92 + 0.7);
      vz += amp * 0.25 * env * Math.sin((ti - tS) * 2 * Math.PI * fS * 1.1);
    }
    ax[i] = vx; ay[i] = vy; az[i] = vz;
  }
  const ah = new Float64Array(n);
  for (let i = 0; i < n; i++) ah[i] = Math.hypot(ax[i], ay[i]);
  // ground-motion parameters
  let pga = 0;
  for (let i = 0; i < n; i++) pga = Math.max(pga, Math.hypot(ax[i], ay[i], az[i]));
  // trapezoidal velocity integration (baseline removed by mean)
  const v = new Float64Array(n);
  let mean = 0; for (let i = 0; i < n; i++) mean += az[i]; mean /= n;
  for (let i = 1; i < n; i++) v[i] = v[i - 1] + 0.5 * ((az[i] - mean) + (az[i - 1] - mean)) / fs;
  let pgv = 0; for (let i = 0; i < n; i++) pgv = Math.max(pgv, Math.abs(v[i]));
  // Arias intensity Ia = π/(2g) ∫ a² dt (m/s), a in m/s²
  let ia = 0, cav = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.hypot(ax[i], ay[i], az[i]) / 100; // Gal → m/s²
    ia += a * a / fs;
    cav += Math.abs(a) / fs;
  }
  ia *= Math.PI / (2 * 9.81);
  return { t, ax, ay, az, ah, fs, tP, tS, pgaGal: pga, pgaG: pga / 980.665, pgvCmS: pgv, ia, cav };
}

/**
 * Recursive STA/LTA trigger scan on horizontal channel.
 * Returns { ratio, triggerIndex, tP, tS }.
 */
export function staLtaScan(ah, fs, { staS = 0.5, ltaS = 10.0, threshold = 3.0 } = {}) {
  const n = ah.length;
  const staN = Math.max(1, Math.round(staS * fs));
  const ltaN = Math.max(staN + 1, Math.round(ltaS * fs));
  const ratio = new Float64Array(n);
  let sta = 0, lta = 0;
  for (let i = 0; i < n; i++) {
    const e = ah[i] * ah[i];
    sta += e / staN;
    lta += e / ltaN;
    if (i >= staN) sta -= (ah[i - staN] * ah[i - staN]) / staN;
    if (i >= ltaN) lta -= (ah[i - ltaN] * ah[i - ltaN]) / ltaN;
    ratio[i] = lta > 1e-9 ? sta / lta : 1;
  }
  let triggerIndex = -1;
  for (let i = ltaN; i < n; i++) {
    if (ratio[i] > threshold) { triggerIndex = i; break; }
  }
  return { ratio, triggerIndex, threshold };
}

/**
 * Newmark-Beta (γ=1/2, β=1/4) SDOF response spectrum.
 * Returns { periods, Sa (g), Sv (cm/s), Sd (cm) } for 40 periods 0.05–3.0 s.
 */
export function responseSpectrum(accel, fs, { zeta = 0.05, nPeriods = 40 } = {}) {
  const periods = [];
  const Sa = [], Sv = [], Sd = [];
  const dt = 1 / fs;
  for (let k = 0; k < nPeriods; k++) {
    const T = 0.05 * Math.pow(3.0 / 0.05, k / (nPeriods - 1));
    periods.push(T);
    const wn = 2 * Math.PI / T;
    // Newmark average-acceleration constants
    const a0 = 1 / (0.25 * dt * dt);
    const a1 = 0.5 / dt;
    const a2 = 1 / dt;
    const a3 = 0.5;
    const a4 = 0.25 / dt;
    const a5 = 0.125 * dt;
    const kEff = wn * wn + 2 * zeta * wn * a1 + a0;
    let u = 0, v = 0, a = -accel[0];
    let uMax = 0, vMax = 0, aMax = 0;
    for (let i = 0; i < accel.length; i++) {
      const du = (a0 * u + a2 * v + a3 * a + accel[i]) / kEff;
      const dv = a1 * du;
      const da = a4 * du - a5 * v;
      u += du; v += dv; a = da;
      uMax = Math.max(uMax, Math.abs(u));
      vMax = Math.max(vMax, Math.abs(v));
      aMax = Math.max(aMax, Math.abs(a));
    }
    // accel in Gal → convert: Sa in g, Sv/Sd in cm
    Sa.push((aMax / 980.665) * 1.0);
    Sv.push(vMax);
    Sd.push(uMax);
  }
  return { periods, Sa, Sv, Sd, zeta };
}
