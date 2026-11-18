import { type JobContext, type JobName, type JobPayloads, type Jobs, jobHandlers } from '@app/api'

export type JobMessage = { [N in JobName]: { name: N; payload: JobPayloads[N] } }[JobName]

// Workers adapter: jobs go to a Cloudflare Queue and run in the worker's queue() handler.
export function createQueueJobs(queue: Queue<JobMessage>): Jobs {
  return {
    async enqueue(name, payload) {
      await queue.send({ name, payload } as JobMessage)
    },
  }
}

export async function runQueueBatch(batch: MessageBatch<JobMessage>, ctx: JobContext) {
  for (const message of batch.messages) {
    try {
      const handler = jobHandlers[message.body.name] as (payload: unknown, ctx: JobContext) => Promise<void>
      await handler(message.body.payload, ctx)
      message.ack()
    } catch (error) {
      console.error(`job ${message.body.name} failed`, error)
      message.retry()
    }
  }
}
