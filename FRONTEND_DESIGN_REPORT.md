# Frontend design refinement

> Historical implementation snapshot. For the latest release checks, CORS fix,
> and backend dependency advisories, see [DEPLOYMENT_PREPARATION.md](DEPLOYMENT_PREPARATION.md).

The public site, authentication, and Phase 2 workspace now share one visual
identity: warm paper and graphite neutrals, an iris accent, a precise grid,
self-hosted Manrope typography, restrained elevation, and short interaction
transitions. All work remains local; no commit, push, deployment, credential
change, production-record change, or hosting-setting change was performed.

## Public site and product continuity

- A dedicated landing page with an editorial hero, feature highlights, a simple
  workflow explanation, privacy context, and working login/signup calls to action.
- A realistic HTML/SVG dashboard illustration that is explicitly labeled as
  illustrative sample data. Its fictional records and counts never read session
  state, call the API, or feed real analytics. Anonymous visits do not fetch user
  applications or download Recharts.
- Shared branding, typography, surface colors, buttons, borders, and focus states
  across public pages, login/signup, dialogs, navigation, charts, and records.
- Larger supporting text, clearer hierarchy, matching status/chart colors, and
  refined spacing in the existing working dashboard. All Phase 2 controls remain.
- A 24,836-byte Latin variable Manrope WOFF2 font served locally, preloaded with
  `font-display: swap`. Other glyphs use system fallbacks. The font's SIL Open Font
  License is included in `frontend/src/assets/fonts/OFL.txt`. No font service is
  contacted at runtime, and no new npm dependency was added for this refinement.

## Routes and browser behavior

Routes use fragments so direct links and refreshes work on the existing static
hosting configuration without rewrites:

| Route | Purpose |
| --- | --- |
| `/` or `/#/` | Public landing page |
| `/#/login` | Login |
| `/#/signup` | Signup |
| `/#/overview` | Authenticated overview |
| `/#/applications` | Authenticated application management |

Public sections are addressable with `/#/?section=workspace`, `features`, or
`approach`. Navigation supports back/forward, document titles, route focus, and
reduced-motion-aware section scrolling. Re-selecting the active page or section
restores focus/scroll without creating duplicate history entries. Modified clicks
and links targeting new tabs retain native browser behavior. Page navigation
focuses destination content; dismissing a mobile drawer without navigation returns
focus to its menu trigger. Unknown routes display a real recovery
page. Workspace skip links move focus without changing the application route.

Unauthenticated protected routes redirect to login with an allowlisted internal
return destination. Authentication routes redirect an already authenticated user
to the workspace. Logout clears the existing authentication/data state and
replaces the current location with login; browser history cannot restore private
content without authentication. These UI guards supplement the unchanged backend
authorization checks; they are not the security boundary.

## Authentication and preservation

The same FastAPI signup/login endpoints and JWT contract are retained. Form mode
is derived from the URL, preventing back/forward navigation from displaying one
form while submitting to the other endpoint. Signup still leads to login.

Inputs have labels, clear field errors, appropriate autocomplete, validation focus,
and password masking by default with an accessible visibility toggle. UTF-8 length
is checked before submission to avoid bcrypt-limit errors, without truncating
passwords or changing backend policy. No passwords or tokens are placed in URLs.

The shared tracker hook retains session-version checks, mutation locking, failed
load handling, stale-token protection, and request cancellation. Application reads
are enabled only in protected workspace routes. Public components never display
private records. Existing analytics, search, status filters, sorting, reset,
pagination, optional fields, CRUD, toast feedback, skeletons, and responsive
cards/tables remain integrated with the API.

Backend code, database schema, API helper, environment examples, production
credentials, and hosting configurations are unchanged.

## Checks and review

The five new public browser scenarios cover:

1. Landing/auth separation, sample labeling, no anonymous API/chart requests,
   signup/login navigation, refresh, and browser history.
2. Protected return routes, refreshes, back/forward, logout guards, and unknown
   route recovery.
3. Required-field and long-password validation, password visibility, mode
   switching, and rejecting external return targets.
4. Responsive layouts and Axe WCAG 2 A/AA and 2.1 AA checks in both themes for the
   landing page and authentication, with local visual previews.
5. Public visits from authenticated accounts, keeping illustrative and private
   data separate and returning to the real workspace.

Existing Phase 1 and Phase 2 scenarios retain their original behavioral coverage;
authentication helpers now enter the explicit login route. Navigation parsing and
return-destination validation also have independent unit tests.

Responsive checks cover 320, 375, 390, 768, 1280, and 1440-pixel layouts. Visual
inspection covers public pages, desktop authentication, and desktop/mobile/tablet
workspace layouts. Reduced-motion behavior, keyboard navigation, focus return,
and accessible errors are included. Native Safari/Firefox devices and live
production writes are outside this local test run. Automated accessibility
results do not constitute a complete accessibility certification.

Browser writes target a disposable PostgreSQL cluster; API tests use isolated
in-memory SQLite. Screenshot/trace/build artifacts are not proposed for Git.
Preview images under `/tmp/internship-public-*.png`,
`/tmp/internship-auth-*.png`, `/tmp/internship-phase2-*.png`, and
`/tmp/internship-workspace-tablet.png` contain only fictional or disposable test
data. No real user records are included.

## Reproduction

```
venv/bin/python -B -m unittest discover -s tests -v
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
cd frontend
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/snap/bin/chromium npm run test:e2e
npm audit
```

The system-Chromium override is optional when Playwright's own Chromium is
installed. The test harness refuses to reuse an existing API/frontend server.

## Final validation results

| Check | Result |
| --- | --- |
| Backend/API security suite | 8 passed in isolated SQLite |
| Full Chromium browser suite | 16 passed in disposable PostgreSQL |
| Frontend API, calculation, navigation suites | All 3 test files passed |
| Axe and keyboard checks | Passed in both themes and responsive layouts |
| ESLint | Passed, no warnings |
| Production build | Passed |
| Frontend npm dependency audit | 0 known vulnerabilities |
| Credential and sensitive-file scan | No real credentials or sensitive candidates found |
| Temporary database cleanup | No test clusters left running |

The same-page navigation regression verifies reselecting a section or home link
moves focus/scroll without adding a history entry. Mobile navigation focuses its
destination; Escape-only drawer dismissal restores the menu trigger. The expected
React diagnostic during the simulated chart-module outage is deliberate fault
injection; the scenario verifies application editing still works.

The final build emits the font as a 24.83 kB local asset, the entry JavaScript as
about 88.49 kB gzip, CSS as about 12.18 kB gzip, and charts as a separate deferred
chunk. These are build sizes, not a claim of a measured Lighthouse score.
