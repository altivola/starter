// Cloudflare Workers entry. Everything Cloudflare specific stays in this folder.
import { createAuth } from '@app/auth'
import { createSql } from '@app/db'
import { createApp } from '../app.ts'
import { enabledProviders, oauthProviders, parseEnv } from '../env.ts'
import { createMailer } from '../mailer.ts'
import { createQueueJobs, type JobMessage, runQueueBatch } from './queues.ts'

type Bindings = {
  HYPERDRIVE: Hyperdrive
  JOBS: Queue<JobMessage>
  [key: string]: unknown
}

function config(bindings: Bindings) {
  const vars = Object.fromEntries(Object.entries(bindings).filter(([, v]) => typeof v === 'string')) as Record<
    string,
    string
  >
  return parseEnv({ ...vars, DATABASE_URL: bindings.HYPERDRIVE.connectionString })
}

// Hyperdrive pools connections, so a small client per request is the expected pattern.
// Workers cannot share sockets between requests.
function openSql(bindings: Bindings) {
  return createSql(bindings.HYPERDRIVE.connectionString, { max: 5, fetch_types: false })
}

export default {
  async fetch(request, bindings, ctx) {
    const env = config(bindings)
    const sql = openSql(bindings)
    const app = createApp({
      origin: env.BETTER_AUTH_URL,
      authProviders: enabledProviders(env),
      sql,
      jobs: createQueueJobs(bindings.JOBS),
      auth: createAuth({
        sql,
        secret: env.BETTER_AUTH_SECRET,
        baseURL: env.BETTER_AUTH_URL,
        sendEmail: createMailer(env),
        ...oauthProviders(env),
      }),
    })
    try {
      return await app.fetch(request)
    } finally {
      ctx.waitUntil(sql.end())
    }
  },

  async queue(batch, bindings, ctx) {
    const sql = openSql(bindings)
    try {
      await runQueueBatch(batch, { sql })
    } finally {
      ctx.waitUntil(sql.end())
    }
  },
} satisfies ExportedHandler<Bindings, JobMessage>
