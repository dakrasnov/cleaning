import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { EmployeePayment } from '@/types'

interface PaymentsState {
  payments: EmployeePayment[]
  loading: boolean
  fetch: () => Promise<void>
  create: (data: Omit<EmployeePayment, 'id' | 'created_at'>) => Promise<void>
}

export const usePaymentsStore = create<PaymentsState>((set, get) => ({
  payments: [],
  loading: false,

  fetch: async () => {
    set({ loading: true })
    const { data } = await supabase.from('employee_payments').select('*').order('paid_at', { ascending: false })
    set({ payments: data ?? [], loading: false })
  },

  create: async (data) => {
    const { data: row, error } = await supabase
      .from('employee_payments')
      .insert(data)
      .select()
      .single()
    if (!error && row) {
      set({ payments: [row, ...get().payments] })
    }
  },
}))
