# Local maintenance verification

This uncommitted change builds on Phase 2.6 commit `9cdc635`. No files are staged. No Render/Vercel setting, production credential, production database, record, migration state, deployment, push, or release was accessed or changed during implementation. Only newly created disposable local PostgreSQL clusters and in-memory SQLite were used for database tests. No regular local developer database was modified.

The owner's reported Neon migration completion is recorded as context in the [cutover runbook](MAINTENANCE_CUTOVER.md), not as a new verification performed by this work.

## Implementation

- `maintenance.py`: immutable process settings, strict boolean parsing, public commit/instance identifiers, and a pure ASGI early-write gate. It loads no environment files and opens no connections itself.
- `db_runtime.py`: lazy engine construction with pre-ping, hidden SQL bind parameters, PostgreSQL connect timeout, non-secret connection identification, and per-transaction application-session read-only protection.
- `database.py`: load existing backend configuration once, construct settings/engine/session factory without opening a connection.
- `main.py`: register the gate inside outer CORS, expose uncached GET/HEAD status, log non-secret lifecycle metadata, and dispose the pool during graceful shutdown. Existing business endpoints/response bodies are preserved when maintenance is disabled. HEAD is added to the allowed CORS methods for status/preflight clients.
- Existing POST login remains an explicit read-only exception. All other non-GET/HEAD/OPTIONS requests are rejected with JSON HTTP 503 before body/auth/validation/database work when maintenance is enabled. There is no HTTP bypass or toggle.
- PostgreSQL `SET TRANSACTION READ ONLY` is applied at each new outer ORM transaction, including after commit/rollback. It does not change role/database/session defaults and does not persist into the next normal pooled session.
- `.env.example` documents the optional default-off startup flag. Actual `.env` files are untouched. No dependency, Alembic revision, schema, frontend component, or hosting configuration was changed.

## Observed checks

| Check | Observed result |
| --- | --- |
| Backend/API/repository/maintenance unit suite | 22 passed; 39 PostgreSQL cases skipped in ordinary discovery and executed separately |
| Disposable PostgreSQL suite | 39 passed: 19 migration safety tests, 15 API regressions, and 5 maintenance/connection tests |
| Local PostgreSQL version | 18.6 |
| Frontend unit suite | 9 passed, including maintenance message/session/no-retry behavior |
| Full Chromium integration suite | 16 passed, including normal auth/CRUD, persistence, user isolation, analytics, responsive layouts, navigation, and Axe checks |
| ESLint | Passed |
| Frontend production build | Passed; core emitted asset names/hashes unchanged |
| Backend dependency consistency | `pip check` passed |
| Backend dependency audit | No known vulnerabilities found |
| Frontend npm audit | Zero known vulnerabilities |
| Source/sensitive-file scan | Passed; no new broad fixture exclusions |
| Documentation checks | Local links/anchors checked with `scripts/check_docs.py` |
| Workflow syntax | Existing workflow passed actionlint; discovery automatically includes the new tests |
| Whitespace/index scope | `git diff --check` and unstaged-only checks |

The first sandbox frontend run reported stream-descriptor restrictions and file-level totals. The individual unit tests were rerun outside the sandbox and all nine passed. Backend/browser tests also ran outside the restrictive sandbox as needed, while retaining their disposable-only data isolation. The chart-download failure diagnostic is expected in the browser scenario that intentionally aborts that module. No real hosted HTTP or database requests were made.

## What the tests establish

- Anonymous and synthetic authenticated mutation requests receive 503 without downstream calls or body reads, including invalid JSON and unknown mutation methods/paths.
- Allowed-origin CORS headers remain on maintenance responses; preflights succeed and untrusted origins remain excluded.
- Actual application startup in maintenance can serve status and reject writes with an unreachable loopback database URL and a forbidden session factory, proving these paths need no database access. Status is stable per instance, uncached, HEAD-safe, and changing the process environment after import does not hot-toggle it.
- Existing PostgreSQL users can log in and read only their owned records during maintenance; invalid tokens remain rejected. Mutation attempts leave records unchanged, and normal updates/deletes/signup work after returning to normal sessions.
- A real PostgreSQL read-only transaction rejects INSERT with SQLSTATE 25006. Commit, rollback, and savepoints preserve the intended guard. The same physical backend connection is writable when subsequently reused by a normal session; `default_transaction_read_only` stays off.
- Terminating an idle connection inside a disposable cluster causes pre-ping to replace it successfully. Terminating an in-flight transaction causes failure without replay or a committed synthetic row.
- A legacy-admitted transaction can commit after a newly gated app already returns 503. Therefore status/probes alone do not prove a final data checkpoint is safe.

## Files changed

Added:

- `maintenance.py`
- `db_runtime.py`
- `tests/asgi_helpers.py`
- `tests/test_maintenance.py`
- `docs/MAINTENANCE_CUTOVER.md`
- `docs/MAINTENANCE_VERIFICATION.md`

Modified:

- `.env.example`, `database.py`, and `main.py`.
- `tests/test_api.py`, `tests/test_migrations.py`, `tests/serve_test_api.py`, and `tests/api.test.mjs`.
- `README.md`, `docs/README.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/DEPLOYMENT.md`, `docs/DATABASE_MIGRATIONS.md`, and `docs/TESTING.md`.

## Remaining gates and limitations

Local tests do not prove hosted Neon PgBouncer/TLS behavior, Render process retirement, actual production connection targeting, live data equality, or hosted CI success. The SQLite suite tests normal API behavior; PostgreSQL-specific read-only enforcement is established by the real PostgreSQL suite. Pre-ping does not rescue a mid-transaction failure or resolve an uncertain commit outcome. No automatic write retry or cross-database synchronization exists.

An old ungated instance, external SQL client, raw engine connection, or previously admitted request is not fenced by the new process's flag. Before accepting a freeze, the operator must establish old-generation termination and transaction drain, account for other writers, pass harmless probes, and repeat the final data comparison. Any ambiguity stops the switch. A successful deployment, a fixed sleep, or repeated matching probes does not replace that evidence.

Keep maintenance true while changing the target and through the source/target deployment overlap. Reopen only after a separately approved acceptance step. Retain recovery material and review rollback code/environment together; restoring an older deployment can restore an unsafe flag or database target. No paid maintenance mode, SSH/private ingress, distributed lock service, new database migration, production session termination, or database-wide permission fence is required or performed by this implementation.
