<script>
  import {
    potentialVerticalRise, radonIntrusion, auditPierQuote, PIER_TYPES
  } from '$lib/engines/expansiveSoilPierAuditorEngine.js';
  import { saveRecord } from '$lib/db/geoVaultDb.js';

  let LL = 55, PL = 22, activeDepth = 3.0, surcharge = 12, barrier = false;
  let crackMm = 1.0, tIn = 22, tOut = 4, soilRn = 50000;
  let pierTypeId = 'helical', quotedPer = 4200, quotedUnits = 28, wallLoad = 45;
  let saved = '';

  $: pvr = potentialVerticalRise({ LL, PL, activeDepthM: activeDepth, surchargeKPa: surcharge, barrier });
  $: rn = radonIntrusion({ crackWidthMm: crackMm, tInC: tIn, tOutC: tOut, soilRnBqM3: soilRn });
  $: audit = auditPierQuote({ pierTypeId, quotedPerUnit: quotedPer, quotedUnits, wallLoadKNm: wallLoad });

  async function save() {
    await saveRecord('foundation_quote_reviews', {
      PI: pvr.PI, pvrMm: pvr.pvrMm, radon: rn.Cindoor,
      pier: audit.type.name, quotedTotal: audit.total, fairTotal: audit.fairTotal
    });
    saved = 'Saved ✓';
    setTimeout(() => (saved = ''), 2500);
  }

  function useCrackFromModule2() {
    crackMm = 3.8;
  }
</script>

<div class="glass" style="padding: 22px;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
    <div>
      <div class="kicker">Module 05 · Expansive Soil &amp; Quote Auditor</div>
      <h2 style="font-family:var(--display); margin:6px 0 4px; font-size:24px;">PVR · Radon · Pier Quote Auditor</h2>
      <p class="dim" style="margin:0; font-size:13px; max-width:640px;">
        McDowell / TxDOT potential vertical rise, Darcy stack-effect Radon-222 intrusion,
        and helical / push pier fair-quote auditing against regional benchmarks.
      </p>
    </div>
    <span class="chip"><span class="dot dot-sim"></span>SIMULATOR</span>
  </div>

  <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:16px; margin-top:16px;">
    <!-- PVR -->
    <div class="glass-deep" style="padding:16px;">
      <div class="kicker">Expansive clay swell</div>
      <div class="stat-grid" style="margin-top:10px;">
        <div class="stat"><div class="k">PI</div><div class="v">{pvr.PI}</div><div class="u">LL−PL</div></div>
        <div class="stat"><div class="k">PVR</div><div class="v">{pvr.pvrMm.toFixed(0)}</div><div class="u">mm · {pvr.pvrIn.toFixed(1)} in</div></div>
        <div class="stat"><div class="k">Swell P</div><div class="v">{pvr.pSwellKPa.toFixed(0)}</div><div class="u">kPa</div></div>
      </div>
      <div class="verdict {pvr.PI > 35 ? 'danger' : pvr.PI >= 15 ? 'warn' : 'safe'}" style="margin-top:10px;">
        <strong>{pvr.band.label}.</strong> {pvr.band.action}.
      </div>
      <div style="display:grid; gap:10px; margin-top:12px;">
        <div><label class="field" for="ll">Liquid limit LL: {LL}%</label><input id="ll" type="range" min="25" max="90" bind:value={LL} /></div>
        <div><label class="field" for="pl">Plastic limit PL: {PL}%</label><input id="pl" type="range" min="10" max="50" bind:value={PL} /></div>
        <div><label class="field" for="ad">Active depth: {activeDepth.toFixed(1)} m</label><input id="ad" type="range" min="1.5" max="4.5" step="0.1" bind:value={activeDepth} /></div>
        <div><label class="field" for="sc">Surcharge: {surcharge} kPa</label><input id="sc" type="range" min="0" max="30" bind:value={surcharge} /></div>
        <label style="display:flex; gap:8px; align-items:center; font-family:var(--mono); font-size:12px;">
          <input type="checkbox" bind:checked={barrier} /> Perimeter moisture barrier (−38% PVR)
        </label>
      </div>
    </div>

    <!-- Radon -->
    <div class="glass-deep" style="padding:16px;">
      <div class="kicker">Radon-222 stack effect</div>
      <div class="stat-grid" style="margin-top:10px;">
        <div class="stat"><div class="k">Indoor Rn</div><div class="v">{rn.Cindoor.toFixed(0)}</div><div class="u">Bq/m³ · {rn.pCiL.toFixed(1)} pCi/L</div></div>
        <div class="stat"><div class="k">ΔP stack</div><div class="v">{rn.dPStack.toFixed(1)}</div><div class="u">Pa</div></div>
        <div class="stat"><div class="k">SSD fan</div><div class="v">{rn.fanCfm.toFixed(0)}</div><div class="u">CFM · {rn.fanPa.toFixed(0)} Pa</div></div>
      </div>
      <div class="verdict {rn.cls}" style="margin-top:10px;">
        <strong>{rn.verdict}.</strong> WHO 100 · EPA 148 Bq/m³ thresholds.
      </div>
      <div style="display:grid; gap:10px; margin-top:12px;">
        <div><label class="field" for="cm">Slab crack width: {crackMm.toFixed(2)} mm</label><input id="cm" type="range" min="0.1" max="10" step="0.1" bind:value={crackMm} /></div>
        <div><label class="field" for="ti">Indoor T: {tIn}°C</label><input id="ti" type="range" min="16" max="28" bind:value={tIn} /></div>
        <div><label class="field" for="to">Outdoor T: {tOut}°C</label><input id="to" type="range" min="-5" max="20" bind:value={tOut} /></div>
        <div><label class="field" for="sr">Soil Rn: {(soilRn / 1000).toFixed(0)} kBq/m³</label><input id="sr" type="range" min="10000" max="100000" step="5000" bind:value={soilRn} /></div>
        <button class="btn" on:click={useCrackFromModule2}>Import crack width from Module 02 (3.8 mm)</button>
      </div>
    </div>

    <!-- Pier auditor -->
    <div class="glass-deep" style="padding:16px;">
      <div class="kicker">Foundation pier quote auditor</div>
      <div class="stat-grid" style="margin-top:10px;">
        <div class="stat"><div class="k">Quoted</div><div class="v">${audit.total.toLocaleString()}</div><div class="u">{quotedUnits} × ${quotedPer.toLocaleString()}</div></div>
        <div class="stat"><div class="k">Fair total</div><div class="v">${audit.fairTotal.toLocaleString()}</div><div class="u">benchmark</div></div>
        <div class="stat"><div class="k">Savings</div><div class="v">${audit.savings.toLocaleString()}</div><div class="u">vs quote</div></div>
      </div>
      <div class="verdict {audit.cls}" style="margin-top:10px;">
        <strong>{audit.verdict}.</strong> Required ≈ {audit.requiredUnits} units at ≤ {audit.spacingM.toFixed(1)} m spacing
        (wall load {wallLoad} kN/m, pier cap {audit.type.capKN} kN). {audit.type.note}.
      </div>
      <div style="display:grid; gap:10px; margin-top:12px;">
        <div>
          <label class="field" for="pt">Pier system</label>
          <select id="pt" bind:value={pierTypeId}>
            {#each PIER_TYPES as p}
              <option value={p.id}>{p.name} — fair ${p.fairLow}–${p.fairHigh}/{p.unit}</option>
            {/each}
          </select>
        </div>
        <div><label class="field" for="qp">Quoted per unit: ${quotedPer.toLocaleString()}</label><input id="qp" type="range" min="300" max="8000" step="50" bind:value={quotedPer} /></div>
        <div><label class="field" for="qu">Quoted units: {quotedUnits}</label><input id="qu" type="range" min="2" max="40" bind:value={quotedUnits} /></div>
        <div><label class="field" for="wl">Wall line-load: {wallLoad} kN/m</label><input id="wl" type="range" min="15" max="90" bind:value={wallLoad} /></div>
        <button class="btn btn-primary" on:click={save}>Save quote review</button>
        {#if saved}<span class="chip">{saved}</span>{/if}
      </div>
    </div>
  </div>
</div>
