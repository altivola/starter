# Contributing

Thanks for helping out.

1. Follow the quick start in the README to run the app locally.
2. Make your change on a branch. Keep pull requests small and focused on one thing.
3. Run the same checks as CI before you push:

   ```sh
   pnpm exec biome ci . && pnpm typecheck && pnpm test && pnpm build
   ```
4. If you changed an API procedure, run `pnpm openapi` and commit the updated `apps/api/openapi.json`.
5. Use conventional commit messages, for example `feat: add note search` or `fix: keep notes sorted`.

New queries need an integration test, and new tables need a migration in `packages/db/migrations/`. See `CLAUDE.md` for the project rules.
