import { createAuth } from '@app/auth'
import { createSql } from '@app/db'
import { serve } from '@hono/node-server'
import * as Sentry from '@sentry/node'
import { createApp } from './app.ts'
import { enabledProviders, oauthProviders, parseEnv } from './env.ts'
import { createPgBossJobs } from './jobs/pgboss.ts'
import { createMailer } from './mailer.ts'

const env = parseEnv(process.env)

if (env.SENTRY_DSN) Sentry.init({ dsn: env.SENTRY_DSN })

const sql = createSql(env.DATABASE_URL)
const auth = createAuth({
  sql,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  sendEmail: createMailer(env),
  ...oauthProviders(env),
})
const { jobs, stop: stopJobs } = await createPgBossJobs(env.DATABASE_URL, { sql })

const app = createApp({
  origin: env.BETTER_AUTH_URL,
  authProviders: enabledProviders(env),
  sql,
  auth,
  jobs,
  reportError: (error) => {
    console.error(error)
    if (env.SENTRY_DSN) Sentry.captureException(error)
  },
})

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.info(`api listening on http://localhost:${info.port}`)
})

async function shutdown() {
  server.close()
  await stopJobs()
  await sql.end({ timeout: 5 })
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
