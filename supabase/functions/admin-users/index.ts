// supabase/functions/admin-users/index.ts
// This function runs with the service role key so it can manage auth users.
// Deploy: supabase functions deploy admin-users
// Set secret: supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Verify the caller is an admin
async function requireAdmin(jwt: string): Promise<boolean> {
  const { data: { user } } = await supabaseAdmin.auth.getUser(jwt)
  if (!user) return false
  const { data } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  return data?.role === 'admin'
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })
  const jwt = authHeader.replace('Bearer ', '')
  if (!await requireAdmin(jwt)) return new Response('Forbidden', { status: 403 })

  const { action, ...payload } = await req.json()

  // ─── LIST USERS ───────────────────────────────────────────────────────────
  if (action === 'list') {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers()
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ users: data.users })
  }

  // ─── CREATE USER ──────────────────────────────────────────────────────────
  if (action === 'create') {
    const { email, password, role, employee_id } = payload
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role },
    })
    if (error) return Response.json({ error: error.message }, { status: 400 })

    // Link to employee profile
    if (data.user && employee_id) {
      await supabaseAdmin
        .from('profiles')
        .update({ employee_id, role })
        .eq('id', data.user.id)
    }

    return Response.json({ user: data.user })
  }

  // ─── RESET PASSWORD ───────────────────────────────────────────────────────
  if (action === 'reset_password') {
    const { user_id, password } = payload
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password })
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ ok: true })
  }

  // ─── UPDATE ROLE ──────────────────────────────────────────────────────────
  if (action === 'update_role') {
    const { user_id, role, employee_id } = payload
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ role, employee_id: employee_id || null })
      .eq('id', user_id)
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ ok: true })
  }

  // ─── DELETE USER ──────────────────────────────────────────────────────────
  if (action === 'delete') {
    const { user_id } = payload
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id)
    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
})
