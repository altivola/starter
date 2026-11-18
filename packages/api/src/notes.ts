import type { Sql } from '@app/db'
import { z } from 'zod'
import { authed } from './context.ts'

export const Note = z.object({
  id: z.uuid(),
  body: z.string(),
  createdAt: z.date(),
})
export type Note = z.infer<typeof Note>

// Raw SQL lives in plain functions so integration tests can call them directly.
export async function listNotes(sql: Sql, userId: string, limit: number): Promise<Note[]> {
  return sql<Note[]>`
    select id, body, created_at as "createdAt"
    from notes
    where user_id = ${userId}
    order by created_at desc
    limit ${limit}
  `
}

export async function createNote(sql: Sql, userId: string, body: string): Promise<Note> {
  const [note] = await sql<Note[]>`
    insert into notes (user_id, body)
    values (${userId}, ${body})
    returning id, body, created_at as "createdAt"
  `
  if (!note) throw new Error('insert returned no row')
  return note
}

export async function deleteNote(sql: Sql, userId: string, id: string): Promise<boolean> {
  const rows = await sql`delete from notes where id = ${id} and user_id = ${userId}`
  return rows.count > 0
}

export const notes = {
  list: authed
    .route({ method: 'GET', path: '/notes', summary: 'List my notes', tags: ['notes'] })
    .input(z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }))
    .output(z.array(Note))
    .handler(({ input, context }) => listNotes(context.sql, context.user.id, input.limit)),

  create: authed
    .route({ method: 'POST', path: '/notes', summary: 'Create a note', tags: ['notes'] })
    .input(z.object({ body: z.string().trim().min(1).max(2000) }))
    .output(Note)
    .handler(async ({ input, context }) => {
      const note = await createNote(context.sql, context.user.id, input.body)
      await context.jobs.enqueue('note.created', { noteId: note.id, userId: context.user.id })
      return note
    }),

  delete: authed
    .route({ method: 'DELETE', path: '/notes/{id}', summary: 'Delete one of my notes', tags: ['notes'] })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ deleted: z.boolean() }))
    .handler(async ({ input, context }) => ({
      deleted: await deleteNote(context.sql, context.user.id, input.id),
    })),
}
