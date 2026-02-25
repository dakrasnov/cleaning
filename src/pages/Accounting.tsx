import { useNavigate } from 'react-router-dom'
import { useEmployeesStore } from '@/store/employees'
import { useAccrualsStore } from '@/store/accruals'
import { usePaymentsStore } from '@/store/payments'
import { Card, PageHeader } from '@/components/ui'

const NAVY = '#0F2041'

export default function AccountingPage() {
  const navigate = useNavigate()
  const employees = useEmployeesStore(s => s.employees)
  const accruals = useAccrualsStore(s => s.accruals)
  const payments = usePaymentsStore(s => s.payments)

  const rows = employees
    .filter(e => e.status !== 'inactive')
    .map(emp => {
      const totalAccrued = accruals
        .filter(a => a.employee_id === emp.id)
        .reduce((sum, a) => sum + a.amount, 0)
      const totalPaid = payments
        .filter(p => p.employee_id === emp.id)
        .reduce((sum, p) => sum + p.amount, 0)
      return { emp, totalAccrued, totalPaid, balance: totalAccrued - totalPaid }
    })
    .sort((a, b) => b.balance - a.balance)

  const grandAccrued = rows.reduce((s, r) => s + r.totalAccrued, 0)
  const grandPaid = rows.reduce((s, r) => s + r.totalPaid, 0)
  const grandBalance = grandAccrued - grandPaid

  return (
    <div>
      <PageHeader title="Payroll" />

      <Card>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Accrued</div>
            <div className="font-extrabold text-lg" style={{ color: '#10B981' }}>{grandAccrued.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Paid</div>
            <div className="font-extrabold text-lg" style={{ color: '#3B82F6' }}>{grandPaid.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Outstanding</div>
            <div className="font-extrabold text-lg" style={{ color: grandBalance > 0 ? '#10B981' : '#718096' }}>
              {grandBalance.toFixed(2)}
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-5">
        {rows.map(({ emp, totalAccrued, totalPaid, balance }) => (
          <Card key={emp.id} onClick={() => navigate(`/employees/${emp.id}`)}>
            <div className="flex justify-between items-center">
              <div>
                <div className="font-semibold" style={{ color: NAVY }}>{emp.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {totalAccrued.toFixed(2)} accrued · {totalPaid.toFixed(2)} paid
                </div>
              </div>
              <div className="text-right">
                <div className="font-extrabold text-lg" style={{
                  color: balance > 0 ? '#10B981' : balance < 0 ? '#E53E3E' : '#718096'
                }}>
                  {balance.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400">balance</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
