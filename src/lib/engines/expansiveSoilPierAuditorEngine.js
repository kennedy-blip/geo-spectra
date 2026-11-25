/**
 * expansiveSoilPierAuditorEngine.js — Pure ES2024 JavaScript
 * McDowell / TxDOT Potential Vertical Rise (PVR), Darcy stack-effect
 * Radon-222 intrusion model, and helical / push pier fair-quote auditor.
 * Zero dependencies.
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Potential Vertical Rise (mm) — McDowell / TxDOT Tex-124-E style model.
 * PVR grows with PI, active depth and moisture-suction shift; reduced by
 * surcharge (dead load) and deep moisture barriers.
 */
export function potentialVerticalRise({ LL = 55, PL = 22, activeDepthM = 3.0, surchargeKPa = 12, barrier = false } = {}) {
  const PI = Math.max(0, LL - PL);
  // free-swell pressure proxy (kPa) — grows nonlinearly with PI
  const pSwell = 18 * Math.pow(Math.max(PI, 1) / 20, 1.35);
  // suction-shift term: drier initial state → more heave potential
  const suctionFactor = 1.0 + 0.012 * Math.max(0, 60 - LL);
  let pvr = (PI * 1.55 + 0.35 * PI * Math.log10(Math.max(PI, 1))) * (activeDepthM / 3.0) * suctionFactor;
  pvr *= 1 / (1 + surchargeKPa / 28);
  if (barrier) pvr *= 0.62;
  pvr = clamp(pvr, 2, 220);
  let band;
  if (PI < 15) band = { label: 'LOW swell', action: 'Standard slab-on-grade acceptable' };
  else if (PI <= 35) band = { label: 'MODERATE–HIGH smectite swell', action: 'Perimeter root barrier & uniform moisture soaking required' };
  else band = { label: 'CRITICAL expansive montmorillonite', action: 'Deep pier-and-grade-beam foundation required' };
  return { PI, pvrMm: pvr, pvrIn: pvr / 25.4, pSwellKPa: pSwell, pSwellPsf: pSwell * 20.885, band };
}

/**
 * Darcy stack-effect Radon-222 intrusion.
 * Q = k·A·ΔP/(μ·L) · C_in = (C_soil·Q + E_diff)/(V(λv + λRn))
 */
export function radonIntrusion({
  crackWidthMm = 1.0, crackLengthM = 12.0, soilK = 1e-11, slabM = 0.1,
  tInC = 22, tOutC = 4, houseH = 3.0, houseVolM3 = 320,
  soilRnBqM3 = 50000, ventRate = 0.35, pressureDropPa = 0
} = {}) {
  const rhoAir = 1.2, g = 9.81;
  const tOutK = tOutC + 273.15;
  const dPStack = rhoAir * g * houseH * Math.max(0, (tInC - tOutC) / tOutK);
  const dP = Math.max(0, dPStack + pressureDropPa);
  const A = (crackWidthMm / 1000) * crackLengthM;
  const mu = 1.81e-5;
  const Q = (soilK * A * dP) / (mu * Math.max(slabM, 0.02)); // m³/s
  const lambdaRn = Math.log(2) / (3.82 * 24 * 3600); // 222Rn half-life
  const lambdaVent = ventRate / 3600;
  const Cindoor = (soilRnBqM3 * Q) / (houseVolM3 * (lambdaVent + lambdaRn));
  const pCiL = Cindoor / 37;
  let verdict, cls;
  if (Cindoor < 100) { verdict = 'Below WHO 100 Bq/m³ — no action'; cls = 'safe'; }
  else if (Cindoor < 148) { verdict = 'Above WHO 100 — mitigate recommended (EPA 148)'; cls = 'warn'; }
  else { verdict = 'Above EPA 148 Bq/m³ — sub-slab depressurization required'; cls = 'danger'; }
  const fanPa = Cindoor > 148 ? 25 + (Cindoor - 148) * 0.05 : 0;
  const fanCfm = Cindoor > 148 ? 60 + (Cindoor - 148) * 0.2 : 0;
  return { dPStack, dP, Q, Cindoor, pCiL, verdict, cls, fanPa: clamp(fanPa, 0, 120), fanCfm: clamp(fanCfm, 0, 400) };
}

export const PIER_TYPES = [
  { id: 'helical', name: 'Galvanized Steel Helical Piers', unit: 'pier', fairLow: 1800, fairHigh: 3200, capKN: 90, note: 'Torque-verified Q_ult = k_t·T_install' },
  { id: 'push', name: 'Hydraulic Steel Push Piers', unit: 'pier', fairLow: 1500, fairHigh: 2800, capKN: 110, note: 'Load-tested to 2× working load' },
  { id: 'concrete', name: 'Pressed Concrete Cylinder Pilings', unit: 'pier', fairLow: 900, fairHigh: 1600, capKN: 55, note: 'Friction piles — risky in deep expansive clay!' },
  { id: 'foam', name: 'Polyurethane Foam Slab-Jacking', unit: 'slab', fairLow: 1200, fairHigh: 2400, capKN: 0, note: 'Cosmetic lift only — no structural support' },
  { id: 'carbon', name: 'Carbon-Fiber Kevlar Wall Straps', unit: 'strap', fairLow: 450, fairHigh: 900, capKN: 0, note: 'Bowed-wall restraint, not settlement repair' },
  { id: 'drain', name: 'Interior French Drain + Sump', unit: 'lin-ft', fairLow: 65, fairHigh: 130, capKN: 0, note: 'Waterproofing — does not stop settlement' }
];

/**
 * Audit a contractor quote against structural demand & fair benchmarks.
 * demandKNm = wall line-load (kN/m); spacing from pier capacity.
 */
export function auditPierQuote({ pierTypeId = 'helical', quotedPerUnit = 4200, quotedUnits = 28, wallLoadKNm = 45, perimeterM = 48 } = {}) {
  const type = PIER_TYPES.find((p) => p.id === pierTypeId) || PIER_TYPES[0];
  const total = quotedPerUnit * quotedUnits;
  const mid = (type.fairLow + type.fairHigh) / 2;
  const markup = quotedPerUnit / mid;
  // required spacing: each pier carries wallLoad × spacing ≤ capKN × 0.5 (FS 2)
  const spacingM = type.capKN > 0 ? (type.capKN * 0.5) / Math.max(wallLoadKNm, 1) : 0;
  const requiredUnits = spacingM > 0 ? Math.ceil(perimeterM / spacingM) : quotedUnits;
  const overPiering = quotedUnits > requiredUnits * 1.4;
  const fairTotal = mid * Math.max(requiredUnits, 1);
  const savings = Math.max(0, total - fairTotal);
  let verdict, cls;
  if (markup > 1.6) { verdict = `OVERPRICED — ${Math.round(markup * 100)}% of fair benchmark`; cls = 'danger'; }
  else if (overPiering) { verdict = 'OVER-PIERED — perimeter scare-tactic detected'; cls = 'warn'; }
  else if (markup > 1.25) { verdict = 'ABOVE BENCHMARK — negotiate itemized breakdown'; cls = 'warn'; }
  else { verdict = 'FAIR QUOTE — within regional 50th–80th percentile band'; cls = 'safe'; }
  return { type, total, mid, markup, spacingM, requiredUnits, overPiering, fairTotal, savings, verdict, cls };
}
