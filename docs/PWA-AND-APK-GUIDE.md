# SWM — PWA, APK & PWABuilder: The Complete Guide

A deep, practical reference for how this project was turned into an installable
**PWA**, how **PWABuilder** wraps it into an **Android APK**, how you'd build your
**own** PWA-to-APK builder, and how to use advanced **app capabilities** and
**push notifications**.

Everything here is specific to this repo (SWM — School Workforce Management,
Next.js 16 App Router, deployed on Vercel at
`https://schoolmanagementswm.vercel.app`).

---

## Table of contents

1. [Big picture: website → installable app → APK](#1-big-picture)
2. [What a PWA actually is](#2-what-a-pwa-actually-is)
3. [What we built in THIS project (file by file)](#3-what-we-built-in-this-project)
4. [How a browser installs a PWA](#4-how-a-browser-installs-a-pwa)
5. [How PWABuilder turns it into an APK (the TWA pipeline)](#5-how-pwabuilder-turns-it-into-an-apk)
6. [The signing story — why "unsigned" wouldn't install](#6-the-signing-story)
7. [Digital Asset Links & the address bar](#7-digital-asset-links--the-address-bar)
8. [Build your OWN PWA builder](#8-build-your-own-pwa-builder)
9. [App Capabilities — which can we use?](#9-app-capabilities)
10. [Push / notification service — can we use it?](#10-push--notification-service)
11. [The Vercel deploy gotcha](#11-the-vercel-deploy-gotcha)
12. [Troubleshooting / FAQ](#12-troubleshooting--faq)
13. [Command reference](#13-command-reference)
14. [Glossary](#14-glossary)

---

## 1. Big picture

There are **three layers**. Each wraps the one above it. The actual app (your
Next.js server + MongoDB) never moves — it always runs on Vercel.

```
┌──────────────────────────────────────────────────────────────┐
│  ANDROID APK (TWA)  ── a thin native shell, signed            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  PWA  ── manifest + service worker + icons + HTTPS      │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │  YOUR WEBSITE  (Next.js 16 + MongoDB on Vercel)   │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

- **Website** — the real product. Has a server, database, login. Needs internet.
- **PWA** — metadata + a background script that make the website *installable*
  and *offline-aware* in a browser.
- **APK (TWA)** — an Android app that opens the live website full-screen using
  the phone's Chrome engine. It contains **no app logic** — it just points at the
  URL. That's why it always needs the site deployed.

> Key consequence: because the app has a server + database, there is **no
> standalone offline app**. Every "app" form is a shell around the hosted site.

---

## 2. What a PWA actually is

A **Progressive Web App** is a normal website plus a few standardised pieces that
let browsers/OSes treat it like a native app. The **three core ingredients**:

### a) Web App Manifest
A JSON file describing the app to the OS: name, icons, colours, and how to
display it. The browser reads it to build the install entry (home-screen icon,
splash screen, standalone window).

### b) Service Worker
A JavaScript file the browser runs **in the background**, separate from any page.
It can **intercept network requests** (`fetch` events), which unlocks:
- **Offline support** (serve cached responses when the network fails)
- **Push notifications** (`push` event)
- **Background sync**

It has a lifecycle: `install` → `activate` → then it controls pages and receives
`fetch`/`push` events.

### c) HTTPS (+ icons)
Service workers and installation **only work over HTTPS** (or `localhost`). You
also need at least a **192×192** and **512×512** icon, and ideally a **maskable**
icon (one that fills the whole tile so the OS can crop it to any shape).

| Ingredient | This project | Served at |
|---|---|---|
| Manifest | `src/app/manifest.js` | `/manifest.webmanifest` |
| Service worker | `public/sw.js` | `/sw.js` |
| Icons | `public/icon-192.png`, `icon-512.png`, `apple-icon-180.png` | `/icon-192.png` … |
| HTTPS | Vercel | `https://schoolmanagementswm.vercel.app` |

---

## 3. What we built in THIS project

Next.js 16 (App Router) gives file-based conventions for most of this.

| File | Role |
|---|---|
| `src/app/manifest.js` | Returns the manifest object. Next serves it at `/manifest.webmanifest` and **auto-injects** `<link rel="manifest">`. Sets `name: "SWM"`, `display: "standalone"`, `theme_color`, icons (incl. a `maskable` one). |
| `scripts/gen-pwa-icons.mjs` | A dependency-free Node script that **draws the icons** (indigo gradient + white check) and encodes real **PNG** files using only Node's built-in `zlib`. Re-run to regenerate. |
| `public/icon-192.png` / `icon-512.png` / `apple-icon-180.png` | The generated icons. Real binary PNGs in `/public` (so they're public, cacheable, and work offline). |
| `public/sw.js` | The service worker. **Network-first** for page navigations with an **offline fallback**; **stale-while-revalidate** for static assets; never caches `/api/*` or page HTML (the app is authenticated, so caching HTML could leak data). |
| `public/offline.html` | A static, branded "you're offline" page the SW serves when a navigation fails offline. Static so it bypasses auth entirely. |
| `src/components/pwa-register.jsx` | A tiny client component that calls `navigator.serviceWorker.register('/sw.js')` on `load`. Mounted in the root layout. |
| `src/app/layout.jsx` | Adds `export const viewport = { themeColor }`, `appleWebApp` metadata (iOS), icon links, and mounts `<PwaRegister/>`. |
| `src/app/page.jsx` | The public landing page at `/` (was a redirect before). |
| `src/lib/auth.config.js` | Made `/` (and `/login`) public; signed-in users are redirected to `/dashboard`. |
| `next.config.mjs` | Sets correct headers for `/sw.js` (no-cache, JS content-type) + security headers. |
| `public/.well-known/assetlinks.json` | Digital Asset Links file for the **APK** (see §7). |

### Why the service worker is "conservative"
This is an **authenticated** app. A naive SW that caches every page would risk
showing **one user's data to the next** person on the same device (offline). So
`sw.js`:
- **Never** caches page HTML or `/api/*`.
- Caches only build output (`/_next/static/...`), icons, fonts (safe, public).
- On an offline navigation, shows the generic `offline.html`.

Online behaviour is unchanged (network-first), so it never serves stale data
while connected.

---

## 4. How a browser installs a PWA

When you visit an **HTTPS** page that has:
- a valid manifest with `name`/`short_name`, `start_url`, a `display` of
  `standalone`/`fullscreen`, and 192 + 512 icons, **and**
- a registered service worker (historically with a `fetch` handler),

…the browser considers the site **installable** and offers an install action:

- **Desktop Chrome/Edge** — an install icon appears in the address bar.
- **Android Chrome** — an "Install app" / "Add to Home screen" prompt.
- **iOS Safari** — manual: Share → "Add to Home Screen" (no auto-prompt).

On install, the OS creates a launcher that opens `start_url` in a **standalone
window** (no browser chrome) using the manifest's icons and `theme_color`. The
service worker keeps running in the background for offline/push.

> Note: a PWA installed **from the browser** is different from the **APK**. The
> APK (TWA) is a separate, shareable file (next section).

---

## 5. How PWABuilder turns it into an APK

PWABuilder is a friendly **web UI over an open-source tool called
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)** (by Google). It
generates a **Trusted Web Activity (TWA)**.

### What is a TWA?
A **Trusted Web Activity** is an Android app that displays your website
**full-screen, with no browser UI**, using the user's installed **Chrome engine**
(via `androidx.browser` / `com.google.androidbrowserhelper`).

- It is **not a WebView**. It's the *real* Chrome rendering engine, so your PWA
  gets full web-platform features and performance.
- It requires Chrome (or another Custom-Tabs-capable browser) on the device.
- "Trusted" = the app and the website prove they belong together via **Digital
  Asset Links** (§7). Without that proof, Chrome shows a **safety address bar**.

### The pipeline (what happens when you click "Generate")

```
 Your live manifest URL
        │
        ▼
 1. Fetch & parse manifest  ──► name, icons, colors, start_url, display
        │
        ▼
 2. Scaffold an Android (Gradle) project from a TWA template:
      • AndroidManifest.xml  → LauncherActivity, package id
                                (app.vercel.schoolmanagementswm.twa),
                                target URL, splash, status-bar colors
      • build.gradle         → depends on androidbrowserhelper
      • res/ (mipmaps)       → your manifest icons resized per density
      • asset_statements     → points back to your domain
        │
        ▼
 3. Compile with the Android SDK + Gradle  ──►  .aab  and  .apk
        │
        ▼
 4. Sign the package  (or hand you an UNSIGNED one to sign yourself)
        │
        ▼
 5. You publish assetlinks.json on your domain so Android can VERIFY
    the app ↔ site relationship  ──►  full-screen, no address bar
```

For this project, PWABuilder's dialog had **no signing option**, so it produced
**`SWM-unsigned.apk`** — which Android refuses to install. We signed it ourselves
(§6).

---

## 6. The signing story

**Every Android app must be cryptographically signed.** The signature proves
(a) integrity (the file wasn't tampered with) and (b) authorship (updates must be
signed with the *same* key). An **unsigned** APK simply won't install.

There are three signature schemes:

| Scheme | Since | Notes |
|---|---|---|
| **v1** (JAR signing) | legacy | Signs individual entries. Alone, won't install on modern Android. |
| **v2** (APK Signature Scheme v2) | Android 7 | Signs the whole APK; required for apps targeting API 30+. |
| **v3** | Android 9 | Adds key rotation. |

We signed with **v1 + v2 + v3** so it installs on every Android version.

### What we actually did (no Android Studio needed)
Your machine had no Java/Android SDK, so we used a **portable JDK** + a single
self-contained signer JAR (**uber-apk-signer**, which bundles `zipalign`):

```bash
# 1) Create a signing key (yours — keep it for future updates)
keytool -genkeypair -keystore swm-release.keystore -alias swm \
        -keyalg RSA -keysize 2048 -validity 10000 \
        -storepass swm-school-2026 -keypass swm-school-2026 \
        -dname "CN=SWM, O=School, C=IN"

# 2) Zipalign + sign (v1+v2+v3) the unsigned APK
java -jar uber-apk-signer.jar \
     -a SWM-unsigned.apk \
     --ks swm-release.keystore --ksAlias swm \
     --ksPass swm-school-2026 --ksKeyPass swm-school-2026 \
     -o out/
# → out/SWM-aligned-signed.apk   (this one installs)
```

**Artifacts (keep these safe — required to ship updates):**
- `D:\ayush\Downloads\SWM-app\SWM-aligned-signed.apk` ← the shareable app
- `D:\ayush\Downloads\SWM-app\swm-release.keystore` ← your signing key
- Keystore password: `swm-school-2026`, alias: `swm`

> ⚠️ Lose the keystore/password and you can **never update** the installed app
> with the same identity — users would have to uninstall and reinstall a new one.

---

## 7. Digital Asset Links & the address bar

If the installed app shows a **thin bar with the URL at the top**, that's the TWA
**Custom Tabs fallback** — Android couldn't verify the app owns the site, so it
shows the bar for safety.

To go **full-screen**, two declarations must match:

1. **The app** declares "I represent `schoolmanagementswm.vercel.app`" (baked in
   by PWABuilder/Bubblewrap).
2. **The website** publishes the app's identity at
   `https://schoolmanagementswm.vercel.app/.well-known/assetlinks.json`.

Our file (`public/.well-known/assetlinks.json`):

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "app.vercel.schoolmanagementswm.twa",
      "sha256_cert_fingerprints": [
        "DB:19:75:BF:55:E1:7A:D6:C1:09:6F:63:91:45:B3:C8:5A:80:24:BA:5B:D6:70:49:59:B9:40:36:30:B9:30:C7"
      ]
    }
  }
]
```

- `package_name` must equal the APK's application id — we extracted it from the
  APK's `AndroidManifest.xml`: **`app.vercel.schoolmanagementswm.twa`**.
- `sha256_cert_fingerprints` must equal the **signing certificate's** SHA-256
  (from our keystore).

**Important install behaviour:** Android checks asset links **at install time**
and caches the result. So after the file is live you must **uninstall and
reinstall** the APK for the bar to disappear.

---

## 8. Build your OWN PWA builder

PWABuilder isn't magic — you can replicate it. Two routes:

### Route A — TWA generator (what PWABuilder/Bubblewrap do)
A program that produces a TWA APK from a manifest URL. Pipeline:

1. **Fetch & parse** the target `manifest.webmanifest`.
2. Keep a **templated Android Gradle project** containing:
   - a `LauncherActivity` extending the **`androidbrowserhelper`** TWA launcher,
   - `AndroidManifest.xml` with placeholders for package id / host / colors,
   - `build.gradle` depending on `com.google.androidbrowserhelper`.
3. **Fill placeholders**: package id (e.g. reverse-domain), app name, host,
   start path, status-bar/splash colors.
4. **Download manifest icons** and generate per-density **mipmaps** + an
   adaptive icon + splash.
5. **Build** with the Android SDK: `./gradlew assembleRelease bundleRelease`
   (uses `aapt2`, compiles, packages → `.apk`/`.aab`).
6. **Sign** with `apksigner` (or `jarsigner`) + a keystore from `keytool`,
   then `zipalign`.
7. **Emit `assetlinks.json`** from the signing cert
   (`keytool -list` / `apksigner verify --print-certs`) for the user to host.

**Tooling required:** Node (orchestration) · **JDK** (`keytool`/`jarsigner`) ·
**Android SDK** (`gradle`, `aapt2`, `apksigner`, `zipalign`) · the
`androidbrowserhelper` library. Bubblewrap is open-source — you can read or fork
it directly.

The minimum "from scratch" command-line version is literally:
```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://schoolmanagementswm.vercel.app/manifest.webmanifest
bubblewrap build           # → signed apk + aab
bubblewrap fingerprint     # → SHA-256 for assetlinks.json
```

### Route B — WebView wrapper (simpler, more control, less polished)
Build a tiny Android app whose entire job is a `WebView` that loads the URL:

```kotlin
class MainActivity : AppCompatActivity() {
  override fun onCreate(s: Bundle?) {
    super.onCreate(s)
    val web = WebView(this)
    web.settings.javaScriptEnabled = true
    web.settings.domStorageEnabled = true        // needed for login/session
    web.webViewClient = WebViewClient()          // keep navigation in-app
    web.loadUrl("https://schoolmanagementswm.vercel.app")
    setContentView(web)
  }
}
```
Plus `<uses-permission android:name="android.permission.INTERNET"/>`.

| | Route A (TWA) | Route B (WebView) |
|---|---|---|
| Engine | Real Chrome (fullscreen) | Your WebView |
| Needs the PWA manifest | Yes | No |
| Polish | High (= PWABuilder) | Medium |
| Control of the shell | Low | Total |
| Effort | One CLI + prompts | An Android Studio project |

---

## 9. App Capabilities

The "App Capabilities" PWABuilder lists are **optional manifest features**. They
mostly enhance the **browser-installed PWA** (especially desktop Chrome/Edge); a
**subset** also reaches the TWA/APK. None are required.

| Capability | Manifest key | Useful for SWM? | Reaches the APK? |
|---|---|---|---|
| **Shortcuts** | `shortcuts` | ✅ Yes — jump to Dashboard / New task / Calendar | ✅ (long-press icon) |
| **Share Target** | `share_target` | ◐ Maybe — share text/file into SWM to create a task | ✅ (intent filter) |
| **Launch Handler** | `launch_handler` | ◐ Minor — focus existing window | partial |
| **File Handlers** | `file_handlers` | ✗ Not really | desktop only |
| **Protocol Handlers** | `protocol_handlers` | ✗ No | desktop only |
| **Widgets** | `widgets` | ✗ Niche (Windows 11) | no |
| **Edge Side Panel** | `edge_side_panel` | ◐ Trivial to add | no (Edge only) |
| **Window Controls Overlay** | `display_override` | ◐ Desktop title-bar polish (needs CSS) | no |
| **Tabbed Display** | `display_override` | ✗ Experimental | no |
| **Note Taking** | `note_taking` | ✗ Irrelevant | no |

### The high-value one: Shortcuts
Add to `src/app/manifest.js`:

```js
shortcuts: [
  { name: "Dashboard",  url: "/dashboard", description: "Your overview" },
  { name: "New task",   url: "/tasks/new", description: "Create a task" },
  { name: "Calendar",   url: "/calendar",  description: "Tasks & meetings" },
],
```
Now long-pressing the app icon (Android) or right-clicking it (desktop) offers
those jump targets. Bubblewrap can also bake them into the APK.

### Share Target (receive shares into SWM)
```js
share_target: {
  action: "/tasks/new",
  method: "GET",
  params: { title: "title", text: "text", url: "url" },
},
```
Then read those query params on `/tasks/new` to pre-fill a task. (POST + files is
possible but needs a route handler and multipart parsing.)

> Reality check: for *this* app the clear win is **Shortcuts**. The rest are
> mostly desktop-PWA niceties.

---

## 10. Push / notification service

**Yes — Web Push works**, with caveats. It's built on the **Push API** + the
**service worker**, authenticated with **VAPID** keys.

### How it works
```
Browser                         Your server (Next.js)         Push service (Google/Mozilla)
   │  permission granted             │                              │
   │  PushManager.subscribe(VAPID) ──┤                              │
   │  → PushSubscription ────────────►  store in MongoDB            │
   │                                 │                              │
   │                                 │  web-push.sendNotification ──►  delivers
   │  SW 'push' event  ◄─────────────┼──────────────────────────────┘
   │  showNotification(...)          │
```

### To add it to this project
1. **Generate VAPID keys** (one-time): `npx web-push generate-vapid-keys`
   → put in env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
2. **Client**: request permission, `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`,
   send the subscription to an API route.
3. **Store** subscriptions in MongoDB (a `pushSubscriptions` collection keyed by
   user id) — mirrors how the app already stores data.
4. **Server**: a route/action using the `web-push` npm package to send.
5. **Service worker** — add handlers to `public/sw.js`:

```js
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || "SWM", {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/dashboard" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

### Caveats
- **HTTPS only** + a registered service worker (we have both).
- **iOS**: web push works **only when the PWA is installed** to the home screen
  (iOS 16.4+). Safari tabs don't get push.
- **Android TWA/APK**: web notifications work via **notification delegation** —
  Bubblewrap must enable it (`enableNotifications: true`) and the app needs the
  `POST_NOTIFICATIONS` permission (Android 13+). If you regenerate the APK with
  PWABuilder, turn notifications on there.
- It fits **alongside** the existing Gmail email notifications — push for instant,
  email for durable.

This is a real feature with real plumbing (keys, a DB collection, server send
logic). Happy to implement it as a follow-up.

---

## 11. The Vercel deploy gotcha

During this work we hit a recurring issue: **commits pushed to GitHub did not
auto-deploy to Vercel.** Each time, the live site only updated after a **manual
redeploy** in the Vercel dashboard.

Symptoms: a file is committed on `origin/main` (verified), but the live URL still
404s / serves the old version (verified with cache-busted fetches).

Fix / checklist:
- **Vercel → Project → Deployments**: is there a build for the latest commit? Is
  it **Ready**, **Building**, or **Error**?
- **Manual redeploy**: top deployment → **⋯ → Redeploy**.
- **Settings → Git**: confirm it's connected to `shresthwithouta/school`,
  Production Branch = `main`, and that the GitHub integration is active.
- If builds **Error**, read the log (often a missing env var like `MONGODB_URI`).

> Current outstanding step: the fullscreen `assetlinks.json` (commit `4ecee78`)
> is on GitHub but needs a Vercel redeploy to go live. After it's live,
> **uninstall + reinstall** the APK.

---

## 12. Troubleshooting / FAQ

**The APK won't install ("App not installed" / "invalid package").**
It's the **unsigned** file. Use the **signed** one
(`SWM-aligned-signed.apk`), not `SWM-unsigned.apk`.

**The app opens but shows a URL bar at the top.**
Asset-link verification hasn't passed. Make `assetlinks.json` live on the domain
with the correct `package_name` + SHA-256, then **uninstall + reinstall** the app
(Android caches the verification at install time). See §7.

**PWABuilder says "did not find a Service Worker."**
Cosmetic for our purposes. The SW **is live** (`/sw.js` returns 200). PWABuilder's
scanner can miss a service worker that's registered client-side after load. It
does **not** affect the APK — TWAs don't use your service worker. (The SW matters
only for the *browser-installed* PWA and offline.)

**Manifest score is 19/45.**
Those are **optional** fields (description, screenshots, categories, shortcuts,
etc.). Not required to package. Add `shortcuts` and `screenshots` to raise it.

**How do I update the app later?**
Rebuild/resign the APK with the **same** `swm-release.keystore`, bump the version,
and redistribute. The site itself updates instantly on every Vercel deploy (the
APK just loads the live URL), so most "updates" need no new APK at all.

**Can it work fully offline?**
No — it's a server + database app. The APK and PWA need internet; only the
offline *fallback page* and cached static assets work offline.

---

## 13. Command reference

```bash
# Regenerate the PWA icons (pure Node, no deps)
node scripts/gen-pwa-icons.mjs

# Verify the app builds (must pass before deploy)
npm run lint && npm run build

# --- APK signing (portable JDK + uber-apk-signer) ---
# Create a signing key
keytool -genkeypair -keystore swm-release.keystore -alias swm \
        -keyalg RSA -keysize 2048 -validity 10000 \
        -storepass swm-school-2026 -keypass swm-school-2026 \
        -dname "CN=SWM, O=School, C=IN"

# Sign + zipalign an unsigned APK (v1+v2+v3)
java -jar uber-apk-signer.jar -a SWM-unsigned.apk \
     --ks swm-release.keystore --ksAlias swm \
     --ksPass swm-school-2026 --ksKeyPass swm-school-2026 -o out/

# Read the signing cert's SHA-256 (for assetlinks.json)
keytool -list -v -keystore swm-release.keystore -alias swm -storepass swm-school-2026

# --- Build your own TWA from scratch (Bubblewrap) ---
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://schoolmanagementswm.vercel.app/manifest.webmanifest
bubblewrap build
bubblewrap fingerprint

# --- Push notifications setup ---
npx web-push generate-vapid-keys
```

---

## 14. Glossary

- **PWA** — Progressive Web App. A website + manifest + service worker that's
  installable and offline-aware.
- **Manifest** — JSON describing the app (name, icons, colours, display).
- **Service worker** — background JS that intercepts network requests; powers
  offline & push.
- **TWA** — Trusted Web Activity. An Android app that shows your site fullscreen
  using the device's Chrome engine.
- **Bubblewrap** — Google's open-source CLI that generates TWAs. PWABuilder wraps
  it.
- **APK / AAB** — Android Package (installable file) / Android App Bundle (upload
  format for the Play Store).
- **Signing / keystore** — the cryptographic key proving app authorship; required
  to install and to ship updates.
- **Digital Asset Links** — the `assetlinks.json` proof that an app and a domain
  belong together; removes the TWA address bar.
- **VAPID** — the key pair that authenticates your server to push services.
- **Maskable icon** — a full-bleed icon the OS can crop to any shape.

---

*Generated for the SWM project. Live site: https://schoolmanagementswm.vercel.app
· APK package id: `app.vercel.schoolmanagementswm.twa`.*
