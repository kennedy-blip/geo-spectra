/**
 * crackKinematicsBurlandEngine.js — Pure ES2024 JavaScript
 * Sub-millimetre structural crack photogrammetry: aperture width, failure-mode
 * classifier (normal opening vs tangential shear slip), BRE Digest 251 /
 * Burland Damage Category 0–5, ACI 224R concrete limits and Skempton &
 * MacDonald angular-distortion limits. Zero dependencies.
 */

export const CRACK_PRESETS = [
  {
    id: 'hairline',
    name: 'Category 1 · Hairline Drying Shrinkage',
    w: 0.25, theta: 88, duN: 0.25, duS: 0.0, taper: 0.02, lengthM: 1.4,
    desc: 'Vertical 88°, pure opening, Δu_s = 0.0 mm — cosmetic only.'
  },
  {
    id: 'settlement',
    name: 'Category 3 · Differential Settlement Stair-Step',
    w: 3.8, theta: 44, duN: 2.7, duS: 2.7, taper: 0.55, lengthM: 2.2,
    desc: '44° diagonal stepped crack, β = 1/240 — structural underpinning candidate.'
  },
  {
    id: 'hydrostatic',
    name: 'Category 4 · Lateral Hydrostatic Bowed Wall',
    w: 7.2, theta: 3, duN: 7.2, duS: 0.4, taper: 0.18, lengthM: 3.0,
    desc: 'Horizontal 3° + out-of-plane bulge — immediate bracing required!'
  },
  {
    id: 'seismic',
    name: 'Seismic X-Shear Concrete Column',
    w: 2.1, theta: 52, duN: 1.3, duS: 1.6, taper: 0.08, lengthM: 1.8,
    desc: 'Tangential shear slip Δu_s = 1.6 mm — cyclic seismic shear.'
  }
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Burland / BRE Digest 251 damage category from aperture width (mm). */
export function burlandCategory(w) {
  if (w < 0.1) return { cat: 0, label: 'Hairline', action: 'No action required' };
  if (w < 1.0) return { cat: 1, label: 'Fine internal crack', action: 'Easily filled / decorated over' };
  if (w < 5.0) return { cat: 2, label: 'Slight', action: 'Repointing / weather-sealing needed' };
  if (w < 15.0) return { cat: 3, label: 'Moderate', action: 'Serviceability impaired; utility pipes may fracture' };
  if (w < 25.0) return { cat: 4, label: 'Severe', action: 'Structural instability — engineer inspection urgent' };
  return { cat: 5, label: 'Very severe', action: 'Immediate shoring; building may be unsafe' };
}

/** ACI 224R maximum allowable crack widths (mm) by exposure. */
export function aci224Audit(w) {
  const limits = [
    { exposure: 'Dry air / protective membrane', limit: 0.41 },
    { exposure: 'Moist soil / humidity', limit: 0.30 },
    { exposure: 'Deicing chemicals / seawater', limit: 0.15 },
    { exposure: 'Water-retaining structures', limit: 0.10 }
  ];
  return limits.map((l) => ({
    ...l,
    pass: w <= l.limit,
    note: w <= l.limit ? 'Within limit' : 'Exceeds limit — rebar corrosion risk'
  }));
}

/**
 * Failure-mode classifier from orientation θ, taper and shear ratio.
 * Returns { mode, confidence, angularDistortion, distortionVerdict }.
 */
export function classifyCrack({ w, theta, duN, duS, taper = 0, lengthM = 2.0, bayM = 6.0 } = {}) {
  const shearRatio = duS / Math.max(w, 1e-6);
  const ang = ((theta % 180) + 180) % 180;
  let mode, confidence;
  if (shearRatio > 0.45 && ang > 25 && ang < 65) {
    mode = 'Differential foundation settlement (stepped diagonal)';
    confidence = 0.86;
  } else if (ang < 12 && w > 3) {
    mode = 'Lateral hydrostatic soil pressure (bowed wall)';
    confidence = 0.82;
  } else if (shearRatio > 0.3) {
    mode = 'In-plane shear slip / seismic cyclic shear';
    confidence = 0.78;
  } else if (ang > 75 && taper < 0.1) {
    mode = 'Thermal / drying shrinkage (cosmetic)';
    confidence = 0.9;
  } else if (taper > 0.35) {
    mode = 'Hogging / sagging differential settlement (tapered wedge)';
    confidence = 0.8;
  } else {
    mode = 'Mixed / indeterminate — monitor with tell-tales';
    confidence = 0.55;
  }
  // Angular distortion β = ΔS / L from taper-derived differential settlement
  const deltaS = taper * w * 4; // mm of differential vertical movement estimate
  const beta = deltaS / 1000 / Math.max(bayM, 0.5); // rise/run
  let distortionVerdict;
  if (beta <= 1 / 300) distortionVerdict = 'Within 1/300 architectural cracking limit';
  else if (beta <= 1 / 150) distortionVerdict = 'Exceeds 1/300 — approaching 1/150 structural damage limit';
  else distortionVerdict = 'Exceeds 1/150 structural damage limit — underpinning evaluation required';
  return { mode, confidence, shearRatio, angularDistortion: beta, betaReciprocal: beta > 0 ? 1 / beta : Infinity, distortionVerdict, deltaS };
}

/** Photogrammetric scale from Camera2 intrinsics: s = d_focus(mm) / f_px. */
export function photogrammetricScale(focalPx, focusDistanceMm) {
  return focusDistanceMm / Math.max(focalPx, 1);
}

/** Width in mm from pixel measurement. */
export function widthFromPixels(px, mmPerPx) {
  return px * mmPerPx;
}
