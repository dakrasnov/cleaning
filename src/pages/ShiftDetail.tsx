import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useShiftsStore } from '@/store/shifts'
import { useCustomersStore } from '@/store/customers'
import { useEmployeesStore } from '@/store/employees'
import { useAssignmentsStore } from '@/store/assignments'
import { Badge, BackBtn, Btn, Card, ConfirmSheet, Modal } from '@/components/ui'
import { ShiftForm } from './Shifts'
import { fmtDate, fmtTime } from '@/lib/utils'

const NAVY = '#0F2041'
const MINT = '#00C9A7'

export default function ShiftDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { shifts, update, remove } = useShiftsStore()
  const customers = useCustomersStore(s => s.customers)
  const employees = useEmployeesStore(s => s.employees)
  const assignments = useAssignmentsStore(s => s.assignments)

  const shift = shifts.find(s => s.id === id)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  if (!shift) return <div className="p-8 text-center text-gray-400">Shift not found</div>

  const customer = customers.find(c => c.id === shift.customer_id)
  const assignment = assignments.find(a => a.shift_id === id)

  return (
    <div>
      <BackBtn onClick={() => navigate('/shifts')} />
      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className="font-heading text-2xl font-bold" style={{ color: NAVY }}>{customer?.name}</h2>
          <div className="text-sm text-gray-500">{fmtDate(shift.date)} · {fmtTime(shift.time_start)} – {fmtTime(shift.time_end)}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge status={shift.status} />
          <div className="flex gap-2">
            {shift.status === 'confirmed' && (
              <Btn small variant="primary" onClick={async () => {
                await update(shift.id, { status: 'completed' })
                toast.success('Shift marked as completed')
              }}>Complete</Btn>
            )}
            <Btn small variant="secondary" onClick={() => setShowEdit(true)}>Edit</Btn>
            <Btn small variant="danger" onClick={() => setShowDelete(true)}>Delete</Btn>
          </div>
        </div>
      </div>

      <Card>
        <div className="grid gap-3">
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Address</div>
            <a href={customer?.google_maps_link || '#'} target="_blank" rel="noopener noreferrer" className="no-underline" style={{ color: NAVY }}>{customer?.address} 📍</a>
          </div>
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Rate</div>
            <span className="font-extrabold text-xl" style={{ color: MINT }}>${customer?.price}</span>
          </div>
          {shift.comment && <div><div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Note</div><p className="text-sm text-gray-700">{shift.comment}</p></div>}
        </div>
      </Card>

      <h3 className="font-heading font-bold mb-3 mt-5" style={{ color: NAVY }}>Assignment</h3>
      {assignment ? (
        <Card style={{ borderLeft: `4px solid ${MINT}` }}>
          {assignment.employee_ids.map(eid => {
            const emp = employees.find(e => e.id === eid)
            return (
              <div key={eid} className="py-2 border-b last:border-0 border-gray-100 flex justify-between items-center">
                <span className="font-semibold" style={{ color: NAVY }}>{emp?.name}</span>
                {assignment.confirmed_by === eid && <span className="text-xs font-bold" style={{ color: MINT }}>✓ Confirmed</span>}
              </div>
            )
          })}
          {assignment.confirmed_at && <div className="text-xs text-gray-400 mt-2">Confirmed at {fmtDate(assignment.confirmed_at)}</div>}
        </Card>
      ) : (
        <Card>
          <div className="text-center py-4">
            <p className="text-gray-400 text-sm mb-3">No assignment yet</p>
            <Btn small onClick={() => navigate('/assignments?new=1')}>Create Assignment</Btn>
          </div>
        </Card>
      )}

      {showEdit && <Modal title="Edit Shift" onClose={() => setShowEdit(false)}>
        <ShiftForm initial={shift} onSave={async (data) => { await update(shift.id, data); toast.success('Shift updated'); setShowEdit(false) }} onClose={() => setShowEdit(false)} />
      </Modal>}
      {showDelete && <ConfirmSheet msg="Delete this shift? This cannot be undone."
        onConfirm={async () => { await remove(shift.id); toast.success('Shift deleted'); navigate('/shifts') }}
        onCancel={() => setShowDelete(false)} />}
    </div>
  )
}
