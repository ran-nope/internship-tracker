# Recruiter demo experience: recommendation

The public landing page is available without authentication. The dashboard illustration is labeled sample data. The real workspace requires an individual account; there is no shared demo account and no interactive frontend-only demo mode today.

## Options

| Option | Benefit | Cost or risk |
| --- | --- | --- |
| Shared account with synthetic records | Exercises the existing backend quickly | Public credentials, shared writes, vandalism/reset needs, concurrency, and potential confusion about persistence |
| Frontend-only demo | No public credentials or database writes; fast exploration | Needs an explicit local data adapter and careful labeling; cannot demonstrate real server persistence or authentication |
| Separate isolated demo environment | Demonstrates the entire stack with no production access | Additional hosting, separate secrets/CORS/database, abuse controls, resets, and operational maintenance |

## Recommended next step

A clearly labeled frontend-only demo is the best balance for a recruiter visiting briefly. The existing presentation components and pure analytics utilities can be reused, while a separate demo data provider supplies synthetic records. It should be a distinct public route with an always-visible “Demo — synthetic data, changes are temporary” notice, an explicit reset action, and no token creation or calls to the production API.

Demo state should be isolated from authenticated storage and cleared when leaving/resetting the demo. Signup/login should continue through the real application flow. Tests should prove that demo actions never make production API requests and cannot reveal an authenticated user's records. The shared screenshot dataset could be the starting point.

If full-stack evaluation is later required, use a separate staging service/database with its own secrets, rate limits, quotas, and reset policy. It should not reuse production database credentials.

**Recommendation only:** this work does not implement a demo route, publish credentials, create a production account, or weaken authentication. The current screenshot gallery is the safe immediate way to explore the private UI.

[Gallery](screenshots/README.md) · [Back to documentation](README.md).
