# Internship Tracker

A full-stack application for organizing internship applications, tracking progress, and keeping the details of a job search in one place. Built with React, FastAPI, PostgreSQL, and JWT authentication.

**[Open the live application](https://internship-tracker-seven-alpha.vercel.app)** · [Engineering case study](docs/CASE_STUDY.md) · [Architecture](docs/ARCHITECTURE.md) · [Local setup](docs/DEVELOPMENT.md)

![Application dashboard showing a synthetic internship search, current statuses, and application trends](docs/screenshots/dashboard.jpg)

*Actual application screenshots captured locally with one fictional dataset. The application does not contain AI recommendations or machine-learning models; AI and data science appear only as example internship roles.*

## Why this project

An internship search creates scattered job links, application dates, status updates, and notes. Internship Tracker brings them into a private workspace with searchable records and a clear view of application activity. It demonstrates how a React interface, authenticated REST API, relational persistence, and automated regression tests fit together in a deployed product.

## Explore the application

| Public landing page | Application management |
| --- | --- |
| ![Landing page and clearly labeled illustrative dashboard preview](docs/screenshots/landing.jpg) | ![Searchable application table with fictional software engineering, AI, and data science roles](docs/screenshots/applications.jpg) |

<details>
<summary>More screenshots: authentication, analytics, dark mode, and mobile</summary>

| Login | Analytics |
| --- | --- |
| ![Login page with empty credential fields](docs/screenshots/login.jpg) | ![Application-date trend and current-status breakdown from the same fictional dataset](docs/screenshots/analytics.jpg) |

![Dashboard in dark mode using the same fictional records](docs/screenshots/dark-mode.jpg)

<img src="docs/screenshots/mobile.jpg" alt="Mobile application cards with fictional internship records" width="320">

</details>

[View the complete gallery and dataset provenance](docs/screenshots/README.md). There is no shared demo login. The public landing page is accessible without an account; the authenticated workspace requires signup/login. A separate demo experience is [recommended, not implemented](docs/DEMO_EXPERIENCE.md).

## Implemented features

- **Authentication and ownership:** bcrypt password hashing, PyJWT HS256 tokens with required expiration, protected CRUD endpoints, and API queries scoped to the authenticated user.
- **Application management:** create, edit, and delete company/role records with status, date, location, job URL, and notes; changes persist in PostgreSQL.
- **Search and organization:** combined company/role/location search, status filtering, newest/oldest/company sorting, reset, and paginated table/card views.
- **Analytics:** total applications, current interview/offer counts, selection rate, status distribution, and application-date trends using Recharts. All calculations use the logged-in user's API response.
- **Responsive interface:** separate public landing and authentication pages, collapsible navigation, mobile cards, light/dark themes, loading states, empty states, and notifications.
- **Resilience and accessibility:** readable API errors, failed-load retry, stale-session protection, keyboard navigation, focus handling, and chart failure recovery that preserves CRUD access.

Metrics describe the current records, not historical status transitions or predicted outcomes. [Analytics definitions](docs/ARCHITECTURE.md#analytics).

## Technology

| Layer | Implementation |
| --- | --- |
| Frontend | React, Vite, Recharts, Lucide icons, CSS, self-hosted Manrope |
| Backend | FastAPI, Pydantic, SQLAlchemy, PyJWT, bcrypt |
| Persistence | PostgreSQL in deployment; isolated SQLite for backend tests |
| Verification | Python unittest, Node test runner, Playwright, Axe, ESLint |
| Hosting | Vercel frontend and Render API |

## System architecture

```mermaid
flowchart TD
    User[User browser] --> Frontend[React + Vite frontend on Vercel]
    Frontend -->|HTTPS JSON / Bearer JWT| API[FastAPI REST API on Render]
    API -->|SQLAlchemy / psycopg2| DB[(PostgreSQL)]
```

The browser never connects directly to PostgreSQL. The API derives ownership from a verified JWT, rather than trusting a user ID supplied in a request. [Authentication flow, endpoints, and database design](docs/ARCHITECTURE.md).

## Run locally

Use Python 3.14, Node 24, and a local PostgreSQL installation for the documented setup.

```bash
git clone https://github.com/ran-nope/internship-tracker.git
cd internship-tracker
python3.14 -m venv venv
source venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
cp frontend/.env.example frontend/.env.local
npm --prefix frontend ci
```

Create a local database, then replace the backend placeholders in `.env`:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/DATABASE
SECRET_KEY=replace-with-a-long-random-secret
CORS_ORIGINS=http://localhost:5173
```

The frontend example uses `VITE_API_URL=http://127.0.0.1:8000`. Never put secrets in `VITE_*` variables; they become public browser code.

Start the backend and frontend in separate terminals:

```bash
# Repository root, with venv activated
uvicorn main:app --host 127.0.0.1 --port 8000
```

```bash
npm --prefix frontend run dev -- --host localhost --port 5173 --strictPort
```

Open `http://localhost:5173`. [Complete database setup, environment reference, and troubleshooting](docs/DEVELOPMENT.md).

## Tests and checks

From the repository root:

```bash
venv/bin/python -B -m unittest discover -s tests -v
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
python3 scripts/check_secrets.py
python3 scripts/check_docs.py
```

Backend tests use in-memory SQLite. Browser tests use a disposable PostgreSQL cluster and exercise signup/login, persistence, account isolation, analytics, responsive layouts, and accessibility. [Browser tests, dependency audits, CI scope, and latest local verification](docs/TESTING.md).

The [CI workflow](.github/workflows/ci.yml) runs backend/frontend tests, ESLint, a build, and source-tree secret/documentation checks without production credentials. No CI success badge is shown before an actual hosted run.

## Deployment overview

Vercel builds `frontend/` with `npm run build` and serves `dist/`. Render installs `requirements.txt` and starts `uvicorn main:app`. Database and signing-key settings belong only on the backend. Browser routes use fragments such as `/#/applications`, so direct links and refreshes do not require SPA rewrites. [Deployment reference](docs/DEPLOYMENT.md).

## Repository map

```text
main.py                 FastAPI routes, validation, authentication, CORS
database.py / models.py  SQLAlchemy connection and table definitions
frontend/src/           React components, state hooks, API helper, analytics
frontend/e2e/           Browser regression and accessibility tests
frontend/screenshots/   Isolated documentation capture suite
tests/                  Backend and frontend unit tests, disposable API harness
scripts/                Redacted source scan and documentation link checks
docs/                   Architecture, setup, case study, gallery, history
.github/workflows/      Minimal verification workflow
```

## Current limits and roadmap

The current schema has no database foreign key on `internships.user_id`, and `create_all()` does not migrate existing tables. Before adding constraints, audit orphaned records and introduce reviewed, reversible migrations. JWTs are stored in localStorage; logout removes the browser token but does not revoke it server-side.

Planned improvements include migration tooling, authentication rate limiting and recovery, server-side pagination for larger datasets, application status history, and a clearly labeled frontend-only demo. These are future work, not shipped features. [Limitations and migration plan](docs/ARCHITECTURE.md#limitations-and-migrations).

## License

No project-wide license has been selected. This repository does not currently grant an open-source license for the application. The bundled Manrope font has its own [SIL Open Font License](frontend/src/assets/fonts/OFL.txt); that license applies to the font, not the project.
