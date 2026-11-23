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
pnpm env:pull               # .env from my private secrets repo, or: cp .env.example .env
docker compose up -d        # Postgres, migrations, Mailpit
pnpm dev                    # API on :3000, web on :5173
```

Open http://localhost:5173, enter any email, then open the sign in link from Mailpit at http://localhost:8025.

If port 5432 is already taken, set `DB_PORT` in `.env` and use the same port in `DATABASE_URL`.

## Commands

| Command                                   | What it does                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                                | API and web with hot reload                                             |
| `docker compose up -d`                    | Postgres + migrations + Mailpit                                         |
| `docker compose --profile app up --build` | Everything in Docker, like production, on http://localhost:8080         |
| `pnpm lint` / `pnpm format`               | Biome check / fix                                                       |
| `pnpm typecheck`                          | TypeScript in every package                                             |
| `pnpm test`                               | Integration tests against a real Postgres (needs Docker)                |
| `pnpm build`                              | Build the API bundle and the web app                                    |
| `pnpm openapi`                            | Write `apps/api/openapi.json` (CI fails if it is out of date)           |
| `pnpm --filter @app/server dev:worker`    | Run the API in the local Workers runtime                                |
| `pnpm env:pull`                           | Copy `local.env` from the secrets repo (`../secrets/<name>/`) to `.env` |
| `pnpm secrets:push`                       | Upload `prod.env` from the secrets repo to the Worker as secrets        |

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

1. `gh repo create altivola/altivola-<thing> --template altivola/starter --public --clone`
2. Replace `App` in `apps/web/index.html`, `apps/web/vite.config.ts` (PWA manifest), `apps/web/src/routes/root.tsx`, and `apps/api/src/app.ts` (`openapiInfo`).
3. Replace the Worker name, Hyperdrive id, queue name, and `BETTER_AUTH_URL` in `apps/api/wrangler.jsonc` (see Deploy).
4. Delete the notes example once you have your own feature (procedure, migration, test, page).
5. Pick the license: MIT for libraries and CLIs, AGPL for apps people can self host.
6. Turn on the Renovate GitHub app for the repo.

## Deploy

**Self host:** `docker compose --profile app up --build -d` behind a reverse proxy with HTTPS. Set `BETTER_AUTH_URL` to the public URL and use `MAIL_PROVIDER=resend`.

**Cloudflare (free phase):** one Worker serves both the web app (static assets) and the API, so they share one origin on `workers.dev` with no custom domain. Postgres is Neon, reached through Hyperdrive. Live example: https://starter.altivola.workers.dev

First deploy of a new project, from `apps/api`:

1. `pnpm exec wrangler login`
2. Create a Neon project (region closest to your users) and copy its direct connection string (pooling off).
3. `pnpm exec wrangler hyperdrive create <name>-db --caching-disabled --connection-string="<neon url>"` and put the id in `wrangler.jsonc`. Keep caching off: cached reads return stale sessions and break rate limiting.
4. `pnpm exec wrangler queues create <name>-jobs` and use that name in `wrangler.jsonc`.
5. Run the migrations on Neon:
   `docker run --rm -v "$PWD/../../packages/db/migrations:/migrations:ro" -e DATABASE_URL="<neon url>" ghcr.io/amacneil/dbmate:2 --no-dump-schema --migrations-dir /migrations up`
6. Set `BETTER_AUTH_URL` in `wrangler.jsonc` to `https://<worker name>.<your subdomain>.workers.dev`.
7. `pnpm run deploy` (builds the web app, then `wrangler deploy`).
8. Secrets: put them in `../secrets/<name>/prod.env` (a new `BETTER_AUTH_SECRET`, not the local one, plus the OAuth keys), then `pnpm secrets:push` from the repo root.
9. Add `https://<your url>/api/auth/callback/google` and `.../github` to the OAuth apps.

**Automatic deploys:** after the first deploy, every push to `main` runs the `deploy` job in CI once the checks pass: migrations on Neon, Hyperdrive URL, `wrangler deploy`, then Worker secrets. It reads every value from the private secrets repo, so it needs:

- secret `SECRETS_REPO_TOKEN`: set once on the `altivola` org, shared by every repo (the GitHub token `GH_DEPLOY_TOKEN` from `secrets/ci.env`)
- repo variable `DEPLOY=cloudflare` (a new repo from this template does not deploy until it is set)

Changing `prod.env` in the secrets repo starts the same job.

Sign in stays passwordless (magic link or OAuth) because the free Workers plan allows 10 ms of CPU per request, which password hashing goes over. `MAIL_PROVIDER` is `none` until Resend is set up, which hides the email option.

## Brand

Black, yellow `#FAFB03`, and white. Yellow is only used as a fill behind black text (`highlight` class, primary buttons in dark mode), never as text on white. Tokens live in `packages/ui/tokens.css`.

## Altivola sign-in

Altivola Auth is an OpenID Connect provider built from this repo. It runs as a
separate Worker with its own PostgreSQL database, Better Auth secret and sign-in
session. Starter and other apps issue their own local sessions after a
successful authorization code exchange. Opening another participating app can
reuse the hub session. Sign out from the hub home page to end the central session.
Each app manages its existing local sessions.

### Set up the hub

1. Pick the hub origin before registering any apps. The Worker config uses
   `https://auth.altivola.workers.dev`. Create a dedicated PostgreSQL database,
   run the migrations under `packages/db/migrations` against it, and point a
   dedicated Hyperdrive binding at it.
2. Set the dedicated Hyperdrive ID in `apps/api/wrangler.auth.jsonc` for the target account. Keep caching disabled.
   Set an independent `BETTER_AUTH_SECRET` for that Worker. Configure one OAuth
   app in each provider console using these callbacks:

   | Provider | Callback                                                     |
   | -------- | ------------------------------------------------------------ |
   | Google   | `https://auth.altivola.workers.dev/api/auth/callback/google` |
   | GitHub   | `https://auth.altivola.workers.dev/api/auth/callback/github` |

   Store the corresponding `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` as Worker secrets. Enable
   email sign-in separately if needed. Use `MAIL_PROVIDER=resend`,
   `MAIL_FROM` and `RESEND_API_KEY` for production. For local testing use
   `AUTH_MODE=hub`, a separate `BETTER_AUTH_URL`, `DATABASE_URL` and
   `BETTER_AUTH_SECRET`, and run `node apps/api/src/node.ts` with Mailpit.
3. From `apps/api`, deploy the hub with
   `pnpm exec wrangler deploy --config wrangler.auth.jsonc`. Use the same
   `--config` when setting hub secrets. Check that
   `/.well-known/openid-configuration` reports the hub origin as its issuer.

Altivola Starter CI also deploys the Auth Worker when `auth/prod.env` is
available in the private secrets repo. The hub has its own database URL and
signing secret. CI takes the shared Google and GitHub credentials from
`starter/prod.env`.

### Connect an app

Run the following with `DATABASE_URL` pointing at the hub database. Register each
app and each environment separately. The command prints the app's credentials
once, and the hub stores a hash of the secret.

```sh
node packages/auth/register-client.ts 'Altivola Starter' \
  https://starter.altivola.workers.dev/api/auth/callback/altivola
```

Set `ALTIVOLA_AUTH_ISSUER=https://auth.altivola.workers.dev` and the printed
`ALTIVOLA_AUTH_CLIENT_ID` and `ALTIVOLA_AUTH_CLIENT_SECRET` in the app's server
environment. Starter then shows **Continue with Google** and **Continue with GitHub**. The selected
provider starts through the hub automatically. Configure both social providers
on the hub to enable both buttons. Starter uses its own configured login methods
when the hub is disabled. Better Auth can
link an existing account when both the local and provider emails are verified.

The registration command is for first-party apps. It allows only the supplied
callback URLs, requires PKCE, and skips consent. Keep the app secret on its
server. Each new app adds a client to the hub, with no new Google or GitHub
callback entries. To pause a client, set its `"disabled"` flag in the hub's
`"oauthClient"` table. To replace credentials, register a new client, update
the app, then disable the old client.
