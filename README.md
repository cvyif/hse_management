# HSE Management System

Web-based HSE (Health, Safety & Environment) Management System for an oil & gas
station: a centralized platform for recording, tracking, verifying and reporting
HSE Observations and their Corrective Actions.

Built with React 19, TypeScript, Vite, Tailwind CSS v4 and Firebase
(Authentication, Firestore, Cloud Storage).

## Status

- **Phase 1 — Foundation & Architecture**: complete.
- **Phase 2 — Firebase Integration & Super Admin Management**: complete.
- **Phase 3 — Observation Creation & Basic Lifecycle**: complete.
- **Phase 4 — Corrective Action Management & HSE Verification**: complete.
- **Phase 5 — Notifications & Notification Center**: complete.
- **Phase 6 — Site Map & Observation Map**: complete.
- **Phase 7 — Dashboard & Analytics (Task 7.1 — Dashboard Foundation)**: complete.
- **Phase 7 — Dashboard & Analytics (Task 7.2 — Scalable Observation Analytics & Accurate KPIs)**: complete.
- **Phase 7 — Dashboard & Analytics (Task 7.3 — Company & Area Performance)**: complete.
- **Phase 7 — Dashboard & Analytics (Task 7.4 — Dashboard Trends & Time Analytics)**: implemented, awaiting approval (not yet pushed/deployed).
  See `REPORT.md` for the detailed Task 7.1/7.2/7.3/7.4 reports and the roadmap.

Phase 3 adds the Observation workflow: a 6-step New Observation wizard
(company, area with auto-derived section, permit, details, evidence, review),
database-driven Observation Types, sequential `OBS-YYYY-NNNNN` IDs, DRAFT →
OPEN submission with evidence upload to Storage, and list/detail pages with
filters, security rules and audit trail.

Phase 4 adds the Corrective Action lifecycle and HSE verification: HSE
verifiers request a corrective action (OPEN → ACTION_REQUIRED), the responsible
Company Representative submits it with evidence (ACTION_REQUIRED →
ACTION_SUBMITTED), HSE verifies (ACTION_SUBMITTED → UNDER_VERIFICATION) and
accepts (→ CLOSED) or returns it for correction (→ ACTION_REQUIRED). Company
Representatives are scoped to their own company's observations, actions and
uploads; the workflow, RBAC, security rules, storage rules and audit trail are
all enforced end to end. Notifications, map, dashboard analytics and reports
remain later phases.

Phase 5 adds an event-driven, in-app Notification Center: when an Observation is
submitted or closed, or a Corrective Action is requested / submitted / returned
/ accepted, a `notifications` document is fanned out to the right recipients
(HSE staff, currently-active Area Authorities per rotation, the responsible
company's Representatives, HSE reviewers) using dedupe-keyed document ids that
make retries idempotent. A topbar bell with unread badge and a `/notifications`
page (All / Unread / Read, infinite scroll, read/unread/mark-all) surface the
events; Firestore rules re-validate every notification against committed
entity state, and four new composite indexes back the queries. Email delivery
remains a later phase (no server runtime). Map, dashboard analytics and reports
also remain later phases.

Phase 6 adds the **Site Map** (`/map`): a fixed-image viewer with zoom/pan and
Area markers (real Area numbers, OIL/GAS coloring) plus Observation markers that
inherit their Area's map position and are colored by risk level. Filters
(section/area/risk/status/company/type), a legend, role-scoped visibility
(Company Representatives and Area Authorities see exactly what the Observation
list allows), and a List ↔ Map switch complement the existing list. Super Admin
positions Areas visually via **Admin → Areas → Set Map Location**
(`/admin/areas/:id/map`), saving normalized 0..1 coordinates on the existing
Area record.

### Site Map asset & Area positions

The Site Map image is a static public asset in `public/maps/`. A labelled
placeholder (`site-map.svg`) ships; to go live, replace it with the station map
(any image format) and update `SITE_MAP_IMAGE_URL` in `src/config/map.ts`.

Area positions are **not pre-set** — the map shows only areas the Super Admin
has positioned. Use the position editor (Admin → Areas → Set Map Location) to
place each area on the map; positions are stored as normalized 0..1 coordinates
on the Area record and stay correct at any screen size or zoom level.

Task 7.1 builds the **Dashboard foundation** (`/dashboard`): a page shell with
a dedicated header (title, today's date, role badge, visible data-scope label),
a date/filter foundation (All / 7 / 30 / 90 days) and a reusable KPI card
architecture with loading, error and empty states. Role-aware scoping reuses
the Observation list/map scoping exactly (Company Rep → company only, Area
Authority → assigned areas only), so every role sees only its authorized data.
Analytics, trends and charts are intentionally **not** implemented yet — Tasks
7.2–7.6 extend this foundation.

Task 7.2 delivers **scalable, exact analytics** on that foundation. Every KPI
and chart now comes from Firestore server-side `count()` aggregation
(`getCountFromServer`) — no observation documents are downloaded to the
browser, so counts are exact at any collection size and the previous
newest-1000 bound is gone. The selected period is pushed into those queries
and role scoping is applied identically to the list/map (Company Rep → company
only, Area Authority → assigned areas only), so the existing security rules
are unchanged. The dashboard now shows Total / Open / In progress / Closed
KPIs plus four charts: risk distribution (donut), status breakdown (bars),
OIL vs GAS (stacked bar) and per-observation-type bars, all rendered with
dependency-free RTL-safe SVG components and localized EN/AR. Twelve new
composite indexes back the count queries — deploy them before go-live:

```sh
npx firebase deploy --only firestore:indexes
```

Task 7.3 adds **Company Performance** and **Area Performance** tables on the
same server-side count() architecture: per company and per area rows for Total,
Open, Action Required, Under Verification, Closed, High Risk and Critical,
sorted by Total and linking into `/observations?company=<id>` /
`?area=<id>`. Role scoping is applied in the queries themselves (Company Rep →
own company only, Area Authority → assigned areas only), the dashboard
date-period filter drives both tables, and four additional composite indexes
cover the cross-scoped queries (deployed by the same command above).

Task 7.4 adds **Observation Trends** — a time-series section on the same
server-side count() architecture. It shows how operational observations change
over the selected period (Daily/Weekly/Monthly granularity, auto-selected and
switchable), a neutral previous-period comparison, and status, risk and OIL/GAS
trends — all role-scoped, RTL-safe, responsive and free of observation
downloads. Buckets are capped and batched so the aggregation stays bounded, and
every query reuses the existing indexes (no new index deploy needed).

## Getting started

Prerequisites: Node.js ≥ 20, npm, and (recommended) the Firebase CLI.

```sh
npm install
```

### Configure Firebase

1. Create a Firebase project and a web app in the [Firebase Console](https://console.firebase.google.com).
2. Copy `.env.example` to `.env` and fill in the values.
3. Deploy the security rules:

```sh
npx firebase deploy --only firestore:rules,storage:rules
```

### Create the first Super Admin

SUPER_ADMIN is never assignable through the UI. The only supported way is the
out-of-band bootstrap script, which uses the Firebase Admin SDK with a service
account:

```sh
# 1. Register normally in the app, or create the account with a password here:
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
  node scripts/bootstrap-super-admin.mjs --email admin@example.com --password "..."

# 2. If the auth user already exists, promotion is enough:
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
  node scripts/bootstrap-super-admin.mjs --email admin@example.com
```

See `scripts/bootstrap-super-admin.mjs` for full usage. Never put the service
account in Vercel client-side environment variables.

### Seed Observation Types

The Observation Types are database-driven. Seed the initial types and the
Observation ID counter once (needs the same service account):

```sh
# GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm run seed:observations
```

The script is idempotent — it never overwrites existing types or the counter.

### Local development

```sh
npm run dev
```

For local development against the Firebase emulators:

1. Copy `.env.example` to `.env`, set the Firebase fields, then enable
   `VITE_USE_FIREBASE_EMULATORS=true`.
2. Start the emulators:

```sh
npx firebase emulators:start
```

### Build, type-check and lint

```sh
npm run build       # type-check + production build
npm run typecheck   # TypeScript only
npm run lint        # oxlint
```

## Vercel deployment

The app is a standard static Vite build and deploys to Vercel as-is. Set these
environment variables in the Vercel project (Settings → Environment Variables),
with the same values as your `.env`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Only `VITE_`-prefixed variables reach the client bundle. Do not add
service-account keys or `GOOGLE_APPLICATION_CREDENTIALS` on Vercel.

## Project structure

```
src/
  app/          Router and app-level providers
  components/   Reusable UI components (ui/ primitives)
  config/       Environment + Firebase client initialization
  features/     Feature modules (auth, admin, layout, dashboard, error, …)
  i18n/         i18next setup and locales (en, ar)
  lib/          Pure logic (permissions, workflow, rotations, utils)
  services/     Firebase-backed services (auth, user, company, area, …)
  stores/       Zustand state (auth session, UI preferences)
  types/        Domain model
scripts/        Super Admin bootstrap (Admin SDK)
```

## Roles

| Role | Summary |
| --- | --- |
| `SUPER_ADMIN` | Full administrative control, approves registrations |
| `HSE_MANAGER` | HSE management, areas/companies, verification |
| `HSE_OFFICER` | HSE operational duties |
| `PA` | Performing Authority, overlapping HSE capabilities |
| `AREA_AUTHORITY` | Owner of an area (per active rotation) |
| `COMPANY_REP` | Restricted to their own company |

Permissions are defined centrally in `src/lib/permissions.ts`. Firestore
security rules in `firestore.rules` are the authoritative enforcement layer.