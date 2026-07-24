/* ============================================================
   ADD-ON MODULE: payment-integration.js
   ------------------------------------------------------------
   Replaces the demo "Pay bill" flow with a real M-Pesa (STK Push,
   via Paystack's Mobile Money charge) and Card (Paystack Inline
   popup) flow, WITHOUT editing app.js.

   How it works:
   - Loaded as an extra <script type="module"> AFTER app.js.
   - Waits for window.MoriasiBridge (see APPEND-TO-app.js.txt).
   - Listens for clicks on the existing "Pay now" buttons
     (data-action="open-pay") in the CAPTURE phase, i.e. before
     app.js's own click handler runs, and calls
     e.stopImmediatePropagation() so the original demo modal never
     opens. We show our own modal instead (a plain DOM overlay
     appended to <body>, completely separate from app.js's own
     render() cycle, so it survives re-renders).
   - On a confirmed payment, it writes a payment record and marks
     the bill paid using the exact same data shape app.js already
     uses (so the ledger, receipts, dashboard KPIs etc. all keep
     working unmodified), then calls the bridge's persist()/render().

   Setup required (see payments-server/README.md):
   - Deploy the small backend in /payments-server (proxies Paystack,
     keeps your secret key off the browser).
   - Set BACKEND_URL below to that backend's URL.
   - Set PAYSTACK_PUBLIC_KEY below (safe to expose in the browser).
   ============================================================ */

const BACKEND_URL = 'https://moriasi-manage.onrender.com/'; // e.g. https://moriasi-payments.onrender.com
const PAYSTACK_PUBLIC_KEY = 'pk_test_3b0ea039e24b61dd665d1b906bb892d0b2ad7211';

function waitForBridge(){
  return new Promise((resolve)=>{
    if(window.MoriasiBridge) return resolve(window.MoriasiBridge);
    window.addEventListener('moriasi:bridge-ready', ()=>resolve(window.MoriasiBridge), {once:true});
  });
}

function loadPaystackScript(){
  return new Promise((resolve, reject)=>{
    if(window.PaystackPop) return resolve();
    const s = document.createElement('script');
    s.src = 'https://js.paystack.co/v2/inline.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

(async function init(){
  const bridge = await waitForBridge();

  // ---------- small helpers ----------
  function overlay(html){
    const wrap = document.createElement('div');
    wrap.className = 'moriasi-addon-overlay';
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(20,20,20,.45);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:Inter,sans-serif;';
    wrap.innerHTML = `<div class="moriasi-addon-modal" style="background:#fff;border-radius:14px;padding:22px;max-width:380px;width:92%;box-shadow:0 20px 50px rgba(0,0,0,.25);">${html}</div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (e)=>{ if(e.target===wrap) closeOverlay(); });
    return wrap;
  }
  function closeOverlay(){
    document.querySelectorAll('.moriasi-addon-overlay').forEach(el=>el.remove());
  }

  async function apiPost(path, body){
    const res = await fetch(BACKEND_URL + path, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }
  async function apiGet(path){
    const res = await fetch(BACKEND_URL + path);
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function finalizePaidBill(bill, method, reference){
    const DATA = bridge.getData();
    bill.status = 'paid';
    const payment = {
      id: bridge.uid('p'),
      billId: bill.id,
      tenantId: bill.tenantId,
      amount: bill.amount,
      method,
      date: bridge.todayStr(),
      receiptId: reference
    };
    DATA.payments.push(payment);
    bridge.persist();
    bridge.state.modal = { type:'receipt', payload:{ paymentId: payment.id } };
    bridge.render();
  }

  function pollVerify(reference, {onSuccess, onFail, tries=20, intervalMs=3000}){
    let n = 0;
    const t = setInterval(async ()=>{
      n++;
      try{
        const data = await apiGet(`/api/verify/${reference}`);
        if(data.status === 'success'){ clearInterval(t); onSuccess(data); return; }
        if(data.status === 'failed' || data.status === 'abandoned'){ clearInterval(t); onFail(new Error('Payment was not completed.')); return; }
      }catch(e){ /* keep polling until tries run out */ }
      if(n>=tries){ clearInterval(t); onFail(new Error('Payment confirmation timed out.')); }
    }, intervalMs);
  }

  // ---------- the real "pay bill" modal ----------
  function openPayModal(billId){
    const DATA = bridge.getData();
    const bill = DATA.bills.find(b=>b.id===billId);
    if(!bill) return;
    const tenant = bridge.tenantById(bill.tenantId);
    const reference = 'MOR-' + Date.now() + '-' + Math.floor(Math.random()*1000);

    const wrap = overlay(`
      <h3 style="margin:0 0 10px;">Pay bill</h3>
      <div style="background:#F7F3EC;border-radius:10px;padding:12px;margin-bottom:14px;">
        <div style="text-transform:capitalize;font-weight:500;">${bill.type} — ${bill.period}</div>
        <div style="font-family:monospace;font-size:22px;margin-top:4px;">${bridge.money(bill.amount)}</div>
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:13px;display:block;margin-bottom:4px;">Payment method</label>
        <select id="pay-method" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;">
          <option value="mpesa">M-Pesa</option>
          <option value="card">Card</option>
        </select>
      </div>
      <div id="pay-fields"></div>
      <div id="pay-status" style="font-size:13px;color:#5C6D6E;margin-top:8px;"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
        <button id="pay-cancel" style="padding:8px 14px;border-radius:8px;border:1px solid #ddd;background:#fff;">Cancel</button>
        <button id="pay-submit" style="padding:8px 14px;border-radius:8px;border:none;background:#2E6F5E;color:#fff;">Pay now</button>
      </div>
    `);

    const fieldsEl = wrap.querySelector('#pay-fields');
    const methodEl = wrap.querySelector('#pay-method');
    const statusEl = wrap.querySelector('#pay-status');
    const submitBtn = wrap.querySelector('#pay-submit');

    function renderFields(){
      if(methodEl.value === 'mpesa'){
        fieldsEl.innerHTML = `
          <label style="font-size:13px;display:block;margin-bottom:4px;">M-Pesa phone number</label>
          <input id="pay-phone" placeholder="07xx xxx xxx" value="${(tenant&&tenant.phone)||''}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;"/>
          <div style="font-size:12px;color:#5C6D6E;margin-top:6px;">You'll get an STK push prompt on your phone — enter your M-Pesa PIN there to finish.</div>
        `;
      } else {
        fieldsEl.innerHTML = `<div style="font-size:12px;color:#5C6D6E;">You'll be asked for your card details and PIN in Paystack's secure payment window. Moriasi Manage never sees or stores your card number or PIN.</div>`;
      }
    }
    renderFields();
    methodEl.addEventListener('change', renderFields);
    wrap.querySelector('#pay-cancel').addEventListener('click', closeOverlay);

    submitBtn.addEventListener('click', async ()=>{
      submitBtn.disabled = true;
      const method = methodEl.value;
      try{
        if(method === 'mpesa'){
          const phone = wrap.querySelector('#pay-phone').value.trim();
          if(!phone){ statusEl.textContent = 'Enter a phone number.'; submitBtn.disabled=false; return; }
          statusEl.textContent = 'Sending STK push to your phone…';
          await apiPost('/api/mpesa/initiate', {
            phone, amount: bill.amount, reference,
            email: (tenant && tenant.email) || 'tenant@moriasi-manage.app'
          });
          statusEl.textContent = 'Check your phone and enter your M-Pesa PIN to confirm…';
          pollVerify(reference, {
            onSuccess: ()=>{ closeOverlay(); finalizePaidBill(bill, 'M-Pesa', reference); },
            onFail: (e)=>{ statusEl.textContent = e.message; submitBtn.disabled=false; }
          });
        } else {
          statusEl.textContent = 'Opening secure card payment…';
          const init = await apiPost('/api/card/initiate', {
            amount: bill.amount, reference,
            email: (tenant && tenant.email) || 'tenant@moriasi-manage.app'
          });
          await loadPaystackScript();
          const popup = new window.PaystackPop();
          popup.resumeTransaction(init.access_code, {
            onSuccess: ()=>{
              statusEl.textContent = 'Confirming payment…';
              pollVerify(reference, {
                tries: 6, intervalMs: 2000,
                onSuccess: ()=>{ closeOverlay(); finalizePaidBill(bill, 'Card', reference); },
                onFail: (e)=>{ statusEl.textContent = e.message; submitBtn.disabled=false; }
              });
            },
            onCancel: ()=>{ statusEl.textContent = 'Card payment cancelled.'; submitBtn.disabled=false; }
          });
        }
      }catch(e){
        statusEl.textContent = e.message || 'Something went wrong. Try again.';
        submitBtn.disabled = false;
      }
    });
  }

  // Intercept clicks on the existing "Pay now" buttons, in the capture
  // phase, before app.js's own handler runs — and stop that handler from
  // ever seeing the click.
  document.addEventListener('click', (e)=>{
    const openBtn = e.target.closest('[data-action="open-pay"]');
    if(openBtn){
      e.stopImmediatePropagation();
      e.preventDefault();
      openPayModal(openBtn.getAttribute('data-id'));
      return;
    }
    // Safety net: if the old demo modal's confirm button is ever reached
    // (it shouldn't be, since we intercept open-pay above), block it too
    // so nobody can double-mark a bill paid without really paying.
    const confirmBtn = e.target.closest('[data-action="confirm-pay"]');
    if(confirmBtn){
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, true);
})();
