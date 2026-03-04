import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { useCustomersStore } from '@/store/customers'
import { useShiftsStore } from '@/store/shifts'
import { useCustomerPaymentsStore } from '@/store/customerPayments'
import { Badge, BackBtn, Btn, Card, ConfirmSheet, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { fmtDate, fmtTime, todayStr, fmtAmount } from '@/lib/utils'
import type { Customer } from '@/types'

const NAVY = '#0F2041'
const MINT = '#00C9A7'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  phone: z.string().min(1, 'Required'),
  status: z.enum(['active', 'inactive']),
  address: z.string().min(1, 'Required'),
  google_maps_link: z.string().url().or(z.literal('')),
  price: z.coerce.number().min(0),
  overhead: z.coerce.number().int().min(0).default(0),
  comment: z.string(),
})
type FormData = z.infer<typeof schema>

// Extracted outside parent to prevent remount on parent re-render
const CustomerEditForm = ({ customer, onSave, onClose }: {
  customer: Customer
  onSave: (data: FormData) => void
  onClose: () => void
}) => {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { ...customer, overhead: customer.overhead ?? 0 },
  })
  return (
    <form onSubmit={handleSubmit(onSave)}>
      <Field label="Name *" error={errors.name?.message}><Input {...register('name')} /></Field>
      <Field label="Phone *" error={errors.phone?.message}><Input {...register('phone')} /></Field>
      <Field label="Status"><Select {...register('status')}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
      <Field label="Address *" error={errors.address?.message}><Input {...register('address')} /></Field>
      <Field label="Google Maps Link"><Input {...register('google_maps_link')} /></Field>
      <Field label="Price per hour"><Input type="number" {...register('price')} /></Field>
      <Field label="Overhead"><Input type="number" {...register('overhead')} /></Field>
      <Field label="Comment"><Textarea {...register('comment')} /></Field>
      <div className="flex gap-3 mt-2">
        <Btn variant="secondary" full onClick={onClose}>Cancel</Btn>
        <Btn full>Save Changes</Btn>
      </div>
    </form>
  )
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { customers, update, remove } = useCustomersStore()
  const shifts = useShiftsStore(s => s.shifts)
  const customerPayments = useCustomerPaymentsStore(s => s.payments)

  const customer = customers.find(c => c.id === id)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  if (!customer) return <div className="p-8 text-center text-gray-400">Customer not found</div>

  const allShifts = shifts.filter(s => s.customer_id === id)

  const currentTimeStr = new Date().toTimeString().slice(0, 5)
  const todayDate = todayStr()

  const isUpcoming = (s: typeof allShifts[0]) => {
    if (s.status === 'cancelled') return false
    if (s.date > todayDate) return true
    if (s.date === todayDate) return s.time_start >= currentTimeStr
    return false
  }

  const upcoming = allShifts
    .filter(isUpcoming)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time_start.localeCompare(b.time_start))

  const history = allShifts
    .filter(s => !isUpcoming(s))
    .sort((a, b) => b.date.localeCompare(a.date) || b.time_start.localeCompare(a.time_start))

  return (
    <div>
      <BackBtn onClick={() => navigate('/customers')} />
      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className="font-heading text-2xl font-bold" style={{ color: NAVY }}>{customer.name}</h2>
          <Badge status={customer.status} />
        </div>
        <div className="flex gap-2">
          <Btn small onClick={() => navigate(`/shifts?new=1&customer_id=${customer.id}`)}>+ Shift</Btn>
          <Btn small variant="secondary" onClick={() => setShowEdit(true)}>Edit</Btn>
          <Btn small variant="danger" onClick={() => setShowDelete(true)}>Delete</Btn>
        </div>
      </div>

      <Card>
        <div className="grid gap-3">
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Phone</div>
            <a href={`tel:${customer.phone}`} className="font-semibold no-underline" style={{ color: MINT }}>{customer.phone}</a>
          </div>
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Address</div>
            <a href={customer.google_maps_link || '#'} target="_blank" rel="noopener noreferrer" className="no-underline" style={{ color: NAVY }}>{customer.address} 📍</a>
          </div>
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Hourly Rate</div>
            <span className="font-extrabold text-xl" style={{ color: MINT }}>{customer.price}/hr</span>
          </div>
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Overhead</div>
            <span className="font-semibold">{customer.overhead}</span>
          </div>
          {customer.comment && <div><div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Note</div><p className="text-sm text-gray-700">{customer.comment}</p></div>}
        </div>
      </Card>

      {upcoming.length > 0 && <>
        <h3 className="font-heading font-bold mb-3 mt-5" style={{ color: NAVY }}>Upcoming Shifts</h3>
        {upcoming.map(s => {
          const payment = customerPayments.find(p => p.shift_id === s.id)
          return (
            <Card key={s.id} onClick={() => navigate(`/shifts/${s.id}`)} style={{ borderLeft: `4px solid ${MINT}` }}>
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold">{fmtDate(s.date)}</div>
                  <div className="text-sm text-gray-500">{fmtTime(s.time_start)} – {fmtTime(s.time_end)}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge status={s.status} />
                  {payment && <span className="text-sm font-bold" style={{ color: MINT }}>{fmtAmount(payment.amount)}</span>}
                </div>
              </div>
            </Card>
          )
        })}
      </>}

      <h3 className="font-heading font-bold mb-3 mt-5" style={{ color: NAVY }}>Shift History</h3>
      {history.length === 0
        ? <p className="text-sm text-gray-400">No past shifts yet.</p>
        : history.map(s => {
          const payment = customerPayments.find(p => p.shift_id === s.id)
          return (
            <Card key={s.id} onClick={() => navigate(`/shifts/${s.id}`)}>
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold">{fmtDate(s.date)}</div>
                  <div className="text-sm text-gray-500">{fmtTime(s.time_start)} – {fmtTime(s.time_end)}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge status={s.status} />
                  {payment && <span className="text-sm font-bold" style={{ color: MINT }}>{fmtAmount(payment.amount)}</span>}
                </div>
              </div>
            </Card>
          )
        })}

      {showEdit && <Modal title="Edit Customer" onClose={() => setShowEdit(false)}>
        <CustomerEditForm
          customer={customer}
          onSave={async (data) => {
            const ok = await update(customer.id, data)
            if (ok) { toast.success('Customer updated'); setShowEdit(false) }
            else toast.error('Failed to save')
          }}
          onClose={() => setShowEdit(false)}
        />
      </Modal>}
      {showDelete && <ConfirmSheet msg="Delete this customer? This cannot be undone."
        onConfirm={async () => { await remove(customer.id); toast.success('Customer deleted'); navigate('/customers') }}
        onCancel={() => setShowDelete(false)} />}
    </div>
  )
}
