import { useMutation, useQuery } from '@tanstack/react-query'
import { createRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth'
import { orpc } from '@/lib/orpc'
import { rootRoute } from './root'

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: async () => {
    const { data } = await authClient.getSession()
    if (data) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

const socialProviders = ['google', 'github'] as const
const providerLabels = { google: 'Google', github: 'GitHub' } as const

function LoginPage() {
  const [email, setEmail] = useState('')
  const providers = useQuery(orpc.authProviders.queryOptions())
  const useHub = providers.data?.includes('altivola') ?? false
  const emailEnabled = !useHub && (providers.data?.includes('email') ?? false)
  const oauthProviders = socialProviders.filter((provider) => useHub || providers.data?.includes(provider))

  const magicLink = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signIn.magicLink({ email, callbackURL: '/' })
      if (error) throw new Error(error.message ?? 'Could not send the link')
    },
  })

  const oauth = useMutation({
    mutationFn: async (provider: keyof typeof providerLabels) => {
      const { data, error } = await authClient.signIn.social({
        provider: useHub ? 'altivola' : provider,
        callbackURL: '/',
        errorCallbackURL: '/login',
        disableRedirect: useHub,
      })
      if (error) throw new Error(error.message ?? 'Could not start sign in')
      if (useHub) {
        if (!data?.url) throw new Error('Could not start sign in')
        const authorize = new URL(data.url)
        authorize.searchParams.set('altivola_provider', provider)
        window.location.assign(authorize)
      }
    },
  })
  const callbackFailed = new URLSearchParams(window.location.search).has('error')

  return (
    <Card className="mx-auto mt-12 max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          {emailEnabled ? 'We will email you a link. No password needed.' : 'Choose an account to continue.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!emailEnabled ? null : magicLink.isSuccess ? (
          <p className="text-sm">
            Check <strong>{email}</strong> for your sign in link.
            {import.meta.env.DEV && (
              <>
                {' '}
                Locally, open{' '}
                <a className="underline" href="http://localhost:8025" target="_blank" rel="noreferrer">
                  Mailpit
                </a>
                .
              </>
            )}
          </p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              magicLink.mutate()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            {magicLink.error && <p className="text-sm text-destructive">{magicLink.error.message}</p>}
            <Button type="submit" className="w-full" disabled={magicLink.isPending}>
              {magicLink.isPending ? 'Sending...' : 'Email me a link'}
            </Button>
          </form>
        )}

        {(oauth.error || callbackFailed) && (
          <p role="alert" className="text-sm text-destructive">
            {oauth.error?.message ?? 'Sign in could not be completed. Please try again.'}
          </p>
        )}
        {oauthProviders.map((provider) => (
          <Button
            key={provider}
            variant="outline"
            className="w-full"
            disabled={oauth.isPending}
            onClick={() => oauth.mutate(provider)}
          >
            Continue with {providerLabels[provider]}
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}
