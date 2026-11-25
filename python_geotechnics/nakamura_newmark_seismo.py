"""GEO-SPECTRA · nakamura_newmark_seismo.py
Python 3.12 scientific module — Konno-Ohmachi logarithmic spectral smoothing,
Nakamura HVSR vulnerability index Kg, Newmark-Beta SDOF response spectra
Sa(T)/Sv(T)/Sd(T) and Arias Intensity. Mirrored 1:1 by the offline JS engine
(src/lib/engines/nakamuraHvsrSoilEngine.js + seismographStaLtaEngine.js).
"""
from __future__ import annotations

import math

G = 9.81


def konno_ohmachi_weight(f: float, fc: float, b: float = 40.0) -> float:
    """Konno-Ohmachi smoothing window W(f, fc) = [sin(b·log10(f/fc)) / (b·log10(f/fc))]^4."""
    if f <= 0 or fc <= 0:
        return 0.0
    x = b * math.log10(f / fc)
    if abs(x) < 1e-9:
        return 1.0
    return (math.sin(x) / x) ** 4


def smooth_spectrum(freqs: list[float], amps: list[float], b: float = 40.0) -> list[float]:
    """Apply Konno-Ohmachi smoothing to a sampled amplitude spectrum."""
    out: list[float] = []
    for i, fc in enumerate(freqs):
        num = den = 0.0
        for j, f in enumerate(freqs):
            w = konno_ohmachi_weight(f, fc, b)
            num += w * amps[j]
            den += w
        out.append(num / den if den > 0 else amps[i])
    return out


def hvsr_curve(freqs: list[float], s_ns: list[float], s_ew: list[float], s_v: list[float],
               b: float = 40.0) -> list[float]:
    """Nakamura HVSR(f) = sqrt((S_NS^2 + S_EW^2)/2) / S_V after smoothing."""
    sns = smooth_spectrum(freqs, s_ns, b)
    sew = smooth_spectrum(freqs, s_ew, b)
    sv = smooth_spectrum(freqs, s_v, b)
    return [math.sqrt((a * a + c * c) / 2.0) / max(v, 1e-12) for a, c, v in zip(sns, sew, sv)]


def hvsr_peak(freqs: list[float], hvsr: list[float], vs30: float = 300.0) -> dict:
    """Extract f0, A0, Kg = A0^2/f0, sediment depth H = Vs/(4·f0), Tsoil = 1/f0."""
    i = max(range(len(hvsr)), key=lambda k: hvsr[k])
    f0, a0 = freqs[i], hvsr[i]
    return {
        "f0": f0,
        "A0": a0,
        "Kg": a0 * a0 / f0,
        "H_m": vs30 / (4.0 * f0),
        "Tsoil_s": 1.0 / f0,
    }


def newmark_beta_spectrum(accel_gal: list[float], fs: float, zeta: float = 0.05,
                          periods: list[float] | None = None) -> dict:
    """Newmark-Beta (gamma=1/2, beta=1/4) SDOF elastic response spectrum.

    Solves u'' + 2ζωn u' + ωn²u = -ag(t) for each period; returns Sa (g),
    Sv (cm/s), Sd (cm).
    """
    if periods is None:
        periods = [0.05 * (3.0 / 0.05) ** (k / 39) for k in range(40)]
    dt = 1.0 / fs
    a0 = 1.0 / (0.25 * dt * dt)
    a1 = 0.5 / dt
    a2 = 1.0 / dt
    a3 = 0.5
    a4 = 0.25 / dt
    a5 = 0.125 * dt
    Sa, Sv, Sd = [], [], []
    for T in periods:
        wn = 2.0 * math.pi / T
        k_eff = wn * wn + 2.0 * zeta * wn * a1 + a0
        u = v = 0.0
        a = -accel_gal[0]
        u_max = v_max = a_max = 0.0
        for ag in accel_gal:
            du = (a0 * u + a2 * v + a3 * a + ag) / k_eff
            dv = a1 * du
            da = a4 * du - a5 * v
            u += du
            v += dv
            a = da
            u_max = max(u_max, abs(u))
            v_max = max(v_max, abs(v))
            a_max = max(a_max, abs(a))
        Sa.append(a_max / 980.665)
        Sv.append(v_max)
        Sd.append(u_max)
    return {"periods": periods, "Sa_g": Sa, "Sv_cm_s": Sv, "Sd_cm": Sd, "zeta": zeta}


def arias_intensity(accel_gal: list[float], fs: float) -> float:
    """Arias intensity Ia = π/(2g) ∫ a²(t) dt  (m/s), a in m/s²."""
    total = sum((a / 100.0) ** 2 for a in accel_gal) / fs
    return math.pi / (2.0 * G) * total
