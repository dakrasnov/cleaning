# Achla Bayit — Project Overview for Claude

## What This Is

A mobile-first PWA for managing a home-cleaning business. Admins schedule shifts, assign employees, and send Telegram notifications. Employees see their own upcoming and available shifts.

Originally scaffolded as "CleanShift"; renamed to **Achla Bayit** in the UI (index.html title, App.tsx header). Note: `EmployeeDashboard.tsx` still has the old "CleanShift" string hardcoded in its internal header — has not been renamed yet.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18.2 + TypeScript 5 |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 |
| Routing | react-router-dom v6 |
| State | Zustand 4 |
| Forms | react-hook-form v7 + zod + @hookform/resolvers |
| Backend | Supabase (Postgres + Auth) |
| Date utils | date-fns 3 |
| Notifications | react-hot-toast |
| Telegram | Telegram Bot API (direct fetch) |

---

## Environment Variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_TELEGRAM_BOT_TOKEN=
```

---

## Supabase Database Schema

### Tables

**`profiles`** — linked to Supabase auth users
- `id` (uuid, FK → auth.users)
- `employee_id` (uuid, nullable FK → employees)
- `role` ('admin' | 'employee')
- `created_at`

**`customers`**
- `id`, `name`, `phone`, `status` ('active'|'inactive'), `address`, `google_maps_link`, `price` (number), `comment`, `created_at`

**`employees`**
- `id`, `name`, `phone`, `email`, `hire_date` (date, nullable), `status` ('active'|'inactive'|'on_leave'), `salary`, `comment`, `telegram_chat_id`, `created_at`
- Note: no `password` column — the TypeScript type previously had one but it does not exist in the DB

**`shifts`**
- `id`, `customer_id` (FK), `date` (YYYY-MM-DD), `time_start` (HH:MM), `time_end` (HH:MM), `comment`, `status` ('open'|'confirmed'|'cancelled'), `created_at`

**`assignments`**
- `id`, `shift_id` (FK), `employee_ids` (uuid[]), `confirmed_by` (uuid, nullable), `confirmed_at` (nullable), `created_at`

---

## Project Structure

```
src/
├── App.tsx                  # Root: auth gate, AdminLayout with nav, route definitions
├── components/
│   ├── ui.tsx               # ALL shared UI components (single file)
│   └── TelegramModal.tsx    # Post-shift-creation notification picker
├── lib/
│   ├── supabase.ts          # Supabase client
│   ├── telegram.ts          # buildShiftMessage(), sendTelegramMessage(), testBotConnection()
│   ├── utils.ts             # fmtDate(), fmtDateShort(), fmtTime(), todayStr(), weekEndStr(), uid()
│   └── adminUsers.ts
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx        # Admin home: stats + next 7 days
│   ├── EmployeeDashboard.tsx # Employee view: their shifts + open shifts
│   ├── Customers.tsx        # List + modal create/edit; exports nothing
│   ├── CustomerDetail.tsx   # Detail view (read-only)
│   ├── Employees.tsx        # List + modal create; exports EmployeeForm
│   ├── EmployeeDetail.tsx   # Detail + edit/delete; imports EmployeeForm
│   ├── Shifts.tsx           # List + modal create; exports ShiftForm
│   ├── ShiftDetail.tsx      # Detail + edit/delete/assign; imports ShiftForm
│   ├── Assignments.tsx      # List + create/edit modal
│   └── Users.tsx
├── store/
│   ├── auth.ts              # Supabase auth + profile, role detection
│   ├── customers.ts
│   ├── employees.ts
│   ├── shifts.ts
│   └── assignments.ts
└── types/
    └── index.ts             # Customer, Employee, Shift, Assignment, ShiftWithCustomer, AssignmentWithDetails
```

---

## UI Component Library (`src/components/ui.tsx`)

Single file, all components exported from it. Key ones:

- **`Input`** — `React.forwardRef` wrapper (required for react-hook-form)
- **`Textarea`** — same, forwardRef
- **`Select`** — same, forwardRef
- **`Field`** — label + children + optional error string
- **`Btn`** — variants: `primary` (default), `secondary`, `danger`, `navy`; props: `small`, `full`, `disabled`
- **`Card`** — white rounded card with optional `onClick`
- **`Modal`** — full-screen overlay with title and close button
- **`Badge`** — colored status chip (reads from `statusColors` map)
- **`PageHeader`** — title + optional right-side action
- **`FilterPills`** — horizontal pill tab bar
- **`SearchBar`** — icon + input, calls `onChange(string)`
- **`Empty`** — empty state with icon, title, subtitle, optional CTA button
- **`SkeletonList`** — loading placeholder rows
- **`BackBtn`**, **`ConfirmSheet`**

> **Important**: `Input`, `Select`, `Textarea` use `React.forwardRef`. This is required for react-hook-form's `register()` to work in React 18. Do not remove forwardRef.

---

## Auth & Roles

Two roles exist in `profiles.role`:

- **`admin`** → sees `AdminLayout` with full nav (Home, Clients, Team, Shifts, Tasks, Users)
- **`employee`** → sees `EmployeeDashboard` (their shifts + available open shifts, no nav)

Auth flow in `App.tsx`:
1. `initialize()` called on mount → checks existing Supabase session
2. `onAuthStateChange` listener keeps state in sync
3. If no user → `<LoginPage />`
4. If no profile → loading screen (profile fetch in progress)
5. Role check → render appropriate layout

---

## Forms Pattern

**Admin forms** (Employees, Shifts) use **react-hook-form + zod**:
```tsx
const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
  resolver: zodResolver(schema),
  mode: 'onSubmit',
  defaultValues: { ... },
})
```
Spread `{...register('fieldName')}` directly onto `<Input>`, `<Select>`, `<Textarea>` — refs work because those components use `forwardRef`.

**Customer form** uses plain `useState` (no library) — simpler, controlled inputs.

---

## Shift Form — Time Fields

The shift form does **not** use `<input type="time">`. Instead:

- **Start time**: `<Select>` with 48 options (00:00–23:30, 30-min steps)
- **Duration**: `<Select>` with 24 options (0:30–12:00, 30-min steps), managed with `useState`
- **End time**: calculated via `useEffect` → `setValue('time_end', addMins(timeStart, duration))`; displayed as read-only text, not an input
- `time_end` stays in the zod schema (it's saved to DB), just not shown as an editable field

---

## Telegram Integration

### `src/lib/telegram.ts`

`buildShiftMessage(payload)` produces a personalized Russian-language message:
```
🧹 {name}, Вы назначены на смену!
🗓️ Дата: 2026-02-23, Monday
⏰ Время: 16:00 – 18:00, 2 hrs
    Клиент: {customerName}
📍 Адрес: {address}
💰 Ставка: {price}
📝 Комментарий: {comment}   ← only included if non-empty
```
- Times are 24h format (raw `HH:MM` from DB, not converted)
- No `$` sign on price
- Comment line omitted entirely when empty

`sendTelegramMessage(chatId, text)` — POST to Bot API with `parse_mode: 'HTML'`

### Where Telegram Is Triggered

1. **After shift creation** (`Shifts.tsx`) → `TelegramModal` appears, admin manually selects employees to notify
2. **After assignment create/edit** (`Assignments.tsx`) → auto-sends to all assigned employees who have a `telegram_chat_id`, no modal

Each employee receives their own personalized message (name in the greeting).

---

## Assignment Logic

- Creating an assignment → sets shift status to `'confirmed'`
- Editing an assignment with a different shift → old shift → `'open'`, new shift → `'confirmed'`
- Editing an assignment with zero employees selected → **deletes** the assignment, shift → `'open'`
- Max 3 employees per assignment (enforced in UI)

---

## Key Conventions

- Colors defined as module-level constants: `NAVY = '#0F2041'`, `MINT = '#00C9A7'`
- All stores follow the same pattern: `{ data[], loading, error, fetch, create, update, remove }`
- `hire_date` is stored as `null` in DB when not provided (empty string converted to null in store)
- `fmtDate(d)` and `fmtDateShort(d)` accept `string | null | undefined` and return `'—'` for falsy values
- `fmtTime(t)` converts `HH:MM` to 12h AM/PM — used in UI display; Telegram messages use raw `HH:MM` directly
- App is mobile-first, max-width 480px, sticky header, fixed bottom nav

---

## Known Issues / TODOs

- `EmployeeDashboard.tsx` still has `"🧹 CleanShift"` hardcoded in its header (not updated when app was renamed)
- Employee Dashboard shows `$` before price — not localized
- No delete confirmation for assignments (only for shifts and employees)
- `fmtTime` still uses 12h format in the main UI (Dashboard, ShiftDetail card) — Telegram uses 24h
