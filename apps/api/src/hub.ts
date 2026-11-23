import {
  createHubAuth,
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
  verifyOAuthQueryParams,
} from '@app/auth'
import type { Sql } from '@app/db'
import { Hono } from 'hono'
import { html } from 'hono/html'
import { secureHeaders } from 'hono/secure-headers'
import { type Env, oauthProviders } from './env.ts'
import { createMailer } from './mailer.ts'

export function createHub(env: Env, sql: Sql, ipAddressHeaders?: string[]) {
  const providers = oauthProviders(env)
  const emailEnabled = env.MAIL_PROVIDER !== 'none'
  const auth = createHubAuth({
    sql,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    sendEmail: createMailer(env),
    ipAddressHeaders,
    emailEnabled,
    ...providers,
  })

  const app = new Hono()
  app.use(
    secureHeaders({
      referrerPolicy: 'no-referrer',
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
      },
    }),
  )
  const oidc = oauthProviderOpenIdConfigMetadata(auth)
  const oauth = oauthProviderAuthServerMetadata(auth)
  app.get('/.well-known/openid-configuration', (c) => oidc(c.req.raw))
  app.get('/.well-known/oauth-authorization-server', (c) => oauth(c.req.raw))
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
  app.get('/health', async (c) => {
    await sql`select 1`
    return c.json({ ok: true })
  })
  app.get('/', (c) => c.redirect('/login'))
  app.get('/login.css', (c) => c.body(hubCss, 200, { 'Content-Type': 'text/css; charset=utf-8' }))
  app.get('/login.js', (c) => c.body(hubScript, 200, { 'Content-Type': 'text/javascript; charset=utf-8' }))
  app.get('/login', async (c) => {
    c.header('Cache-Control', 'no-store')
    const params = new URL(c.req.url).searchParams
    const error = params.has('error')
    const query = params.has('sig') ? params.toString() : params.get('request')
    if (query !== null && !(await verifyOAuthQueryParams(query, env.BETTER_AUTH_SECRET))) {
      return c.html(page('Link expired', html`<p>Return to your app to start sign-in again.</p>`), 400)
    }

    if (query === null && !error) {
      const session = await auth.api.getSession({ headers: c.req.raw.headers })
      if (session) {
        return c.html(
          page(
            'Your Altivola account',
            html`
          <p>Signed in as <strong>${session.user.email}</strong>.</p>
          <div class="actions"><button id="sign-out">Sign out of Altivola</button></div>
          <p id="status" role="status"></p>
        `,
          ),
        )
      }
    }

    const requested = query === null ? null : new URLSearchParams(query).get('altivola_provider')
    const preferred = requested === 'google' || requested === 'github' ? requested : null
    const autoProvider = !error && preferred && providers[preferred] ? preferred : null
    const showEmail = emailEnabled && preferred === null
    const unavailable = preferred && !providers[preferred]
    const providerName = preferred === 'google' ? 'Google' : 'GitHub'
    const message = error
      ? 'Sign-in could not be completed. Please try again.'
      : unavailable
        ? `${providerName} sign-in is unavailable on this Altivola environment.`
        : ''

    return c.html(
      page(
        'Sign in to Altivola',
        html`
      <p>Use one account across your Altivola apps.</p>
      <div class="actions">
        ${providers.google ? html`<button data-provider="google" data-auto="${String(autoProvider === 'google')}">Continue with Google</button>` : ''}
        ${providers.github ? html`<button data-provider="github" data-auto="${String(autoProvider === 'github')}">Continue with GitHub</button>` : ''}
        ${
          showEmail
            ? html`
          <form id="email-sign-in">
            <label for="email">Email address</label>
            <input id="email" type="email" name="email" autocomplete="email" required>
            <button type="submit">Email me a sign-in link</button>
          </form>
        `
            : ''
        }
        ${!message && !showEmail && !providers.google && !providers.github ? html`<p>Sign-in is unavailable.</p>` : ''}
      </div>
      <p id="status" role="status">${message}</p>
    `,
      ),
    )
  })
  app.get('/resume', async (c) => {
    c.header('Cache-Control', 'no-store')
    const query = new URL(c.req.url).search.slice(1)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session || !(await verifyOAuthQueryParams(query, env.BETTER_AUTH_SECRET))) {
      return c.html(page('Link expired', html`<p>Return to your app to start sign-in again.</p>`), 400)
    }
    // A magic link redirects here after establishing the hub session.
    // Start authorization again with the original, signed request parameters.
    const params = new URLSearchParams(query)
    const issuedAt = Number(params.get('ba_iat'))
    for (const key of ['sig', 'exp', 'ba_iat', 'ba_pl', 'ba_param']) params.delete(key)
    if (issuedAt > 0 && session.session.createdAt.getTime() >= issuedAt) {
      const prompts =
        params
          .get('prompt')
          ?.split(' ')
          .filter((prompt) => prompt !== 'login') ?? []
      if (prompts.length) params.set('prompt', prompts.join(' '))
      else params.delete('prompt')
      params.delete('max_age')
    }
    return c.redirect(`/api/auth/oauth2/authorize?${params}`)
  })
  app.get('/consent', async (c) => {
    c.header('Cache-Control', 'no-store')
    const query = new URL(c.req.url).search.slice(1)
    if (
      !(await verifyOAuthQueryParams(query, env.BETTER_AUTH_SECRET)) ||
      !(await auth.api.getSession({ headers: c.req.raw.headers }))
    ) {
      return c.html(page('Link expired', html`<p>Return to your app to start sign-in again.</p>`), 400)
    }
    const scopes = new URLSearchParams(query).get('scope')?.split(' ') ?? []
    return c.html(
      page(
        'Allow sign-in?',
        html`
      <p>The app you opened is requesting access to your account identifier${scopes.includes('profile') ? ', name and profile photo' : ''}${scopes.includes('email') ? ', and email address' : ''}.</p>
      <div class="actions">
        <button data-consent="allow">Allow and continue</button>
        <button data-consent="deny">Cancel</button>
      </div>
      <p id="status" role="status"></p>
    `,
      ),
    )
  })
  return app
}

function page(title: string, body: ReturnType<typeof html>) {
  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${title} | Altivola</title>
        <link rel="stylesheet" href="/login.css">
        <script defer src="/login.js"></script>
      </head>
      <body><main><p class="brand">Altivola</p><h1>${title}</h1>${body}</main></body>
    </html>`
}

const hubScript = `
const status = document.querySelector('#status')
const query = new URLSearchParams(location.search)
const oauthQuery = query.has('sig') ? location.search.slice(1) : query.get('request') ?? undefined
const retry = '/login?error=sign_in_failed' + (oauthQuery ? '&request=' + encodeURIComponent(oauthQuery) : '')
const controls = document.querySelectorAll('button, input')
async function submit(path, body, success) {
  for (const control of controls) control.disabled = true
  status.textContent = ''
  try {
    const response = await fetch('/api/auth/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error()
    success(await response.json())
  } catch {
    status.textContent = 'Could not continue sign-in. Try again or reopen the app.'
  } finally {
    for (const control of controls) control.disabled = false
  }
}
const redirect = (data) => location.assign(data.url)
function signIn(provider) {
  return submit('sign-in/social', {
    provider,
    callbackURL: '/login',
    errorCallbackURL: retry,
    oauth_query: oauthQuery,
    disableRedirect: true,
  }, redirect)
}
for (const button of document.querySelectorAll('[data-provider]')) {
  button.addEventListener('click', () => signIn(button.dataset.provider))
}
const selectedProvider = document.querySelector('[data-auto="true"]')?.dataset.provider
if (selectedProvider) signIn(selectedProvider)
for (const button of document.querySelectorAll('[data-consent]')) {
  button.addEventListener('click', () => submit('oauth2/consent', {
    accept: button.dataset.consent === 'allow',
    oauth_query: oauthQuery,
  }, redirect))
}
document.querySelector('#sign-out')?.addEventListener('click', () => {
  submit('sign-out', {}, () => location.assign('/login'))
})
document.querySelector('#email-sign-in')?.addEventListener('submit', (event) => {
  event.preventDefault()
  const email = new FormData(event.currentTarget).get('email')
  submit('sign-in/magic-link', {
    email,
    callbackURL: oauthQuery ? '/resume?' + oauthQuery : '/login',
    errorCallbackURL: retry,
  }, () => { status.textContent = 'Check your inbox for your sign-in link. Open it in this browser.' })
})
`

const hubCss = `
:root { color-scheme: light; font: 16px/1.5 system-ui, sans-serif; color: #272d28; background: #eff0e9 }
* { box-sizing: border-box }
body { min-height: 100svh; margin: 0; display: grid; place-items: center; padding: 1rem }
main { width: min(100%, 28rem); padding: clamp(1.4rem, 6vw, 2.5rem); background: #fffcf5; border: 1px solid #d4d8cd; border-radius: 1.5rem }
.brand { color: #455c4d; font-weight: 700; margin: 0 0 1rem }
h1 { font: 2rem/1.15 Georgia, serif; margin: 0 }
.actions, form { display: grid; gap: .6rem; margin-top: 1.25rem }
form { margin-top: .6rem }
button, input { font: inherit; min-height: 2.75rem; border: 1px solid #68756a; border-radius: .6rem; padding: .5rem .8rem }
button { background: #284438; color: white; cursor: pointer }
button:hover { background: #365b4b }
button:disabled { opacity: .6; cursor: wait }
input { width: 100%; background: white; color: #272d28 }
#status:empty { display: none }
`
