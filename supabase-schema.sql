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
