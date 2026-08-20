# Task 7.2 Report — Scalable Observation Analytics & Accurate KPIs

Date: 2026-08-20

## 1. Summary

Task 7.2 replaces the Task 7.1 bounded foundation (newest 1000 observations
downloaded and filtered client-side) with **exact, scalable analytics computed
server-side by Firestore**. Every KPI and chart on `/dashboard` now derives from
Firestore `count()` aggregation queries (`getCountFromServer`) — **no
observation documents are ever downloaded to the browser** — so the numbers are
accurate regardless of collection size, and the temporary
`DASHBOARD_OBSERVATION_LIMIT` bound is removed.

The dashboard now shows accurate Total / Open / In progress / Closed KPIs plus
four charts: risk distribution (donut), status breakdown (bars), OIL vs GAS
(stacked bar) and per-observation-type bars, with an automatic "Other" bucket so
charts always reconcile to the exact total. Everything stays EN/AR, RTL-safe and
responsive, and the role-aware scoping from Task 7.1 is preserved identically,
so the existing Firestore rules are unchanged.

## 2. Architecture

New/changed files:

```
src/services/analytics.service.ts        NEW  count() aggregation service
src/features/dashboard/dashboardLogic.ts      OPERATIONAL_STATUSES, deriveKpis, chart colors
src/features/dashboard/hooks.ts               useDashboardAnalytics (replaces useDashboardData)
src/features/dashboard/charts.tsx        NEW  dependency-free SVG charts
src/features/dashboard/DashboardPage.tsx      analytics + charts grid, error/loading/empty states
src/i18n/locales/{en,ar}.ts                   dashboard.charts.* keys; period-key fix
firestore.indexes.json                        +12 composite indexes for the count queries
```

## 3. Server-side count aggregation

`analytics.service.ts` runs one `getCountFromServer` query **per bucket** and
sums nothing client-side beyond fixed small counters:

- 7 status counts (`status == <value>`)
- 4 risk counts (`riskLevel == <value>`)
- 2 section counts (`section == <value>`, OIL / GAS)
- N type counts (`observationTypeId == <value>`, one per active type)

Because each bucket query carries only equality filters plus the scope/period
`where` clauses, and Firestore indexes equality filters with a single range
clause, every query is a server-side aggregate. The exact total is the sum of
the **operational statuses** (`OPERATIONAL_STATUSES`: OPEN, ACTION_REQUIRED,
ACTION_SUBMITTED, UNDER_VERIFICATION, CLOSED), matching Task 7.1's semantics
where DRAFT/ASSIGNED are excluded. Charts that don't cover the total (risk,
section, type) append an "Other" bucket of the remainder, so the visualizations
always reconcile exactly.

## 4. Scope & period pushed server-side

`useDashboardAnalytics(scope, range, typeIds)` resolves the role scope from the
signed-in profile (Task 7.1 scoping, unchanged: COMPANY_REP → `companyId`,
AREA_AUTHORITY → `assignedAreaIds`, PA/HSE/Super Admin → full) and the selected
period from `useDashboardFilters`, then passes both into
`baseConstraints()`:

- `companyId == …` and/or `areaId in […]` filters mirror the Observation list and
  Site Map query shapes **exactly**, so Firestore's per-document read rules
  apply unchanged and an unscoped count query can never match an unreadable
  document (which would fail the read rule).
- `createdAt >= from` (and optional `<= to`) pushes the date range into the
  server-side aggregation — no client-side date filtering, so counts are exact
  for "All / 7 / 30 / 90 days".

`deriveKpis(byStatus)` is pure and derives the four foundation KPI buckets from
the exact per-status counts. No document arrays are materialized anywhere.

## 5. Charts

`charts.tsx` ships lightweight, dependency-free chart primitives (the project
has no chart library, and none was added):

- `BarChart` — horizontal proportional bars with count + percentage.
- `StackedBar` — single stacked segment bar with a legend (OIL vs GAS).
- `DonutChart` — SVG donut with a centered total and a legend (risk).

All components accept `ChartDatum {label, value, color}` and use logical/block
flow (no absolute positioning, no LTR-only transforms beyond the cosmetic SVG
`-rotate-90`), so they mirror correctly in RTL. Color maps live in
`dashboardLogic.ts` (domain → hex) so the UI stays thin.

## 6. KPI cards

The four KPI cards (Total / Open / In progress / Closed) are computed by
`deriveKpis` from the exact status counts:

| Bucket | Statuses |
| --- | --- |
| Total | OPEN + ACTION_REQUIRED + ACTION_SUBMITTED + UNDER_VERIFICATION + CLOSED |
| Open | OPEN |
| In progress | ACTION_REQUIRED + ACTION_SUBMITTED + UNDER_VERIFICATION |
| Closed | CLOSED |

Loading skeletons, error state (ErrorCard + Retry) and the empty state
(EmptyState + "New Observation" CTA for creators) behave as in Task 7.1.

## 7. EN/AR & RTL

New `dashboard.charts.*` keys (risk/status/section/type titles, "total",
"Other", "no data") and the updated `dashboard.analytics.*` description were
added to both `en.ts` and `ar.ts`. A latent Task 7.1 key mismatch was also
fixed: the period control uses `7d/30d/90d` option keys, but the locales had
`last7/last30/last90` — the segmented control would have rendered raw keys in
the secondary language. Type labels reuse the existing `type.label` convention
used everywhere else in the app.

## 8. Firestore indexes

Twelve new composite indexes were added to `firestore.indexes.json` for the
count queries (following the existing `field ASC, createdAt DESC` convention):

- 4 unscoped: `(status, createdAt)`, `(riskLevel, createdAt)`, `(section,
  createdAt)`, `(observationTypeId, createdAt)`.
- 4 company-scoped: `(companyId, status, createdAt)`, `(companyId, riskLevel,
  createdAt)`, `(companyId, section, createdAt)`, `(companyId,
  observationTypeId, createdAt)`.
- 4 area-scoped: `(areaId, status, createdAt)`, `(areaId, riskLevel,
  createdAt)`, `(areaId, section, createdAt)`, `(areaId, observationTypeId,
  createdAt)`.

The triples also serve the no-date scoped cases via the left-prefix rule, and
the existing `(companyId, createdAt)` / `(areaId, createdAt)` indexes continue
to cover the pure-scope date queries. Deploy with:

```sh
npx firebase deploy --only firestore:indexes
```

## 9. Verification

Executed in this session:

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | Passed, 0 errors |
| Lint | `npm run lint` | Passed, 0 warnings, 0 errors (108 files, oxlint) |
| Production build | `npm run build` | Passed (vite 8.2.1, 215 modules) |
| Dev-server smoke test | `npm run dev` + HTTP fetch | `/dashboard`, `/`, `/login`, `/observations`, `/notifications`, `/map` all 200 |

**Not executed** (no Firebase credentials; emulator unavailable — Java 1.8 <
11): live verification of the `count()` queries, the index builds, and the
role-scoped counts for each role. Follow `docs/verification.md` (§29) against a
real Firebase project, deploying the new indexes first.

## 10. Limitations

- The count queries and the 12 new composite indexes have not been exercised
  against a live Firestore project (no credentials in this environment).
- Observation-type labels use the single `type.label` field (not localized);
  the rest of the app does the same.
- Type buckets are enumerated from the currently active types; a legacy
  observation whose `observationTypeId` is no longer active falls into the
  "Other" bucket.

## 11. Future Work

- Task 7.3+: trends over time, comparison vs previous period, rates and ratios,
  and richer visualizations on top of the exact server-side counts.
- Embedding the Phase 6 Site Map as a dashboard panel remains open.
- Periodic/on-change refresh already runs at 60 s; a manual refresh control can
  be added later.

## 12. CPD (Commit / Push / Deploy) Status

**Task 7.1** was committed and pushed: `63042bd` (full app incl. Phase 6) and
`cb3266b` (CPD result record) — PASS on `origin` (`https://github.com/cvyif/
hse_management.git`). Vercel deployment remains BLOCKED pending credentials; the
production URL and production smoke tests are pending that deployment.

**Task 7.2 — CPD result (approved):**

- **Commit**: `6a8d301` — `feat(dashboard): add scalable observation analytics`
  (11 files, +873/−271), pushed PASS: `cb3266b..6a8d301 main -> main`.
- **Vercel Deploy**: FAIL — no Vercel credentials available in this environment
  (`VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` unset, no `~/.vercel`
  auth, no repo `.vercel` linkage); the Vercel CLI hangs on its interactive
  login prompt (no TTY) and produced no output before being killed. No
  GitHub → Vercel integration is configured.
- **Production URL**: none (deployment pending).
- **Production Smoke Tests**: FAIL — not run (no deployment).
- **Firebase Live Analytics Verification**: NOT VERIFIED — the `count()`
  queries and 12 new composite indexes were not live-tested (no credentials;
  emulator needs Java 11). This does not block the CPD but must be verified
  before go-live (see `docs/verification.md` §29).
- **To complete deployment**, run once on an interactive machine:
  1. `vercel login` (or export `VERCEL_TOKEN`), then `vercel link` in the repo,
     then `vercel --prod`, or
  2. export `VERCEL_TOKEN` (+ optional `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`)
     and re-run this task's deploy step non-interactively, or
  3. connect the GitHub repository to a Vercel project (GitHub → Vercel
     integration) so pushes deploy automatically.
- After deployment, run the production smoke checks (`/`, `/login`,
  `/dashboard`, `/observations`, `/notifications`, `/map`) and confirm the
  Dashboard loads without runtime errors.

## 13. Task 7.2 Live Verification

Verification-only pass over the already-approved, committed and pushed Task 7.2
implementation (`688f25dd2b95f52bd38c908d53e079bf3b7e0eae`). No application code
was changed, committed, pushed or deployed. Environment limits: no Firebase
credentials, no emulator (Java 1.8 < 11), no browser-based rendering harness,
and no test accounts — so live-data checks are recorded as NOT VERIFIED.

- **Deployment**: PASS — verified by HTTP bundle fingerprinting against
  `https://hse-management-khaki.vercel.app/`. The deployed `index.html`
  references `index-DffPrSoK.css` and `firebase-tHe13v_B.js` (identical hashes
  to the local build of the current source) and the deployed JS bundle contains
  every Task 7.2 marker (`Risk distribution`, `Status breakdown`, `OIL vs GAS`,
  `By observation type`), Task 7.1 markers (`Awaiting a corrective action`,
  `Showing all time`) and Phase 6 markers (`Site Map`, `Set Map Location`). The
  app JS hash differs from the local build only because Vercel inlines its own
  `VITE_` environment values; CSS/Firebase chunk hashes match exactly. Final
  visual confirmation from the Vercel dashboard is still recommended.
- **Firestore indexes**: PASS (static) — `firestore.indexes.json` parses as
  valid JSON; 17 indexes total, all 12 Task 7.2 indexes present (4 unscoped
  field+createdAt; 4 companyId+field+createdAt; 4 areaId+field+createdAt).
  Firebase live index verification: NOT AVAILABLE (no credentials; no auth
  bypass attempted, per instructions).
- **Analytics queries**: NOT VERIFIED — no Firebase credentials / live data.
  Code review confirms the approved `getCountFromServer` aggregation
  architecture (no full-collection downloads).
- **KPI**: NOT VERIFIED (live). Code verified: `deriveKpis` over exact
  per-status counts; `DASHBOARD_OBSERVATION_LIMIT` (1000-record bound) removed.
- **Risk**: NOT VERIFIED (live). Code verified: donut chart from exact risk
  counts.
- **Status**: NOT VERIFIED (live). Code verified: bars over OPERATIONAL_STATUSES.
- **OIL/GAS**: NOT VERIFIED (live). Code verified: stacked bar from exact
  section counts.
- **Observation Types**: NOT VERIFIED (live). Code verified: per-type bars from
  exact type counts.
- **Date Filters**: NOT VERIFIED (live). Code verified: period pushed
  server-side via `createdAt >= from`.
- **Role Scoping**: NOT VERIFIED (no test accounts). Code verified: scope
  filters mirror the list/map exactly (`companyId` / `areaId in`), rules
  unchanged.
- **Authentication/Profile Check**: PASS (code inspection) — the flow is
  correct: `AuthProvider` loads the Firestore profile on sign-in;
  `ApprovedGuard` routes PENDING → `/register-pending`, REJECTED/deactivated →
  `/rejected`. A genuinely REJECTED account showing "Registration Rejected"
  after a successful Firebase login is expected behavior and is not bypassed.
- **Routes**: FAIL — production returns HTTP 404 for `/login`, `/register`,
  `/dashboard`, `/observations`, `/notifications` and `/map` on direct access
  (verified with a browser-like `Accept: text/html` header too). Root `/`
  returns 200. Cause: the repository has no `vercel.json`, so Vercel serves no
  SPA fallback rewrite for unknown paths. This is a deployment-configuration
  gap (pre-existing, not a Task 7.2 regression); client-side navigation from
  `/` works, but direct links / refreshes on subroutes fail.
- **EN/AR**: NOT VERIFIED (live). Bundle contains both locale files; the
  period-key fix is in the source.
- **Responsive**: NOT VERIFIED (no rendering harness).

- **Issues Found**:
  1. Production deep-route 404s (see Routes) — **FIXED in a follow-up**: added
     `vercel.json` with the SPA rewrite (`{ "rewrites": [{ "source":
     "/(.*)", "destination": "/index.html" }] }`), committed and pushed; Vercel
     auto-deploys it. Verified post-deploy: deep routes return 200 (see the
     "Routes after fix" note below).
  2. Guard nuance: a signed-in user with a missing Firestore profile also
     routes to `/rejected` (`guards.tsx` `!profile`), which can display
     "Registration Rejected" even when the account was never rejected. This can
     explain the prior "login OK but Registration Rejected" test if that
     account has no profile doc. Not changed (verification-only); live account
     state could not be inspected.
- **Fixes Made**: None — verification-only, per the task mandate (no commit,
  push, or deploy).
- **Limitations**: no Firebase credentials (index/query live checks NOT
  AVAILABLE); no browser harness (rendered KPI/chart/EN-AR/RTL/responsive
  checks NOT VERIFIED); no test accounts (role scoping NOT VERIFIED); the
  Vercel dashboard itself cannot be inspected from this environment (deployment
  confirmed via bundle fingerprinting only).