# Deployment reference

The application uses separate Vercel frontend and Render API deployments. This guide describes the repository's requirements; it does not assert that private hosting settings have been inspected. Pushing to a linked production branch may trigger hosting builds automatically.

## Frontend: Vercel

- Repository root directory for the project: `frontend`.
- Runtime/toolchain: Node 24, install from `package-lock.json` with `npm ci`.
- Build: `npm run build`; output: `dist`.
- Public build variable: `VITE_API_URL=https://internship-tracker-ak3q.onrender.com`.
- Never configure database passwords or signing secrets as frontend variables.

The production fallback already uses the Render API URL. Rebuild if the API base URL changes. Routes use hashes: `/#/login`, `/#/signup`, `/#/overview`, and `/#/applications`. Fragments are resolved in the browser; these routes work with a static root page and do not require SPA path rewrites. Bare `/applications` is not the application's route.

## Backend: Render

- Repository root directory: repository root.
- Install: `pip install -r requirements.txt` in a clean dependency environment.
- Start: `uvicorn main:app --host 0.0.0.0 --port "$PORT"`.
- Private runtime variables: `DATABASE_URL` and `SECRET_KEY`.
- Optional public-origin setting: `CORS_ORIGINS`, containing exact allowed origins without paths or wildcards.

Use the existing production database and signing key for ordinary updates. The PyJWT migration preserves valid HS256 tokens with the same key. If migrating from an older cached environment, clear the build cache or rebuild the environment so removed python-jose/ecdsa packages do not remain installed; pip does not uninstall removed requirements automatically.

Both supplied Vercel hostnames are currently in the backend allowlist. A new preview/custom hostname needs an explicit trusted-origin decision. Deployment protection and CORS are separate controls.

## Schema changes require a separate plan

There is no migration runner. Startup `create_all()` is not a schema migration. Before adding foreign keys, constraints, or status-history tables, create a reviewed migration, audit existing data, define orphan/deletion behavior, test on staging, and prepare backups and rollback. Do not use seed scripts, table resets, or development fixtures against production.

## Verification after an approved deployment

1. Compare the deployed commit IDs in both hosting dashboards with the intended Git commit.
2. Check successful build/start logs without copying environment values or request credentials.
3. Open the public landing page and refresh `/#/login`. Test direct protected routes without authenticating; they should redirect to login.
4. Safe API checks are GET `/`, unauthenticated GET `/internships` (401), and CORS OPTIONS requests from the actual frontend origin. The root greeting alone does not establish database connectivity.
5. Successful production authentication can be checked manually with an existing account. Do not change that account's records as part of a read-only verification.
6. Run signup and CRUD smoke tests only in an isolated staging environment or with separate explicit approval for disposable production test data.

No workflow in this repository deploys, runs migrations, or publishes releases. The CI workflow verifies code only.

[Back to documentation](README.md).
