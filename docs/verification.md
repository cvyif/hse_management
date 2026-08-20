# Phase 2 — Manual Verification Script

Run these against a real Firebase project (or the local emulators with
`VITE_USE_FIREBASE_EMULATORS=true` and `firebase emulators:start`).

## Prerequisites

- `.env` filled with the six `VITE_FIREBASE_*` variables.
- `firestore.rules` and `storage.rules` deployed:
  `npx firebase deploy --only firestore:rules,storage:rules`
- A service account available for bootstrap.
- `npm run dev` running.

## 1. Authentication

1. Register a new account (choose COMPANY_REP — no company needed yet). Expect
   redirect to the "Registration under review" page.
2. Try to open `/dashboard` while PENDING → must redirect to pending page, not
   the dashboard.
3. Sign out, sign back in → the session should persist (close and reopen the
   tab; you remain signed in).
4. Rejected account: sign in → sees the rejected screen; `/dashboard` blocked.

## 2. Super Admin

1. Run bootstrap:
   `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/bootstrap-super-admin.mjs --email admin@example.com`
2. Sign in as the admin → sidebar shows the ADMIN section with
   "Registration Requests (1)".
3. Confirm a non-admin approved user does NOT see the ADMIN section and
   opening `/admin/users` redirects to `/403`.

## 3. Registration review

1. On `/admin/registrations`, approve the pending user with a role. For a
   COMPANY_REP, approve and confirm the company is selectable/required.
2. Sign in as that user → dashboard accessible; role badge matches; COMPANY_REP
   sees their assigned company.
3. Register another user; reject with a reason → they see the reason.

## 4. Users

- Search, filter by role/company/status.
- Change a role, change a company, deactivate → user loses access; activate →
  access restored. Verify the admin cannot change their own role (no option).

## 5. Companies / Areas / Rotations / Assignments

- Create/edit/deactivate companies; deactivated company disappears from the
  registration picker.
- Create areas with OIL/GAS and coordinates (25/40 → stored 0.25/0.40).
- Create rotations; create two assignments for one area (different authorities,
  one with a time window). Confirm the "Current" badge reflects the active
  window.
- Deactivate an assignment → it remains listed (history preserved).

## 6. Audit trail

- After each action above, check `auditLogs` in the Firestore console: actor,
  action, entity, changes, timestamp present.

## 7. Security checks (direct Firestore, not just UI)

Using a Firestore client (e.g. console "Run a query" or a scratch script):

- PENDING user tries `read` on `areas`/`companies` → denied.
- Normal user tries `update` of `users/{self}` setting `role` → denied.
- Normal user tries `set` `users/{other}` `role: 'SUPER_ADMIN'` → denied.
- PENDING user's profile has no `role`; `users` create with `role` → denied.
- COMPANY_REP reads `users` where `companyId != own` → denied.
- Any user tries `update`/`delete` on `auditLogs/{id}` → denied.
- Non-admin writes to `companies`/`areas`/`rotations`/
  `areaAuthorityAssignments` → denied.

## 8. Build quality

```sh
npm run typecheck
npm run lint
npm run build
```

---

# Phase 3 — Manual Verification Script (Observation Creation & Lifecycle)

Run after Phase 2 verification passes, against the same real project/emulator.

## Prerequisites

- Phase 2 verified.
- Observation types + counter seeded:
  `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm run seed:observations`
  (expect 14 types created + `counters/observationIds`).
- An active company and active areas (OIL and GAS) created by the admin.
- One approved HSE_MANAGER (or HSE_OFFICER/PA) and one approved SUPER_ADMIN;
  one approved AREA_AUTHORITY and one approved COMPANY_REP for the negative
  checks.

## 1. Observation Types & Sidebar

1. Sign in as the HSE user → sidebar shows an **Observations** section with
   "Observations" and "New Observation".
2. Sign in as AREA_AUTHORITY and as COMPANY_REP → no Observations section;
   `/observations` and `/observations/new` redirect to `/403`.
3. `/observations` shows the empty state with a "New Observation" button.

## 2. Create a Draft

1. Open `/observations/new`. Company step: only active companies listed.
2. Area step: pick an OIL area → the Section preview shows "Oil" (from the
   Area; not manually editable).
3. Permit step: choose HOT + number `12345` (numeric only enforced); choose
   NOT_APPLICABLE → number field hidden.
4. Details: pick an active observation type, a risk, enter a description.
5. Click **Save Draft** → a notice appears with the new ID (`OBS-YYYY-NNNNN`);
   the URL becomes `?edit=OBS-...`.
6. In Firestore console: the doc exists in `observations` with
   `status: 'DRAFT'`, `timeline` = one entry (DRAFT), `evidence: []`,
   reporter fields matching the signed-in user; `counters/observationIds`
   incremented; an `auditLogs` entry `observation.created` exists.

## 3. Draft Editing

1. Reload the `?edit=` URL → the wizard pre-fills all saved values.
2. Change the description and save again → `updatedAt` advances, `timeline`
   still one entry, `auditLogs` has `observation.updated`.
3. From the list, open the draft → "Edit Draft" button visible; edit via it.
4. Negative: sign in as a different HSE user → no "Edit Draft" button; directly
   submitting an update for the draft returns permission-denied.
5. Negative: once submitted (next step), the "Edit Draft" button disappears and
   updates are denied.

## 4. Evidence & Submit

1. Continue the wizard to the Evidence step; attach images + a PDF (≤ 20 files,
   each ≤ 10 MB). Verify `.exe` and > 10 MB files are rejected client-side.
2. Review step shows the full summary (company, area, section, permit, type,
   risk, description, immediate action, evidence count, reporter).
3. Submit → redirected to the detail page, status badge **OPEN**,
   `submittedAt` set, evidence gallery shows the files (images inline).
4. Firestore: `status: 'OPEN'`, `timeline` has 2 entries, `evidence` items
   carry `storagePath` `evidence/<id>/<uuid>.<ext>`, sizes/contentTypes;
   `auditLogs` has `observation.submitted` with `changes`.
5. Storage console: files present under `evidence/<id>/`; the Firestore doc and
   Storage files match exactly.
6. Retry simulation: before submitting, stop the network after uploads begin →
   the doc remains DRAFT; retry succeeds and no duplicate Storage paths remain
   (stable file ids overwrite).

## 5. List & Detail

1. `/observations` lists the OPEN observation: ID link, status/risk badges,
   company/area/section/type/reporter/created.
2. Search by ID substring and by description text; filter by status and risk;
   combine filters.
3. Open the detail page from the list → all rows correct, dates formatted per
   language, RTL correct in Arabic.

## 6. Security checks (direct Firestore/Storage, not just UI)

- Non-HSE approved user (AREA_AUTHORITY, COMPANY_REP) creates an observation →
  denied.
- HSE user creates an observation with `reporterId` of another user → denied.
- HSE user submits with an inactive company/area/type → denied.
- HSE user submits with `section` ≠ the Area's section → denied.
- HSE user submits with `permit.number` non-numeric or > 10 digits → denied
  (except NOT_APPLICABLE).
- HSE user submits with `timeline` of size ≠ old + 1 → denied.
- Any user updates an OPEN observation → denied; deletes any observation →
  denied.
- Counter: direct `update` of `counters/observationIds` to `sequence + 2` →
  denied; year change with `sequence != 1` → denied.
- Storage: upload > 10 MB or a `.exe` under `evidence/<id>/` → denied; non-HSE
  user reads/writes evidence → denied.
- Observation Type: read allowed for approved users; create/update only by
  Super Admin (client write denied for HSE).

## 7. Build quality

```sh
npm run typecheck
npm run lint
npm run build
```

---

# Phase 4 — Manual Verification Script (Corrective Action Management & HSE Verification)

Run after Phase 3 verification passes, against the same real project/emulator.

## Prerequisites

- Phase 3 verified (observations listable, one OPEN observation exists).
- Approved accounts: one HSE_MANAGER and one HSE_OFFICER (verifiers), one PA,
  one AREA_AUTHORITY, and one COMPANY_REP assigned to the same company that the
  OPEN observation belongs to (`OBS-2026-00001` below, adjust as needed).
- Two companies at minimum so the negative company-isolation checks have a
  target.

## 1. Request a Corrective Action (HSE verifier)

1. Sign in as HSE_MANAGER → open `/observations/OBS-2026-00001` (an OPEN one).
   The Corrective Action card shows "No corrective action has been requested".
2. Click **Request Corrective Action** → the card now shows the action status
   badge **Required**; the observation status badge becomes **Action Required**.
3. Firestore: `correctiveActions/OBS-2026-00001` exists with `status:
   'REQUIRED'`, `companyId` == observation company, `description: ''`,
   `evidence: []`; observation `status: 'ACTION_REQUIRED'`, `timeline` +1 entry
   (`OPEN → ACTION_REQUIRED`); `auditLogs` has `corrective_action.created` and
   `observation.action_requested`.
4. Negative: a second request is impossible — `getCorrectiveAction` returns the
   existing action and the service throws; a direct create of a second
   `correctiveActions/<id>` is denied.

## 2. Company Submission (COMPANY_REP)

1. Sign in as the COMPANY_REP whose company matches the observation → the card
   shows the submission form (description + evidence + submit).
2. Negative: a COMPANY_REP of the *other* company sees the "belongs to another
   company" message and cannot submit (UI + rules deny).
3. Enter a description, attach evidence files, click **Submit Corrective
   Action** → card shows status **Submitted**; observation status becomes
   **Action Submitted**.
4. Firestore: action `status: 'SUBMITTED'`, `submittedBy` == rep uid,
   `submittedByName` == rep display name, `submittedAt` int, `description`,
   `evidence` with `storagePath`
   `correctiveActionEvidence/<id>/<uuid>.<ext>`; observation `status:
   'ACTION_SUBMITTED'`, timeline +1; `auditLogs` has
   `corrective_action.submitted` (written by the company rep — the only audit
   action the rep may write) and `observation.action_submitted`.
5. Storage console: files under `correctiveActionEvidence/<id>/`.
6. Negative: while `SUBMITTED`, the rep tries to upload again or update the
   action → denied (Storage `actionSubmittable` false; Firestore update rule
   company path requires REQUIRED|RETURNED).
7. Negative: rep tries to write `verifiedBy`/`returnReason` on the action →
   denied (`noActionVerificationFields`).
8. Retry simulation: kill the network between the two batches → the action may
   be SUBMITTED while the observation is still ACTION_REQUIRED; reload, click
   submit again → the observation catches up (idempotent re-read).

## 3. Begin Verification (HSE verifier)

1. Sign in as HSE_OFFICER → card shows **Begin Verification** (action
   SUBMITTED, observation ACTION_SUBMITTED).
2. Click it → action **Under Verification**, observation **Under Verification**;
   `auditLogs` has `corrective_action.under_review` and
   `observation.verification_started`.
3. Negative: COMPANY_REP cannot begin verification (no button; direct update
   denied by `canVerifyAction`).

## 4. Return for Correction (HSE verifier)

1. As HSE_OFFICER click **Return for Correction** → dialog opens; the confirm
   button is disabled until a reason is typed.
2. Type a reason → confirm → action **Returned** with `returnedBy/At` +
   `returnReason`; observation back to **Action Required**; `auditLogs` has
   `corrective_action.returned` and `observation.returned`.
3. Negative: confirm without a reason → disabled; a direct write with an empty
   or > 2000-char reason → denied.
4. Company rep: the submission form appears again (REQUIRED|RETURNED →
   SUBMITTED). Resubmit with revised description + evidence → action
   SUBMITTED again, observation ACTION_SUBMITTED; note the retained
   `returnedBy/At` + `returnReason` on the action doc (history preserved, UI
   shows them only while status == RETURNED).

## 5. Accept & Close (HSE verifier)

1. Take a fresh submission through Begin Verification again, then click
   **Accept & Close** → action **Accepted** with `verifiedBy/At`; observation
   **Closed** with `closedAt`/`closedBy`; `auditLogs` has
   `corrective_action.verified` and `observation.closed`.
2. Firestore: observation `status: 'CLOSED'`, timeline final entry
   `UNDER_VERIFICATION → CLOSED`.
3. Negative: accepting from any other state → denied; a closed observation or
   ACCEPTED action can never be updated/deleted.

## 6. Role matrix checks

- **PA**: sees the Corrective Action card and evidence (review), but no
  Request/Begin/Accept/Return buttons; direct `canVerifyAction` writes → denied.
- **AREA_AUTHORITY**: review only; no submit/verify actions anywhere.
- **SUPER_ADMIN**: can do everything HSE_MANAGER can.
- **COMPANY_REP**: `/observations` list shows only their own company's
  observations; opening another company's observation id → not found/denied;
  `/observations/new` → 403.

## 7. Security checks (direct Firestore/Storage, not just UI)

- Non-verifier (PA/COMPANY_REP) requests a corrective action → denied.
- Company rep creates/updates a corrective action for another company → denied.
- Company rep submits while the observation is not ACTION_REQUIRED → denied.
- Company rep submits with `submittedByName != me().displayName` → denied.
- Company rep includes `verifiedBy`/`returnedBy`/`returnReason` in the submit →
  denied.
- HSE writes an observation status not reachable from the current state (e.g.
  OPEN → CLOSED, or ACTION_REQUIRED → UNDER_VERIFICATION) → denied.
- HSE transitions the observation while the action document is not in the
  required status (mismatched two-phase state) → denied.
- HSE accepts without the action being UNDER_VERIFICATION → denied.
- HSE updates the action changing `description`/`evidence`/`submitted*` on a
  lifecycle transition → denied.
- Any update/delete of a CLOSED observation or ACCEPTED action → denied.
- Storage: non-owning company uploads to `correctiveActionEvidence/<id>/` →
  denied; upload after submission → denied; > 10 MB or `.exe` → denied;
  company rep reads their own evidence → allowed; other company rep reads it →
  denied.
- Audit: COMPANY_REP writing any audit action other than
  `corrective_action.submitted` → denied; any user update/delete of auditLogs →
  denied.

## 8. Build quality

```sh
npm run typecheck
npm run lint
npm run build
```

# Phase 5 — Manual Verification Script (Notifications & Notification Center)

Run against a real Firebase project (or the emulators, Java 11+). Before
testing, deploy the new rules **and indexes**:

```sh
npx firebase deploy --only firestore:rules,firestore:indexes
```

Prerequisites: an approved SUPER_ADMIN, an HSE_MANAGER, an HSE_OFFICER, a
COMPANY_REP (owning the company used below), an AREA_AUTHORITY with an **active**
assignment on the area used below, plus a second area authority rotated into the
same area (time-window assignment) to verify rotation behavior.

## 9. Notification delivery (event fan-out)

1. Sign in as the COMPANY_REP and submit a new observation (DRAFT → submit).
2. Sign in as the HSE_MANAGER → bell badge shows ≥ 1; `/notifications` shows an
   `OBSERVATION_CREATED` item with the company/area names and a relative time.
   Clicking it opens `/observations/<id>`.
3. Sign in as the AREA_AUTHORITY assigned to that area → sees the same
   `OBSERVATION_CREATED`. An authority rotated OUT of the window does **not**.
4. HSE_MANAGER requests a corrective action → sign in as the COMPANY_REP →
   `CORRECTIVE_ACTION_REQUIRED` appears (bell + list).
5. COMPANY_REP submits the action (with evidence) → sign in as HSE_MANAGER and
   HSE_OFFICER → `CORRECTIVE_ACTION_SUBMITTED` appears.
6. HSE_MANAGER returns the action with a reason → COMPANY_REP sees
   `CORRECTIVE_ACTION_RETURNED`; the company resubmits → a *second* distinct
   `CORRECTIVE_ACTION_SUBMITTED` appears (cycle token), with no duplicate of the
   first.
7. HSE_MANAGER verifies and accepts → COMPANY_REP sees
   `CORRECTIVE_ACTION_ACCEPTED`; HSE staff and the area authority see
   `OBSERVATION_CLOSED`.

## 10. Read / unread / mark-all

1. Mark one item read → badge decrements; the item moves to the "Read" tab;
   "Unread" tab hides it.
2. Mark the same item unread → it returns to "Unread".
3. "Mark all as read" clears the badge and the "Unread" tab.
4. Refresh → state persists (server-side).

## 11. Dedupe & idempotency

1. Re-submit an already-submitted observation via the idempotent retry path
   (or re-invoke the submit operation) → no new `OBSERVATION_CREATED`.
2. Inspect `notifications` in the Firestore console: document id ==
   `dedupeKey`, pattern `<TYPE>:<obsId>:<uid>[:c<ts>]`.

## 12. Security checks (direct Firestore, not just UI)

- A non-recipient signs in and reads another user's notification id → denied.
- A user attempts to create a notification for themselves as recipient
  (`recipientUserId == auth.uid`) → denied.
- A user attempts to create a `OBSERVATION_CREATED` notification where the
  committed observation `reporterId != auth.uid` → denied.
- A user attempts to create a `CORRECTIVE_ACTION_SUBMITTED` where
  `submittedBy != auth.uid`, or for a company other than the action's company →
  denied.
- A user attempts to update a notification changing anything but `read`/`readAt`
  (e.g. `titleKey`, `companyId`) → denied.
- An unapproved (PENDING) account attempts any notification write → denied.
- A company rep attempts to read a non-reviewer user's profile
  (e.g. an AREA_AUTHORITY of another area) → denied.

## 13. assignedAreaIds maintenance

1. As HSE_MANAGER, assign an AREA_AUTHORITY to a new area → their user document
   `assignedAreaIds` now includes the area (same batch as the assignment).
2. Deactivate that assignment → `assignedAreaIds` drops the area.
3. As that authority, `/observations` now lists only observations of the
   assigned areas; opening another area's observation id → not found/denied.
4. As HSE_MANAGER, attempt a raw user update that changes e.g. `displayName`
   together with `assignedAreaIds` → denied; only `assignedAreaIds`/`updatedAt`
   may change. SUPER_ADMIN setting an AREA_AUTHORITY's `assignedAreaIds` with an
   inactive area → denied.

## 14. Build quality

```sh
npm run typecheck
npm run lint
npm run build
```

# Phase 6 — Manual Verification Script (Site Map & Observation Map)

Run against a real Firebase project (or the emulators, Java 11+). Deploy the
rules and indexes first:

```sh
npx firebase deploy --only firestore:rules,firestore:indexes
```

Prerequisites: a SUPER_ADMIN, an HSE_MANAGER, an AREA_AUTHORITY (with an active
assignment), a COMPANY_REP with an observation, and areas (OIL + GAS) that have
map positions set. Install the real Site Map asset first (see README — replace
`public/maps/site-map.svg` and update `SITE_MAP_IMAGE_URL`).

## 15. Area positions

1. As SUPER_ADMIN: Admin → Areas → "Set Map Location" for an area. The map opens
   with the other areas dimmed.
2. Click anywhere → the blue marker moves there; the X/Y percentage updates.
   Drag the marker → it follows the pointer.
3. Save Position → position persists (reload the page / reopen the editor).
4. Reopen the editor → the marker is exactly where saved.
5. Open `/map` → the area chip sits at the same position; resize the window and
   zoom → the marker stays glued to the image (normalized coordinates).
6. As HSE_MANAGER, open the same editor URL → the editor renders but Save fails
   (rules allow area writes for SUPER_ADMIN only).

## 16. OIL / GAS filtering

- On `/map`, switch All / OIL / GAS: only the matching section's areas (and
  observations) are shown; "All" shows both.

## 17. Observation markers & details

1. Submit an observation in a positioned area (or use an existing one).
2. On `/map` its marker appears at the area's position, colored by risk.
3. Click the marker → popup shows `OBS-…`, company, area, risk, type, status,
   date. "View Observation" opens `/observations/<id>`.
4. With > 6 observations in one area, a count badge appears; clicking it lists
   them, each row linking to the observation detail.
5. The area chip shows the area's observation count; its popup shows section,
   current Area Authority (+ rotation), and open/closed counts.

## 18. Access control

- **COMPANY_REP**: `/map` shows only their company's observations; the area
   popup hides authority names. Opening another company's observation through
   any marker → not found/denied.
- **AREA_AUTHORITY**: `/map` shows only their assigned areas and observations;
   other areas' data → not found/denied.
- **PA / HSE / SUPER_ADMIN**: full authorized view per the existing model.

## 19. Security (direct Firestore)

- A COMPANY_REP writes `areas/<id>` (any field, incl. `mapPosition`) → denied.
- An HSE_MANAGER writes `areas/<id>` → denied (Super Admin only).
- SUPER_ADMIN writes `areas/<id>` with `mapPosition` outside 0..1 (e.g. 1.5 or
   -0.2) → denied; with valid 0..1 → allowed.
- A PENDING user reads `areas` → denied; approved users read → allowed.

## 20. Responsive & language

- Test `/map` on desktop, tablet and mobile: markers clickable, controls
  accessible, popup fits the viewport (bottom sheet on small screens).
- Switch to Arabic (RTL): map controls flip to the left, all map labels and
  popups render in Arabic.

## 21. Performance

- With many observations, confirm only the newest ~500 scoped records load
  (Firestore console: network tab / query inspector) and filtering stays
  responsive; clustered areas collapse to a single badge.

## 22. Build quality

```sh
npm run typecheck
npm run lint
npm run build
```

# Task 7.1 — Manual Verification Script (Dashboard Foundation)

Run against a real Firebase project (or the emulators, Java 11+). The dashboard
reuses the existing Observation query scoping, so no rules or index deployment
is needed for this task. Prerequisites: an approved account for each role and
at least one submitted Observation.

## 23. Dashboard shell & header

1. Sign in → the app lands on `/dashboard`.
2. The header shows "Dashboard", today's localized date, the current user's
   role badge and a scope label.
3. Switch language to Arabic → title, dates, role and scope labels render in
   Arabic and the layout mirrors (RTL).

## 24. Filters

1. The period control shows All time / Last 7 / 30 / 90 days. Switching to a
   period updates the caption to "Since <date>"; All time shows "Showing all
   time".
2. With an observation older than the selected period, the affected counts
   drop (period filtering works end to end).

## 25. KPI cards & states

1. With data: Total / Open / In progress / Closed cards show the correct
   counts for the scoped window and period (bucket check: OPEN → Open;
   ACTION_REQUIRED / ACTION_SUBMITTED / UNDER_VERIFICATION → In progress;
   CLOSED → Closed; DRAFT/ASSIGNED excluded).
2. While the page first loads, the cards show skeletons (no premature zeros).
3. Empty scope: an account with no observations shows 0 cards plus the "No
   observations yet" empty state (with "New Observation" CTA when the role may
   create).
4. Error state: break connectivity / rules and confirm the ErrorCard with
   Retry appears.

## 26. Role-aware scoping (direct Firestore, not just UI)

- **COMPANY_REP**: `/dashboard` counts only their company's observations; the
  scope label reads "Your company observations only". A raw read of another
  company's observation id → denied.
- **AREA_AUTHORITY**: counts only their assigned areas' observations; label
  reads "Your assigned areas only".
- **PA / HSE / SUPER_ADMIN**: full authorized view; label reads "All authorized
  observations".

## 27. Analytics placeholder

- The Analytics section shows the "Analytics coming soon" empty state with no
  charts (Task 7.1 intentionally implements none).

## 28. Build quality

```sh
npm run typecheck
npm run lint
npm run build
```