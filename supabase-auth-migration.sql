-- ============================================================
-- CleanShift — Auth Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Run AFTER the initial supabase-schema.sql
-- ============================================================

-- ─── PROFILES ────────────────────────────────────────────────────────────────
-- Links Supabase Auth users to employees + stores role
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  role        text not null default 'employee' check (role in ('admin', 'employee')),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile; admins can read all
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_select_admin"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "profiles_update_admin"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ─── HELPER FUNCTION: get current user role ───────────────────────────────
create or replace function public.get_my_role()
returns text
language sql
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ─── UPDATE RLS ON EXISTING TABLES ───────────────────────────────────────────
-- Drop the dev "allow all" policies and replace with role-based ones

-- CUSTOMERS: admins full access, employees read-only
drop policy if exists "allow_all_customers" on public.customers;
create policy "customers_admin_all"
  on public.customers for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create policy "customers_employee_select"
  on public.customers for select
  using (public.get_my_role() = 'employee');

-- EMPLOYEES: admins full access, employees can read their own row
drop policy if exists "allow_all_employees" on public.employees;
create policy "employees_admin_all"
  on public.employees for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create policy "employees_select_own"
  on public.employees for select
  using (
    id = (
      select employee_id from public.profiles where id = auth.uid()
    )
  );

-- SHIFTS: admins full access, employees read-only
drop policy if exists "allow_all_shifts" on public.shifts;
create policy "shifts_admin_all"
  on public.shifts for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create policy "shifts_employee_select"
  on public.shifts for select
  using (public.get_my_role() = 'employee');

-- ASSIGNMENTS: admins full access, employees read own
drop policy if exists "allow_all_assignments" on public.assignments;
create policy "assignments_admin_all"
  on public.assignments for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create policy "assignments_employee_select_own"
  on public.assignments for select
  using (
    public.get_my_role() = 'employee'
    and (
      select employee_id from public.profiles where id = auth.uid()
    ) = any(employee_ids)
  );

-- ─── REMOVE password COLUMN FROM EMPLOYEES ──────────────────────────────────
-- Passwords are now owned by Supabase Auth, not by your app
alter table public.employees drop column if exists password;

-- ─── AUTO-CREATE PROFILE ON SIGNUP ──────────────────────────────────────────
-- When admin creates a user via Supabase Auth, auto-insert a profile row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'employee')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
