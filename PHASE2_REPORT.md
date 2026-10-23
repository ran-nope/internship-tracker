# Phase 2 implementation and validation

> Historical implementation snapshot. For the latest release checks, CORS fix,
> and backend dependency advisories, see [DEPLOYMENT_PREPARATION.md](DEPLOYMENT_PREPARATION.md).

All changes are local. No commit, push, deployment, production-record changes,
credential changes, database migration, or hosting-setting changes were performed.

## Delivered behavior

- A responsive Overview and Applications workspace, with a collapsible desktop
  sidebar, mobile navigation drawer, and a focused add/edit dialog.
- A shared design system, light and dark themes, branded authentication screen,
  application tables/cards, status badges, skeletons, empty states, retry actions,
  and dismissible success toasts.
- Total applications, current interview and offer counts, selection rate, active
  count, and a complete current-status breakdown. Applied, Selected, Rejected,
  Assessment, and Withdrawn counts remain available in the pipeline legend.
- Recharts application-date trends with six-month, twelve-month, and all-time
  ranges; tooltips; selectable status segments and equivalent keyboard-accessible
  legend buttons; and an expandable trend-data table.
- Combined company/role/location search and status filtering, newest/oldest
  application-date sorting, company-name sorting, visible reset controls, view
  preference, and eight-record pagination.
- CRUD retains every existing field: company, role, status, application date,
  location, job URL, and notes. Details are available in the table and cards.

## Analytics definitions and privacy

Every calculation uses the existing authenticated GET `/internships` response.
The backend's user filter and ownership checks are unchanged. No separate
analytics endpoint or external analytics service was introduced. Application data
is not copied into localStorage; the existing authentication storage is retained,
with only theme and display preference added.

Overview metrics always use the user's complete loaded dataset. List filtering
never changes those totals. Trend date-range controls affect only the trend
chart. Interview and offer counts describe current status; Selected is distinct
from Offer. Selection rate remains Selected / total applications, as in Phase 1.
No historic status changes, interview conversion, growth percentages, or past
interview dates are inferred from current-status data.

Trends group date-only application dates by calendar month without UTC date
shifts. Empty months are included. All-time ranges span the earliest application
through the current/latest month and use no more than 24 buckets; grouped periods
are disclosed in tooltips and the accessible data table. Recent ranges include
the current calendar month.

## Architecture and safeguards

- `useTracker` owns the existing authentication, CRUD, and session lifecycle.
  Session-version checks, old-token protection, and mutation locking are retained.
  Pending list requests are aborted on cleanup; initial loading cannot flash fake
  zero totals. Failed reads show unavailable metrics and a retry action.
- Pure summary/filter/date utilities are tested independently. Summaries and
  sorted results are memoized; sorting never mutates the source dataset.
- Recharts is lazy-loaded in a separate chunk. A chart-specific error boundary
  keeps application management usable if that optional module fails to download.
- Native dialogs provide keyboard focus containment. Focus is placed in the first
  field and restored to the opener or a logical visible fallback. Mobile sidebar
  navigation supports Escape, a focus loop, background inertness, and scroll lock.
- Form errors remain visible; successful mutations refresh the same in-memory
  dataset, so metrics and charts update without extra API requests.
- HTTP(S)-only job links use `noopener noreferrer`. User text is rendered through
  React; no raw-HTML rendering or external telemetry was introduced.
- Backend code, API contracts, database schema, environment files, production
  credentials, and hosting configuration are unchanged.

## Validation

Final validation passed:

| Check | Result |
| --- | --- |
| Backend API/security suite | 8 passed, isolated in-memory SQLite |
| Full browser suite | 11 passed, disposable PostgreSQL |
| Frontend API and calculation checks | Both test files passed |
| ESLint | Passed, no warnings |
| Production build | Passed; charts emitted as a separate lazy chunk |
| Frontend npm dependency audit | 0 known vulnerabilities |
| Credential/sensitive-file scan | No real credentials or sensitive candidates found |
| Git whitespace checks | Passed |

The browser suite consists of the four existing Phase 1 scenarios plus
seven Phase 2 scenarios:

1. User-only analytics, chart ranges, status selection, and account switching.
2. Combined search/status, stable sorting, reset, and both application views.
3. Theme persistence, collapsible navigation, mobile drawer, and dialog focus.
4. Loading skeletons and failed-list recovery with no fabricated analytics.
5. Pagination, deleting the last page, and immediate analytics updates after CRUD.
6. Axe WCAG 2 A/AA and 2.1 AA checks for both authentication themes, both desktop
   dashboard themes, and the mobile dashboard; generated local preview images.
7. A failed chart-module download leaves edit/save functionality available.

Backend tests use in-memory SQLite; browser scenarios use a newly created,
disposable local PostgreSQL cluster. Test-server output may contain an expected
React error-boundary diagnostic for the simulated chart-download outage; this is
intentional fault injection, and the test verifies recovery.

```
venv/bin/python -B -m unittest discover -s tests -v
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
cd frontend
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/snap/bin/chromium npm run test:e2e
npm audit
```

Use Playwright's installed Chromium without the executable override when a system
Chromium is unavailable. Automated browser checks cover 320, 375, 390, 768, and
1280-pixel widths. Native devices, Safari, Firefox, and production end-to-end
writes were not exercised. Automated accessibility and keyboard checks do not constitute a complete
accessibility certification.

Local preview images under `/tmp/internship-phase2-{light,dark,mobile}.png` contain
only disposable test data and are not included in Git. Database, screenshot,
trace, and generated build artifacts are excluded from the proposed source diff.
