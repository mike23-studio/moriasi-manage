/* ============================================================
   ADD-ON MODULE: meter-billing.js
   ------------------------------------------------------------
   Adds real meter records (matching the Properties → Units → Meters
   → Readings → Bills model) on top of the existing app, without
   editing app.js.

   What it does:
   - Adds DATA.meters (one water + one electric meter per unit,
     auto-created the first time this loads) and DATA.meterReadings
     (a permanent history of every reading, tied to a meter, not a
     tenant — so history survives tenant turnover in a unit).
   - Intercepts the existing "Calculate & generate water/electric
     bills" buttons (capture phase, before app.js's own handler),
     and generates the bills itself: it reads the SAME on-screen
     inputs app.js already renders, but stamps each bill with a
     meterId, logs a meterReadings row, and advances the reading on
     the meter (instead of on the tenant object).
   - Injects a read-only "Meter registry" panel into the existing
     "Meter readings" admin screen showing meter numbers per unit,
     with an inline editor for the physical meter number — without
     touching the nav/routing code in app.js.

   Bills keep working with the rest of the app unchanged (ledger,
   receipts, dashboard) because they keep the exact same fields
   app.js already expects, plus one extra: `meterId`.
   ============================================================ */

function waitForBridge(){
  return new Promise((resolve)=>{
    if(window.MoriasiBridge) return resolve(window.MoriasiBridge);
    window.addEventListener('moriasi:bridge-ready', ()=>resolve(window.MoriasiBridge), {once:true});
  });
}

(async function init(){
  const bridge = await waitForBridge();
  const DATA = bridge.getData();

  // ---------- one-time migration: create meters/meterReadings arrays ----------
  if(!DATA.meters) DATA.meters = [];
  if(!DATA.meterReadings) DATA.meterReadings = [];

  function ensureMeter(unitId, type){
    let m = DATA.meters.find(x=>x.unitId===unitId && x.type===type);
    if(!m){
      const prefix = type==='water' ? 'W' : 'E';
      m = {
        id: bridge.uid('mtr'),
        unitId,
        type,
        meterNumber: `${prefix}-${unitId.toUpperCase()}`,
        lastReading: 0
      };
      DATA.meters.push(m);
    }
    return m;
  }

  function seedMetersFromExistingTenants(){
    let changed = false;
    DATA.units.forEach(u=>{
      const wm = ensureMeter(u.id, 'water');
      const em = ensureMeter(u.id, 'electric');
      // Prime starting readings from the tenant's current lastReading
      // fields the first time, so bills don't jump on the next run.
      const t = DATA.tenants.find(x=>x.unitId===u.id);
      if(t){
        if(wm.lastReading===0 && t.lastWaterReading){ wm.lastReading = t.lastWaterReading; changed=true; }
        if(em.lastReading===0 && t.lastElectricReading){ em.lastReading = t.lastElectricReading; changed=true; }
      }
    });
    return changed;
  }
  const seeded = seedMetersFromExistingTenants();
  if(seeded || DATA.meters.length){ bridge.persist(); }

  function meterFor(unitId, type){ return DATA.meters.find(x=>x.unitId===unitId && x.type===type); }

  function generateFromMeters(type){
    const isWater = type==='water';
    const periodEl = document.getElementById(isWater?'water-period':'electric-period');
    const rateEl = document.getElementById(isWater?'water-rate':'electric-rate');
    const inputs = document.querySelectorAll(isWater?'.water-current':'.electric-current');
    if(!periodEl || !rateEl) return;

    const period = periodEl.value.trim();
    const rate = parseFloat(rateEl.value) || 0;
    if(isWater) DATA.settings.waterRate = rate; else DATA.settings.electricRate = rate;

    inputs.forEach(inp=>{
      const tenantId = inp.getAttribute('data-tenant');
      const current = parseFloat(inp.value) || 0;
      const t = bridge.tenantById(tenantId);
      if(!t) return;
      const meter = ensureMeter(t.unitId, type);
      const previous = meter.lastReading;
      const usage = Math.max(0, current - previous);
      const amount = Math.round(usage * rate);

      DATA.bills.push({
        id: bridge.uid('b'),
        tenantId,
        type,
        period,
        amount,
        usage,
        meterId: meter.id,
        dueDate: bridge.todayStr(),
        status: 'unpaid',
        createdAt: bridge.todayStr()
      });

      DATA.meterReadings.push({
        id: bridge.uid('rd'),
        meterId: meter.id,
        previous,
        current,
        period,
        date: bridge.todayStr()
      });

      meter.lastReading = current;
      // Keep the tenant's legacy fields in sync too, since other parts of
      // the existing UI (dashboard usage chart, meters screen) still read
      // t.lastWaterReading / t.lastElectricReading.
      if(isWater) t.lastWaterReading = current; else t.lastElectricReading = current;
    });

    bridge.persist();
    bridge.render();
  }

  document.addEventListener('click', (e)=>{
    const waterBtn = e.target.closest('[data-action="generate-water"]');
    if(waterBtn){ e.stopImmediatePropagation(); e.preventDefault(); generateFromMeters('water'); return; }
    const elecBtn = e.target.closest('[data-action="generate-electric"]');
    if(elecBtn){ e.stopImmediatePropagation(); e.preventDefault(); generateFromMeters('electric'); return; }
  }, true);

  // ---------- meter registry panel injected into the "Meter readings" screen ----------
  function unitLabel(unitId){ const u = bridge.unitById(unitId); return u ? u.label : unitId; }
  function tenantNameForUnit(unitId){
    const t = DATA.tenants.find(x=>x.unitId===unitId);
    return t ? t.name : '— vacant —';
  }

  function registryPanelHTML(){
    const rows = DATA.meters
      .slice()
      .sort((a,b)=> unitLabel(a.unitId).localeCompare(unitLabel(b.unitId)) || a.type.localeCompare(b.type))
      .map(m=>`
        <tr>
          <td>${unitLabel(m.unitId)}</td>
          <td>${tenantNameForUnit(m.unitId)}</td>
          <td style="text-transform:capitalize;">${m.type}</td>
          <td>
            <input class="moriasi-meter-num" data-meter="${m.id}" value="${m.meterNumber}"
              style="border:1px solid #ddd;border-radius:6px;padding:4px 6px;width:130px;font-family:monospace;"/>
          </td>
          <td style="font-family:monospace;">${m.lastReading}</td>
        </tr>
      `).join('');

    return `
      <div class="card" id="moriasi-meter-registry" style="margin-top:16px;">
        <div class="card-title" style="margin-bottom:10px;">Registered meters</div>
        <div class="small-note" style="margin-bottom:10px;">
          Each unit has its own water and electric meter. Bills are generated
          against these meters, so history stays with the unit even if the
          tenant changes.
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="text-align:left;font-size:12.5px;color:#5C6D6E;">
              <th>Unit</th><th>Current tenant</th><th>Type</th><th>Meter number</th><th>Last reading</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function bindRegistryEvents(container){
    container.querySelectorAll('.moriasi-meter-num').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const meter = DATA.meters.find(m=>m.id===inp.getAttribute('data-meter'));
        if(meter){ meter.meterNumber = inp.value.trim(); bridge.persist(); }
      });
    });
  }

  let injecting = false;
  const observer = new MutationObserver(()=>{
    if(injecting) return;
    if(bridge.state.view !== 'meters') return;
    const app = document.getElementById('app');
    if(!app || app.querySelector('#moriasi-meter-registry')) return;
    injecting = true;
    const container = document.createElement('div');
    container.innerHTML = registryPanelHTML();
    // The meters view's main content column is the last child of .main
    const main = app.querySelector('.main');
    (main || app).appendChild(container.firstElementChild);
    bindRegistryEvents(app);
    injecting = false;
  });
  observer.observe(document.getElementById('app'), {childList:true, subtree:true});
})();
