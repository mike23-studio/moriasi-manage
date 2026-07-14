# Moriasi Manage — Setup Guide

This is your water & property management prototype turned into a real,
working web app, using **only the free Firebase Spark plan** — no billing
account required:

- **Firebase Hosting** — serves the website (fast, free CDN, free HTTPS).
- **Cloud Firestore** — the database. This is a Google Cloud service; you
  reach it through the Firebase SDK, but the data physically lives in
  Google Cloud. Free on the Spark plan.
- **Firebase Authentication** (anonymous) — a minimal layer so the database
  isn't wide open to the whole internet. Free on the Spark plan.

Firebase and Google Cloud are the same underlying project — a Firebase
project *is* a Google Cloud project. You'll see the same project if you
open [console.firebase.google.com](https://console.firebase.google.com) or
[console.cloud.google.com](https://console.cloud.google.com).

Nothing else about the app changed — same screens, same features, same
look. Only the "save"/"load" plumbing underneath is now real.

### Why no Firebase Storage or Google Drive?

Firebase Storage and Cloud Functions both now require upgrading to the
paid **Blaze (pay-as-you-go)** plan just to switch them on — even if your
actual usage stays comfortably inside the free monthly quota. Since you
want to stay on the free Spark plan, maintenance-request photos are
instead compressed and stored as base64 text directly inside the same
Firestore document as everything else. No extra service, no billing
account, no separate setup — it just works. See "A note on photos" below
for the trade-off this involves.

---

## 1. Create your Firebase project

1. Go to <https://console.firebase.google.com> and click **Add project**.
2. Give it a name (e.g. `moriasi-manage`) and finish the wizard (you can
   disable Google Analytics, you don't need it for this).
3. Once created, click the **web icon (`</>`)** on the project overview
   page to register a new web app. Give it a nickname, and **do not**
   check "Also set up Firebase Hosting" here (we'll do that from the CLI).
4. Firebase will show you a `firebaseConfig` object that looks like this:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "moriasi-manage.firebaseapp.com",
     projectId: "moriasi-manage",
     storageBucket: "moriasi-manage.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef123456"
   };
   ```

   Keep this tab open — you'll paste these values in step 3 below.

   **Important:** paste these values into the `firebaseConfig` object
   inside `public/firebase-init.js` yourself. Don't paste the whole
   snippet from the console over that file — the console's snippet is
   written for npm/bundler projects (`import ... from "firebase/app"`),
   which won't load correctly here, and it won't export `db`/`auth`,
   which the rest of the app depends on.

## 2. Turn on the services this app needs

Still in the Firebase console, in the left sidebar under **Build**:

- **Firestore Database** → Create database → start in **Production mode**
  → pick a location close to you (e.g. `europe-west1` or one near Kenya
  such as a `nam5`/`eur3` multi-region — pick whichever is offered).
- **Authentication** → Get started → under **Sign-in method**, enable
  **Anonymous**.

That's it — both are free on the Spark plan, no billing account needed.
Do **not** open the Storage tab / set up a Storage bucket — this project
doesn't use it, and setting one up now requires the paid Blaze plan.

## 3. Connect the code to your project

Open this project folder in VS Code. Open:

```
public/firebase-init.js
```

Replace the placeholder `firebaseConfig` values with the real ones from
step 1. Save the file — that's the only code edit required to connect to
*your* Firebase/Google Cloud project.

Also open `.firebaserc` and replace the project id with your actual
project ID (the `projectId` value above, e.g. `moriasi-manage`).

## 4. Install the Firebase CLI (in VS Code's terminal)

You need [Node.js](https://nodejs.org) installed first (any recent LTS
version). Then, in VS Code, open a terminal (`` Ctrl+` ``) in this project
folder and run:

```bash
npm install -g firebase-tools
firebase login
```

`firebase login` opens a browser window — sign in with the same Google
account you used to create the Firebase project.

## 5. Point the CLI at your project

```bash
firebase use --add
```

Pick your project from the list, and when asked for an alias, type
`default`.

## 6. Deploy the Firestore security rules

```bash
firebase deploy --only firestore:rules
```

Afterward, confirm it landed: Firebase console → **Firestore Database →
Rules** tab should show the rule from `firestore.rules` (allowing access
to signed-in users), not the default "deny everything" rule.

## 7. Try it locally before deploying (optional but recommended)

```bash
firebase serve
```

This runs the site at `http://localhost:5000` using your **real** Firebase
project (Firestore), so you can click around and confirm it works before
publishing it live.

## 8. Deploy the website

```bash
firebase deploy --only hosting
```

The CLI will print a URL like:

```
Hosting URL: https://moriasi-manage.web.app
```

That's your live, working app. Open it, and the first tenant/admin who
loads it will trigger the app to seed itself with the same sample data the
prototype shipped with (editable/deletable from the UI, same as before).

---

## How the pieces fit together

| Prototype behavior | Now |
|---|---|
| `window.storage.get/set` (fake, in-memory demo storage) | `Cloud Firestore` — one document (`appData/main`) holding all tenants, units, bills, payments, maintenance requests, forum posts, and tax records. |
| Maintenance photo saved as a base64 string inside the data | Still base64, still inside the same Firestore document — compressed smaller (~400px wide) to leave room within Firestore's 1MB document limit. |
| No login | Anonymous Firebase Authentication runs automatically on page load, just so Firestore rules can tell "a real visitor" from "an open request from anywhere on the internet." |
| Everything else (dashboard, billing, ledger, forum, UI) | Unchanged — same HTML/CSS/JS logic as your prototype. |

The app also now **syncs live**: if the admin generates a bill on one
device, a tenant viewing the app on another device sees it appear without
refreshing, because Firestore pushes updates to every connected browser.

## A note on photos (and Firestore's 1MB limit)

Every Firestore document has a hard 1MB size ceiling. Because all app data
(including every maintenance photo) lives in one document, photos are
compressed hard (small width, medium JPEG quality) before saving, and it's
worth keeping an eye on how many photos accumulate over time.

If you outgrow this (lots of tenants, lots of photos), the natural next
step — without needing Firebase Storage or the paid plan — is to split
`maintenance` into its own Firestore **collection**, one document per
request, so each request's photo only counts against its own 1MB limit
instead of sharing one global ceiling. That's a moderate refactor, not a
platform change, and can be done entirely on the free plan.

## Where your data actually lives

Firestore data: Firebase console → **Firestore Database**, or Google Cloud
console → **Firestore** for the same project.

## A note on security (read this before real-world use)

The current rules (`firestore.rules`) allow **any** signed-in (even
anonymous) visitor to read and write **all** data. That matches the
prototype's "everyone sees everything, roles are just a UI toggle"
behavior, and is fine for trying this out or for a small, trusted group.

Before using this with real tenants and real money, you should add proper
accounts (e.g. Firebase Authentication with email/password or Google
sign-in) and tighten the rules so:

- Tenants can only read/write their own bills, payments, and maintenance
  requests.
- Only an admin account can generate bills, add/remove tenants and units,
  or mark bills as paid.

This typically means splitting the single `appData/main` document into
separate Firestore collections (`tenants`, `units`, `bills`, `payments`,
`maintenance`, `forum`, `taxRecords`) with per-collection rules — a
natural next step once you're ready to go further than the prototype.

## Project files

```
moriasi-manage/
├── public/
│   ├── index.html        the app shell
│   ├── style.css          all styling (unchanged from the prototype)
│   ├── app.js              app logic (same UI/behavior, now saves to Firestore)
│   └── firebase-init.js   <- paste your Firebase config here
├── firebase.json          Hosting/Firestore config for the CLI
├── .firebaserc            <- put your Firebase project ID here
├── firestore.rules        who can read/write the database
└── firestore.indexes.json (empty — not needed for this simple data model)
```
