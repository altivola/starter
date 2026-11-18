import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createRoute, redirect } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth'
import { orpc } from '@/lib/orpc'
import { rootRoute } from './root'

export const notesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async () => {
    const { data } = await authClient.getSession()
    if (!data) throw redirect({ to: '/login' })
  },
  component: NotesPage,
})

function NotesPage() {
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const notes = useQuery(orpc.notes.list.queryOptions({ input: { limit: 50 } }))
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.notes.key() })

  const create = useMutation(
    orpc.notes.create.mutationOptions({
      onSuccess: async () => {
        setBody('')
        await refresh()
      },
    }),
  )
  const remove = useMutation(orpc.notes.delete.mutationOptions({ onSuccess: refresh }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">
        Your <span className="highlight">notes</span>
      </h1>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate({ body })
        }}
      >
        <Input
          aria-label="New note"
          placeholder="Write something..."
          value={body}
          maxLength={2000}
          onChange={(event) => setBody(event.target.value)}
        />
        <Button type="submit" disabled={create.isPending || !body.trim()}>
          Add
        </Button>
      </form>

      {notes.isPending && <p className="text-sm text-muted-foreground">Loading...</p>}
      {notes.error && <p className="text-sm text-destructive">{notes.error.message}</p>}
      {notes.data?.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}

      <ul className="space-y-2">
        {notes.data?.map((note) => (
          <li key={note.id}>
            <Card className="py-0">
              <CardContent className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="break-words whitespace-pre-wrap">{note.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{note.createdAt.toLocaleString()}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete note"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ id: note.id })}
                >
                  <Trash2 />
                </Button>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
