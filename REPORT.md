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

---

# Task 7.3 Report — Company & Area Performance

Date: 2026-08-21

## 1. Objective

Extend the Dashboard with **Company Performance** and **Area Performance**
sections built on the same scalable, server-side analytics architecture as
Task 7.2 (Firestore `count()` aggregation — no observation downloads, no
client-side statistics over full collections). Role scoping, the existing
dashboard date-period filter and EN/AR + RTL are preserved, and both tables
drill down into the existing Observation list.

## 2. Scope

- New `Company Performance` and `Area Performance` dashboard sections.
- Drill-down links to `/observations?company=<id>` and `/observations?area=<id>`.
- No new routes, no database redesign, no rules changes, no map changes, no
  reports/export, no new notification types.

## 3. Company Performance

`CompanyPerformanceSection` renders one row per visible company: Company name,
Total, Open, Action Required, Under Verification, Closed, High Risk, Critical.
Rows sort by Total descending (highest first). Company names link to
`/observations?company=<id>`.

## 4. Area Performance

`AreaPerformanceSection` renders one row per visible area: Area number/name
(exactly as stored, e.g. "Area 175"), Section (OIL/GAS chip), Total, Open,
Action Required, Under Verification, Closed, High Risk, Critical. Rows sort by
Total descending and link to `/observations?area=<id>`. An OIL/GAS filter
narrows the rows (presentational — each area belongs to exactly one section,
so no extra queries). Company Representatives only see areas where their own
company has observations (rows with Total > 0).

## 5. Analytics Architecture

`src/services/analytics.service.ts` gained `aggregateEntityPerformance`
(extending the Task 7.2 aggregation service):

- For each entity (company/area): a fixed set of server-side `count()`
  queries — 5 operational status buckets (`OPERATIONAL_STATUSES`, now defined
  in the service as the single source of truth) + 2 risk buckets (HIGH,
  CRITICAL). `total` is the exact sum of the 5 statuses, so it is consistent
  with the Task 7.2 KPIs (DRAFT/ASSIGNED excluded).
- Risk counts span all statuses, exactly like the Task 7.2 risk chart (a
  HIGH/CRITICAL draft is still a HIGH/CRITICAL risk) — documented for
  consistency.
- Entities are processed in batches (`PERFORMANCE_BATCH_SIZE = 8`) so at most
  ~56 count queries are in flight at once; all results are exact server-side
  aggregates. No observation documents are ever downloaded.

## 6. Query Strategy

Per entity: `7 × count()` queries (`(companyId|areaId) == id` + scope + date
window + field). The per-entity equality pins the entity id, which is always
within the role scope; the matching scope constraint on the same field is
therefore omitted (`baseConstraints(scope, window, excludeField)`), avoiding
redundant `in` + `==` on one field, while scope constraints on the *other*
field remain applied so cross-entity scoping is never weakened. Query volume is
`7 × (visible companies + visible areas)` and is bounded by the station's
entity counts; the parallel-count pattern and batching keep latency low.

## 7. Role Scoping

Enforced in the query/service layer (not merely hidden in the UI):

- **SUPER_ADMIN / HSE_MANAGER / HSE_OFFICER / PA**: full authorized scope —
  all companies and all areas (their existing HSE observation scope).
- **AREA_AUTHORITY**: only their assigned areas (per the existing
  active-assignment/rotation `assignedAreaIds`). Company counts add
  `areaId in assigned`; the area list and area counts are pinned to assigned
  areas. `__no_areas__` yields an empty section.
- **COMPANY_REP**: only their own company. The company table shows a single
  row; area counts add `companyId == <their company>` and only areas with their
  data are shown.

The `companies`/`areas` collections are metadata readable by approved users
(existing rules); the actual performance numbers are always scoped by the
count queries above.

## 8. Security

`firestore.rules` and `storage.rules` are **unchanged**. Every count query
carries the role scope (or a per-entity id that is within scope), so a count
query can never match a document the user cannot read (which would fail the
per-document read rule). No permissions are weakened, no approval gating or
company/area isolation is bypassed.

## 9. Filters

- The existing dashboard date-period filter (`DashboardFilters` /
  `useDashboardFilters`) drives both sections — the range is pushed into every
  count query, so the tables respond to All / 7 / 30 / 90 days exactly like the
  Task 7.2 analytics.
- The Area section adds a lightweight OIL/GAS filter (presentational row
  filter on `area.section`; no extra queries). The Company section has no
  section filter because companies span sections — it is cleanly omitted
  rather than half-supported.

## 10. UI

Dashboard structure now: KPI cards → Risk/Status/OIL-GAS/Type analytics →
Company Performance → Area Performance. Both sections reuse `DashboardSection`,
the `AdminTable`/`Th`/`Td`/`TRow` primitives (horizontal scroll on mobile),
`LoadingCard`, `ErrorCard` (with Retry) and `EmptyState`. A shared
`PerformanceTable` renders both tables (labelled entity column, optional
Section chip, right-aligned tabular numbers); `SectionChip` colors OIL/GAS
from the shared section palette. No new UI framework.

## 11. Responsive Behavior

`AdminTable` wraps the tables in `overflow-x-auto`, so on tablets/mobile the
tables scroll horizontally instead of overflowing the viewport. Numeric
alignment uses logical `text-end` so values mirror in RTL. The OIL/GAS control
wraps under the section title on narrow screens.

## 12. i18n

New `dashboard.performance.*` keys (section titles/descriptions, section
filter, column headers including `criticalRisk` → "Critical") and
`observation.list.filterByCompany`/`allCompanies` were added to both `en.ts`
and `ar.ts`. The section filter and OIL/GAS chip reuse the existing
`sections.*` keys. Arabic renders RTL (logical properties throughout). No
hardcoded user-facing English.

## 13. Performance

- No full-collection downloads: everything is `getCountFromServer`.
- No N+1 explosion beyond the documented bounded `7 × entities`, with batched
  parallelism (`PERFORMANCE_BATCH_SIZE`).
- Counts refresh at 60 s via the existing dashboard React Query pattern.
- The 60-second refetch reuses the exact Task 7.2 refresh approach.

## 14. Indexes

Four new composite indexes were added to `firestore.indexes.json` (all Task 7.2
single-dimension queries reuse existing indexes):

- `(areaId, companyId, status, createdAt)` and `(areaId, companyId, riskLevel,
  createdAt)` — AREA_AUTHORITY company counts.
- `(companyId, areaId, status, createdAt)` and `(companyId, areaId, riskLevel,
  createdAt)` — COMPANY_REP area counts.

Deploy before go-live with `npx firebase deploy --only firestore:indexes`
(already documented in README for the Task 7.2 indexes).

## 15. Verification

Executed in this session:

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | Passed, 0 errors |
| Lint | `npm run lint` | Passed, 0 warnings, 0 errors (112 files, oxlint) |
| Production build | `npm run build` | Passed (vite 8.2.1, 219 modules) |
| Dev-server smoke test | `npm run dev` + HTTP fetch | `/`, `/login`, `/register`, `/dashboard`, `/observations`, `/observations?company=…`, `/observations?area=…`, `/notifications`, `/map` all 200 |
| Bundle content | marker scan of `dist` | Task 7.3 EN/AR strings present (Company Performance, Area Performance, Action Required, …) |

RBAC/scoping reviewed by design (see §7): COMPANY_REP pinned to own company,
AREA_AUTHORITY pinned to assigned areas, cross-entity scope filters applied in
the count queries. **Not executed** (no Firebase credentials/emulator, no test
accounts, no browser harness): live count-query results, the four new index
builds, rendered loading/empty/error states per role, EN/AR/RTL/responsive
visual checks. Follow `docs/verification.md` (§35) against a real project.

## 16. Limitations

- Live verification pending real Firebase credentials (the four new indexes and
  the per-role count queries must be confirmed in a real project).
- Per-entity counts are exact but require 7 count queries per entity; for very
  large company/area counts this grows linearly. The smallest safe extension
  (deferred) is a denormalized per-entity counters document maintained at
  write time, or BigQuery-style external analytics.
- Risk columns span all statuses (consistent with the Task 7.2 risk chart),
  which is documented behaviour, not an error.
- Area rows are shown for all visible areas (zeros included) except for Company
  Representatives, where only areas with their data appear.

## 17. Future Work

- Map integration of company/area performance (explicitly out of scope here).
- Interactive sorting/pagination of the performance tables (currently fixed
  default sort by Total descending).
- Reports/export (PDF/Excel/CSV) and scheduled reports.
- Denormalized counters to reduce per-entity query count if the station grows.

---

# Task 7.4 Report — Dashboard Trends & Time Analytics

Date: 2026-08-21

## 1. Objective

Extend the Dashboard with a scalable **Trends & Time Analytics** section built
on the same server-side `count()` aggregation architecture as Tasks 7.2/7.3:
an observation trend over time (with previous-period comparison), plus status,
risk and OIL/GAS trends, all role-scoped, period-aware, RTL-safe and free of
observation downloads.

## 2. Scope

- New **Observation Trends** dashboard section below the existing analytics.
- Time bucketing (Daily/Weekly/Monthly) with an auto-selected, switchable
  granularity.
- Previous-period comparison with neutral wording.
- Status, Risk and OIL/GAS time trends (existing models only).
- No new routes, no new filters system, no DB redesign, no rules changes, no
  new dependencies, no export/report/map/notification features.

## 3. Trend Architecture

`aggregateTrends` (in `src/services/analytics.service.ts`) computes every
bucket server-side. For each time bucket it runs 11 bounded `count()` queries
— 5 operational statuses, 4 risk levels, 2 sections — and the main line trend
is derived from the status sums (no separate total query). The role scope
(companyId / areaIds) and the bucket window are pushed into **every** query, so
no observation document is downloaded and results are exact at any collection
size. Buckets are built from calendar-aligned units that partition the window
exactly, so `sum(bucket totals) == the full-window total`.

## 4. Time Bucketing

- Granularities: Daily, Weekly, Monthly (`TREND_GRANULARITIES`). Buckets are
  aligned to local calendar days / Mondays / month starts; the first bucket is
  clamped to the window start and the last to the window end (half-open
  `[start, end)` windows avoid boundary double-counts).
- Auto-selection from the range with a user override when more than one
  option is meaningful (min 3 buckets; never more than `MAX_TREND_BUCKETS = 14`;
  a granularity that would hit the cap is **not offered**, so the chart always
  covers the full range):
  - Last 7 days → Daily (8 buckets).
  - Last 30 days → Weekly (5 buckets).
  - Last 90 days → Weekly (default, 14 buckets) or Monthly.
  - All time → Monthly (capped at the most recent 14 months; a visible note
    says so).
- No unnecessary granularity options are shown (e.g. Monthly is not offered
  for ranges under a month).

## 5. Previous Period Comparison

`previousRange` computes the equivalent-duration window immediately before the
selected range (`[from - duration, from)`), and the previous total comes from a
single server-side `count()` with `status in [OPEN…CLOSED]` (DRAFT/ASSIGNED
excluded). The summary shows Current Period, Previous Period, Change
(±N) and Change Rate (±N.N%), with neutral wording — "Increased", "Decreased",
"No change" — never implying that more observations is better/worse. When there
is no previous window (all time) the UI shows "No comparison available"; when
the previous period is zero it shows "No previous-period baseline" (no
division by zero).

## 6. Status Trends

Stacked time bars over the exact **operational statuses**
(`OPERATIONAL_STATUSES`: OPEN, ACTION_REQUIRED, ACTION_SUBMITTED,
UNDER_VERIFICATION, CLOSED), identical to Tasks 7.2/7.3. DRAFT/ASSIGNED are
never counted. Column totals are printed above each bar and the legend lists
each status with its total and share.

## 7. Risk Trends

Stacked time bars over the existing risk model (LOW, MEDIUM, HIGH, CRITICAL)
using the existing `RISK_LEVELS` and `RISK_COLORS`. As in the Task 7.2 risk
chart, risk counts span all statuses (a HIGH/CRITICAL draft is still a
HIGH/CRITICAL risk) — documented behaviour. Values are numeric (column totals +
legend totals/shares), never color-only.

## 8. OIL/GAS Trends

Stacked time bars comparing the two existing sections (OIL vs GAS) via the
existing `SECTIONS` model and `SECTION_COLORS`, matching the Task 7.2 OIL/GAS
chart semantics. No new section field.

## 9. Filters

The section reuses `useDashboardFilters` — the **same** global period state as
the KPI cards, analytics and Company/Area Performance. When the period changes
(All / 7 / 30 / 90 days) the trend range updates and every bucket query is
re-run; when the new range no longer supports the selected granularity (e.g.
7d→30d drops Daily) the granularity falls back to a valid option. There is no
second date-filter system and no duplicated filter state. The dashboard has no
global section/company/area filters, so none are duplicated either.

## 10. Role Scoping

Identical to the existing Dashboard: the scope comes from
`useDashboardScope` → `resolveDashboardScope(profile)` and is pushed into every
trend query through `baseConstraints`:

- **SUPER_ADMIN / HSE_MANAGER / HSE_OFFICER / PA**: full authorized scope.
- **AREA_AUTHORITY**: `areaId in <assigned areas>` on every bucket query and on
  the previous-period total (rotation/assignment architecture respected;
  `__no_areas__` → empty trend).
- **COMPANY_REP**: `companyId == <their company>` on every bucket query and the
  previous-period total.

The scope is enforced in the query/service layer — the UI only renders what the
queries returned, so there is no path for a Company Rep or Area Authority to
aggregate data outside their authorized scope.

## 11. Query Strategy

- Per bucket: 5 status + 4 risk + 2 section `count()` queries = **11**. The
  main line trend reuses the status sums (0 extra).
- Buckets ≤ 14 (`MAX_TREND_BUCKETS`), processed in chunks of 4
  (`TREND_BATCH_SIZE`) so at most ~44 aggregation queries are in flight.
- Previous period: 1 additional `count()` when the range has a start.
- Worst common budgets: 7d → 8 buckets (89 queries), 30d → 5 buckets (56),
  90d → 14 buckets (155), all time → 14 buckets (154). Every query is a
  bounded-window server aggregation; the numbers are documented here rather
  than hidden.
- No "one query per day × status × risk × company × area" explosion.

## 12. Performance

- Zero document downloads — everything is `getCountFromServer`.
- Query volume is bounded and constant per period/granularity (never grows with
  observation count).
- 60-second refresh via the existing dashboard React Query strategy; no
  aggressive polling, no new listeners.

## 13. Indexes

**No new indexes.** Every trend query reuses the existing composite indexes —
the scope field(s) `(companyId | areaId)` + `(status | riskLevel | section)` +
`createdAt` (all present since Tasks 7.2/7.3). `firestore.indexes.json` is
unchanged (21 indexes, valid JSON). Static verification only; live index
deployment is NOT claimed.

## 14. UI

Dashboard structure now: KPI cards → Analytics charts → Company Performance →
Area Performance → **Observation Trends**. The section reuses
`DashboardSection`, `Card`/`CardHeader`/`CardBody`, `LoadingCard`, `ErrorCard`
(with Retry) and `EmptyState`. New dependency-free SVG/CSS components in
`charts.tsx`: `LineChart` (main trend) and `StackedTimeBars` (status/risk/
section trends), consistent with the existing chart design. A concise
summary block (Current/Previous/Change/Rate + neutral caption) sits above the
main chart, and the granularity segmented control mirrors the existing period
control styling.

## 15. Responsive Design

`LineChart` uses an `viewBox` SVG that scales to any width; `StackedTimeBars`
uses flexible columns, so charts fit narrow screens with no horizontal page
overflow. Sparse bucket labels prevent crowding on mobile. The granularity
control wraps under the section title on small screens.

## 16. EN/AR

All new strings live in `src/i18n/locales/en.ts` and `ar.ts`
(`dashboard.trends.*`): section title/description, summary labels, neutral
direction wording, granularity labels, chart titles and aria labels, capped
note, empty state. Nothing is hardcoded. Arabic renders RTL: the time axis of
the line chart mirrors (oldest on the right) and the stacked-bar columns follow
the document direction; all other layout uses logical properties.

## 17. Accessibility

- Granularity buttons are native `<button>` elements with `aria-pressed`
  (keyboard accessible); period filtering is unchanged.
- Charts carry `role="img"` with descriptive `aria-label`s.
- Values are never color-only: column totals are printed above every bar, the
  legends show numeric totals and shares, and the summary block shows the
  numbers in text.

## 18. Verification

Executed in this session:

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | Passed, 0 errors |
| Lint | `npm run lint` | Passed, 0 warnings, 0 errors (113 files, oxlint) |
| Production build | `npm run build` | Passed (vite 8.2.1, 219 modules) |
| Dev-server smoke test | `npm run dev` + HTTP fetch | `/`, `/login`, `/register`, `/dashboard`, `/observations`, `/observations?company=…`, `/observations?area=…`, `/notifications`, `/map` all 200 |
| Bundle content | marker scan of `dist` | Task 7.4 EN/AR strings present (Observation Trends, Current Period, Previous Period, Change Rate, granularity labels, chart titles, …) |
| Bucket/granularity math | standalone simulation of the pure helpers | 7d → daily 8, 30d → weekly 5, 90d → weekly 14 / monthly 4, all → monthly 14; capped options never offered |

RBAC/scoping reviewed by design (§10). **Not executed** (no Firebase
credentials/emulator, no test accounts, no browser harness): live count-query
results, per-role trend scoping, rendered loading/empty/error states, EN/AR/RTL
and responsive visual checks. Follow `docs/verification.md` (§42) against a
real project.

## 19. Limitations

- Firebase live verification remains NOT VERIFIED (no credentials/emulator/test
  accounts); live trend queries and per-role results must be confirmed in a
  real project.
- Trends are exact but cost 11 server count queries per bucket; the bucket
  count is capped (14) so the section is bounded — a denormalized time-series
  counter (deferred) would cut this further at the cost of a schema extension.
- All-time trends are bucketed monthly and capped to the most recent 14 months
  (a visible note explains this); the KPI cards still show true all-time
  totals.
- Risk and OIL/GAS trends count across all statuses (consistent with the
  Task 7.2 risk/OIL-GAS charts); the status trend and total trend are
  operational-only. This is documented behaviour.

## 20. Future Work

- Company/area-level trends (per-entity time series) and map trend layers.
- Denormalized daily counters for O(1) time-bucket queries at large scale.
- Reports/export (PDF/Excel/CSV) and scheduled reports (future tasks).
- Tooltips/values on hover for the line chart.