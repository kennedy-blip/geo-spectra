<script>
  import { onMount } from 'svelte';
  import { spring } from 'svelte/motion';
  import NakamuraHvsrLiquefactionLab from '$lib/components/NakamuraHvsrLiquefactionLab.svelte';
  import CrackKinematicsBurlandScanner from '$lib/components/CrackKinematicsBurlandScanner.svelte';
  import PWaveSeismographResponseDeck from '$lib/components/PWaveSeismographResponseDeck.svelte';
  import MohrCoulombSlopeWallShield from '$lib/components/MohrCoulombSlopeWallShield.svelte';
  import ExpansiveSoilPierQuoteAuditor from '$lib/components/ExpansiveSoilPierQuoteAuditor.svelte';
  import HardwarePermissionGatekeeper from '$lib/components/HardwarePermissionGatekeeper.svelte';
  import PolyglotRuntimeInspectorModal from '$lib/components/PolyglotRuntimeInspectorModal.svelte';
  import ApkReleaseDownloadModal from '$lib/components/ApkReleaseDownloadModal.svelte';
  import { pendingSyncCount, flushSyncQueue, exportReport, downloadJson } from '$lib/db/geoVaultDb.js';

  const THEMES = [
    { id: 'basalt', label: 'Tectonic Basalt' },
    { id: 'blueprint', label: 'Blueprint Daylight' },
    { id: 'shakemap', label: 'USGS ShakeMap' },
    { id: 'eco', label: 'Eco-Glass Low-GPU' }
  ];
  const ROLES = [
    { id: 'homeowner', label: 'Homeowner' },
    { id: 'pe', label: 'Licensed PE' },
    { id: 'admin', label: 'Seismo Architect' }
  ];
  const LABS = [
    { id: 'hvsr', label: 'HVSR Soil', icon: '◈' },
    { id: 'crack', label: 'Crack', icon: '⌁' },
    { id: 'seismo', label: 'Seismograph', icon: '∿' },
    { id: 'slope', label: 'Slope/Wall', icon: '△' },
    { id: 'pier', label: 'Pier Auditor', icon: '⚓' }
  ];

  let theme = 'basalt';
  let role = 'homeowner';
  let viewport = 'desktop';
  let activeLab = 'hvsr';
  let apkOpen = false;
  let inspectorOpen = false;
  let syncOpen = false;
  let syncCount = 0;
  let syncMsg = '';
  let exported = '';

  const dockX = spring(0, { stiffness: 0.17, damping: 0.65 });

  $: if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme === 'basalt' ? '' : theme);
  }

  function go(id) {
    activeLab = id;
    dockX.set(LABS.findIndex((l) => l.id === id));
    document.getElementById(`lab-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function refreshSync() { syncCount = await pendingSyncCount(); }

  async function syncNow() {
    syncMsg = 'Syncing…';
    const r = await flushSyncQueue();
    syncMsg = `Sent ${r.sent} · failed ${r.failed} / ${r.total}`;
    await refreshSync();
  }

  async function exportAll() {
    const report = await exportReport();
    downloadJson('geo-spectra-inspection-report.json', report);
    exported = 'Report exported ✓';
    setTimeout(() => (exported = ''), 2500);
  }

  onMount(() => {
    refreshSync();
    const iv = setInterval(refreshSync, 5000);
    return () => clearInterval(iv);
  });
</script>

<svelte:head>
  <title>GEO-SPECTRA · Geotechnical Workstation</title>
</svelte:head>

<div style="position:relative; z-index:1; max-width:1280px; margin:0 auto; padding:18px 18px 140px;">
  <!-- Header -->
  <header class="glass" style="padding:16px 20px; display:flex; flex-direction:column; gap:12px;">
    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
      <div>
        <div class="kicker">Day 25 · Champion Stack A · 0.0% TypeScript</div>
        <h1 style="font-family:var(--display); margin:4px 0 0; font-size:clamp(26px, 4vw, 40px); letter-spacing:-0.02em;">
          GEO-SPECTRA <span style="color:var(--amber);">·</span> <span style="font-size:0.55em; color:var(--ink-dim);">Geotechnical Workstation</span>
        </h1>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn btn-primary" on:click={() => (apkOpen = true)}>⬇ Android .APK v1.25.0</button>
        {#if role === 'admin'}
          <button class="btn" on:click={() => (inspectorOpen = true)}>◈ Polyglot Inspector</button>
        {/if}
      </div>
    </div>

    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap:10px;">
      <div>
        <label class="field" for="theme">Theme</label>
        <div class="seg" id="theme">
          {#each THEMES as t}
            <button class:on={theme === t.id} on:click={() => (theme = t.id)}>{t.label}</button>
          {/each}
        </div>
      </div>
      <div>
        <label class="field" for="role">Privilege tier</label>
        <div class="seg" id="role">
          {#each ROLES as r}
            <button class:on={role === r.id} on:click={() => (role = r.id)}>{r.label}</button>
          {/each}
        </div>
      </div>
      <div>
        <label class="field" for="vp">Viewport</label>
        <div class="seg" id="vp">
          <button class:on={viewport === 'desktop'} on:click={() => (viewport = 'desktop')}>Desktop Workstation</button>
          <button class:on={viewport === 'mobile'} on:click={() => (viewport = 'mobile')}>Mobile APK Frame</button>
        </div>
      </div>
    </div>
  </header>

  <div style="margin-top:14px;">
    <HardwarePermissionGatekeeper />
  </div>

  <!-- Sync drawer -->
  <div class="glass" style="padding:12px 18px; margin-top:14px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
    <span class="chip"><span class="dot {syncCount > 0 ? 'dot-sim' : 'dot-live'}"></span>Offline vault · {syncCount} mutation(s) queued</span>
    <span style="display:flex; gap:8px; flex-wrap:wrap;">
      <button class="btn" on:click={syncNow}>⇅ Sync now</button>
      <button class="btn" on:click={exportAll}>⎙ Export PE report (JSON)</button>
      {#if syncMsg}<span class="chip">{syncMsg}</span>{/if}
      {#if exported}<span class="chip">{exported}</span>{/if}
    </span>
  </div>

  <!-- Labs -->
  <div class:phone-frame={viewport === 'mobile'} style="margin-top:18px; display:flex; flex-direction:column; gap:18px;">
    <section id="lab-hvsr"><NakamuraHvsrLiquefactionLab {role} /></section>
    <section id="lab-crack"><CrackKinematicsBurlandScanner /></section>
    <section id="lab-seismo"><PWaveSeismographResponseDeck {role} /></section>
    <section id="lab-slope"><MohrCoulombSlopeWallShield {role} /></section>
    <section id="lab-pier"><ExpansiveSoilPierQuoteAuditor /></section>
  </div>

  <footer class="faint mono" style="margin-top:24px; font-size:11px; text-align:center;">
    GEO-SPECTRA v1.25.0 · Svelte + Pure ES2024 JS + Python 3.12 + Kotlin + GLSL · Offline-first · Field screening only — not a substitute for licensed PE evaluation.
  </footer>
</div>

<!-- Gooey metaball dock -->
<nav class="glass" style="position:fixed; left:50%; bottom:18px; transform:translateX(-50%); z-index:100; padding:8px 10px; border-radius:999px; display:flex; gap:4px;">
  <svg width="0" height="0" style="position:absolute;" aria-hidden="true">
    <filter id="geo-gooey-dock">
      <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
      <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" result="goo" />
      <feComposite in="SourceGraphic" in2="goo" operator="atop" />
    </filter>
  </svg>
  <div style="filter:url(#geo-gooey-dock); display:flex; gap:4px; align-items:center;">
    {#each LABS as lab, i}
      <button
        class="btn {activeLab === lab.id ? 'btn-primary' : 'btn-ghost'}"
        style="border-radius:999px; min-width:52px;"
        on:click={() => go(lab.id)}
        title={lab.label}
      >{lab.icon}<span style="display:block; font-size:9px; letter-spacing:0.04em;">{lab.label}</span></button>
    {/each}
  </div>
</nav>

<ApkReleaseDownloadModal open={apkOpen} onClose={() => (apkOpen = false)} />
<PolyglotRuntimeInspectorModal open={inspectorOpen} onClose={() => (inspectorOpen = false)} />

<style>
  .phone-frame {
    max-width: 420px;
    margin-left: auto;
    margin-right: auto;
    border: 3px solid var(--line-strong);
    border-radius: 36px;
    padding: 14px;
    background: rgba(0,0,0,0.25);
    box-shadow: var(--shadow);
  }
</style>
