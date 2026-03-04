import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { useEmployeesStore } from '@/store/employees'
import { useAccrualsStore } from '@/store/accruals'
import { usePaymentsStore } from '@/store/payments'
import { Badge, Btn, Card, Empty, Field, FilterPills, Input, Modal, PageHeader, SearchBar, Select, SkeletonList, Textarea } from '@/components/ui'
import type { Employee } from '@/types'

const MINT = '#00C9A7'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  phone: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  hire_date: z.string(),
  status: z.enum(['active', 'inactive', 'on_leave']),
  salary: z.coerce.number().min(0),
  overhead: z.coerce.number().int().min(0).default(0),
  comment: z.string(),
  telegram_chat_id: z.string(),
})
type FormData = z.infer<typeof schema>

export const EmployeeForm = ({ initial, onSave, onClose }: { initial?: Partial<FormData>; onSave: (d: FormData) => void; onClose: () => void }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    defaultValues: initial
      ? { ...initial, overhead: initial.overhead ?? 0 }
      : { name: '', phone: '', email: '', hire_date: '', status: 'active', salary: 0, overhead: 0, comment: '', telegram_chat_id: '' },
  })
  return (
    <form onSubmit={handleSubmit(onSave)}>
      <Field label="Name *" error={errors.name?.message}><Input {...register('name')} /></Field>
      <Field label="Phone *" error={errors.phone?.message}><Input {...register('phone')} /></Field>
      <Field label="Email *" error={errors.email?.message}><Input type="email" {...register('email')} /></Field>
      <Field label="Hire Date"><Input type="date" {...register('hire_date')} /></Field>
      <Field label="Status">
        <Select {...register('status')}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="on_leave">On Leave</option>
        </Select>
      </Field>
      <Field label="Hourly Salary ($)"><Input type="number" {...register('salary')} /></Field>
      <Field label="Overhead ($)"><Input type="number" {...register('overhead')} /></Field>
      <Field label="Telegram Chat ID"><Input {...register('telegram_chat_id')} placeholder="e.g. 123456789" /></Field>
      <Field label="Comment"><Textarea {...register('comment')} /></Field>
      <div className="flex gap-3 mt-2">
        <Btn variant="secondary" full onClick={onClose}>Cancel</Btn>
        <Btn full>{initial ? 'Save Changes' : 'Add Employee'}</Btn>
      </div>
    </form>
  )
}

export default function EmployeesPage() {
  const navigate = useNavigate()
  const { employees, loading, create, fetch } = useEmployeesStore()
  const accruals = useAccrualsStore(s => s.accruals)
  const payments = usePaymentsStore(s => s.payments)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [showForm, setShowForm] = useState(false)

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) &&
    (statusFilter === 'all' || e.status === statusFilter)
  )

  const handleCreate = async (data: FormData) => {
    const result = await create(data as Omit<Employee, 'id' | 'created_at'>)
    if (result) {
      await fetch()
      toast.success('Employee added')
      setShowForm(false)
    } else {
      toast.error('Failed to add employee')
    }
  }

  return (
    <div>
      <PageHeader title="Employees" action={<Btn small onClick={() => setShowForm(true)}>+ Add</Btn>} />
      <SearchBar value={search} onChange={setSearch} placeholder="Search employees..." />
      <FilterPills value={statusFilter} onChange={setStatusFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'on_leave', label: 'On Leave' },
        ]} />

      {loading && <SkeletonList />}
      {!loading && filtered.length === 0 && <Empty icon="👷" title="No Employees" sub="Add your first team member." cta="+ Add Employee" onCta={() => setShowForm(true)} />}
      {!loading && filtered.map(e => {
        const totalAccrued = accruals.filter(a => a.employee_id === e.id).reduce((sum, a) => sum + a.amount, 0)
        const totalPaid = payments.filter(p => p.employee_id === e.id).reduce((sum, p) => sum + p.amount, 0)
        const balance = totalAccrued - totalPaid
        return (
          <Card key={e.id} onClick={() => navigate(`/employees/${e.id}`)}>
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-base mb-1" style={{ color: '#0F2041' }}>{e.name}</div>
                <a href={`tel:${e.phone}`} className="text-sm text-gray-500 no-underline" onClick={ev => ev.stopPropagation()}>{e.phone}</a>
              </div>
              <div className="text-right">
                <Badge status={e.status} />
                <div className="text-sm text-gray-400 mt-1.5">{e.salary}/hr</div>
                {totalAccrued > 0 && (
                  <div className="text-xs font-bold mt-1" style={{ color: balance > 0 ? MINT : balance < 0 ? '#E53E3E' : '#718096' }}>
                    Balance: {Math.round(balance)}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )
      })}

      {showForm && <Modal title="New Employee" onClose={() => setShowForm(false)}>
        <EmployeeForm onSave={handleCreate} onClose={() => setShowForm(false)} />
      </Modal>}
    </div>
  )
}
