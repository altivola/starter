import { readdir, readFile } from 'node:fs/promises'
import type { Sql } from './index.ts'

const migrationsDir = new URL('../migrations/', import.meta.url)

// Runs the "-- migrate:up" part of every dbmate migration, in order. For tests only.
export async function applyMigrations(sql: Sql): Promise<void> {
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    const text = await readFile(new URL(file, migrationsDir), 'utf8')
    const up = text.split('-- migrate:down')[0]?.replace('-- migrate:up', '') ?? ''
    await sql.unsafe(up)
  }
}
