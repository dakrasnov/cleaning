import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useEmployeesStore } from '@/store/employees'
import { useShiftsStore } from '@/store/shifts'
import { useAssignmentsStore } from '@/store/assignments'
import { Badge, BackBtn, Btn, Card, ConfirmSheet, Modal } from '@/components/ui'
import { EmployeeForm } from './Employees'
import { fmtDate, fmtTime, todayStr } from '@/lib/utils'

const NAVY = '#0F2041'
const MINT = '#00C9A7'

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { employees, update, remove } = useEmployeesStore()
  const shifts = useShiftsStore(s => s.shifts)
  const assignments = useAssignmentsStore(s => s.assignments)

  const employee = employees.find(e => e.id === id)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  if (!employee) return <div className="p-8 text-center text-gray-400">Employee not found</div>

  const assignedShiftIds = assignments.filter(a => a.employee_ids.includes(id!)).map(a => a.shift_id)
  const empShifts = shifts.filter(s => assignedShiftIds.includes(s.id)).sort((a, b) => b.date.localeCompare(a.date))
  const upcoming = empShifts.filter(s => s.date >= todayStr() && s.status !== 'cancelled').slice(0, 2)

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
          <div><div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Email</div><span>{employee.email}</span></div>
          <div><div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Hired</div><span>{fmtDate(employee.hire_date)}</span></div>
          <div><div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Salary</div>
            <span className="font-extrabold text-xl" style={{ color: MINT }}>${employee.salary}/mo</span></div>
          {employee.telegram_chat_id && <div><div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Telegram ID</div><span>{employee.telegram_chat_id}</span></div>}
          {employee.comment && <div><div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Note</div><p className="text-sm text-gray-700">{employee.comment}</p></div>}
        </div>
      </Card>

      {upcoming.length > 0 && <>
        <h3 className="font-heading font-bold mb-3 mt-5" style={{ color: NAVY }}>Upcoming Shifts</h3>
        {upcoming.map(s => (
          <Card key={s.id} style={{ borderLeft: `4px solid ${MINT}` }}>
            <div className="flex justify-between">
              <div><div className="font-semibold">{fmtDate(s.date)}</div><div className="text-sm text-gray-500">{fmtTime(s.time_start)} – {fmtTime(s.time_end)}</div></div>
              <Badge status={s.status} />
            </div>
          </Card>
        ))}
      </>}

      <h3 className="font-heading font-bold mb-3 mt-5" style={{ color: NAVY }}>Shift History</h3>
      {empShifts.length === 0
        ? <p className="text-sm text-gray-400">No shifts assigned yet.</p>
        : empShifts.map(s => (
          <Card key={s.id} onClick={() => navigate(`/shifts/${s.id}`)}>
            <div className="flex justify-between">
              <div><div className="font-semibold">{fmtDate(s.date)}</div><div className="text-sm text-gray-500">{fmtTime(s.time_start)} – {fmtTime(s.time_end)}</div></div>
              <Badge status={s.status} />
            </div>
          </Card>
        ))}

      {showEdit && <Modal title="Edit Employee" onClose={() => setShowEdit(false)}>
        <EmployeeForm initial={employee} onSave={async (data) => { await update(employee.id, data); toast.success('Employee updated'); setShowEdit(false) }} onClose={() => setShowEdit(false)} />
      </Modal>}
      {showDelete && <ConfirmSheet msg="Delete this employee? This cannot be undone."
        onConfirm={async () => { await remove(employee.id); toast.success('Employee deleted'); navigate('/employees') }}
        onCancel={() => setShowDelete(false)} />}
    </div>
  )
}
