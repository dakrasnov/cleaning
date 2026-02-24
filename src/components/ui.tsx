import React, { ReactNode } from 'react'

const MINT = '#00C9A7'
const NAVY = '#0F2041'
const MINT_LIGHT = '#E0FAF6'

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
const statusColors: Record<string, { bg: string; text: string }> = {
  active:    { bg: '#D1FAF3', text: '#00836D' },
  inactive:  { bg: '#FFE4E4', text: '#C0392B' },
  on_leave:  { bg: '#FFF3CD', text: '#9A6700' },
  open:      { bg: '#FFF3CD', text: '#9A6700' },
  confirmed: { bg: '#D1FAF3', text: '#00836D' },
  cancelled: { bg: '#FFE4E4', text: '#C0392B' },
  assigned:  { bg: '#FFF3CD', text: '#9A6700' },
  completed: { bg: '#DBEAFE', text: '#1E40AF' },
}

export const Badge = ({ status }: { status: string }) => {
  const c = statusColors[status] ?? { bg: '#eee', text: '#666' }
  return (
    <span className="badge" style={{ background: c.bg, color: c.text }}>
      {status.replace('_', ' ')}
    </span>
  )
}

// ─── CARD ─────────────────────────────────────────────────────────────────────
export const Card = ({ children, onClick, className = '' }: { children: ReactNode; onClick?: () => void; className?: string }) => (
  <div onClick={onClick} className={`card ${onClick ? 'cursor-pointer hover:-translate-y-0.5 transition-transform' : ''} ${className}`}>
    {children}
  </div>
)

// ─── PAGE HEADER ──────────────────────────────────────────────────────────────
export const PageHeader = ({ title, action }: { title: string; action?: ReactNode }) => (
  <div className="flex justify-between items-center mb-5">
    <h2 className="font-heading text-2xl font-bold" style={{ color: NAVY }}>{title}</h2>
    {action}
  </div>
)

// ─── BACK BUTTON ──────────────────────────────────────────────────────────────
export const BackBtn = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} className="flex items-center gap-1.5 mb-5 font-semibold text-sm"
    style={{ background: 'none', border: 'none', cursor: 'pointer', color: NAVY, fontFamily: 'inherit' }}>
    ← Back
  </button>
)

// ─── BUTTON ───────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'navy'
const btnStyles: Record<BtnVariant, { background: string; color: string }> = {
  primary:   { background: MINT, color: '#fff' },
  secondary: { background: '#F0F2F5', color: NAVY },
  danger:    { background: '#FFE4E4', color: '#C0392B' },
  navy:      { background: NAVY, color: '#fff' },
}

export const Btn = ({
  children, variant = 'primary', onClick, full, small, disabled, style: sx,
}: {
  children: ReactNode; variant?: BtnVariant; onClick?: () => void
  full?: boolean; small?: boolean; disabled?: boolean; style?: React.CSSProperties
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      ...btnStyles[variant],
      border: 'none',
      borderRadius: 12,
      fontFamily: 'inherit',
      fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      padding: small ? '8px 16px' : '13px 20px',
      fontSize: small ? 13 : 15,
      width: full ? '100%' : 'auto',
      transition: 'all 0.15s',
      ...sx,
    }}>
    {children}
  </button>
)

// ─── FORM FIELD ───────────────────────────────────────────────────────────────
export const Field = ({ label, children, error }: { label: string; children: ReactNode; error?: string }) => (
  <div className="mb-4">
    <label className="block text-xs font-semibold text-gray-500 mb-1.5">{label}</label>
    {children}
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
)

// ─── INPUT ────────────────────────────────────────────────────────────────────
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => <input className="input-base" ref={ref} {...props} />
)

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => <textarea className="input-base min-h-[80px] resize-y" ref={ref} {...props} />
)

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }>(
  ({ children, ...props }, ref) => (
    <select ref={ref} className="input-base appearance-none" style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%234A5568' stroke-width='2' fill='none'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 12px center',
      backgroundColor: 'white',
    }} {...props}>{children}</select>
  )
)

// ─── SEARCH BAR ───────────────────────────────────────────────────────────────
export const SearchBar = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <div className="relative mb-4">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base pointer-events-none">🔍</span>
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? 'Search...'}
      className="input-base pl-9" />
  </div>
)

// ─── MODAL ────────────────────────────────────────────────────────────────────
export const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) => (
  <div className="fixed inset-0 z-[1000] flex items-end justify-center"
    style={{ background: 'rgba(15,32,65,0.6)' }}
    onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="modal-sheet bg-white rounded-t-[20px] w-full max-w-lg max-h-[90vh] overflow-auto px-5 pt-6 pb-10">
      <div className="flex justify-between items-center mb-5">
        <h3 className="font-heading text-xl font-bold" style={{ color: NAVY }}>{title}</h3>
        <button onClick={onClose} className="bg-gray-100 border-none rounded-lg w-8 h-8 cursor-pointer text-lg">×</button>
      </div>
      {children}
    </div>
  </div>
)

// ─── CONFIRM BOTTOM SHEET ─────────────────────────────────────────────────────
export const ConfirmSheet = ({ msg, onConfirm, onCancel, label = 'Delete' }: {
  msg: string; onConfirm: () => void; onCancel: () => void; label?: string
}) => (
  <div className="fixed inset-0 z-[1100] flex items-end" style={{ background: 'rgba(15,32,65,0.6)' }}>
    <div className="modal-sheet bg-white rounded-t-[20px] w-full max-w-lg mx-auto px-5 pt-7 pb-10">
      <p className="text-center text-base leading-relaxed mb-6" style={{ color: NAVY }}>{msg}</p>
      <div className="flex gap-3">
        <Btn variant="secondary" full onClick={onCancel}>Cancel</Btn>
        <Btn variant="danger" full onClick={onConfirm}>{label}</Btn>
      </div>
    </div>
  </div>
)

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
export const Empty = ({ icon, title, sub, cta, onCta }: {
  icon: string; title: string; sub: string; cta?: string; onCta?: () => void
}) => (
  <div className="text-center py-16 px-5">
    <div className="text-5xl mb-4">{icon}</div>
    <h3 className="font-heading text-xl mb-2" style={{ color: NAVY }}>{title}</h3>
    <p className="text-gray-500 text-sm mb-6">{sub}</p>
    {cta && <Btn onClick={onCta}>{cta}</Btn>}
  </div>
)

// ─── SKELETON LOADER ─────────────────────────────────────────────────────────
export const SkeletonCard = () => (
  <div className="card">
    <div className="skeleton h-4 w-2/3 mb-2" />
    <div className="skeleton h-3 w-1/3" />
  </div>
)

export const SkeletonList = ({ count = 4 }: { count?: number }) => (
  <>{Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}</>
)

// ─── FILTER PILLS ─────────────────────────────────────────────────────────────
export const FilterPills = ({ options, value, onChange }: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) => (
  <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
    {options.map(o => (
      <button key={o.value} onClick={() => onChange(o.value)}
        className="whitespace-nowrap px-3.5 py-1.5 rounded-full border-none cursor-pointer text-[13px] font-semibold transition-all"
        style={{
          background: value === o.value ? NAVY : '#F0F2F5',
          color: value === o.value ? '#fff' : '#4A5568',
          fontFamily: 'inherit',
        }}>
        {o.label}
      </button>
    ))}
  </div>
)
