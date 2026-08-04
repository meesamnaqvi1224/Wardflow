-- WardFlow — allow care-team members to edit their own staff profile
-- and keep patient profile updates on the existing clinician write policies.
-- Run in Supabase SQL editor after phase4_auth.sql.

-- Staff may update their own row (name / detail / initials).
drop policy if exists "staff_update_own" on staff;
create policy "staff_update_own" on staff
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Block non-admins from changing role or auth linkage on staff.
create or replace function public.staff_guard_privilege()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' then
    if (NEW.role is distinct from OLD.role
        or NEW.auth_user_id is distinct from OLD.auth_user_id
        or NEW.id is distinct from OLD.id)
       and not public.is_admin() then
      raise exception 'Only admins can change staff role, id, or auth linkage';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists staff_guard_privilege_trg on staff;
create trigger staff_guard_privilege_trg
  before update on staff
  for each row
  execute function public.staff_guard_privilege();
