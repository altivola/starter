# Notes for AI coding sessions

## Commands

- Start deps: `docker compose up -d` (Postgres, dbmate migrations, Mailpit)
- Dev: `pnpm dev` (API :3000, web :5173 with a proxy for `/api` and `/rpc`)
- Before saying something is done: `pnpm exec biome ci . && pnpm typecheck && pnpm test && pnpm build`
- After changing any procedure: `pnpm openapi` and commit `apps/api/openapi.json`

## Rules

- **No ORM and no query builder.** Write raw SQL with the postgres.js `sql` tagged template. Never build SQL by joining strings. Use `sql.unsafe` only for allow listed identifiers.
- Result types of queries are written by hand, so every new query gets an integration test in `packages/api/test/` (testcontainers, real Postgres).
- Migrations are plain SQL in `packages/db/migrations/` with `-- migrate:up` and `-- migrate:down`. Never edit a migration that has been merged; add a new one.
- Procedures live in `packages/api/src/`. Use `authed` for anything that needs a user, and always filter by `context.user.id` in SQL.
- Code that only works on Cloudflare stays in `apps/api/src/cloudflare/`. Code that only works on Node stays in `apps/api/src/node.ts` and `apps/api/src/jobs/pgboss.ts`. Everything else must run on both.
- The web app and API share one origin. Do not add CORS.
- Free phase login is passwordless (magic link, OAuth). Do not add password login without moving off the free Workers plan.
- UI: shadcn/ui components in `apps/web/src/components/ui`, brand tokens in `packages/ui/tokens.css`. Yellow is a fill behind black text, never text on white.
- Docs, comments, and commit messages are in plain, simple English. No em dashes.
- Commit messages use conventional commits: `feat: ...`, `fix(scope): ...`, `chore: ...`, `ci: ...`, `docs: ...`, lowercase after the colon.
- Before ending a session, stop every dev server, preview, browser session and test container you started, and make sure no audio is still playing.
