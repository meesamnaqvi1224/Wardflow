-- WardFlow v2 — Phase 4: real authentication + RLS
-- Run in the Supabase SQL editor AFTER demo users are created and linked
-- (see scripts/setup-demo-auth.mjs and README).
--
-- Replaces open demo policies with authenticated staff-only access.
-- Role rules:
--   - All linked staff: SELECT ward data
--   - doctor / nurse / admin: INSERT/UPDATE clinical data
--   - admin: DELETE (demo reset) + staff maintenance

-- ---------------------------------------------------------------------------
-- Helpers (security definer so RLS on staff does not recurse)
-- ---------------------------------------------------------------------------

create or replace function public.current_staff_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from public.staff where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff where auth_user_id = auth.uid()
  );
$$;

create or replace function public.staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.staff where auth_user_id = auth.uid() limit 1;
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
     from public.staff where auth_user_id = auth.uid() limit 1),
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
     from public.staff where auth_user_id = auth.uid() limit 1),
    false
  );
$$;

revoke all on function public.current_staff_id() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.staff_role() from public;
revoke all on function public.is_clinician() from public;
revoke all on function public.is_admin() from public;

grant execute on function public.current_staff_id() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.staff_role() to authenticated;
grant execute on function public.is_clinician() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Drop Phase 3 open demo policies
-- ---------------------------------------------------------------------------

drop policy if exists "demo_staff_all" on staff;
drop policy if exists "demo_patients_all" on patients;
drop policy if exists "demo_alerts_all" on alerts;
drop policy if exists "demo_tasks_all" on tasks;
drop policy if exists "demo_medications_all" on medications;
drop policy if exists "demo_notes_all" on notes;
drop policy if exists "demo_timeline_all" on timeline_events;
drop policy if exists "demo_vitals_all" on vital_readings;
drop policy if exists "demo_audit_all" on audit_events;

-- Also drop Phase 4 policies if re-running this file
drop policy if exists "staff_select_authenticated" on staff;
drop policy if exists "staff_update_admin" on staff;
drop policy if exists "staff_insert_admin" on staff;
drop policy if exists "patients_select_staff" on patients;
drop policy if exists "patients_write_clinician" on patients;
drop policy if exists "patients_insert_clinician" on patients;
drop policy if exists "patients_update_clinician" on patients;
drop policy if exists "patients_delete_admin" on patients;
drop policy if exists "alerts_update_clinician" on alerts;
drop policy if exists "tasks_update_clinician" on tasks;
drop policy if exists "medications_update_clinician" on medications;
drop policy if exists "notes_update_clinician" on notes;
drop policy if exists "alerts_select_staff" on alerts;
drop policy if exists "alerts_write_clinician" on alerts;
drop policy if exists "alerts_delete_admin" on alerts;
drop policy if exists "tasks_select_staff" on tasks;
drop policy if exists "tasks_write_clinician" on tasks;
drop policy if exists "tasks_delete_admin" on tasks;
drop policy if exists "medications_select_staff" on medications;
drop policy if exists "medications_write_clinician" on medications;
drop policy if exists "medications_delete_admin" on medications;
drop policy if exists "notes_select_staff" on notes;
drop policy if exists "notes_write_clinician" on notes;
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

-- ---------------------------------------------------------------------------
-- staff
-- ---------------------------------------------------------------------------

create policy "staff_select_authenticated" on staff
  for select to authenticated
  using (public.is_staff());

create policy "staff_update_admin" on staff
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "staff_insert_admin" on staff
  for insert to authenticated
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- patients
-- ---------------------------------------------------------------------------

create policy "patients_select_staff" on patients
  for select to authenticated
  using (public.is_staff());

create policy "patients_insert_clinician" on patients
  for insert to authenticated
  with check (public.is_clinician());

create policy "patients_update_clinician" on patients
  for update to authenticated
  using (public.is_clinician())
  with check (public.is_clinician());

create policy "patients_delete_admin" on patients
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- alerts
-- ---------------------------------------------------------------------------

create policy "alerts_select_staff" on alerts
  for select to authenticated
  using (public.is_staff());

create policy "alerts_write_clinician" on alerts
  for insert to authenticated
  with check (public.is_clinician());

create policy "alerts_update_clinician" on alerts
  for update to authenticated
  using (public.is_clinician())
  with check (public.is_clinician());

create policy "alerts_delete_admin" on alerts
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

create policy "tasks_select_staff" on tasks
  for select to authenticated
  using (public.is_staff());

create policy "tasks_write_clinician" on tasks
  for insert to authenticated
  with check (public.is_clinician());

create policy "tasks_update_clinician" on tasks
  for update to authenticated
  using (public.is_clinician())
  with check (public.is_clinician());

create policy "tasks_delete_admin" on tasks
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- medications
-- ---------------------------------------------------------------------------

create policy "medications_select_staff" on medications
  for select to authenticated
  using (public.is_staff());

create policy "medications_write_clinician" on medications
  for insert to authenticated
  with check (public.is_clinician());

create policy "medications_update_clinician" on medications
  for update to authenticated
  using (public.is_clinician())
  with check (public.is_clinician());

create policy "medications_delete_admin" on medications
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------------

create policy "notes_select_staff" on notes
  for select to authenticated
  using (public.is_staff());

create policy "notes_write_clinician" on notes
  for insert to authenticated
  with check (public.is_clinician());

create policy "notes_update_clinician" on notes
  for update to authenticated
  using (public.is_clinician())
  with check (public.is_clinician());

create policy "notes_delete_admin" on notes
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- timeline_events
-- ---------------------------------------------------------------------------

create policy "timeline_select_staff" on timeline_events
  for select to authenticated
  using (public.is_staff());

create policy "timeline_write_clinician" on timeline_events
  for insert to authenticated
  with check (public.is_clinician());

create policy "timeline_delete_admin" on timeline_events
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- vital_readings
-- ---------------------------------------------------------------------------

create policy "vitals_select_staff" on vital_readings
  for select to authenticated
  using (public.is_staff());

create policy "vitals_write_clinician" on vital_readings
  for insert to authenticated
  with check (public.is_clinician());

create policy "vitals_delete_admin" on vital_readings
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- audit_events
-- ---------------------------------------------------------------------------

create policy "audit_select_staff" on audit_events
  for select to authenticated
  using (public.is_staff());

create policy "audit_insert_clinician" on audit_events
  for insert to authenticated
  with check (public.is_clinician());

create policy "audit_delete_admin" on audit_events
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Ensure RLS remains on
-- ---------------------------------------------------------------------------

alter table staff enable row level security;
alter table patients enable row level security;
alter table alerts enable row level security;
alter table tasks enable row level security;
alter table medications enable row level security;
alter table notes enable row level security;
alter table timeline_events enable row level security;
alter table vital_readings enable row level security;
alter table audit_events enable row level security;
