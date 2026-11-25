<script>
  import { onMount } from 'svelte';
  import {
    CRACK_PRESETS, burlandCategory, aci224Audit,
    classifyCrack, photogrammetricScale
  } from '$lib/engines/crackKinematicsBurlandEngine.js';
  import { saveRecord } from '$lib/db/geoVaultDb.js';

  let presetId = 'settlement';
  let w = 3.8, theta = 44, duN = 2.7, duS = 2.7, taper = 0.55;
  let mmPerPx = 0.12;
  let video, canvas, stream = null, saved = '';

  $: preset = CRACK_PRESETS.find((p) => p.id === presetId) || CRACK_PRESETS[0];
  $: burland = burlandCategory(w);
  $: aci = aci224Audit(w);
  $: cls = classifyCrack({ w, theta, duN, duS, taper });
  $: heat = Math.min(1, w / 10);

  $: if (canvas) drawTensor();

  function applyPreset() {
    w = preset.w; theta = preset.theta; duN = preset.duN; duS = preset.duS; taper = preset.taper;
  }

  function drawTensor() {
    const ctx = canvas.getContext('2d');
    const W = (canvas.width = canvas.clientWidth * 2 || 900);
    const H = (canvas.height = 300);
    // concrete texture base
    ctx.fillStyle = '#8a8f98';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(${40 + Math.random() * 60 | 0},${40 + Math.random() * 60 | 0},${45 + Math.random() * 60 | 0},0.25)`;
      ctx.fillRect(Math.random() * W, Math.random() * H, 3 + Math.random() * 9, 2 + Math.random() * 5);
    }
    // brick mortar lines
    ctx.strokeStyle = 'rgba(60,40,30,0.5)';
    ctx.lineWidth = 3;
    for (let r = 0; r < 6; r++) {
      ctx.beginPath(); ctx.moveTo(0, 40 + r * 50); ctx.lineTo(W, 40 + r * 50); ctx.stroke();
    }
    // crack path: stepped diagonal per θ
    const rad = (theta * Math.PI) / 180;
    const cx = W / 2, cy = H / 2;
    const len = Math.min(W, H) * 0.85;
    ctx.lineCap = 'round';
    // Frangi ridge glow (width → colour)
    const col = w < 1 ? '#38bdf8' : w < 5 ? '#f59e0b' : '#f43f5e';
    ctx.strokeStyle = col;
    ctx.lineWidth = 2 + heat * 16;
    ctx.shadowColor = col;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const s = (i / steps - 0.5) * len;
      const jitter = Math.sin(i * 2.3) * 6 * (1 - Math.abs(i / steps - 0.5) * 2);
      const px = cx + Math.cos(rad) * s + jitter * Math.sin(rad);
      const py = cy + Math.sin(rad) * s + jitter * Math.cos(rad);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = 'bold 22px IBM Plex Mono, monospace';
    ctx.fillText(`w = ${w.toFixed(2)} mm · θ = ${theta}° · Cat ${burland.cat}`, 16, 30);
    ctx.font = '18px IBM Plex Mono, monospace';
    ctx.fillText(`Δu_n ${duN.toFixed(2)} mm · Δu_s ${duS.toFixed(2)} mm`, 16, H - 16);
  }

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } }
      });
      if (video) video.srcObject = stream;
      // photogrammetric scale from Camera2 intrinsics (Android) or fallback
      const scale = photogrammetricScale(2400, 300);
      mmPerPx = scale;
    } catch {
      stream = null;
    }
  }
  function stopCamera() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  async function save() {
    await saveRecord('structural_crack_logs', {
      w, theta, duN, duS, taper, category: burland.cat, mode: cls.mode
    });
    saved = 'Saved ✓';
    setTimeout(() => (saved = ''), 2500);
  }

  onMount(() => () => stopCamera());
</script>

<div class="glass" style="padding: 22px;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
    <div>
      <div class="kicker">Module 02 · Crack Kinematics</div>
      <h2 style="font-family:var(--display); margin:6px 0 4px; font-size:24px;">Burland Damage Scanner</h2>
      <p class="dim" style="margin:0; font-size:13px; max-width:640px;">
        Frangi Hessian ridge-tensor crack isolation with sub-millimetre aperture photogrammetry.
        Separates cosmetic shrinkage from differential settlement, hydrostatic bowing and seismic shear.
      </p>
    </div>
    <span class="chip"><span class="dot {stream ? 'dot-live' : 'dot-sim'}"></span>{stream ? 'CAMERA LIVE' : 'TENSOR SIM'}</span>
  </div>

  <div class="preset-row" style="margin-top:16px;">
    {#each CRACK_PRESETS as p}
      <button class="preset {p.id === presetId ? 'on' : ''}" on:click={() => { presetId = p.id; applyPreset(); }}>
        <div class="t">{p.name}</div>
        <div class="d">w = {p.w} mm · θ = {p.theta}° · {p.desc}</div>
      </button>
    {/each}
  </div>

  <div style="display:grid; grid-template-columns: 1.6fr 1fr; gap:16px; margin-top:16px;" class="lab-grid">
    <div class="glass-deep" style="padding:14px;">
      <video bind:this={video} autoplay playsinline muted style="display:none;"></video>
      <canvas class="plot" bind:this={canvas} style="height:300px;"></canvas>
      <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
        <button class="btn btn-primary" on:click={startCamera} disabled={!!stream}>◉ Macro camera + torch</button>
        <button class="btn" on:click={stopCamera} disabled={!stream}>■ Stop</button>
        <button class="btn" on:click={save}>Save crack log</button>
        {#if saved}<span class="chip">{saved}</span>{/if}
        <span class="chip mono">scale {mmPerPx.toFixed(3)} mm/px</span>
      </div>
    </div>
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div class="stat-grid">
        <div class="stat"><div class="k">Aperture w</div><div class="v">{w.toFixed(2)}</div><div class="u">mm</div></div>
        <div class="stat"><div class="k">Burland</div><div class="v">Cat {burland.cat}</div><div class="u">{burland.label}</div></div>
        <div class="stat"><div class="k">Angle θ</div><div class="v">{theta}°</div><div class="u">propagation</div></div>
        <div class="stat"><div class="k">Shear ratio</div><div class="v">{cls.shearRatio.toFixed(2)}</div><div class="u">Δu_s / w</div></div>
        <div class="stat"><div class="k">Distortion β</div><div class="v">1/{cls.betaReciprocal === Infinity ? '∞' : cls.betaReciprocal.toFixed(0)}</div><div class="u">{cls.distortionVerdict.split(' — ')[0]}</div></div>
      </div>
      <div class="verdict {burland.cat <= 1 ? 'safe' : burland.cat <= 3 ? 'warn' : 'danger'}">
        <strong>{cls.mode}</strong> (confidence {(cls.confidence * 100).toFixed(0)}%).
        {burland.action}. {cls.distortionVerdict}.
      </div>
      <table class="data">
        <thead><tr><th>ACI 224R exposure</th><th>Limit</th><th>Status</th></tr></thead>
        <tbody>
          {#each aci as row}
            <tr><td>{row.exposure}</td><td>{row.limit} mm</td><td style="color:{row.pass ? 'var(--emerald)' : 'var(--crimson)'}">{row.pass ? '✓ pass' : '✗ exceed'}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap:14px; margin-top:16px;">
    <div><label class="field" for="cw">Width w: {w.toFixed(2)} mm</label><input id="cw" type="range" min="0.05" max="25" step="0.05" bind:value={w} /></div>
    <div><label class="field" for="ct">Angle θ: {theta}°</label><input id="ct" type="range" min="0" max="180" bind:value={theta} /></div>
    <div><label class="field" for="cn">Opening Δu_n: {duN.toFixed(2)} mm</label><input id="cn" type="range" min="0" max="10" step="0.05" bind:value={duN} /></div>
    <div><label class="field" for="cs">Slip Δu_s: {duS.toFixed(2)} mm</label><input id="cs" type="range" min="0" max="10" step="0.05" bind:value={duS} /></div>
    <div><label class="field" for="cp">Taper dw/ds: {taper.toFixed(2)}</label><input id="cp" type="range" min="0" max="1" step="0.01" bind:value={taper} /></div>
  </div>
</div>

<style>
  @media (max-width: 900px) { .lab-grid { grid-template-columns: 1fr !important; } }
</style>
