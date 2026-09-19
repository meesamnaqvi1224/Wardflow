-- WardFlow v2 — step 4: cross-hospital isolation tests
--
-- Run AFTER 01_schema.sql, 02_onboarding.sql and 03_workflows.sql, on the
-- Supabase BRANCH or scratch project you applied them to, in the SQL editor
-- (as the postgres role). Never run this on a project with real data.
--
-- What it does: inside one transaction it creates fake auth users, two
-- hospitals (Alpha and Beta), staff, patients and clinical rows, then acts as
-- each user (by setting the JWT claims and switching to the `authenticated` /
-- `anon` role, exactly as the API does) and checks that:
--   * a user can read only their own hospital's rows, in every table,
--   * clients cannot write tables directly,
--   * every workflow function refuses another hospital's ids,
--   * role rules, the last-admin guard, invite rules and per-hospital alert
--     thresholds behave as designed,
--   * the composite foreign keys reject cross-hospital references.
--
-- The script ALWAYS ends with an intentional error whose message is the report:
--     TESTS FINISHED — N passed, 0 failed. Failed: none.
-- Raising the error rolls everything back, so nothing is left behind. If the
-- message lists failures, fix those first. If the script instead stops with a
-- different error (a SQL mistake in 01-03 or in a test), read it, then run
-- `rollback;` once to clear the aborted transaction.
--
-- Assumes a fresh Supabase project (no triggers on auth.users). If your
-- auth.users has extra NOT NULL columns, add them to zz_test.mk_user().

begin;

create schema zz_test;
grant usage on schema zz_test to public;

create table zz_test.results (
  n serial primary key,
  name text not null,
  pass boolean not null,
  detail text
);
grant all on zz_test.results to public;
grant usage, select on sequence zz_test.results_n_seq to public;

-- Act as a signed-in user, exactly like a PostgREST request.
create function zz_test.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create function zz_test.login_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end;
$$;

create function zz_test.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create function zz_test.expect(p_name text, p_cond boolean, p_detail text default null)
returns void language sql as $$
  insert into zz_test.results (name, pass, detail)
  values (p_name, coalesce(p_cond, false), p_detail);
$$;

-- Runs SQL as the current role; returns the error message, or null if it ran.
create function zz_test.raises(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlerrm;
end;
$$;

create function zz_test.mk_user(p_id uuid, p_email text, p_confirmed boolean)
returns void language sql as $$
  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
     created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated',
     'authenticated', p_email, '', case when p_confirmed then now() end,
     now(), now(), '{}'::jsonb, '{}'::jsonb);
$$;

grant execute on all functions in schema zz_test to public;

do $test$
declare
  -- auth users
  u_unver uuid := gen_random_uuid();
  u_adminA uuid := gen_random_uuid();
  u_adminB uuid := gen_random_uuid();
  u_docA uuid := gen_random_uuid();
  u_nurseA uuid := gen_random_uuid();
  u_docB uuid := gen_random_uuid();
  u_outsider uuid := gen_random_uuid();
  -- hospitals / staff / rows
  hospA uuid; hospB uuid;
  sAdminA uuid; sDocA uuid; sNurseA uuid; sAdminB uuid; sDocB uuid;
  wardB uuid;
  patA uuid; patB uuid;
  taskA uuid; taskB uuid; medA uuid; medB uuid; noteB uuid;
  alertA uuid; alertB uuid;
  inviteB uuid;
  r jsonb;
  n int; n2 int;
  msg text;
  t text;
  nf int; nt int; failed text;
begin
  perform zz_test.mk_user(u_unver, 'unverified@test.invalid', false);
  perform zz_test.mk_user(u_adminA, 'admin-a@test.invalid', true);
  perform zz_test.mk_user(u_adminB, 'admin-b@test.invalid', true);
  perform zz_test.mk_user(u_docA, 'doc-a@test.invalid', true);
  perform zz_test.mk_user(u_nurseA, 'nurse-a@test.invalid', true);
  perform zz_test.mk_user(u_docB, 'doc-b@test.invalid', true);
  perform zz_test.mk_user(u_outsider, 'outsider@test.invalid', true);

  -- ---- Signup ------------------------------------------------------------
  perform zz_test.login(u_unver);
  perform zz_test.expect('unverified email cannot create a hospital',
    zz_test.raises($q$select public.create_hospital('Nope Hospital', 'X')$q$) ilike '%verify%');

  perform zz_test.login(u_adminA);
  hospA := public.create_hospital('Alpha Hospital', 'Alice Admin', 'Ward A1');
  perform zz_test.expect('creating a second hospital with the same account is refused',
    zz_test.raises($q$select public.create_hospital('Alpha Two', 'Alice')$q$) ilike '%already belongs%');

  perform zz_test.login(u_adminB);
  hospB := public.create_hospital('Beta Hospital', 'Bob Admin', 'Ward B1');
  perform zz_test.expect('two hospitals get different ids', hospA <> hospB);

  -- ---- Invites and claiming ---------------------------------------------
  perform zz_test.login(u_adminA);
  perform public.invite_staff('doc-a@test.invalid', 'Dr Alpha', 'doctor');
  perform public.invite_staff('nurse-a@test.invalid', 'Nurse Alpha', 'nurse');
  perform public.invite_staff('shared@test.invalid', 'Shared', 'nurse');

  perform zz_test.login(u_adminB);
  perform public.invite_staff('doc-b@test.invalid', 'Dr Beta', 'doctor');
  perform zz_test.expect('an email with an open invite elsewhere cannot be invited (vague error)',
    zz_test.raises($q$select public.invite_staff('shared@test.invalid', 'Shared', 'nurse')$q$)
      ilike '%cannot be invited%');
  inviteB := public.invite_staff('pending-b@test.invalid', 'Pending B', 'nurse');

  perform zz_test.login(u_docA);  perform public.claim_invite();
  perform zz_test.login(u_nurseA); perform public.claim_invite();
  perform zz_test.login(u_docB);  perform public.claim_invite();

  perform zz_test.login(u_outsider);
  perform zz_test.expect('claim_invite returns null when there is no invite',
    public.claim_invite() is null);

  perform zz_test.logout();
  select id into sAdminA from public.staff where auth_user_id = u_adminA;
  select id into sDocA   from public.staff where auth_user_id = u_docA;
  select id into sNurseA from public.staff where auth_user_id = u_nurseA;
  select id into sAdminB from public.staff where auth_user_id = u_adminB;
  select id into sDocB   from public.staff where auth_user_id = u_docB;
  select id into wardB   from public.wards where hospital_id = hospB limit 1;
  perform zz_test.expect('claimed staff landed in the inviting hospital with the invited role',
    (select hospital_id from public.staff where id = sDocA) = hospA
    and (select role from public.staff where id = sDocA) = 'doctor'
    and (select hospital_id from public.staff where id = sDocB) = hospB);

  -- ---- Seed clinical data in both hospitals ------------------------------
  perform zz_test.login(u_docA);
  patA := public.admit_patient('Pat Alpha', 50, 'A-101', 'Test dx', 'None recorded', null, sDocA, sNurseA);
  taskA := public.create_task(patA, 'Task A', 'Now', 'urgent');
  medA := public.order_medication(patA, 'MedA', '10 mg', 'Now');
  perform public.add_note(patA, 'Note A');
  perform zz_test.login(u_nurseA);
  r := public.record_vitals(patA, 88, 90, '120/80', 37.0, 16, 'baseline');
  alertA := (r ->> 'alert_id')::uuid;
  perform zz_test.expect('abnormal oxygen (88) raises an urgent alert with default thresholds',
    (r ->> 'abnormal_count')::int = 1 and (r ->> 'status') = 'urgent' and alertA is not null);

  perform zz_test.login(u_docB);
  patB := public.admit_patient('Pat Beta', 60, 'B-201', 'Test dx B', 'None recorded', wardB, sDocB, null);
  taskB := public.create_task(patB, 'Task B');
  medB := public.order_medication(patB, 'MedB', '5 mg');
  noteB := public.add_note(patB, 'Note B');
  r := public.record_vitals(patB, 88, 90, '120/80', 37.0, 16, null);
  alertB := (r ->> 'alert_id')::uuid;

  -- ---- Reads are tenant-scoped ------------------------------------------
  perform zz_test.login(u_docA);
  foreach t in array array['patients','alerts','tasks','medications','notes',
                           'timeline_events','vital_readings','wards','staff'] loop
    execute format('select count(*) from public.%I where hospital_id <> %L', t, hospA) into n;
    execute format('select count(*) from public.%I', t) into n2;
    perform zz_test.expect('doctor A sees no other hospital''s rows in ' || t, n = 0 and n2 > 0,
      format('other=%s own=%s', n, n2));
  end loop;
  select count(*) into n from public.hospitals;
  perform zz_test.expect('doctor A sees exactly one hospital (their own)',
    n = 1 and (select id from public.hospitals) = hospA);
  select count(*) into n from public.patients where id = patB;
  perform zz_test.expect('doctor A cannot select hospital B''s patient by id', n = 0);
  select count(*) into n from public.audit_events;
  perform zz_test.expect('non-admin cannot read the audit log', n = 0);
  select count(*) into n from public.hospital_invites;
  perform zz_test.expect('non-admin cannot read invites', n = 0);

  perform zz_test.login(u_adminA);
  select count(*) into n from public.audit_events where hospital_id <> hospA;
  select count(*) into n2 from public.audit_events;
  perform zz_test.expect('admin A reads only hospital A''s audit log', n = 0 and n2 > 0);
  select count(*) into n from public.hospital_invites where hospital_id <> hospA;
  select count(*) into n2 from public.hospital_invites;
  perform zz_test.expect('admin A reads only hospital A''s invites', n = 0 and n2 > 0);

  -- ---- No direct writes; anon locked out --------------------------------
  perform zz_test.login(u_docA);
  perform zz_test.expect('client cannot insert into patients directly',
    zz_test.raises($q$insert into public.patients (name, age, room, diagnosis) values ('x', 1, 'r', 'd')$q$)
      ilike '%permission denied%');
  perform zz_test.expect('client cannot update patients directly',
    zz_test.raises($q$update public.patients set name = 'hacked'$q$) ilike '%permission denied%');
  perform zz_test.expect('client cannot delete patients directly',
    zz_test.raises($q$delete from public.patients$q$) ilike '%permission denied%');
  perform zz_test.expect('client cannot forge an audit row',
    zz_test.raises($q$insert into public.audit_events (action, entity_type) values ('x', 'y')$q$)
      ilike '%permission denied%');
  perform zz_test.expect('client cannot call internal helper write_audit',
    zz_test.raises(format($q$select public.write_audit(%L, null, 'x', 'x', 'x', null, null, '{}')$q$, hospA))
      ilike '%permission denied%');

  perform zz_test.login_anon();
  perform zz_test.expect('anon cannot read patients',
    zz_test.raises($q$select count(*) from public.patients$q$) ilike '%permission denied%');
  perform zz_test.expect('anon cannot call workflow functions',
    zz_test.raises($q$select public.claim_invite()$q$) ilike '%permission denied%');

  -- ---- Workflow functions refuse another hospital's ids -------------------
  perform zz_test.login(u_docA);
  perform zz_test.expect('record_vitals on a B patient is refused',
    zz_test.raises(format($q$select public.record_vitals(%L, 95, 70, '120/80', 36.8, 16, null)$q$, patB))
      ilike '%not found%');
  perform zz_test.expect('create_task on a B patient is refused',
    zz_test.raises(format($q$select public.create_task(%L, 'x')$q$, patB)) ilike '%not found%');
  perform zz_test.expect('add_note on a B patient is refused',
    zz_test.raises(format($q$select public.add_note(%L, 'x')$q$, patB)) ilike '%not found%');
  perform zz_test.expect('order_medication on a B patient is refused',
    zz_test.raises(format($q$select public.order_medication(%L, 'x', 'y')$q$, patB)) ilike '%not found%');
  perform zz_test.expect('complete_task on a B task is refused',
    zz_test.raises(format($q$select public.complete_task(%L)$q$, taskB)) ilike '%not found%');
  perform zz_test.expect('administer_medication on a B order is refused',
    zz_test.raises(format($q$select public.administer_medication(%L)$q$, medB)) ilike '%not found%');
  perform zz_test.expect('set_alert_status on a B alert is refused',
    zz_test.raises(format($q$select public.set_alert_status(%L, 'resolved')$q$, alertB)) ilike '%not found%');
  perform zz_test.expect('update_patient on a B patient is refused',
    zz_test.raises(format($q$select public.update_patient(%L, 'x', 40, 'r', 'd', null, null, null, null)$q$, patB))
      ilike '%not found%');
  perform zz_test.expect('admit_patient cannot assign a B doctor',
    zz_test.raises(format($q$select public.admit_patient('Z', 30, 'r', 'd', null, null, %L, null)$q$, sDocB))
      ilike '%active doctor%');

  perform zz_test.logout();
  perform zz_test.expect('hospital B data is unchanged after A''s attempts',
    (select oxygen from public.patients where id = patB) = 88
    and (select count(*) from public.vital_readings where patient_id = patB) = 1
    and (select status from public.tasks where id = taskB) = 'open'
    and (select status from public.medications where id = medB) = 'due'
    and (select status from public.alerts where id = alertB) = 'active');

  -- ---- Cross-hospital admin actions --------------------------------------
  perform zz_test.login(u_adminA);
  perform zz_test.expect('admin A cannot edit hospital B staff',
    zz_test.raises(format($q$select public.update_staff(%L, 'x', 'nurse', '', 'X')$q$, sDocB))
      ilike '%not found%');
  perform zz_test.expect('admin A cannot deactivate hospital B staff',
    zz_test.raises(format($q$select public.set_staff_active(%L, false)$q$, sDocB)) ilike '%not found%');
  perform zz_test.expect('admin A cannot revoke a hospital B invite',
    zz_test.raises(format($q$select public.revoke_invite(%L)$q$, inviteB)) ilike '%not found%');
  perform zz_test.expect('admin A cannot rename a hospital B ward',
    zz_test.raises(format($q$select public.rename_ward(%L, 'Hijacked')$q$, wardB)) ilike '%not found%');

  -- ---- Role rules -------------------------------------------------------
  perform zz_test.login(u_nurseA);
  perform zz_test.expect('nurse cannot order medication',
    zz_test.raises(format($q$select public.order_medication(%L, 'x', 'y')$q$, patA)) ilike '%not allowed%');
  perform zz_test.expect('nurse cannot change the care team',
    zz_test.raises(format($q$select public.update_patient(%L, 'Pat Alpha', 50, 'A-101', 'Test dx', null, null, null, null)$q$, patA))
      ilike '%only doctors and admins%');
  perform zz_test.expect('nurse can admit a patient',
    zz_test.raises($q$select public.admit_patient('Nurse Admit', 33, 'A-102', 'dx')$q$) is null);
  perform zz_test.login(u_docA);
  perform zz_test.expect('non-admin cannot invite staff',
    zz_test.raises($q$select public.invite_staff('x@test.invalid', 'X', 'nurse')$q$) ilike '%only hospital admins%');
  perform zz_test.expect('non-admin cannot change hospital settings',
    zz_test.raises($q$select public.update_hospital_settings('Renamed', null)$q$) ilike '%only hospital admins%');

  -- ---- Alert lifecycle ---------------------------------------------------
  perform zz_test.login(u_nurseA);
  perform public.set_alert_status(alertA, 'acknowledged');
  perform public.set_alert_status(alertA, 'resolved');
  perform zz_test.expect('resolving a second time is refused',
    zz_test.raises(format($q$select public.set_alert_status(%L, 'resolved')$q$, alertA)) ilike '%already%');
  perform zz_test.logout();
  perform zz_test.expect('resolving the only open alert returns the patient to stable',
    (select status from public.patients where id = patA) = 'stable');

  -- ---- Per-hospital thresholds ------------------------------------------
  perform zz_test.login(u_adminA);
  perform public.update_hospital_settings(null,
    '{"alertThresholds":{"oxygen":{"urgentBelow":80,"warningBelow":85}}}'::jsonb);
  perform zz_test.expect('unknown settings keys are rejected',
    zz_test.raises($q$select public.update_hospital_settings(null, '{"evil":1}')$q$) ilike '%unknown setting%');

  perform zz_test.login(u_nurseA);
  r := public.record_vitals(patA, 88, 72, '120/80', 36.8, 16, null);
  perform zz_test.expect('hospital A''s custom oxygen threshold makes 88% normal there',
    (r ->> 'abnormal_count')::int = 0);
  r := public.record_vitals(patA, 97, 45, '120/80', 36.8, 16, null);
  perform zz_test.expect('unset thresholds fall back to defaults (heart rate 45 is a warning)',
    (r ->> 'abnormal_count')::int = 1
    and (select message from public.alerts where id = (r ->> 'alert_id')::uuid) like 'Heart rate 45%');

  perform zz_test.login(u_docB);
  r := public.record_vitals(patB, 88, 72, '120/80', 36.8, 16, null);
  perform zz_test.expect('hospital B is unaffected by A''s thresholds (88% is still abnormal)',
    (r ->> 'abnormal_count')::int = 1);

  -- ---- Last-admin guard and deactivation ---------------------------------
  perform zz_test.login(u_adminA);
  perform zz_test.expect('the last active admin cannot be deactivated',
    zz_test.raises(format($q$select public.set_staff_active(%L, false)$q$, sAdminA)) ilike '%at least one active admin%');
  perform zz_test.expect('the last active admin cannot be demoted',
    zz_test.raises(format($q$select public.update_staff(%L, 'Alice Admin', 'doctor', '', 'AA')$q$, sAdminA))
      ilike '%at least one active admin%');
  perform public.set_staff_active(sDocA, false);
  perform zz_test.login(u_docA);
  select count(*) into n from public.patients;
  perform zz_test.expect('a deactivated user sees no data', n = 0);
  perform zz_test.expect('a deactivated user cannot run workflows',
    zz_test.raises(format($q$select public.record_vitals(%L, 97, 72, '120/80', 36.8, 16, null)$q$, patA))
      ilike '%sign in with a hospital account%');

  -- ---- Schema-level guarantee -------------------------------------------
  perform zz_test.logout();
  msg := zz_test.raises(format(
    $q$insert into public.alerts (hospital_id, patient_id, severity, message) values (%L, %L, 'urgent', 'x')$q$,
    hospA, patB));
  perform zz_test.expect('composite FK rejects an alert in A pointing at B''s patient',
    msg ilike '%foreign key%', msg);

  -- ---- Report -----------------------------------------------------------
  select count(*) filter (where not pass), count(*),
         string_agg(name, '; ') filter (where not pass)
    into nf, nt, failed
  from zz_test.results;

  raise exception 'TESTS FINISHED — % passed, % failed. Failed: %. (This error is intentional: it rolls everything back.)',
    nt - nf, nf, coalesce(failed, 'none');
end;
$test$;

-- Only reached if the DO block somehow did not raise.
rollback;
