import { useNavigate } from 'react-router-dom'
import { useCustomersStore } from '@/store/customers'
import { useEmployeesStore } from '@/store/employees'
import { useShiftsStore } from '@/store/shifts'
import { useAssignmentsStore } from '@/store/assignments'
import { todayStr, weekEndStr, fmtDate, fmtTime } from '@/lib/utils'
import { Btn, Empty, SkeletonList } from '@/components/ui'

const NAVY = '#0F2041'
const MINT = '#00C9A7'

export default function DashboardPage() {
  const navigate = useNavigate()
  const customers   = useCustomersStore(s => s.customers)
  const employees   = useEmployeesStore(s => s.employees)
  const shifts      = useShiftsStore(s => s.shifts)
  const assignments = useAssignmentsStore(s => s.assignments)
  const loading     = useShiftsStore(s => s.loading)

  const t = todayStr()
  const we = weekEndStr()

  const todayShifts  = shifts.filter(s => s.date === t && s.status !== 'cancelled')
  const weekShifts   = shifts.filter(s => s.date >= t && s.date <= we && s.status !== 'cancelled')
  const openShifts   = weekShifts.filter(s => s.status === 'open')
  const upcoming     = weekShifts.sort((a, b) => a.date.localeCompare(b.date) || a.time_start.localeCompare(b.time_start)).slice(0, 10)

  const isAssigned = (sid: string) => assignments.some(a => a.shift_id === sid)

  const stats = [
    { label: "Today's Shifts",  value: todayShifts.length,                              icon: '📅', color: MINT         },
    { label: 'Open This Week',  value: openShifts.length,                               icon: '⚠️', color: '#ECC94B'    },
    { label: 'Active Employees',value: employees.filter(e => e.status === 'active').length, icon: '👷', color: '#4A90D9' },
    { label: 'Active Clients',  value: customers.filter(c => c.status === 'active').length,  icon: '🏠', color: '#9B59B6' },
  ]

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-3xl mb-2">{s.icon}</div>
            <div className="font-heading font-extrabold text-3xl" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 mb-6">
        <Btn full onClick={() => navigate('/shifts?new=1')}>+ New Shift</Btn>
        <Btn full variant="secondary" onClick={() => navigate('/assignments?new=1')}>+ Assignment</Btn>
      </div>

      {/* Upcoming shifts */}
      <h3 className="font-heading text-lg font-bold mb-3" style={{ color: NAVY }}>Next 7 Days</h3>

      {loading && <SkeletonList count={3} />}

      {!loading && upcoming.length === 0 && (
        <Empty icon="✨" title="All clear!" sub="No shifts in the next 7 days." />
      )}

      {!loading && upcoming.map(s => {
        const cust = customers.find(c => c.id === s.customer_id)
        const assigned = isAssigned(s.id)
        return (
          <div key={s.id} onClick={() => navigate(`/shifts/${s.id}`)}
            className="bg-white rounded-2xl p-4 mb-2.5 cursor-pointer hover:-translate-y-0.5 transition-transform shadow-sm"
            style={{ borderLeft: `4px solid ${assigned ? MINT : '#ECC94B'}` }}>
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-[15px]" style={{ color: NAVY }}>{cust?.name}</div>
                <div className="text-sm text-gray-500">{fmtDate(s.date)} · {fmtTime(s.time_start)} – {fmtTime(s.time_end)}</div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: assigned ? '#D1FAF3' : '#FFF3CD', color: assigned ? '#00836D' : '#9A6700' }}>
                {assigned ? 'Assigned' : 'Open'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
