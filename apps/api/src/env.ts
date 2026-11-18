import type { AuthProvider } from '@app/api'
import { z } from 'zod'

const optional = z
  .string()
  .optional()
  .transform((v) => v || undefined)

export const Env = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.url(),
  MAIL_PROVIDER: z.enum(['mailpit', 'resend']).default('mailpit'),
  MAILPIT_URL: z.url().default('http://localhost:8025'),
  MAIL_FROM: z.string().default('App <noreply@example.com>'),
  RESEND_API_KEY: optional,
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  GITHUB_CLIENT_ID: optional,
  GITHUB_CLIENT_SECRET: optional,
  SENTRY_DSN: optional,
})

export type Env = z.infer<typeof Env>

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = Env.safeParse(source)
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`)
  }
  const env = result.data
  if (env.MAIL_PROVIDER === 'resend' && !env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required when MAIL_PROVIDER=resend')
  }
  return env
}

export function enabledProviders(env: Env): AuthProvider[] {
  const providers = oauthProviders(env)
  return (['google', 'github'] as const).filter((name) => providers[name])
}

export function oauthProviders(env: Env) {
  return {
    google:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
        : undefined,
    github:
      env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }
        : undefined,
  }
}
