import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useEmployeesStore } from '@/store/employees'
import { useShiftsStore } from '@/store/shifts'
import { useCustomersStore } from '@/store/customers'
import { useAssignmentsStore } from '@/store/assignments'
import { useAccrualsStore } from '@/store/accruals'
import { usePaymentsStore } from '@/store/payments'
import { Badge, BackBtn, Btn, Card, ConfirmSheet, Field, Input, Modal, Textarea } from '@/components/ui'
import { EmployeeForm } from './Employees'
import { fmtDate, fmtDateShort, fmtTime, fmtAmount, durHHMM, todayStr } from '@/lib/utils'
import type { Shift } from '@/types'

const NAVY = '#0F2041'
const MINT = '#00C9A7'

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { employees, update, remove } = useEmployeesStore()
  const shifts = useShiftsStore(s => s.shifts)
  const customers = useCustomersStore(s => s.customers)
  const assignments = useAssignmentsStore(s => s.assignments)
  const accruals = useAccrualsStore(s => s.accruals)
  const { payments, create: createPayment } = usePaymentsStore()

  const employee = employees.find(e => e.id === id)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showPayment, setShowPayment] = useState(false)

  // Payment form state
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(todayStr())
  const [payNote, setPayNote] = useState('')
  const [paySubmitting, setPaySubmitting] = useState(false)

  if (!employee) return <div className="p-8 text-center text-gray-400">Employee not found</div>

  const assignedShiftIds = assignments.filter(a => a.employee_ids.includes(id!)).map(a => a.shift_id)
  const empShifts = shifts.filter(s => assignedShiftIds.includes(s.id))

  // Determine upcoming vs history based on date+time vs now
  const today = todayStr()
  const currentTimeStr = new Date().toTimeString().slice(0, 5)

  const isUpcoming = (s: Shift) => {
    if (s.status === 'cancelled') return false
    if (s.date > today) return true
    if (s.date === today) return s.time_start >= currentTimeStr
    return false
  }

  const upcoming = empShifts
    .filter(isUpcoming)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time_start.localeCompare(b.time_start))

  const history = empShifts
    .filter(s => !isUpcoming(s))
    .sort((a, b) => b.date.localeCompare(a.date) || b.time_start.localeCompare(a.time_start))
    .slice(0, 5)

  // Accounting calculations
  const empAccruals = accruals.filter(a => a.employee_id === id)
  const empPayments = payments.filter(p => p.employee_id === id)
  const totalAccrued = empAccruals.reduce((sum, a) => sum + a.amount, 0)
  const totalPaid = empPayments.reduce((sum, p) => sum + p.amount, 0)
  const balance = totalAccrued - totalPaid

  // Combined transactions: accruals as positive, payments as negative
  const allTransactions = [
    ...empAccruals.map(a => {
      const shift = shifts.find(s => s.id === a.shift_id)
      const cust = customers.find(c => c.id === shift?.customer_id)
      return {
        id: a.id,
        date: shift?.date ?? a.created_at.slice(0, 10),
        amount: a.amount,
        note: a.note,
        type: 'accrual' as const,
        label: cust?.name ?? 'Shift',
      }
    }),
    ...empPayments.map(p => ({
      id: p.id,
      date: p.paid_at,
      amount: -p.amount,
      note: p.note,
      type: 'payment' as const,
      label: 'Payment',
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  const handlePaymentSubmit = async () => {
    const amount = parseFloat(payAmount)
    if (!payAmount || isNaN(amount) || amount === 0) {
      toast.error('Enter a valid amount')
      return
    }
    setPaySubmitting(true)
    await createPayment({ employee_id: id!, amount, paid_at: payDate, note: payNote })
    toast.success('Payment recorded')
    setPaySubmitting(false)
    setShowPayment(false)
    setPayAmount('')
    setPayDate(todayStr())
    setPayNote('')
  }

  return (
    <div>
      <BackBtn onClick={() => navigate('/employees')} />
      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className="font-heading text-2xl font-bold" style={{ color: NAVY }}>{employee.name}</h2>
          <Badge status={employee.status} />
        </div>
        <div className="flex gap-2">
          <Btn small variant="secondary" onClick={() => setShowEdit(true)}>Edit</Btn>
          <Btn small variant="danger" onClick={() => setShowDelete(true)}>Delete</Btn>
        </div>
      </div>

      <Card>
        <div className="grid gap-3">
          <div><div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Phone</div>
            <a href={`tel:${employee.phone}`} className="font-semibold no-underline" style={{ color: MINT }}>{employee.phone}</a></div>
          <div><div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Hourly Salary</div>
            <span className="font-extrabold text-xl" style={{ color: MINT }}>{fmtAmount(employee.salary)}/hr</span></div>
          <div><div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Overhead</div>
            <span className="font-semibold">{fmtAmount(employee.overhead)}</span></div>
          {employee.comment && <div><div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Note</div><p className="text-sm text-gray-700">{employee.comment}</p></div>}
        </div>
      </Card>

      {upcoming.length > 0 && <>
        <h3 className="font-heading font-bold mb-3 mt-5" style={{ color: NAVY }}>Upcoming Shifts</h3>
        {upcoming.map(s => {
          const cust = customers.find(c => c.id === s.customer_id)
          return (
            <Card key={s.id} onClick={() => navigate(`/shifts/${s.id}`)} style={{ borderLeft: `4px solid ${MINT}` }}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold">{fmtDate(s.date)} {fmtTime(s.time_start)} – {fmtTime(s.time_end)}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{cust?.name}</div>
                </div>
                <Badge status={s.status} />
              </div>
            </Card>
          )
        })}
      </>}

      <h3 className="font-heading font-bold mb-3 mt-5" style={{ color: NAVY }}>Shift History</h3>
      {history.length === 0
        ? <p className="text-sm text-gray-400">No past shifts.</p>
        : history.map(s => {
          const cust = customers.find(c => c.id === s.customer_id)
          return (
            <Card key={s.id} onClick={() => navigate(`/shifts/${s.id}`)}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm font-semibold">{fmtDateShort(s.date)}&nbsp;&nbsp;{s.time_start.slice(0, 5)}&nbsp;&nbsp;{durHHMM(s.time_start, s.time_end)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{cust?.name}</div>
                </div>
                <Badge status={s.status} />
              </div>
            </Card>
          )
        })}

      {/* ── Accounting Section ───────────────────────────────────────────────── */}
      <div className="flex justify-between items-center mb-3 mt-6">
        <h3 className="font-heading font-bold" style={{ color: NAVY }}>Accounting</h3>
        <Btn small onClick={() => setShowPayment(true)}>+ Add Payment</Btn>
      </div>

      <Card>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Accrued</div>
            <div className="font-extrabold text-lg" style={{ color: '#10B981' }}>{fmtAmount(totalAccrued)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Paid</div>
            <div className="font-extrabold text-lg" style={{ color: '#3B82F6' }}>{fmtAmount(totalPaid)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Balance</div>
            <div className="font-extrabold text-lg" style={{ color: balance < 0 ? '#E53E3E' : balance > 0 ? '#10B981' : '#718096' }}>
              {fmtAmount(balance)}
            </div>
          </div>
        </div>
      </Card>

      {allTransactions.length > 0 && <>
        <h4 className="font-semibold text-sm mt-4 mb-2" style={{ color: NAVY }}>Transactions</h4>
        {allTransactions.map(t => (
          <div key={t.id} className="flex justify-between items-center py-2.5 border-b border-gray-100 last:border-0">
            <div>
              <div className="text-sm font-semibold" style={{ color: NAVY }}>{fmtDate(t.date)}</div>
              <div className="text-xs text-gray-400">{t.label}</div>
              {t.type === 'payment' && t.note && (
                <div className="text-xs text-gray-400 italic">{t.note}</div>
              )}
            </div>
            <div className="font-bold" style={{ color: t.type === 'accrual' ? '#10B981' : '#3B82F6' }}>
              {t.type === 'accrual' ? '+' : ''}{fmtAmount(t.amount)}
            </div>
          </div>
        ))}
      </>}

      {showEdit && <Modal title="Edit Employee" onClose={() => setShowEdit(false)}>
        <EmployeeForm initial={employee} onSave={async (data) => { await update(employee.id, data); toast.success('Employee updated'); setShowEdit(false) }} onClose={() => setShowEdit(false)} />
      </Modal>}

      {showDelete && <ConfirmSheet msg="Delete this employee? This cannot be undone."
        onConfirm={async () => { await remove(employee.id); toast.success('Employee deleted'); navigate('/employees') }}
        onCancel={() => setShowDelete(false)} />}

      {showPayment && (
        <Modal title="Record Payment" onClose={() => setShowPayment(false)}>
          <div className="mb-4 px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: '#F0F2F5', color: NAVY }}>
            Outstanding Balance: <span style={{ color: balance < 0 ? '#E53E3E' : '#10B981' }}>{fmtAmount(balance)}</span>
          </div>
          <Field label="Amount *">
            <input
              className="input-base"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={payAmount}
              onChange={e => setPayAmount(e.target.value)}
            />
          </Field>
          <Field label="Date *">
            <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
          </Field>
          <Field label="Note">
            <Textarea placeholder="Optional note..." value={payNote} onChange={e => setPayNote(e.target.value)} />
          </Field>
          <div className="flex gap-3 mt-2">
            <Btn variant="secondary" full onClick={() => setShowPayment(false)}>Cancel</Btn>
            <Btn full disabled={paySubmitting} onClick={handlePaymentSubmit}>
              {paySubmitting ? 'Saving…' : 'Record Payment'}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
