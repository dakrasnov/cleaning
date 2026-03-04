import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { CustomerPayment } from '@/types'

interface CustomerPaymentsState {
  payments: CustomerPayment[]
  loading: boolean
  fetch: () => Promise<void>
  createForShift: (shiftId: string, customerId: string, amount: number) => Promise<void>
  deleteByShift: (shiftId: string) => Promise<void>
}

export const useCustomerPaymentsStore = create<CustomerPaymentsState>((set, get) => ({
  payments: [],
  loading: false,

  fetch: async () => {
    set({ loading: true })
    const { data } = await supabase
      .from('customer_payments')
      .select('*')
      .order('created_at', { ascending: false })
    set({ payments: data ?? [], loading: false })
  },

  createForShift: async (shiftId, customerId, amount) => {
    const { data, error } = await supabase
      .from('customer_payments')
      .upsert({ shift_id: shiftId, customer_id: customerId, amount }, { onConflict: 'shift_id' })
      .select()
      .single()
    if (!error && data) {
      set({ payments: [...get().payments.filter(p => p.shift_id !== shiftId), data] })
    }
  },

  deleteByShift: async (shiftId) => {
    await supabase.from('customer_payments').delete().eq('shift_id', shiftId)
    set({ payments: get().payments.filter(p => p.shift_id !== shiftId) })
  },
}))
