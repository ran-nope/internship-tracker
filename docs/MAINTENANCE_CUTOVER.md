# Free-hosting maintenance and database cutover

This is an operator runbook, not permission to deploy or access databases. Implementation and verification use local files, synthetic data, and disposable PostgreSQL only. No paid feature, external lock service, new dependency, migration, or shared demo account is required.

The owner reports Neon PostgreSQL 18.6 is already at `0004_validate_owner_fk`, with validated preflight/model comparison, 1 user, 3 internships, zero orphans, and matching Render/Neon record hashes at the last comparison. Those are operator-provided historical observations, not a new production inspection. The live backend still points to Render. Repeat the data comparison after establishing a real freeze; earlier equality does not cover later writes.

## Runtime behavior

`MAINTENANCE_MODE` defaults to `false`. Only `true` or `false` are accepted, case-insensitively with surrounding whitespace trimmed. Empty strings, `1`, `0`, `yes`, and other values fail startup with a fixed error that does not echo the supplied value. Settings are captured once per process after normal backend environment loading. An environment edit alone does not affect running processes: restart/redeploy is required.

| Request | Maintenance enabled |
| --- | --- |
| POST signup, POST internships, PUT/DELETE internship | HTTP 503 before authentication, body consumption, validation, or database access |
| Other non-GET/HEAD/OPTIONS methods, including unknown mutation paths | HTTP 503 by default |
| POST `/login` and its existing trailing-slash redirect form | Allowed because this operation only reads credentials and issues a JWT |
| GET/HEAD, including owned reads and status | Pass through existing routing/authentication; this does not add HEAD support to old routes that lack it |
| OPTIONS | Existing outer CORS handling remains available |

Blocked responses are JSON with `Cache-Control: no-store`:

```json
{"detail":"The application is temporarily read-only for database maintenance. Please try again later."}
```

CORS wraps the entire application, including the gate. Existing tokens and direct API clients do not bypass it. There is no admin endpoint, header, token, query parameter, or body flag that toggles/bypasses maintenance. The frontend displays the existing API error message without logging out or automatically replaying writes. Read-only access still requires valid authentication and ownership. Future read-only POST exceptions must be explicitly reviewed; login must remain non-writing.

## Transaction and pool protection

Application sessions use `ApplicationSession` through `SessionLocal`. During maintenance, its `after_begin` listener issues `SET TRANSACTION READ ONLY` at the start of each outer PostgreSQL transaction. It reapplies after commit/rollback and protects nested transactions through their outer transaction. This is not `SET SESSION`, `SET default_transaction_read_only`, or a role/database alteration. Commit/rollback and normal pool reset end the setting; the next non-maintenance session remains writable.

The guard covers application ORM sessions, not arbitrary raw engine connections, other processes, SQL clients, or Alembic. It is PostgreSQL-specific; SQLite remains the isolated ordinary API test backend, while real PostgreSQL tests establish read-only enforcement. A future developer must not move application database operations outside the protected session factory.

Runtime connections use `pool_pre_ping=True`, a PostgreSQL connect timeout of 10 seconds, hidden SQL bind parameters, and a non-secret `application_name` containing a short release plus the full instance identifier. No pool-recycle/size tuning or automatic write retry was added. Pre-ping replaces stale connections at checkout; a disconnect during a transaction still fails that transaction. If a commit outcome is uncertain, investigate it before retrying.

Use Neon's pooled endpoint for ordinary application transactions after connection-path verification. Use its direct endpoint for administrative checks and migrations: the operator wrapper's session advisory lock requires a persistent session. This implementation does not connect to Neon, prove actual pooler behavior, enforce a Neon hostname/TLS policy, or modify operator migration code. Retain secure Neon SSL/channel-binding settings when configuring the future runtime.

## Status and logs

`GET /status` is database-independent and uncached. `HEAD /status` returns the same representation headers without a body. The existing root greeting remains unchanged.

```json
{"maintenance_mode":true,"release":"local","instance_id":"illustrative-non-secret-generation-id"}
```

The actual instance identifier is a random 32-character hexadecimal value generated per process. `release` uses `RENDER_GIT_COMMIT` only if it is a 7–40 character hexadecimal commit identifier; otherwise it is `local`. No arbitrary environment values, database identity/URL, records, user information, or credentials appear in status. Startup/shutdown logs contain these same fields; graceful shutdown disposes the connection pool.

A status response describes only the responding process. It does not aggregate instances or prove that an older process has stopped. A shutdown log helps correlate generations but does not replace platform termination evidence. A successful status/root response also does not prove database connectivity.

## What this gate cannot do

An older instance without this code can keep admitting writes while Render replaces it. A request admitted by that instance may commit after the new instance already reports maintenance. No process-local flag can retrospectively fence such a request.

Render Free's single steady-state instance limit does not eliminate deployment overlap. Render documents routing changes followed by delayed SIGTERM and a configured graceful-shutdown interval before forced termination. Use actual deployment events, generation/process logs, and applicable shutdown configuration; do not equate "Live", a fixed sleep, repeated probes, or unchanged counts alone with termination. [Deployment lifecycle](https://render.com/docs/deploys).

Free services lack SSH/dashboard shell access and inbound private networking. Use public read-only status, dashboard logs/events, and a separately approved external read-only database connection for activity/data verification. No paid maintenance mode or shell is assumed. Free services may restart/spin down, so no local file or in-memory HTTP toggle is used as the persistent switch. The hosted environment flag must remain enabled across every restart. [Render Free limitations](https://render.com/docs/free).

## Exact procedure for establishing a verified write freeze

Every hosting change, push, deployment, and production inspection below requires separate approval. Do not run application writes as probes.

1. **Prepare recovery and release controls.** Retain verified backups and a recoverable old database, check its expiry/retention, record the intended maintenance-capable release, and pause competing automatic deployments/hooks on Render/Vercel through approved controls. Confirm build/start commands perform no production migration. Keep `SECRET_KEY`, CORS, and frontend API URL unchanged.
2. **Start the gate against the current source.** With `DATABASE_URL` still pointing to Render, configure `MAINTENANCE_MODE=true` and deploy the approved maintenance-capable release. Setting the variable before code supporting it is live does not freeze older code. Failed startup or deploy fallback is not a freeze.
3. **Identify the new generation.** Confirm the intended commit, uncached `/status` reporting `maintenance_mode:true`, and matching generation/release startup logs. Keep the source database unchanged.
4. **Prove old-generation retirement.** Confirm all previous workers/instances have terminated using platform events and shutdown/process logs, accounting for the documented overlap and actual shutdown delay. Separately approved database inspection must confirm their connections/in-flight transactions are drained. The connection application name identifies new generations; untagged legacy/other sessions require private attribution. Zero active transactions alone does not prove a surviving old process cannot reconnect. Stop other scripts/admin writers and account for any background jobs.
5. **Probe the backend gate harmlessly.** Repeat the credential-free probes below against every public backend hostname, including the Render URL. Require 503, the maintenance JSON detail, and `Cache-Control:no-store`; verify allowed-origin CORS behavior. A 401/404/405/422 or success from these mutation probes is not acceptable freeze evidence. Platform loading/timeout responses also require investigation. A status/probe sample cannot prove absence of an unseen old process.
6. **Establish the quiet checkpoint.** Only after steps 3–5 and all writer attribution/drain checks pass, repeat a consistent full-data comparison, current counts, safe-sequence checks, and Neon's validated preflight/revision/model check through approved read-only tools. Compare private records without logging contents, connection strings, password hashes, or tokens. The last 1-user/3-internship count is an expected checkpoint only if no later legitimate writes occurred; unexplained changes or hash mismatches stop the switch. Any late legacy commits must be included in the comparison. Reconciliation is a separate approved procedure, not an automatic overwrite/import.
7. **Accept the freeze explicitly.** Record the non-secret release/generation identifiers, old-generation retirement evidence, drained-writer evidence, passing probes, final comparison result, and checkpoint time. If termination/quiescence cannot be established, STOP. A stronger database-side fence would need separate approval and privilege review; it is not claimed or implemented here.

### Harmless probe commands

These examples are for later approved execution only. They contain no credentials and cannot mutate records through the currently known old API: signup/create/update bodies are invalid, and protected mutations have no authorization. They must never be replaced with real records, valid signup data, or authenticated DELETE requests.

```bash
curl --silent --show-error --max-time 30 https://internship-tracker-ak3q.onrender.com/status
curl --silent --show-error --max-time 30 -i -X POST -H 'Content-Type: application/json' --data '{}' https://internship-tracker-ak3q.onrender.com/signup
curl --silent --show-error --max-time 30 -i -X POST -H 'Content-Type: application/json' --data '{}' https://internship-tracker-ak3q.onrender.com/internships
curl --silent --show-error --max-time 30 -i -X PUT -H 'Content-Type: application/json' --data '{}' https://internship-tracker-ak3q.onrender.com/internships/0
curl --silent --show-error --max-time 30 -i -X DELETE https://internship-tracker-ak3q.onrender.com/internships/0
```

Inspect the HTTP status as well as the JSON; ordinary curl exit success alone does not mean HTTP 503 was received. A trailing-slash variant must also be gated. For a browser-like check, repeat an invalid-body POST with the actual allowed frontend Origin header and verify its matching CORS response. OPTIONS should retain normal preflight behavior. Do not send stored browser credentials/tokens in probes.

## Keep the freeze through the database switch

| Generation | Runtime target | Flag | Meaning |
| --- | --- | --- | --- |
| A: old ungated code | Render | Ignored/absent | No freeze until A is terminated and admitted writes drain |
| B: maintenance-capable code | Render | true | Source is read-only through B |
| C: same approved gate-capable code | Neon pooled | true | Both B and C reject writes during overlap |
| D: reopening release | Neon pooled | false | Writes reopen only after acceptance |

After the accepted quiet checkpoint, change only the runtime `DATABASE_URL`, retain `MAINTENANCE_MODE=true`, and deliberately redeploy the verified gate-capable release. An environment save without deploy does not retarget existing engines. Verify actual runtime connectivity/target using authorized read-only checks, not just saved settings or `/status`. Preserve SSL settings, signing key, API hostname, and CORS. The frontend continues to call Render HTTPS, never a database URL.

Wait for B to terminate and drain before final Neon-only acceptance. During B/C overlap, reads may reach different databases despite both rejecting writes. Require `/status` true for each observed C process, blocked probes, unchanged approved record checkpoint, and successful existing-account login/owned reads. Repeat the direct Neon validated preflight/current/check if approved; no upgrade/stamp is needed because the owner has already completed migrations.

Only then, with separate approval, redeploy with the Neon target unchanged and maintenance disabled. During C/D overlap, both read Neon and only D admits writes. Confirm D status and normal behavior; keep the old database available but unused by writers. Any automatic/manual rollback that reintroduces A or restores an unsafe flag/old URL invalidates the freeze.

Full signup/CRUD and two-user isolation tests run on synthetic disposable/staging data. Do not create accounts or edit existing production records to verify the cutover without separate data-change approval. Timed-out pre-freeze mutations may have uncertain outcomes; refresh/check state before a human retries. No request replay or dual-write mechanism exists.

## Recovery and mandatory stops

Keep maintenance enabled while diagnosing failure. If a new deployment fails, the old instance may keep serving; establish which generation/target it uses before doing anything else.

- Before Neon has accepted any writes, returning to the old Render target is possible only after equality and recovery state are verified. Use gate-capable code with the flag still true, verify the target and data, then separately approve reopening.
- After Neon accepts writes, it is authoritative. Re-freeze and prefer fixing forward or explicitly deploying compatible code with Neon retained. Do not switch to a stale Render database.
- Render rollback can restore previous environment settings. Review its code/URL/flag combination; never blindly roll back to an ungated release. Free rollback artifact retention is limited, so retain the known release reference for rebuilding if needed. [Render rollback behavior](https://render.com/docs/rollbacks).
- Do not rerun migrations, reset tables, repair sequences, delete records, restore over live data, revoke role privileges, terminate production sessions, or remove the old database automatically. Each would require its own approval.

Stop for failed/ambiguous maintenance status, an ungated probe, unknown old-instance status, unresolved transactions/writers, uncertain mutation outcomes, unexpected data differences, failed schema/sequence checks, incorrect runtime target, startup/configuration failure, unexpected token invalidation, TLS/pool/connectivity errors, or unavailable recovery material.

## Tests and limits

[Testing commands](TESTING.md#maintenance-and-connection-safety) cover early rejection, CORS, sessions, direct clients, read-only transaction reuse, reconnects, and a late old-generation commit. The real PostgreSQL tests run only against clusters created by the harness. No production termination, activity, hash, target, pooler, or cutover verification is established by passing local tests.

[Local verification](MAINTENANCE_VERIFICATION.md) · [Deployment](DEPLOYMENT.md) · [Database runbook](DATABASE_MIGRATIONS.md).
