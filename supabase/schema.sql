-- WardFlow v2 — Supabase schema (Phase 3)
-- Run in the Supabase SQL editor after creating a project.
-- Fictional demo data only; not for real patient information.

-- Extensions
create extension if not exists "pgcrypto";

-- Roles mirror the app's Role type
create type staff_role as enum ('doctor', 'nurse', 'admin');
create type patient_status as enum ('urgent', 'warning', 'stable');
create type alert_severity as enum ('urgent', 'warning');
create type alert_status as enum ('active', 'acknowledged', 'resolved');
create type task_priority as enum ('urgent', 'important', 'routine');
create type task_status as enum ('open', 'completed');
create type medication_status as enum ('due', 'upcoming', 'administered');
create type timeline_type as enum (
  'urgent', 'warning', 'task', 'alert', 'medication', 'note', 'vitals'
);

-- Staff profiles (linked to auth.users after Phase 4)
create table if not exists staff (
  id text primary key,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  role staff_role not null,
  detail text not null default '',
  initials text not null,
  created_at timestamptz not null default now()
);

create table if not exists patients (
  id text primary key,
  name text not null,
  age int not null check (age > 0 and age < 150),
  room text not null,
  diagnosis text not null,
  allergy text not null default 'None recorded',
  status patient_status not null default 'stable',
  doctor_id text references staff (id),
  nurse_id text references staff (id),
  admitted_on date not null default current_date,
  oxygen int,
  heart_rate int,
  bp text,
  temperature numeric(4, 1),
  respiratory int,
  updated_at timestamptz not null default now()
);

create table if not exists alerts (
  id text primary key default gen_random_uuid()::text,
  patient_id text not null references patients (id) on delete cascade,
  severity alert_severity not null,
  message text not null,
  status alert_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tasks (
  id text primary key default gen_random_uuid()::text,
  patient_id text not null references patients (id) on delete cascade,
  title text not null,
  due_label text not null,
  priority task_priority not null default 'routine',
  status task_status not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists medications (
  id text primary key default gen_random_uuid()::text,
  patient_id text not null references patients (id) on delete cascade,
  name text not null,
  dose text not null,
  due_label text not null,
  status medication_status not null default 'due',
  ordered_by text references staff (id),
  created_at timestamptz not null default now()
);

create table if not exists notes (
  id text primary key default gen_random_uuid()::text,
  patient_id text not null references patients (id) on delete cascade,
  author_name text not null,
  author_id text references staff (id),
  note_type text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists timeline_events (
  id text primary key default gen_random_uuid()::text,
  patient_id text not null references patients (id) on delete cascade,
  summary text not null,
  event_type timeline_type not null,
  created_at timestamptz not null default now()
);

create table if not exists vital_readings (
  id text primary key default gen_random_uuid()::text,
  patient_id text not null references patients (id) on delete cascade,
  recorded_by text references staff (id),
  oxygen int not null,
  heart_rate int not null,
  bp text not null,
  temperature numeric(4, 1) not null,
  respiratory int not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id text primary key default gen_random_uuid()::text,
  actor_id text references staff (id),
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id text,
  patient_id text references patients (id),
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_alerts_patient on alerts (patient_id);
create index if not exists idx_alerts_status on alerts (status);
create index if not exists idx_tasks_patient on tasks (patient_id);
create index if not exists idx_meds_patient on medications (patient_id);
create index if not exists idx_notes_patient on notes (patient_id);
create index if not exists idx_timeline_patient on timeline_events (patient_id);
create index if not exists idx_vitals_patient on vital_readings (patient_id);

-- Open read for demo; tighten with RLS + auth in Phase 4.
alter table staff enable row level security;
alter table patients enable row level security;
alter table alerts enable row level security;
alter table tasks enable row level security;
alter table medications enable row level security;
alter table notes enable row level security;
alter table timeline_events enable row level security;
alter table vital_readings enable row level security;
alter table audit_events enable row level security;

-- Temporary demo policies: allow anon read/write until real auth lands.
-- REPLACE with supabase/phase4_auth.sql after linking demo users.
create policy "demo_staff_all" on staff for all using (true) with check (true);
create policy "demo_patients_all" on patients for all using (true) with check (true);
create policy "demo_alerts_all" on alerts for all using (true) with check (true);
create policy "demo_tasks_all" on tasks for all using (true) with check (true);
create policy "demo_medications_all" on medications for all using (true) with check (true);
create policy "demo_notes_all" on notes for all using (true) with check (true);
create policy "demo_timeline_all" on timeline_events for all using (true) with check (true);
create policy "demo_vitals_all" on vital_readings for all using (true) with check (true);
create policy "demo_audit_all" on audit_events for all using (true) with check (true);
