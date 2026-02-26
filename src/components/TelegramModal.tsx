import { useState } from 'react'
import toast from 'react-hot-toast'
import { Modal, Btn } from '@/components/ui'
import { buildShiftMessage, sendTelegramMessage } from '@/lib/telegram'
import type { Shift, Customer, Employee } from '@/types'

const MINT = '#00C9A7'
const MINT_LIGHT = '#E0FAF6'

interface Props {
  shift: Shift
  customer: Customer
  employees: Employee[]
  onClose: () => void
}

const buildPayload = (emp: Employee | undefined, shift: Shift, customer: Customer) => ({
  employeeName: emp?.name ?? 'Сотрудник',
  customerName: customer.name,
  shiftId: shift.id,
  address: customer.address,
  googleMapsLink: customer.google_maps_link || undefined,
  date: shift.date,
  timeStart: shift.time_start,
  timeEnd: shift.time_end,
  employeeSalary: emp?.salary ?? 0,
  employeeOverhead: emp?.overhead ?? 0,
  comment: shift.comment,
})

export default function TelegramModal({ shift, customer, employees, onClose }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const activeEmps = employees.filter(e => e.status === 'active')

  const toggle = (id: string) =>
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : p.length < 3 ? [...p, id] : p)

  const previewEmp = selected.length > 0 ? employees.find(e => e.id === selected[0]) : undefined
  const preview = buildShiftMessage(buildPayload(previewEmp, shift, customer))

  const handleSend = async () => {
    if (!selected.length) { toast.error('Select at least one employee'); return }
    setSending(true)
    let success = 0
    for (const eid of selected) {
      const emp = employees.find(e => e.id === eid)
      if (!emp?.telegram_chat_id) continue
      const ok = await sendTelegramMessage(emp.telegram_chat_id, buildShiftMessage(buildPayload(emp, shift, customer)))
      if (ok) success++
    }
    setSending(false)
    if (success > 0) toast.success(`Notification sent to ${success} employee(s)`)
    else toast.error('Failed to send — check bot token and employee Chat IDs')
    onClose()
  }

  return (
    <Modal title="Send Shift Notification" onClose={onClose}>
      <p className="text-sm text-gray-500 mb-4">Select employees to notify via Telegram (max 3):</p>
      {activeEmps.map(e => (
        <div key={e.id} onClick={() => toggle(e.id)}
          className="flex justify-between items-center p-3 rounded-xl mb-2 cursor-pointer transition-all"
          style={{ background: selected.includes(e.id) ? MINT_LIGHT : '#F5F7FA', border: `2px solid ${selected.includes(e.id) ? MINT : 'transparent'}` }}>
          <div>
            <div className="font-semibold text-navy">{e.name}</div>
            <div className="text-xs text-gray-400">{e.telegram_chat_id ? `Chat ID: ${e.telegram_chat_id}` : '⚠️ No Telegram ID'}</div>
          </div>
          <div className="w-5 h-5 rounded flex items-center justify-center text-white text-sm font-bold"
            style={{ background: selected.includes(e.id) ? MINT : '#E2E8F0', color: selected.includes(e.id) ? '#fff' : 'transparent' }}>
            ✓
          </div>
        </div>
      ))}

      <div className="rounded-xl p-4 my-4" style={{ background: '#1A2540' }}>
        <pre className="text-xs whitespace-pre-wrap" style={{ color: '#94A3B8', fontFamily: 'monospace' }}>{preview}</pre>
      </div>

      <div className="flex gap-3">
        <Btn variant="secondary" full onClick={onClose}>Skip</Btn>
        <Btn variant="navy" full onClick={handleSend} disabled={sending}>{sending ? 'Sending...' : 'Send via Telegram'}</Btn>
      </div>
    </Modal>
  )
}
