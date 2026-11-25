"""GEO-SPECTRA · mohr_coulomb_liquefaction.py
Python 3.12 scientific module — Seed & Idriss simplified liquefaction
(CSR / CRR / MSF / LPI), Mohr-Coulomb effective-stress tensors, Rankine &
Mononobe-Okabe lateral earth pressures, and Burland beam-bending tensile
strain limits. Mirrored 1:1 by the offline JS engines.
"""
from __future__ import annotations

import math

G_W = 9.81


def stress_reduction_rd(depth_m: float) -> float:
    """Seed & Idriss stress-reduction coefficient rd(z)."""
    z = max(0.0, depth_m)
    if z <= 10.0:
        return 1.0 - 0.00765 * z
    return 1.174 - 0.0267 * z


def liquefaction_csr_crr(pga_g: float, mw: float, water_table_m: float,
                         depth_m: float, gamma_kn: float = 18.5,
                         gamma_sat_kn: float = 19.5, n1_60: float = 12.0,
                         fines_pct: float = 8.0) -> dict:
    """Simplified liquefaction: CSR = 0.65·(amax/g)·(σv/σ'v)·rd, FS = CRR·MSF/CSR."""
    sigma_v = gamma_kn * depth_m
    below = max(0.0, depth_m - water_table_m)
    sigma_prime = gamma_kn * min(depth_m, water_table_m) + gamma_sat_kn * below - G_W * below
    rd = stress_reduction_rd(depth_m)
    csr = 0.65 * pga_g * (sigma_v / max(sigma_prime, 1.0)) * rd
    cn = min(1.7, math.sqrt(100.0 / max(sigma_prime, 5.0)))
    n1 = cn * n1_60 * (1.0 + 0.022 * max(0.0, fines_pct - 5.0))
    crr75 = 0.06 + 0.0929 * math.sqrt(n1) - 0.0016 * n1
    msf = min(1.8, 0.9 + 0.1 * (10.0 ** (2.24 - math.log10(max(5.0, mw)))) / (10.0 ** (2.24 - math.log10(7.5))))
    fs = (crr75 * msf) / max(csr, 1e-6)
    lpi = min(15.0, max(0.0, (1.0 - fs) * 15.0)) if fs < 1.0 else 0.0
    return {"CSR": csr, "CRR75": crr75, "MSF": msf, "FS": fs, "LPI": lpi,
            "rd": rd, "sigma_v_kPa": sigma_v, "sigma_prime_kPa": sigma_prime}


def mohr_coulomb_slope_fs(beta_deg: float, c_kpa: float, phi_deg: float,
                          water_ratio_m: float, depth_m: float,
                          kh: float = 0.0, gamma_kn: float = 18.5) -> dict:
    """Effective-stress infinite-slope FS with pore-water table & pseudo-static kh."""
    b = math.radians(beta_deg)
    zw = water_ratio_m * depth_m
    sigma_n = gamma_kn * depth_m * math.cos(b) ** 2
    u = G_W * zw * math.cos(b) ** 2
    sigma_prime = sigma_n - u
    tau_max = c_kpa + sigma_prime * math.tan(math.radians(phi_deg))
    tau_mob = gamma_kn * depth_m * math.sin(b) * math.cos(b) * (1.0 + kh / max(math.tan(b), 0.05))
    fs = tau_max / max(tau_mob, 1e-6)
    return {"FS": fs, "sigma_n_kPa": sigma_n, "u_kPa": u, "sigma_prime_kPa": sigma_prime,
            "tau_max_kPa": tau_max, "tau_mob_kPa": tau_mob, "zw_m": zw}


def rankine_ka(phi_deg: float) -> float:
    s = math.sin(math.radians(phi_deg))
    return (1.0 - s) / (1.0 + s)


def mononobe_okabe_dpa(gamma_kn: float, H_m: float, kh: float, phi_deg: float) -> float:
    """Simplified Mononobe-Okabe dynamic thrust increment (kN/m)."""
    if kh <= 0:
        return 0.0
    return 0.375 * kh * gamma_kn * H_m * H_m


def burland_tensile_strain(beta: float) -> dict:
    """Burland beam-bending tensile strain limits from angular distortion β = ΔS/L."""
    # Skempton & MacDonald: 1/300 architectural, 1/150 structural
    if beta <= 1.0 / 300.0:
        return {"band": "Within 1/300 — negligible damage", "eps_t": beta * 0.5}
    if beta <= 1.0 / 150.0:
        return {"band": "1/300–1/150 — slight-to-moderate damage", "eps_t": beta * 0.5}
    return {"band": "Exceeds 1/150 — severe structural damage", "eps_t": beta * 0.5}
