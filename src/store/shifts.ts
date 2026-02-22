import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Shift } from '@/types'

interface ShiftsState {
  shifts: Shift[]
  loading: boolean
  error: string | null
  fetch: () => Promise<void>
  create: (data: Omit<Shift, 'id' | 'created_at'>) => Promise<Shift | null>
  update: (id: string, data: Partial<Shift>) => Promise<void>
  remove: (id: string) => Promise<void>
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
    const { error } = await supabase.from('shifts').update(data).eq('id', id)
    if (error) { set({ error: error.message }); return }
    set({ shifts: get().shifts.map(s => s.id === id ? { ...s, ...data } : s) })
  },

  remove: async (id) => {
    const { error } = await supabase.from('shifts').delete().eq('id', id)
    if (error) { set({ error: error.message }); return }
    set({ shifts: get().shifts.filter(s => s.id !== id) })
  },
}))
