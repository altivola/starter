import { createSql } from '@app/db'
import { createAuth } from './src/index.ts'

export const auth = createAuth({
  sql: createSql(process.env.DATABASE_URL ?? ''),
  secret: 'cli-only-secret-cli-only-secret-32',
  baseURL: 'http://localhost:5173',
  sendEmail: async () => {},
})
