// supabase/functions/admin-users/index.ts
// Deploy: supabase functions deploy admin-users

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Verify the caller is an admin
async function requireAdmin(jwt: string): Promise<boolean> {
  const { data: { user } } = await supabaseAdmin.auth.getUser(jwt)
  if (!user) return false
  const { data } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  return data?.role === 'admin'
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors })
  const jwt = authHeader.replace('Bearer ', '')

  let isAdmin = false
  try { isAdmin = await requireAdmin(jwt) } catch (e) {
    return Response.json({ error: `Auth check failed: ${e.message}` }, { status: 500, headers: cors })
  }
  if (!isAdmin) return Response.json({ error: 'Forbidden: admin role required' }, { status: 403, headers: cors })

  const { action, ...payload } = await req.json()

  // ─── LIST USERS ───────────────────────────────────────────────────────────
  if (action === 'list') {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers()
    if (error) return Response.json({ error: error.message }, { status: 400, headers: cors })
    return Response.json({ users: data.users }, { headers: cors })
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
    if (error) return Response.json({ error: error.message }, { status: 400, headers: cors })

    if (data.user && employee_id) {
      await supabaseAdmin
        .from('profiles')
        .update({ employee_id, role })
        .eq('id', data.user.id)
    }

    return Response.json({ user: data.user }, { headers: cors })
  }

  // ─── RESET PASSWORD ───────────────────────────────────────────────────────
  if (action === 'reset_password') {
    const { user_id, password } = payload
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password })
    if (error) return Response.json({ error: error.message }, { status: 400, headers: cors })
    return Response.json({ ok: true }, { headers: cors })
  }

  // ─── UPDATE ROLE ──────────────────────────────────────────────────────────
  if (action === 'update_role') {
    const { user_id, role, employee_id } = payload
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ role, employee_id: employee_id || null })
      .eq('id', user_id)
    if (error) return Response.json({ error: error.message }, { status: 400, headers: cors })
    return Response.json({ ok: true }, { headers: cors })
  }

  // ─── DELETE USER ──────────────────────────────────────────────────────────
  if (action === 'delete') {
    const { user_id } = payload
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id)
    if (error) return Response.json({ error: error.message }, { status: 400, headers: cors })
    return Response.json({ ok: true }, { headers: cors })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400, headers: cors })

  } catch (e) {
    return Response.json({ error: `Unhandled error: ${e.message}` }, { status: 500, headers: cors })
  }
})
