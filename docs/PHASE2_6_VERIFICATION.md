# Phase 2.6 local verification

Phase 2.6 implements database reliability and schema integrity on top of `17893e6`. All implementation changes are uncommitted. No production database connection, credential access/change, schema inspection, stamping, migration, record mutation, deployment, push, or release was performed. The regular local developer database was also left untouched.

## Implemented changes

- Alembic 1.20.1, Mako 1.4.3, and MarkupSafe 3.0.4 are pinned alongside the existing backend dependencies.
- `schema.py` separates model metadata from `.env` loading and engine configuration. Application startup no longer calls `create_all()` or runs migrations. The runtime engine hides bound SQL parameters in SQLAlchemy error formatting.
- Models declare an owner index and named `ON DELETE RESTRICT` foreign key. Ownership authorization remains in API queries; the FK is not an authorization replacement.
- Protected endpoints reject correctly signed tokens for missing users. Failed internship writes roll back, and the named PostgreSQL ownership violation becomes a generic Bearer HTTP 401; unrelated errors are not silently classified as authentication failures.
- The explicit operator wrapper accepts exact revisions and verified legacy baselining only. It prohibits direct Alembic execution, offline mode, `head`/`base` shortcuts, and destructive baseline downgrades.
- The read-only preflight checks schema structure, index validity, FK state, sequence safety, aggregate orphan counts, and unexpected custom enforcement behavior. No row contents or driver-error details are printed.
- Migration connections require an explicit separate target, reject libpq overrides, force the public search path, use bounded timeouts, and hold a session-level single-operator advisory lock. Neither migration tool loads `.env`.
- Browser/capture and PostgreSQL integration harnesses initialize only newly created temporary clusters through Alembic. Tests disable dotenv loading and override database/signing settings.
- CI adds disposable PostgreSQL migration/API regressions with existing least-privilege permissions and immutable action pins; it takes no production secrets.

## Revision sequence

| Revision | Behavior |
| --- | --- |
| `0001_legacy_baseline` | Create the frozen legacy schema on empty targets; existing matching schemas receive only the verified baseline stamp |
| `0002_owner_index` | Separate concurrent `internships.user_id` index |
| `0003_owner_foreign_key` | Named FK to `users.id`, `ON DELETE RESTRICT`, `NOT VALID` |
| `0004_validate_owner_fk` | Separate historical validation, stopped if orphaned records remain |

## Observed test and audit results

| Check | Result |
| --- | --- |
| SQLite API and repository safeguards | 17 passed; opt-in PostgreSQL classes skipped in ordinary discovery |
| Disposable PostgreSQL migration/API suite | 33 passed: 19 migration/safety tests and 14 API regressions |
| PostgreSQL version exercised locally | 18.6 |
| ORM/migrated-schema comparison | No differences; Alembic check passed |
| Frontend unit tests | 8 passed |
| Chromium browser integration suite | 16 passed, including Axe, responsive layouts, authentication, CRUD, persistence, isolation, analytics, and navigation |
| ESLint | Passed |
| Production frontend build | Passed; emitted core asset hashes unchanged |
| Backend dependency consistency | `pip check` passed |
| Backend requirements audit | No known vulnerabilities found |
| Frontend npm audit | Zero known vulnerabilities |
| Source credential/sensitive-file scan | Passed; exact synthetic fixture allowance added only for PostgreSQL API test key |
| Generated frontend assets | Six files scanned without credential-pattern findings |
| Ignore/untracked checks | Environment files, local databases/backups, test artifacts, virtual environment, and build output excluded |
| Workflow syntax | actionlint v1.7.12 passed |
| Documentation links and Git whitespace | Checked locally with repository scripts and `git diff --check` |

The populated-legacy tests use a frozen SQL fixture, two synthetic users and three representative applications, plus an optional orphan. Full-row digests preserve every field, including password-hash placeholders, IDs, dates, statuses, optional values, and multiline notes across upgrades/downgrades. Sequence continuity is tested by subsequent inserts. No actual user information is involved.

Failure tests demonstrate schema/default/sequence drift rejection; missing-user rejection; actual owner-deletion race handling; invalid ownership inserts/updates; RESTRICT deletion; orphan preservation and validation refusal; concurrent-index interruption and invalid-index recovery; lock timeout without revision/data loss; single-operator exclusion; redacted read-only CLI behavior; no application-target fallback; and import without database access. Current/check commands do not create bookkeeping on an unversioned database.

Initial checks exposed Alembic treating its explicitly schema-qualified version table as an autogenerate removal; the configuration was corrected and both independent metadata comparison and the operator `check` now pass. Sandbox socket/thread restrictions required rerunning database/browser tests outside the sandbox, still against disposable/in-memory targets. No environment credentials were used for these reruns.

The browser suite intentionally aborts a chart-module load and emits its expected React diagnostic while confirming CRUD remains available. Final preflight refinements were subsequently verified by the complete PostgreSQL suite. Existing screenshots were retained; no frontend components, assets, API client, or frontend dependency declarations changed.

## Files added

- `schema.py`, `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako`, and four files under `alembic/versions/`.
- `scripts/migrate.py` and `scripts/schema_preflight.py`.
- `tests/disposable_postgres.py`, `tests/fixtures/legacy_schema.sql`, and `tests/test_migrations.py`.
- `docs/DATABASE_MIGRATIONS.md` and this verification report.

## Files modified

- `main.py`, `database.py`, `models.py`, and `requirements.txt`.
- `tests/test_api.py`, `tests/serve_test_api.py`, and `scripts/check_secrets.py`.
- `.github/workflows/ci.yml`.
- Root README and documentation index, architecture, case study, development, testing, deployment, and repository-audit documents.

## Remaining production gates and compatibility concerns

The production server version/schema, roles, backups/PITR capabilities, record counts, and orphan count remain unknown. Local PostgreSQL 18.6 passed; CI is configured for PostgreSQL 16 on Ubuntu 24.04 but has not run on GitHub. Rehearse against the actual production major version before approval to migrate. No production backup was taken or restored during this task.

Existing valid-user JWTs and API contracts remain compatible. A token referencing a nonexistent user now receives HTTP 401. The new runtime can operate on a populated legacy schema before index/FK installation; empty environments need explicit migrations. Production records are not protected by the new FK until an approved operator installs it, and historical integrity is not established until validation succeeds.

Concurrent index work is nontransactional: a failed run can leave an invalid index or a valid index with an older revision marker. Earlier revisions stay committed if a later revision fails. `NOT VALID` preserves existing orphans but does not claim they satisfy integrity. All such states require inspection and explicit recovery, never automatic deletion/reassignment or stamp-head shortcuts.

Before release: obtain approval, privately verify the target and version, verify backup/restore, rehearse on the matching major version, resolve schema drift, baseline only the exact legacy revision, apply each additive step with its preflight, and validate only with zero orphans. Coordinate branch auto-deploy so a push does not bypass the approved release order.

Stop for unknown target/approval/backup/privileges, any preflight failure or drift, sequence problems, held operator lock, lock/statement timeouts, unexpected/invalid indexes, revision/schema disagreement, unresolved orphans, disabled enforcement, unexplained record changes, or API/load regressions. The [runbook](DATABASE_MIGRATIONS.md#exact-stopping-conditions) contains exact gates, locks, procedures, and recovery boundaries.

Schema constraints for statuses/string lengths, authentication rate limiting/recovery, refresh/revocation/token-storage changes, row-level security, pagination, load testing, native-browser coverage, and actual disaster-recovery rehearsal remain separate work. Secret checks are practical source/build heuristics, not an all-history or exhaustive credential audit.
