import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { useShiftsStore } from '@/store/shifts'
import { useCustomersStore } from '@/store/customers'
import { useAssignmentsStore } from '@/store/assignments'
import { Badge, Btn, Empty, Field, FilterPills, Input, Modal, PageHeader, Select, SkeletonList, Textarea } from '@/components/ui'
import { fmtDate, fmtDateShort, todayStr, durHHMM } from '@/lib/utils'
import type { Shift } from '@/types'

const NAVY = '#0F2041'
const MINT = '#00C9A7'

// 30-min time slots for the full day: 00:00 – 23:30
const TIME_SLOTS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

// Duration options: 0:30 to 12:00
const DURATIONS: { value: number; label: string }[] = Array.from({ length: 24 }, (_, i) => {
  const mins = (i + 1) * 30
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return { value: mins, label: `${h}:${String(m).padStart(2, '0')}` }
})

const addMins = (time: string, mins: number): string => {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const diffMins = (start: string, end: string): number => {
  if (!start || !end) return 120
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.max(30, Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 30) * 30)
}

const schema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  date: z.string().min(1, 'Date is required'),
  time_start: z.string().min(1, 'Start time is required'),
  time_end: z.string().min(1, 'End time is required'),
  comment: z.string(),
  status: z.enum(['open', 'assigned', 'confirmed', 'cancelled', 'completed']),
  coef: z.number().int().min(1).max(3).default(1),
  overhead: z.coerce.number().min(0).default(0),
  customer_rate: z.coerce.number().min(0).default(0),
  customer_amount: z.coerce.number().min(0).default(0),
})
type FormData = z.infer<typeof schema>

export const ShiftForm = ({ initial, onSave, onClose, onDelete }: {
  initial?: Partial<FormData>
  onSave: (d: FormData) => void
  onClose: () => void
  onDelete?: () => void
}) => {
  const customers = useCustomersStore(s => s.customers)
  const [duration, setDuration] = useState(() =>
    initial?.time_start && initial?.time_end ? diffMins(initial.time_start, initial.time_end) : 120
  )
  const [coefValue, setCoefValue] = useState<number>(initial?.coef ?? 1)
  const defaultCustomerId = initial?.customer_id ?? (customers[0]?.id ?? '')
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    defaultValues: {
      customer_id: defaultCustomerId,
      date: initial?.date ?? todayStr(),
      time_start: (initial?.time_start ?? '09:00').slice(0, 5),
      time_end: (initial?.time_end ?? '11:00').slice(0, 5),
      comment: initial?.comment ?? '',
      status: (initial?.status ?? 'open') as FormData['status'],
      coef: initial?.coef ?? 1,
      overhead: initial?.overhead ?? customers.find(c => c.id === defaultCustomerId)?.overhead ?? 0,
      customer_rate: initial?.customer_rate ?? 0,
      customer_amount: initial?.customer_amount ?? 0,
    },
  })
  const timeStart = watch('time_start')
  const endTime = watch('time_end')
  const customerId = watch('customer_id')

  // Customer rate / amount cross-calculation
  const selectedCustomer = customers.find(c => c.id === customerId)
  const [custRate, setCustRate] = useState<number>(() => {
    if (initial?.customer_rate != null && initial.customer_rate > 0) return initial.customer_rate
    const cust = customers.find(c => c.id === defaultCustomerId)
    return cust?.price ?? 0
  })
  const [custAmount, setCustAmount] = useState<number>(() => {
    if (initial?.customer_amount != null && initial.customer_amount > 0) return initial.customer_amount
    const cust = customers.find(c => c.id === defaultCustomerId)
    const rate = cust?.price ?? 0
    const dur = (initial?.time_start && initial?.time_end ? diffMins(initial.time_start, initial.time_end) : 120) / 60
    return Math.round(rate * dur + (cust?.overhead ?? 0))
  })
  const prevCustIdRef = useRef(customerId)
  const [shiftOverhead, setShiftOverhead] = useState<number>(() => {
    if (initial?.overhead != null) return initial.overhead
    const cust = customers.find(c => c.id === defaultCustomerId)
    return cust?.overhead ?? 0
  })

  // Customer search state
  const [custSearch, setCustSearch] = useState(() =>
    customers.find(c => c.id === defaultCustomerId)?.name ?? ''
  )
  const [custOpen, setCustOpen] = useState(false)
  const filteredCustomers = custSearch
    ? customers.filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase()))
    : customers

  // Sync computed initial values into form so they're always submitted correctly
  useEffect(() => {
    setValue('customer_rate', custRate)
    setValue('customer_amount', custAmount)
    setValue('overhead', shiftOverhead)
    setValue('coef', coefValue)
  }, [])

  useEffect(() => {
    setValue('time_end', addMins(timeStart, duration))
  }, [timeStart, duration])

  // When customer changes, re-seed rate/overhead/amount from new customer
  useEffect(() => {
    if (customerId !== prevCustIdRef.current) {
      prevCustIdRef.current = customerId
      if (selectedCustomer) {
        const rate = selectedCustomer.price
        const overhead = selectedCustomer.overhead
        const amt = Math.round(rate * coefValue * (duration / 60) + overhead)
        setCustRate(rate); setValue('customer_rate', rate)
        setShiftOverhead(overhead); setValue('overhead', overhead)
        setCustAmount(amt); setValue('customer_amount', amt)
      }
    }
  }, [customerId])

  // When duration changes, recalculate amount from current rate
  useEffect(() => {
    if (custRate > 0) {
      const amt = Math.round(custRate * coefValue * (duration / 60) + shiftOverhead)
      setCustAmount(amt); setValue('customer_amount', amt)
    }
  }, [duration])

  const handleRateChange = (rate: number) => {
    setCustRate(rate); setValue('customer_rate', rate)
    const amt = Math.round(rate * coefValue * (duration / 60) + shiftOverhead)
    setCustAmount(amt); setValue('customer_amount', amt)
  }

  const handleOverheadChange = (overhead: number) => {
    setShiftOverhead(overhead); setValue('overhead', overhead)
    const amt = Math.round(custRate * coefValue * (duration / 60) + overhead)
    setCustAmount(amt); setValue('customer_amount', amt)
  }

  const handleAmountChange = (amount: number) => {
    setCustAmount(amount); setValue('customer_amount', amount)
    if (duration > 0) {
      const rate = Math.round((amount - shiftOverhead) / (coefValue * (duration / 60)))
      setCustRate(rate); setValue('customer_rate', rate)
    }
  }

  const handleCoefChange = (c: number) => {
    setCoefValue(c); setValue('coef', c)
    const amt = Math.round(custRate * c * (duration / 60) + shiftOverhead)
    setCustAmount(amt); setValue('customer_amount', amt)
  }

  return (
    <form onSubmit={handleSubmit(onSave)}>
      <Field label="Customer *" error={errors.customer_id?.message}>
        <div className="relative">
          <input
            className="input-base"
            value={custSearch}
            placeholder="Search customer..."
            autoComplete="off"
            onChange={e => { setCustSearch(e.target.value); setCustOpen(true) }}
            onFocus={() => setCustOpen(true)}
            onBlur={() => setTimeout(() => setCustOpen(false), 150)}
          />
          {custOpen && filteredCustomers.length > 0 && (
            <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
              {filteredCustomers.map(c => (
                <div
                  key={c.id}
                  className="px-4 py-2.5 cursor-pointer text-sm"
                  style={{
                    color: c.id === customerId ? MINT : NAVY,
                    fontWeight: c.id === customerId ? 700 : 400,
                    background: c.id === customerId ? '#F0FAF8' : 'transparent',
                  }}
                  onMouseDown={() => {
                    setValue('customer_id', c.id, { shouldValidate: true })
                    setCustSearch(c.name)
                    setCustOpen(false)
                  }}
                >{c.name}</div>
              ))}
            </div>
          )}
        </div>
        <input type="hidden" {...register('customer_id')} />
      </Field>
      <Field label="Date *" error={errors.date?.message}>
        <Input type="date" {...register('date')} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start *" error={errors.time_start?.message}>
          <Select {...register('time_start')}>
            {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Duration">
          <Select value={duration} onChange={e => setDuration(Number(e.target.value))}>
            {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </Select>
        </Field>
      </div>
      <div className="text-sm text-gray-500 -mt-2 mb-4">
        Ends at: <span className="font-semibold" style={{ color: MINT }}>{endTime}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Customer Rate ($/hr)">
          <input
            className="input-base"
            type="number"
            min="0"
            value={custRate}
            onChange={e => handleRateChange(Number(e.target.value))}
          />
        </Field>
        <Field label="Customer Amount">
          <input
            className="input-base"
            type="number"
            min="0"
            value={custAmount}
            onChange={e => handleAmountChange(Number(e.target.value))}
          />
        </Field>
      </div>
      <Field label="Overhead">
        <input
          className="input-base"
          type="number"
          min="0"
          value={shiftOverhead}
          onChange={e => handleOverheadChange(Number(e.target.value))}
        />
      </Field>
      <Field label="Coefficient">
        <div className="flex gap-2">
          {[1, 2, 3].map(c => (
            <button
              key={c}
              type="button"
              onClick={() => handleCoefChange(c)}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '15px',
                border: 'none',
                cursor: 'pointer',
                background: coefValue === c ? NAVY : '#F0F2F5',
                color: coefValue === c ? '#fff' : '#718096',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {c}×
            </button>
          ))}
        </div>
      </Field>
      <Field label="Status">
        <Select {...register('status')}>
          <option value="open">Open</option>
          <option value="assigned">Assigned</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </Select>
      </Field>
      <Field label="Comment"><Textarea {...register('comment')} /></Field>
      <div className="flex gap-3 mt-2">
        <Btn variant="secondary" full onClick={onClose}>Cancel</Btn>
        <Btn full>{initial?.date ? 'Save Changes' : 'Create Shift'}</Btn>
      </div>
      {onDelete && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <Btn variant="danger" full onClick={onDelete}>Delete Shift</Btn>
        </div>
      )}
    </form>
  )
}

export default function ShiftsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { shifts, loading, create, fetch } = useShiftsStore()
  const customers = useCustomersStore(s => s.customers)
  const assignments = useAssignmentsStore(s => s.assignments)

  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState(todayStr)
  const [dateTo, setDateTo] = useState('')
  const [showForm, setShowForm] = useState(false)

  const customerIdParam = searchParams.get('customer_id') ?? ''

  useEffect(() => {
    if (searchParams.get('new') === '1') setShowForm(true)
  }, [])

  const filtered = shifts
    .filter(s =>
      (statusFilter === 'all' || s.status === statusFilter) &&
      (!dateFrom || s.date >= dateFrom) &&
      (!dateTo || s.date <= dateTo)
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.time_start.localeCompare(b.time_start))

  const grouped = filtered.reduce((acc, s) => {
    if (!acc[s.date]) acc[s.date] = []
    acc[s.date].push(s)
    return acc
  }, {} as Record<string, Shift[]>)

  const totalProfit = filtered
    .filter(s => s.status === 'completed' && s.customer_amount != null)
    .reduce((sum, s) => {
      const asgn = assignments.find(a => a.shift_id === s.id)
      const empCost = asgn?.payment_info?.reduce((t, p) => t + (p.amount ?? 0), 0) ?? 0
      return sum + ((s.customer_amount ?? 0) - empCost)
    }, 0)
  const hasCompletedInView = filtered.some(s => s.status === 'completed' && s.customer_amount != null)

  const handleCreate = async (data: FormData) => {
    const result = await create(data as Omit<Shift, 'id' | 'created_at'>)
    if (result) {
      await fetch()
      toast.success('Shift created')
      setShowForm(false)
      navigate(`/shifts/${result.id}`)
    } else {
      toast.error('Failed to create shift')
    }
  }

  const statusColors: Record<string, string> = { open: '#ECC94B', assigned: '#3B82F6', confirmed: MINT, completed: '#10B981', cancelled: '#E53E3E' }

  return (
    <div>
      <PageHeader title="Shifts" action={<Btn small onClick={() => setShowForm(true)}>+ New</Btn>} />
      <FilterPills value={statusFilter} onChange={setStatusFilter}
        options={[
          { value: 'all', label: 'All' }, { value: 'open', label: 'Open' },
          { value: 'confirmed', label: 'Confirmed' }, { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
        ]} />
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div><label className="text-xs font-semibold text-gray-400">FROM</label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
        <div><label className="text-xs font-semibold text-gray-400">TO</label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
      </div>
      {hasCompletedInView && (
        <div className="flex justify-between items-center bg-white rounded-2xl px-4 py-2.5 mb-3 shadow-sm">
          <span className="text-sm font-semibold text-gray-500">Profit (completed)</span>
          <span className="font-bold text-lg" style={{ color: MINT }}>{totalProfit}</span>
        </div>
      )}

      {loading && <SkeletonList count={5} />}
      {!loading && Object.keys(grouped).length === 0 && <Empty icon="📅" title="No Shifts" sub="Create your first shift." cta="+ New Shift" onCta={() => setShowForm(true)} />}

      {!loading && Object.entries(grouped).map(([date, dayShifts]) => (
        <div key={date}>
          <div className="flex items-center gap-2 my-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{fmtDate(date)}</span>
            {date === todayStr() && <span className="text-[11px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: MINT }}>TODAY</span>}
          </div>
          {dayShifts.map(s => {
            const cust = customers.find(c => c.id === s.customer_id)
            const asgn = assignments.find(a => a.shift_id === s.id)
            const empCost = s.status === 'completed' && asgn
              ? (asgn.payment_info?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0)
              : 0
            const profit = (s.customer_amount ?? 0) - empCost
            return (
              <div key={s.id} onClick={() => navigate(`/shifts/${s.id}`)}
                className="bg-white rounded-2xl p-4 mb-2.5 cursor-pointer hover:-translate-y-0.5 transition-transform shadow-sm"
                style={{ borderLeft: `4px solid ${statusColors[s.status] ?? '#ccc'}` }}>
                <div className="flex justify-between items-center">
                  <div className="font-bold" style={{ color: NAVY }}>{cust?.name}</div>
                  <div className="flex items-center gap-1.5">
                    {asgn && asgn.employee_ids.length > 0 && (
                      <div className="flex gap-1">
                        {asgn.employee_ids.map(eid => {
                          const confirmed = asgn.payment_info?.find(p => p.employee_id === eid)?.confirmed
                          return (
                            <div key={eid} style={{ width: 9, height: 9, borderRadius: '50%', background: confirmed ? '#10B981' : '#CBD5E0' }} />
                          )
                        })}
                      </div>
                    )}
                    <Badge status={s.status} />
                  </div>
                </div>
                <div className="flex justify-between items-baseline mt-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-sm" style={{ color: NAVY }}>{fmtDateShort(s.date)}</span>
                    <span className="text-sm text-gray-500">{s.time_start.slice(0, 5)}</span>
                    <span className="text-sm text-gray-400">{durHHMM(s.time_start, s.time_end)}</span>
                  </div>
                  {s.status === 'completed' && s.customer_amount != null && (
                    <span className="text-xs text-gray-400 font-mono">{s.customer_amount}-{empCost}={profit}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {showForm && <Modal title="New Shift" onClose={() => setShowForm(false)}>
        <ShiftForm
          onSave={handleCreate}
          onClose={() => setShowForm(false)}
          initial={customerIdParam ? { customer_id: customerIdParam } : undefined}
        />
      </Modal>}

    </div>
  )
}
