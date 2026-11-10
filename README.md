# DataBridge frontend

This repository contains the two React applications:

- `apps/client-portal` — the external contributor experience.
- `apps/analytics-portal` — the internal analytics workspace.

Both apps are maintained and versioned together. Their domain APIs live in the separate Python service repositories.

## Run both portals

```sh
npm install
npm run dev
```

Open the contributor portal at http://localhost:5173 and the analytics workspace at http://localhost:5174/analytics.

Build both portals with `npm run build`. For a single app, use `npm run dev:client` or `npm run dev:analytics`.
