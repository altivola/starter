import type { Sql } from '@app/db'

// Every background job, by name, with its payload type. Add new jobs here.
export type JobPayloads = {
  'note.created': { noteId: string; userId: string }
}

export type JobName = keyof JobPayloads

export type Jobs = {
  enqueue<N extends JobName>(name: N, payload: JobPayloads[N]): Promise<void>
}

export type JobContext = { sql: Sql }

// The work each job does. Both adapters (pg-boss on Node, Queues on Workers) call these.
export const jobHandlers: { [N in JobName]: (payload: JobPayloads[N], ctx: JobContext) => Promise<void> } = {
  'note.created': async ({ noteId, userId }) => {
    console.info(`note ${noteId} created by ${userId}`)
  },
}

export const jobNames = Object.keys(jobHandlers) as JobName[]
