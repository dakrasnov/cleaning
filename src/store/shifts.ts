import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Shift } from '@/types'
import { useAssignmentsStore } from '@/store/assignments'
import { useEmployeesStore } from '@/store/employees'
import { useAccrualsStore } from '@/store/accruals'

interface ShiftsState {
  shifts: Shift[]
  loading: boolean
  error: string | null
  fetch: () => Promise<void>
  create: (data: Omit<Shift, 'id' | 'created_at'>) => Promise<Shift | null>
  update: (id: string, data: Partial<Shift>) => Promise<void>
  remove: (id: string) => Promise<void>
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

export const useShiftsStore = create<ShiftsState>((set, get) => ({
  shifts: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .order('date', { ascending: true })
    if (error) set({ error: error.message })
    else set({ shifts: data ?? [] })
    set({ loading: false })
  },

  create: async (data) => {
    const { data: row, error } = await supabase
      .from('shifts')
      .insert(data)
      .select()
      .single()
    if (error) { set({ error: error.message }); return null }
    set({ shifts: [...get().shifts, row].sort((a, b) => a.date.localeCompare(b.date)) })
    return row
  },

  update: async (id, data) => {
    const prevShift = get().shifts.find(s => s.id === id)
    const { error } = await supabase.from('shifts').update(data).eq('id', id)
    if (error) { set({ error: error.message }); return }
    set({ shifts: get().shifts.map(s => s.id === id ? { ...s, ...data } : s) })

    // Accrual trigger: completing a shift creates accruals for assigned employees.
    // Amount is taken from assignment payment_info (shift-specific rate); falls back to employee salary × hours + overhead.
    if (data.status === 'completed' && prevShift?.status !== 'completed') {
      const shift = get().shifts.find(s => s.id === id)
      const { assignments } = useAssignmentsStore.getState()
      const { employees } = useEmployeesStore.getState()
      const assignment = assignments.find(a => a.shift_id === id)
      if (shift && assignment && assignment.employee_ids.length > 0) {
        const durationHours = (toMinutes(shift.time_end) - toMinutes(shift.time_start)) / 60
        const entries = assignment.employee_ids.map(eid => {
          const pi = assignment.payment_info?.find(p => p.employee_id === eid)
          const emp = employees.find(e => e.id === eid)
          const amount = pi?.amount ?? (emp ? durationHours * emp.salary + emp.overhead : 0)
          return { employee_id: eid, amount }
        })
        await useAccrualsStore.getState().createForShift(id, entries)
      }
    }

    // Reversal: moving away from 'completed' deletes accruals for that shift
    if (prevShift?.status === 'completed' && data.status && data.status !== 'completed') {
      await useAccrualsStore.getState().deleteByShift(id)
    }
  },

  remove: async (id) => {
    const { error } = await supabase.from('shifts').delete().eq('id', id)
    if (error) { set({ error: error.message }); return }
    set({ shifts: get().shifts.filter(s => s.id !== id) })
  },
}))
