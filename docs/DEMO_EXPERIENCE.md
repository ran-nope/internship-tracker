# Synthetic demo experience

Choose **Explore synthetic demo** on the public landing page. The demo contains 18 clearly fictional records and supports searching, filtering, pagination, editing and deletion without a signup or network API request.

Data stays in sessionStorage for the current tab and survives reloads. Closing the tab clears it. Demo state is separate from authenticated records and does not demonstrate server persistence or authentication. The workspace displays a persistent synthetic-data notice.

The real application still uses authenticated PostgreSQL persistence. There is no shared demo account or public credential.
