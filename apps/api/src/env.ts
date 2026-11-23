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
  // "none" turns email sign in off, for example before Resend is set up.
  MAIL_PROVIDER: z.enum(['mailpit', 'resend', 'none']).default('mailpit'),
  MAILPIT_URL: z.url().default('http://localhost:8025'),
  MAIL_FROM: z.string().default('App <noreply@example.com>'),
  RESEND_API_KEY: optional,
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  GITHUB_CLIENT_ID: optional,
  GITHUB_CLIENT_SECRET: optional,
  AUTH_MODE: z.enum(['app', 'hub']).default('app'),
  ALTIVOLA_AUTH_ISSUER: optional.pipe(z.url().optional()),
  ALTIVOLA_AUTH_CLIENT_ID: optional,
  ALTIVOLA_AUTH_CLIENT_SECRET: optional,
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
  const {
    ALTIVOLA_AUTH_ISSUER: issuer,
    ALTIVOLA_AUTH_CLIENT_ID: clientId,
    ALTIVOLA_AUTH_CLIENT_SECRET: clientSecret,
  } = env
  if (issuer || clientId || clientSecret) {
    if (!issuer || !clientId || !clientSecret || env.AUTH_MODE === 'hub') {
      throw new Error('Set all three ALTIVOLA_AUTH variables on an app deployment')
    }
    const url = new URL(issuer)
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if ((!local && url.protocol !== 'https:') || ![url.origin, `${url.origin}/`].includes(issuer)) {
      throw new Error('ALTIVOLA_AUTH_ISSUER must be an HTTPS origin, or a local HTTP origin for development')
    }
  }
  return env
}

export function enabledProviders(env: Env): AuthProvider[] {
  const providers = oauthProviders(env)
  const oauth = (['google', 'github'] as const).filter((name) => providers[name])
  return [
    ...(env.MAIL_PROVIDER === 'none' ? [] : (['email'] as const)),
    ...oauth,
    ...(providers.altivola ? (['altivola'] as const) : []),
  ]
}

export function oauthProviders(env: Env) {
  return {
    google:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
        : undefined,
    altivola:
      env.ALTIVOLA_AUTH_ISSUER && env.ALTIVOLA_AUTH_CLIENT_ID && env.ALTIVOLA_AUTH_CLIENT_SECRET
        ? {
            issuer: new URL(env.ALTIVOLA_AUTH_ISSUER).origin,
            clientId: env.ALTIVOLA_AUTH_CLIENT_ID,
            clientSecret: env.ALTIVOLA_AUTH_CLIENT_SECRET,
          }
        : undefined,
    github:
      env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }
        : undefined,
  }
}
