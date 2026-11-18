import postgres from 'postgres'

export type Sql = postgres.Sql

export function createSql(url: string, options: postgres.Options<Record<string, never>> = {}): Sql {
  return postgres(url, { max: 10, ...options })
}
