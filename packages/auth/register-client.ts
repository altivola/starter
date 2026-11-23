import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createSql } from '@app/db'

const [name, ...callbacks] = process.argv.slice(2)
const databaseURL = process.env.DATABASE_URL
if (!databaseURL || !name?.trim() || !callbacks.length) {
  throw new Error('Set DATABASE_URL for the hub and pass a client name and at least one callback URL')
}

const redirectUris = callbacks.map((value) => {
  const url = new URL(value)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) ||
    url.hash ||
    url.username ||
    url.password ||
    url.href !== value
  ) {
    throw new Error('Callbacks must be exact HTTPS URLs, or HTTP loopback URLs for local development')
  }
  return value
})

const clientId = randomUUID()
const clientSecret = randomBytes(32).toString('base64url')
// Better Auth's hashed client-secret format is an unpadded base64url SHA-256 digest.
const clientSecretHash = createHash('sha256').update(clientSecret).digest('base64url')
const sql = createSql(databaseURL)
try {
  await sql`
    insert into "oauthClient" (
      "id", "clientId", "clientSecret", "name", "redirectUris", "scopes", "grantTypes", "responseTypes",
      "tokenEndpointAuthMethod", "applicationType", "requirePKCE", "skipConsent", "disabled", "createdAt", "updatedAt"
    ) values (
      ${randomUUID()}, ${clientId}, ${clientSecretHash}, ${name.trim()}, ${sql.json(redirectUris)},
      '["openid", "profile", "email"]', '["authorization_code"]', '["code"]',
      'client_secret_post', 'web', true, true, false, now(), now()
    )
  `
  console.log(`ALTIVOLA_AUTH_CLIENT_ID=${clientId}\nALTIVOLA_AUTH_CLIENT_SECRET=${clientSecret}`)
} finally {
  await sql.end()
}
