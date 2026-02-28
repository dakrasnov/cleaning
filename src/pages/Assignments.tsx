import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAssignmentsStore } from '@/store/assignments'
import { useShiftsStore } from '@/store/shifts'
import { useCustomersStore } from '@/store/customers'
import { useEmployeesStore } from '@/store/employees'
import { Badge, Btn, Card, DateInput, Empty, Field, Input, Modal, PageHeader, Select, SkeletonList } from '@/components/ui'
import { fmtDate, fmtTime, todayStr } from '@/lib/utils'
import { buildShiftMessage, sendTelegramMessage, sendTelegramWithConfirmation } from '@/lib/telegram'
import type { Assignment, AssignmentStatus, PaymentInfo } from '@/types'

const NAVY = '#0F2041'
const MINT = '#00C9A7'
const MINT_LIGHT = '#E0FAF6'

export default function AssignmentsPage() {
  const [searchParams] = useSearchParams()
  const { assignments, loading, create, update, remove, fetch } = useAssignmentsStore()
  const { shifts, update: updateShift, fetch: fetchShifts } = useShiftsStore()
  const customers = useCustomersStore(s => s.customers)
  const employees = useEmployeesStore(s => s.employees)

  const [dateFrom, setDateFrom] = useState(todayStr)
  const [dateTo, setDateTo] = useState('')
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null)
  const [selShift, setSelShift] = useState('')
  const [lockedShiftId, setLockedShiftId] = useState('')
  const [slot1, setSlot1] = useState('')
  const [slot2, setSlot2] = useState('')
  const [slot3, setSlot3] = useState('')
  const [editStatus, setEditStatus] = useState<AssignmentStatus>('assigned')

  useEffect(() => {
    if (searchParams.get('new') === '1') openCreate(searchParams.get('shift_id') ?? '')
  }, [])

  const activeEmployees = employees.filter(e => e.status === 'active')

  const calcAmount = (empId: string, shiftId: string): number => {
    const emp = employees.find(e => e.id === empId)
    const shift = shifts.find(s => s.id === shiftId)
    if (!emp || !shift) return 0
    const [sh, sm] = shift.time_start.split(':').map(Number)
    const [eh, em] = shift.time_end.split(':').map(Number)
    const hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60
    return Math.round(hours * (emp.salary ?? 0) + (emp.overhead ?? 0))
  }

  const buildPaymentInfo = (empIds: string[], shiftId: string): PaymentInfo[] =>
    empIds.map(empId => ({
      employee_id: empId,
      amount: calcAmount(empId, shiftId),
      paid: false,
    }))

  const openCreate = (prefilledShiftId = '') => {
    setSelShift(prefilledShiftId)
    setLockedShiftId(prefilledShiftId)
    setSlot1('')
    setSlot2('')
    setSlot3('')
    setEditingAssignment(null)
    setModalMode('create')
  }

  const openEdit = (a: Assignment) => {
    setSelShift(a.shift_id)
    setSlot1(a.employee_ids[0] ?? '')
    setSlot2(a.employee_ids[1] ?? '')
    setSlot3(a.employee_ids[2] ?? '')
    setEditStatus((a.status ?? 'assigned') as AssignmentStatus)
    setEditingAssignment(a)
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setEditingAssignment(null)
    setSelShift('')
    setLockedShiftId('')
    setSlot1('')
    setSlot2('')
    setSlot3('')
  }

  const openShifts = shifts.filter(s => s.status === 'open')
  const allShifts = [...shifts].sort((a, b) => b.date.localeCompare(a.date))

  const filtered = assignments.filter(a => {
    const shift = shifts.find(s => s.id === a.shift_id)
    if (!shift) return false
    return (!dateFrom || shift.date >= dateFrom) && (!dateTo || shift.date <= dateTo)
  }).sort((a, b) => {
    const sa = shifts.find(s => s.id === a.shift_id)
    const sb = shifts.find(s => s.id === b.shift_id)
    return (sb?.date ?? '').localeCompare(sa?.date ?? '')
  })

  const notifyEmployees = async (shiftId: string, employeeIds: string[], assignmentId?: string) => {
    const shift = shifts.find(s => s.id === shiftId)
    const customer = customers.find(c => c.id === shift?.customer_id)
    if (!shift || !customer) return
    let sent = 0
    for (const eid of employeeIds) {
      const emp = employees.find(e => e.id === eid)
      if (!emp?.telegram_chat_id) continue
      const text = buildShiftMessage({
        employeeName: emp.name,
        customerName: customer.name,
        shiftId: shift.id,
        address: customer.address,
        googleMapsLink: customer.google_maps_link || undefined,
        date: shift.date,
        timeStart: shift.time_start,
        timeEnd: shift.time_end,
        employeeSalary: emp.salary,
        employeeOverhead: emp.overhead,
        comment: shift.comment,
      })
      const ok = assignmentId
        ? await sendTelegramWithConfirmation(emp.telegram_chat_id, text, assignmentId)
        : await sendTelegramMessage(emp.telegram_chat_id, text)
      if (ok) sent++
    }
    if (sent > 0) toast.success(`Telegram sent to ${sent} employee(s)`)
  }

  const handleCreate = async () => {
    const empIds = [slot1, slot2, slot3].filter(Boolean)
    if (!selShift || empIds.length === 0) { toast.error('Select a shift and at least one employee'); return }
    const paymentInfo = buildPaymentInfo(empIds, selShift)
    const result = await create({
      shift_id: selShift,
      employee_ids: empIds,
      confirmed_by: null,
      confirmed_at: null,
      status: 'assigned',
      payment_info: paymentInfo,
    })
    if (result) {
      await updateShift(selShift, { status: 'confirmed' })
      await fetch()
      await fetchShifts()
      toast.success('Assignment created')
      closeModal()
      await notifyEmployees(selShift, empIds, result.id)
    } else {
      toast.error('Failed to create assignment')
    }
  }

  const handleEdit = async () => {
    if (!editingAssignment) return
    const oldShiftId = editingAssignment.shift_id
    const empIds = [slot1, slot2, slot3].filter(Boolean)
    if (empIds.length === 0) {
      await remove(editingAssignment.id)
      await updateShift(oldShiftId, { status: 'open' })
      await fetch()
      await fetchShifts()
      toast.success('Assignment removed, shift reopened')
      closeModal()
      return
    }
    const paymentInfo = buildPaymentInfo(empIds, selShift)
    await update(editingAssignment.id, {
      shift_id: selShift,
      employee_ids: empIds,
      status: editStatus,
      payment_info: paymentInfo,
    })
    if (selShift !== oldShiftId) {
      await updateShift(oldShiftId, { status: 'open' })
      await updateShift(selShift, { status: 'confirmed' })
    }
    await fetch()
    await fetchShifts()
    toast.success('Assignment updated')
    closeModal()
  }

  const shiftOptions = modalMode === 'edit' ? allShifts : openShifts
  const selEmpIds = [slot1, slot2, slot3].filter(Boolean)

  return (
    <div>
      <PageHeader title="Assignments" action={<Btn small onClick={openCreate}>+ Assign</Btn>} />
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div><label className="text-xs font-semibold text-gray-400">FROM</label><DateInput value={dateFrom} onChange={setDateFrom} /></div>
        <div><label className="text-xs font-semibold text-gray-400">TO</label><DateInput value={dateTo} onChange={setDateTo} /></div>
      </div>

      {loading && <SkeletonList />}
      {!loading && filtered.length === 0 && <Empty icon="✅" title="No Assignments" sub="Assign employees to open shifts." cta="+ Create Assignment" onCta={openCreate} />}

      {!loading && filtered.map(a => {
        const shift = shifts.find(s => s.id === a.shift_id)
        const cust = customers.find(c => c.id === shift?.customer_id)
        const paymentInfo = a.payment_info ?? []
        return (
          <Card key={a.id}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-bold" style={{ color: NAVY }}>{cust?.name}</div>
                <div className="text-sm text-gray-500">{fmtDate(shift?.date ?? '')} · {fmtTime(shift?.time_start ?? '')} – {fmtTime(shift?.time_end ?? '')}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge status={a.status ?? 'assigned'} />
                <Btn small variant="secondary" onClick={() => openEdit(a)}>Edit</Btn>
              </div>
            </div>
            <div className="space-y-1.5">
              {a.employee_ids.map(eid => {
                const emp = employees.find(e => e.id === eid)
                const pi = paymentInfo.find(p => p.employee_id === eid)
                return (
                  <div key={eid} className="flex justify-between items-center rounded-xl px-3 py-2"
                    style={{ background: '#F5F7FA' }}>
                    <span className="font-semibold text-sm" style={{ color: NAVY }}>{emp?.name}</span>
                    {pi && <span className="text-sm font-bold" style={{ color: NAVY }}>{pi.amount}</span>}
                  </div>
                )
              })}
            </div>
          </Card>
        )
      })}

      {modalMode && (
        <Modal title={modalMode === 'edit' ? 'Edit Assignment' : 'New Assignment'} onClose={closeModal}>
          {lockedShiftId ? (
            <Field label="Shift">
              {(() => {
                const s = shifts.find(sh => sh.id === lockedShiftId)
                const c = customers.find(cu => cu.id === s?.customer_id)
                return (
                  <div className="input-base text-sm" style={{ color: NAVY, opacity: 0.75 }}>
                    {c?.name ?? '—'} — {fmtDate(s?.date ?? '')} {fmtTime(s?.time_start ?? '')}
                  </div>
                )
              })()}
            </Field>
          ) : (
            <Field label={modalMode === 'edit' ? 'Shift' : 'Select Shift (Open Only)'}>
              <Select value={selShift} onChange={e => setSelShift(e.target.value)}>
                <option value="">-- Choose a shift --</option>
                {shiftOptions.map(s => {
                  const c = customers.find(cu => cu.id === s.customer_id)
                  return <option key={s.id} value={s.id}>{c?.name} — {fmtDate(s.date)} {fmtTime(s.time_start)}</option>
                })}
              </Select>
            </Field>
          )}

          <Field label="Employee 1 *">
            <Select value={slot1} onChange={e => setSlot1(e.target.value)}>
              <option value="">-- Select employee --</option>
              {activeEmployees.filter(e => e.id !== slot2 && e.id !== slot3).map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Employee 2">
            <Select value={slot2} onChange={e => setSlot2(e.target.value)}>
              <option value="">-- Not needed --</option>
              {activeEmployees.filter(e => e.id !== slot1 && e.id !== slot3).map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Employee 3">
            <Select value={slot3} onChange={e => setSlot3(e.target.value)}>
              <option value="">-- Not needed --</option>
              {activeEmployees.filter(e => e.id !== slot1 && e.id !== slot2).map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </Select>
          </Field>

          {selShift && selEmpIds.length > 0 && (
            <div className="mb-4 rounded-xl p-3" style={{ background: MINT_LIGHT }}>
              <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Payment</div>
              {selEmpIds.map(empId => {
                const emp = employees.find(e => e.id === empId)!
                const amount = calcAmount(empId, selShift)
                return (
                  <div key={empId} className="flex justify-between items-center py-1.5">
                    <span className="text-sm font-semibold" style={{ color: NAVY }}>{emp?.name}</span>
                    <span className="font-bold" style={{ color: NAVY }}>{amount}</span>
                  </div>
                )
              })}
            </div>
          )}

          {modalMode === 'edit' && (
            <Field label="Assignment Status">
              <Select value={editStatus} onChange={e => setEditStatus(e.target.value as AssignmentStatus)}>
                <option value="assigned">Assigned</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
              </Select>
            </Field>
          )}

          <div className="flex gap-3">
            <Btn variant="secondary" full onClick={closeModal}>Cancel</Btn>
            <Btn full onClick={modalMode === 'edit' ? handleEdit : handleCreate}>
              {modalMode === 'edit' ? 'Save Changes' : 'Create Assignment'}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
