-- WardFlow v2 multi-hospital schema — step 2 of 3 (signup, invites, admin)
--
-- Run AFTER 01_schema.sql, on the same fresh project/branch.
--
-- Self-serve flow, all through Supabase Auth + these functions (no service-role
-- key, no server of our own):
--   1. A person signs up and verifies their email (Supabase Auth).
--   2a. New hospital: they call create_hospital() and become its first admin.
--   2b. Invited staff: they call claim_invite() and join the inviting hospital
--       with the role they were invited as.
--   3. Admins manage staff, invites, wards and settings with the functions
--      below. Clients cannot write tables directly (see 01_schema.sql).
--
-- REQUIRES Supabase Auth "Confirm email" to be ON. Both create_hospital and
-- claim_invite refuse unverified emails, but Auth must not auto-confirm or an
-- attacker could sign up with someone else's email and claim their invite.
-- Also enable a captcha / rate limits in Auth settings; create_hospital is
-- callable by any verified user.
--
-- All functions are security definer with a pinned search_path. The ones a
-- client may call are granted to `authenticated` only; internal helpers are
-- not callable through the API at all.

-- ---------------------------------------------------------------------------
-- Internal helpers (not exposed to API roles)
-- ---------------------------------------------------------------------------

-- Default per-hospital settings. alertThresholds mirrors the rules that
-- evaluateVitals() applies in the app today; 03_workflows.sql will evaluate
-- readings against the hospital's own copy.
create function public.default_hospital_settings()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'timezone', 'UTC',
    'alertThresholds', jsonb_build_object(
      'oxygen',      jsonb_build_object('urgentBelow', 90, 'warningBelow', 95),
      'heartRate',   jsonb_build_object('urgentLow', 40, 'urgentHigh', 130,
                                        'warningLow', 50, 'warningHigh', 100),
      'temperature', jsonb_build_object('urgentAbove', 39.5, 'warningAbove', 38),
      'respiratory', jsonb_build_object('urgentLow', 8, 'urgentHigh', 30,
                                        'warningLow', 10, 'warningHigh', 22)
    )
  );
$$;

-- "Maya Patel" -> "MP" (first letters of the first two words, max 3 chars).
create function public.make_initials(p_name text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      upper(left(
        (select string_agg(left(w, 1), '')
         from (select w from regexp_split_to_table(btrim(p_name), '\s+') as w limit 2) s),
        3)),
      ''),
    '?'
  );
$$;

create function public.write_audit(
  p_hospital_id uuid,
  p_actor_id uuid,
  p_actor_name text,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_patient_id uuid,
  p_detail jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_events
    (hospital_id, actor_id, actor_name, action, entity_type, entity_id,
     patient_id, detail)
  values
    (p_hospital_id, p_actor_id, p_actor_name, p_action, p_entity_type,
     p_entity_id, p_patient_id, coalesce(p_detail, '{}'::jsonb));
$$;

-- Returns the caller's staff row, raising unless they are an active admin.
create function public.require_admin()
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
  if not found or v.role <> 'admin' then
    raise exception 'Only hospital admins can do this.';
  end if;
  return v;
end;
$$;

-- Verified email of the calling auth user, lower-cased. Raises if the user is
-- signed out or has not confirmed their email.
create function public.verified_caller_email()
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_confirmed timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  select lower(btrim(email)), email_confirmed_at
    into v_email, v_confirmed
  from auth.users where id = auth.uid();
  if v_email is null or v_confirmed is null then
    raise exception 'Verify your email address first.';
  end if;
  return v_email;
end;
$$;

revoke all on function public.default_hospital_settings() from public, anon, authenticated;
revoke all on function public.make_initials(text) from public, anon, authenticated;
revoke all on function public.write_audit(uuid, uuid, text, text, text, uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.require_admin() from public, anon, authenticated;
revoke all on function public.verified_caller_email() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Signup: create a hospital / claim an invite
-- ---------------------------------------------------------------------------

-- The caller becomes the first admin of a brand-new hospital. Returns the new
-- hospital id.
create function public.create_hospital(
  p_hospital_name text,
  p_admin_name text,
  p_ward_name text default 'Main Ward'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.verified_caller_email();
  v_name text := btrim(coalesce(p_hospital_name, ''));
  v_admin text := btrim(coalesce(p_admin_name, ''));
  v_ward text := coalesce(nullif(btrim(p_ward_name), ''), 'Main Ward');
  v_base text;
  v_slug text;
  v_hospital uuid;
  v_staff uuid;
begin
  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'Hospital name must be 2 to 120 characters.';
  end if;
  if v_admin = '' then
    raise exception 'Your name is required.';
  end if;
  if exists (select 1 from public.staff where auth_user_id = auth.uid()) then
    raise exception 'This account already belongs to a hospital.';
  end if;
  if exists (select 1 from public.hospital_invites
             where email = v_email and status = 'pending') then
    raise exception 'You have a pending invitation. Accept it instead of creating a new hospital.';
  end if;

  -- URL-safe slug from the name plus a random suffix so it is always unique.
  v_base := left(trim(both '-' from
              regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')), 30);
  if v_base = '' then v_base := 'hospital'; end if;
  v_slug := v_base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.hospitals (name, slug, settings, created_by)
  values (v_name, v_slug, public.default_hospital_settings(), auth.uid())
  returning id into v_hospital;

  insert into public.wards (hospital_id, name) values (v_hospital, left(v_ward, 80));

  insert into public.staff (hospital_id, auth_user_id, name, role, initials)
  values (v_hospital, auth.uid(), v_admin, 'admin', public.make_initials(v_admin))
  returning id into v_staff;

  perform public.write_audit(v_hospital, v_staff, v_admin, 'create_hospital',
    'hospital', v_hospital, null, jsonb_build_object('name', v_name));

  return v_hospital;
end;
$$;

-- Links the caller to the hospital that invited their verified email. Returns
-- the staff id, or null if there is no pending invitation. Safe to call on
-- every login: if the caller already has a staff row it just returns that id.
create function public.claim_invite()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.verified_caller_email();
  v_existing uuid;
  v_invite public.hospital_invites;
  v_staff uuid;
begin
  select id into v_existing from public.staff where auth_user_id = auth.uid();
  if v_existing is not null then
    return v_existing;
  end if;

  select * into v_invite from public.hospital_invites
  where email = v_email and status = 'pending'
  for update;
  if not found then
    return null;
  end if;

  insert into public.staff
    (hospital_id, auth_user_id, name, role, detail, initials)
  values
    (v_invite.hospital_id, auth.uid(), v_invite.name, v_invite.role,
     v_invite.detail, v_invite.initials)
  returning id into v_staff;

  update public.hospital_invites
  set status = 'claimed', claimed_at = now()
  where id = v_invite.id;

  perform public.write_audit(v_invite.hospital_id, v_staff, v_invite.name,
    'claim_invite', 'staff', v_staff, null,
    jsonb_build_object('role', v_invite.role));

  return v_staff;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: staff and invites
-- ---------------------------------------------------------------------------

create function public.invite_staff(
  p_email text,
  p_name text,
  p_role public.staff_role,
  p_detail text default '',
  p_initials text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.staff := public.require_admin();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if v_email = '' or v_email not like '%@%' then
    raise exception 'A valid email is required.';
  end if;
  if v_name = '' then
    raise exception 'A name is required.';
  end if;

  begin
    insert into public.hospital_invites
      (hospital_id, email, name, role, detail, initials, invited_by)
    values
      (v_admin.hospital_id, v_email, v_name, p_role, btrim(coalesce(p_detail, '')),
       upper(left(coalesce(nullif(btrim(p_initials), ''),
                           public.make_initials(v_name)), 3)),
       v_admin.id)
    returning id into v_id;
  exception when unique_violation then
    -- Deliberately vague: do not reveal whether the email has an open invite
    -- from a different hospital.
    raise exception 'This email cannot be invited right now.';
  end;

  perform public.write_audit(v_admin.hospital_id, v_admin.id, v_admin.name,
    'invite_staff', 'invite', v_id, null,
    jsonb_build_object('email', v_email, 'role', p_role));
  return v_id;
end;
$$;

create function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.staff := public.require_admin();
begin
  update public.hospital_invites
  set status = 'revoked'
  where id = p_invite_id
    and hospital_id = v_admin.hospital_id
    and status = 'pending';
  if not found then
    raise exception 'Invitation not found.';
  end if;
  perform public.write_audit(v_admin.hospital_id, v_admin.id, v_admin.name,
    'revoke_invite', 'invite', p_invite_id, null, '{}'::jsonb);
end;
$$;

-- Edit a staff member's display fields and role. Refuses to remove the
-- hospital's last active admin.
create function public.update_staff(
  p_staff_id uuid,
  p_name text,
  p_role public.staff_role,
  p_detail text,
  p_initials text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.staff := public.require_admin();
  v_target public.staff;
  v_name text := btrim(coalesce(p_name, ''));
  v_initials text := upper(left(btrim(coalesce(p_initials, '')), 3));
begin
  if v_name = '' or v_initials = '' then
    raise exception 'Name and initials are required.';
  end if;

  select * into v_target from public.staff
  where id = p_staff_id and hospital_id = v_admin.hospital_id;
  if not found then
    raise exception 'Staff member not found.';
  end if;

  if v_target.role = 'admin' and p_role <> 'admin' and v_target.active then
    -- Lock the admin rows so two simultaneous demotions cannot both pass.
    perform 1 from public.staff
    where hospital_id = v_admin.hospital_id and role = 'admin' and active
    for update;
    if not exists (select 1 from public.staff
                   where hospital_id = v_admin.hospital_id and role = 'admin'
                     and active and id <> v_target.id) then
      raise exception 'A hospital must keep at least one active admin.';
    end if;
  end if;

  update public.staff
  set name = v_name, role = p_role, detail = btrim(coalesce(p_detail, '')),
      initials = v_initials
  where id = v_target.id;

  perform public.write_audit(v_admin.hospital_id, v_admin.id, v_admin.name,
    'update_staff', 'staff', v_target.id, null,
    jsonb_build_object('role', p_role, 'previous_role', v_target.role));
end;
$$;

-- Deactivate (or reactivate) a staff member. Deactivated staff keep their
-- history but lose all access immediately.
create function public.set_staff_active(p_staff_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.staff := public.require_admin();
  v_target public.staff;
begin
  select * into v_target from public.staff
  where id = p_staff_id and hospital_id = v_admin.hospital_id;
  if not found then
    raise exception 'Staff member not found.';
  end if;

  if not p_active and v_target.role = 'admin' and v_target.active then
    perform 1 from public.staff
    where hospital_id = v_admin.hospital_id and role = 'admin' and active
    for update;
    if not exists (select 1 from public.staff
                   where hospital_id = v_admin.hospital_id and role = 'admin'
                     and active and id <> v_target.id) then
      raise exception 'A hospital must keep at least one active admin.';
    end if;
  end if;

  update public.staff set active = p_active where id = v_target.id;

  perform public.write_audit(v_admin.hospital_id, v_admin.id, v_admin.name,
    case when p_active then 'reactivate_staff' else 'deactivate_staff' end,
    'staff', v_target.id, null, '{}'::jsonb);
end;
$$;

-- Any active staff member edits their own display fields (never role).
create function public.update_my_profile(
  p_name text,
  p_detail text,
  p_initials text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_staff_id();
  v_name text := btrim(coalesce(p_name, ''));
  v_initials text := upper(left(btrim(coalesce(p_initials, '')), 3));
begin
  if v_me is null then
    raise exception 'Sign in first.';
  end if;
  if v_name = '' or v_initials = '' then
    raise exception 'Name and initials are required.';
  end if;
  update public.staff
  set name = v_name, detail = btrim(coalesce(p_detail, '')), initials = v_initials
  where id = v_me;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: hospital settings and wards
-- ---------------------------------------------------------------------------

-- Rename the hospital and/or merge settings. Only known top-level keys are
-- accepted, so a client cannot stash arbitrary data in the tenant record.
create function public.update_hospital_settings(
  p_name text default null,
  p_settings jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.staff := public.require_admin();
  v_key text;
begin
  if p_name is not null then
    if length(btrim(p_name)) < 2 or length(btrim(p_name)) > 120 then
      raise exception 'Hospital name must be 2 to 120 characters.';
    end if;
  end if;

  if p_settings is not null then
    if jsonb_typeof(p_settings) <> 'object' then
      raise exception 'Settings must be a JSON object.';
    end if;
    for v_key in select jsonb_object_keys(p_settings) loop
      if v_key not in ('timezone', 'alertThresholds') then
        raise exception 'Unknown setting: %', v_key;
      end if;
    end loop;
    if p_settings ? 'alertThresholds'
       and jsonb_typeof(p_settings -> 'alertThresholds') <> 'object' then
      raise exception 'alertThresholds must be an object.';
    end if;
    if p_settings ? 'timezone'
       and (jsonb_typeof(p_settings -> 'timezone') <> 'string'
            or not exists (select 1 from pg_timezone_names
                           where name = p_settings ->> 'timezone')) then
      raise exception 'Unknown timezone.';
    end if;
  end if;

  update public.hospitals
  set name = coalesce(nullif(btrim(p_name), ''), name),
      settings = settings || coalesce(p_settings, '{}'::jsonb)
  where id = v_admin.hospital_id;

  perform public.write_audit(v_admin.hospital_id, v_admin.id, v_admin.name,
    'update_hospital_settings', 'hospital', v_admin.hospital_id, null,
    jsonb_build_object('name', p_name, 'settings', p_settings));
end;
$$;

create function public.create_ward(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.staff := public.require_admin();
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if v_name = '' or length(v_name) > 80 then
    raise exception 'Ward name must be 1 to 80 characters.';
  end if;
  begin
    insert into public.wards (hospital_id, name)
    values (v_admin.hospital_id, v_name)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'A ward with that name already exists.';
  end;
  perform public.write_audit(v_admin.hospital_id, v_admin.id, v_admin.name,
    'create_ward', 'ward', v_id, null, jsonb_build_object('name', v_name));
  return v_id;
end;
$$;

create function public.rename_ward(p_ward_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.staff := public.require_admin();
  v_name text := btrim(coalesce(p_name, ''));
  v_rows int;
begin
  if v_name = '' or length(v_name) > 80 then
    raise exception 'Ward name must be 1 to 80 characters.';
  end if;
  begin
    update public.wards set name = v_name
    where id = p_ward_id and hospital_id = v_admin.hospital_id;
    get diagnostics v_rows = row_count;
  exception when unique_violation then
    raise exception 'A ward with that name already exists.';
  end;
  if v_rows = 0 then
    raise exception 'Ward not found.';
  end if;
  perform public.write_audit(v_admin.hospital_id, v_admin.id, v_admin.name,
    'rename_ward', 'ward', p_ward_id, null, jsonb_build_object('name', v_name));
end;
$$;

-- ---------------------------------------------------------------------------
-- API grants: signed-in users only
-- ---------------------------------------------------------------------------

revoke all on function public.create_hospital(text, text, text) from public, anon;
revoke all on function public.claim_invite() from public, anon;
revoke all on function public.invite_staff(text, text, public.staff_role, text, text) from public, anon;
revoke all on function public.revoke_invite(uuid) from public, anon;
revoke all on function public.update_staff(uuid, text, public.staff_role, text, text) from public, anon;
revoke all on function public.set_staff_active(uuid, boolean) from public, anon;
revoke all on function public.update_my_profile(text, text, text) from public, anon;
revoke all on function public.update_hospital_settings(text, jsonb) from public, anon;
revoke all on function public.create_ward(text) from public, anon;
revoke all on function public.rename_ward(uuid, text) from public, anon;

grant execute on function public.create_hospital(text, text, text) to authenticated;
grant execute on function public.claim_invite() to authenticated;
grant execute on function public.invite_staff(text, text, public.staff_role, text, text) to authenticated;
grant execute on function public.revoke_invite(uuid) to authenticated;
grant execute on function public.update_staff(uuid, text, public.staff_role, text, text) to authenticated;
grant execute on function public.set_staff_active(uuid, boolean) to authenticated;
grant execute on function public.update_my_profile(text, text, text) to authenticated;
grant execute on function public.update_hospital_settings(text, jsonb) to authenticated;
grant execute on function public.create_ward(text) to authenticated;
grant execute on function public.rename_ward(uuid, text) to authenticated;
