# Phase 2 deployment preparation — 24 October 2026

> This report records preparation of the Phase 2 commit. A subsequent local,
> uncommitted PyJWT migration removes the backend advisories listed below; see
> [JWT_MIGRATION.md](JWT_MIGRATION.md) for its changes, current audit, tests, and
> clean-build requirement. Neither change has been pushed or deployed.

This release combines the Phase 2 workspace, public landing page, authentication
design refinement, and the local development CORS fix. It is prepared for a local
commit only. Pushing and deployment require separate approval.

## Reviewed changes

- Cohesive landing, login/signup, and authenticated workspace with light/dark
  themes, local licensed Manrope typography, responsive layouts, and keyboard
  navigation. The public dashboard illustration uses explicitly labeled fictional
  data and never fetches private applications.
- User-scoped analytics, lazy-loaded Recharts, status breakdowns, application-date
  trends, combined search/filter/sort, reset, pagination, tables/cards, and dialogs.
  Authentication and all CRUD fields continue using the existing API.
- Hash routing with history, refresh, internal return-target validation, protected
  routes, and logout guards. React escapes user text; external job links accept
  HTTP(S) and use `noopener noreferrer`. Existing token storage is preserved.
- `main.py` adds only `http://localhost:5174` to the CORS allowlist. Existing
  localhost/loopback port 5173 origins, both Vercel origins, environment additions,
  explicit methods/headers, and the outer CORS wrapper are preserved.
- Regression tests, accessibility checks, documentation, and a dependency lockfile
  update for Recharts, Lucide, and development-only Axe. No schema migration,
  API-contract change, or hosting configuration change is included.

## Verification

| Check | Result |
| --- | --- |
| Backend API/security/CORS tests | 8 passed, isolated in-memory SQLite |
| Frontend API, analytics, navigation tests | All 3 test files passed |
| Full Chromium browser suite | 16 passed, disposable PostgreSQL |
| Axe WCAG 2 A/AA and 2.1 AA, keyboard and responsive checks | Passed |
| ESLint | Passed |
| Production build | Passed with Node 24.21.0 |
| Built-site static-server smoke check | Direct hash links, reloads, history, auth guards, font and assets passed |
| npm audit | 0 known vulnerabilities |
| Python requirements audit | 2 distinct existing advisories; see below |
| Credential/sensitive-file scan | No findings in tracked/candidate source or built assets |
| Git whitespace check | Passed |

The browser suite ran on temporary frontend port 5175 because the developer's
application was already using 5174. Temporary copies of test configuration and
the disposable database harness changed only that test origin and file paths.
The committed test harness retains its usual ports. It refuses to reuse existing
servers. The initial ESLint run overlapped Playwright's artifact-directory cleanup;
rerunning it after cleanup passed. The deliberate chart-download failure scenario
prints a React diagnostic while confirming CRUD remains functional.

The production build was served by a plain local static server without SPA
rewrites. All external browser requests were blocked during that smoke test, and
none were attempted. Authenticated refresh/history and CRUD were covered by the
disposable-database browser suite. Native Safari/Firefox and live production writes
were not exercised; automated Axe results are not an accessibility certification.

## Existing backend dependency advisories

The pinned backend requirements are unchanged by this release. `pip-audit`
reported three entries representing two distinct advisories (the ECDSA advisory
was returned twice). No fixed versions were listed:

- `ecdsa==0.19.2`: CVE-2024-23342 / GHSA-wj6h-64fc-37mp, a timing side channel in
  ECDSA signing/key operations. The maintainer advisory says signature verification
  is unaffected and no fix is planned. [Maintainer advisory](https://github.com/tlsfuzzer/python-ecdsa/security/advisories/GHSA-wj6h-64fc-37mp).
- `python-jose==3.5.0`: CVE-2026-85394 / GHSA-3qf3-8w2g-rqmx, algorithm confusion
  involving DER public keys accepted as HMAC secrets. The published attack concerns
  asymmetric public keys and unrestricted algorithms. [Advisory](https://github.com/advisories/GHSA-3qf3-8w2g-rqmx).

Code-review assessment: this application signs and verifies only HS256 using an
environment-provided shared secret, explicitly restricts decoding to HS256, and
does not use ECDSA or asymmetric public keys for JWT authentication. The described
attack paths therefore do not appear reachable through the current configuration.
This is a scoped assessment, not a clean backend audit or proof against every
library vulnerability. A reviewed JWT-library migration can remove the flagged
dependencies in a separate backend change. Do not broaden allowed algorithms or
substitute public-key material for the shared secret.

## Deployment requirements after approval

1. Vercel: use the existing `frontend` root, install from the committed lockfile
   (`npm ci`), build with `npm run build`, and serve `dist`. Node 24 was tested;
   use Node 24 or a compatible Node 22 release (22.13 or newer) for the full toolchain.
2. The public frontend setting `VITE_API_URL`, if configured, must be
   `https://internship-tracker-ak3q.onrender.com`. The production fallback already
   uses that address, and the inspected build contains it rather than a localhost
   API. Vite settings are resolved at build time. Never put database credentials or
   the JWT signing secret in any `VITE_*` variable.
3. Use `/#/login`, `/#/signup`, `/#/overview`, and `/#/applications` for direct links.
   Fragments are handled in the browser; the server serves `/`. No Vercel rewrites
   are required for these routes. Bare `/applications` is not an application route.
4. Render: deploy the same approved commit to pick up the CORS addition. Existing
   database and signing-key settings stay unchanged; there is no migration. Keep
   the existing startup command. A future custom or preview hostname must be added
   explicitly to `CORS_ORIGINS` if it is not already allowed.
5. After an approved push, compare both hosting deployment commit IDs with the
   local release commit, check successful build/start logs, then verify the landing
   page and login route refresh. Production CRUD smoke tests require separately
   approved disposable test records; this preparation created none.

Hosted Vercel/Render settings and private environment variables were not accessed
or changed during preparation. The above are deployment requirements, not a claim
that remote configuration was inspected. `.env` remains ignored and untracked;
private keys, cloud configuration, dependency directories, builds, and browser
artifacts are excluded. The scan compared current local secrets and the old exposed
JWT key in memory without displaying values. Historical Git exposure is not erased
by this scan or by the new commit.
