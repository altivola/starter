import { z } from 'zod'
import { pub } from './context.ts'
import { notes } from './notes.ts'

export const router = {
  health: pub
    .route({ method: 'GET', path: '/health', summary: 'Health check', tags: ['system'] })
    .output(z.object({ ok: z.boolean() }))
    .handler(async ({ context }) => {
      await context.sql`select 1`
      return { ok: true }
    }),
  authProviders: pub
    .route({ method: 'GET', path: '/auth-providers', summary: 'Sign in methods turned on', tags: ['system'] })
    .output(z.array(z.enum(['email', 'google', 'github', 'altivola'])))
    .handler(({ context }) => context.authProviders),
  notes,
}

export type Router = typeof router
export type { AuthProvider, Context } from './context.ts'
export * from './jobs.ts'
export type { Note } from './notes.ts'
