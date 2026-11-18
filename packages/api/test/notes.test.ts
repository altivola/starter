import { createSql, type Sql } from '@app/db'
import { applyMigrations } from '@app/db/testing'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createNote, deleteNote, listNotes } from '../src/notes.ts'

let container: StartedPostgreSqlContainer
let sql: Sql

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18-alpine').start()
  sql = createSql(container.getConnectionUri())
  await applyMigrations(sql)
  await sql`
    insert into "user" (id, name, email, "emailVerified")
    values ('alice', 'Alice', 'alice@example.com', true), ('bob', 'Bob', 'bob@example.com', true)
  `
}, 120_000)

afterAll(async () => {
  await sql?.end()
  await container?.stop()
})

describe('notes queries', () => {
  it('creates a note and lists it, newest first', async () => {
    const first = await createNote(sql, 'alice', 'first')
    const second = await createNote(sql, 'alice', 'second')

    const notes = await listNotes(sql, 'alice', 10)

    expect(notes.map((n) => n.id)).toEqual([second.id, first.id])
    expect(notes[0]).toEqual({ id: second.id, body: 'second', createdAt: expect.any(Date) })
  })

  it('only lists the owner notes', async () => {
    await createNote(sql, 'bob', 'bob only')

    const notes = await listNotes(sql, 'alice', 10)

    expect(notes.every((n) => n.body !== 'bob only')).toBe(true)
  })

  it('does not delete someone else note', async () => {
    const note = await createNote(sql, 'bob', 'keep me')

    expect(await deleteNote(sql, 'alice', note.id)).toBe(false)
    expect(await deleteNote(sql, 'bob', note.id)).toBe(true)
  })

  it('rejects an empty body at the database level', async () => {
    await expect(createNote(sql, 'alice', '')).rejects.toThrow()
  })
})
