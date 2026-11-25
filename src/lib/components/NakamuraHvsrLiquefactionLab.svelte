<script>
  import { onMount } from 'svelte';
  import {
    SITE_PROFILES, computeHvsrCurve, resonanceOverlap,
    liquefactionAssessment, kgRisk
  } from '$lib/engines/nakamuraHvsrSoilEngine.js';
  import { saveRecord } from '$lib/db/geoVaultDb.js';

  export let role = 'homeowner';

  let profileId = 'basin';
  let stories = 8;
  let b = 40;
  let pgaG = 0.25;
  let mw = 6.5;
  let waterTable = 2.0;
  let n160 = 12;
  let live = false;
  let saved = '';
  let canvas;

  $: profile = SITE_PROFILES.find((p) => p.id === profileId) || SITE_PROFILES[0];
  $: curve = computeHvsrCurve(profile, { b });
  $: resonance = resonanceOverlap(curve.f0, stories);
  $: liq = liquefactionAssessment({ pgaG, mw, waterTableM: waterTable, n160 });
  $: kg = kgRisk(curve.Kg);

  $: if (canvas && curve) draw();

  function draw() {
    const ctx = canvas.getContext('2d');
    const W = (canvas.width = canvas.clientWidth * 2 || 900);
    const H = (canvas.height = 320);
    ctx.clearRect(0, 0, W, H);
    const padL = 70, padR = 24, padT = 30, padB = 44;
    const iw = W - padL - padR, ih = H - padT - padB;
    const maxA = Math.max(8, curve.A0 * 1.25);
    const x = (i) => padL + (i / (curve.freqs.length - 1)) * iw;
    const y = (v) => padT + ih - (v / maxA) * ih;
    // grid
    ctx.strokeStyle = 'rgba(148,163,184,0.22)';
    ctx.fillStyle = 'rgba(148,163,184,0.9)';
    ctx.font = '20px IBM Plex Mono, monospace';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const v = (maxA / 4) * g;
      ctx.beginPath(); ctx.moveTo(padL, y(v)); ctx.lineTo(padL + iw, y(v)); ctx.stroke();
      ctx.fillText(v.toFixed(1), 12, y(v) + 6);
    }
    // axes labels
    ctx.fillText('0.2 Hz', padL, H - 14);
    ctx.fillText('20 Hz (log)', padL + iw - 120, H - 14);
    ctx.fillText('HVSR amplitude', padL, 20);
    // curve
    const grad = ctx.createLinearGradient(padL, 0, padL + iw, 0);
    grad.addColorStop(0, '#38bdf8');
    grad.addColorStop(0.5, '#f59e0b');
    grad.addColorStop(1, '#f43f5e');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 4;
    ctx.beginPath();
    curve.hvsr.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
    ctx.stroke();
    // peak marker
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(x(curve.peakIndex), y(curve.A0), 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px IBM Plex Mono, monospace';
    ctx.fillText(`f0 = ${curve.f0.toFixed(2)} Hz · A0 = ${curve.A0.toFixed(1)}`, x(curve.peakIndex) - 40, y(curve.A0) - 18);
    // building frequency marker
    ctx.strokeStyle = '#10b981';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    const fbIdx = curve.freqs.reduce((best, f, i) => (Math.abs(f - resonance.fb) < Math.abs(curve.freqs[best] - resonance.fb) ? i : best), 0);
    ctx.beginPath(); ctx.moveTo(x(fbIdx), padT); ctx.lineTo(x(fbIdx), padT + ih); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#10b981';
    ctx.font = '18px IBM Plex Mono, monospace';
    ctx.fillText(`building ${resonance.fb.toFixed(1)} Hz`, x(fbIdx) + 8, padT + 20);
  }

  function startLive() {
    live = true;
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission().catch(() => {});
    }
    window.addEventListener('devicemotion', onMotion);
  }
  function stopLive() {
    live = false;
    window.removeEventListener('devicemotion', onMotion);
  }
  let motionMag = 0;
  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (a) motionMag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
  }

  async function save() {
    await saveRecord('hvsr_soil_surveys', {
      profile: profile.name, f0: curve.f0, A0: curve.A0, Kg: curve.Kg,
      H: curve.H, overlap: resonance.overlap, liqFS: liq.FS
    });
    saved = 'Saved to offline vault ✓';
    setTimeout(() => (saved = ''), 2500);
  }

  onMount(() => () => stopLive());
</script>

<div class="glass" style="padding: 22px;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
    <div>
      <div class="kicker">Module 01 · Nakamura HVSR</div>
      <h2 style="font-family:var(--display); margin:6px 0 4px; font-size:24px;">Soil Resonance &amp; Liquefaction Lab</h2>
      <p class="dim" style="margin:0; font-size:13px; max-width:640px;">
        Konno–Ohmachi smoothed Horizontal-to-Vertical Spectral Ratio of ambient microtremors.
        Finds soil fundamental frequency, Nakamura vulnerability index Kg and Seed–Idriss liquefaction FS.
      </p>
    </div>
    <span class="chip"><span class="dot {live ? 'dot-live' : 'dot-sim'}"></span>{live ? 'LIVE IMU' : 'SIMULATOR'}</span>
  </div>

  <div class="preset-row" style="margin-top:16px;">
    {#each SITE_PROFILES as p}
      <button class="preset {p.id === profileId ? 'on' : ''}" on:click={() => (profileId = p.id)}>
        <div class="t">{p.name}</div>
        <div class="d">{p.nehrp} · f0 = {p.f0} Hz · A0 = {p.A0} · {p.desc}</div>
      </button>
    {/each}
  </div>

  <div style="display:grid; grid-template-columns: 1.6fr 1fr; gap:16px; margin-top:16px;" class="lab-grid">
    <div class="glass-deep" style="padding:14px;">
      <canvas class="plot" bind:this={canvas} style="height:320px;"></canvas>
      <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
        <button class="btn btn-primary" on:click={startLive} disabled={live}>▶ Live IMU capture</button>
        <button class="btn" on:click={stopLive} disabled={!live}>■ Stop</button>
        <button class="btn" on:click={save}>Save survey to vault</button>
        {#if saved}<span class="chip">{saved}</span>{/if}
        {#if live}<span class="chip mono">|a| = {motionMag.toFixed(2)} m/s²</span>{/if}
      </div>
    </div>

    <div style="display:flex; flex-direction:column; gap:12px;">
      <div class="stat-grid">
        <div class="stat"><div class="k">f₀ soil</div><div class="v">{curve.f0.toFixed(2)}</div><div class="u">Hz</div></div>
        <div class="stat"><div class="k">A₀ peak</div><div class="v">{curve.A0.toFixed(1)}</div><div class="u">×</div></div>
        <div class="stat"><div class="k">Kg index</div><div class="v">{curve.Kg.toFixed(1)}</div><div class="u">{kg.band}</div></div>
        <div class="stat"><div class="k">Depth H</div><div class="v">{curve.H.toFixed(0)}</div><div class="u">m to bedrock</div></div>
        <div class="stat"><div class="k">T soil</div><div class="v">{curve.Tsoil.toFixed(2)}</div><div class="u">s</div></div>
        <div class="stat"><div class="k">Resonance</div><div class="v">{(resonance.overlap * 100).toFixed(0)}%</div><div class="u">{resonance.multiplier.toFixed(1)}× amp</div></div>
      </div>
      <div class="verdict {kg.band === 'LOW' ? 'safe' : kg.band === 'MODERATE' ? 'warn' : 'danger'}">
        <strong>Double resonance:</strong> {resonance.risk}. Building f = {resonance.fb.toFixed(1)} Hz vs soil f₀ = {curve.f0.toFixed(2)} Hz.
        Kg = {curve.Kg.toFixed(1)} — {kg.note}.
      </div>
      <div class="verdict {liq.FS >= 1.25 ? 'safe' : liq.FS >= 1.0 ? 'warn' : 'danger'}">
        <strong>Liquefaction FS = {liq.FS.toFixed(2)}</strong> (CSR {liq.CSR.toFixed(3)} vs CRR {liq.CRR75.toFixed(3)} · LPI {liq.LPI.toFixed(1)}).
        {liq.verdict}.
      </div>
    </div>
  </div>

  <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px,1fr)); gap:14px; margin-top:16px;">
    <div><label class="field" for="stories">Building stories: {stories}</label><input id="stories" type="range" min="1" max="30" bind:value={stories} /></div>
    <div><label class="field" for="pga">Design PGA: {pgaG.toFixed(2)} g</label><input id="pga" type="range" min="0.05" max="0.6" step="0.01" bind:value={pgaG} /></div>
    <div><label class="field" for="mw">Magnitude Mw: {mw.toFixed(1)}</label><input id="mw" type="range" min="5.0" max="8.0" step="0.1" bind:value={mw} /></div>
    <div><label class="field" for="wt">Water table: {waterTable.toFixed(1)} m</label><input id="wt" type="range" min="0" max="8" step="0.1" bind:value={waterTable} /></div>
    <div><label class="field" for="n160">(N₁)₆₀: {n160}</label><input id="n160" type="range" min="4" max="30" bind:value={n160} /></div>
    {#if role !== 'homeowner'}
      <div><label class="field" for="b">Konno–Ohmachi b: {b} (PE)</label><input id="b" type="range" min="10" max="80" bind:value={b} /></div>
    {/if}
  </div>
</div>

<style>
  @media (max-width: 900px) { .lab-grid { grid-template-columns: 1fr !important; } }
</style>
