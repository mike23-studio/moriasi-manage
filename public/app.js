/* ============ ICONS ============ */
const ICONS = {
  grid:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  users:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2c2.6.4 4.5 2.4 4.5 5.3"/></svg>',
  receipt:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z"/><path d="M9 8h6M9 12h6"/></svg>',
  gauge:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path d="M12 13l3.5-3.5M12 4v2M4.5 8.5l1.4 1.4M19.5 8.5l-1.4 1.4"/></svg>',
  wrench:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-2 2.6-2.6z"/></svg>',
  chat:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 1 1-3.4-6.5L21 4l-1 4.2A7.9 7.9 0 0 1 21 12z"/></svg>',
  chart:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>',
  droplet:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 3s6 6.5 6 11a6 6 0 1 1-12 0c0-4.5 6-11 6-11z"/></svg>',
  bolt:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>',
  home:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8.5z"/></svg>',
  plus:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>',
  cam:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h3l2-2h6l2 2h3v11H4V8z"/><circle cx="12" cy="13.5" r="3.2"/></svg>',
  check:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12l5 5L19 7"/></svg>',
  x:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  download:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 19h16"/></svg>',
  tank:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h12l-1.4 5.2a6 6 0 0 1 0 6.6L18 21H6l1.4-6.2a6 6 0 0 1 0-6.6L6 3z"/></svg>'
};
function icon(n){return ICONS[n]||'';}

/* ============ FIREBASE / GOOGLE CLOUD STORAGE ============ */
// db   -> Cloud Firestore  (Google Cloud's document database) — free plan
// auth -> Firebase Authentication (anonymous, just to satisfy security rules) — free plan
import { db, auth } from './firebase-init.js';
import {
  doc, getDoc, setDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// All app data lives in a single Firestore document. This mirrors how the
// prototype kept everything in one JSON blob, so almost none of the app
// logic below needed to change — only how that blob gets saved/loaded.
const DATA_DOC = doc(db, 'appData', 'main');

let DATA = null;
let saveTimer = null;
let suppressNextSnapshot = false; // avoids re-rendering from our own writes

function persist(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    try{
      suppressNextSnapshot = true;
      await setDoc(DATA_DOC, DATA);
    }catch(e){ console.error('save failed',e); suppressNextSnapshot=false; }
  },250);
}

// Waits for an authenticated (anonymous) session before we touch Firestore/Storage.
function ensureAuth(){
  return new Promise((resolve,reject)=>{
    onAuthStateChanged(auth, (user)=>{
      if(user) resolve(user);
      else signInAnonymously(auth).catch(reject);
    });
  });
}

// Live-sync: whenever the Firestore document changes (from this browser tab,
// another admin, or another tenant), re-render with the latest data.
function subscribeToData(){
  onSnapshot(DATA_DOC, (snap)=>{
    if(suppressNextSnapshot){ suppressNextSnapshot=false; return; }
    if(snap.exists()){ DATA = snap.data(); render(); }
  }, (err)=>console.error('sync error', err));
}
function uid(prefix){ return prefix+'_'+Math.random().toString(36).slice(2,9); }
function money(n){ return 'KES '+Math.round(n).toLocaleString(); }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function fmtDate(d){ return new Date(d).toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'}); }

function seedData(){
  const units = [
    {id:'u1',label:'A1',rentAmount:9000,status:'occupied',tenantId:'t1'},
    {id:'u2',label:'A2',rentAmount:9000,status:'occupied',tenantId:'t2'},
    {id:'u3',label:'B1',rentAmount:7500,status:'occupied',tenantId:'t3'},
    {id:'u4',label:'B2',rentAmount:7500,status:'vacant',tenantId:null},
  ];
  const tenants = [
    {id:'t1',name:'Grace Wanjiru',unitId:'u1',phone:'+254 712 345 001',email:'grace.w@example.com',joined:'2025-02-01',lastWaterReading:1240,lastElectricReading:820},
    {id:'t2',name:'Peter Otieno',unitId:'u2',phone:'+254 712 345 002',email:'peter.o@example.com',joined:'2025-05-15',lastWaterReading:980,lastElectricReading:640},
    {id:'t3',name:'Susan Chebet',unitId:'u3',phone:'+254 712 345 003',email:'susan.c@example.com',joined:'2024-11-20',lastWaterReading:1105,lastElectricReading:705},
  ];
  const bills = [
    {id:'b1',tenantId:'t1',type:'rent',period:'Jun 2026',amount:9000,dueDate:'2026-06-05',status:'paid',createdAt:'2026-06-01'},
    {id:'b2',tenantId:'t2',type:'rent',period:'Jun 2026',amount:9000,dueDate:'2026-06-05',status:'paid',createdAt:'2026-06-01'},
    {id:'b3',tenantId:'t3',type:'rent',period:'Jun 2026',amount:7500,dueDate:'2026-06-05',status:'unpaid',createdAt:'2026-06-01'},
    {id:'b4',tenantId:'t1',type:'water',period:'Jun 2026',amount:640,usage:16,dueDate:'2026-06-10',status:'paid',createdAt:'2026-06-05'},
    {id:'b5',tenantId:'t1',type:'rent',period:'Jul 2026',amount:9000,dueDate:'2026-07-05',status:'unpaid',createdAt:'2026-07-01'},
  ];
  const payments = [
    {id:'p1',billId:'b1',tenantId:'t1',amount:9000,method:'M-Pesa',date:'2026-06-03',receiptId:'r1'},
    {id:'p2',billId:'b2',tenantId:'t2',amount:9000,method:'M-Pesa',date:'2026-06-04',receiptId:'r2'},
    {id:'p3',billId:'b4',tenantId:'t1',amount:640,method:'M-Pesa',date:'2026-06-06',receiptId:'r3'},
  ];
  const maintenance = [
    {id:'m1',tenantId:'t3',title:'Leaking kitchen tap',description:'The kitchen tap has been dripping constantly for two days.',photo:null,status:'Under Review',createdAt:'2026-07-08'},
    {id:'m2',tenantId:'t2',title:'Bedroom light not working',description:'Bulb replaced twice, still not turning on — might be wiring.',photo:null,status:'Submitted',createdAt:'2026-07-11'},
  ];
  const forum = [
    {id:'f1',title:'Water schedule this week',author:'admin',authorName:'Admin',createdAt:'2026-07-09',replies:[
      {id:'fr1',author:'t1',authorName:'Grace Wanjiru',content:'Thanks for the update, much appreciated!',createdAt:'2026-07-09'}
    ]},
    {id:'f2',title:'Anyone else notice low water pressure on the top floor?',author:'t2',authorName:'Peter Otieno',createdAt:'2026-07-10',replies:[]}
  ];
  const taxRecords = [
    {id:'x1',amount:12000,date:'2026-04-15',note:'Q1 apartment complex land rates'}
  ];
  return {
    units, tenants, bills, payments, maintenance, forum, taxRecords,
    settings:{waterRate:40, electricRate:22, businessName:'Moriasi Water Solutions & Freehold Apartments'}
  };
}

async function loadData(){
  const snap = await getDoc(DATA_DOC);
  if(snap.exists()){
    DATA = snap.data();
  } else {
    DATA = seedData();
    await setDoc(DATA_DOC, DATA); // first run: seed the Firestore document
  }
  subscribeToData();
}

/* ============ APP STATE ============ */
const state = {
  role:'admin',        // 'admin' | 'tenant'
  tenantId:null,
  view:'dashboard',
  modal:null,           // {type, payload}
};

function currentTenant(){ return DATA.tenants.find(t=>t.id===state.tenantId); }
function tenantById(id){ return DATA.tenants.find(t=>t.id===id); }
function unitById(id){ return DATA.units.find(u=>u.id===id); }
function initials(name){ return name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase(); }

/* ============ GAUGE (signature element) ============ */
function gaugeSVG(pct,color,size){
  size = size||64;
  pct = Math.max(0,Math.min(100,pct));
  const r = size/2 - 6;
  const c = size/2;
  const circ = 2*Math.PI*r;
  const offset = circ*(1-pct/100);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--line)" stroke-width="6"/>
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"
      stroke-dasharray="${circ}" stroke-dashoffset="${offset}" transform="rotate(-90 ${c} ${c})"/>
    <line x1="${c}" y1="6" x2="${c}" y2="10" stroke="var(--text-mute)" stroke-width="2"/>
    <line x1="${size-6}" y1="${c}" x2="${size-10}" y2="${c}" stroke="var(--text-mute)" stroke-width="2"/>
    <line x1="${c}" y1="${size-6}" x2="${c}" y2="${size-10}" stroke="var(--text-mute)" stroke-width="2"/>
    <line x1="6" y1="${c}" x2="10" y2="${c}" stroke="var(--text-mute)" stroke-width="2"/>
  </svg>`;
}

/* ============ RENDER: SHELL ============ */
function render(){
  const app = document.getElementById('app');
  app.innerHTML = `
    ${sidebarHTML()}
    <div class="main">
      ${state.role==='admin' ? renderAdminView() : renderTenantView()}
    </div>
    ${state.modal ? modalHTML() : ''}
  `;
  bindEvents();
}

function sidebarHTML(){
  const adminNav = [
    ['dashboard','grid','Dashboard'],
    ['tenants','users','Tenants & units'],
    ['billing','receipt','Billing'],
    ['meters','gauge','Meter readings'],
    ['maintenance','wrench','Maintenance'],
    ['forum','chat','Forum'],
    ['ledger','chart','Ledger & reports'],
  ];
  const tenantNav = [
    ['dashboard','grid','My dashboard'],
    ['bills','receipt','Bills & payments'],
    ['maintenance','wrench','Maintenance'],
    ['forum','chat','Forum'],
  ];
  const nav = state.role==='admin'?adminNav:tenantNav;
  const navHTML = nav.map(([v,ic,label])=>`
    <div class="nav-item ${state.view===v?'active':''}" data-nav="${v}">${icon(ic)}<span>${label}</span></div>
  `).join('');

  const tenantOptions = DATA.tenants.map(t=>`<option value="${t.id}" ${t.id===state.tenantId?'selected':''}>${t.name} — ${unitById(t.unitId)?unitById(t.unitId).label:''}</option>`).join('');

  return `
  <div class="sidebar">
    <div class="brand">
      <div class="brand-mark">${icon('droplet')}</div>
      <div>
        <div class="brand-name">Moriasi Manage</div>
        <div class="brand-sub">Water &amp; Property</div>
      </div>
    </div>
    ${navHTML}
    <div class="role-box">
      <div class="role-switch">
        <button data-role="admin" class="${state.role==='admin'?'active':''}">Admin</button>
        <button data-role="tenant" class="${state.role==='tenant'?'active':''}">Tenant</button>
      </div>
      ${state.role==='tenant' ? `<select class="tenant-select" id="tenant-picker">${tenantOptions}</select>` : `<div class="small-note" style="color:#9FB6B4;">Freehold Estate, Nakuru</div>`}
    </div>
  </div>`;
}

/* ============ ADMIN VIEWS ============ */
function renderAdminView(){
  switch(state.view){
    case 'dashboard': return adminDashboard();
    case 'tenants': return adminTenants();
    case 'billing': return adminBilling();
    case 'meters': return adminMeters();
    case 'maintenance': return adminMaintenance();
    case 'forum': return forumView('admin');
    case 'ledger': return adminLedger();
    default: return adminDashboard();
  }
}

function adminDashboard(){
  const totalCollected = DATA.payments.reduce((s,p)=>s+p.amount,0);
  const outstanding = DATA.bills.filter(b=>b.status==='unpaid').reduce((s,b)=>s+b.amount,0);
  const pendingMaint = DATA.maintenance.filter(m=>m.status!=='Resolved').length;
  const occupied = DATA.units.filter(u=>u.status==='occupied').length;
  const occRate = Math.round((occupied/DATA.units.length)*100);
  const collectRate = (totalCollected+outstanding)>0 ? Math.round(totalCollected/(totalCollected+outstanding)*100) : 100;

  const recentPayments = [...DATA.payments].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);

  return `
  <div class="topbar">
    <div><h1>Dashboard</h1><div class="title-sub">${DATA.settings.businessName}</div></div>
    <span class="chip chip-status">${icon('home')} ${occupied}/${DATA.units.length} units occupied</span>
  </div>

  <div class="grid grid-4 section">
    <div class="card kpi-card">
      <div class="kpi-icon" style="background:var(--teal-light);color:var(--teal-dark)">${icon('receipt')}</div>
      <div class="kpi-value">${money(totalCollected)}</div>
      <div class="kpi-label">Total collected</div>
    </div>
    <div class="card kpi-card">
      <div class="kpi-icon" style="background:var(--danger-light);color:#8A332D">${icon('bolt')}</div>
      <div class="kpi-value">${money(outstanding)}</div>
      <div class="kpi-label">Outstanding balance</div>
    </div>
    <div class="card kpi-card">
      <div class="kpi-icon" style="background:var(--ochre-light);color:#8C5620">${icon('wrench')}</div>
      <div class="kpi-value">${pendingMaint}</div>
      <div class="kpi-label">Pending maintenance</div>
    </div>
    <div class="card kpi-card">
      <div class="kpi-icon" style="background:var(--teal-light);color:var(--teal-dark)">${icon('chat')}</div>
      <div class="kpi-value">${DATA.forum.length}</div>
      <div class="kpi-label">Forum topics</div>
    </div>
  </div>

  <div class="grid grid-2 section">
    <div class="card">
      <div class="card-title">Collection rate</div>
      <div class="gauge-wrap">
        ${gaugeSVG(collectRate,'var(--teal)',72)}
        <div class="gauge-labels"><div class="gauge-num">${collectRate}%</div><div class="gauge-cap">of billed amount collected</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Occupancy</div>
      <div class="gauge-wrap">
        ${gaugeSVG(occRate,'var(--ochre)',72)}
        <div class="gauge-labels"><div class="gauge-num">${occRate}%</div><div class="gauge-cap">${occupied} of ${DATA.units.length} units filled</div></div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-head"><h3>Recent payments</h3><span class="small-note" data-nav="ledger" style="cursor:pointer;text-decoration:underline;">View ledger</span></div>
    <div class="card table-wrap">
      ${recentPayments.length===0? emptyState('receipt','No payments yet') : `
      <table><thead><tr><th>Tenant</th><th>Amount</th><th>Method</th><th>Date</th></tr></thead>
      <tbody>${recentPayments.map(p=>`<tr><td>${tenantById(p.tenantId)?.name||'—'}</td><td class="mono">${money(p.amount)}</td><td>${p.method}</td><td>${fmtDate(p.date)}</td></tr>`).join('')}</tbody></table>`}
    </div>
  </div>
  `;
}

function emptyState(ic,text){
  return `<div class="empty">${icon(ic)}<div style="margin-top:8px;">${text}</div></div>`;
}

function adminTenants(){
  const rows = DATA.tenants.map(t=>{
    const u = unitById(t.unitId);
    const balance = DATA.bills.filter(b=>b.tenantId===t.id && b.status==='unpaid').reduce((s,b)=>s+b.amount,0);
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:8px;"><div class="avatar">${initials(t.name)}</div><div><div style="font-weight:500;">${t.name}</div><div class="small-note">${t.email}</div></div></div></td>
      <td>${u?u.label:'—'}</td>
      <td>${t.phone}</td>
      <td>${fmtDate(t.joined)}</td>
      <td class="mono" style="color:${balance>0?'var(--danger)':'var(--success)'}">${money(balance)}</td>
      <td><button class="btn btn-sm" data-action="delete-tenant" data-id="${t.id}">${icon('x')}</button></td>
    </tr>`;
  }).join('');

  const unitRows = DATA.units.map(u=>`<tr>
    <td>${u.label}</td>
    <td class="mono">${money(u.rentAmount)}</td>
    <td><span class="badge badge-${u.status}">${u.status}</span></td>
    <td>${u.tenantId?tenantById(u.tenantId)?.name:'—'}</td>
  </tr>`).join('');

  return `
  <div class="topbar">
    <div><h1>Tenants &amp; units</h1><div class="title-sub">Manage your apartment roll and unit assignments</div></div>
    <div style="display:flex;gap:8px;">
      <button class="btn" data-action="open-add-unit">${icon('plus')} Add unit</button>
      <button class="btn btn-primary" data-action="open-add-tenant">${icon('plus')} Add tenant</button>
    </div>
  </div>

  <div class="section">
    <div class="section-head"><h3>Tenant directory</h3></div>
    <div class="card table-wrap">
      ${rows===''?emptyState('users','No tenants yet'):`<table><thead><tr><th>Tenant</th><th>Unit</th><th>Phone</th><th>Joined</th><th>Balance</th><th></th></tr></thead><tbody>${rows}</tbody></table>`}
    </div>
  </div>

  <div class="section">
    <div class="section-head"><h3>Units</h3></div>
    <div class="card table-wrap">
      ${unitRows===''?emptyState('home','No units yet'):`<table><thead><tr><th>Unit</th><th>Rent</th><th>Status</th><th>Tenant</th></tr></thead><tbody>${unitRows}</tbody></table>`}
    </div>
  </div>
  `;
}

function adminBilling(){
  const vacantOrOccupied = DATA.units.filter(u=>u.status==='occupied');
  return `
  <div class="topbar">
    <div><h1>Billing</h1><div class="title-sub">Generate rent, water and electricity bills</div></div>
  </div>

  <div class="grid grid-3 section">
    <div class="card">
      <div class="card-title" style="margin-bottom:10px;">Rent</div>
      <div class="field"><label>Period (e.g. Aug 2026)</label><input id="rent-period" value="${nextMonthLabel()}"/></div>
      <div class="field"><label>Due date</label><input id="rent-due" type="date" value="${todayStr()}"/></div>
      <div class="small-note" style="margin-bottom:10px;">Generates a rent bill for each occupied unit using its set rent amount (${vacantOrOccupied.length} units).</div>
      <button class="btn btn-primary" data-action="generate-rent">Generate rent bills</button>
    </div>

    <div class="card">
      <div class="card-title" style="margin-bottom:10px;">Water</div>
      <div class="field"><label>Period</label><input id="water-period" value="${nextMonthLabel()}"/></div>
      <div class="field"><label>Rate per unit (KES / m³)</label><input id="water-rate" type="number" value="${DATA.settings.waterRate}"/></div>
      <div class="small-note" style="margin-bottom:10px;">Enter each tenant's current borehole submeter reading below, then generate.</div>
      <div id="water-readings">${vacantOrOccupied.map(u=>{
        const t=tenantById(u.tenantId);
        return `<div class="field-row" style="align-items:flex-end;">
          <div class="field" style="flex:1.4;"><label>${t.name} (${u.label})</label><div class="small-note">Last: ${t.lastWaterReading} m³</div></div>
          <div class="field" style="flex:1;"><input type="number" class="water-current" data-tenant="${t.id}" placeholder="Current m³" value="${t.lastWaterReading+15}"/></div>
        </div>`;
      }).join('')}</div>
      <button class="btn btn-primary" data-action="generate-water">Calculate &amp; generate water bills</button>
    </div>

    <div class="card">
      <div class="card-title" style="margin-bottom:10px;">Electricity</div>
      <div class="field"><label>Period</label><input id="electric-period" value="${nextMonthLabel()}"/></div>
      <div class="field"><label>Rate per unit (KES / kWh)</label><input id="electric-rate" type="number" value="${DATA.settings.electricRate}"/></div>
      <div class="small-note" style="margin-bottom:10px;">Enter each tenant's current electric meter reading below.</div>
      <div id="electric-readings">${vacantOrOccupied.map(u=>{
        const t=tenantById(u.tenantId);
        return `<div class="field-row" style="align-items:flex-end;">
          <div class="field" style="flex:1.4;"><label>${t.name} (${u.label})</label><div class="small-note">Last: ${t.lastElectricReading} kWh</div></div>
          <div class="field" style="flex:1;"><input type="number" class="electric-current" data-tenant="${t.id}" placeholder="Current kWh" value="${t.lastElectricReading+20}"/></div>
        </div>`;
      }).join('')}</div>
      <button class="btn btn-primary" data-action="generate-electric">Calculate &amp; generate electric bills</button>
    </div>
  </div>

  <div class="section">
    <div class="section-head"><h3>All bills</h3></div>
    <div class="card table-wrap">
      ${billsTableHTML()}
    </div>
  </div>

  <div class="section">
    <div class="section-head"><h3>Tax on apartment complex</h3></div>
    <div class="card">
      <div class="field-row">
        <div class="field"><label>Amount (KES)</label><input id="tax-amount" type="number" placeholder="12000"/></div>
        <div class="field"><label>Date</label><input id="tax-date" type="date" value="${todayStr()}"/></div>
        <div class="field" style="flex:2;"><label>Note</label><input id="tax-note" placeholder="e.g. Q3 land rates"/></div>
      </div>
      <button class="btn" data-action="log-tax">${icon('plus')} Log tax payment</button>
      <div class="table-wrap" style="margin-top:14px;">
        ${DATA.taxRecords.length===0?emptyState('receipt','No tax records logged'):`
        <table><thead><tr><th>Date</th><th>Amount</th><th>Note</th></tr></thead>
        <tbody>${DATA.taxRecords.map(x=>`<tr><td>${fmtDate(x.date)}</td><td class="mono">${money(x.amount)}</td><td>${x.note}</td></tr>`).join('')}</tbody></table>`}
      </div>
    </div>
  </div>
  `;
}

function billsTableHTML(){
  const bills = [...DATA.bills].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  if(bills.length===0) return emptyState('receipt','No bills generated yet — use the forms above to generate rent, water or electricity bills.');
  const rows = bills.map(b=>{
    const t = tenantById(b.tenantId);
    const u = t ? unitById(t.unitId) : null;
    return `<tr>
      <td>${t?t.name:'—'}${u?` (${u.label})`:''}</td>
      <td style="text-transform:capitalize;">${b.type}${b.usage?` (${b.usage} units)`:''}</td>
      <td>${b.period}</td>
      <td>${fmtDate(b.dueDate)}</td>
      <td class="mono">${money(b.amount)}</td>
      <td><span class="badge badge-${b.status}">${b.status}</span></td>
      <td><button class="btn btn-sm" data-action="delete-bill" data-id="${b.id}" title="Remove this bill">${icon('x')}</button></td>
    </tr>`;
  }).join('');
  return `<table><thead><tr><th>Tenant</th><th>Type</th><th>Period</th><th>Due</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function nextMonthLabel(){
  const d = new Date(); d.setMonth(d.getMonth()+1);
  return d.toLocaleDateString('en-US',{month:'short',year:'numeric'});
}

function adminMeters(){
  return `
  <div class="topbar"><div><h1>Meter readings</h1><div class="title-sub">History of submeter readings used for billing</div></div></div>
  <div class="grid grid-2 section">
    <div class="card">
      <div class="card-title" style="margin-bottom:10px;">Water — latest readings</div>
      <table><thead><tr><th>Tenant</th><th>Reading (m³)</th></tr></thead>
      <tbody>${DATA.tenants.map(t=>`<tr><td>${t.name}</td><td class="mono">${t.lastWaterReading}</td></tr>`).join('')}</tbody></table>
    </div>
    <div class="card">
      <div class="card-title" style="margin-bottom:10px;">Electricity — latest readings</div>
      <table><thead><tr><th>Tenant</th><th>Reading (kWh)</th></tr></thead>
      <tbody>${DATA.tenants.map(t=>`<tr><td>${t.name}</td><td class="mono">${t.lastElectricReading}</td></tr>`).join('')}</tbody></table>
    </div>
  </div>
  <div class="small-note">Readings update automatically each time you generate a water or electricity bill from the Billing tab.</div>
  `;
}

function adminMaintenance(){
  const items = [...DATA.maintenance].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  return `
  <div class="topbar"><div><h1>Maintenance requests</h1><div class="title-sub">Review issues submitted by tenants</div></div></div>
  ${items.length===0?emptyState('wrench','No maintenance requests'):items.map(m=>{
    const t = tenantById(m.tenantId);
    return `<div class="maint-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-weight:600;">${m.title}</div>
          <div class="small-note">${t?t.name+' · '+(unitById(t.unitId)?.label||''):'—'} · ${fmtDate(m.createdAt)}</div>
        </div>
        <span class="badge badge-${m.status.toLowerCase().replace(' ','')==='underreview'?'review':m.status.toLowerCase()}">${m.status}</span>
      </div>
      <div style="font-size:13.5px;margin-top:8px;color:var(--text-soft);">${m.description}</div>
      ${m.photo?`<img class="maint-photo" src="${m.photo}"/>`:''}
      <div style="margin-top:10px;display:flex;gap:8px;align-items:center;">
        <select class="maint-status" data-id="${m.id}">
          <option ${m.status==='Submitted'?'selected':''}>Submitted</option>
          <option ${m.status==='Under Review'?'selected':''}>Under Review</option>
          <option ${m.status==='Resolved'?'selected':''}>Resolved</option>
        </select>
        <button class="btn btn-sm btn-primary" data-action="update-maint" data-id="${m.id}">Update status</button>
      </div>
    </div>`;
  }).join('')}
  `;
}

function adminLedger(){
  const rows = [...DATA.payments].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(p=>{
    const bill = DATA.bills.find(b=>b.id===p.billId);
    const t = tenantById(p.tenantId);
    return `<tr><td>${fmtDate(p.date)}</td><td>${t?.name||'—'}</td><td>${bill?bill.type:'—'}</td><td>${bill?bill.period:'—'}</td><td class="mono">${money(p.amount)}</td><td>${p.method}</td><td>${p.receiptId}</td></tr>`;
  }).join('');
  return `
  <div class="topbar">
    <div><h1>Ledger &amp; reports</h1><div class="title-sub">Master financial record — every payment received</div></div>
    <button class="btn btn-ochre" data-action="export-csv">${icon('download')} Export CSV</button>
  </div>
  <div class="card table-wrap">
    ${rows===''?emptyState('chart','No payments recorded yet'):`<table><thead><tr><th>Date</th><th>Tenant</th><th>Type</th><th>Period</th><th>Amount</th><th>Method</th><th>Receipt</th></tr></thead><tbody>${rows}</tbody></table>`}
  </div>
  `;
}

/* ============ TENANT VIEWS ============ */
function renderTenantView(){
  if(!state.tenantId){ state.tenantId = DATA.tenants[0]?.id; }
  const t = currentTenant();
  if(!t) return `<div class="topbar"><h1>No tenants yet</h1></div>`;
  switch(state.view){
    case 'dashboard': return tenantDashboard(t);
    case 'bills': return tenantBills(t);
    case 'maintenance': return tenantMaintenance(t);
    case 'forum': return forumView('tenant',t);
    default: return tenantDashboard(t);
  }
}

function tenantDashboard(t){
  const unit = unitById(t.unitId);
  const myBills = DATA.bills.filter(b=>b.tenantId===t.id);
  const balance = myBills.filter(b=>b.status==='unpaid').reduce((s,b)=>s+b.amount,0);
  const paidThisYear = DATA.payments.filter(p=>p.tenantId===t.id).reduce((s,p)=>s+p.amount,0);
  const myMaint = DATA.maintenance.filter(m=>m.tenantId===t.id);
  const openMaint = myMaint.filter(m=>m.status!=='Resolved').length;
  const avgUsage = 18;
  const usagePct = Math.min(100,Math.round((16/avgUsage)*100));

  return `
  <div class="topbar">
    <div><h1>Welcome, ${t.name.split(' ')[0]}</h1><div class="title-sub">Unit ${unit?unit.label:'—'} · ${DATA.settings.businessName}</div></div>
    <span class="chip chip-status">${icon('home')} Unit ${unit?unit.label:'—'}</span>
  </div>

  <div class="grid grid-3 section">
    <div class="card kpi-card">
      <div class="kpi-icon" style="background:${balance>0?'var(--danger-light)':'var(--success-light)'};color:${balance>0?'#8A332D':'#2E5C39'}">${icon('receipt')}</div>
      <div class="kpi-value">${money(balance)}</div>
      <div class="kpi-label">Outstanding balance</div>
    </div>
    <div class="card kpi-card">
      <div class="kpi-icon" style="background:var(--teal-light);color:var(--teal-dark)">${icon('check')}</div>
      <div class="kpi-value">${money(paidThisYear)}</div>
      <div class="kpi-label">Total paid to date</div>
    </div>
    <div class="card kpi-card">
      <div class="kpi-icon" style="background:var(--ochre-light);color:#8C5620">${icon('wrench')}</div>
      <div class="kpi-value">${openMaint}</div>
      <div class="kpi-label">Open maintenance requests</div>
    </div>
  </div>

  <div class="card section">
    <div class="card-title" style="margin-bottom:10px;">Water usage vs building average</div>
    <div class="gauge-wrap">
      ${gaugeSVG(usagePct,'var(--teal)',72)}
      <div class="gauge-labels"><div class="gauge-num">${usagePct}%</div><div class="gauge-cap">of the average unit's monthly usage</div></div>
    </div>
  </div>

  ${balance>0?`<div class="card" style="border-color:var(--danger);background:var(--danger-light);">
    <div style="font-weight:500;color:#8A332D;">You have ${money(balance)} in unpaid bills.</div>
    <button class="btn btn-primary" style="margin-top:8px;" data-nav="bills">View and pay bills</button>
  </div>`:''}
  `;
}

function tenantBills(t){
  const myBills = [...DATA.bills.filter(b=>b.tenantId===t.id)].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const myPayments = [...DATA.payments.filter(p=>p.tenantId===t.id)].sort((a,b)=>new Date(b.date)-new Date(a.date));
  return `
  <div class="topbar"><div><h1>Bills &amp; payments</h1><div class="title-sub">Rent, water and electricity charges for your unit</div></div></div>

  <div class="section">
    <div class="section-head"><h3>Your bills</h3></div>
    <div class="card table-wrap">
      ${myBills.length===0?emptyState('receipt','No bills yet'):`
      <table><thead><tr><th>Type</th><th>Period</th><th>Due</th><th>Amount</th><th>Status</th><th></th></tr></thead>
      <tbody>${myBills.map(b=>`<tr>
        <td style="text-transform:capitalize;">${b.type}${b.usage?` (${b.usage} units)`:''}</td>
        <td>${b.period}</td><td>${fmtDate(b.dueDate)}</td>
        <td class="mono">${money(b.amount)}</td>
        <td><span class="badge badge-${b.status}">${b.status}</span></td>
        <td>${b.status==='unpaid'?`<button class="btn btn-sm btn-primary" data-action="open-pay" data-id="${b.id}">Pay now</button>`:'—'}</td>
      </tr>`).join('')}</tbody></table>`}
    </div>
  </div>

  <div class="section">
    <div class="section-head"><h3>Payment history &amp; receipts</h3></div>
    <div class="card table-wrap">
      ${myPayments.length===0?emptyState('check','No payments yet'):`
      <table><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Receipt</th><th></th></tr></thead>
      <tbody>${myPayments.map(p=>`<tr><td>${fmtDate(p.date)}</td><td class="mono">${money(p.amount)}</td><td>${p.method}</td><td>${p.receiptId}</td>
        <td><button class="btn btn-sm" data-action="view-receipt" data-id="${p.id}">View</button></td></tr>`).join('')}</tbody></table>`}
    </div>
  </div>
  `;
}

function tenantMaintenance(t){
  const mine = [...DATA.maintenance.filter(m=>m.tenantId===t.id)].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  return `
  <div class="topbar">
    <div><h1>Maintenance</h1><div class="title-sub">Report a problem in your unit</div></div>
    <button class="btn btn-primary" data-action="open-new-maint">${icon('plus')} New request</button>
  </div>
  ${mine.length===0?emptyState('wrench','No requests submitted yet'):mine.map(m=>`
    <div class="maint-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="font-weight:600;">${m.title}</div>
        <span class="badge badge-${m.status.toLowerCase().replace(' ','')==='underreview'?'review':m.status.toLowerCase()}">${m.status}</span>
      </div>
      <div class="small-note">${fmtDate(m.createdAt)}</div>
      <div style="font-size:13.5px;margin-top:8px;color:var(--text-soft);">${m.description}</div>
      ${m.photo?`<img class="maint-photo" src="${m.photo}"/>`:''}
    </div>
  `).join('')}
  `;
}

/* ============ FORUM (shared) ============ */
function forumView(mode,tenant){
  const topics = [...DATA.forum].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  return `
  <div class="topbar">
    <div><h1>Discussion forum</h1><div class="title-sub">Community board for the apartment complex</div></div>
    <button class="btn btn-primary" data-action="open-new-topic">${icon('plus')} New topic</button>
  </div>
  ${topics.length===0?emptyState('chat','No topics yet — start the conversation'):topics.map(f=>`
    <div class="forum-topic">
      <div style="display:flex;gap:10px;">
        <div class="avatar">${initials(f.authorName)}</div>
        <div style="flex:1;">
          <div style="font-weight:600;">${f.title}</div>
          <div class="small-note">${f.authorName} · ${fmtDate(f.createdAt)}</div>
          ${f.replies.map(r=>`<div class="forum-reply"><b style="font-size:12.5px;">${r.authorName}</b><br>${r.content}<div class="small-note">${fmtDate(r.createdAt)}</div></div>`).join('')}
          <div style="margin-top:10px;display:flex;gap:8px;">
            <input class="reply-input" data-topic="${f.id}" placeholder="Write a reply..." style="flex:1;border:1px solid var(--line);border-radius:8px;padding:7px 10px;font-size:13px;"/>
            <button class="btn btn-sm" data-action="reply-topic" data-topic="${f.id}">Reply</button>
          </div>
        </div>
      </div>
    </div>
  `).join('')}
  `;
}

/* ============ MODALS ============ */
function modalHTML(){
  const m = state.modal;
  let body='';
  if(m.type==='add-tenant'){
    const vacantUnits = DATA.units.filter(u=>u.status==='vacant');
    body = `
      <h3>Add tenant</h3>
      <div class="field"><label>Full name</label><input id="mf-name" placeholder="e.g. John Kamau"/></div>
      <div class="field"><label>Phone</label><input id="mf-phone" placeholder="+254 7..."/></div>
      <div class="field"><label>Email</label><input id="mf-email" placeholder="name@example.com"/></div>
      <div class="field"><label>Assign unit</label>
        <select id="mf-unit">${vacantUnits.length? vacantUnits.map(u=>`<option value="${u.id}">${u.label} — ${money(u.rentAmount)}/mo</option>`).join(''):'<option value="">No vacant units — add one first</option>'}</select>
      </div>
      <div class="modal-actions"><button class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="save-tenant">Add tenant</button></div>
    `;
  } else if(m.type==='add-unit'){
    body = `
      <h3>Add unit</h3>
      <div class="field"><label>Unit label</label><input id="mf-unit-label" placeholder="e.g. C1"/></div>
      <div class="field"><label>Monthly rent (KES)</label><input id="mf-unit-rent" type="number" placeholder="8000"/></div>
      <div class="modal-actions"><button class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="save-unit">Add unit</button></div>
    `;
  } else if(m.type==='pay-bill'){
    const bill = DATA.bills.find(b=>b.id===m.payload.billId);
    body = `
      <h3>Pay bill</h3>
      <div class="card" style="background:var(--cream);margin-bottom:14px;">
        <div style="text-transform:capitalize;font-weight:500;">${bill.type} — ${bill.period}</div>
        <div class="mono" style="font-size:22px;margin-top:4px;">${money(bill.amount)}</div>
      </div>
      <div class="field"><label>Payment method</label>
        <select id="mf-method"><option>M-Pesa</option><option>Card (Stripe)</option></select>
      </div>
      <div class="small-note" style="margin-bottom:10px;">This is a demo gateway — clicking confirm simulates a successful payment and generates a receipt.</div>
      <div class="modal-actions"><button class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="confirm-pay" data-id="${bill.id}">Confirm payment</button></div>
    `;
  } else if(m.type==='receipt'){
    const p = DATA.payments.find(x=>x.id===m.payload.paymentId);
    const bill = DATA.bills.find(b=>b.id===p.billId);
    const t = tenantById(p.tenantId);
    body = `
      <h3>Receipt ${p.receiptId}</h3>
      <div class="card" style="background:var(--cream);">
        <div style="display:flex;justify-content:space-between;"><span class="small-note">Tenant</span><span>${t.name}</span></div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;"><span class="small-note">For</span><span style="text-transform:capitalize;">${bill.type} — ${bill.period}</span></div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;"><span class="small-note">Method</span><span>${p.method}</span></div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;"><span class="small-note">Date</span><span>${fmtDate(p.date)}</span></div>
        <div style="border-top:1px solid var(--line);margin-top:10px;padding-top:10px;display:flex;justify-content:space-between;"><b>Amount paid</b><b class="mono">${money(p.amount)}</b></div>
      </div>
      <div class="modal-actions"><button class="btn" data-action="close-modal">Close</button><button class="btn btn-primary" data-action="print-receipt">${icon('download')} Print / save PDF</button></div>
    `;
  } else if(m.type==='new-maint'){
    body = `
      <h3>New maintenance request</h3>
      <div class="field"><label>Title</label><input id="mf-mtitle" placeholder="e.g. Broken window latch"/></div>
      <div class="field"><label>Description</label><textarea id="mf-mdesc" rows="3" placeholder="Describe the problem..."></textarea></div>
      <div class="field"><label>Photo (optional)</label><input id="mf-mphoto" type="file" accept="image/*"/></div>
      <div class="modal-actions"><button class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="save-maint">Submit request</button></div>
    `;
  } else if(m.type==='new-topic'){
    body = `
      <h3>New forum topic</h3>
      <div class="field"><label>Title</label><input id="mf-ttitle" placeholder="What's on your mind?"/></div>
      <div class="modal-actions"><button class="btn" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="save-topic">Post topic</button></div>
    `;
  }
  return `<div class="overlay" data-action="overlay-close"><div class="modal" onclick="event.stopPropagation()">${body}</div></div>`;
}

/* ============ EVENTS ============ */
function bindEvents(){
  document.querySelectorAll('[data-nav]').forEach(el=>{
    el.addEventListener('click',()=>{ state.view=el.getAttribute('data-nav'); render(); });
  });
  document.querySelectorAll('[data-role]').forEach(el=>{
    el.addEventListener('click',()=>{
      state.role=el.getAttribute('data-role');
      state.view='dashboard';
      if(state.role==='tenant' && !state.tenantId) state.tenantId=DATA.tenants[0]?.id;
      render();
    });
  });
  const picker = document.getElementById('tenant-picker');
  if(picker) picker.addEventListener('change',e=>{ state.tenantId=e.target.value; render(); });

  document.querySelectorAll('[data-action]').forEach(el=>{
    el.addEventListener('click',(e)=>handleAction(el.getAttribute('data-action'),el,e));
  });
}

function handleAction(action,el){
  if(action==='overlay-close'){ state.modal=null; render(); return; }
  if(action==='close-modal'){ state.modal=null; render(); return; }

  if(action==='open-add-tenant'){ state.modal={type:'add-tenant'}; render(); return; }
  if(action==='open-add-unit'){ state.modal={type:'add-unit'}; render(); return; }

  if(action==='save-tenant'){
    const name=document.getElementById('mf-name').value.trim();
    const phone=document.getElementById('mf-phone').value.trim();
    const email=document.getElementById('mf-email').value.trim();
    const unitId=document.getElementById('mf-unit').value;
    if(!name||!unitId){ return; }
    const id=uid('t');
    DATA.tenants.push({id,name,unitId,phone,email,joined:todayStr(),lastWaterReading:0,lastElectricReading:0});
    const u=unitById(unitId); if(u){u.status='occupied';u.tenantId=id;}
    persist(); state.modal=null; render(); return;
  }

  if(action==='save-unit'){
    const label=document.getElementById('mf-unit-label').value.trim();
    const rent=parseFloat(document.getElementById('mf-unit-rent').value)||0;
    if(!label) return;
    DATA.units.push({id:uid('u'),label,rentAmount:rent,status:'vacant',tenantId:null});
    persist(); state.modal=null; render(); return;
  }

  if(action==='delete-tenant'){
    const id=el.getAttribute('data-id');
    const t=tenantById(id);
    if(t){ const u=unitById(t.unitId); if(u){u.status='vacant';u.tenantId=null;} }
    DATA.tenants=DATA.tenants.filter(x=>x.id!==id);
    persist(); render(); return;
  }

  if(action==='delete-bill'){
    const id=el.getAttribute('data-id');
    DATA.bills = DATA.bills.filter(b=>b.id!==id);
    persist(); render(); return;
  }

  if(action==='generate-rent'){
    const period=document.getElementById('rent-period').value.trim();
    const due=document.getElementById('rent-due').value;
    DATA.units.filter(u=>u.status==='occupied').forEach(u=>{
      const exists = DATA.bills.some(b=>b.tenantId===u.tenantId && b.type==='rent' && b.period===period);
      if(!exists){
        DATA.bills.push({id:uid('b'),tenantId:u.tenantId,type:'rent',period,amount:u.rentAmount,dueDate:due,status:'unpaid',createdAt:todayStr()});
      }
    });
    persist(); render(); return;
  }

  if(action==='generate-water'){
    const period=document.getElementById('water-period').value.trim();
    const rate=parseFloat(document.getElementById('water-rate').value)||0;
    DATA.settings.waterRate=rate;
    document.querySelectorAll('.water-current').forEach(inp=>{
      const tid=inp.getAttribute('data-tenant');
      const current=parseFloat(inp.value)||0;
      const t=tenantById(tid);
      if(!t) return;
      const usage=Math.max(0,current-t.lastWaterReading);
      const amount=Math.round(usage*rate);
      DATA.bills.push({id:uid('b'),tenantId:tid,type:'water',period,amount,usage,dueDate:todayStr(),status:'unpaid',createdAt:todayStr()});
      t.lastWaterReading=current;
    });
    persist(); render(); return;
  }

  if(action==='generate-electric'){
    const period=document.getElementById('electric-period').value.trim();
    const rate=parseFloat(document.getElementById('electric-rate').value)||0;
    DATA.settings.electricRate=rate;
    document.querySelectorAll('.electric-current').forEach(inp=>{
      const tid=inp.getAttribute('data-tenant');
      const current=parseFloat(inp.value)||0;
      const t=tenantById(tid);
      if(!t) return;
      const usage=Math.max(0,current-t.lastElectricReading);
      const amount=Math.round(usage*rate);
      DATA.bills.push({id:uid('b'),tenantId:tid,type:'electric',period,amount,usage,dueDate:todayStr(),status:'unpaid',createdAt:todayStr()});
      t.lastElectricReading=current;
    });
    persist(); render(); return;
  }

  if(action==='log-tax'){
    const amount=parseFloat(document.getElementById('tax-amount').value)||0;
    const date=document.getElementById('tax-date').value||todayStr();
    const note=document.getElementById('tax-note').value.trim();
    if(amount<=0) return;
    DATA.taxRecords.push({id:uid('x'),amount,date,note});
    persist(); render(); return;
  }

  if(action==='update-maint'){
    const id=el.getAttribute('data-id');
    const select=document.querySelector(`.maint-status[data-id="${id}"]`);
    const m=DATA.maintenance.find(x=>x.id===id);
    if(m&&select){ m.status=select.value; persist(); render(); }
    return;
  }

  if(action==='export-csv'){
    let csv='Date,Tenant,Type,Period,Amount,Method,Receipt\n';
    DATA.payments.forEach(p=>{
      const bill=DATA.bills.find(b=>b.id===p.billId);
      const t=tenantById(p.tenantId);
      csv+=`${p.date},${t?t.name:''},${bill?bill.type:''},${bill?bill.period:''},${p.amount},${p.method},${p.receiptId}\n`;
    });
    const blob=new Blob([csv],{type:'text/csv'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download='moriasi-ledger.csv'; a.click();
    URL.revokeObjectURL(url);
    return;
  }

  if(action==='open-pay'){ state.modal={type:'pay-bill',payload:{billId:el.getAttribute('data-id')}}; render(); return; }

  if(action==='confirm-pay'){
    const billId=el.getAttribute('data-id');
    const method=document.getElementById('mf-method').value;
    const bill=DATA.bills.find(b=>b.id===billId);
    if(!bill) return;
    bill.status='paid';
    const receiptId='RCT-'+Math.floor(1000+Math.random()*9000);
    const payment={id:uid('p'),billId,tenantId:bill.tenantId,amount:bill.amount,method,date:todayStr(),receiptId};
    DATA.payments.push(payment);
    persist();
    state.modal={type:'receipt',payload:{paymentId:payment.id}};
    render(); return;
  }

  if(action==='view-receipt'){ state.modal={type:'receipt',payload:{paymentId:el.getAttribute('data-id')}}; render(); return; }
  if(action==='print-receipt'){ window.print(); return; }

  if(action==='open-new-maint'){ state.modal={type:'new-maint'}; render(); return; }

  if(action==='save-maint'){
    const title=document.getElementById('mf-mtitle').value.trim();
    const desc=document.getElementById('mf-mdesc').value.trim();
    const fileInput=document.getElementById('mf-mphoto');
    if(!title) return;
    const finish=(photoData)=>{
      DATA.maintenance.push({id:uid('m'),tenantId:state.tenantId,title,description:desc,photo:photoData,status:'Submitted',createdAt:todayStr()});
      persist(); state.modal=null; render();
    };
    if(fileInput && fileInput.files && fileInput.files[0]){
      const file=fileInput.files[0];
      const reader=new FileReader();
      reader.onload=(ev)=>{
        const img=new Image();
        img.onload=()=>{
          // Compress and shrink the photo, then store it as base64 text
          // directly in the Firestore document. Cloud Firestore is free
          // on the Spark plan, so this avoids needing Firebase Storage or
          // Cloud Functions (both of which require the paid Blaze plan to
          // even enable). Firestore documents have a 1MB size ceiling, so
          // we keep photos small (~400px wide, medium quality) to leave
          // plenty of room for everything else in the document.
          const canvas=document.createElement('canvas');
          const maxW=400;
          const scale=Math.min(1,maxW/img.width);
          canvas.width=img.width*scale; canvas.height=img.height*scale;
          const ctx=canvas.getContext('2d');
          ctx.drawImage(img,0,0,canvas.width,canvas.height);
          finish(canvas.toDataURL('image/jpeg',0.5));
        };
        img.src=ev.target.result;
      };
      reader.readAsDataURL(file);
    } else { finish(null); }
    return;
  }

  if(action==='open-new-topic'){ state.modal={type:'new-topic'}; render(); return; }

  if(action==='save-topic'){
    const title=document.getElementById('mf-ttitle').value.trim();
    if(!title) return;
    const author = state.role==='admin' ? 'admin' : state.tenantId;
    const authorName = state.role==='admin' ? 'Admin' : currentTenant()?.name;
    DATA.forum.push({id:uid('f'),title,author,authorName,createdAt:todayStr(),replies:[]});
    persist(); state.modal=null; render(); return;
  }

  if(action==='reply-topic'){
    const topicId=el.getAttribute('data-topic');
    const input=document.querySelector(`.reply-input[data-topic="${topicId}"]`);
    const content=input?input.value.trim():'';
    if(!content) return;
    const topic=DATA.forum.find(f=>f.id===topicId);
    const authorName = state.role==='admin' ? 'Admin' : currentTenant()?.name;
    topic.replies.push({id:uid('fr'),author:state.role==='admin'?'admin':state.tenantId,authorName,content,createdAt:todayStr()});
    persist(); render(); return;
  }
}

/* ============ INIT ============ */
(async function init(){
  const appEl = document.getElementById('app');
  appEl.innerHTML = '<div style="padding:40px;color:#5C6D6E;font-family:Inter,sans-serif;">Loading Moriasi Manage…</div>';
  try{
    await ensureAuth();
    await loadData();
    state.tenantId = DATA.tenants[0]?.id || null;
    render();
  }catch(e){
    console.error('Failed to start app', e);
    appEl.innerHTML = '<div style="padding:40px;color:#B8453D;font-family:Inter,sans-serif;max-width:520px;">'
      + '<b>Could not connect to Firebase.</b><br><br>Check that firebase-init.js has your real project '
      + 'config, and that Firestore and Anonymous Authentication are enabled in the Firebase console. '
      + 'See README.md for the full setup steps.<br><br><span style="font-family:monospace;font-size:12px;">' 
      + (e && e.message ? e.message : e) + '</span></div>';
  }
})();

/* ============================================================
   ADD-ON BRIDGE — paste this block onto the END of public/app.js
   ------------------------------------------------------------
   Nothing above this line needs to change. This block only EXPOSES
   the app's existing internals (DATA, state, render, persist, and a
   few helpers) on `window`, so separate add-on modules
   (public/modules/*.js) can hook into the app without you having to
   edit any of the existing code, functions, or UI above.

   It does not change any behavior by itself — it only makes things
   readable/callable from outside this file.
   ============================================================ */
window.MoriasiBridge = {
  getData: () => DATA,
  setData: (d) => { DATA = d; },
  state,
  render,
  persist,
  uid,
  money,
  todayStr,
  fmtDate,
  tenantById,
  unitById,
  currentTenant,
};
window.dispatchEvent(new CustomEvent('moriasi:bridge-ready'));

