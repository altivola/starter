import type { Auth } from '@app/auth'
import type { Sql } from '@app/db'
import { ORPCError, os } from '@orpc/server'
import type { Jobs } from './jobs.ts'

export type Context = {
  sql: Sql
  auth: Auth
  jobs: Jobs
  headers: Headers
  // Sign in methods that are set up, so the login page only shows working options.
  authProviders: AuthProvider[]
}

export type AuthProvider = 'email' | 'google' | 'github' | 'altivola'

export const pub = os.$context<Context>()

export const authed = pub.use(async ({ context, next }) => {
  const session = await context.auth.api.getSession({ headers: context.headers })
  if (!session) throw new ORPCError('UNAUTHORIZED')
  return next({ context: { user: session.user } })
})
