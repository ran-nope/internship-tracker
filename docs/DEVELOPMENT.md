# Local development

## Prerequisites

The verification environment uses Python 3.14 and Node 24. Install those runtimes and PostgreSQL locally. For browser tests/captures, also install PostgreSQL server tools (`pg_config`, `initdb`, `pg_ctl`) and a Playwright-compatible Chromium browser. Do not run disposable PostgreSQL tests as root.

## Install

```bash
git clone https://github.com/ran-nope/internship-tracker.git
cd internship-tracker
python3.14 -m venv venv
source venv/bin/activate
python -m pip install -r requirements.txt
npm --prefix frontend ci
cp .env.example .env
cp frontend/.env.example frontend/.env.local
chmod 600 .env
```

The backend requirements are pinned; `npm ci` uses the frontend lockfile. Alembic and its dependencies are included for explicit migrations. The application package has no project-wide license; see the [README license note](../README.md#license).

## Create a local PostgreSQL database

On Ubuntu with a locally installed PostgreSQL service, the following commands create a dedicated development role/database. Skip creation if they already exist; do not run them against a hosted service or an existing production database.

```bash
sudo -u postgres createuser --pwprompt internship_user
sudo -u postgres createdb --owner=internship_user internship_db
```

The password prompt is interactive. Choose a local password and place it only in your ignored `.env`. Edit the template's `DATABASE_URL` for this role and database. URL-encode password characters that have meaning in a URL. Keep database backups under ignored `backups/` or `dumps/`, not in source control.

## Environment variables

| Variable | Where | Required | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Root `.env` / backend hosting | Yes | SQLAlchemy PostgreSQL URL |
| `SECRET_KEY` | Root `.env` / backend hosting | Yes | Private random HS256 signing secret; use at least 32 random bytes |
| `CORS_ORIGINS` | Root `.env` / backend hosting | Optional | Additional comma-separated exact HTTP(S) browser origins |
| `VITE_API_URL` | `frontend/.env.local` / Vercel build environment | Optional | Public API base URL; development and production defaults exist |
| `PORT` | Render runtime | Hosting provided | Passed to Uvicorn by the startup command |

Backend template values (placeholders only):

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/DATABASE
SECRET_KEY=replace-with-a-long-random-secret
CORS_ORIGINS=http://localhost:5173
```

Generate a unique random signing secret locally with a trusted password manager or secret-generation tool, and store it directly in `.env`. Never reuse the synthetic test keys. `.env.example` is documentation, not a usable credential file.

Frontend development setting:

```dotenv
VITE_API_URL=http://127.0.0.1:8000
```

The frontend example deliberately points to loopback. Configure the production URL separately in Vercel. All `VITE_*` values are included in browser assets. Backend environment values take precedence over `.env` values because the dotenv loader does not override existing variables.

## Initialize or baseline the local schema

Application startup no longer creates tables. Migration tools use only an explicitly supplied `MIGRATION_DATABASE_URL`; they never load `.env` or fall back to `DATABASE_URL`. Set this through a trusted environment/secret mechanism after confirming it identifies the intended local database. Do not put a credentialed URL into shell history or print it.

For a **new empty local database**, run each revision explicitly:

```bash
venv/bin/python -B scripts/migrate.py upgrade 0001_legacy_baseline
venv/bin/python -B scripts/migrate.py upgrade 0002_owner_index
venv/bin/python -B scripts/migrate.py upgrade 0003_owner_foreign_key
venv/bin/python -B scripts/migrate.py upgrade 0004_validate_owner_fk
venv/bin/python -B scripts/schema_preflight.py --stage validated
```

For an **existing populated local database**, preserve it: back it up, run the unversioned legacy preflight, baseline only if it matches, then apply the incremental revisions. Do not run baseline CREATE TABLE operations against it. See the [migration runbook](DATABASE_MIGRATIONS.md). The Phase 2.6 verification process itself touches only newly created disposable clusters, not your regular local database.

## Start the application

Terminal one, repository root:

```bash
source venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000
```

Terminal two, repository root:

```bash
npm --prefix frontend run dev -- --host localhost --port 5173 --strictPort
```

Open `http://localhost:5173`. The local API greeting is at `http://127.0.0.1:8000/`. The API performs no schema changes on startup. Missing schema must be addressed through the manual migration process. [Database migration procedures](DATABASE_MIGRATIONS.md).

## Common development issues

- **CORS:** origins include scheme, hostname, and port. The current allowlist includes localhost:5173, localhost:5174, and 127.0.0.1:5173. Add an exact local origin through `CORS_ORIGINS` if you choose a different one. Restart the API after changing backend configuration.
- **Wrong API target:** inspect `VITE_API_URL` without exposing credentials. Restart Vite after changing `.env.local`; production builds must be rebuilt after changing build-time values.
- **Port in use:** use another frontend port with matching CORS, or stop your own development server. Tests refuse to reuse a server because it might connect to the wrong database.
- **401 after a key change:** JWTs signed with the old key are invalid; log in again. Changing keys is not required for ordinary code updates.
- **Signup password validation:** the bcrypt limit is 72 UTF-8 bytes, which can be fewer than 72 Unicode characters. Inputs are rejected rather than truncated.
- **Swagger authorization:** the API accepts JSON login, while the autogenerated OAuth2 form expects form fields. Use the application's login UI or an API client with JSON followed by a Bearer header.

[Tests and screenshot capture](TESTING.md) · [Back to documentation](README.md).
