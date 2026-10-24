# Engineering case study: Internship Tracker

**Focus:** authenticated full-stack development, user-owned data, descriptive analytics, interface consistency, and regression testing.

[Live application](https://internship-tracker-seven-alpha.vercel.app) · [Architecture](ARCHITECTURE.md) · [Screenshots](screenshots/README.md)

## Problem statement

An internship search produces information that is easy to scatter across spreadsheets, bookmarks, and notes: the company, role, date applied, current stage, job link, and details worth remembering. The project gives those records a single workspace and helps the user understand current application activity without inventing signals the data does not contain.

This is a portfolio engineering project. The repository does not establish adoption figures, hiring outcomes, performance benchmarks, or business impact, so none are claimed here.

## Objectives

- Persist application records and preserve them across login sessions and page reloads.
- Keep each user's records separate through backend ownership checks.
- Make common actions—adding, finding, updating, and reviewing applications—usable on desktop and mobile.
- Explain progress with transparent counts and date-based charts.
- Preserve the authentication and CRUD contract while improving the frontend.
- Verify behavior in environments that cannot alter production records.

## Design decisions

### Reuse the existing API for analytics

The API already returns a user's applications. The frontend derives metrics, filtering, and charts from that response rather than adding a parallel analytics service. Pure functions are independently tested, and memoized calculations reduce unnecessary work during rendering.

This is appropriate for a personal tracker, but it is an explicit scale tradeoff: the list endpoint returns all owned records. A much larger dataset would justify server-side pagination, filtering, and aggregate queries.

### Keep public and private experiences distinct

The landing page explains the product with an explicitly illustrative dashboard. It does not load private applications. Authentication pages and the workspace share typography, themes, colors, and components so the transition feels coherent. Hash routes support direct links, refreshes, and browser history on static hosting without a new rewrite configuration.

### Make failure states part of the design

An initial failed fetch is not presented as a real zero-application count. The UI shows unavailable metrics and retry controls. Form errors retain the user's input. An optional chart module has its own error boundary so failed chart loading does not remove application editing.

The tradeoff is a slightly more explicit state model, documented in [useTracker](../frontend/src/hooks/useTracker.js), rather than treating every request as a simple loading flag and success response.

## Technical architecture

The browser loads a React/Vite bundle from Vercel and sends JSON requests to FastAPI on Render. SQLAlchemy manages database sessions and PostgreSQL persistence. Backend configuration holds the database URL and signing key; the frontend receives only its public API base URL.

The frontend separates page composition, API handling, shared state hooks, presentation components, and pure calculations. Recharts is loaded separately when analytics are needed. [Architecture diagrams and endpoint reference](ARCHITECTURE.md).

## Authentication implementation

Signup validates input, hashes passwords with bcrypt, and persists a unique username. Login verifies the hash and issues a PyJWT token containing an integer `user_id` and a 24-hour expiration. Verification explicitly accepts HS256, requires expiration, and rejects invalid identities. Authenticated writes derive ownership from the verified token, not the request body.

A dependency audit found advisories in the former python-jose/ecdsa dependency chain. The application used only shared-secret HS256, so the library was replaced with pinned PyJWT and the unused dependency tree removed. Compatibility was checked with synthetic tokens in both directions, with a legacy token retained as a documented test fixture. See the [historical migration report](history/JWT_MIGRATION.md).

JWTs remain in localStorage. That choice preserves the existing client contract, but leaves tokens exposed to any JavaScript executing in the application's origin. Logout clears browser state; server-side revocation, recovery, and rate limiting remain future work. The project does not claim production-complete identity management.

## Database design

The schema contains `users` and `internships`. Applications store company, role, status, date, ownership ID, location, URL, and notes. SQLAlchemy queries restrict list/update/delete operations by `user_id`, and cross-account modification attempts return 404.

The schema currently lacks a foreign key on that ownership field. This is a database-integrity gap even though API ownership is tested. Startup `create_all()` creates missing tables but does not migrate them. Future migration work must audit orphaned rows, define deletion behavior, add constraints/indexes deliberately, and test rollback. The documentation work did not apply schema changes or inspect production records.

## Analytics implementation

Summary metrics count current records. Offers and Selected are distinct statuses, and selection rate is Selected divided by total. Charts group application dates into calendar months, including months with zero records. All-time charts cap the number of buckets and disclose grouped periods.

The implementation avoids treating current statuses as a history of transitions. It does not infer conversion rates, interview dates, response times, or future hiring outcomes. This distinction is relevant to data work: a visually plausible chart is still wrong if it claims a measurement the source data cannot support.

Pure calculation tests check empty datasets, combined search and status filtering, stable sort order, date boundaries, and preservation of totals during aggregation. No machine-learning model or AI feature is implemented.

## Development challenges and solutions

| Observed challenge | Implemented response | Evidence |
| --- | --- | --- |
| Local and hosted frontend origins differed; API URLs needed consistent slash handling | Explicit CORS origins, an outer middleware wrapper for error responses, normalized URL joining | Backend preflight/error tests and frontend API tests |
| bcrypt accepts a byte limit, while users type characters | Validate UTF-8 byte length before hashing; reject without truncating | Unicode-password regression |
| Concurrent signup can race a uniqueness check | Catch the database integrity error, roll back, and return a conflict | Signup-race unit test |
| A late mutation could complete after logout | Track session versions, discard stale results, and lock conflicting mutations | Pending-delete/logout browser regression |
| Initial loading or failed reads could imply misleading analytics | Separate loading, loaded, and failed states; show unavailable values and retry | Failed-list browser regression |
| Navigation and layout changes could regress authentication or editing | Preserve APIs and use backend, browser, keyboard, responsive, and Axe checks | Current tests and historical reports |
| Dependency advisories remained in an unused crypto stack | Migrate the narrowly used JWT functionality and verify token compatibility | PyJWT migration tests and dependency audit |

The earlier CORS investigation recorded what specific requests proved and what they did not prove. A successful preflight did not establish database connectivity or identify every possible cause of an authentication failure. [Historical testing report](history/TEST_REPORT.md).

## Testing strategy

Backend tests call the ASGI application with in-memory SQLite and an explicit synthetic signing key. They cover authentication, malformed/forged/expired tokens, validation, CORS, ownership, CRUD, and legacy-token compatibility.

Browser scenarios create a new temporary PostgreSQL cluster. They verify the real UI/API integration, persistence across reloads, account switching, request failures, analytics, responsive layouts, and accessibility. Tests refuse to reuse an existing server. Documentation captures use the same isolation approach and one fictional dataset.

CI runs the backend suite, frontend unit tests, ESLint, a production build, and practical source-secret/documentation checks. Current results and the limits of local validation are recorded in [verification](VERIFICATION.md), rather than embedded as permanent performance claims.

## Lessons demonstrated by the implementation

1. **Ownership belongs in the API query.** Hiding records in the UI is insufficient; each mutation must establish both record identity and owner.
2. **Metrics need definitions.** Current status counts and event histories answer different questions. Documenting the difference makes the charts interpretable.
3. **Failures need their own UI states.** A missing response is not an empty dataset, and optional features should fail without disabling core tasks.
4. **Token migrations are protocol changes to verify.** Library APIs differ even when both implement JWT; required claims and old-token compatibility need explicit tests.
5. **Reproducible evidence strengthens a portfolio.** Isolated tests, actual screenshots, source-linked explanations, and disclosed limits are more useful than unsupported badges or impact claims.

## Future improvements

Introduce reviewed database migrations and ownership constraints; add authentication rate limiting/recovery and evaluate token-storage alternatives; consider server-side pagination and query indexes; model status history before implementing time-in-stage analytics; extend browser/device coverage; and add a labeled frontend-only recruiter demo after a separate implementation decision.

These are proposed improvements. The current work adds documentation, repository safeguards, screenshots, and CI without changing the application's production behavior.
