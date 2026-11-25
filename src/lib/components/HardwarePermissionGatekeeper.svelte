<script>
  import { onMount } from 'svelte';

  let imu = 'RESTRICTED';
  let camera = 'RESTRICTED';
  let baro = 'RESTRICTED';
  let storage = 'RESTRICTED';
  let open = false;
  let log = [];

  function push(msg) {
    log = [...log.slice(-5), `${new Date().toLocaleTimeString()} · ${msg}`];
  }

  async function requestAll() {
    // IMU
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const r = await DeviceMotionEvent.requestPermission();
        imu = r === 'granted' ? 'ACTIVE' : 'RESTRICTED';
      } else if (typeof DeviceMotionEvent !== 'undefined') {
        imu = 'ACTIVE';
      }
      push(`IMU → ${imu}`);
    } catch { imu = 'RESTRICTED'; }
    // Camera
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      s.getTracks().forEach((t) => t.stop());
      camera = 'ACTIVE';
    } catch { camera = 'SIMULATOR ACTIVE'; }
    push(`Camera → ${camera}`);
    // Barometer (Chrome Android)
    try {
      baro = 'PressureSensor' in window ? 'ACTIVE' : 'SIMULATOR ACTIVE';
    } catch { baro = 'SIMULATOR ACTIVE'; }
    push(`Barometer → ${baro}`);
    // Persistent storage
    try {
      if (navigator.storage?.persist) {
        const ok = await navigator.storage.persist();
        storage = ok ? 'ACTIVE' : 'SIMULATOR ACTIVE';
      } else storage = 'SIMULATOR ACTIVE';
    } catch { storage = 'SIMULATOR ACTIVE'; }
    push(`Storage → ${storage}`);
  }

  function badge(v) {
    return v === 'ACTIVE' ? 'dot-live' : v === 'SIMULATOR ACTIVE' ? 'dot-sim' : 'dot-rest';
  }

  onMount(() => {
    if (typeof DeviceMotionEvent !== 'undefined') imu = 'SIMULATOR ACTIVE';
    if (navigator.mediaDevices) camera = 'SIMULATOR ACTIVE';
    baro = 'SIMULATOR ACTIVE';
    storage = 'SIMULATOR ACTIVE';
  });
</script>

<div class="glass" style="padding: 14px 18px;">
  <button class="btn btn-ghost" style="width:100%; text-align:left; display:flex; justify-content:space-between; align-items:center;" on:click={() => (open = !open)}>
    <span><span class="kicker">Hardware Gatekeeper</span> <span class="mono" style="font-size:12px;">IMU · Camera · Barometer · Storage</span></span>
    <span>{open ? '▴ collapse' : '▾ expand'}</span>
  </button>
  <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
    <span class="chip"><span class="dot {badge(imu)}"></span>Geophone IMU 60–200 Hz · {imu}</span>
    <span class="chip"><span class="dot {badge(camera)}"></span>Macro Camera 1080p60 · {camera}</span>
    <span class="chip"><span class="dot {badge(baro)}"></span>Barometer / Mic · {baro}</span>
    <span class="chip"><span class="dot {badge(storage)}"></span>Persistent Storage · {storage}</span>
    <button class="btn btn-primary" on:click={requestAll}>Request permissions</button>
  </div>
  {#if open}
    <div style="margin-top:12px; display:grid; gap:6px;">
      <p class="dim" style="margin:0; font-size:12px;">
        IMU captures N–S / E–W / vertical microtremors, PGA waveforms and 0.01° wall tilt.
        Camera measures sub-millimetre crack aperture. Barometer tracks −ΔP driving Radon stack-effect.
        STA/LTA P-wave alerts fire haptics + strobe via <span class="mono">navigator.vibrate</span>.
      </p>
      {#each log as line}
        <div class="mono faint" style="font-size:11px;">{line}</div>
      {/each}
    </div>
  {/if}
</div>
