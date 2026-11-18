import type { Router } from '@app/api'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'

// Same origin as the page, so the session cookie is sent without extra setup.
const link = new RPCLink({ url: `${window.location.origin}/rpc` })

export const client: RouterClient<Router> = createORPCClient(link)
export const orpc = createTanstackQueryUtils(client)
