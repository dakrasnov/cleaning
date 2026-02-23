import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAssignmentsStore } from '@/store/assignments'
import { useShiftsStore } from '@/store/shifts'
import { useCustomersStore } from '@/store/customers'
import { useEmployeesStore } from '@/store/employees'
import { Badge, Btn, Card, Empty, Field, Input, Modal, PageHeader, Select, SkeletonList } from '@/components/ui'
import { fmtDate, fmtTime } from '@/lib/utils'
import { buildShiftMessage, sendTelegramMessage } from '@/lib/telegram'
import type { Assignment } from '@/types'

const NAVY = '#0F2041'
const MINT = '#00C9A7'
const MINT_LIGHT = '#E0FAF6'

export default function AssignmentsPage() {
  const [searchParams] = useSearchParams()
  const { assignments, loading, create, update, remove } = useAssignmentsStore()
  const { shifts, update: updateShift } = useShiftsStore()
  const customers = useCustomersStore(s => s.customers)
  const employees = useEmployeesStore(s => s.employees)

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null)
  const [selShift, setSelShift] = useState('')
  const [selEmps, setSelEmps] = useState<string[]>([])

  useEffect(() => {
    if (searchParams.get('new') === '1') openCreate()
  }, [])

  const openCreate = () => {
    setSelShift('')
    setSelEmps([])
    setEditingAssignment(null)
    setModalMode('create')
  }

  const openEdit = (a: Assignment) => {
    setSelShift(a.shift_id)
    setSelEmps(a.employee_ids)
    setEditingAssignment(a)
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setEditingAssignment(null)
    setSelShift('')
    setSelEmps([])
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

  const toggleEmp = (id: string) =>
    setSelEmps(p => p.includes(id) ? p.filter(x => x !== id) : p.length < 3 ? [...p, id] : p)

  const notifyEmployees = async (shiftId: string, employeeIds: string[]) => {
    const shift = shifts.find(s => s.id === shiftId)
    const customer = customers.find(c => c.id === shift?.customer_id)
    if (!shift || !customer) return
    let sent = 0
    for (const eid of employeeIds) {
      const emp = employees.find(e => e.id === eid)
      if (!emp?.telegram_chat_id) continue
      const ok = await sendTelegramMessage(emp.telegram_chat_id, buildShiftMessage({
        employeeName: emp.name,
        customerName: customer.name,
        shiftId: shift.id,
        address: customer.address,
        date: shift.date,
        timeStart: shift.time_start,
        timeEnd: shift.time_end,
        price: customer.price,
        comment: shift.comment,
      }))
      if (ok) sent++
    }
    if (sent > 0) toast.success(`Telegram sent to ${sent} employee(s)`)
  }

  const handleCreate = async () => {
    if (!selShift || selEmps.length === 0) { toast.error('Select a shift and at least one employee'); return }
    const result = await create({ shift_id: selShift, employee_ids: selEmps, confirmed_by: null, confirmed_at: null })
    if (result) {
      await updateShift(selShift, { status: 'confirmed' })
      toast.success('Assignment created')
      closeModal()
      await notifyEmployees(selShift, selEmps)
    } else {
      toast.error('Failed to create assignment')
    }
  }

  const handleEdit = async () => {
    if (!editingAssignment) return
    const oldShiftId = editingAssignment.shift_id
    if (selEmps.length === 0) {
      await remove(editingAssignment.id)
      await updateShift(oldShiftId, { status: 'open' })
      toast.success('Assignment removed, shift reopened')
    } else {
      await update(editingAssignment.id, { shift_id: selShift, employee_ids: selEmps })
      if (selShift !== oldShiftId) {
        await updateShift(oldShiftId, { status: 'open' })
        await updateShift(selShift, { status: 'confirmed' })
      }
      toast.success('Assignment updated')
      closeModal()
      await notifyEmployees(selShift, selEmps)
      return
    }
    closeModal()
  }

  const shiftOptions = modalMode === 'edit' ? allShifts : openShifts

  return (
    <div>
      <PageHeader title="Assignments" action={<Btn small onClick={openCreate}>+ Assign</Btn>} />
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div><label className="text-xs font-semibold text-gray-400">FROM</label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
        <div><label className="text-xs font-semibold text-gray-400">TO</label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
      </div>

      {loading && <SkeletonList />}
      {!loading && filtered.length === 0 && <Empty icon="✅" title="No Assignments" sub="Assign employees to open shifts." cta="+ Create Assignment" onCta={openCreate} />}

      {!loading && filtered.map(a => {
        const shift = shifts.find(s => s.id === a.shift_id)
        const cust = customers.find(c => c.id === shift?.customer_id)
        return (
          <Card key={a.id}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-bold" style={{ color: NAVY }}>{cust?.name}</div>
                <div className="text-sm text-gray-500">{fmtDate(shift?.date ?? '')} · {fmtTime(shift?.time_start ?? '')} – {fmtTime(shift?.time_end ?? '')}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge status={shift?.status ?? 'open'} />
                <Btn small variant="secondary" onClick={() => openEdit(a)}>Edit</Btn>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {a.employee_ids.map(eid => {
                const emp = employees.find(e => e.id === eid)
                const confirmed = a.confirmed_by === eid
                return (
                  <span key={eid} className="text-xs font-semibold px-3 py-1 rounded-full"
                    style={{ background: confirmed ? MINT_LIGHT : '#F0F2F5', color: confirmed ? '#00836D' : NAVY }}>
                    {confirmed ? '✓ ' : ''}{emp?.name}
                  </span>
                )
              })}
            </div>
          </Card>
        )
      })}

      {modalMode && (
        <Modal title={modalMode === 'edit' ? 'Edit Assignment' : 'New Assignment'} onClose={closeModal}>
          <Field label={modalMode === 'edit' ? 'Shift' : 'Select Shift (Open Only)'}>
            <Select value={selShift} onChange={e => setSelShift(e.target.value)}>
              <option value="">-- Choose a shift --</option>
              {shiftOptions.map(s => {
                const c = customers.find(cu => cu.id === s.customer_id)
                return <option key={s.id} value={s.id}>{c?.name} — {fmtDate(s.date)} {fmtTime(s.time_start)}</option>
              })}
            </Select>
          </Field>
          <Field label="Select Employees (max 3)">
            {employees.filter(e => e.status === 'active').map(e => (
              <div key={e.id} onClick={() => toggleEmp(e.id)}
                className="flex justify-between items-center p-3 rounded-xl mb-2 cursor-pointer transition-all"
                style={{ background: selEmps.includes(e.id) ? MINT_LIGHT : '#F5F7FA', border: `2px solid ${selEmps.includes(e.id) ? MINT : 'transparent'}` }}>
                <span className="font-semibold text-sm" style={{ color: NAVY }}>{e.name}</span>
                <div className="w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: selEmps.includes(e.id) ? MINT : '#E2E8F0' }}>
                  {selEmps.includes(e.id) ? '✓' : ''}
                </div>
              </div>
            ))}
          </Field>
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
