# Repository audit and presentation improvements

## Scope

This report records the Phase 2.5 audit. Phase 2.6 subsequently adds Alembic and disposable PostgreSQL CI checks; see [current verification](PHASE2_6_VERIFICATION.md). Dependency and workflow descriptions below otherwise refer to that earlier audit.

The audit inspected the tracked project structure, backend endpoints/models, frontend components/hooks/calculations, dependency declarations, environment examples, test harness, ignore rules, and historical reports. The working tree was clean at commit `665d4dc` before Phase 2.5 work. Production credentials, private records, and hosting settings were not inspected or changed.

## Findings and actions

| Finding | Action |
| --- | --- |
| Root README mixed setup, old diagnosis, deployment notes, and phase reports | Replaced with a product overview, live link, actual gallery, verified features, quick start, and links to detailed docs |
| Five historical reports crowded the root and contained time-specific state claims | Preserved under `docs/history/` with an archive notice and updated navigation |
| Frontend README was the untouched Vite template | Replaced with project-specific structure and documentation links |
| Four starter assets had no references | Removed `hero.png`, `react.svg`, `vite.svg`, and `icons.svg` only after scanning all tracked text for their names |
| Database files/dumps lacked ignore coverage | Added local database/dump/cache patterns and ignored backup directories |
| Frontend environment example pointed to the production API | Changed the development example to loopback; real hosting settings are unchanged |
| No reusable documentation screenshots | Added seven actual captures, a consistent fictional dataset, and an isolated capture command |
| No CI workflow | Added pinned official actions, read-only permissions, tests/lint/build, and redacted source checks |
| No project-wide license | Documented the absence of a license; preserved the separate Manrope OFL |

Generated `venv/`, `frontend/node_modules/`, `frontend/dist/`, Python caches, and browser test artifacts were already ignored and untracked. They were not removed from the developer's machine. This cleanup changes the repository's presentation, not application code or production state.

## Dependency review

Backend requirements pin the current runtime, including PyJWT. python-jose and ecdsa are not declared. The frontend uses `package-lock.json`; no new runtime or development package is needed for this work. Screenshot capture reuses Playwright, and the source/documentation scripts use Python's standard library. CI action SHAs were resolved from the official actions repositories before use.

The verification audit found a high-severity advisory in the existing transitive development dependency `zod@4.6.5`, used by `eslint-plugin-react-hooks`. The lockfile was updated within the existing allowed range to `4.6.7`, above the fixed version `4.6.6`; no direct dependency was added. This package is development-only and is not in the application bundle. [Advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).

## Security findings and limits

The existing `.env` remains ignored/untracked. Example files contain placeholders and public URLs only. CI uses synthetic test keys and SQLite, not hosting secrets. Screenshot credentials are ephemeral and never saved; gallery data is fictional.

Earlier reports recorded exposure of a local PostgreSQL credential and an old JWT key in Git history. Rotation was completed previously as documented by the owner and [historical reports](history/DEPLOYMENT_PREPARATION.md). New clean source scans do not erase or revalidate that historical exposure. No history rewriting was performed. The new CI scanner checks the current source tree, not all past commits; enabling hosting-provider/GitHub secret scanning remains useful alongside it.

The legacy JWT fixture is intentionally signed with a public synthetic test key. Its exact token/path is permitted by the scanner; broad exclusions for tests or docs are not used. Any new JWT literal still triggers review. The scanner is a practical heuristic, not a guarantee that arbitrary secrets are absent.

## Remaining engineering limitations

At Phase 2.5, the schema lacked an ownership foreign key and migration tooling. Phase 2.6 adds a reviewed migration chain and missing-user protection locally; production remains uninspected and requires the [manual migration procedure](DATABASE_MIGRATIONS.md). JWT localStorage, no server-side revocation/rate limiting/recovery, unpaginated API reads, and no status-event history are documented in [architecture](ARCHITECTURE.md#limitations-and-migrations). They were not changed during documentation work.

The recruiter demo remains a [recommendation](DEMO_EXPERIENCE.md). No public account, auth bypass, new AI feature, or machine-learning functionality was implemented. Hosted CI status remains unknown until an approved push triggers an actual run. [Final local results](VERIFICATION.md).
