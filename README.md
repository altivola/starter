# Starter

Template for my personal open source apps. One TypeScript monorepo with an API and a web app that work on day one: sign in by email link, a small notes feature, background jobs, API docs, tests, Docker, and CI.

The reasons behind every choice are in my private playbook repo. This README is about using the template.

## What's inside

| Part     | Stack                                                                          |
| -------- | ------------------------------------------------------------------------------ |
| API      | Hono + oRPC, runs on Node or Cloudflare Workers                                |
| Database | Postgres, raw SQL with postgres.js, migrations as plain `.sql` files (dbmate)  |
| Auth     | Better Auth: email magic link, plus Google/GitHub when their keys are set      |
| Jobs     | One `jobs.enqueue()` API: pg-boss on Node, Cloudflare Queues on Workers        |
| API docs | Generated from the code, Scalar UI at `/api`                                   |
| Web      | Vite + React + TanStack Router/Query, Tailwind v4 + shadcn/ui, installable PWA |
| Email    | Mailpit locally, Resend in production                                          |
| Tooling  | pnpm + Turborepo, Biome, Vitest + testcontainers, GitHub Actions, Renovate     |

## Quick start

Needs Node 24+, Docker, and corepack (comes with Node).

```sh
corepack enable
pnpm install
cp .env.example .env        # then set BETTER_AUTH_SECRET: openssl rand -base64 32
docker compose up -d        # Postgres, migrations, Mailpit
pnpm dev                    # API on :3000, web on :5173
```

Open http://localhost:5173, enter any email, then open the sign in link from Mailpit at http://localhost:8025.

If port 5432 is already taken, set `DB_PORT` in `.env` and use the same port in `DATABASE_URL`.

## Commands

| Command                                   | What it does                                                    |
| ----------------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                                | API and web with hot reload                                     |
| `docker compose up -d`                    | Postgres + migrations + Mailpit                                 |
| `docker compose --profile app up --build` | Everything in Docker, like production, on http://localhost:8080 |
| `pnpm lint` / `pnpm format`               | Biome check / fix                                               |
| `pnpm typecheck`                          | TypeScript in every package                                     |
| `pnpm test`                               | Integration tests against a real Postgres (needs Docker)        |
| `pnpm build`                              | Build the API bundle and the web app                            |
| `pnpm openapi`                            | Write `apps/api/openapi.json` (CI fails if it is out of date)   |
| `pnpm --filter @app/server dev:worker`    | Run the API in the local Workers runtime                        |

## Layout

```
apps/
  api/            @app/server  Hono host: Node entry (src/node.ts), Workers entry (src/cloudflare/)
  web/            @app/web     Vite SPA + PWA
packages/
  api/            @app/api     oRPC router, Zod schemas, raw SQL, job definitions
  db/             @app/db      postgres.js client, migrations/
  auth/           @app/auth    Better Auth config
  ui/             @app/ui      tokens.css (brand colors)
compose.yaml
```

The web app and the API always share one origin: the Vite proxy in dev, nginx in Docker, Workers routes in production. That is why there is no CORS setup and the session cookie just works.

## Common tasks

**Add an API endpoint.** Add a procedure in `packages/api/src/` (see `notes.ts`), put it in the router in `index.ts`, then run `pnpm openapi`. The web app sees the new types right away.

**Add a migration.** Create `packages/db/migrations/<YYYYMMDDHHMMSS>_<name>.sql` with `-- migrate:up` and `-- migrate:down` sections, then `docker compose up migrate`.

**Write a query.** Use the `sql` tagged template. Values in `${...}` are sent as parameters, so never build SQL by joining strings. Result types are written by hand, so cover the query with an integration test (see `packages/api/test/notes.test.ts`).

**Add a background job.** Add its payload type and handler in `packages/api/src/jobs.ts`, then call `context.jobs.enqueue(name, payload)`.

**Add a UI component.** `cd apps/web && pnpm dlx shadcn@latest add <component>`.

**Change Better Auth plugins.** Run `pnpm --filter @app/auth schema` with the database up, and put the new tables or columns in a new migration.

## Using this template for a new project

1. `gh repo create jabbar-hafizh/<name> --template jabbar-hafizh/starter --clone`
2. Replace `App` in `apps/web/index.html`, `apps/web/vite.config.ts` (PWA manifest), `apps/web/src/routes/root.tsx`, and `apps/api/src/app.ts` (`openapiInfo`).
3. Replace `app-api` and `app-jobs` in `apps/api/wrangler.jsonc`.
4. Delete the notes example once you have your own feature (procedure, migration, test, page).
5. Pick the license: MIT for libraries and CLIs, AGPL for apps people can self host.
6. Turn on the Renovate GitHub app for the repo.

## Deploy

**Self host:** `docker compose --profile app up --build -d` behind a reverse proxy with HTTPS. Set `BETTER_AUTH_URL` to the public URL and use `MAIL_PROVIDER=resend`.

**Cloudflare (free phase):** the web app goes to Pages and the API to Workers on the same domain, with Neon Postgres through Hyperdrive. Login stays passwordless because the free Workers plan has a 10 ms CPU limit per request. The step by step guide comes with the first real deploy.

## Brand

Black, yellow `#FAFB03`, and white. Yellow is only used as a fill behind black text (`highlight` class, primary buttons in dark mode), never as text on white. Tokens live in `packages/ui/tokens.css`.
