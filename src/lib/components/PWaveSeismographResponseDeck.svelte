<script>
  import { onMount } from 'svelte';
  import {
    ACCELEROGRAMS, synthesizeAccelerogram, staLtaScan,
    responseSpectrum, epicentralDistance, mmiFromGroundMotion
  } from '$lib/engines/seismographStaLtaEngine.js';
  import { saveRecord } from '$lib/db/geoVaultDb.js';

  export let role = 'homeowner';

  let presetId = 'nearfault';
  let zeta = 0.05;
  let live = false;
  let saved = '';
  let canvas, specCanvas;

  $: preset = ACCELEROGRAMS.find((p) => p.id === presetId) || ACCELEROGRAMS[0];
  $: accel = synthesizeAccelerogram(preset);
  $: scan = staLtaScan(accel.ah, accel.fs);
  $: spec = responseSpectrum(accel.az, accel.fs, { zeta });
  $: dist = epicentralDistance(preset.dtSP);
  $: mmi = mmiFromGroundMotion(accel.pgaG, accel.pgvCmS);

  $: if (canvas && specCanvas && accel) { drawWave(); drawSpec(); }

  function drawWave() {
    const ctx = canvas.getContext('2d');
    const W = (canvas.width = canvas.clientWidth * 2 || 900);
    const H = (canvas.height = 260);
    ctx.clearRect(0, 0, W, H);
    const padL = 60, padR = 16, padT = 22, padB = 30;
    const iw = W - padL - padR, ih = H - padT - padB;
    const n = accel.t.length;
    const maxA = Math.max(...accel.ah) * 1.15 || 1;
    const x = (i) => padL + (i / (n - 1)) * iw;
    const y = (v) => padT + ih - (v / maxA) * ih;
    ctx.strokeStyle = 'rgba(148,163,184,0.2)';
    ctx.fillStyle = 'rgba(148,163,184,0.9)';
    ctx.font = '18px IBM Plex Mono, monospace';
    ctx.beginPath(); ctx.moveTo(padL, y(0)); ctx.lineTo(padL + iw, y(0)); ctx.stroke();
    ctx.fillText('horizontal a_H (Gal)', padL, 16);
    // STA/LTA ratio (faint)
    const maxR = Math.max(...scan.ratio) || 1;
    ctx.strokeStyle = 'rgba(56,189,248,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < n; i += 2) {
      const px = x(i), py = padT + ih - Math.min(1, scan.ratio[i] / maxR) * ih * 0.5;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    // waveform
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < n; i += 2) {
      const px = x(i), py = y(accel.ah[i]);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    // P / S picks
    const mark = (t, col, label) => {
      const idx = Math.round(t * accel.fs);
      ctx.strokeStyle = col;
      ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(x(idx), padT); ctx.lineTo(x(idx), padT + ih); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col;
      ctx.fillText(label, x(idx) + 6, padT + 16);
    };
    mark(accel.tP, '#38bdf8', 'P');
    mark(accel.tS, '#f43f5e', 'S');
    ctx.fillStyle = 'rgba(148,163,184,0.9)';
    ctx.fillText(`0 s`, padL, H - 8);
    ctx.fillText(`${preset.durationS} s`, padL + iw - 50, H - 8);
  }

  function drawSpec() {
    const ctx = specCanvas.getContext('2d');
    const W = (specCanvas.width = specCanvas.clientWidth * 2 || 900);
    const H = (specCanvas.height = 260);
    ctx.clearRect(0, 0, W, H);
    const padL = 60, padR = 16, padT = 22, padB = 34;
    const iw = W - padL - padR, ih = H - padT - padB;
    const maxSa = Math.max(...spec.Sa) * 1.2 || 1;
    const x = (i) => padL + (i / (spec.periods.length - 1)) * iw;
    const y = (v) => padT + ih - (v / maxSa) * ih;
    ctx.strokeStyle = 'rgba(148,163,184,0.2)';
    ctx.fillStyle = 'rgba(148,163,184,0.9)';
    ctx.font = '18px IBM Plex Mono, monospace';
    for (let g = 0; g <= 3; g++) {
      const v = (maxSa / 3) * g;
      ctx.beginPath(); ctx.moveTo(padL, y(v)); ctx.lineTo(padL + iw, y(v)); ctx.stroke();
      ctx.fillText(v.toFixed(2) + 'g', 6, y(v) + 6);
    }
    ctx.fillText('Sa(T) · 5% damped', padL, 16);
    const grad = ctx.createLinearGradient(padL, 0, padL + iw, 0);
    grad.addColorStop(0, '#f43f5e'); grad.addColorStop(0.5, '#f59e0b'); grad.addColorStop(1, '#38bdf8');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 4;
    ctx.beginPath();
    spec.Sa.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
    ctx.stroke();
    // peak period → story height
    let pk = 0; spec.Sa.forEach((v, i) => { if (v > spec.Sa[pk]) pk = i; });
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px IBM Plex Mono, monospace';
    ctx.fillText(`peak T = ${spec.periods[pk].toFixed(2)} s ≈ ${Math.max(1, Math.round(spec.periods[pk] * 10))} stories`, x(pk) - 60, y(spec.Sa[pk]) - 12);
    ctx.fillText('0.05 s (1-story)', padL, H - 8);
    ctx.fillText('3.0 s (30-story)', padL + iw - 130, H - 8);
  }

  function startLive() {
    live = true;
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission().catch(() => {});
    }
    window.addEventListener('devicemotion', onMotion);
    if (navigator.vibrate) navigator.vibrate(60);
  }
  function stopLive() { live = false; window.removeEventListener('devicemotion', onMotion); }
  let motionMag = 0;
  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (a) motionMag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    if (motionMag > 22 && navigator.vibrate) navigator.vibrate([80, 40, 80]);
  }

  async function save() {
    await saveRecord('seismograph_events', {
      preset: preset.name, dist, pgaG: accel.pgaG, pgvCmS: accel.pgvCmS,
      ia: accel.ia, mmi: mmi.mmi
    });
    saved = 'Saved ✓';
    setTimeout(() => (saved = ''), 2500);
  }

  onMount(() => () => stopLive());
</script>

<div class="glass" style="padding: 22px;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
    <div>
      <div class="kicker">Module 03 · STA/LTA Seismograph</div>
      <h2 style="font-family:var(--display); margin:6px 0 4px; font-size:24px;">P-Wave / S-Wave Response Deck</h2>
      <p class="dim" style="margin:0; font-size:13px; max-width:640px;">
        Recursive STA/LTA arrival picker, epicentral distance, PGA / PGV / Arias Intensity,
        USGS MMI and Newmark-Beta elastic response spectrum Sa(T) for 1–30 storey buildings.
      </p>
    </div>
    <span class="chip"><span class="dot {live ? 'dot-live' : 'dot-sim'}"></span>{live ? 'LIVE ACCELEROGRAPH' : 'SIMULATOR'}</span>
  </div>

  <div class="preset-row" style="margin-top:16px;">
    {#each ACCELEROGRAMS as p}
      <button class="preset {p.id === presetId ? 'on' : ''}" on:click={() => (presetId = p.id)}>
        <div class="t">{p.name}</div>
        <div class="d">{p.desc}</div>
      </button>
    {/each}
  </div>

  <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-top:16px;" class="lab-grid">
    <div class="glass-deep" style="padding:14px;">
      <canvas class="plot" bind:this={canvas} style="height:260px;"></canvas>
      <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
        <button class="btn btn-primary" on:click={startLive} disabled={live}>▶ Live accelerograph</button>
        <button class="btn" on:click={stopLive} disabled={!live}>■ Stop</button>
        <button class="btn" on:click={save}>Save event</button>
        {#if saved}<span class="chip">{saved}</span>{/if}
        {#if live}<span class="chip mono">|a| = {motionMag.toFixed(2)} m/s²</span>{/if}
      </div>
    </div>
    <div class="glass-deep" style="padding:14px;">
      <canvas class="plot" bind:this={specCanvas} style="height:260px;"></canvas>
      <div style="margin-top:10px;">
        <label class="field" for="zeta">Damping ζ: {(zeta * 100).toFixed(0)}% {#if role === 'homeowner'}(5% fixed){/if}</label>
        <input id="zeta" type="range" min="0.02" max="0.10" step="0.01" bind:value={zeta} disabled={role === 'homeowner'} />
      </div>
    </div>
  </div>

  <div class="stat-grid" style="margin-top:16px;">
    <div class="stat"><div class="k">Distance D</div><div class="v">{dist.toFixed(0)}</div><div class="u">km · 8·Δt</div></div>
    <div class="stat"><div class="k">PGA</div><div class="v">{accel.pgaG.toFixed(3)}</div><div class="u">g · {accel.pgaGal.toFixed(0)} Gal</div></div>
    <div class="stat"><div class="k">PGV</div><div class="v">{accel.pgvCmS.toFixed(1)}</div><div class="u">cm/s</div></div>
    <div class="stat"><div class="k">Arias I_A</div><div class="v">{accel.ia.toFixed(2)}</div><div class="u">m/s</div></div>
    <div class="stat"><div class="k">CAV</div><div class="v">{accel.cav.toFixed(2)}</div><div class="u">m/s</div></div>
    <div class="stat"><div class="k">USGS MMI</div><div class="v">{mmi.roman}</div><div class="u">{mmi.label}</div></div>
  </div>
  <div class="verdict {accel.pgaG >= 0.3 ? 'danger' : accel.pgaG >= 0.1 ? 'warn' : 'info'}" style="margin-top:12px;">
    <strong>{preset.name}</strong> — Δt S–P = {preset.dtSP}s → {dist.toFixed(0)} km.
    STA/LTA trigger threshold 3.0× · P picked at {accel.tP.toFixed(1)} s (vertical), S at {accel.tS.toFixed(1)} s (horizontal).
    {accel.pgaG >= 0.3 ? 'Strong-motion: non-structural damage expected.' : accel.pgaG >= 0.1 ? 'Felt strongly; check drift-sensitive contents.' : 'Below damage threshold.'}
  </div>
</div>

<style>
  @media (max-width: 900px) { .lab-grid { grid-template-columns: 1fr !important; } }
</style>
