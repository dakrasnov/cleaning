// src/lib/adminUsers.ts
// Calls the admin-users Edge Function which runs with service role key.
// This keeps the service role key off the client entirely.

import { supabase } from './supabase'

const EDGE_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`

async function call(action: string, payload: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Not authenticated')

  const res = await fetch(EDGE_FN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Unknown error')
  return json
}

export const adminUsers = {
  list: ()                                         => call('list'),
  create: (p: { email: string; password: string; role: string; employee_id?: string }) => call('create', p),
  resetPassword: (user_id: string, password: string) => call('reset_password', { user_id, password }),
  updateRole: (user_id: string, role: string, employee_id?: string) => call('update_role', { user_id, role, employee_id }),
  delete: (user_id: string)                        => call('delete', { user_id }),
}
