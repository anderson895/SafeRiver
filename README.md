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
- **Bilingual** English / Tagalog throughout.

It presents and relays official information. It does **not** run a
hydrodynamic flood simulation.

---

## Architecture

```
GitHub Actions (*/30)  ->  Vercel API routes  ->  Firestore
                                              ->  Gmail SMTP (alerts)
Browser  ->  /api/* (revalidate-cached)  ->  Firestore
```

Two decisions worth knowing before changing anything:

**Scheduling is on GitHub Actions, not Vercel cron.** Vercel's Hobby plan caps
cron at once per day, which a flood alert system cannot use. A weekly keepalive
commit stops GitHub disabling the schedule after 60 days idle.

**All server logic is in Next.js route handlers, not Cloud Functions.** Cloud
Functions now require the paid Blaze plan; keeping logic on Vercel lets
Firebase stay on the free Spark tier.

The browser never queries Firestore directly for public pages — reads go
through cached API routes, so Firestore reads stay flat regardless of traffic
instead of scaling toward the free-tier ceiling.

**There are no composite Firestore indexes, deliberately.** Queries are shaped
to use automatic single-field indexes or direct document fetches. If you find
yourself adding `where` + `orderBy` on different fields, reshape the query
instead.

---

## Setup

```bash
npm install
cp .env.example .env.local     # then fill it in
npm run dev
```

`postinstall` copies MapLibre's worker into `public/maplibre/`. Turbopack
cannot resolve maplibre's own worker URL, and without the copy the map renders
blank with no error beyond a MIME-type warning in the console.

### Environment

See `.env.example`. The ones that bite:

- `FIREBASE_SERVICE_ACCOUNT_B64` — base64 the whole service-account JSON.
  Pasting raw JSON mangles the `private_key` newlines.
- `ALERTS_ENABLED` — gates **all** outbound email. With it false the rule
  engine still runs and alerts still appear on the site; only delivery stops.
- `NEXT_PUBLIC_SITE_URL` — must be the production URL in production, since
  unsubscribe links are built from it.

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Unit tests (alert engine, tokens) |
| `npm run typecheck` | TypeScript |
| `npm run gis:build` | Rebuild hazard layers from source data |
| `npm run screenshots` | Capture all pages, both languages, desktop + mobile |
| `npm run db:status` | What is currently in Firestore |
| `npm run smoke:scrape` | Run the PAGASA parser against live and fixture |
| `npm run smoke:email` | Verify SMTP credentials |
| `npm run alert:test` | Fire a synthetic alert end-to-end |
| `npm run alerts:reset` | Clear generated alerts (development only) |

---

## Testing

`npm test` covers the two modules where a bug is invisible until it matters:

- **`evaluate.ts`** — the alert state machine. A mistake here either mails
  hundreds of people repeatedly or stays silent during a real release. Covered
  by a table-driven matrix plus a simulated day of polling that asserts a
  sustained condition cannot spam.
- **`tokens.ts`** — subscribe/unsubscribe token signing, expiry, purpose
  binding and tamper resistance.

The GIS pipeline verifies its own output: `npm run gis:build` fails if any
hazard geometry escapes the municipal boundary.

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
- **Alert thresholds are provisional** and pending MDRRMO validation.
- **Gmail SMTP caps at ~500/day.** The dispatcher self-limits to 400. Fine for
  an evaluation cohort, not for the whole municipality — the transport is three
  environment variables, so migrating is a config change.

---

## Licence

Code: see repository. Data: see [ATTRIBUTION.md](./ATTRIBUTION.md) — the hazard
layers carry ODbL obligations that follow any redistribution.
