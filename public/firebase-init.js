/* ============================================================
   FIREBASE / GOOGLE CLOUD CONNECTION
   ------------------------------------------------------------
   This file must use CDN URLs (not bare "firebase/app" specifiers) and
   must export db / auth, because app.js imports them directly:

       import { db, auth } from './firebase-init.js';

   Do NOT paste the raw snippet from the Firebase console over this file —
   that snippet is written for npm/bundler projects and will break both
   of the things above.

   This project intentionally uses ONLY Cloud Firestore + Anonymous Auth,
   both of which are free on the Spark (free) plan. Firebase Storage and
   Cloud Functions are NOT used, because both now require upgrading to the
   paid Blaze plan just to be enabled, even if you never exceed the free
   quota. Maintenance photos are instead compressed and stored as base64
   text directly inside the Firestore document (see app.js / README.md).
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB8n1DxSyWxpaTpQuXj09JBSlRF_glwdvA",
  authDomain: "moriasi-manage.firebaseapp.com",
  projectId: "moriasi-manage",
  storageBucket: "moriasi-manage.firebasestorage.app",
  messagingSenderId: "814321450083",
  appId: "1:814321450083:web:c2088acc21456556cf4c56"
};

export const app = initializeApp(firebaseConfig);

// Cloud Firestore -> Google Cloud's document database. Free on Spark plan.
export const db = getFirestore(app);

// Firebase Authentication -> anonymous sign-in, just so security rules
// have something to check. Also free on Spark plan.
export const auth = getAuth(app);
