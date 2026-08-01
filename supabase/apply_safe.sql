-- WardFlow v2 — safe apply (schema + seed).
-- Use this if apply_all.sql failed part-way through or if you need to rerun setup.
-- Fictional demo data only; not for real patient information.

create extension if not exists "pgcrypto";

do $$
begin
  create type staff_role as enum ('doctor', 'nurse', 'admin');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type patient_status as enum ('urgent', 'warning', 'stable');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type alert_severity as enum ('urgent', 'warning');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type alert_status as enum ('active', 'acknowledged', 'resolved');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type task_priority as enum ('urgent', 'important', 'routine');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type task_status as enum ('open', 'completed');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type medication_status as enum ('due', 'upcoming', 'administered');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type timeline_type as enum (
    'urgent', 'warning', 'task', 'alert', 'medication', 'note', 'vitals'
  );
exception when duplicate_object then null;
end $$;

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

alter table staff enable row level security;
alter table patients enable row level security;
alter table alerts enable row level security;
alter table tasks enable row level security;
alter table medications enable row level security;
alter table notes enable row level security;
alter table timeline_events enable row level security;
alter table vital_readings enable row level security;
alter table audit_events enable row level security;

drop policy if exists "demo_staff_all" on staff;
drop policy if exists "demo_patients_all" on patients;
drop policy if exists "demo_alerts_all" on alerts;
drop policy if exists "demo_tasks_all" on tasks;
drop policy if exists "demo_medications_all" on medications;
drop policy if exists "demo_notes_all" on notes;
drop policy if exists "demo_timeline_all" on timeline_events;
drop policy if exists "demo_vitals_all" on vital_readings;
drop policy if exists "demo_audit_all" on audit_events;

-- Temporary demo policies: allow anon read/write until real auth lands.
-- REPLACE these before any real clinical/pilot deployment.
create policy "demo_staff_all" on staff for all using (true) with check (true);
create policy "demo_patients_all" on patients for all using (true) with check (true);
create policy "demo_alerts_all" on alerts for all using (true) with check (true);
create policy "demo_tasks_all" on tasks for all using (true) with check (true);
create policy "demo_medications_all" on medications for all using (true) with check (true);
create policy "demo_notes_all" on notes for all using (true) with check (true);
create policy "demo_timeline_all" on timeline_events for all using (true) with check (true);
create policy "demo_vitals_all" on vital_readings for all using (true) with check (true);
create policy "demo_audit_all" on audit_events for all using (true) with check (true);

insert into staff (id, name, role, detail, initials) values
  ('doctor-1', 'Dr. Sarah Khan', 'doctor', 'Attending physician', 'SK'),
  ('doctor-2', 'Dr. Omar Siddiqui', 'doctor', 'Ward physician', 'OS'),
  ('nurse-1', 'Nurse Alex Morgan', 'nurse', 'Day shift', 'AM'),
  ('nurse-2', 'Nurse Priya Nair', 'nurse', 'Day shift', 'PN'),
  ('admin-1', 'Jordan Lee', 'admin', 'Ward administrator', 'JL')
on conflict (id) do update set
  name = excluded.name,
  role = excluded.role,
  detail = excluded.detail,
  initials = excluded.initials;

insert into patients (
  id, name, age, room, diagnosis, allergy, status, doctor_id, nurse_id,
  admitted_on, oxygen, heart_rate, bp, temperature, respiratory, updated_at
) values
  ('p1', 'Maya Patel', 67, '204-B', 'Pneumonia', 'Penicillin', 'urgent', 'doctor-1', 'nurse-1', '2026-06-04', 89, 112, '128/82', 38.4, 25, now()),
  ('p2', 'Robert Allen', 54, '208-A', 'Post-operative recovery', 'None recorded', 'warning', 'doctor-1', 'nurse-1', '2026-06-04', 96, 102, '139/88', 38.2, 20, now()),
  ('p3', 'Elena Garcia', 42, '206-A', 'Acute asthma', 'Ibuprofen', 'stable', 'doctor-1', 'nurse-1', '2026-06-04', 97, 84, '118/76', 37.1, 18, now()),
  ('p4', 'Noah Williams', 73, '202-C', 'Heart failure observation', 'Latex', 'warning', 'doctor-1', 'nurse-2', '2026-06-04', 94, 98, '152/91', 36.9, 22, now()),
  ('p5', 'Aisha Rahman', 29, '210-A', 'Severe dehydration', 'None recorded', 'stable', 'doctor-2', 'nurse-1', '2026-06-04', 99, 88, '111/72', 37.0, 16, now()),
  ('p6', 'Daniel Kim', 61, '205-B', 'Diabetic foot infection', 'Sulfa drugs', 'stable', 'doctor-2', 'nurse-2', '2026-06-04', 98, 80, '126/80', 37.4, 17, now()),
  ('p7', 'Priya Sharma', 35, '207-A', 'Appendicitis observation', 'None recorded', 'stable', 'doctor-1', 'nurse-2', '2026-06-04', 99, 78, '116/75', 37.2, 15, now()),
  ('p8', 'James Walker', 48, '209-B', 'Cellulitis', 'Amoxicillin', 'stable', 'doctor-2', 'nurse-1', '2026-06-04', 98, 82, '124/79', 37.5, 16, now())
on conflict (id) do update set
  name = excluded.name,
  age = excluded.age,
  room = excluded.room,
  diagnosis = excluded.diagnosis,
  allergy = excluded.allergy,
  status = excluded.status,
  doctor_id = excluded.doctor_id,
  nurse_id = excluded.nurse_id,
  admitted_on = excluded.admitted_on,
  oxygen = excluded.oxygen,
  heart_rate = excluded.heart_rate,
  bp = excluded.bp,
  temperature = excluded.temperature,
  respiratory = excluded.respiratory,
  updated_at = excluded.updated_at;

insert into alerts (id, patient_id, severity, message, status) values
  ('a1', 'p1', 'urgent', 'Oxygen saturation 89% is below threshold', 'active'),
  ('a2', 'p2', 'warning', 'Temperature 38.2°C is above threshold', 'active'),
  ('a3', 'p4', 'warning', 'Oxygen saturation 94% is below threshold', 'acknowledged')
on conflict (id) do update set
  patient_id = excluded.patient_id,
  severity = excluded.severity,
  message = excluded.message,
  status = excluded.status,
  updated_at = now();

insert into tasks (id, patient_id, title, due_label, priority, status) values
  ('t1', 'p1', 'Recheck oxygen saturation', 'In 15 minutes', 'urgent', 'open'),
  ('t2', 'p2', 'Review surgical dressing', '11:30 AM', 'important', 'open'),
  ('t3', 'p3', 'Complete respiratory assessment', '12:00 PM', 'routine', 'open'),
  ('t4', 'p5', 'Repeat fluid balance', '1:00 PM', 'routine', 'open')
on conflict (id) do update set
  patient_id = excluded.patient_id,
  title = excluded.title,
  due_label = excluded.due_label,
  priority = excluded.priority,
  status = excluded.status;

insert into medications (id, patient_id, name, dose, due_label, status) values
  ('m1', 'p1', 'Ceftriaxone', '1 g IV', '12:00 PM', 'due'),
  ('m2', 'p1', 'Paracetamol', '500 mg oral', '2:00 PM', 'upcoming'),
  ('m3', 'p2', 'Enoxaparin', '40 mg SC', '11:30 AM', 'due'),
  ('m4', 'p3', 'Salbutamol', '2.5 mg nebulized', '1:00 PM', 'upcoming')
on conflict (id) do update set
  patient_id = excluded.patient_id,
  name = excluded.name,
  dose = excluded.dose,
  due_label = excluded.due_label,
  status = excluded.status;

insert into notes (id, patient_id, author_name, author_id, note_type, content) values
  ('n1', 'p1', 'Nurse Alex Morgan', 'nurse-1', 'Nursing note', 'Patient reports increasing shortness of breath on movement.'),
  ('n2', 'p1', 'Dr. Sarah Khan', 'doctor-1', 'Doctor note', 'Continue close oxygen monitoring and repeat reading after intervention.'),
  ('n3', 'p3', 'Nurse Alex Morgan', 'nurse-1', 'Nursing note', 'Breathing comfortable following morning nebulizer.')
on conflict (id) do update set
  patient_id = excluded.patient_id,
  author_name = excluded.author_name,
  author_id = excluded.author_id,
  note_type = excluded.note_type,
  content = excluded.content;

insert into timeline_events (id, patient_id, summary, event_type) values
  ('e1', 'p1', 'Nurse Alex recorded vitals: oxygen saturation 89%', 'urgent'),
  ('e2', 'p1', 'Urgent vital alert automatically created', 'urgent'),
  ('e3', 'p1', 'Dr. Sarah requested another oxygen reading', 'task'),
  ('e4', 'p2', 'Nurse Alex recorded temperature 38.2°C', 'warning'),
  ('e5', 'p3', 'Morning medication administered', 'medication'),
  ('e6', 'p4', 'Dr. Sarah acknowledged oxygen alert', 'alert')
on conflict (id) do update set
  patient_id = excluded.patient_id,
  summary = excluded.summary,
  event_type = excluded.event_type;
