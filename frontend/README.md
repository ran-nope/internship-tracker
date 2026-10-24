# Internship Tracker frontend

React/Vite client for the Internship Tracker API. Start with the [project README](../README.md) and [local development guide](../docs/DEVELOPMENT.md).

- `src/components/`: landing, authentication, workspace, charts, forms, and lists.
- `src/hooks/`: authentication/CRUD lifecycle, theme, and hash navigation.
- `src/utils/`: pure analytics/filtering functions and route validation.
- `src/api.js`: API base URL handling, response validation, and session errors.
- `e2e/`: browser regression and accessibility tests.
- `screenshots/`: manual documentation capture against disposable local PostgreSQL.

Install with `npm ci`, run with `npm run dev`, and verify with `npm test`, `npm run lint`, and `npm run build`. Copy `.env.example` to `.env.local` for the local API URL. Vite environment variables are public build-time values, never a place for credentials.

[Testing and screenshot prerequisites](../docs/TESTING.md) · [Architecture](../docs/ARCHITECTURE.md) · [Font license](src/assets/fonts/OFL.txt)
