# Application screenshots

These are actual captures of the locally running application, not mockups. They were produced with the real FastAPI API and a disposable PostgreSQL database. No production account or record was accessed. Images are JPEG quality 90 at device scale 1 to keep the gallery small while retaining readable text.

## One consistent synthetic dataset

[dataset.json](dataset.json) contains twelve fictional applications dated May–October 2026, including software engineering, AI engineering, machine learning, data science, and data engineering roles. Company names, openings, dates, statuses, and notes are illustrative; they do not describe real employers or hiring outcomes. Job links use `example.com`.

The first three records and aggregate counts match the existing public landing illustration: 12 applications, 3 interviews, 1 offer, 1 selected, 1 rejected, and 6 applied. Monthly application counts are 1, 1, 2, 2, 2, and 4. The authentic dashboard derives its counts from API records. The landing page remains its existing static, labeled illustration; the login page contains no account data and has empty credential fields.

The same account and records are used for dashboard, analytics, management, dark mode, and mobile captures. The browser display date is fixed at 24 October 2026 for reproducible six-month charts; this does not change the backend clock or JWT verification. `portfolio-demo` is a local synthetic username, not a publicly accessible demo account. A random password is generated in memory for each isolated run and is never published.

## Gallery

### Landing page

![Actual landing page hero and upper illustrative preview](landing.jpg)

### Login page

![Actual login page with empty fields](login.jpg)

### Dashboard

![Actual dashboard using twelve fictional applications](dashboard.jpg)

### Analytics

![Actual chart panels derived from the same twelve applications](analytics.jpg)

### Application management

![Actual application table with the same synthetic dataset](applications.jpg)

### Dark mode

![Actual dashboard in dark mode](dark-mode.jpg)

### Mobile layout

<img src="mobile.jpg" alt="Actual mobile application cards from the same dataset" width="390">

## Reproduction

After installing the [browser-test prerequisites](../TESTING.md), run from the repository root:

```bash
TEST_FRONTEND_PORT=5175 npm --prefix frontend run screenshots
```

The capture suite creates its own isolated API/database through the test harness and refuses to reuse existing servers. It uses 1440×1000 desktop views, a chart-panel crop, and a 390×844 mobile viewport. It waits for fonts/charts, disables animation for captures, and blocks external browser requests. It never accepts a production API URL override. No frontend data injection, image compositing, or invented UI is used.

[Capture source](../../frontend/screenshots/capture.spec.mjs) · [Back to project](../../README.md).
