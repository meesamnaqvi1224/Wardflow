-- WardFlow v2 — Phase 5b: tenant integrity hardening
-- Run AFTER phase5_multi_hospital.sql. Safe to re-run.
--
-- Phase 5 scopes every row to a hospital with RLS, but the foreign keys are
-- still single-column on globally unique text ids. That means a row in
-- hospital A can point at a patient or staff member in hospital B (the FK is
-- satisfied, and the error/success difference lets A probe B's ids). This file:
--
--   1. Adds composite (hospital_id, x_id) foreign keys so a row can only
--      reference patients/staff from its own hospital.
--   2. Stops staff from writing audit rows in someone else's name.
--
-- Not covered (still open, see README "Phase 5 notes"): primary keys on
-- patients/staff are still globally unique text ids, so two hospitals cannot
-- both use the same id such as "p1". Moving to generated UUIDs or
-- hospital-scoped ids is a separate, breaking migration.
--
-- Before running, check for existing cross-tenant references (should be empty):
--   select 'alerts', a.id from alerts a join patients p on p.id = a.patient_id
--     where p.hospital_id <> a.hospital_id;  -- repeat per table if in doubt
-- Constraints are added NOT VALID then validated, so a violating row makes the
-- VALIDATE step fail loudly instead of being silently accepted.

-- The composite FKs need unique indexes on (hospital_id, id). Phase 5 creates
-- them; repeat here so this file stands alone.
create unique index if not exists idx_staff_hospital_id_unique on staff (hospital_id, id);
create unique index if not exists idx_patients_hospital_id_unique on patients (hospital_id, id);

-- ---------------------------------------------------------------------------
-- Composite foreign keys
-- ---------------------------------------------------------------------------
-- Nullable reference columns use the default MATCH SIMPLE, so a NULL
-- patient_id / actor_id skips the check, same as the original FKs.

-- Rows that belong to a patient (cascade on delete, as before).
alter table alerts drop constraint if exists alerts_patient_tenant_fk;
alter table alerts add constraint alerts_patient_tenant_fk
  foreign key (hospital_id, patient_id) references patients (hospital_id, id)
  on delete cascade not valid;
alter table alerts validate constraint alerts_patient_tenant_fk;

alter table tasks drop constraint if exists tasks_patient_tenant_fk;
alter table tasks add constraint tasks_patient_tenant_fk
  foreign key (hospital_id, patient_id) references patients (hospital_id, id)
  on delete cascade not valid;
alter table tasks validate constraint tasks_patient_tenant_fk;

alter table medications drop constraint if exists medications_patient_tenant_fk;
alter table medications add constraint medications_patient_tenant_fk
  foreign key (hospital_id, patient_id) references patients (hospital_id, id)
  on delete cascade not valid;
alter table medications validate constraint medications_patient_tenant_fk;

alter table notes drop constraint if exists notes_patient_tenant_fk;
alter table notes add constraint notes_patient_tenant_fk
  foreign key (hospital_id, patient_id) references patients (hospital_id, id)
  on delete cascade not valid;
alter table notes validate constraint notes_patient_tenant_fk;

alter table timeline_events drop constraint if exists timeline_events_patient_tenant_fk;
alter table timeline_events add constraint timeline_events_patient_tenant_fk
  foreign key (hospital_id, patient_id) references patients (hospital_id, id)
  on delete cascade not valid;
alter table timeline_events validate constraint timeline_events_patient_tenant_fk;

alter table vital_readings drop constraint if exists vital_readings_patient_tenant_fk;
alter table vital_readings add constraint vital_readings_patient_tenant_fk
  foreign key (hospital_id, patient_id) references patients (hospital_id, id)
  on delete cascade not valid;
alter table vital_readings validate constraint vital_readings_patient_tenant_fk;

-- Audit rows keep the original no-cascade behaviour.
alter table audit_events drop constraint if exists audit_events_patient_tenant_fk;
alter table audit_events add constraint audit_events_patient_tenant_fk
  foreign key (hospital_id, patient_id) references patients (hospital_id, id)
  not valid;
alter table audit_events validate constraint audit_events_patient_tenant_fk;

-- Staff references.
alter table patients drop constraint if exists patients_doctor_tenant_fk;
alter table patients add constraint patients_doctor_tenant_fk
  foreign key (hospital_id, doctor_id) references staff (hospital_id, id) not valid;
alter table patients validate constraint patients_doctor_tenant_fk;

alter table patients drop constraint if exists patients_nurse_tenant_fk;
alter table patients add constraint patients_nurse_tenant_fk
  foreign key (hospital_id, nurse_id) references staff (hospital_id, id) not valid;
alter table patients validate constraint patients_nurse_tenant_fk;

alter table medications drop constraint if exists medications_ordered_by_tenant_fk;
alter table medications add constraint medications_ordered_by_tenant_fk
  foreign key (hospital_id, ordered_by) references staff (hospital_id, id) not valid;
alter table medications validate constraint medications_ordered_by_tenant_fk;

alter table notes drop constraint if exists notes_author_tenant_fk;
alter table notes add constraint notes_author_tenant_fk
  foreign key (hospital_id, author_id) references staff (hospital_id, id) not valid;
alter table notes validate constraint notes_author_tenant_fk;

alter table vital_readings drop constraint if exists vital_readings_recorded_by_tenant_fk;
alter table vital_readings add constraint vital_readings_recorded_by_tenant_fk
  foreign key (hospital_id, recorded_by) references staff (hospital_id, id) not valid;
alter table vital_readings validate constraint vital_readings_recorded_by_tenant_fk;

alter table audit_events drop constraint if exists audit_events_actor_tenant_fk;
alter table audit_events add constraint audit_events_actor_tenant_fk
  foreign key (hospital_id, actor_id) references staff (hospital_id, id) not valid;
alter table audit_events validate constraint audit_events_actor_tenant_fk;

-- ---------------------------------------------------------------------------
-- Audit integrity: the actor must be the signed-in staff member
-- ---------------------------------------------------------------------------
-- The app always sends actor_id = the acting staff id. Without this, any
-- clinician could insert audit rows claiming another user did something.
-- Rows written with no auth context (SQL editor / service role) are allowed.

create or replace function public.audit_events_check_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.actor_id is distinct from public.current_staff_id() then
    raise exception 'audit actor_id must be the signed-in staff member';
  end if;
  return new;
end;
$$;

revoke all on function public.audit_events_check_actor() from public;

drop trigger if exists audit_events_check_actor_trg on audit_events;
create trigger audit_events_check_actor_trg
  before insert on audit_events
  for each row execute function public.audit_events_check_actor();
