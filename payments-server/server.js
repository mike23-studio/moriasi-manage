/* ============================================================
   Moriasi Manage — Payments backend (new, separate service)
   ------------------------------------------------------------
   This does NOT touch the existing Firebase-hosted frontend. It's
   a small standalone Node/Express service whose only job is to
   talk to Paystack (which supports both M-Pesa STK Push and card
   payments in Kenya) using your SECRET key, which must never be
   placed in browser code. The frontend module
   (public/modules/payment-integration.js) calls this service.

   Why a separate backend at all, and why not Firebase Cloud
   Functions? The existing project intentionally stays on Firebase's
   free Spark plan, and Cloud Functions require the paid Blaze plan.
   This service can instead be deployed for free on Render, Railway,
   Fly.io, or similar.

   Endpoints:
     POST /api/mpesa/initiate   { phone, amount, email, reference }
     POST /api/card/initiate    { amount, email, reference }
     GET  /api/verify/:reference
     POST /api/webhook/paystack   (optional, for server-to-server confirmation)
   ============================================================ */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

if(!PAYSTACK_SECRET_KEY){
  console.warn('WARNING: PAYSTACK_SECRET_KEY is not set. Set it in .env before going live.');
}

async function paystack(path, options={}){
  const res = await fetch(PAYSTACK_BASE + path, {
    ...options,
    headers: {
      'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers||{})
    }
  });
  const data = await res.json();
  if(!res.ok || data.status === false){
    throw new Error((data && data.message) || 'Paystack request failed');
  }
  return data;
}

function normalizePhone(phone){
  // Accepts formats like 07xx xxx xxx, +2547xx xxx xxx, 2547xx xxx xxx
  const digits = phone.replace(/\D/g,'');
  if(digits.startsWith('254')) return digits;
  if(digits.startsWith('0')) return '254' + digits.slice(1);
  if(digits.startsWith('7') || digits.startsWith('1')) return '254' + digits;
  return digits;
}

// Webhook needs the raw body for signature verification, so give it its
// own raw parser BEFORE the global json() middleware below.
app.post('/api/webhook/paystack', express.raw({type:'*/*'}), (req, res)=>{
  try{
    const signature = req.headers['x-paystack-signature'];
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(req.body).digest('hex');
    if(hash !== signature){
      return res.status(401).send('Invalid signature');
    }
    const event = JSON.parse(req.body.toString('utf8'));
    // Payment confirmation in this app happens via the frontend calling
    // /api/verify/:reference and then writing to Firestore itself (the
    // frontend already has Firestore write access). This webhook is kept
    // as a hook point if you later want server-side confirmation too —
    // e.g. logging events, or calling out to another system.
    console.log('Paystack webhook event:', event.event, event.data && event.data.reference);
    res.sendStatus(200);
  }catch(e){
    console.error(e);
    res.sendStatus(400);
  }
});

app.use(express.json());

app.post('/api/mpesa/initiate', async (req, res)=>{
  try{
    const { phone, amount, email, reference } = req.body;
    if(!phone || !amount || !reference) return res.status(400).json({error:'phone, amount and reference are required'});
    const data = await paystack('/charge', {
      method: 'POST',
      body: JSON.stringify({
        email: email || 'tenant@moriasi-manage.app',
        amount: Math.round(amount * 100), // Paystack uses the smallest currency unit
        currency: 'KES',
        reference,
        mobile_money: { phone: normalizePhone(phone), provider: 'mpesa' }
      })
    });
    res.json({ status: data.data.status, reference });
  }catch(e){
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/card/initiate', async (req, res)=>{
  try{
    const { amount, email, reference } = req.body;
    if(!amount || !reference) return res.status(400).json({error:'amount and reference are required'});
    const data = await paystack('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: email || 'tenant@moriasi-manage.app',
        amount: Math.round(amount * 100),
        currency: 'KES',
        reference,
        channels: ['card']
      })
    });
    res.json({ access_code: data.data.access_code, authorization_url: data.data.authorization_url, reference });
  }catch(e){
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/verify/:reference', async (req, res)=>{
  try{
    const data = await paystack(`/transaction/verify/${encodeURIComponent(req.params.reference)}`);
    res.json({
      status: data.data.status, // 'success' | 'failed' | 'abandoned'
      amount: data.data.amount / 100,
      channel: data.data.channel,
      reference: data.data.reference
    });
  }catch(e){
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=>console.log(`Moriasi payments backend listening on port ${PORT}`));
