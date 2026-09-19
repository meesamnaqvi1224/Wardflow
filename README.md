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

## Android app (v1 remote shell)

The **`mobile/`** folder is a Capacitor Android project that opens the production web app in a WebView.

```bash
cd mobile
npm install
npx cap sync android
npx cap open android
```

See **[mobile/README.md](./mobile/README.md)** for package id (`meesam.wardflow`), URL config, and Play Store notes.

## What works today

1. **Sign in** as doctor / nurse / admin (Phase 4).
2. Open **Maya Patel** (or any patient).
3. **Record vitals** — abnormal values create alerts automatically.
4. Open **Alerts**, acknowledge / resolve as a doctor or nurse.
5. **Tasks** — create and complete care tasks (clinicians).
6. **Medications** — order (doctor) and record administration (nurse/doctor).
7. **Notes** — add clinical notes on a patient record.
8. **Administration** (admin) — staff roster, add/edit staff, reassign care team, audit log.
9. **Settings** — account info + change password (Auth).
10. **My profile** / patient **Edit profile**.
11. **Reset demo** (admin only when signed in) restores the seed scenario.
12. Banner shows signed-in role + **Live Supabase** when connected.

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
# DEMO_PASSWORD is required: pick your own unique password (12+ chars)
DEMO_PASSWORD='<your own password>' node scripts/setup-demo-auth.mjs
```

6. Apply Phase 4 RLS (authenticated staff only):

   - Run `supabase/phase4_auth.sql` in the SQL editor.
   - Run `supabase/phase4_profile_edit.sql` so staff can edit their own profile.

7. Optional Phase 5 SaaS foundation:

   - Run `supabase/phase5_multi_hospital.sql` after Phase 4 is working.
   - This adds `hospitals`, backfills the current demo as one hospital, adds
     `hospital_id` to ward tables, and scopes RLS so staff only see their own
     hospital's data.
   - Then run `supabase/phase5b_tenant_integrity.sql` (composite foreign keys so
     rows cannot reference another hospital's patients/staff, plus an audit-actor
     check). It is untested against a live database; run it on a copy first.

Data layer: `src/lib/supabase/ward.ts` (load, record vitals, alert status, reset).

## Demo accounts (Phase 4)

| Email | Staff | Role |
|-------|--------|------|
| `doctor@example.com` | Dr. Sarah Khan (`doctor-1`) | doctor |
| `nurse@example.com` | Nurse Alex Morgan (`nurse-1`) | nurse |
| `admin@example.com` | Jordan Lee (`admin-1`) | admin |

The password is whatever you pass as `DEMO_PASSWORD` to the setup script; there
is no default. Never reuse it for real accounts, and remove these demo accounts
before putting any real data in the project.

If the setup script hits **email rate limit**, wait a few minutes and re-run, or create the three users in **Authentication → Users** and run `supabase/phase4_link_demo_users.sql`.

## Phase 4 notes

- Middleware protects all routes except `/login` when Supabase is configured.
- Acting staff comes from `staff.auth_user_id` → no role dropdown when signed in.
- RLS requires a linked staff row; unlinked accounts see an error, not ward data.
- Admin-only: Administration nav, demo reset.

## Phase 5 notes

- Hospitals are the SaaS tenant boundary.
- Every staff, patient, alert, task, medication, note, timeline event, vital
  reading, and audit event receives a `hospital_id`.
- Supabase RLS uses the signed-in staff profile to resolve
  `current_hospital_id()`, then filters all ward data to that hospital.
- The prototype still uses text ids for compatibility. Before real multi-site
  onboarding, patient/staff creation should use generated UUIDs or
  hospital-scoped public codes to avoid duplicate ids across hospitals.

## Important

This is a demonstration MVP, not production clinical software. Do not enter real patient data.
