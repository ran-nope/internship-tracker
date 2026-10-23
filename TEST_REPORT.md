# Phase 1 testing report

No production accounts or records were created, updated, or deleted. No changes
were committed, pushed, or deployed during this testing phase.

Final checks: 8 backend tests passed; all 4 Chromium browser scenarios passed;
the additional network-disconnection regression passed; frontend API checks,
ESLint, production build, and Git whitespace checks passed. npm audit reported
zero vulnerabilities after compatible updates. The local credential scan found
no credentials in the proposed changes, and `.env` remains Git-ignored.

## Automated local coverage

| Area | Evidence |
| --- | --- |
| Authentication | API and Chromium signup/login; duplicate username conflict; wrong password; absent, invalid, expired, incorrectly signed, and malformed-claim tokens |
| CRUD | PostgreSQL-backed browser add/edit/delete; API ownership checks and missing-record errors |
| Persistence | Browser refresh after create, edit, and delete; logout/login; fresh API database sessions; optional fields and multiline notes |
| User isolation | Separate-account lists; unauthorized update/delete returns 404; submitted user_id cannot change record ownership |
| Error handling | 401, 404, 409, 422, simulated 500/503, network failures, malformed successful response; CORS retained on errors; form values preserved after failed save |
| Responsiveness | Chromium auth and populated dashboard checks at 320, 375, 390, 768, and 1280 pixels; no horizontal overflow |
| Concurrency | Pending delete disables conflicting edits/saves; logout discards stale mutation responses |

Backend unit/API tests use isolated in-memory SQLite. Browser tests launch a
separate temporary PostgreSQL cluster, API, and Vite server. PostgreSQL test data
is disposable and never shares the application database. Persistence here means
across browser reloads, new requests/sessions, and logout/login, not a hosting
restart or backup/restore test.

## Confirmed bugs fixed locally

1. A successful HTTP response with the wrong JSON shape caused the dashboard to
   crash (`internships.filter is not a function`). Responses are now validated
   before entering state, including login and create/update responses.
2. Pending deletes left edit/save/repeated-delete actions enabled. The app now
   tracks deletion state, disables conflicting actions, and clears it safely
   after completion, failure, or logout.
3. JWT validation accepted boolean user IDs and did not require expiration on
   externally constructed signed tokens. It now requires expiration and a
   positive integer user ID. Existing app-issued tokens already contain expiry.
4. Network failures exposed a generic browser error. The UI now displays a clear
   retry message and preserves form values.
5. npm audit reported vulnerable Vite and source-map-js versions. Compatible
   updates resolved Vite to 8.3.5 and source-map-js to 1.2.2; audit then reported
   zero vulnerabilities. These dependencies are development/build tooling.

## Read-only deployed observations

- API root: 200; unauthenticated `/internships`: 401; unknown route: 404. All
  returned the matching CORS origin for the public frontend.
- OPTIONS preflights for signup, login, GET internships, PUT, and DELETE: 200 with
  the expected allowed origin. These checks do not execute writes.
- `https://internship-tracker-seven-alpha.vercel.app` serves the app publicly and
  embeds the expected Render API host. Its login screen displayed correctly at
  all five tested widths with no uncaught page errors.
- `https://internship-tracker-git-master-kpc13.vercel.app` redirects to Vercel
  authentication; its authenticated app was not inspected.

## Limits and remaining verification

Successful deployed authentication, CRUD, and production persistence/isolation
were not exercised because no production-write authorization or staging
credentials were provided. Local results do not prove the deployed PostgreSQL
connection or schema is healthy. Root health and preflights do not query the
production database. Run the full browser flow against a separate staging service
and database before calling production end-to-end acceptance complete.

Chromium viewport tests passed; native mobile devices, Safari, Firefox,
accessibility audits, load tests, rate limiting, and database restart/recovery are
outside this test run. The current branch alias's Vercel protection remains an
access-setting decision, not a backend CORS failure.

## Reproduction

```
venv/bin/python -B -m unittest discover -s tests -v
node --test tests/api.test.mjs
cd frontend
npm run lint
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/snap/bin/chromium npm run test:e2e
```

If system Chromium is unavailable, install Playwright's Chromium and omit the
executable override. Browser screenshots/traces/video are disabled by default;
transient Playwright reports are Git-ignored.
