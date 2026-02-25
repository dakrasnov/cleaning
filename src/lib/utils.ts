import { format, addDays, parseISO } from 'date-fns'

export const today = new Date()

export const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return format(parseISO(d), 'dd.MM.yyyy')
}

export const fmtDateShort = (d: string | null | undefined) => d ? format(parseISO(d), 'dd.MM') : '—'

export const fmtTime = (t: string) => {
  const [h, m] = t.split(':')
  const hr = parseInt(h)
  return `${hr % 12 || 12}:${m} ${hr < 12 ? 'AM' : 'PM'}`
}

export const todayStr = () => format(new Date(), 'yyyy-MM-dd')
export const weekEndStr = () => format(addDays(new Date(), 7), 'yyyy-MM-dd')

export const uid = () => crypto.randomUUID()
