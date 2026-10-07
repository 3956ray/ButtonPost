import { deleteConnection } from '@/lib/connections/store'
import { createClient } from '@/lib/supabase/server'

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Sign in is required.' }, { status: 401 })
  }

  try {
    await deleteConnection(supabase, user.id, 'x')
    return Response.json({ ok: true })
  } catch {
    return Response.json(
      { error: 'Could not disconnect X.' },
      { status: 500 },
    )
  }
}
