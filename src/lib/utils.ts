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

// Format number as integer with space thousands separator: 99000 → "99 000"
export const fmtAmount = (n: number): string => {
  const abs = Math.round(Math.abs(n)).toString()
  const formatted = abs.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')
  return n < 0 ? '-' + formatted : formatted
}

// Duration between two HH:MM strings as HH:MM
export const durHHMM = (start: string, end: string): string => {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = eh * 60 + em - sh * 60 - sm
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}

// Duration in decimal hours
export const durationHrs = (start: string, end: string): number => {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em - sh * 60 - sm) / 60
}
