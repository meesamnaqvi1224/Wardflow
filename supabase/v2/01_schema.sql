-- WardFlow v2 multi-hospital schema — step 1 of 3 (schema + read-only RLS)
--
-- FOR A FRESH SUPABASE PROJECT OR BRANCH ONLY. It does not migrate the older
-- schema.sql / phase4 / phase5 files; it replaces them. Do not run it against
-- a database that holds data you want to keep.
--
-- Model
--   * Shared database, one row set per hospital (tenant). Every tenant table
--     has hospital_id, and RLS limits every read to the caller's hospital.
--   * All primary keys are UUIDs, so two hospitals can never collide.
--   * Composite (hospital_id, x_id) foreign keys make it impossible for a row
--     to reference another hospital's patient, staff member or ward.
--   * Clients get SELECT only. There are deliberately NO insert/update/delete
--     policies: every write goes through security-definer functions added in
--     02_onboarding.sql (signup, invites) and 03_workflows.sql (clinical
--     actions), which enforce roles and business rules in one place. Until
--     those files are applied the app can read but not write.
--   * One auth user belongs to at most one staff row (one hospital). A person
--     who works at two hospitals needs two accounts.
--
-- Not yet covered: onboarding functions, clinical workflow functions, seed
-- data, and cross-hospital isolation tests (files 02, 03, 04).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type staff_role as enum ('admin', 'doctor', 'nurse');
create type patient_status as enum ('urgent', 'warning', 'stable');
create type alert_severity as enum ('urgent', 'warning');
create type alert_status as enum ('active', 'acknowledged', 'resolved');
create type task_priority as enum ('urgent', 'important', 'routine');
create type task_status as enum ('open', 'completed');
create type medication_status as enum ('due', 'upcoming', 'administered');
create type timeline_type as enum (
  'urgent', 'warning', 'task', 'alert', 'medication', 'note', 'vitals'
);

-- ---------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------

create table hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  status text not null default 'active' check (status in ('active', 'paused')),
  plan text not null default 'trial',
  -- Per-hospital configuration, e.g. alert thresholds and branding. Written
  -- only by server-side functions; see 02_onboarding.sql for the defaults.
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table wards (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (hospital_id, id),
  unique (hospital_id, name)
);

create table staff (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals (id) on delete cascade,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  name text not null check (length(btrim(name)) > 0),
  role staff_role not null,
  detail text not null default '',
  initials text not null check (length(initials) between 1 and 3),
  -- Deactivated staff keep their history but lose all access.
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (hospital_id, id)
);

-- Pending staff invitations. The invitee signs up and verifies their email,
-- then claim_invite() links their auth user to a new staff row. Matching is on
-- the verified email, so email confirmation MUST be enabled in Supabase Auth.
create table hospital_invites (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '%@%'),
  name text not null,
  role staff_role not null,
  detail text not null default '',
  initials text not null check (length(initials) between 1 and 3),
  invited_by uuid,
  status text not null default 'pending'
    check (status in ('pending', 'claimed', 'revoked')),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  foreign key (hospital_id, invited_by) references staff (hospital_id, id)
);

-- An email can have only one open invitation at a time, across all hospitals,
-- so claim_invite() is never ambiguous.
create unique index idx_invites_pending_email
  on hospital_invites (email) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Ward data
-- ---------------------------------------------------------------------------

create table patients (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals (id) on delete cascade,
  ward_id uuid,
  name text not null check (length(btrim(name)) > 0),
  age int not null check (age > 0 and age < 150),
  room text not null,
  diagnosis text not null,
  allergy text not null default 'None recorded',
  status patient_status not null default 'stable',
  doctor_id uuid,
  nurse_id uuid,
  admitted_on date not null default current_date,
  oxygen int check (oxygen between 0 and 100),
  heart_rate int check (heart_rate between 0 and 300),
  bp text,
  temperature numeric(4, 1) check (temperature between 25 and 45),
  respiratory int check (respiratory between 0 and 100),
  updated_at timestamptz not null default now(),
  unique (hospital_id, id),
  foreign key (hospital_id, ward_id) references wards (hospital_id, id),
  foreign key (hospital_id, doctor_id) references staff (hospital_id, id),
  foreign key (hospital_id, nurse_id) references staff (hospital_id, id)
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals (id) on delete cascade,
  patient_id uuid not null,
  severity alert_severity not null,
  message text not null,
  status alert_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (hospital_id, patient_id) references patients (hospital_id, id)
    on delete cascade
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals (id) on delete cascade,
  patient_id uuid not null,
  title text not null check (length(btrim(title)) > 0),
  due_label text not null,
  priority task_priority not null default 'routine',
  status task_status not null default 'open',
  created_at timestamptz not null default now(),
  foreign key (hospital_id, patient_id) references patients (hospital_id, id)
    on delete cascade
);

create table medications (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals (id) on delete cascade,
  patient_id uuid not null,
  name text not null check (length(btrim(name)) > 0),
  dose text not null check (length(btrim(dose)) > 0),
  due_label text not null,
  status medication_status not null default 'due',
  ordered_by uuid,
  created_at timestamptz not null default now(),
  foreign key (hospital_id, patient_id) references patients (hospital_id, id)
    on delete cascade,
  foreign key (hospital_id, ordered_by) references staff (hospital_id, id)
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals (id) on delete cascade,
  patient_id uuid not null,
  author_id uuid,
  author_name text not null,
  note_type text not null,
  content text not null check (length(btrim(content)) > 0),
  created_at timestamptz not null default now(),
  foreign key (hospital_id, patient_id) references patients (hospital_id, id)
    on delete cascade,
  foreign key (hospital_id, author_id) references staff (hospital_id, id)
);

create table timeline_events (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals (id) on delete cascade,
  patient_id uuid not null,
  summary text not null,
  event_type timeline_type not null,
  created_at timestamptz not null default now(),
  foreign key (hospital_id, patient_id) references patients (hospital_id, id)
    on delete cascade
);

create table vital_readings (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals (id) on delete cascade,
  patient_id uuid not null,
  recorded_by uuid,
  oxygen int not null check (oxygen between 0 and 100),
  heart_rate int not null check (heart_rate between 0 and 300),
  bp text not null,
  temperature numeric(4, 1) not null check (temperature between 25 and 45),
  respiratory int not null check (respiratory between 0 and 100),
  note text,
  created_at timestamptz not null default now(),
  foreign key (hospital_id, patient_id) references patients (hospital_id, id)
    on delete cascade,
  foreign key (hospital_id, recorded_by) references staff (hospital_id, id)
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals (id) on delete cascade,
  actor_id uuid,
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  patient_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (hospital_id, actor_id) references staff (hospital_id, id),
  foreign key (hospital_id, patient_id) references patients (hospital_id, id)
);

-- ---------------------------------------------------------------------------
-- Indexes (every tenant filter and patient lookup)
-- ---------------------------------------------------------------------------

create index idx_wards_hospital on wards (hospital_id);
create index idx_staff_hospital on staff (hospital_id);
create index idx_invites_hospital on hospital_invites (hospital_id);
create index idx_patients_hospital on patients (hospital_id);
create index idx_patients_doctor on patients (hospital_id, doctor_id);
create index idx_patients_nurse on patients (hospital_id, nurse_id);
create index idx_alerts_patient on alerts (hospital_id, patient_id);
create index idx_alerts_status on alerts (hospital_id, status);
create index idx_tasks_patient on tasks (hospital_id, patient_id);
create index idx_meds_patient on medications (hospital_id, patient_id);
create index idx_notes_patient on notes (hospital_id, patient_id);
create index idx_timeline_patient on timeline_events (hospital_id, patient_id, created_at desc);
create index idx_vitals_patient on vital_readings (hospital_id, patient_id, created_at desc);
create index idx_audit_hospital on audit_events (hospital_id, created_at desc);

-- Cover the remaining composite foreign keys (found by the Supabase advisor);
-- without these, deleting/updating a referenced staff, patient or ward row has
-- to scan the referencing table.
create index idx_audit_actor on audit_events (hospital_id, actor_id);
create index idx_audit_patient on audit_events (hospital_id, patient_id);
create index idx_invites_invited_by on hospital_invites (hospital_id, invited_by);
create index idx_hospitals_created_by on hospitals (created_by);
create index idx_meds_ordered_by on medications (hospital_id, ordered_by);
create index idx_notes_author on notes (hospital_id, author_id);
create index idx_patients_ward on patients (hospital_id, ward_id);
create index idx_vitals_recorded_by on vital_readings (hospital_id, recorded_by);

-- ---------------------------------------------------------------------------
-- Caller helpers
-- ---------------------------------------------------------------------------
-- security definer so they can read staff without recursing through staff's
-- own RLS. They only ever look up the caller's own row (auth.uid()), and they
-- return null / false for an inactive staff member, which cuts off all access.

create function public.current_hospital_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select hospital_id from public.staff
  where auth_user_id = auth.uid() and active
  limit 1;
$$;

create function public.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.staff
  where auth_user_id = auth.uid() and active
  limit 1;
$$;

create function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.staff
  where auth_user_id = auth.uid() and active
  limit 1;
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.staff
     where auth_user_id = auth.uid() and active
     limit 1),
    false
  );
$$;

-- Functions are executable by PUBLIC by default; lock them to signed-in users.
revoke all on function public.current_hospital_id() from public, anon;
revoke all on function public.current_staff_id() from public, anon;
revoke all on function public.current_staff_role() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.current_hospital_id() to authenticated;
grant execute on function public.current_staff_id() to authenticated;
grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: read-only for clients
-- ---------------------------------------------------------------------------
-- (select public.current_hospital_id()) is evaluated once per statement rather
-- than once per row.

alter table hospitals enable row level security;
alter table wards enable row level security;
alter table staff enable row level security;
alter table hospital_invites enable row level security;
alter table patients enable row level security;
alter table alerts enable row level security;
alter table tasks enable row level security;
alter table medications enable row level security;
alter table notes enable row level security;
alter table timeline_events enable row level security;
alter table vital_readings enable row level security;
alter table audit_events enable row level security;

create policy hospitals_select on hospitals
  for select to authenticated
  using (id = (select public.current_hospital_id()));

create policy wards_select on wards
  for select to authenticated
  using (hospital_id = (select public.current_hospital_id()));

create policy staff_select on staff
  for select to authenticated
  using (hospital_id = (select public.current_hospital_id()));

-- Invites and the audit log are admin-only.
create policy invites_select on hospital_invites
  for select to authenticated
  using (hospital_id = (select public.current_hospital_id())
         and (select public.is_admin()));

create policy audit_select on audit_events
  for select to authenticated
  using (hospital_id = (select public.current_hospital_id())
         and (select public.is_admin()));

create policy patients_select on patients
  for select to authenticated
  using (hospital_id = (select public.current_hospital_id()));

create policy alerts_select on alerts
  for select to authenticated
  using (hospital_id = (select public.current_hospital_id()));

create policy tasks_select on tasks
  for select to authenticated
  using (hospital_id = (select public.current_hospital_id()));

create policy medications_select on medications
  for select to authenticated
  using (hospital_id = (select public.current_hospital_id()));

create policy notes_select on notes
  for select to authenticated
  using (hospital_id = (select public.current_hospital_id()));

create policy timeline_select on timeline_events
  for select to authenticated
  using (hospital_id = (select public.current_hospital_id()));

create policy vitals_select on vital_readings
  for select to authenticated
  using (hospital_id = (select public.current_hospital_id()));

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------
-- Supabase grants broad default privileges on new public tables. Strip them so
-- the API role can only SELECT (and only through the policies above); anon gets
-- nothing. Writes happen inside security-definer functions running as the
-- function owner, which are unaffected by these revokes.

revoke all on all tables in schema public from anon, authenticated;
grant select on
  hospitals, wards, staff, hospital_invites, patients, alerts, tasks,
  medications, notes, timeline_events, vital_readings, audit_events
to authenticated;

-- Future tables should not silently become writable by API roles either.
alter default privileges in schema public revoke all on tables from anon, authenticated;
