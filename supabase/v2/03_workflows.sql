-- WardFlow v2 multi-hospital schema — step 3 of 3 (clinical workflows)
--
-- Run AFTER 01_schema.sql and 02_onboarding.sql (uses write_audit and
-- default_hospital_settings from 02).
--
-- Every clinical write goes through one of these functions. Each runs as a
-- single transaction, so a failure part-way rolls the whole action back (no
-- more "patient updated but alert missing"), and each one:
--   * checks the caller's role,
--   * scopes every lookup to the caller's hospital_id (these functions bypass
--     RLS, so the hospital check in each query IS the tenant isolation),
--   * writes the timeline entry and audit row itself.
--
-- Role rules (mirroring the app's UI):
--   record vitals / acknowledge or resolve alerts / complete tasks /
--     administer medication ........ doctor, nurse
--   order medication ............... doctor
--   create task / add note / admit or edit patient ... doctor, nurse, admin
--   change a patient's ward or care team .... doctor, admin
--
-- Abnormal-vitals rules run here, against the hospital's own alertThresholds
-- (falling back to the defaults from default_hospital_settings() for any value
-- that is missing or not a number), instead of only in the browser.
--
-- A patient's status is DERIVED from their open alerts; it is not directly
-- editable. Discharge is not modelled yet.

-- ---------------------------------------------------------------------------
-- Internal helpers (not exposed to API roles)
-- ---------------------------------------------------------------------------

-- Numeric setting at a path inside hospitals.settings, falling back to the
-- default settings when missing or not numeric.
create function public.setting_num(p_settings jsonb, p_path text[])
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(
    case
      when jsonb_extract_path_text(p_settings, variadic p_path) ~ '^-?[0-9]+(\.[0-9]+)?$'
      then jsonb_extract_path_text(p_settings, variadic p_path)::numeric
    end,
    jsonb_extract_path_text(public.default_hospital_settings(), variadic p_path)::numeric
  );
$$;

-- Abnormal findings for one reading. Same rules the app used client-side:
-- below/above "urgent" bounds -> urgent, else below/above "warning" -> warning.
create function public.evaluate_vitals(
  p_settings jsonb,
  p_oxygen int,
  p_heart_rate int,
  p_temperature numeric,
  p_respiratory int
)
returns table (ord int, severity public.alert_severity, message text)
language sql
stable
set search_path = public
as $$
  select 1, 'urgent'::public.alert_severity, format('Oxygen saturation %s%%', p_oxygen)
  where p_oxygen < public.setting_num(p_settings, '{alertThresholds,oxygen,urgentBelow}')
  union all
  select 1, 'warning', format('Oxygen saturation %s%%', p_oxygen)
  where p_oxygen >= public.setting_num(p_settings, '{alertThresholds,oxygen,urgentBelow}')
    and p_oxygen < public.setting_num(p_settings, '{alertThresholds,oxygen,warningBelow}')
  union all
  select 2, 'urgent', format('Heart rate %s bpm', p_heart_rate)
  where p_heart_rate < public.setting_num(p_settings, '{alertThresholds,heartRate,urgentLow}')
     or p_heart_rate > public.setting_num(p_settings, '{alertThresholds,heartRate,urgentHigh}')
  union all
  select 2, 'warning', format('Heart rate %s bpm', p_heart_rate)
  where not (p_heart_rate < public.setting_num(p_settings, '{alertThresholds,heartRate,urgentLow}')
          or p_heart_rate > public.setting_num(p_settings, '{alertThresholds,heartRate,urgentHigh}'))
    and (p_heart_rate < public.setting_num(p_settings, '{alertThresholds,heartRate,warningLow}')
      or p_heart_rate > public.setting_num(p_settings, '{alertThresholds,heartRate,warningHigh}'))
  union all
  select 3, 'urgent', format('Temperature %s°C', p_temperature)
  where p_temperature > public.setting_num(p_settings, '{alertThresholds,temperature,urgentAbove}')
  union all
  select 3, 'warning', format('Temperature %s°C', p_temperature)
  where p_temperature <= public.setting_num(p_settings, '{alertThresholds,temperature,urgentAbove}')
    and p_temperature > public.setting_num(p_settings, '{alertThresholds,temperature,warningAbove}')
  union all
  select 4, 'urgent', format('Respiratory rate %s/min', p_respiratory)
  where p_respiratory < public.setting_num(p_settings, '{alertThresholds,respiratory,urgentLow}')
     or p_respiratory > public.setting_num(p_settings, '{alertThresholds,respiratory,urgentHigh}')
  union all
  select 4, 'warning', format('Respiratory rate %s/min', p_respiratory)
  where not (p_respiratory < public.setting_num(p_settings, '{alertThresholds,respiratory,urgentLow}')
          or p_respiratory > public.setting_num(p_settings, '{alertThresholds,respiratory,urgentHigh}'))
    and (p_respiratory < public.setting_num(p_settings, '{alertThresholds,respiratory,warningLow}')
      or p_respiratory > public.setting_num(p_settings, '{alertThresholds,respiratory,warningHigh}'));
$$;

-- Caller's staff row, raising unless they are an active member with one of the
-- given roles.
create function public.require_role(p_roles public.staff_role[])
returns public.staff
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.staff;
begin
  select * into v from public.staff
  where auth_user_id = auth.uid() and active;
  if not found then
    raise exception 'Sign in with a hospital account first.';
  end if;
  if not (v.role = any (p_roles)) then
    raise exception 'Your role (%) is not allowed to do this.', v.role;
  end if;
  return v;
end;
$$;

create function public.add_timeline(
  p_hospital_id uuid,
  p_patient_id uuid,
  p_summary text,
  p_type public.timeline_type
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.timeline_events (hospital_id, patient_id, summary, event_type)
  values (p_hospital_id, p_patient_id, p_summary, p_type);
$$;

-- Patient status = worst open alert (urgent > warning), else stable.
create function public.recompute_patient_status(p_hospital_id uuid, p_patient_id uuid)
returns public.patient_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.patient_status;
begin
  select case
           when bool_or(severity = 'urgent') then 'urgent'::public.patient_status
           when count(*) > 0 then 'warning'::public.patient_status
           else 'stable'::public.patient_status
         end
    into v_status
  from public.alerts
  where hospital_id = p_hospital_id and patient_id = p_patient_id
    and status <> 'resolved';

  update public.patients
  set status = v_status, updated_at = now()
  where id = p_patient_id and hospital_id = p_hospital_id;
  return v_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vitals and alerts
-- ---------------------------------------------------------------------------

-- Records a reading, raises an alert if it is abnormal for this hospital, and
-- updates the patient's status. Returns
-- {abnormal_count, alert_id (or null), status}.
create function public.record_vitals(
  p_patient_id uuid,
  p_oxygen int,
  p_heart_rate int,
  p_bp text,
  p_temperature numeric,
  p_respiratory int,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff := public.require_role('{doctor,nurse}');
  v_patient public.patients;
  v_settings jsonb;
  v_count int;
  v_urgent boolean;
  v_message text;
  v_alert uuid;
  v_severity public.alert_severity;
  v_status public.patient_status;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_oxygen is null or p_heart_rate is null or p_temperature is null
     or p_respiratory is null or p_bp is null then
    raise exception 'All vital signs are required.';
  end if;
  if p_bp !~ '^[0-9]{2,3}/[0-9]{2,3}$' then
    raise exception 'Blood pressure must look like 120/80.';
  end if;

  select * into v_patient from public.patients
  where id = p_patient_id and hospital_id = v_staff.hospital_id
  for update;
  if not found then
    raise exception 'Patient not found.';
  end if;

  select settings into v_settings from public.hospitals
  where id = v_staff.hospital_id;

  insert into public.vital_readings
    (hospital_id, patient_id, recorded_by, oxygen, heart_rate, bp, temperature,
     respiratory, note)
  values
    (v_staff.hospital_id, p_patient_id, v_staff.id, p_oxygen, p_heart_rate, p_bp,
     p_temperature, p_respiratory, v_note);

  update public.patients
  set oxygen = p_oxygen, heart_rate = p_heart_rate, bp = p_bp,
      temperature = p_temperature, respiratory = p_respiratory,
      updated_at = now()
  where id = p_patient_id;

  select count(*), coalesce(bool_or(severity = 'urgent'), false),
         string_agg(message, '; ' order by ord)
    into v_count, v_urgent, v_message
  from public.evaluate_vitals(v_settings, p_oxygen, p_heart_rate, p_temperature,
                              p_respiratory);

  if v_count > 0 then
    v_severity := case when v_urgent then 'urgent' else 'warning' end;
    insert into public.alerts (hospital_id, patient_id, severity, message)
    values (v_staff.hospital_id, p_patient_id, v_severity, v_message)
    returning id into v_alert;
    perform public.add_timeline(v_staff.hospital_id, p_patient_id,
      case when v_urgent then 'Urgent' else 'Warning' end
        || ' vital alert automatically created',
      v_severity::text::public.timeline_type);
  end if;

  perform public.add_timeline(v_staff.hospital_id, p_patient_id,
    v_staff.name || ' recorded new vitals'
      || coalesce(': ' || v_note, ''),
    'vitals');

  v_status := public.recompute_patient_status(v_staff.hospital_id, p_patient_id);

  perform public.write_audit(v_staff.hospital_id, v_staff.id, v_staff.name,
    'record_vitals', 'patient', p_patient_id, p_patient_id,
    jsonb_build_object('oxygen', p_oxygen, 'heart_rate', p_heart_rate, 'bp', p_bp,
                       'temperature', p_temperature, 'respiratory', p_respiratory,
                       'note', v_note, 'alert_id', v_alert));

  return jsonb_build_object('abnormal_count', v_count, 'alert_id', v_alert,
                            'status', v_status);
end;
$$;

-- active -> acknowledged, or active/acknowledged -> resolved. Resolved is final.
create function public.set_alert_status(p_alert_id uuid, p_status public.alert_status)
returns public.patient_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff := public.require_role('{doctor,nurse}');
  v_alert public.alerts;
  v_status public.patient_status;
begin
  if p_status not in ('acknowledged', 'resolved') then
    raise exception 'An alert can only be acknowledged or resolved.';
  end if;

  select * into v_alert from public.alerts
  where id = p_alert_id and hospital_id = v_staff.hospital_id
  for update;
  if not found then
    raise exception 'Alert not found.';
  end if;
  if v_alert.status = 'resolved' or v_alert.status = p_status then
    raise exception 'This alert is already %.', v_alert.status;
  end if;

  update public.alerts set status = p_status, updated_at = now()
  where id = v_alert.id;

  perform public.add_timeline(v_staff.hospital_id, v_alert.patient_id,
    v_staff.name || ' ' || p_status::text || ' alert: ' || v_alert.message, 'alert');
  v_status := public.recompute_patient_status(v_staff.hospital_id, v_alert.patient_id);

  perform public.write_audit(v_staff.hospital_id, v_staff.id, v_staff.name,
    'alert_' || p_status::text, 'alert', v_alert.id, v_alert.patient_id,
    jsonb_build_object('message', v_alert.message));
  return v_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

create function public.create_task(
  p_patient_id uuid,
  p_title text,
  p_due_label text default 'Next shift',
  p_priority public.task_priority default 'routine'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff := public.require_role('{doctor,nurse,admin}');
  v_title text := btrim(coalesce(p_title, ''));
  v_due text := coalesce(nullif(btrim(p_due_label), ''), 'Next shift');
  v_id uuid;
begin
  if v_title = '' or length(v_title) > 200 then
    raise exception 'Task title must be 1 to 200 characters.';
  end if;
  if not exists (select 1 from public.patients
                 where id = p_patient_id and hospital_id = v_staff.hospital_id) then
    raise exception 'Patient not found.';
  end if;

  insert into public.tasks (hospital_id, patient_id, title, due_label, priority)
  values (v_staff.hospital_id, p_patient_id, v_title, left(v_due, 60), p_priority)
  returning id into v_id;

  perform public.add_timeline(v_staff.hospital_id, p_patient_id,
    v_staff.name || ' created task: ' || v_title, 'task');
  perform public.write_audit(v_staff.hospital_id, v_staff.id, v_staff.name,
    'create_task', 'task', v_id, p_patient_id,
    jsonb_build_object('title', v_title, 'priority', p_priority));
  return v_id;
end;
$$;

create function public.complete_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff := public.require_role('{doctor,nurse}');
  v_task public.tasks;
begin
  select * into v_task from public.tasks
  where id = p_task_id and hospital_id = v_staff.hospital_id
  for update;
  if not found then
    raise exception 'Task not found.';
  end if;
  if v_task.status = 'completed' then
    raise exception 'This task is already completed.';
  end if;

  update public.tasks set status = 'completed' where id = v_task.id;
  perform public.add_timeline(v_staff.hospital_id, v_task.patient_id,
    v_staff.name || ' completed task: ' || v_task.title, 'task');
  perform public.write_audit(v_staff.hospital_id, v_staff.id, v_staff.name,
    'complete_task', 'task', v_task.id, v_task.patient_id,
    jsonb_build_object('title', v_task.title));
end;
$$;

-- ---------------------------------------------------------------------------
-- Medications
-- ---------------------------------------------------------------------------

create function public.order_medication(
  p_patient_id uuid,
  p_name text,
  p_dose text,
  p_due_label text default 'As scheduled'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff := public.require_role('{doctor}');
  v_name text := btrim(coalesce(p_name, ''));
  v_dose text := btrim(coalesce(p_dose, ''));
  v_due text := coalesce(nullif(btrim(p_due_label), ''), 'As scheduled');
  v_id uuid;
begin
  if v_name = '' or v_dose = '' or length(v_name) > 120 or length(v_dose) > 120 then
    raise exception 'Medication name and dose are required (max 120 characters).';
  end if;
  if not exists (select 1 from public.patients
                 where id = p_patient_id and hospital_id = v_staff.hospital_id) then
    raise exception 'Patient not found.';
  end if;

  insert into public.medications
    (hospital_id, patient_id, name, dose, due_label, status, ordered_by)
  values
    (v_staff.hospital_id, p_patient_id, v_name, v_dose, left(v_due, 60), 'due',
     v_staff.id)
  returning id into v_id;

  perform public.add_timeline(v_staff.hospital_id, p_patient_id,
    v_staff.name || ' ordered ' || v_name || ' ' || v_dose, 'medication');
  perform public.write_audit(v_staff.hospital_id, v_staff.id, v_staff.name,
    'order_medication', 'medication', v_id, p_patient_id,
    jsonb_build_object('name', v_name, 'dose', v_dose, 'due', v_due));
  return v_id;
end;
$$;

create function public.administer_medication(p_medication_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff := public.require_role('{doctor,nurse}');
  v_med public.medications;
begin
  select * into v_med from public.medications
  where id = p_medication_id and hospital_id = v_staff.hospital_id
  for update;
  if not found then
    raise exception 'Medication order not found.';
  end if;
  if v_med.status = 'administered' then
    raise exception 'This medication has already been administered.';
  end if;

  update public.medications set status = 'administered' where id = v_med.id;
  perform public.add_timeline(v_staff.hospital_id, v_med.patient_id,
    v_staff.name || ' administered ' || v_med.name || ' (' || v_med.dose || ')',
    'medication');
  perform public.write_audit(v_staff.hospital_id, v_staff.id, v_staff.name,
    'administer_medication', 'medication', v_med.id, v_med.patient_id,
    jsonb_build_object('name', v_med.name, 'dose', v_med.dose));
end;
$$;

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------

create function public.add_note(
  p_patient_id uuid,
  p_content text,
  p_note_type text default 'Clinical note'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff := public.require_role('{doctor,nurse,admin}');
  v_content text := btrim(coalesce(p_content, ''));
  v_type text := coalesce(nullif(btrim(p_note_type), ''), 'Clinical note');
  v_id uuid;
begin
  if v_content = '' or length(v_content) > 5000 then
    raise exception 'A note must be 1 to 5000 characters.';
  end if;
  if length(v_type) > 60 then
    raise exception 'Note type is too long.';
  end if;
  if not exists (select 1 from public.patients
                 where id = p_patient_id and hospital_id = v_staff.hospital_id) then
    raise exception 'Patient not found.';
  end if;

  insert into public.notes
    (hospital_id, patient_id, author_id, author_name, note_type, content)
  values
    (v_staff.hospital_id, p_patient_id, v_staff.id, v_staff.name, v_type, v_content)
  returning id into v_id;

  perform public.add_timeline(v_staff.hospital_id, p_patient_id,
    v_staff.name || ' added ' || lower(v_type), 'note');
  perform public.write_audit(v_staff.hospital_id, v_staff.id, v_staff.name,
    'add_note', 'note', v_id, p_patient_id, jsonb_build_object('type', v_type));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Patients
-- ---------------------------------------------------------------------------

-- Checks that a ward / doctor / nurse reference belongs to the caller's
-- hospital (and is an active member with the right role) for a friendlier
-- error than a foreign-key violation.
create function public.check_care_team(
  p_hospital_id uuid,
  p_ward_id uuid,
  p_doctor_id uuid,
  p_nurse_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_ward_id is not null and not exists (
       select 1 from public.wards where id = p_ward_id and hospital_id = p_hospital_id) then
    raise exception 'Ward not found.';
  end if;
  if p_doctor_id is not null and not exists (
       select 1 from public.staff where id = p_doctor_id
         and hospital_id = p_hospital_id and role = 'doctor' and active) then
    raise exception 'Assigned doctor must be an active doctor at this hospital.';
  end if;
  if p_nurse_id is not null and not exists (
       select 1 from public.staff where id = p_nurse_id
         and hospital_id = p_hospital_id and role = 'nurse' and active) then
    raise exception 'Assigned nurse must be an active nurse at this hospital.';
  end if;
end;
$$;

create function public.admit_patient(
  p_name text,
  p_age int,
  p_room text,
  p_diagnosis text,
  p_allergy text default 'None recorded',
  p_ward_id uuid default null,
  p_doctor_id uuid default null,
  p_nurse_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff := public.require_role('{doctor,nurse,admin}');
  v_name text := btrim(coalesce(p_name, ''));
  v_room text := btrim(coalesce(p_room, ''));
  v_diag text := btrim(coalesce(p_diagnosis, ''));
  v_allergy text := coalesce(nullif(btrim(p_allergy), ''), 'None recorded');
  v_id uuid;
begin
  if v_name = '' or v_room = '' or v_diag = '' then
    raise exception 'Name, room and diagnosis are required.';
  end if;
  if p_age is null or p_age <= 0 or p_age >= 150 then
    raise exception 'Age must be between 1 and 149.';
  end if;
  perform public.check_care_team(v_staff.hospital_id, p_ward_id, p_doctor_id, p_nurse_id);

  insert into public.patients
    (hospital_id, ward_id, name, age, room, diagnosis, allergy, doctor_id, nurse_id)
  values
    (v_staff.hospital_id, p_ward_id, v_name, p_age, v_room, v_diag, v_allergy,
     p_doctor_id, p_nurse_id)
  returning id into v_id;

  perform public.add_timeline(v_staff.hospital_id, v_id,
    v_staff.name || ' admitted ' || v_name, 'note');
  perform public.write_audit(v_staff.hospital_id, v_staff.id, v_staff.name,
    'admit_patient', 'patient', v_id, v_id, jsonb_build_object('room', v_room));
  return v_id;
end;
$$;

-- Edit demographics. Changing the ward or care team additionally requires the
-- doctor or admin role, matching the app's existing permission.
create function public.update_patient(
  p_patient_id uuid,
  p_name text,
  p_age int,
  p_room text,
  p_diagnosis text,
  p_allergy text,
  p_ward_id uuid,
  p_doctor_id uuid,
  p_nurse_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff := public.require_role('{doctor,nurse,admin}');
  v_patient public.patients;
  v_name text := btrim(coalesce(p_name, ''));
  v_room text := btrim(coalesce(p_room, ''));
  v_diag text := btrim(coalesce(p_diagnosis, ''));
  v_allergy text := coalesce(nullif(btrim(p_allergy), ''), 'None recorded');
begin
  if v_name = '' or v_room = '' or v_diag = '' then
    raise exception 'Name, room and diagnosis are required.';
  end if;
  if p_age is null or p_age <= 0 or p_age >= 150 then
    raise exception 'Age must be between 1 and 149.';
  end if;

  select * into v_patient from public.patients
  where id = p_patient_id and hospital_id = v_staff.hospital_id
  for update;
  if not found then
    raise exception 'Patient not found.';
  end if;

  if (p_ward_id is distinct from v_patient.ward_id
      or p_doctor_id is distinct from v_patient.doctor_id
      or p_nurse_id is distinct from v_patient.nurse_id)
     and v_staff.role not in ('doctor', 'admin') then
    raise exception 'Only doctors and admins can change the ward or care team.';
  end if;
  perform public.check_care_team(v_staff.hospital_id, p_ward_id, p_doctor_id, p_nurse_id);

  update public.patients
  set name = v_name, age = p_age, room = v_room, diagnosis = v_diag,
      allergy = v_allergy, ward_id = p_ward_id, doctor_id = p_doctor_id,
      nurse_id = p_nurse_id, updated_at = now()
  where id = v_patient.id;

  perform public.write_audit(v_staff.hospital_id, v_staff.id, v_staff.name,
    'update_patient', 'patient', v_patient.id, v_patient.id, '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- API grants
-- ---------------------------------------------------------------------------

revoke all on function public.setting_num(jsonb, text[]) from public, anon, authenticated;
revoke all on function public.evaluate_vitals(jsonb, int, int, numeric, int) from public, anon, authenticated;
revoke all on function public.require_role(public.staff_role[]) from public, anon, authenticated;
revoke all on function public.add_timeline(uuid, uuid, text, public.timeline_type) from public, anon, authenticated;
revoke all on function public.recompute_patient_status(uuid, uuid) from public, anon, authenticated;
revoke all on function public.check_care_team(uuid, uuid, uuid, uuid) from public, anon, authenticated;

revoke all on function public.record_vitals(uuid, int, int, text, numeric, int, text) from public, anon;
revoke all on function public.set_alert_status(uuid, public.alert_status) from public, anon;
revoke all on function public.create_task(uuid, text, text, public.task_priority) from public, anon;
revoke all on function public.complete_task(uuid) from public, anon;
revoke all on function public.order_medication(uuid, text, text, text) from public, anon;
revoke all on function public.administer_medication(uuid) from public, anon;
revoke all on function public.add_note(uuid, text, text) from public, anon;
revoke all on function public.admit_patient(text, int, text, text, text, uuid, uuid, uuid) from public, anon;
revoke all on function public.update_patient(uuid, text, int, text, text, text, uuid, uuid, uuid) from public, anon;

grant execute on function public.record_vitals(uuid, int, int, text, numeric, int, text) to authenticated;
grant execute on function public.set_alert_status(uuid, public.alert_status) to authenticated;
grant execute on function public.create_task(uuid, text, text, public.task_priority) to authenticated;
grant execute on function public.complete_task(uuid) to authenticated;
grant execute on function public.order_medication(uuid, text, text, text) to authenticated;
grant execute on function public.administer_medication(uuid) to authenticated;
grant execute on function public.add_note(uuid, text, text) to authenticated;
grant execute on function public.admit_patient(text, int, text, text, text, uuid, uuid, uuid) to authenticated;
grant execute on function public.update_patient(uuid, text, int, text, text, text, uuid, uuid, uuid) to authenticated;
