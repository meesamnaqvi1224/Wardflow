# WardFlow v2

Hospital ward portal demo (Next.js + TypeScript). Fictional patient data only.

The v1 static prototype lives one folder up and remains deployable on its own.

## Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

With Supabase configured you will be redirected to **`/login`**.

## What works today

1. **Sign in** as doctor / nurse / admin (Phase 4).
2. Open **Maya Patel** (or any patient).
3. **Record vitals** — abnormal values create alerts automatically.
4. Open **Alerts**, acknowledge / resolve as a doctor or nurse.
5. **Tasks** — create and complete care tasks (clinicians).
6. **Medications** — order (doctor) and record administration (nurse/doctor).
7. **Notes** — add clinical notes on a patient record.
8. **Administration** (admin) — staff roster + reassign doctors/nurses.
9. **My profile** / patient **Edit profile**.
10. **Reset demo** (admin only when signed in) restores the seed scenario.
11. Banner shows signed-in role + **Live Supabase** when connected.

Without Supabase env vars, the app runs in **offline seed mode** with a demo role switcher (no login).

## Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run:
   - `supabase/schema.sql` (or `supabase/apply_all.sql`)
   - `supabase/seed.sql` (if not included in apply_all)
3. Copy `.env.example` → `.env.local` and set:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Use the **anon / publishable** key only (not service_role).

4. In Supabase **Authentication → Providers → Email**, turn **off** “Confirm email” for local demo (or confirm users manually).
5. Create demo users and link them to staff:

```bash
node scripts/setup-demo-auth.mjs
# optional custom password:
# DEMO_PASSWORD='YourSecurePass1!' node scripts/setup-demo-auth.mjs
```

6. Apply Phase 4 RLS (authenticated staff only):

   - Run `supabase/phase4_auth.sql` in the SQL editor.
   - Run `supabase/phase4_profile_edit.sql` so staff can edit their own profile.

Data layer: `src/lib/supabase/ward.ts` (load, record vitals, alert status, reset).

## Demo accounts (Phase 4)

| Email | Staff | Role |
|-------|--------|------|
| `doctor@example.com` | Dr. Sarah Khan (`doctor-1`) | doctor |
| `nurse@example.com` | Nurse Alex Morgan (`nurse-1`) | nurse |
| `admin@example.com` | Jordan Lee (`admin-1`) | admin |

Default shared password (from setup script): **`WardFlow!demo1`**

Change it with `DEMO_PASSWORD=...` when running the setup script.

If the setup script hits **email rate limit**, wait a few minutes and re-run, or create the three users in **Authentication → Users** and run `supabase/phase4_link_demo_users.sql`.

## Phase 4 notes

- Middleware protects all routes except `/login` when Supabase is configured.
- Acting staff comes from `staff.auth_user_id` → no role dropdown when signed in.
- RLS requires a linked staff row; unlinked accounts see an error, not ward data.
- Admin-only: Administration nav, demo reset.

## Important

This is a demonstration MVP, not production clinical software. Do not enter real patient data.
