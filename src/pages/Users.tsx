import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { adminUsers } from '@/lib/adminUsers'
import { useEmployeesStore } from '@/store/employees'
import { Badge, Btn, Card, ConfirmSheet, Field, Input, Modal, PageHeader, Select, SkeletonList } from '@/components/ui'
import type { Profile } from '@/store/auth'

const NAVY = '#0F2041'
const MINT = '#00C9A7'
const MINT_LIGHT = '#E0FAF6'

interface UserRow {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  profile: Profile | null
}

// ─── INVITE USER FORM ─────────────────────────────────────────────────────────
const InviteForm = ({ employees, onClose, onSuccess }: {
  employees: { id: string; name: string; email: string }[]
  onClose: () => void
  onSuccess: () => void
}) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'employee'>('employee')
  const [employeeId, setEmployeeId] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // When employee is selected, auto-fill their email
  const handleEmployeeChange = (eid: string) => {
    setEmployeeId(eid)
    if (eid) {
      const emp = employees.find(e => e.id === eid)
      if (emp) setEmail(emp.email)
    }
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!email) e.email = 'Email is required'
    if (!email.includes('@')) e.email = 'Enter a valid email'
    if (!password || password.length < 8) e.password = 'Password must be at least 8 characters'
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true)

    try {
      await adminUsers.create({ email, password, role, employee_id: employeeId || undefined })
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create user')
      setLoading(false)
      return
    }

    toast.success(`User created and invitation sent to ${email}`)
    setLoading(false)
    onSuccess()
    onClose()
  }

  return (
    <>
      <div style={{ background: MINT_LIGHT, borderRadius: 12, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#00836D', lineHeight: 1.5 }}>
        <strong>Note:</strong> This creates the account immediately. The employee can sign in with these credentials right away.
      </div>

      {role === 'employee' && (
        <Field label="Link to Employee Profile">
          <Select value={employeeId} onChange={e => handleEmployeeChange(e.target.value)}>
            <option value="">-- Select employee (optional) --</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.name} — {e.email}</option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Email address" error={errors.email}>
        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="employee@example.com" />
      </Field>

      <Field label="Temporary password" error={errors.password}>
        <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" />
      </Field>

      <Field label="Role">
        <Select value={role} onChange={e => setRole(e.target.value as 'admin' | 'employee')}>
          <option value="employee">Employee — sees own shifts only</option>
          <option value="admin">Admin — full access</option>
        </Select>
      </Field>

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <Btn variant="secondary" full onClick={onClose}>Cancel</Btn>
        <Btn full onClick={handleSubmit} disabled={loading}>{loading ? 'Creating...' : 'Create Account'}</Btn>
      </div>
    </>
  )
}

// ─── RESET PASSWORD FORM ──────────────────────────────────────────────────────
const ResetPasswordForm = ({ userId, email, onClose }: { userId: string; email: string; onClose: () => void }) => {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!password || password.length < 8) { setError('Min. 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      await adminUsers.resetPassword(userId, password)
    } catch (err: any) {
      setError(err.message ?? 'Failed to reset password')
      setLoading(false)
      return
    }
    toast.success(`Password reset for ${email}`)
    setLoading(false)
    onClose()
  }

  return (
    <>
      <p style={{ fontSize: 14, color: '#718096', marginBottom: 16 }}>
        Setting a new password for <strong>{email}</strong>
      </p>
      <Field label="New password" error={error}>
        <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" />
      </Field>
      <Field label="Confirm password">
        <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" />
      </Field>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <Btn variant="secondary" full onClick={onClose}>Cancel</Btn>
        <Btn full onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : 'Reset Password'}</Btn>
      </div>
    </>
  )
}

// ─── EDIT ROLE FORM ──────────────────────────────────────────────────────────
const EditRoleForm = ({ user, employees, onClose, onSuccess }: {
  user: UserRow
  employees: { id: string; name: string; email: string }[]
  onClose: () => void
  onSuccess: () => void
}) => {
  const [role, setRole] = useState<'admin' | 'employee'>(user.profile?.role ?? 'employee')
  const [employeeId, setEmployeeId] = useState(user.profile?.employee_id ?? '')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      await adminUsers.updateRole(user.id, role, employeeId || undefined)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update user')
      setLoading(false)
      return
    }
    toast.success('User updated')
    setLoading(false)
    onSuccess()
    onClose()
  }

  return (
    <>
      <Field label="Role">
        <Select value={role} onChange={e => setRole(e.target.value as 'admin' | 'employee')}>
          <option value="employee">Employee</option>
          <option value="admin">Admin</option>
        </Select>
      </Field>
      {role === 'employee' && (
        <Field label="Linked Employee Profile">
          <Select value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
            <option value="">-- None --</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </Select>
        </Field>
      )}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <Btn variant="secondary" full onClick={onClose}>Cancel</Btn>
        <Btn full onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</Btn>
      </div>
    </>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null)
  const [editTarget, setEditTarget] = useState<UserRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const employees = useEmployeesStore(s => s.employees)

  const loadUsers = async () => {
    setLoading(true)
    try {
      const { users: authUsers } = await adminUsers.list()
      const { data: profiles } = await supabase.from('profiles').select('*')
      const rows: UserRow[] = (authUsers ?? []).map((u: any) => ({
        id: u.id,
        email: u.email ?? '',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        profile: profiles?.find((p: any) => p.id === u.id) ?? null,
      }))
      setUsers(rows)
    } catch (err: any) {
      toast.error(`Could not load users: ${err.message}`)
    }
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await adminUsers.delete(deleteTarget.id)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to delete user')
      return
    }
    toast.success('User deleted')
    setDeleteTarget(null)
    loadUsers()
  }

  const linkedEmployee = (u: UserRow) =>
    u.profile?.employee_id ? employees.find(e => e.id === u.profile!.employee_id) : null

  return (
    <div>
      <PageHeader title="Users" action={<Btn small onClick={() => setShowInvite(true)}>+ Invite User</Btn>} />

      <div style={{ background: '#FFF3CD', borderRadius: 12, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#9A6700', lineHeight: 1.5 }}>
        ⚠️ User management requires the Supabase <strong>service role key</strong>. See the README for how to set this up securely via an Edge Function.
      </div>

      {loading && <SkeletonList count={4} />}

      {!loading && users.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#718096' }}>No users yet.</div>
      )}

      {!loading && users.map(u => {
        const emp = linkedEmployee(u)
        const roleColor = u.profile?.role === 'admin' ? { bg: '#E8EDF8', text: NAVY } : { bg: MINT_LIGHT, text: '#00836D' }
        return (
          <Card key={u.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, color: NAVY, fontSize: 15 }}>{u.email}</div>
                {emp && <div style={{ fontSize: 13, color: '#718096', marginTop: 2 }}>👷 {emp.name}</div>}
                <div style={{ fontSize: 12, color: '#A0ADB8', marginTop: 4 }}>
                  Joined {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {u.last_sign_in_at && ` · Last seen ${new Date(u.last_sign_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </div>
              </div>
              <span style={{ background: roleColor.bg, color: roleColor.text, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>
                {u.profile?.role ?? 'no role'}
              </span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid #F0F2F5' }}>
              <Btn small variant="secondary" onClick={() => setEditTarget(u)}>Edit Role</Btn>
              <Btn small variant="secondary" onClick={() => setResetTarget(u)}>Reset Password</Btn>
              <Btn small variant="danger" onClick={() => setDeleteTarget(u)}>Delete</Btn>
            </div>
          </Card>
        )
      })}

      {showInvite && (
        <Modal title="Invite New User" onClose={() => setShowInvite(false)}>
          <InviteForm
            employees={employees.map(e => ({ id: e.id, name: e.name, email: e.email }))}
            onClose={() => setShowInvite(false)}
            onSuccess={loadUsers}
          />
        </Modal>
      )}

      {resetTarget && (
        <Modal title="Reset Password" onClose={() => setResetTarget(null)}>
          <ResetPasswordForm userId={resetTarget.id} email={resetTarget.email} onClose={() => setResetTarget(null)} />
        </Modal>
      )}

      {editTarget && (
        <Modal title="Edit User" onClose={() => setEditTarget(null)}>
          <EditRoleForm
            user={editTarget}
            employees={employees.map(e => ({ id: e.id, name: e.name, email: e.email }))}
            onClose={() => setEditTarget(null)}
            onSuccess={loadUsers}
          />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmSheet
          msg={`Delete account for ${deleteTarget.email}? They will no longer be able to sign in.`}
          label="Delete User"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
