// Reads env values from my private secrets repo (Repo/Personal/secrets/<project>/).
//   node scripts/secrets.ts pull   copies local.env to .env
//   node scripts/secrets.ts push   uploads prod.env to the Cloudflare Worker as secrets
//   node scripts/secrets.ts deploy  deploys the built Worker and its secrets together
//   node scripts/secrets.ts deploy-auth  deploys the central Auth Worker from auth/prod.env
// Set SECRETS_DIR to use another folder.
import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Values in prod.env that are for me, not for the Worker.
const NOT_WORKER_SECRETS = new Set(['NEON_DATABASE_URL'])

const root = fileURLToPath(new URL('..', import.meta.url))
const project = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name as string
const dir = process.env.SECRETS_DIR ?? join(root, '..', 'secrets', project)

function need(file: string): string {
  const path = join(dir, file)
  if (!existsSync(path)) {
    console.error(`Missing ${path}. Clone the secrets repo next to this one or set SECRETS_DIR.`)
    process.exit(1)
  }
  return path
}

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match?.[1] && match[2] !== undefined) out[match[1]] = match[2]
  }
  return out
}

const command = process.argv[2]

if (command === 'pull') {
  const target = join(root, '.env')
  copyFileSync(need('local.env'), target)
  chmodSync(target, 0o600)
  console.info(`Wrote .env from ${join(dir, 'local.env')}. Restart pnpm dev to use it.`)
} else if (command === 'push' || command === 'deploy' || command === 'deploy-auth') {
  const values = parseEnv(readFileSync(need('prod.env'), 'utf8'))
  if (command === 'deploy-auth') {
    const upstream = parseEnv(readFileSync(join(dir, '..', 'starter', 'prod.env'), 'utf8'))
    for (const name of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET']) {
      const value = upstream[name]
      if (!value) throw new Error(`Missing ${name} for Altivola Auth`)
      values[name] = value
    }
  }
  const secrets = Object.fromEntries(
    Object.entries(values).filter(([key, value]) => value && !NOT_WORKER_SECRETS.has(key)),
  )
  const tmp = mkdtempSync(join(tmpdir(), 'secrets-'))
  const file = join(tmp, 'secrets.json')
  try {
    writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 })
    console.info(`Using Worker secrets: ${Object.keys(secrets).join(', ')}`)
    const wrangler = join(root, 'apps/api/node_modules/.bin/wrangler')
    const config = command === 'deploy-auth' ? 'wrangler.auth.jsonc' : 'wrangler.jsonc'
    const args =
      command === 'push'
        ? ['secret', 'bulk', file]
        : ['deploy', '--config', config, '--keep-vars', '--secrets-file', file]
    const result = spawnSync(wrangler, args, { cwd: join(root, 'apps/api'), stdio: 'inherit' })
    process.exitCode = result.status ?? 1
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
} else {
  console.error('Usage: node scripts/secrets.ts <pull|push|deploy|deploy-auth>')
  process.exit(1)
}
