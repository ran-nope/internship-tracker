# Phase 2.5 verification

This report covers the local repository-presentation, documentation, screenshot, and CI work based on commit `665d4dc`. The changes are uncommitted and have not been pushed, deployed, or released. No production credentials, hosting configuration, schema, or records were changed.

## Completed checks

| Check | Observed result |
| --- | --- |
| Backend and repository safeguard tests | 14 passed: 10 API/security tests and 4 repository-check tests |
| Backend dependency consistency | `pip check` passed |
| Frontend tests after a clean `npm ci` | 8 tests passed across 3 files |
| Full Chromium integration suite | 16 passed using disposable PostgreSQL |
| Screenshot capture suite | 1 passed; seven real JPEG captures created |
| Accessibility/keyboard/responsive checks | Existing Axe and browser scenarios passed in light/dark and responsive layouts |
| ESLint | Passed |
| Production build | Passed; core emitted asset names/hashes unchanged |
| Backend requirements audit | No known vulnerabilities found |
| Final npm audit | 0 known vulnerabilities |
| Source secret/sensitive-file scanner | Passed; matching values are never printed |
| Additional local known-secret scan | No current local secret or old exposed JWT-key matches in proposed source/build assets |
| Ignore coverage | Environment files, local databases, backups, environments, builds, and test artifacts excluded |
| Git whitespace check | Passed |
| Workflow validation | actionlint v1.7.12 passed; action inputs and immutable SHAs verified against official repositories |
| Documentation links | Local targets/anchors checked with `scripts/check_docs.py`; public repository/frontend/API links verified read-only |
| Screenshot review | All seven visually inspected; no real records, credential fields, tokens, or EXIF metadata |

The first npm audit found `zod@4.6.5`, a transitive development dependency of the React Hooks ESLint plugin, affected by [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). The lockfile now resolves `4.6.7` within the existing allowed range. No dependency was added. A clean installation, frontend tests, lint, build, and audit were repeated afterward. The full browser suite and captures ran before this development-only patch; the production asset names/hashes remained identical afterward.

The browser suite intentionally aborts a chart-module request in one scenario; the resulting React diagnostic is expected and the test confirms CRUD still works. The test harness used frontend port 5175 because 5174 may be occupied by development, and API port 8001 with a new disposable PostgreSQL cluster. Backend unit tests use only in-memory SQLite.

The public frontend and GitHub repository returned HTTP 200. The backend greeting initially timed out and returned HTTP 200 on one retry. This was a link check, not authenticated production verification or a database-health test.

## Screenshots

All files are under [screenshots/](screenshots/README.md), using the same twelve-record [synthetic dataset](screenshots/dataset.json):

| File | Size in pixels | Content |
| --- | --- | --- |
| `landing.jpg` | 1440 × 1000 | Public hero and upper illustrative preview |
| `login.jpg` | 1440 × 1000 | Login form with empty credential fields |
| `dashboard.jpg` | 1440 × 1000 | Metrics and charts for the synthetic account |
| `analytics.jpg` | 1132 × 407 | Actual chart-panel crop from that dashboard |
| `applications.jpg` | 1440 × 1000 | Synthetic software engineering, AI, and data science records |
| `dark-mode.jpg` | 1440 × 1000 | Same dashboard in dark mode |
| `mobile.jpg` | 390 × 844 | Same dataset in the mobile card layout |

The seven JPEGs total 619,163 bytes (about 605 KiB), captured directly at quality 90. Browser requests to external origins were blocked during capture. No mock UI, retouched statistics, real user data, or publicly usable demo credentials were introduced.

## CI status and limits

The workflow is prepared and locally validated. It has **not run on GitHub**, because no push was authorized. It cannot truthfully be described as a passing hosted CI run yet. It performs no deployment/release and requests no production secrets. Browser/Axe tests are included in local verification, not in the minimal CI job.

The secret check covers the current source tree with explicit heuristic patterns and narrowly scoped synthetic-fixture exceptions. It is not a full Git-history audit or a comprehensive DLP product. Previous historical exposures remain in history; this work did not rewrite history or rotate credentials. See the [audit](REPOSITORY_AUDIT.md).

Native Safari/Firefox devices, production authenticated requests, load testing, database recovery, and real hosting settings were not exercised. Missing database constraints/migrations, current JWT storage/revocation limitations, and scaling considerations remain documented in [architecture](ARCHITECTURE.md#limitations-and-migrations).

## Change scope

- Reworked root/frontend READMEs and added focused architecture, setup, deployment, testing, case-study, demo-recommendation, audit, and gallery documentation.
- Preserved the five prior reports under `docs/history/` with archive context and updated links.
- Added seven screenshots, one dataset, and a reproducible isolated capture suite.
- Added CI, a redacted source check, a local documentation link checker, and tests for those safeguards.
- Extended ignore rules, corrected the frontend development example, ignored transient test output in ESLint, and made the browser-test frontend port configurable.
- Removed only four confirmed unreferenced starter assets; retained the favicon, Manrope font, and its license.
- Updated the vulnerable transitive development dependency in the lockfile.

Application components, API code, authentication rules, database models, backend dependencies, and production configuration are unchanged by Phase 2.5. A frontend-only recruiter demo remains a recommendation; no demo mode or public account was implemented.
