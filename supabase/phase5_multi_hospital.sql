-- WardFlow v2 — Phase 5: multi-hospital SaaS foundation
-- Run AFTER Phase 4 auth/RLS is working.
--
-- Goal:
--   - Treat each hospital as a tenant.
--   - Backfill the current demo data into one default hospital.
--   - Scope all authenticated reads/writes to the signed-in staff member's
--     hospital_id using Row Level Security.
--
-- This is a foundation migration. It keeps existing text ids for compatibility
-- with the prototype. A later production migration should move patient/staff
-- identifiers to generated UUIDs or hospital-scoped public codes.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Hospitals / tenants
-- ---------------------------------------------------------------------------

create table if not exists hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'paused')),
  plan text not null default 'prototype',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into hospitals (id, name, slug, status, plan, settings)
values (
  '00000000-0000-0000-0000-000000000001',
  'WardFlow Demo Hospital',
  'wardflow-demo',
  'active',
  'prototype',
  jsonb_build_object(
    'wardName', 'Medical Ward A',
    'timezone', 'Asia/Kolkata',
    'demoData', true
  )
)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  status = excluded.status,
  plan = excluded.plan,
  settings = hospitals.settings || excluded.settings;

-- ---------------------------------------------------------------------------
-- Tenant columns
-- ---------------------------------------------------------------------------

alter table staff add column if not exists hospital_id uuid references hospitals (id);
alter table patients add column if not exists hospital_id uuid references hospitals (id);
alter table alerts add column if not exists hospital_id uuid references hospitals (id);
alter table tasks add column if not exists hospital_id uuid references hospitals (id);
alter table medications add column if not exists hospital_id uuid references hospitals (id);
alter table notes add column if not exists hospital_id uuid references hospitals (id);
alter table timeline_events add column if not exists hospital_id uuid references hospitals (id);
alter table vital_readings add column if not exists hospital_id uuid references hospitals (id);
alter table audit_events add column if not exists hospital_id uuid references hospitals (id);

update staff set hospital_id = '00000000-0000-0000-0000-000000000001' where hospital_id is null;
update patients set hospital_id = '00000000-0000-0000-0000-000000000001' where hospital_id is null;
update alerts set hospital_id = '00000000-0000-0000-0000-000000000001' where hospital_id is null;
update tasks set hospital_id = '00000000-0000-0000-0000-000000000001' where hospital_id is null;
update medications set hospital_id = '00000000-0000-0000-0000-000000000001' where hospital_id is null;
update notes set hospital_id = '00000000-0000-0000-0000-000000000001' where hospital_id is null;
update timeline_events set hospital_id = '00000000-0000-0000-0000-000000000001' where hospital_id is null;
update vital_readings set hospital_id = '00000000-0000-0000-0000-000000000001' where hospital_id is null;
update audit_events set hospital_id = '00000000-0000-0000-0000-000000000001' where hospital_id is null;

alter table staff alter column hospital_id set not null;
alter table patients alter column hospital_id set not null;
alter table alerts alter column hospital_id set not null;
alter table tasks alter column hospital_id set not null;
alter table medications alter column hospital_id set not null;
alter table notes alter column hospital_id set not null;
alter table timeline_events alter column hospital_id set not null;
alter table vital_readings alter column hospital_id set not null;
alter table audit_events alter column hospital_id set not null;

create index if not exists idx_staff_hospital on staff (hospital_id);
create index if not exists idx_patients_hospital on patients (hospital_id);
create index if not exists idx_alerts_hospital on alerts (hospital_id);
create index if not exists idx_tasks_hospital on tasks (hospital_id);
create index if not exists idx_medications_hospital on medications (hospital_id);
create index if not exists idx_notes_hospital on notes (hospital_id);
create index if not exists idx_timeline_hospital on timeline_events (hospital_id);
create index if not exists idx_vitals_hospital on vital_readings (hospital_id);
create index if not exists idx_audit_hospital on audit_events (hospital_id);

create unique index if not exists idx_staff_hospital_id_unique on staff (hospital_id, id);
create unique index if not exists idx_patients_hospital_id_unique on patients (hospital_id, id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_hospital_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select hospital_id
  from public.staff
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_staff_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.staff
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff
    where auth_user_id = auth.uid()
      and hospital_id is not null
  );
$$;

create or replace function public.staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.staff
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_clinician()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('doctor', 'nurse', 'admin')
     from public.staff
     where auth_user_id = auth.uid()
     limit 1),
    false
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin'
     from public.staff
     where auth_user_id = auth.uid()
     limit 1),
    false
  );
$$;

create or replace function public.set_current_hospital_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.hospital_id is null then
    new.hospital_id := public.current_hospital_id();
  end if;
  return new;
end;
$$;

revoke all on function public.current_hospital_id() from public;
revoke all on function public.current_staff_id() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.staff_role() from public;
revoke all on function public.is_clinician() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.set_current_hospital_id() from public;

grant execute on function public.current_hospital_id() to authenticated;
grant execute on function public.current_staff_id() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.staff_role() to authenticated;
grant execute on function public.is_clinician() to authenticated;
grant execute on function public.is_admin() to authenticated;

alter table staff alter column hospital_id set default public.current_hospital_id();
alter table patients alter column hospital_id set default public.current_hospital_id();
alter table alerts alter column hospital_id set default public.current_hospital_id();
alter table tasks alter column hospital_id set default public.current_hospital_id();
alter table medications alter column hospital_id set default public.current_hospital_id();
alter table notes alter column hospital_id set default public.current_hospital_id();
alter table timeline_events alter column hospital_id set default public.current_hospital_id();
alter table vital_readings alter column hospital_id set default public.current_hospital_id();
alter table audit_events alter column hospital_id set default public.current_hospital_id();

drop trigger if exists staff_set_current_hospital_id on staff;
create trigger staff_set_current_hospital_id
  before insert on staff
  for each row execute function public.set_current_hospital_id();

drop trigger if exists patients_set_current_hospital_id on patients;
create trigger patients_set_current_hospital_id
  before insert on patients
  for each row execute function public.set_current_hospital_id();

drop trigger if exists alerts_set_current_hospital_id on alerts;
create trigger alerts_set_current_hospital_id
  before insert on alerts
  for each row execute function public.set_current_hospital_id();

drop trigger if exists tasks_set_current_hospital_id on tasks;
create trigger tasks_set_current_hospital_id
  before insert on tasks
  for each row execute function public.set_current_hospital_id();

drop trigger if exists medications_set_current_hospital_id on medications;
create trigger medications_set_current_hospital_id
  before insert on medications
  for each row execute function public.set_current_hospital_id();

drop trigger if exists notes_set_current_hospital_id on notes;
create trigger notes_set_current_hospital_id
  before insert on notes
  for each row execute function public.set_current_hospital_id();

drop trigger if exists timeline_set_current_hospital_id on timeline_events;
create trigger timeline_set_current_hospital_id
  before insert on timeline_events
  for each row execute function public.set_current_hospital_id();

drop trigger if exists vitals_set_current_hospital_id on vital_readings;
create trigger vitals_set_current_hospital_id
  before insert on vital_readings
  for each row execute function public.set_current_hospital_id();

drop trigger if exists audit_set_current_hospital_id on audit_events;
create trigger audit_set_current_hospital_id
  before insert on audit_events
  for each row execute function public.set_current_hospital_id();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table hospitals enable row level security;
alter table staff enable row level security;
alter table patients enable row level security;
alter table alerts enable row level security;
alter table tasks enable row level security;
alter table medications enable row level security;
alter table notes enable row level security;
alter table timeline_events enable row level security;
alter table vital_readings enable row level security;
alter table audit_events enable row level security;

-- Remove Phase 3/4 policies if this file is re-run.
drop policy if exists "demo_staff_all" on staff;
drop policy if exists "demo_patients_all" on patients;
drop policy if exists "demo_alerts_all" on alerts;
drop policy if exists "demo_tasks_all" on tasks;
drop policy if exists "demo_medications_all" on medications;
drop policy if exists "demo_notes_all" on notes;
drop policy if exists "demo_timeline_all" on timeline_events;
drop policy if exists "demo_vitals_all" on vital_readings;
drop policy if exists "demo_audit_all" on audit_events;

drop policy if exists "hospital_select_own" on hospitals;
drop policy if exists "hospital_update_admin" on hospitals;
drop policy if exists "staff_select_authenticated" on staff;
drop policy if exists "staff_update_admin" on staff;
drop policy if exists "staff_insert_admin" on staff;
drop policy if exists "staff_update_own" on staff;
drop policy if exists "patients_select_staff" on patients;
drop policy if exists "patients_insert_clinician" on patients;
drop policy if exists "patients_update_clinician" on patients;
drop policy if exists "patients_delete_admin" on patients;
drop policy if exists "alerts_select_staff" on alerts;
drop policy if exists "alerts_write_clinician" on alerts;
drop policy if exists "alerts_update_clinician" on alerts;
drop policy if exists "alerts_delete_admin" on alerts;
drop policy if exists "tasks_select_staff" on tasks;
drop policy if exists "tasks_write_clinician" on tasks;
drop policy if exists "tasks_update_clinician" on tasks;
drop policy if exists "tasks_delete_admin" on tasks;
drop policy if exists "medications_select_staff" on medications;
drop policy if exists "medications_write_clinician" on medications;
drop policy if exists "medications_update_clinician" on medications;
drop policy if exists "medications_delete_admin" on medications;
drop policy if exists "notes_select_staff" on notes;
drop policy if exists "notes_write_clinician" on notes;
drop policy if exists "notes_update_clinician" on notes;
drop policy if exists "notes_delete_admin" on notes;
drop policy if exists "timeline_select_staff" on timeline_events;
drop policy if exists "timeline_write_clinician" on timeline_events;
drop policy if exists "timeline_delete_admin" on timeline_events;
drop policy if exists "vitals_select_staff" on vital_readings;
drop policy if exists "vitals_write_clinician" on vital_readings;
drop policy if exists "vitals_delete_admin" on vital_readings;
drop policy if exists "audit_select_staff" on audit_events;
drop policy if exists "audit_insert_clinician" on audit_events;
drop policy if exists "audit_delete_admin" on audit_events;

create policy "hospital_select_own" on hospitals
  for select to authenticated
  using (id = public.current_hospital_id());

create policy "hospital_update_admin" on hospitals
  for update to authenticated
  using (id = public.current_hospital_id() and public.is_admin())
  with check (id = public.current_hospital_id() and public.is_admin());

create policy "staff_select_authenticated" on staff
  for select to authenticated
  using (hospital_id = public.current_hospital_id());

create policy "staff_insert_admin" on staff
  for insert to authenticated
  with check (hospital_id = public.current_hospital_id() and public.is_admin());

create policy "staff_update_admin" on staff
  for update to authenticated
  using (hospital_id = public.current_hospital_id() and public.is_admin())
  with check (hospital_id = public.current_hospital_id() and public.is_admin());

create policy "staff_update_own" on staff
  for update to authenticated
  using (hospital_id = public.current_hospital_id() and auth_user_id = auth.uid())
  with check (hospital_id = public.current_hospital_id() and auth_user_id = auth.uid());

create policy "patients_select_staff" on patients
  for select to authenticated
  using (hospital_id = public.current_hospital_id());

create policy "patients_insert_clinician" on patients
  for insert to authenticated
  with check (hospital_id = public.current_hospital_id() and public.is_clinician());

create policy "patients_update_clinician" on patients
  for update to authenticated
  using (hospital_id = public.current_hospital_id() and public.is_clinician())
  with check (hospital_id = public.current_hospital_id() and public.is_clinician());

create policy "patients_delete_admin" on patients
  for delete to authenticated
  using (hospital_id = public.current_hospital_id() and public.is_admin());

create policy "alerts_select_staff" on alerts
  for select to authenticated
  using (hospital_id = public.current_hospital_id());

create policy "alerts_write_clinician" on alerts
  for insert to authenticated
  with check (hospital_id = public.current_hospital_id() and public.is_clinician());

create policy "alerts_update_clinician" on alerts
  for update to authenticated
  using (hospital_id = public.current_hospital_id() and public.is_clinician())
  with check (hospital_id = public.current_hospital_id() and public.is_clinician());

create policy "alerts_delete_admin" on alerts
  for delete to authenticated
  using (hospital_id = public.current_hospital_id() and public.is_admin());

create policy "tasks_select_staff" on tasks
  for select to authenticated
  using (hospital_id = public.current_hospital_id());

create policy "tasks_write_clinician" on tasks
  for insert to authenticated
  with check (hospital_id = public.current_hospital_id() and public.is_clinician());

create policy "tasks_update_clinician" on tasks
  for update to authenticated
  using (hospital_id = public.current_hospital_id() and public.is_clinician())
  with check (hospital_id = public.current_hospital_id() and public.is_clinician());

create policy "tasks_delete_admin" on tasks
  for delete to authenticated
  using (hospital_id = public.current_hospital_id() and public.is_admin());

create policy "medications_select_staff" on medications
  for select to authenticated
  using (hospital_id = public.current_hospital_id());

create policy "medications_write_clinician" on medications
  for insert to authenticated
  with check (hospital_id = public.current_hospital_id() and public.is_clinician());

create policy "medications_update_clinician" on medications
  for update to authenticated
  using (hospital_id = public.current_hospital_id() and public.is_clinician())
  with check (hospital_id = public.current_hospital_id() and public.is_clinician());

create policy "medications_delete_admin" on medications
  for delete to authenticated
  using (hospital_id = public.current_hospital_id() and public.is_admin());

create policy "notes_select_staff" on notes
  for select to authenticated
  using (hospital_id = public.current_hospital_id());

create policy "notes_write_clinician" on notes
  for insert to authenticated
  with check (hospital_id = public.current_hospital_id() and public.is_clinician());

create policy "notes_update_clinician" on notes
  for update to authenticated
  using (hospital_id = public.current_hospital_id() and public.is_clinician())
  with check (hospital_id = public.current_hospital_id() and public.is_clinician());

create policy "notes_delete_admin" on notes
  for delete to authenticated
  using (hospital_id = public.current_hospital_id() and public.is_admin());

create policy "timeline_select_staff" on timeline_events
  for select to authenticated
  using (hospital_id = public.current_hospital_id());

create policy "timeline_write_clinician" on timeline_events
  for insert to authenticated
  with check (hospital_id = public.current_hospital_id() and public.is_clinician());

create policy "timeline_delete_admin" on timeline_events
  for delete to authenticated
  using (hospital_id = public.current_hospital_id() and public.is_admin());

create policy "vitals_select_staff" on vital_readings
  for select to authenticated
  using (hospital_id = public.current_hospital_id());

create policy "vitals_write_clinician" on vital_readings
  for insert to authenticated
  with check (hospital_id = public.current_hospital_id() and public.is_clinician());

create policy "vitals_delete_admin" on vital_readings
  for delete to authenticated
  using (hospital_id = public.current_hospital_id() and public.is_admin());

create policy "audit_select_staff" on audit_events
  for select to authenticated
  using (hospital_id = public.current_hospital_id());

create policy "audit_insert_clinician" on audit_events
  for insert to authenticated
  with check (hospital_id = public.current_hospital_id() and public.is_clinician());

create policy "audit_delete_admin" on audit_events
  for delete to authenticated
  using (hospital_id = public.current_hospital_id() and public.is_admin());
