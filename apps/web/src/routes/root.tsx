import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet, useRouter } from '@tanstack/react-router'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth'

export const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Layout,
})

function Layout() {
  const router = useRouter()
  const { data: session } = authClient.useSession()

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4">
      <header className="flex items-center justify-between py-4">
        <Link to="/" className="text-lg font-bold tracking-tight">
          <span className="highlight">App</span>
        </Link>
        <div className="flex items-center gap-2">
          {session && (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">{session.user.email}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await authClient.signOut()
                  await router.navigate({ to: '/login' })
                }}
              >
                Sign out
              </Button>
            </>
          )}
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 pb-12">
        <Outlet />
      </main>
    </div>
  )
}
