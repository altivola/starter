import { type JobContext, type JobName, type Jobs, jobHandlers, jobNames } from '@app/api'
import { PgBoss } from 'pg-boss'

// Node adapter: jobs are stored in Postgres (schema "pgboss") and worked in this process.
export async function createPgBossJobs(databaseUrl: string, ctx: JobContext) {
  const boss = new PgBoss(databaseUrl)
  boss.on('error', (error) => console.error('pg-boss', error))
  await boss.start()

  for (const name of jobNames) {
    await boss.createQueue(name)
    await boss.work(name, async (batch) => {
      for (const job of batch) {
        await runJob(name, job.data, ctx)
      }
    })
  }

  const jobs: Jobs = {
    async enqueue(name, payload) {
      await boss.send(name, payload)
    },
  }

  return { jobs, stop: () => boss.stop() }
}

function runJob(name: JobName, payload: unknown, ctx: JobContext) {
  const handler = jobHandlers[name] as (payload: unknown, ctx: JobContext) => Promise<void>
  return handler(payload, ctx)
}
