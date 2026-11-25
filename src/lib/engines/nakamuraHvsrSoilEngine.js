/**
 * nakamuraHvsrSoilEngine.js — Pure ES2024 JavaScript
 * Nakamura HVSR ambient-microtremor soil-resonance solver + Seed & Idriss
 * simplified liquefaction factor of safety. Zero dependencies.
 *
 * HVSR(f) = sqrt( (S_NS^2 + S_EW^2) / 2 ) / S_V   with Konno–Ohmachi
 * logarithmic spectral smoothing (bandwidth b = 40).
 * Kg = A0^2 / f0 · H = Vs / (4 f0) · CSR = 0.65 (amax/g)(σv/σ'v) rd
 */

export const SITE_PROFILES = [
  {
    id: 'bedrock',
    name: 'Competent Bedrock / Stiff Gravel',
    nehrp: 'Site Class B',
    f0: 9.4, A0: 1.4, Vs30: 760,
    desc: 'Flat HVSR curve, negligible soil amplification. Shallow rock, dense gravel outcrop.'
  },
  {
    id: 'basin',
    name: 'Deep Soft Alluvial / Lakebed Clay Basin',
    nehrp: 'Site Class E',
    f0: 1.15, A0: 6.8, Vs30: 150,
    desc: 'Mexico City / Marina District type. Sharp peak — extreme 8-storey double resonance!'
  },
  {
    id: 'sandfill',
    name: 'Loose Saturated Coastal Sand Fill',
    nehrp: 'Site Class D',
    f0: 2.4, A0: 3.9, Vs30: 210,
    desc: 'High liquefaction risk: CSR exceeds CRR under design PGA.'
  },
  {
    id: 'woodframe',
    name: '2-Storey Wood-Frame Residential',
    nehrp: 'Site Class C/D',
    f0: 4.6, A0: 2.6, Vs30: 320,
    desc: 'Soil-structure match test: building f ≈ 5 Hz vs soil f0 — check resonance overlap.'
  }
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Konno–Ohmachi smoothing weight W(f, fc) with bandwidth b. */
export function konnoOhmachiWeight(f, fc, b = 40) {
  if (f <= 0 || fc <= 0) return 0;
  const x = b * Math.log10(f / fc);
  if (Math.abs(x) < 1e-9) return 1;
  const s = Math.sin(x) / x;
  return Math.pow(s, 4);
}

/**
 * Build a synthetic HVSR curve for a site profile.
 * Returns { freqs, hvsr, f0, A0, Kg, H, Tsoil, peakIndex }.
 */
export function computeHvsrCurve(profile, { n = 160, fMin = 0.2, fMax = 20, b = 40, seed = 7 } = {}) {
  const freqs = [];
  const raw = [];
  const { f0, A0 } = profile;
  // log-spaced frequency axis 0.2–20 Hz
  for (let i = 0; i < n; i++) {
    const f = fMin * Math.pow(fMax / fMin, i / (n - 1));
    freqs.push(f);
    // Lorentzian peak + gentle high-frequency rolloff + deterministic ripple
    const lorentz = (A0 - 1) / (1 + Math.pow((f - f0) / (0.16 * f0 + 0.08), 2)) + 1;
    const ripple = 1 + 0.06 * Math.sin(i * 1.7 + seed) + 0.03 * Math.sin(i * 0.43 + seed * 2);
    raw.push(lorentz * ripple);
  }
  // Konno–Ohmachi smoothing across the log axis
  const hvsr = raw.map((_, i) => {
    let num = 0, den = 0;
    for (let j = 0; j < n; j++) {
      const w = konnoOhmachiWeight(freqs[j], freqs[i], b);
      num += w * raw[j];
      den += w;
    }
    return den > 0 ? num / den : raw[i];
  });
  // peak pick
  let peakIndex = 0;
  for (let i = 1; i < n; i++) if (hvsr[i] > hvsr[peakIndex]) peakIndex = i;
  const f0Meas = freqs[peakIndex];
  const A0Meas = hvsr[peakIndex];
  const Kg = (A0Meas * A0Meas) / f0Meas;
  const H = profile.Vs30 / (4 * f0Meas);
  return {
    freqs, hvsr,
    f0: f0Meas, A0: A0Meas, Kg,
    H, Tsoil: 1 / f0Meas,
    peakIndex,
    bandwidth: b
  };
}

/** Building natural frequency estimate f_bldg ≈ 10 / N_stories (Hz). */
export function buildingFrequency(stories) {
  return 10 / Math.max(1, stories);
}

/**
 * Soil–structure double-resonance detector.
 * overlap = exp(-((f0 - fb)^2) / (2 σ^2)) with σ = 0.25·f0.
 */
export function resonanceOverlap(f0, stories) {
  const fb = buildingFrequency(stories);
  const sigma = 0.25 * f0;
  const overlap = Math.exp(-Math.pow(f0 - fb, 2) / (2 * sigma * sigma));
  const multiplier = 1 + 3.2 * overlap; // up to ~4.2× amplification
  let risk;
  if (overlap > 0.75) risk = 'EXTREME — soil & building periods coincide';
  else if (overlap > 0.45) risk = 'HIGH — strong resonance amplification';
  else if (overlap > 0.2) risk = 'MODERATE — partial period overlap';
  else risk = 'LOW — periods well separated';
  return { fb, overlap, multiplier, risk };
}

/** Seed & Idriss stress-reduction coefficient rd(z). */
export function stressReductionRd(depthM) {
  const z = Math.max(0, depthM);
  if (z <= 10) return 1 - 0.00765 * z;
  return 1.174 - 0.0267 * z;
}

/**
 * Simplified liquefaction assessment.
 * CSR = 0.65 (amax/g)(σv/σ'v) rd · CRR7.5 from (N1)60cs correction.
 */
export function liquefactionAssessment({
  pgaG = 0.25, mw = 6.5, waterTableM = 2.0, depthM = 6.0,
  gammaKN = 18.5, gammaSatKN = 19.5, n160 = 12, finesPct = 8
} = {}) {
  const gammaW = 9.81;
  const sigmaV = gammaKN * depthM;
  const sigmaPrime = gammaKN * Math.min(depthM, waterTableM) + gammaSatKN * Math.max(0, depthM - waterTableM) - gammaW * Math.max(0, depthM - waterTableM);
  const rd = stressReductionRd(depthM);
  const CSR = 0.65 * pgaG * (sigmaV / Math.max(sigmaPrime, 1)) * rd;
  // (N1)60cs clean-sand correction (simplified Idriss & Boulanger)
  const cn = Math.min(1.7, Math.sqrt(100 / Math.max(sigmaPrime, 5)));
  const n1 = cn * n160 * (1 + 0.022 * Math.max(0, finesPct - 5));
  const CRR75 = 0.06 + 0.0929 * Math.sqrt(n1) - 0.0016 * n1;
  // magnitude scaling factor
  const MSF = Math.min(1.8, Math.pow(10, 2.24 - Math.log10(7.5)) / Math.pow(10, 2.24 - Math.log10(Math.max(5, mw))) * 0.1 + 0.9);
  const FS = (CRR75 * MSF) / Math.max(CSR, 1e-6);
  const LPI = FS < 1 ? clamp((1 - FS) * 15, 0, 15) : 0;
  let verdict;
  if (FS >= 1.25) verdict = 'SAFE — liquefaction unlikely';
  else if (FS >= 1.0) verdict = 'MARGINAL — densification / drainage review advised';
  else verdict = 'LIQUEFACTION EXPECTED — ground failure, settlement & flotation risk';
  return { CSR, CRR75, MSF, FS, LPI, rd, sigmaV, sigmaPrime, verdict };
}

/** Kg risk band. */
export function kgRisk(Kg) {
  if (Kg < 5) return { band: 'LOW', note: 'Low ground deformation risk' };
  if (Kg < 10) return { band: 'MODERATE', note: 'Moderate shear strain — review foundation' };
  if (Kg < 20) return { band: 'HIGH', note: 'High shear strain & ground failure risk' };
  return { band: 'EXTREME', note: 'Severe amplification — seismic retrofit evaluation required' };
}
