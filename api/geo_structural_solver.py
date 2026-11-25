"""GEO-SPECTRA · api/geo_structural_solver.py
Vercel Python 3.12 Serverless Function — Konno-Ohmachi HVSR spectral inversion,
Newmark-Beta SDOF response spectra, Mohr-Coulomb slope/wall stability,
Seed-Idriss liquefaction auditing and foundation pier quote auditing.

POST /api/geo_structural_solver  { "op": "...", ...params }
Ops: hvsr | spectrum | slope | liquefaction | radon | pvr | pier_audit
Paired with a 100% offline client-side JS mirror (src/lib/engines/*.js).
"""
from __future__ import annotations

import json
import math
from http.server import BaseHTTPRequestHandler

from python_geotechnics.nakamura_newmark_seismo import (
    hvsr_curve, hvsr_peak, newmark_beta_spectrum, arias_intensity,
)
from python_geotechnics.mohr_coulomb_liquefaction import (
    liquefaction_csr_crr, mohr_coulomb_slope_fs, rankine_ka,
    mononobe_okabe_dpa, burland_tensile_strain,
)


def solve(payload: dict) -> dict:
    op = payload.get("op", "hvsr")

    if op == "hvsr":
        freqs = payload["freqs"]
        out = hvsr_curve(freqs, payload["s_ns"], payload["s_ew"], payload["s_v"],
                         payload.get("b", 40.0))
        peak = hvsr_peak(freqs, out, payload.get("vs30", 300.0))
        return {"op": op, "hvsr": out, **peak}

    if op == "spectrum":
        spec = newmark_beta_spectrum(payload["accel_gal"], payload.get("fs", 50.0),
                                     payload.get("zeta", 0.05))
        return {"op": op, **spec,
                "arias_m_s": arias_intensity(payload["accel_gal"], payload.get("fs", 50.0))}

    if op == "slope":
        res = mohr_coulomb_slope_fs(
            payload.get("beta", 28), payload.get("c", 10), payload.get("phi", 30),
            payload.get("m", 0.4), payload.get("z", 3.0), payload.get("kh", 0.0),
            payload.get("gamma", 18.5))
        res["Ka"] = rankine_ka(payload.get("phi", 30))
        res["dPa"] = mononobe_okabe_dpa(payload.get("gamma", 18.5),
                                        payload.get("z", 3.0), payload.get("kh", 0.0),
                                        payload.get("phi", 30))
        return {"op": op, **res}

    if op == "liquefaction":
        return {"op": op, **liquefaction_csr_crr(
            payload.get("pga_g", 0.25), payload.get("mw", 6.5),
            payload.get("water_table_m", 2.0), payload.get("depth_m", 6.0),
            payload.get("gamma", 18.5), payload.get("gamma_sat", 19.5),
            payload.get("n1_60", 12.0), payload.get("fines_pct", 8.0))}

    if op == "burland":
        return {"op": op, **burland_tensile_strain(payload.get("beta", 1 / 240))}

    if op == "ping":
        return {"op": op, "status": "ok", "engine": "geo_structural_solver 1.25.0"}

    return {"op": op, "error": f"unknown op: {op}"}


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8"))
            result = solve(payload)
            code = 200
        except Exception as exc:  # noqa: BLE001
            result = {"error": str(exc)}
            code = 400
        body = json.dumps(result).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        body = json.dumps(solve({"op": "ping"})).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def handler(event, context):  # Vercel serverless entrypoint (best-effort)
    payload = json.loads(event.get("body") or "{}")
    return {"statusCode": 200, "body": json.dumps(solve(payload))}
