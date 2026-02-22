import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth'
import { useShiftsStore } from '@/store/shifts'
import { useCustomersStore } from '@/store/customers'
import { useAssignmentsStore } from '@/store/assignments'
import { useEmployeesStore } from '@/store/employees'
import { Card, Empty, SkeletonList } from '@/components/ui'
import { fmtDate, fmtTime, todayStr } from '@/lib/utils'

const NAVY = '#0F2041'
const MINT = '#00C9A7'

export default function EmployeeDashboard() {
  const { profile, user, signOut } = useAuthStore()
  const shifts = useShiftsStore(s => s.shifts)
  const customers = useCustomersStore(s => s.customers)
  const assignments = useAssignmentsStore(s => s.assignments)
  const employees = useEmployeesStore(s => s.employees)
  const fetchShifts = useShiftsStore(s => s.fetch)
  const fetchCustomers = useCustomersStore(s => s.fetch)
  const fetchAssignments = useAssignmentsStore(s => s.fetch)
  const fetchEmployees = useEmployeesStore(s => s.fetch)
  const loading = useShiftsStore(s => s.loading)

  useEffect(() => {
    fetchShifts()
    fetchCustomers()
    fetchAssignments()
    fetchEmployees()
  }, [])

  const myEmployeeId = profile?.employee_id
  const myEmployee = employees.find(e => e.id === myEmployeeId)
  const today = todayStr()

  // My confirmed upcoming shifts (assigned to me, future)
  const myAssignedShiftIds = assignments
    .filter(a => myEmployeeId && a.employee_ids.includes(myEmployeeId))
    .map(a => a.shift_id)

  const myUpcomingShifts = shifts
    .filter(s => myAssignedShiftIds.includes(s.id) && s.date >= today && s.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date) || a.time_start.localeCompare(b.time_start))
    .slice(0, 7)

  // Open shifts not overlapping with my confirmed shifts
  const myShiftTimes = myUpcomingShifts.map(s => ({ date: s.date, start: s.time_start, end: s.time_end }))

  const overlaps = (s: typeof shifts[0]) =>
    myShiftTimes.some(t =>
      t.date === s.date && t.start < s.time_end && t.end > s.time_start
    )

  const openShifts = shifts
    .filter(s => s.status === 'open' && s.date >= today && !overlaps(s))
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ background: NAVY, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
        <div>
          <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: '#fff', fontSize: 20, fontWeight: 800 }}>
            🧹 CleanShift
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
            {myEmployee?.name ?? user?.email}
          </span>
          <button onClick={signOut}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600 }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
        {/* Greeting */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: '#718096', fontSize: 14 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 26, color: NAVY, fontWeight: 800 }}>
            Hi {myEmployee?.name?.split(' ')[0] ?? 'there'} 👋
          </h2>
        </div>

        {/* My upcoming shifts */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, color: NAVY, fontWeight: 700, marginBottom: 12 }}>
            Your Next 7 Shifts
          </h3>

          {loading && <SkeletonList count={3} />}

          {!loading && myUpcomingShifts.length === 0 && (
            <Empty icon="📭" title="No upcoming shifts" sub="You have no confirmed shifts scheduled. Check open shifts below." />
          )}

          {!loading && myUpcomingShifts.map(s => {
            const cust = customers.find(c => c.id === s.customer_id)
            return (
              <div key={s.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, boxShadow: '0 2px 10px rgba(15,32,65,0.07)', borderLeft: `4px solid ${MINT}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: NAVY, fontSize: 15 }}>{fmtDate(s.date)}</div>
                    <div style={{ color: '#718096', fontSize: 13 }}>{fmtTime(s.time_start)} – {fmtTime(s.time_end)}</div>
                  </div>
                  <span style={{ background: '#D1FAF3', color: '#00836D', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                    Confirmed
                  </span>
                </div>
                {cust && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F0F2F5' }}>
                    <a href={cust.google_maps_link || '#'} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#718096', fontSize: 13, textDecoration: 'none' }}>
                      📍 {cust.address}
                    </a>
                    <div style={{ color: MINT, fontWeight: 700, fontSize: 16, marginTop: 4 }}>${cust.price}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Open shifts available to claim */}
        <div>
          <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, color: NAVY, fontWeight: 700, marginBottom: 4 }}>
            Open Shifts
          </h3>
          <p style={{ color: '#718096', fontSize: 13, marginBottom: 12 }}>
            Available shifts with no scheduling conflict
          </p>

          {!loading && openShifts.length === 0 && (
            <Empty icon="✨" title="No open shifts" sub="There are no available shifts right now." />
          )}

          {!loading && openShifts.map(s => {
            const cust = customers.find(c => c.id === s.customer_id)
            return (
              <div key={s.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, boxShadow: '0 2px 10px rgba(15,32,65,0.07)', borderLeft: '4px solid #ECC94B' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: NAVY, fontSize: 15 }}>{fmtDate(s.date)}</div>
                    <div style={{ color: '#718096', fontSize: 13 }}>{fmtTime(s.time_start)} – {fmtTime(s.time_end)}</div>
                  </div>
                  <span style={{ background: '#FFF3CD', color: '#9A6700', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                    Open
                  </span>
                </div>
                {cust && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F0F2F5' }}>
                    <a href={cust.google_maps_link || '#'} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#718096', fontSize: 13, textDecoration: 'none' }}>
                      📍 {cust.address}
                    </a>
                    <div style={{ color: MINT, fontWeight: 700, fontSize: 16, marginTop: 4 }}>${cust.price}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
