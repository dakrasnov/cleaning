import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { EmployeeAccrual } from '@/types'

interface AccrualsState {
  accruals: EmployeeAccrual[]
  loading: boolean
  fetch: () => Promise<void>
  createForShift: (shiftId: string, entries: { employee_id: string; amount: number }[]) => Promise<void>
  deleteByShift: (shiftId: string) => Promise<void>
}

export const useAccrualsStore = create<AccrualsState>((set, get) => ({
  accruals: [],
  loading: false,

  fetch: async () => {
    set({ loading: true })
    const { data } = await supabase.from('employee_accruals').select('*').order('created_at', { ascending: false })
    set({ accruals: data ?? [], loading: false })
  },

  createForShift: async (shiftId, entries) => {
    if (!entries.length) return
    const rows = entries.map(e => ({
      employee_id: e.employee_id,
      shift_id: shiftId,
      amount: e.amount,
      note: 'Shift completed',
    }))
    const { data, error } = await supabase
      .from('employee_accruals')
      .upsert(rows, { onConflict: 'employee_id,shift_id' })
      .select()
    if (!error && data) {
      set({ accruals: [...get().accruals, ...data] })
    }
  },

  deleteByShift: async (shiftId) => {
    await supabase.from('employee_accruals').delete().eq('shift_id', shiftId)
    set({ accruals: get().accruals.filter(a => a.shift_id !== shiftId) })
  },
}))
