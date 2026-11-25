<script>
  import { onMount } from 'svelte';
  import {
    SLOPE_SCENARIOS, slopeFactorOfSafety, retainingWallStability
  } from '$lib/engines/mohrCoulombSlopeWallEngine.js';
  import { saveRecord } from '$lib/db/geoVaultDb.js';

  export let role = 'homeowner';

  let scenarioId = 'rain';
  let beta = 31, c = 8, phi = 28, m = 0.88, z = 3.5, kh = 0.0;
  let wallH = 2.4, waterH = 2.0;
  let live = false, saved = '';
  let canvas;

  $: scenario = SLOPE_SCENARIOS.find((s) => s.id === scenarioId) || SLOPE_SCENARIOS[0];
  $: slope = slopeFactorOfSafety({ beta, c, phi, m, z, kh });
  $: wall = retainingWallStability({ H: wallH, Hw: waterH, phi, kh });
  $: cls = slope.cls;

  $: if (canvas && slope) drawMohr();

  function applyScenario() {
    beta = scenario.beta; c = scenario.c; phi = scenario.phi;
    m = scenario.m; z = scenario.z; kh = scenario.kh;
  }

  function drawMohr() {
    const ctx = canvas.getContext('2d');
    const W = (canvas.width = canvas.clientWidth * 2 || 900);
    const H = (canvas.height = 340);
    ctx.clearRect(0, 0, W, H);
    const padL = 64, padR = 20, padT = 26, padB = 40;
    const iw = W - padL - padR, ih = H - padT - padB;
    const maxS = Math.max(120, slope.center + slope.radius + 40);
    const x = (s) => padL + (s / maxS) * iw;
    const y = (t) => padT + ih - (t / (maxS * 0.7)) * ih;
    // axes
    ctx.strokeStyle = 'rgba(148,163,184,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + ih); ctx.lineTo(padL + iw, padT + ih); ctx.stroke();
    ctx.fillStyle = 'rgba(148,163,184,0.95)';
    ctx.font = '18px IBM Plex Mono, monospace';
    ctx.fillText("σ′ (kPa)", padL + iw - 80, padT + ih + 28);
    ctx.fillText('τ (kPa)', 8, padT + 4);
    // failure envelope τ = c + σ tanφ
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x(0), y(c));
    ctx.lineTo(x(maxS), y(c + maxS * Math.tan((phi * Math.PI) / 180)));
    ctx.stroke();
    ctx.fillStyle = '#f43f5e';
    ctx.fillText('failure envelope', x(maxS * 0.55), y(c + maxS * 0.55 * Math.tan((phi * Math.PI) / 180)) - 8);
    // Mohr circle
    const cx = x(slope.center), cy = y(0);
    const rPx = (slope.radius / maxS) * iw;
    const rPy = (slope.radius / (maxS * 0.7)) * ih;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(rPx, 4), Math.max(rPy, 4), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`FS = ${slope.FS.toFixed(2)}`, cx - 50, cy - Math.max(rPy, 4) - 12);
    // slip-plane point
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.arc(x(slope.sigmaPrime), y(slope.tauMob), 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('slip plane', x(slope.sigmaPrime) + 12, y(slope.tauMob) + 6);
    // slope profile sketch
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(padL + 10, padT + ih - 10);
    ctx.lineTo(padL + 10 + iw * 0.55, padT + ih - 10 - Math.tan((beta * Math.PI) / 180) * iw * 0.55);
    ctx.stroke();
    ctx.fillStyle = '#10b981';
    ctx.fillText(`β = ${beta}°`, padL + 16, padT + ih - 16);
  }

  function startLive() {
    live = true;
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
    window.addEventListener('deviceorientation', onOrient);
  }
  function stopLive() { live = false; window.removeEventListener('deviceorientation', onOrient); }
  let tilt = 0;
  function onOrient(e) {
    tilt = Math.abs(e.beta || 0);
    beta = Math.min(60, Math.max(5, Math.round(tilt)));
  }

  async function save() {
    await saveRecord('slope_wall_audits', {
      beta, c, phi, m, z, kh, FS: slope.FS, FSover: wall.FSover, FSslide: wall.FSslide
    });
    saved = 'Saved ✓';
    setTimeout(() => (saved = ''), 2500);
  }

  onMount(() => () => stopLive());
</script>

<div class="glass" style="padding: 22px;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
    <div>
      <div class="kicker">Module 04 · Mohr–Coulomb Shield</div>
      <h2 style="font-family:var(--display); margin:6px 0 4px; font-size:24px;">Landslide &amp; Retaining-Wall Shield</h2>
      <p class="dim" style="margin:0; font-size:13px; max-width:640px;">
        Effective-stress infinite-slope FS with pore-water table, interactive Mohr circle tangency,
        and Rankine / Mononobe–Okabe retaining-wall overturning &amp; sliding audit.
      </p>
    </div>
    <span class="chip"><span class="dot {live ? 'dot-live' : 'dot-sim'}"></span>{live ? 'CLINOMETER LIVE' : 'SIMULATOR'}</span>
  </div>

  <div class="preset-row" style="margin-top:16px;">
    {#each SLOPE_SCENARIOS as s}
      <button class="preset {s.id === scenarioId ? 'on' : ''}" on:click={() => { scenarioId = s.id; applyScenario(); }}>
        <div class="t">{s.name}</div>
        <div class="d">{s.desc}</div>
      </button>
    {/each}
  </div>

  <div style="display:grid; grid-template-columns: 1.6fr 1fr; gap:16px; margin-top:16px;" class="lab-grid">
    <div class="glass-deep" style="padding:14px;">
      <canvas class="plot" bind:this={canvas} style="height:340px;"></canvas>
      <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
        <button class="btn btn-primary" on:click={startLive} disabled={live}>◉ IMU clinometer (0.01°)</button>
        <button class="btn" on:click={stopLive} disabled={!live}>■ Stop</button>
        <button class="btn" on:click={save}>Save audit</button>
        {#if saved}<span class="chip">{saved}</span>{/if}
        {#if live}<span class="chip mono">tilt {tilt.toFixed(2)}°</span>{/if}
      </div>
    </div>
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div class="stat-grid">
        <div class="stat"><div class="k">Slope FS</div><div class="v">{slope.FS.toFixed(2)}</div><div class="u">{slope.cls.toUpperCase()}</div></div>
        <div class="stat"><div class="k">σ′_n</div><div class="v">{slope.sigmaPrime.toFixed(1)}</div><div class="u">kPa</div></div>
        <div class="stat"><div class="k">Pore u</div><div class="v">{slope.u.toFixed(1)}</div><div class="u">kPa · zw {slope.zw.toFixed(1)} m</div></div>
        <div class="stat"><div class="k">Overturn FS</div><div class="v">{wall.FSover.toFixed(2)}</div><div class="u">wall</div></div>
        <div class="stat"><div class="k">Sliding FS</div><div class="v">{wall.FSslide.toFixed(2)}</div><div class="u">wall</div></div>
        <div class="stat"><div class="k">Ka</div><div class="v">{wall.Ka.toFixed(2)}</div><div class="u">Rankine</div></div>
      </div>
      <div class="verdict {cls}">
        <strong>{slope.verdict}.</strong> τ_max {slope.tauMax.toFixed(1)} kPa vs τ_mob {slope.tauMob.toFixed(1)} kPa.
        Wall: {wall.verdict} (Pa {wall.Pa.toFixed(1)} + Pw {wall.Pw.toFixed(1)} kN/m).
      </div>
    </div>
  </div>

  <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(170px,1fr)); gap:14px; margin-top:16px;">
    <div><label class="field" for="beta">Slope β: {beta}°</label><input id="beta" type="range" min="5" max="60" bind:value={beta} /></div>
    <div><label class="field" for="cc">Cohesion c′: {c} kPa</label><input id="cc" type="range" min="0" max="30" bind:value={c} /></div>
    <div><label class="field" for="phi">Friction φ′: {phi}°</label><input id="phi" type="range" min="10" max="45" bind:value={phi} /></div>
    <div><label class="field" for="mm">Water ratio m: {m.toFixed(2)}</label><input id="mm" type="range" min="0" max="1" step="0.01" bind:value={m} /></div>
    <div><label class="field" for="zz">Depth z: {z.toFixed(1)} m</label><input id="zz" type="range" min="1" max="8" step="0.1" bind:value={z} /></div>
    <div><label class="field" for="kh">Seismic k_h: {kh.toFixed(2)} g</label><input id="kh" type="range" min="0" max="0.4" step="0.01" bind:value={kh} /></div>
    <div><label class="field" for="wh">Wall water H_w: {waterH.toFixed(1)} m</label><input id="wh" type="range" min="0" max="2.4" step="0.1" bind:value={waterH} /></div>
  </div>
</div>

<style>
  @media (max-width: 900px) { .lab-grid { grid-template-columns: 1fr !important; } }
</style>
