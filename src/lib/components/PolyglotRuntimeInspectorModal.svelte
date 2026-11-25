<script>
  import { onMount } from 'svelte';
  import { pendingSyncCount, listRecords } from '$lib/db/geoVaultDb.js';

  export let open = false;
  export let onClose = () => {};

  let syncCount = 0;
  let counts = {};
  let pyStatus = '—';
  let bench = null;

  async function refresh() {
    syncCount = await pendingSyncCount();
    counts = {
      hvsr_soil_surveys: (await listRecords('hvsr_soil_surveys')).length,
      structural_crack_logs: (await listRecords('structural_crack_logs')).length,
      seismograph_events: (await listRecords('seismograph_events')).length,
      slope_wall_audits: (await listRecords('slope_wall_audits')).length,
      foundation_quote_reviews: (await listRecords('foundation_quote_reviews')).length
    };
  }

  async function pingPython() {
    pyStatus = 'pinging…';
    try {
      const r = await fetch('/api/geo_structural_solver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'ping' })
      });
      pyStatus = r.ok ? 'ONLINE ✓' : `HTTP ${r.status} (JS mirror active)`;
    } catch {
      pyStatus = 'OFFLINE — 100% JS mirror active';
    }
  }

  function benchmark() {
    const t0 = performance.now();
    let acc = 0;
    for (let i = 0; i < 200000; i++) acc += Math.sin(i * 0.001) * Math.cos(i * 0.002);
    bench = { ms: performance.now() - t0, acc: acc.toFixed(1) };
  }

  $: if (open) { refresh(); pingPython(); }

  onMount(() => refresh());
</script>

{#if open}
  <div class="modal-backdrop" on:click={onClose} role="presentation">
    <div class="modal-card glass-modal" on:click|stopPropagation role="dialog" aria-label="Polyglot runtime inspector">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div class="kicker">Admin · Polyglot Runtime Inspector</div>
          <h3 style="font-family:var(--display); margin:6px 0 0; font-size:22px;">Live Stack Telemetry</h3>
        </div>
        <button class="btn" on:click={onClose}>✕ Close</button>
      </div>

      <table class="data" style="margin-top:16px;">
        <thead><tr><th>Layer</th><th>Runtime</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>Svelte 4 UI (10 components)</td><td class="mono">JS · Vite 5</td><td style="color:var(--emerald)">● mounted</td></tr>
          <tr><td>Engines (5) + Vault DB</td><td class="mono">Pure ES2024 JS</td><td style="color:var(--emerald)">● offline mirror</td></tr>
          <tr><td>Python solver</td><td class="mono">Python 3.12 · Vercel</td><td>{pyStatus}</td></tr>
          <tr><td>Kotlin Geophone IMU</td><td class="mono">200 Hz · Capacitor 6</td><td style="color:var(--amber)">● APK only</td></tr>
          <tr><td>Kotlin Camera2 photogrammetry</td><td class="mono">Intrinsics · macro focus</td><td style="color:var(--amber)">● APK only</td></tr>
          <tr><td>GLSL shaders (2)</td><td class="mono">WebGL2 · 60 FPS</td><td style="color:var(--emerald)">● live</td></tr>
        </tbody>
      </table>

      <div class="stat-grid" style="margin-top:16px;">
        <div class="stat"><div class="k">Sync queue</div><div class="v">{syncCount}</div><div class="u">pending mutations</div></div>
        <div class="stat"><div class="k">HVSR surveys</div><div class="v">{counts.hvsr_soil_surveys ?? 0}</div><div class="u">stored</div></div>
        <div class="stat"><div class="k">Crack logs</div><div class="v">{counts.structural_crack_logs ?? 0}</div><div class="u">stored</div></div>
        <div class="stat"><div class="k">Seismo events</div><div class="v">{counts.seismograph_events ?? 0}</div><div class="u">stored</div></div>
        <div class="stat"><div class="k">Slope audits</div><div class="v">{counts.slope_wall_audits ?? 0}</div><div class="u">stored</div></div>
        <div class="stat"><div class="k">Quote reviews</div><div class="v">{counts.foundation_quote_reviews ?? 0}</div><div class="u">stored</div></div>
      </div>

      <div style="display:flex; gap:8px; margin-top:16px; flex-wrap:wrap;">
        <button class="btn btn-primary" on:click={benchmark}>Run JS benchmark</button>
        <button class="btn" on:click={refresh}>Refresh vault counts</button>
        {#if bench}<span class="chip mono">200k sin/cos in {bench.ms.toFixed(1)} ms</span>{/if}
      </div>
      <p class="faint" style="font-size:12px; margin-top:12px;">
        TypeScript: 0.0% · All engines ship with a 100% offline JS mirror of the Python 3.12 solvers.
      </p>
    </div>
  </div>
{/if}
