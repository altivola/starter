import type { Auth } from '@app/auth'
import type { Sql } from '@app/db'
import { ORPCError, os } from '@orpc/server'
import type { Jobs } from './jobs.ts'

export type Context = {
  sql: Sql
  auth: Auth
  jobs: Jobs
  headers: Headers
  // OAuth providers that have credentials set, so the login page only shows working buttons.
  authProviders: AuthProvider[]
}

export type AuthProvider = 'google' | 'github'

export const pub = os.$context<Context>()

export const authed = pub.use(async ({ context, next }) => {
  const session = await context.auth.api.getSession({ headers: context.headers })
  if (!session) throw new ORPCError('UNAUTHORIZED')
  return next({ context: { user: session.user } })
})
