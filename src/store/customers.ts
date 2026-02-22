import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Customer } from '@/types'

interface CustomersState {
  customers: Customer[]
  loading: boolean
  error: string | null
  fetch: () => Promise<void>
  create: (data: Omit<Customer, 'id' | 'created_at'>) => Promise<Customer | null>
  update: (id: string, data: Partial<Customer>) => Promise<boolean | null>
  remove: (id: string) => Promise<void>
}

export const useCustomersStore = create<CustomersState>((set, get) => ({
  customers: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) set({ error: error.message })
    else set({ customers: data ?? [] })
    set({ loading: false })
  },


create: async (data) => {
    const { data: row, error } = await supabase
      .from('customers')
      .insert(data)
      .select()
      .single()
    if (error) { 
      console.error('Supabase error:', error.message, error.details, error.hint)
      set({ error: error.message })
      return null 
    }
    set({ customers: [row, ...get().customers] })
    return row
  },


update: async (id, data) => {
  const { error } = await supabase.from('customers').update(data).eq('id', id)
  if (error) { set({ error: error.message }); return null }
  set({ customers: get().customers.map(c => c.id === id ? { ...c, ...data } : c) })
  return true
},

  
  remove: async (id) => {
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) { set({ error: error.message }); return }
    set({ customers: get().customers.filter(c => c.id !== id) })
  },
}))
