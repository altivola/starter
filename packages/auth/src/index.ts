import type { Sql } from '@app/db'
import { betterAuth } from 'better-auth'
import { magicLink, openAPI } from 'better-auth/plugins'
import { PostgresJSDialect } from 'kysely-postgres-js'

export type SendEmail = (message: { to: string; subject: string; text: string; html: string }) => Promise<void>

export type AuthOptions = {
  sql: Sql
  secret: string
  baseURL: string
  sendEmail: SendEmail
  google?: { clientId: string; clientSecret: string }
  github?: { clientId: string; clientSecret: string }
  // Headers that carry the real client IP, used for rate limiting.
  // Behind nginx: x-forwarded-for. On Cloudflare: cf-connecting-ip.
  ipAddressHeaders?: string[]
}

export function createAuth(options: AuthOptions) {
  return betterAuth({
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: [options.baseURL],
    advanced: {
      ipAddress: { ipAddressHeaders: options.ipAddressHeaders ?? ['x-forwarded-for'] },
    },
    database: {
      dialect: new PostgresJSDialect({ postgres: options.sql }),
      type: 'postgres',
    },
    socialProviders: {
      ...(options.google && { google: options.google }),
      ...(options.github && { github: options.github }),
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      customRules: {
        '/sign-in/magic-link': { window: 60, max: 3 },
      },
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await options.sendEmail({
            to: email,
            subject: 'Your sign in link',
            text: `Open this link to sign in: ${url}\n\nIt expires in 5 minutes. If you did not ask for it, ignore this email.`,
            html: `<p>Open this link to sign in:</p><p><a href="${url}">Sign in</a></p><p>It expires in 5 minutes. If you did not ask for it, ignore this email.</p>`,
          })
        },
      }),
      openAPI(),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
export type Session = Auth['$Infer']['Session']
