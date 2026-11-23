import type { Sql } from '@app/db'
import { oauthProvider } from '@better-auth/oauth-provider'
import { betterAuth } from 'better-auth'
import { jwt, magicLink, openAPI } from 'better-auth/plugins'
import { genericOAuth } from 'better-auth/plugins/generic-oauth'
import { PostgresJSDialect } from 'kysely-postgres-js'

export type SendEmail = (message: { to: string; subject: string; text: string; html: string }) => Promise<void>

export type AuthOptions = {
  sql: Sql
  secret: string
  baseURL: string
  sendEmail: SendEmail
  google?: { clientId: string; clientSecret: string }
  github?: { clientId: string; clientSecret: string }
  altivola?: { issuer: string; clientId: string; clientSecret: string }
  // Headers that carry the real client IP, used for rate limiting.
  // Behind nginx: x-forwarded-for. On Cloudflare: cf-connecting-ip.
  ipAddressHeaders?: string[]
}

function authOptions(options: AuthOptions) {
  return {
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: [options.baseURL],
    advanced: {
      ipAddress: { ipAddressHeaders: options.ipAddressHeaders ?? ['x-forwarded-for'] },
    },
    database: {
      dialect: new PostgresJSDialect({ postgres: options.sql }),
      type: 'postgres' as const,
    },
    socialProviders: {
      ...(options.google && { google: options.google }),
      ...(options.github && { github: options.github }),
    },
    rateLimit: {
      enabled: true,
      storage: 'database' as const,
      customRules: {
        '/sign-in/magic-link': { window: 60, max: 3 },
      },
    },
  }
}

function emailSignIn(options: AuthOptions, storeToken: 'plain' | 'hashed' = 'plain') {
  return magicLink({
    storeToken,
    sendMagicLink: async ({ email, url }) => {
      await options.sendEmail({
        to: email,
        subject: 'Your sign in link',
        text: `Open this link to sign in: ${url}\n\nIt expires in 5 minutes. If you did not ask for it, ignore this email.`,
        html: `<p>Open this link to sign in:</p><p><a href="${url.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}">Sign in</a></p><p>It expires in 5 minutes. If you did not ask for it, ignore this email.</p>`,
      })
    },
  })
}

export function createAuth(options: AuthOptions) {
  const altivola = options.altivola
  return betterAuth({
    ...authOptions(options),
    plugins: [
      emailSignIn(options),
      openAPI(),
      ...(altivola
        ? [
            genericOAuth({
              config: [
                {
                  providerId: 'altivola',
                  name: 'Altivola',
                  clientId: altivola.clientId,
                  clientSecret: altivola.clientSecret,
                  discoveryUrl: `${altivola.issuer}/.well-known/openid-configuration`,
                  scopes: ['openid', 'profile', 'email'],
                  pkce: true,
                  requireIdTokenVerification: true,
                  requireEmailVerification: true,
                  disableProviderLogout: true,
                },
              ],
            }),
          ]
        : []),
    ],
  })
}

export function createHubAuth(options: AuthOptions & { emailEnabled?: boolean }) {
  const base = new URL(options.baseURL)
  const loopback = ['localhost', '127.0.0.1', '[::1]']
  const localHub = base.protocol === 'http:' && loopback.includes(base.hostname)
  return betterAuth({
    ...authOptions(options),
    disabledPaths: ['/token', ...(options.emailEnabled === false ? ['/sign-in/magic-link', '/magic-link/verify'] : [])],
    plugins: [
      emailSignIn(options, 'hashed'),
      jwt({ jwt: { issuer: options.baseURL }, disableSettingJwtHeader: true }),
      oauthProvider({
        loginPage: '/login',
        consentPage: '/consent',
        scopes: ['openid', 'profile', 'email'],
        grantTypes: ['authorization_code'],
        allowDynamicClientRegistration: false,
        allowInsecureRedirectUri: (url) => localHub && loopback.includes(url.hostname),
        clientPrivileges: () => false,
      }),
    ],
  })
}

export {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
  verifyOAuthQueryParams,
} from '@better-auth/oauth-provider'

export type Auth = ReturnType<typeof createAuth>
export type Session = Auth['$Infer']['Session']
