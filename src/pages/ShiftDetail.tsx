import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useShiftsStore } from '@/store/shifts'
import { useCustomersStore } from '@/store/customers'
import { useEmployeesStore } from '@/store/employees'
import { useAssignmentsStore } from '@/store/assignments'
import { Badge, BackBtn, Btn, Card, ConfirmSheet, Field, Input, Modal, Select } from '@/components/ui'
import { ShiftForm } from './Shifts'
import { fmtDate, durHHMM, durationHrs, fmtAmount } from '@/lib/utils'
import { buildShiftMessage, buildCancellationMessage, sendTelegramMessage, sendTelegramWithConfirmation } from '@/lib/telegram'

const NAVY = '#0F2041'
const MINT = '#00C9A7'

export default function ShiftDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { shifts, update, remove, fetch } = useShiftsStore()
  const customers = useCustomersStore(s => s.customers)
  const employees = useEmployeesStore(s => s.employees)
  const { assignments, update: updateAssignment, create: createAssignment, remove: removeAssignment, fetch: fetchAssignments } = useAssignmentsStore()

  const shift = shifts.find(s => s.id === id)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showAssignEdit, setShowAssignEdit] = useState(false)
  const [slot1, setSlot1] = useState('')
  const [slot2, setSlot2] = useState('')
  const [slot3, setSlot3] = useState('')
  const [rate1, setRate1] = useState(0)
  const [over1, setOver1] = useState(0)
  const [rate2, setRate2] = useState(0)
  const [over2, setOver2] = useState(0)
  const [rate3, setRate3] = useState(0)
  const [over3, setOver3] = useState(0)

  if (!shift) return <div className="p-8 text-center text-gray-400">Shift not found</div>

  const customer = customers.find(c => c.id === shift.customer_id)
  const assignment = assignments.find(a => a.shift_id === id)
  const shiftDurHrs = durationHrs(shift.time_start, shift.time_end)
  const activeEmployees = employees.filter(e => e.status === 'active')

  const customerCost = customer ? fmtAmount(customer.price * shiftDurHrs * (shift.coef ?? 1) + customer.overhead) : '—'

  const openAssignEdit = () => {
    const ids = assignment?.employee_ids ?? []
    setSlot1(ids[0] ?? ''); setSlot2(ids[1] ?? ''); setSlot3(ids[2] ?? '')
    const getPI = (idx: number) => {
      const pi = assignment?.payment_info?.find(p => p.employee_id === ids[idx])
      const emp = employees.find(e => e.id === ids[idx])
      return { r: pi?.hour_rate ?? emp?.salary ?? 0, o: pi?.overhead ?? emp?.overhead ?? 0 }
    }
    const r0 = getPI(0); setRate1(r0.r); setOver1(r0.o)
    const r1 = getPI(1); setRate2(r1.r); setOver2(r1.o)
    const r2 = getPI(2); setRate3(r2.r); setOver3(r2.o)
    setShowAssignEdit(true)
  }

  const notifyEmployees = async (empIds: string[], assignmentId: string) => {
    if (!customer) return
    let sent = 0
    for (const eid of empIds) {
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
      const ok = await sendTelegramWithConfirmation(emp.telegram_chat_id, text, assignmentId)
      if (ok) sent++
    }
    if (sent > 0) toast.success(`Telegram sent to ${sent} employee(s)`)
  }

  const handleAssignSave = async () => {
    const empIds = [slot1, slot2, slot3].filter(Boolean)

    if (empIds.length === 0) {
      if (assignment) {
        await removeAssignment(assignment.id)
        await update(id!, { status: 'open' })
        await fetchAssignments()
        await fetch()
        toast.success('Assignment removed')
      }
      setShowAssignEdit(false)
      return
    }

    const slotRates = [
      { id: slot1, r: rate1, o: over1 },
      { id: slot2, r: rate2, o: over2 },
      { id: slot3, r: rate3, o: over3 },
    ]
    const paymentInfo = empIds.map(eid => {
      const existing = assignment?.payment_info?.find(p => p.employee_id === eid)
      const s = slotRates.find(d => d.id === eid)
      const hourRate = s?.r ?? 0
      const overhead = s?.o ?? 0
      return {
        employee_id: eid,
        amount: Math.round(shiftDurHrs * hourRate + overhead),
        paid: existing?.paid ?? false,
        confirmed: existing?.confirmed ?? false,
        hour_rate: hourRate,
        overhead,
      }
    })

    if (assignment) {
      await updateAssignment(assignment.id, { employee_ids: empIds, payment_info: paymentInfo })
      // notify only newly added employees
      const newEmpIds = empIds.filter(eid => !assignment.employee_ids.includes(eid))
      if (newEmpIds.length > 0) await notifyEmployees(newEmpIds, assignment.id)
    } else {
      const result = await createAssignment({
        shift_id: id!,
        employee_ids: empIds,
        confirmed_by: null,
        confirmed_at: null,
        status: 'assigned',
        payment_info: paymentInfo,
      })
      if (result) {
        await update(id!, { status: 'assigned' })
        await notifyEmployees(empIds, result.id)
      }
    }

    await fetchAssignments()
    await fetch()
    toast.success('Assignment saved')
    setShowAssignEdit(false)
  }

  return (
    <div>
      <BackBtn onClick={() => navigate('/shifts')} />
      <div className="flex justify-between items-start mb-5">
        <div>
          <h2
            className="font-heading text-2xl font-bold cursor-pointer hover:opacity-75 transition-opacity"
            style={{ color: NAVY }}
            onClick={() => customer && navigate(`/customers/${customer.id}`)}
          >{customer?.name}</h2>
          <div className="text-sm text-gray-500">
            {fmtDate(shift.date)} · {shift.time_start.slice(0, 5)} – {shift.time_end.slice(0, 5)}
          </div>
          <div className="text-base font-bold mt-1" style={{ color: NAVY }}>
            {durHHMM(shift.time_start, shift.time_end)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge status={shift.status} />
          {assignment && assignment.employee_ids.length > 0 && (
            <div className="flex gap-1.5 mt-0.5">
              {assignment.employee_ids.map(eid => {
                const confirmed = assignment.payment_info?.find(p => p.employee_id === eid)?.confirmed
                return (
                  <div
                    key={eid}
                    title={employees.find(e => e.id === eid)?.name}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: confirmed ? '#10B981' : '#CBD5E0',
                    }}
                  />
                )
              })}
            </div>
          )}
          <Btn small variant="secondary" onClick={() => setShowEdit(true)}>Edit</Btn>
        </div>
      </div>

      <Card>
        <div className="grid gap-3">
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Address</div>
            <a href={customer?.google_maps_link || '#'} target="_blank" rel="noopener noreferrer" className="no-underline" style={{ color: NAVY }}>{customer?.address} 📍</a>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">For Customer</span>
            <span className="font-extrabold text-xl" style={{ color: MINT }}>{customerCost}</span>
          </div>
          {assignment && assignment.employee_ids.map(eid => {
            const emp = employees.find(e => e.id === eid)
            if (!emp) return null
            const pi = assignment.payment_info?.find(p => p.employee_id === eid)
            const hourRate = pi?.hour_rate ?? emp.salary
            const empOverhead = pi?.overhead ?? emp.overhead
            const sal = fmtAmount(hourRate * shiftDurHrs + empOverhead)
            return (
              <div key={eid} className="flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  To Employee{assignment.employee_ids.length > 1 ? ` (${emp.name})` : ''}
                </span>
                <span className="font-extrabold text-xl" style={{ color: MINT }}>{sal}</span>
              </div>
            )
          })}
          {shift.comment && <div><div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Note</div><p className="text-sm text-gray-700">{shift.comment}</p></div>}
        </div>
      </Card>

      <div className="flex justify-between items-center mb-3 mt-5">
        <h3 className="font-heading font-bold" style={{ color: NAVY }}>Assignment</h3>
        {assignment
          ? <Btn small variant="secondary" onClick={openAssignEdit}>Edit</Btn>
          : <Btn small onClick={openAssignEdit}>+ Assign</Btn>
        }
      </div>

      {assignment ? (
        <Card style={{ borderLeft: `4px solid ${MINT}` }}>
          {assignment.employee_ids.map(eid => {
            const emp = employees.find(e => e.id === eid)
            const confirmed = assignment.payment_info?.find(p => p.employee_id === eid)?.confirmed
            return (
              <div key={eid} className="py-2 border-b last:border-0 border-gray-100 flex justify-between items-center">
                <span
                  className="font-semibold cursor-pointer hover:opacity-75 transition-opacity"
                  style={{ color: NAVY }}
                  onClick={() => navigate(`/employees/${eid}`)}
                >{emp?.name}</span>
                {confirmed
                  ? <span className="text-xs font-bold" style={{ color: '#10B981' }}>✓ Confirmed</span>
                  : <span className="text-xs font-medium" style={{ color: '#A0AEC0' }}>Pending</span>
                }
              </div>
            )
          })}
          {assignment.confirmed_at && <div className="text-xs text-gray-400 mt-2">Confirmed at {fmtDate(assignment.confirmed_at)}</div>}
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-gray-400 text-center py-2">No employees assigned yet</p>
        </Card>
      )}

      {/* Shift edit modal */}
      {showEdit && <Modal title="Edit Shift" onClose={() => setShowEdit(false)}>
        <ShiftForm
          initial={shift}
          onSave={async (data) => { await update(shift.id, data); await fetch(); toast.success('Shift updated'); setShowEdit(false) }}
          onClose={() => setShowEdit(false)}
          onDelete={() => { setShowEdit(false); setShowDelete(true) }}
        />
      </Modal>}

      {/* Assignment edit/create modal */}
      {showAssignEdit && (
        <Modal title={assignment ? 'Edit Assignment' : 'Create Assignment'} onClose={() => setShowAssignEdit(false)}>
          <Field label="Employee 1 *">
            <Select value={slot1} onChange={e => {
              const empId = e.target.value
              setSlot1(empId)
              const emp = employees.find(e => e.id === empId)
              setRate1(emp?.salary ?? 0); setOver1(emp?.overhead ?? 0)
            }}>
              <option value="">-- Select employee --</option>
              {activeEmployees.filter(e => e.id !== slot2 && e.id !== slot3).map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </Select>
          </Field>
          {slot1 && (
            <div className="grid grid-cols-2 gap-2 -mt-2 mb-2 pl-4">
              <Field label="Hour Rate">
                <Input type="number" min="0" value={rate1} onChange={e => setRate1(Number(e.target.value))} />
              </Field>
              <Field label="Overhead">
                <Input type="number" min="0" value={over1} onChange={e => setOver1(Number(e.target.value))} />
              </Field>
            </div>
          )}
          <Field label="Employee 2">
            <Select value={slot2} onChange={e => {
              const empId = e.target.value
              setSlot2(empId)
              const emp = employees.find(e => e.id === empId)
              setRate2(emp?.salary ?? 0); setOver2(emp?.overhead ?? 0)
            }}>
              <option value="">-- Not needed --</option>
              {activeEmployees.filter(e => e.id !== slot1 && e.id !== slot3).map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </Select>
          </Field>
          {slot2 && (
            <div className="grid grid-cols-2 gap-2 -mt-2 mb-2 pl-4">
              <Field label="Hour Rate">
                <Input type="number" min="0" value={rate2} onChange={e => setRate2(Number(e.target.value))} />
              </Field>
              <Field label="Overhead">
                <Input type="number" min="0" value={over2} onChange={e => setOver2(Number(e.target.value))} />
              </Field>
            </div>
          )}
          <Field label="Employee 3">
            <Select value={slot3} onChange={e => {
              const empId = e.target.value
              setSlot3(empId)
              const emp = employees.find(e => e.id === empId)
              setRate3(emp?.salary ?? 0); setOver3(emp?.overhead ?? 0)
            }}>
              <option value="">-- Not needed --</option>
              {activeEmployees.filter(e => e.id !== slot1 && e.id !== slot2).map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </Select>
          </Field>
          {slot3 && (
            <div className="grid grid-cols-2 gap-2 -mt-2 mb-2 pl-4">
              <Field label="Hour Rate">
                <Input type="number" min="0" value={rate3} onChange={e => setRate3(Number(e.target.value))} />
              </Field>
              <Field label="Overhead">
                <Input type="number" min="0" value={over3} onChange={e => setOver3(Number(e.target.value))} />
              </Field>
            </div>
          )}
          <div className="flex gap-3 mt-2">
            <Btn variant="secondary" full onClick={() => setShowAssignEdit(false)}>Cancel</Btn>
            <Btn full onClick={handleAssignSave}>Save</Btn>
          </div>
          {assignment && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <Btn variant="danger" full onClick={async () => {
                await removeAssignment(assignment.id)
                await update(id!, { status: 'open' })
                await fetchAssignments()
                await fetch()
                toast.success('Assignment removed')
                setShowAssignEdit(false)
              }}>Remove Assignment</Btn>
            </div>
          )}
        </Modal>
      )}

      {showDelete && <ConfirmSheet msg="Delete this shift? This cannot be undone."
        onConfirm={async () => {
          if (assignment && customer) {
            for (const eid of assignment.employee_ids) {
              const emp = employees.find(e => e.id === eid)
              if (!emp?.telegram_chat_id) continue
              const text = buildCancellationMessage(emp.name, shift.date, shift.time_start, customer.name)
              await sendTelegramMessage(emp.telegram_chat_id, text)
            }
            await removeAssignment(assignment.id)
          }
          await remove(shift.id)
          toast.success('Shift deleted')
          navigate('/shifts')
        }}
        onCancel={() => setShowDelete(false)} />}
    </div>
  )
}
