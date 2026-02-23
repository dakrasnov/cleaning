import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Employee } from '@/types'

interface EmployeesState {
  employees: Employee[]
  loading: boolean
  error: string | null
  fetch: () => Promise<void>
  create: (data: Omit<Employee, 'id' | 'created_at'>) => Promise<Employee | null>
  update: (id: string, data: Partial<Employee>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useEmployeesStore = create<EmployeesState>((set, get) => ({
  employees: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) set({ error: error.message })
    else set({ employees: data ?? [] })
    set({ loading: false })
  },

  create: async (data) => {
    const payload = { ...data, hire_date: data.hire_date || null }
    const { data: row, error } = await supabase
      .from('employees')
      .insert(payload)
      .select()
      .single()
    if (error) { console.error('Employee create error:', error); set({ error: error.message }); return null }
    set({ employees: [row, ...get().employees] })
    return row
  },

  update: async (id, data) => {
    const { error } = await supabase.from('employees').update(data).eq('id', id)
    if (error) { set({ error: error.message }); return }
    set({ employees: get().employees.map(e => e.id === id ? { ...e, ...data } : e) })
  },

  remove: async (id) => {
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (error) { set({ error: error.message }); return }
    set({ employees: get().employees.filter(e => e.id !== id) })
  },
}))
