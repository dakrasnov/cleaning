import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Assignment } from '@/types'

interface AssignmentsState {
  assignments: Assignment[]
  loading: boolean
  error: string | null
  fetch: () => Promise<void>
  create: (data: Omit<Assignment, 'id' | 'created_at'>) => Promise<Assignment | null>
  update: (id: string, data: Partial<Assignment>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useAssignmentsStore = create<AssignmentsState>((set, get) => ({
  assignments: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) set({ error: error.message })
    else set({ assignments: data ?? [] })
    set({ loading: false })
  },

  create: async (data) => {
    const { data: row, error } = await supabase
      .from('assignments')
      .insert(data)
      .select()
      .single()
    if (error) { set({ error: error.message }); return null }
    set({ assignments: [row, ...get().assignments] })
    return row
  },

  update: async (id, data) => {
    const { error } = await supabase.from('assignments').update(data).eq('id', id)
    if (error) { set({ error: error.message }); return }
    set({ assignments: get().assignments.map(a => a.id === id ? { ...a, ...data } : a) })
  },

  remove: async (id) => {
    const { error } = await supabase.from('assignments').delete().eq('id', id)
    if (error) { set({ error: error.message }); return }
    set({ assignments: get().assignments.filter(a => a.id !== id) })
  },
}))
