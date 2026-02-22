import { useEffect } from 'react'
import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { useCustomersStore } from '@/store/customers'
import { useEmployeesStore } from '@/store/employees'
import { useShiftsStore } from '@/store/shifts'
import { useAssignmentsStore } from '@/store/assignments'

import LoginPage from '@/pages/Login'
import EmployeeDashboard from '@/pages/EmployeeDashboard'
import DashboardPage from '@/pages/Dashboard'
import CustomersPage from '@/pages/Customers'
import CustomerDetailPage from '@/pages/CustomerDetail'
import EmployeesPage from '@/pages/Employees'
import EmployeeDetailPage from '@/pages/EmployeeDetail'
import ShiftsPage from '@/pages/Shifts'
import ShiftDetailPage from '@/pages/ShiftDetail'
import AssignmentsPage from '@/pages/Assignments'
import UsersPage from '@/pages/Users'

const ADMIN_TABS = [
  { path: '/',            icon: '🏠', label: 'Home'    },
  { path: '/customers',   icon: '👥', label: 'Clients' },
  { path: '/employees',   icon: '👷', label: 'Team'    },
  { path: '/shifts',      icon: '📅', label: 'Shifts'  },
  { path: '/assignments', icon: '✅', label: 'Tasks'   },
  { path: '/users',       icon: '🔑', label: 'Users'   },
]

const LoadingScreen = () => (
  <div style={{ minHeight: '100vh', background: '#0F2041', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
    <div style={{ fontSize: 48 }}>🧹</div>
    <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#00C9A7', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
)

const AdminLayout = () => {
  const { signOut, user } = useAuthStore()
  const location = useLocation()
  const fetchCustomers   = useCustomersStore(s => s.fetch)
  const fetchEmployees   = useEmployeesStore(s => s.fetch)
  const fetchShifts      = useShiftsStore(s => s.fetch)
  const fetchAssignments = useAssignmentsStore(s => s.fetch)

  useEffect(() => {
    fetchCustomers()
    fetchEmployees()
    fetchShifts()
    fetchAssignments()
  }, [])

  const hideNav = location.pathname.split('/').filter(Boolean).length >= 2

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      <header style={{ background: '#0F2041', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>🧹</span>
          <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: '#fff', fontSize: 20, fontWeight: 800 }}>CleanShift</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{user?.email}</span>
          <button onClick={signOut} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}>
            Sign out
          </button>
        </div>
      </header>

      <main style={{ padding: '20px 16px', paddingBottom: hideNav ? 20 : 90 }}>
        <Routes>
          <Route path="/"              element={<DashboardPage />}      />
          <Route path="/customers"     element={<CustomersPage />}      />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/employees"     element={<EmployeesPage />}      />
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
          <Route path="/shifts"        element={<ShiftsPage />}         />
          <Route path="/shifts/:id"    element={<ShiftDetailPage />}    />
          <Route path="/assignments"   element={<AssignmentsPage />}    />
          <Route path="/users"         element={<UsersPage />}          />
          <Route path="*"              element={<Navigate to="/" />}    />
        </Routes>
      </main>

      {!hideNav && (
        <nav style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderTop: '1px solid #E8ECF0', display: 'flex', zIndex: 200, boxShadow: '0 -4px 20px rgba(15,32,65,0.1)' }}>
          {ADMIN_TABS.map(t => (
            <NavLink key={t.path} to={t.path} end={t.path === '/'}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '10px 2px 8px', textDecoration: 'none' }}>
              {({ isActive }) => (
                <>
                  <span style={{ fontSize: 18, filter: isActive ? 'none' : 'grayscale(0.5) opacity(0.55)' }}>{t.icon}</span>
                  <span style={{ fontSize: 10, fontFamily: "'DM Sans', sans-serif", fontWeight: isActive ? 700 : 500, color: isActive ? '#00C9A7' : '#718096' }}>{t.label}</span>
                  {isActive && <div style={{ width: 4, height: 4, borderRadius: 2, background: '#00C9A7' }} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}

export default function App() {
  const { initialized, initialize, user, profile } = useAuthStore()
  useEffect(() => { initialize() }, [])

  if (!initialized) return <LoadingScreen />
  if (!user) return <LoginPage />
  if (!profile) return <LoadingScreen />
  if (profile.role === 'employee') return <EmployeeDashboard />
  return <AdminLayout />
}
