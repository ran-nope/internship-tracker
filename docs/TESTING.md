# Testing and verification

Run checks from the repository root unless stated otherwise. See [development setup](DEVELOPMENT.md) for prerequisites. No test needs production credentials.

## Backend and repository checks

```bash
venv/bin/python -B -m unittest discover -s tests -v
venv/bin/python -m pip check
python3 scripts/check_secrets.py
python3 scripts/check_docs.py
```

The API suite overrides database/signing settings before importing the app and uses SQLite entirely in memory with foreign-key enforcement enabled. It verifies authentication, validation, CRUD, ownership, CORS, invalid-token handling, and compatibility with the synthetic legacy JWT fixture. Repository-check tests verify the redacted scanner's detections and narrow fixture allowances.

The secret script checks the current tracked/proposed files for sensitive filenames, private keys, common provider tokens, JWT literals, credentialed database URLs, and literal secret assignments. Matches report file/line/rule only. The legacy fixture is permitted by exact path and token hash; public test-password allowances are exact values in exact files. The scanner does not inspect Git history, detect every possible credential format, or replace GitHub secret scanning. Known historical exposure is documented in the [repository audit](REPOSITORY_AUDIT.md).

The documentation script checks local Markdown/HTML links and heading anchors. It skips external URLs; those require separate network checks.

## PostgreSQL migration and API regressions

```bash
RUN_POSTGRES_TESTS=1 venv/bin/python -B -m unittest discover -s tests -p test_migrations.py -v
```

Run this suite in a separate fresh process from the SQLite tests. It requires local PostgreSQL server tools and creates its own loopback clusters through `tests/disposable_postgres.py`; no external database URL is accepted. It clears libpq overrides, injects generated test-only targets, and removes clusters on normal exit. It never uses `.env` credentials. Never run as root. These classes are skipped during ordinary unit-test discovery unless explicitly enabled.

Migration tests load a frozen legacy SQL fixture independent of current ORM metadata, seed synthetic users/applications, baseline it, and compare full-row digests across upgrades/downgrades. They cover fresh initialization, schema/model parity, orphan preservation, rejected invalid owners, RESTRICT deletion, sequence continuity/drift, unexpected schema, blocked stamp shortcuts, index failure/recovery, lock timeout, single-operator locking, read-only redacted preflight, no target fallback, and import without database access. The API suite also runs against a migrated PostgreSQL database, including a real concurrent owner-deletion race. No production/staging records are used.

[Manual migration procedures](DATABASE_MIGRATIONS.md) distinguish disposable harness setup from operator-controlled production changes. The current work does not verify the actual production schema or restore a production backup.

## Maintenance and connection safety

Ordinary backend discovery includes `tests/test_maintenance.py`: strict startup configuration, non-secret identifiers, early body/auth/database rejection, safe methods/read-only login, CORS, uncached database-independent status, HEAD behavior, and no hot toggle from environment edits. Blocked requests use both anonymous and synthetic authenticated client cases. Actual app import/status/gate tests use an unreachable loopback URL and forbid session construction.

The opt-in PostgreSQL command above also runs `MaintenanceDatabaseTests` and maintenance API regressions. It proves SQLSTATE 25006 for writes in maintenance sessions; read-only reapplication after commit/rollback/savepoints; writable reuse of the same backend connection after maintenance; existing-token/login/owned-read isolation and normal writes after disabling; stale idle connection recovery using pre-ping; and no write replay after a connection dies inside a transaction. It also demonstrates an admitted legacy write committing after the new generation already returns 503, so sampling status alone cannot prove quiescence. Connection termination occurs only inside a newly created disposable cluster.

The frontend API unit suite verifies a maintenance 503 displays the server message, preserves the session, and does not automatically retry a mutation. Browser regressions use maintenance disabled explicitly and continue to verify normal UI/API functionality. These tests do not emulate Neon PgBouncer or establish production instance termination. See the [cutover runbook](MAINTENANCE_CUTOVER.md) and [maintenance verification](MAINTENANCE_VERIFICATION.md).

## Frontend unit tests, lint, and build

```bash
npm --prefix frontend ci
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

Unit tests cover API response/error handling, pure analytics/filtering/date functions, and route validation. ESLint checks JavaScript/JSX application code; it is not a Python linter. The production build writes ignored `frontend/dist/` output. Build success is not a Lighthouse benchmark or proof of deployment success.

## Browser integration and accessibility

Install PostgreSQL server tools and Chromium, then:

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
```

The harness creates and explicitly migrates a disposable local PostgreSQL cluster on a free loopback port, starts the API on 8001, and starts Vite on 5174. It overrides database/signing configuration and clears libpq environment variables. The cluster is stopped and its temporary directory removed on normal exit. Do not run it as root.

If development already occupies 5174, use another test frontend port:

```bash
TEST_FRONTEND_PORT=5175 npm run test:e2e
```

The override is validated and applied consistently to the test server's CORS origin and Vite address. API port 8001 must still be free. Existing servers are never reused. On this Ubuntu workstation, system Chromium can be selected with:

```bash
TEST_FRONTEND_PORT=5175 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/snap/bin/chromium npm run test:e2e
```

The suite includes auth/CRUD persistence, user isolation, error handling, analytics, filtering/sorting, pagination, themes, protected-route refresh/history, keyboard focus, responsive widths, and Axe WCAG 2 A/AA and 2.1 AA checks. A deliberately failed chart-module request prints a React error while verifying that CRUD remains available. Automated accessibility checks do not establish complete accessibility compliance.

## Documentation screenshots

```bash
cd frontend
TEST_FRONTEND_PORT=5175 npm run screenshots
```

The same optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE` override applies. This is a separate capture suite using the disposable harness. It seeds only [the documentation dataset](screenshots/dataset.json), blocks external browser requests, fixes the displayed browser date, and saves seven JPEGs without traces, videos, passwords, or token dumps. See [screenshot provenance and gallery](screenshots/README.md).

## Dependency audits

```bash
npm --prefix frontend audit
```

Install `pip-audit` in a separate temporary tooling environment, not in the application's runtime requirements, and audit `requirements.txt`:

```bash
python3 -m venv /tmp/internship-audit
/tmp/internship-audit/bin/python -m pip install pip-audit
/tmp/internship-audit/bin/pip-audit -r requirements.txt
```

The requirements file pins the complete runtime set. An auditor can also check those pins with `--no-deps --disable-pip` after a clean installation and `pip check` establish that no runtime dependency is missing. Audits depend on registry availability and the advisory database at the time of the run; findings must not be silently ignored.

## GitHub Actions

[CI](../.github/workflows/ci.yml) runs on pushes to `master`, pull requests, and manual dispatch. It uses Ubuntu 24.04, Python 3.14, and Node 24. Official actions are pinned to verified commit SHAs. Permissions are limited to `contents: read`, checkout does not persist credentials, and there are no production secret inputs, deployments, or releases.

CI runs the current-tree secret and documentation checks, installs pinned backend dependencies, runs dependency consistency/SQLite tests, installs PostgreSQL 16 tools and runs disposable migration/API tests, installs the frontend lockfile, then runs unit tests, ESLint, and the build. It does not connect to a hosted PostgreSQL service or run browser screenshots; full browser/Axe tests remain explicit local verification. It also does not claim an all-history secret audit.

A workflow file can be validated locally, but its actual hosted status can only be known after it runs on GitHub. [Phase 2.6 verification and remaining limits](PHASE2_6_VERIFICATION.md). Earlier [Phase 2.5 results](VERIFICATION.md) are retained as historical evidence.
