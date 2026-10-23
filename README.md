# Internship Tracker

React/Vite frontend (`frontend/src/App.jsx`), FastAPI endpoints and JWT authentication
(`main.py`), SQLAlchemy connection/session configuration (`database.py`), and user
and internship tables (`models.py`). PostgreSQL is the deployment database.

## Configuration

Use `.env.example` as a template for backend configuration. Keep real `.env` files
out of source control. The API requires `DATABASE_URL` and `SECRET_KEY`.
`CORS_ORIGINS` adds comma-separated trusted frontend origins to the existing
localhost and Vercel allowlist. Use origins only (scheme and hostname, plus a port
for local development), not page paths. Do not allow all Vercel subdomains.

For Vercel, use `frontend` as the project root, `npm run build` as the build command,
and `dist` as the output directory. Set `VITE_API_URL` to
`https://internship-tracker-ak3q.onrender.com` in each relevant Vercel environment.
Vite embeds this value at build time, so changing it requires a new build.
A production build without the variable uses this Render address; development
uses `http://127.0.0.1:8000`. URL joining trims whitespace and boundary slashes.

Run the backend with `uvicorn main:app --host 0.0.0.0 --port "$PORT"` on Render.
Keep Render's existing database credentials and JWT secret; changing the JWT
secret invalidates existing tokens. No database migration is needed for this patch.

## Validation

```
venv/bin/python -B -m unittest discover -s tests -v
node --test tests/api.test.mjs
cd frontend
npm run lint
npm run build
```

Backend tests must run in a fresh process as shown: they replace database and JWT
settings before importing the application and use SQLite entirely in memory.
They cover signup, login, duplicate usernames, invalid credentials/tokens,
authenticated CRUD, account isolation, Unicode password limits, URL validation,
allowed/rejected CORS preflights, and CORS headers on server errors. PostgreSQL
connection settings and migrations are not exercised by these tests.

## Deployment diagnosis (2026-10-23)

No production accounts or records were created or changed during diagnosis.

- Both supplied Vercel origins passed deployed login preflights with HTTP 200 and
  the matching `Access-Control-Allow-Origin` header.
- The branch alias `https://internship-tracker-git-master-kpc13.vercel.app`
  redirected unauthenticated requests to Vercel login. Its app bundle could not be
  inspected without deployment access. Review Vercel Deployment Protection if this
  alias should be public; protection is separate from backend CORS.
- `https://internship-tracker-seven-alpha.vercel.app` served the app publicly. Its
  JavaScript bundle used the correct Render API address and already removed
  trailing slashes. Double slashes were not present in that inspected configuration.
- A credential-free empty login payload returned HTTP 422 with matching CORS
  headers. An unauthenticated GET `/internships` returned HTTP 401 with matching
  CORS headers. Successful production authentication was intentionally not tested.

These observations rule out a blanket CORS allowlist failure at inspection time.
They do not establish the cause of a database-dependent production signup/login
failure. If it persists, inspect the actual browser Request URL, status and
response, and the corresponding Render traceback privately. Do not share tokens,
passwords, connection strings, or request bodies. A backend 500 can look like a
CORS failure when the error response lacks CORS headers.

The patch wraps the entire FastAPI application in CORS middleware, validates
bcrypt's 72-byte UTF-8 limit before hashing/checking, handles signup uniqueness
races, and displays structured API validation errors. It also prevents stale
mutation responses from changing a new session, blocks form submission during
initial loading/saving, and repairs desktop auth styles and dark-mode contrast.

Other follow-ups: `create_all()` does not migrate existing tables; use migrations
for future schema changes. `internships.user_id` currently lacks a database foreign
key; introducing one requires an orphan-data audit and a migration. The OAuth2
Swagger password-flow form does not match the JSON `/login` contract, so Swagger's
Authorize flow needs a separate compatibility change if desired. None of those
schema/auth-contract changes are included here.

## Release verification

Before pushing, review `git show --stat HEAD` and confirm the intended commit and
branch in both hosting dashboards. A push to the configured deployment branch can
trigger builds automatically. No database migration or data cleanup is part of
this release.

A local history scan found the current local database connection string in earlier
commits. Treat the database credential as exposed: rotate it through the database
provider, update Render and your local environment privately, and verify the
service can reconnect. Do not paste it into Git, logs, tickets, or chat. Removing
it from current files does not remove historical exposure. History rewriting
requires separate coordination and is not performed by this patch.

Render configuration to check privately:

- Repository `ran-nope/internship-tracker`, intended deployment branch `master`.
- Backend root is the repository root; build `pip install -r requirements.txt`.
- Start `uvicorn main:app --host 0.0.0.0 --port "$PORT"`.
- `DATABASE_URL` points to the intended PostgreSQL database with valid rotated
  credentials. Retain the existing JWT `SECRET_KEY` unless deliberately revoking
  tokens. `CORS_ORIGINS` may include both supplied Vercel origins; both are already
  included by default.
- Confirm the expected commit becomes Live and inspect startup logs. Do not run
  seed scripts, reset tables, or apply unrelated schema changes.

Vercel configuration to check privately:

- Repository and intended production branch match the release; root `frontend`,
  build `npm run build`, output `dist`.
- `VITE_API_URL=https://internship-tracker-ak3q.onrender.com` is set for Production
  and any Preview branch being tested. A change requires a new build.
- No database password, JWT signing key, or other secrets belong in `VITE_*`.
- Confirm the same release commit is Ready and inspect which Domains are assigned
  to it. A branch alias alone does not prove which deployment is production.
- Review Deployment Protection for the branch alias; do not disable it without
  deciding whether that deployment should be publicly accessible.

After deployment, safe production smoke checks are GET `/` (200), unauthenticated
GET `/internships` (401), and OPTIONS `/signup`, `/login`, `/internships` with the
actual browser Origin and requested method/headers (200 with that exact allowed
origin). The root endpoint alone does not prove database connectivity.

For successful signup/login and full CRUD, use a Vercel staging deployment backed
by a separate Render service and non-production database. Set its API URL and
explicit CORS origin accordingly. In that environment:

1. Sign up with a unique test username, then log in. Expect 200 and a dashboard.
2. Add a clearly marked test internship with all optional fields. Refresh and
   confirm it persists and appears once.
3. Edit its status and notes; refresh and verify the saved values.
4. Search/filter the record. Log out and back in to confirm persistence.
5. Delete only that staging test record; refresh and confirm it remains absent.
6. Confirm another staging account cannot see or change the first account's data.
7. In browser Network tools, check that requests target the expected Render host,
   use one slash at the path boundary, and authenticated calls include Bearer
   authorization. Do not share token values or request passwords.

Under the instruction to avoid production-record modifications, do not perform
production signup or create/update/delete operations. A production login and
read-only list check can be done manually with an existing account; do not change
its records. Full production CRUD would require separate authorization for
explicit disposable test data. The current local tests already exercise full CRUD
against an in-memory database.
