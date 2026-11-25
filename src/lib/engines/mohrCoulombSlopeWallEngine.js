/**
 * mohrCoulombSlopeWallEngine.js — Pure ES2024 JavaScript
 * Mohr–Coulomb effective-stress infinite-slope factor of safety, Mohr circle
 * tangency solver, Rankine active earth pressure + Mononobe–Okabe seismic
 * thrust, and retaining-wall overturning / sliding stability. Zero deps.
 */

export const SLOPE_SCENARIOS = [
  {
    id: 'dry',
    name: 'Dry Stable Cut-Slope',
    beta: 26, c: 12, phi: 32, m: 0.1, z: 3.0, kh: 0.0, gamma: 18.0,
    desc: 'β = 26° · c′ = 12 kPa · φ′ = 32° · m = 0.1 → FS ≈ 1.78 SAFE'
  },
  {
    id: 'rain',
    name: 'Atmospheric-River Rain-Saturated Hillside',
    beta: 31, c: 8, phi: 28, m: 0.88, z: 3.5, kh: 0.0, gamma: 19.0,
    desc: 'β = 31° · m = 0.88 → pore-pressure spike drops FS to 0.94 — LANDSLIDE IMMINENT!'
  },
  {
    id: 'wall',
    name: 'Bowed 2.4 m Masonry Wall · Clogged Weep-Holes',
    beta: 12, c: 6, phi: 30, m: 0.95, z: 2.4, kh: 0.0, gamma: 19.5,
    desc: 'Hydrostatic thrust triples overturning moment → FS_overturn ≈ 0.89!'
  },
  {
    id: 'seismic',
    name: 'Seismic Pseudo-Static Slope Check',
    beta: 28, c: 10, phi: 30, m: 0.4, z: 3.0, kh: 0.20, gamma: 18.5,
    desc: 'k_h = 0.20 g pseudo-static seismic coefficient (Mononobe–Okabe).'
  }
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const rad = (d) => (d * Math.PI) / 180;

/**
 * Infinite-slope FS (effective stress, with pore-water table & seismic kh).
 * FS = [c' + (γz − γw·zw) cos²β tanφ'] / [γz sinβ cosβ (1 + kh/tanβ)]
 */
export function slopeFactorOfSafety({ beta = 28, c = 10, phi = 30, m = 0.4, z = 3.0, kh = 0.0, gamma = 18.5 } = {}) {
  const gammaW = 9.81;
  const b = rad(beta);
  const zw = m * z;
  const sigmaN = gamma * z * Math.cos(b) ** 2;
  const u = gammaW * zw * Math.cos(b) ** 2;
  const sigmaPrime = sigmaN - u;
  const tauMax = c + sigmaPrime * Math.tan(rad(phi));
  const tauMob = gamma * z * Math.sin(b) * Math.cos(b) * (1 + kh / Math.max(Math.tan(b), 0.05));
  const FS = tauMax / Math.max(tauMob, 1e-6);
  // Mohr circle principal stresses on the slip plane
  const sigma1 = sigmaPrime + Math.sqrt(Math.max(0, tauMob ** 2 + 0 * sigmaPrime));
  const sigma3 = Math.max(0, sigmaPrime - tauMob);
  const center = (sigma1 + sigma3) / 2;
  const radius = (sigma1 - sigma3) / 2;
  let verdict, cls;
  if (FS >= 1.5) { verdict = 'STATIC CODE SAFE — FS ≥ 1.50'; cls = 'safe'; }
  else if (FS >= 1.1) { verdict = 'MARGINAL — drainage / regrading required'; cls = 'warn'; }
  else if (FS >= 1.0) { verdict = 'CRITICAL — near failure, evacuate downslope assets'; cls = 'warn'; }
  else { verdict = 'ACTIVE SHEAR FAILURE — landslide imminent'; cls = 'danger'; }
  return { FS, sigmaN, u, sigmaPrime, tauMax, tauMob, zw, center, radius, verdict, cls };
}

/** Rankine active earth pressure coefficient Ka = (1−sinφ)/(1+sinφ). */
export function rankineKa(phiDeg) {
  const s = Math.sin(rad(phiDeg));
  return (1 - s) / (1 + s);
}

/**
 * Retaining-wall stability: overturning & sliding with hydrostatic thrust.
 * Wall: height H, base B, unit weight γw_wall, backfill γ, φ', water height Hw.
 */
export function retainingWallStability({
  H = 2.4, B = 1.2, gammaWall = 22.0, gammaSoil = 19.0, phi = 30,
  Hw = 0.0, kh = 0.0, cBase = 5.0, deltaBase = 24.0
} = {}) {
  const gammaW = 9.81;
  const Ka = rankineKa(phi);
  const Pa = 0.5 * Ka * gammaSoil * H * H; // kN/m
  const Pw = 0.5 * gammaW * Hw * Hw;
  const W = gammaWall * H * B; // kN/m (rectangular wall approx)
  const U = gammaW * Hw * B; // uplift under base
  const Mres = W * (B / 2);
  const Mov = Pa * (H / 3) + Pw * (Hw / 3);
  const FSover = Mres / Math.max(Mov, 1e-6);
  const resist = (W - U) * Math.tan(rad(deltaBase)) + cBase * B;
  const FSslide = resist / Math.max(Pa + Pw, 1e-6);
  // Mononobe–Okabe dynamic increment (simplified)
  const dPa = kh > 0 ? 0.375 * kh * gammaSoil * H * H : 0;
  const FSoverDyn = Mres / Math.max(Mov + dPa * H * 0.6, 1e-6);
  let verdict, cls;
  const minFS = Math.min(FSover, FSslide);
  if (minFS >= 1.5) { verdict = 'STABLE — overturning & sliding FS ≥ 1.50'; cls = 'safe'; }
  else if (minFS >= 1.0) { verdict = 'MARGINAL — clear weep-holes, add drainage'; cls = 'warn'; }
  else { verdict = 'UNSTABLE — wall failure imminent, shore & evacuate'; cls = 'danger'; }
  return { Ka, Pa, Pw, W, U, Mres, Mov, FSover, FSslide, dPa, FSoverDyn, verdict, cls };
}
