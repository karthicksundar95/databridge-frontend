# DataBridge frontend

This repository contains the two React applications:

- `apps/client-portal` — the external client portal.
- `apps/analytics-portal` — the internal analytics workspace.

Both apps are maintained and versioned together. Their domain APIs live in the separate Python service repositories.

## Run the application locally

```sh
npm install
```

For the complete single-host experience used in demos, start the deployment stack from `databridge-deploy`:

```sh
docker compose up --build -d
```

Open http://localhost:5173 to choose the client portal or analytics workspace. Both workspaces stay under this same host: client routes use `/`, while analytics routes use `/analytics`. The two Vite servers remain internal implementation details behind the frontend gateway.
Client accounts sign up at `/signup`; analyst accounts use analytics sign-in and are provisioned by an administrator. Both apps use bearer JWTs backed by the auth database. To upload, sign in, add submission details, and choose one or more files (up to 5 GB each). The local development proxy routes MinIO uploads through the frontend to avoid browser cross-origin restrictions.

Build both portals with `npm run build`. For a single app, use `npm run dev:client` or `npm run dev:analytics`.

## Test or record the complete local workflow

Start the local Compose stack first. Then run the Playwright smoke test from this repository:

```sh
npm run test:flow
```

The test creates two temporary client accounts, uploads and verifies files from both accounts, provisions a temporary analyst with the administrator CLI, signs in to the analytics workspace, and verifies the analyst can list and download files from both clients. It also covers recovery of an older upload that predates database file registration, then removes all temporary accounts and S3 objects. Analyst accounts are intentionally provisioned by an administrator rather than self-registered.

To record the passing workflow at 1920×1080:

```sh
npm run record:flow
```

The recording is written to `artifacts/databridge-full-flow.webm` by default. Set `DATABRIDGE_VIDEO_PATH` to choose another output location.
