# SafeRiver — San Manuel Flood Information System

Web-based flood hazard information and dam release alert system for the Agno
River communities of San Manuel, Pangasinan.

Undergraduate thesis project. **Not an official government system.**

Live: <https://safe-river-san-manuel.vercel.app>

---

## What it does

- **Interactive hazard map** — Project NOAH flood hazard at 5/25/100-year
  return periods, clipped to the municipality, with barangay boundaries.
- **Dam advisory & water level** — Ambuklao, Binga and San Roque, scraped from
  the PAGASA daily bulletin. San Roque sits in San Manuel itself; the two
  upstream dams feed it, so their releases are a leading indicator here.
- **Rainfall** — hourly forecast from Open-Meteo, rain radar, Agno River
  discharge from GloFAS, all against PAGASA's rainfall warning scale.
- **Email alerts** — rule engine with deduplication, double opt-in
  subscription, one-click unsubscribe.
- **Admin console** — post a manual advisory for a gate release, with live
  system health.
- **Bilingual** English / Tagalog throughout.

It presents and relays official information. It does **not** run a
hydrodynamic flood simulation.

---

## Stack

Versions are those actually installed, not the latest available. Several differ
from what the tutorials assume — see the notes, they are where the time goes.

### Framework and language

| Package | Version | Why |
|---|---|---|
| `next` | 16.3.1 | App Router, Turbopack. Route handlers host all server logic |
| `react` / `react-dom` | 19.2.8 | |
| `typescript` | ^5 | Strict. `npm run typecheck` must pass before pushing |

> **Next 16, not 15.** Import `AppRouterCacheProvider` from
> `@mui/material-nextjs/v16-appRouter`. The `v15` path exists and compiles, but
> is wrong here.

### UI

| Package | Version | Why |
|---|---|---|
| `@mui/material` | ^9.3.1 | Component library |
| `@mui/icons-material` | ^9.3.1 | |
| `@mui/material-nextjs` | ^9.3.0 | SSR cache provider; without it every navigation flashes unstyled |
| `@mui/x-charts` | ^9.11.1 | MIT. `ChartsReferenceLine` draws the dashed threshold lines |
| `@emotion/react`, `@emotion/styled` | ^11 | MUI's style engine |

> **MUI v9 removed bare system props on `Stack`.** `justifyContent`,
> `alignItems` and `flexWrap` must go inside `sx`. Passing them directly is a
> type error that fails the Vercel build but not always local dev.

### Map

| Package | Version | Why |
|---|---|---|
| `maplibre-gl` | ^6.4.1 | GPU rendering, data-driven styling |
| `react-map-gl` | ^8.1.2 | React bindings (`react-map-gl/maplibre`) |
| `mapshaper` | ^0.7.54 (dev) | GIS pipeline. Pure Node — runs natively on Windows |

> **No PMTiles, no tippecanoe, no WSL, no Docker.** Measured: the finished
> layers are 1.6 MB on disk and ~154 KB gzipped over the wire, far below where
> vector tiles earn their complexity. MapLibre tiles the GeoJSON client-side.
>
> **MapLibre's worker is vendored at install time.** Turbopack cannot resolve
> `new Worker(url, { type: 'module' })` and silently returns an HTML shell, so
> the map renders blank with nothing in the console but a MIME-type warning.
> `scripts/copy-maplibre-worker.mjs` runs on `postinstall`, `predev` and
> `prebuild` to copy it into `public/maplibre/`, which is gitignored on purpose
> — a committed copy would drift from the installed version.

### Data and backend

| Package | Version | Why |
|---|---|---|
| `firebase-admin` | ^14.3.0 | Server-side Firestore and Auth |
| `firebase` | ^12.18.0 | Client SDK — used **only** in `/admin` |
| `cheerio` | ^1.2.0 | Parses the PAGASA bulletin HTML |
| `zod` | ^4.4.3 | Validates every scraped and posted payload |
| `nodemailer` | ^9.0.5 | Gmail SMTP transport |
| `date-fns` | ^4.4.0 | |
| `server-only` | ^0.0.1 | Compile-time guard on server modules |

### Tooling

| Package | Version | Why |
|---|---|---|
| `vitest` | ^4.1.11 | 82 tests |
| `playwright` | ^1.62.1 | Documentation screenshots |
| `tsx` | ^4.23.12 | Runs the TypeScript scripts in `scripts/` |
| `eslint` + `eslint-config-next` | ^9 / 16.3.1 | |

### Services (all free tier)

| Service | Used for | Limit that matters |
|---|---|---|
| **Vercel Hobby** | Hosting, API routes | Cron capped at **once per day** — unusable for alerting |
| **Firebase Spark** | Firestore, Auth | No credit card. Cloud Functions need paid Blaze, so none are used |
| **GitHub Actions** | Scheduler, every 30 min | Free on public repos. Auto-disables after 60 days idle |
| **Gmail SMTP** | Alert delivery | ~500 recipients/24h; dispatcher self-limits to 400 |
| **OpenFreeMap** | Base map tiles | No key, no registration, no request cap |
| **Open-Meteo** | Rainfall + GloFAS discharge | No key |
| **RainViewer** | Rain radar | No key. Serves radar only to zoom 7 |

---

## Architecture

```
GitHub Actions (*/30)  ->  Vercel API routes  ->  Firestore
                                              ->  Gmail SMTP (alerts)
Browser  ->  /api/* (revalidate-cached)  ->  Firestore
```

Four decisions worth knowing before changing anything:

**Scheduling is on GitHub Actions, not Vercel cron.** Vercel's Hobby plan caps
cron at once per day, which a flood alert system cannot use. A weekly keepalive
commit stops GitHub disabling the schedule after 60 days idle.

**All server logic is in Next.js route handlers, not Cloud Functions.** Cloud
Functions now require the paid Blaze plan; keeping logic on Vercel lets
Firebase stay on the free Spark tier.

**The browser never queries Firestore directly for public pages.** Reads go
through cached API routes, so Firestore reads stay flat regardless of traffic
instead of scaling toward the free-tier ceiling.

**There are no composite Firestore indexes, deliberately.** Queries are shaped
to use automatic single-field indexes or direct document fetches. If you find
yourself adding `where` + `orderBy` on different fields, reshape the query
instead.

---

## Setup

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | **22.x** | Pinned in `engines`. Not optional — see below |
| npm | 10+ | Verified on 11.4.2 |
| Git | any | |
| Python | 3.9+ | **Only** for `npm run docs:docx`. Not needed to run the app |

> **Node 22 is a hard requirement, and the reason is not obvious.**
>
> `firebase-admin` → `jwks-rsa` → `jose@6`, and `jose@6` is ESM-only while
> `jwks-rsa` is CommonJS and `require()`s it. Node 22 permits `require()` of an
> ES module; Node 20 throws `ERR_REQUIRE_ESM`.
>
> The failure is invisible in development. It takes down the whole
> `firebase-admin/auth` module, so every admin route returns **500 with an empty
> body** — no message, no stack — while every public route keeps working,
> because only the admin path touches Auth. `engines` pins it so Vercel matches
> what you develop against.

A Google account is required for Firebase, and a second (or the same) with
2-Step Verification enabled for Gmail SMTP.

### 1. Install

```bash
git clone <repo-url>
cd DranaCyelTolentino
npm install
```

`postinstall` copies the MapLibre worker into `public/maplibre/`. If the map is
ever blank, run `node scripts/copy-maplibre-worker.mjs` and reload.

### 2. Create the Firebase project

1. <https://console.firebase.google.com> → **Add project**. Disable Google
   Analytics; nothing here uses it.
2. **Build → Firestore Database → Create database.** Production mode,
   region `asia-southeast1`.
3. **Build → Authentication → Get started → Email/Password → Enable.**
   Leave "Email link" off.
4. **Project settings → General → Your apps → Web (`</>`)**. Register the app
   and copy the `firebaseConfig` values into the `NEXT_PUBLIC_FIREBASE_*`
   variables in step 5.
5. **Project settings → Service accounts → Generate new private key.** This
   downloads a JSON file. Keep it out of the repo.

Base64 the service account — the raw JSON does not survive being pasted into an
environment variable, because its `private_key` contains literal newlines:

```powershell
# PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("serviceAccount.json"))
```

```bash
# bash
base64 -w0 serviceAccount.json
```

### 3. Create the Gmail App Password

`SMTP_PASS` is **not** your Google password. It will not work.

1. Google Account → **Security** → enable **2-Step Verification** (required).
2. Search settings for **App passwords** → create one, name it anything.
3. Copy the 16-character value into `SMTP_PASS`.

### 4. Generate the two secrets

```powershell
# PowerShell — run twice, once for CRON_SECRET and once for TOKEN_SECRET
-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
```

```bash
# bash
openssl rand -hex 32
```

`TOKEN_SECRET` signs subscribe and unsubscribe links. Changing it later
invalidates every link already sent.

### 5. Fill in the environment

```bash
cp .env.example .env.local
```

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | From step 2.4. Public — these ship in the browser bundle |
| `FIREBASE_SERVICE_ACCOUNT_B64` | From step 2.5. **Secret** |
| `FIREBASE_PROJECT_ID` | Same project id |
| `CRON_SECRET` | From step 4. Guards every `/api/cron/*` route |
| `TOKEN_SECRET` | From step 4 |
| `SMTP_USER` / `SMTP_PASS` | Gmail address and the App Password from step 3 |
| `MAIL_FROM_ADDRESS` | Usually the same Gmail address |
| `ADMIN_ALERT_EMAIL` | Where scraper-failure notices go |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally. **Must** be the real URL in production — unsubscribe links are built from it |
| `ALERTS_ENABLED` | Keep `false` until you mean to send real mail |

`.env.local` is gitignored. `.env.example` is committed and holds no secrets.

### 6. Deploy the Firestore security rules

The rules deny all client writes and make `adminUsers` server-only, so
privilege cannot be self-granted from a browser.

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project <your-project-id>
```

### 7. Run it

```bash
npm run dev
```

<http://localhost:3000>. The public pages work immediately — the hazard layers
in `public/geo/` are committed, so no GIS build is needed. Dam and rainfall
data appear once you populate them in step 8.

### 8. Populate data

Firestore starts empty, so the dam and rainfall pages read "no data" until the
pollers have run at least once. With `npm run dev` still running, in a second
terminal:

```bash
npm run poll           # same endpoints GitHub Actions calls every 30 min
npm run db:status      # confirm documents landed
```

PAGASA publishes the dam bulletin once daily around 08:00, so one run is enough
to fill every dam page. Charts gain a point per day from then on.

To exercise the alert and email path without waiting for the river:

```bash
npm run alert:test     # fires a SYNTHETIC reading, then drains the queue
```

### 9. Create an administrator

Authentication and authorisation are separate on purpose: an account existing
in Firebase Auth grants nothing. Authority comes from a document in
`adminUsers`, which no browser can write.

```bash
npm run admin:create -- you@example.com <password> SUPER_ADMIN
npm run admin:list
```

Then sign in at <http://localhost:3000/admin>.

> Pass the role as a **bare word**, not `--role SUPER_ADMIN`. npm parses
> unrecognised `--flags` as its own config and strips them before the script
> runs, which silently downgrades the grant to the default role.

### 10. Verify the setup

```bash
npm test               # 82 tests
npm run typecheck
npm run smoke:scrape   # PAGASA parser against the live page
npm run smoke:email    # SMTP credentials only, sends nothing
npm run db:status
```

---

## Deployment

### Vercel

1. Import the repository at <https://vercel.com/new>.
1. **Settings → Build and Deployment → Node.js Version → 22.x.** (Not under
   *General* — it moved.) `engines` in `package.json` should carry this, but an
   existing project keeps the version it was created with until the setting is
   changed or a deployment re-reads `engines`. On Node 20 the admin console
   returns an empty 500.
2. **Settings → Environment Variables** — add every variable from `.env.local`,
   with two changes:
   - `NEXT_PUBLIC_SITE_URL` = your production URL
   - `ALERTS_ENABLED` = `true`, or **no email will ever send**
3. Deploy. Pushing to `main` redeploys automatically.

### GitHub Actions

**Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `VERCEL_APP_URL` | `https://<your-app>.vercel.app`, no trailing slash |
| `CRON_SECRET` | Identical to the Vercel value |

`.github/workflows/poll.yml` then runs every 30 minutes: scrape dams, poll
rainfall, drain the email queue. `keepalive.yml` commits weekly so GitHub does
not disable the schedule after 60 days idle.

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Unit tests |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run gis:build` | Rebuild hazard layers from source (needs `data/raw/`) |
| `npm run screenshots` | Capture all pages, both languages, desktop + mobile |
| `npm run docs:docx` | Build `documentation.docx` from `DOCUMENTATION.md` |
| `npm run poll` | Run the dam + rainfall pollers once, now |
| `npm run db:status` | What is currently in Firestore |
| `npm run smoke:scrape` | PAGASA parser against live and fixture |
| `npm run smoke:email` | Verify SMTP credentials |
| `npm run alert:test` | Fire a synthetic alert end-to-end |
| `npm run alerts:send` | Send whatever is queued (production does this on cron) |
| `npm run alerts:reset` | Clear alerts, dedup state and queue (development only) |
| `npm run admin:create -- email password ROLE` | Create the Auth account **and** grant |
| `npm run admin:grant -- email ROLE` | Grant to an existing account |
| `npm run admin:password -- email password` | Reset a password |
| `npm run admin:list` / `admin:revoke` | List / revoke administrators |

Roles: `SUPER_ADMIN`, `DRRM_OFFICER`, `VIEWER`.

---

## Testing

`npm test` covers the modules where a bug is invisible until it matters:

- **`evaluate.ts`** — the alert state machine. A mistake here either mails
  hundreds of people repeatedly or stays silent during a real release. Covered
  by a table-driven matrix plus a simulated day of polling that asserts a
  sustained condition cannot spam.
- **`tokens.ts`** — subscribe/unsubscribe token signing, expiry, purpose
  binding and tamper resistance.
- **`openMeteo.ts`** — every rainfall band pinned to mm/hr.
- **`lang.ts`** — bilingual fallback. An untranslated field must render English,
  not a blank warning.

The GIS pipeline verifies its own output: `npm run gis:build` fails if any
hazard geometry escapes the municipal boundary.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Map renders blank, only a MIME warning | MapLibre worker missing. `node scripts/copy-maplibre-worker.mjs` |
| Admin routes 500 with an **empty body**, public routes fine | Deployment is on Node 20. `jose@6` is ESM, `jwks-rsa` `require()`s it → `ERR_REQUIRE_ESM` kills `firebase-admin/auth`. Set the runtime to **22.x** |
| `The default Firebase app does not exist` | `getAuth()` called before `db()`. Pass the app: `getAuth(adminApp())` |
| `This account is not an administrator` | Auth account exists but has no `adminUsers` document. Run `admin:grant` |
| Advisory publishes but no email arrives | `ALERTS_ENABLED` is not `true`, or nothing drained the queue. `npm run alerts:send` |
| `alert missing` when draining | Orphaned jobs left by `alerts:reset`. Re-run; they clear as they are reached |
| `error:1E08010C:DECODER routines::unsupported` | Raw service-account JSON in the env var. Base64 it |
| Firestore demands a composite index | Reshape the query. This project keeps its index set empty |
| Vercel build fails, local dev fine | Usually MUI v9 system props on `Stack`. Move them into `sx` |

---

## Data sources and licensing

See [ATTRIBUTION.md](./ATTRIBUTION.md). Two obligations are legally binding:

- The flood hazard layers are **ODbL share-alike**. Derivatives must stay ODbL
  and must credit Project NOAH / UP NOAH Center.
- GADM boundaries are **non-commercial use only**.

---

## Known limitations

Measured against the delivered data, not taken from source descriptions. Stated
in full on the `/about` page.

- **Two-thirds of San Manuel has no hazard mapping.** Barangays San Roque,
  Lapalo and Narra are 0%, 3% and 1% covered. They are hatched on the map;
  blank would read as "safe".
- **Hazard mapping is 30 m resolution**, not the 1 m the upstream description
  implies. The system answers "is this area at risk", not "is this house".
- **No river gauge exists** for the Agno at San Manuel. Water levels shown are
  reservoir elevations from the dam bulletin.
- **Dam readings are published once daily**, around 08:00. A release between
  bulletins does not appear until an officer posts a manual advisory.
- **Alert thresholds are provisional** and pending MDRRMO validation.
- **Gmail SMTP caps at ~500/day.** The dispatcher self-limits to 400. Fine for
  an evaluation cohort, not for the whole municipality — the transport is three
  environment variables, so migrating is a config change.
- **`DEMO_MODE` is not implemented.** It appears in the development plan as
  defence insurance against a source being down, but no code reads it. Do not
  rely on it.

---

## Licence

Code: see repository. Data: see [ATTRIBUTION.md](./ATTRIBUTION.md) — the hazard
layers carry ODbL obligations that follow any redistribution.
