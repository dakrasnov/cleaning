-- ============================================================
-- CleanShift — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── CUSTOMERS ───────────────────────────────────────────────────────────────
create table public.customers (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  phone            text not null,
  status           text not null default 'active' check (status in ('active', 'inactive')),
  address          text not null default '',
  google_maps_link text not null default '',
  price            numeric not null default 0,
  comment          text not null default '',
  created_at       timestamptz not null default now()
);

-- ─── EMPLOYEES ───────────────────────────────────────────────────────────────
create table public.employees (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  phone            text not null,
  email            text not null,
  hire_date        date,
  status           text not null default 'active' check (status in ('active', 'inactive', 'on_leave')),
  salary           numeric not null default 0,
  comment          text not null default '',
  telegram_chat_id text not null default '',
  password         text not null default '',
  created_at       timestamptz not null default now()
);

-- ─── SHIFTS ──────────────────────────────────────────────────────────────────
create table public.shifts (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  date        date not null,
  time_start  time not null,
  time_end    time not null,
  comment     text not null default '',
  status      text not null default 'open' check (status in ('open', 'confirmed', 'cancelled')),
  created_at  timestamptz not null default now()
);

-- ─── ASSIGNMENTS ─────────────────────────────────────────────────────────────
create table public.assignments (
  id           uuid primary key default gen_random_uuid(),
  shift_id     uuid not null references public.shifts(id) on delete cascade,
  employee_ids uuid[] not null default '{}',
  confirmed_by uuid references public.employees(id),
  confirmed_at timestamptz,
  created_at   timestamptz not null default now()
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
create index on public.shifts (date);
create index on public.shifts (customer_id);
create index on public.shifts (status);
create index on public.assignments (shift_id);

-- ─── ROW LEVEL SECURITY (RLS) ─────────────────────────────────────────────────
-- For development: allow all access via anon key.
-- In production, restrict to authenticated users only.

alter table public.customers   enable row level security;
alter table public.employees   enable row level security;
alter table public.shifts      enable row level security;
alter table public.assignments enable row level security;

-- Dev policy: allow all operations (replace with auth policies in production)
create policy "allow_all_customers"   on public.customers   for all using (true) with check (true);
create policy "allow_all_employees"   on public.employees   for all using (true) with check (true);
create policy "allow_all_shifts"      on public.shifts      for all using (true) with check (true);
create policy "allow_all_assignments" on public.assignments for all using (true) with check (true);

-- ─── MIGRATION: Employee Financial Accounting ────────────────────────────────
-- Run these statements in Supabase Dashboard → SQL Editor

-- 1. Add 'completed' to shifts status constraint
ALTER TABLE public.shifts
  DROP CONSTRAINT shifts_status_check;

ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_status_check
  CHECK (status IN ('open', 'confirmed', 'cancelled', 'completed'));

-- 2. Accruals table: one row per employee per completed shift
CREATE TABLE public.employee_accruals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  shift_id    uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  amount      numeric NOT NULL DEFAULT 0,
  note        text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, shift_id)
);

CREATE INDEX ON public.employee_accruals (employee_id);
CREATE INDEX ON public.employee_accruals (shift_id);

ALTER TABLE public.employee_accruals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_accruals" ON public.employee_accruals FOR ALL USING (true) WITH CHECK (true);

-- 3. Payments table: freeform cash/bank transfers to employees
CREATE TABLE public.employee_payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount      numeric NOT NULL,
  note        text NOT NULL DEFAULT '',
  paid_at     date NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.employee_payments (employee_id);

ALTER TABLE public.employee_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_payments" ON public.employee_payments FOR ALL USING (true) WITH CHECK (true);

-- ─── MIGRATION: Telegram Shift Completion Responses ──────────────────────────
-- Tracks per-employee responses to the completion prompt (done / wip)
-- Prevents re-notification and drives the shift→completed transition

CREATE TABLE public.shift_completion_responses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id     uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  employee_id  uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  response     text NOT NULL CHECK (response IN ('done', 'wip')),
  responded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_id, employee_id)
);

CREATE INDEX ON public.shift_completion_responses (shift_id);
CREATE INDEX ON public.shift_completion_responses (employee_id);

ALTER TABLE public.shift_completion_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_responses" ON public.shift_completion_responses FOR ALL USING (true) WITH CHECK (true);
