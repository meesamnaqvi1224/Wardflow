-- Link Phase 4 demo Auth users to staff rows.
-- Run in the Supabase SQL editor AFTER the three users exist in Authentication.
--
-- Create users first either via:
--   node scripts/setup-demo-auth.mjs
-- or Authentication → Users → Add user (password: WardFlow!demo1)
--
-- Emails:
--   meesamnaqvi1224@gmail.com → doctor-1
--   ahsitmedia@gmail.com → nurse-1
--   meesamseowork@gmail.com  → admin-1

update public.staff s
set auth_user_id = u.id
from auth.users u
where u.email = 'meesamnaqvi1224@gmail.com'
  and s.id = 'doctor-1';

update public.staff s
set auth_user_id = u.id
from auth.users u
where u.email = 'ahsitmedia@gmail.com'
  and s.id = 'nurse-1';

update public.staff s
set auth_user_id = u.id
from auth.users u
where u.email = 'meesamseowork@gmail.com'
  and s.id = 'admin-1';

-- Verify
select s.id, s.name, s.role, s.auth_user_id, u.email
from public.staff s
left join auth.users u on u.id = s.auth_user_id
where s.id in ('doctor-1', 'nurse-1', 'admin-1')
order by s.id;
