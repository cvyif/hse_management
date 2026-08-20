# Task 7.1 Report — Dashboard Foundation

Date: 2026-08-20

## 1. Summary

This task establishes the **foundation** of the Dashboard — the architecture
that Tasks 7.2–7.6 will extend with real analytics. No analytics, trends or
charts were implemented (explicitly out of scope for Task 7.1). The existing
`/dashboard` route was kept and its placeholder page replaced with a clean,
composable Dashboard shell: a dedicated header, a date/filter foundation, a
reusable KPI card architecture with loading/error/empty states, and
role-aware data scoping built entirely on the existing services, rules and
types. Everything is localized (EN/AR) and responsive/RTL-safe.

The existing Dashboard placeholder at `src/features/dashboard/DashboardPage.tsx`
was replaced; the route (`/dashboard`, the signed-in index route) and sidebar
navigation were already in place and reused unchanged.

## 2. Architecture

The Dashboard is a new feature folder (`src/features/dashboard/`) following the
project's established pattern (pure logic + hooks + thin UI):

```
dashboardLogic.ts   pure, UI-free: scope resolution, periods, KPI derivation
hooks.ts            React Query hooks: useDashboardScope / useDashboardData / useDashboardFilters
DashboardPage.tsx   page shell composing the foundation
DashboardHeader.tsx header (title, today's date, role badge, scope label)
DashboardFilters.tsx period segmented control + range caption
KpiCard.tsx         reusable KPI card architecture (skeleton / empty / tones)
DashboardSection.tsx reusable titled section for future analytics panels
```

No new Firebase query surface was introduced: the dashboard reuses
`listObservations` (same scoped query as the Observation list and Site Map)
with the existing `limitCount` bound. No rules or index changes were needed.

## 3. Dashboard Route

`/dashboard` already existed as the signed-in index route
(`src/app/router.tsx`) inside the approved shell, with the sidebar
`nav.dashboard` item. Both are reused unchanged — the placeholder element
now renders the new foundation page.

## 4. Dashboard Page Shell

`DashboardPage` composes the foundation vertically: header → filters → KPI
grid → placeholder analytics section. Data flows through `useDashboardScope`
(profile → scope), `useDashboardFilters` (period → range) and
`useDashboardData(scope)` (scoped bounded query), with derived KPI values
memoized against the loaded window and the selected period.

## 5. Dashboard Header

`DashboardHeader` shows the localized title, today's localized date, the
current user's role badge (reusing `RoleBadge`) and a **scope label** that
states what data the user is authorized to see ("All authorized observations",
"Your company observations only", "Your assigned areas only"). This makes the
role-aware scoping visible to the user.

## 6. Date / Filter Foundation

`DashboardFilters` provides a period segmented control — All time / Last 7 /
30 / 90 days — with a live range caption ("Since <date>" for periods, "Showing
all time" for All). `useDashboardFilters` holds the selected period and
`periodRange()` derives the epoch date range; `inRange()` applies it to the
loaded window. Future analytics tasks consume this exact mechanism instead of
re-introducing date handling.

## 7. KPI Card Architecture

`KpiCard` is a reusable, RTL-safe card: optional icon, label, value, subtitle,
a tone (default/blue/green/amber/red) that drives the value color and a start
accent bar, a **loading** mode (animated skeleton instead of the value) and an
**empty** mode (em dash when the value is undefined). The overview grid renders
four foundation KPI cards derived from the scoped window:

- Total observations (blue)
- Open (amber)
- In progress — corrective action underway (red)
- Closed — verified and closed (green)

The buckets partition the non-excluded statuses (`DRAFT`/`ASSIGNED` excluded,
matching the map's semantics). These are deliberately minimal status counts,
not analytics; `computeDashboardKpis()` in `dashboardLogic.ts` is pure and
documented as the extension point for richer metrics in 7.2+.

## 8. Loading / Error / Empty States

- **Loading**: while the scoped query is pending, the KPI cards show
  skeletons; no empty "0" values flash prematurely.
- **Error**: an `ErrorCard` (reused) with the error message and a Retry action.
- **Empty**: when the scoped window is empty, the KPI cards show `0`/em dash
  and an `EmptyState` with a CTA to create an observation (shown only when the
  role has `observation:create`).
- The Analytics section demonstrates the empty-state pattern for future panels.

## 9. Role-Aware Data Scoping Foundation

`resolveDashboardScope(profile)` reproduces the exact scoping used by the
Observation list and Site Map — COMPANY_REP → `companyId`, AREA_AUTHORITY →
`assignedAreaIds` (sentinel when none), PA/HSE/Super Admin → full authorized
scope. The query shape therefore always matches the existing Firestore read
rules (no rules changes, no weakening). Company Representatives and Area
Authorities only ever receive their authorized slice of data, on the dashboard
as everywhere else.

## 10. Reusable Dashboard Components

- `KpiCard` — the metric card building block for all future KPI rows.
- `DashboardSection` — titled, describable section with optional action for
  future analytics panels.
- `DashboardHeader` / `DashboardFilters` — page-level chrome reused by the
  dashboard page.
All existing primitives were reused where possible (`Card`, `CardBody`,
`Badge`, `RoleBadge`, `Button`, `EmptyState`, `ErrorCard`, `Field`, `cn`,
`formatDate`/`formatDateTime`, the auth store, React Query).

## 11. EN/AR & RTL

New `dashboard.*` keys were added to both `en.ts` and `ar.ts` (titles, KPI
labels/hints, filter labels, scope labels, states). Dates are localized via
`Intl.DateTimeFormat` with the active language (`formatDate` added to
`lib/utils.ts`). All layout uses logical properties (`start-0`, `ps-5`,
`gap`), so the KPI accent bars and the layout mirror correctly in RTL.

## 12. Responsive Layout

The page is a single vertical column; the KPI grid is `1` column on phones,
`2` on small screens and `4` on wide screens. The filters row wraps and the
segmented control remains fully tappable on mobile.

## 13. Verification

Executed in this session:

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | Passed, 0 errors |
| Lint | `npm run lint` | Passed, 0 warnings, 0 errors (106 files, oxlint) |
| Production build | `npm run build` | Passed (vite 8.2.1, 213 modules) |
| Dev-server smoke test | `npm run dev` + HTTP fetch | `/dashboard`, `/`, `/observations`, `/map`, `/admin/areas`, `/notifications` all 200 |

**Not executed** (no Firebase credentials; emulator unavailable — Java 1.8 < 11):
live verification of the scoped dashboard query for each role. The scoping
reuses the already-verified list/map query pattern; follow
`docs/verification.md` (§15) against a real project before go-live.

## 14. Limitations

- KPI counts are derived from the bounded scoped window
  (`DASHBOARD_OBSERVATION_LIMIT = 1000` newest); exact totals over the full
  history (count aggregation) are deferred to a later dashboard task.
- The Analytics section is a clearly-labelled placeholder — no charts, trends,
  risk breakdowns or rates yet (Tasks 7.2–7.6).
- Live role-scoped verification still requires a real Firebase project.

## 15. Future Work

- Task 7.2+: analytics panels mount inside `DashboardSection`; richer KPIs
  extend `DashboardKpis`/`computeDashboardKpis`; charts consume
  `useDashboardFilters` for the period; the Site Map components can be embedded
  as a map panel; exact counts via Firestore `count()` aggregation.