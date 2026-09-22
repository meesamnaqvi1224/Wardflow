# WardFlow v2 — multi-hospital

Multi-tenant hospital ward portal (Next.js + TypeScript + Supabase). Each
hospital signs up, manages its own staff and patients, and never sees another
hospital's data. Fictional / test data only until the checklist in
[Before real patient data](#before-real-patient-data) is done.

The v1 static prototype lives one folder up and remains deployable on its own.
This branch (`v2-multi-hospital`) replaces the single-hospital v2 demo that
lived on `main`; see [Migrating from the old single-hospital setup](#migrating-from-the-old-single-hospital-setup)
if you have that running already.

## How it works

- **One Supabase project serves every hospital.** Every table carries a
  `hospital_id`; Row Level Security limits every read to the signed-in user's
  own hospital, and composite foreign keys stop a row in one hospital from
  referencing another hospital's patients or staff.
- **The client never writes tables directly.** Every save (recording vitals,
  creating a task, inviting staff, …) calls a Postgres function that checks the
  caller's role, runs in one transaction, and writes its own audit and
  timeline rows. See `src/lib/supabase/ward.ts` for the full list.
- **Onboarding is self-serve.** Someone signs up, verifies their email, and
  either creates a hospital (becoming its first admin) or is invited to an
  existing one. There is no service-role key or server of our own involved.
- **Ids are UUIDs.** Two hospitals can never collide on an id, unlike the old
  single-hospital schema's text ids.

## Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Without Supabase
configured, the app shows a "Supabase is not configured" notice instead of the
ward portal — this version has no offline seed mode.

## Set up a Supabase project

Use a **fresh** project or a throwaway scratch project — the SQL in
`supabase/v2/` creates the schema from nothing and does not migrate the old
`supabase/schema.sql` / `phase4_*` / `phase5*` files. Don't run it against a
project that has those applied already.

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run these files **in order**:
   1. `supabase/v2/01_schema.sql` — tables, enums, indexes, read-only RLS.
   2. `supabase/v2/02_onboarding.sql` — sign-up, invites, staff/hospital admin
      functions.
   3. `supabase/v2/03_workflows.sql` — the clinical functions (vitals, alerts,
      tasks, medications, notes, patients).
   4. `supabase/v2/04_isolation_tests.sql` — optional but recommended. Creates
      two fake hospitals inside a transaction, runs ~40 cross-hospital
      isolation checks, then rolls everything back. It ends with an
      intentional error whose message is the report:
      `TESTS FINISHED — N passed, 0 failed.` If it stops with a different
      error instead, that's a real problem in 01–03; run `rollback;` once to
      clear the aborted transaction before retrying.
3. In **Authentication → Providers → Email**, turn **on** "Confirm email".
   Invites are matched by verified email address, so this must be on before
   anyone signs up.
4. In **Authentication → URL Configuration**, set the **Site URL** and add
   your app's URL (and `http://localhost:3000` for local dev) to the
   **Redirect URLs** — the confirmation link sends people back there.
5. Turn on a CAPTCHA and rate limits for sign-up (**Authentication → Attack
   Protection**). Any verified user can create a hospital.
6. Copy `.env.example` → `.env.local` and set:

   ```text
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   ```

   Use the **anon / publishable** key only, never the service-role key.

7. Supabase's built-in email sender only reaches a handful of addresses an
   hour and mostly your own project team — it is not enough for real sign-ups.
   Before inviting real users, connect a proper provider (Resend, Postmark,
   …) under **Project Settings → Auth → SMTP Settings**.

## Using it

1. Open the app, go to **Sign up**, and create an account with a real email
   you can verify.
2. Click the confirmation link, then sign in.
3. You'll land on **Create your hospital** — enter its name, your name, and a
   first ward. You become that hospital's first admin.
4. As admin: **Administration → Invite staff** creates a pending invitation
   (email + name + role). WardFlow does not send an email for this yet — the
   drawer shows a sign-up link to send the person yourself. They join your
   hospital automatically once they sign up with that exact email and verify
   it.
5. **Hospital settings** (admin only): rename the hospital, set its time
   zone, tune the vitals thresholds that raise alerts, and manage wards.
6. **My patients → Admit patient** (any clinician or admin) adds a patient.
   Record vitals from the patient page — abnormal values (checked against
   *this hospital's* thresholds) create an alert and a timeline entry
   automatically.
7. Tasks, medications, notes, and the alert lifecycle (acknowledge/resolve)
   work the same way as the v1 demo; see the in-app pages.
8. A hospital's administrator can deactivate staff (they keep their history
   but lose access immediately) and read the audit log.

Role permissions, matching the database functions:

| Action | doctor | nurse | admin |
|---|---|---|---|
| Record vitals, acknowledge/resolve alerts, administer medication | ✓ | ✓ | |
| Order medication | ✓ | | |
| Create task, add note, admit patient | ✓ | ✓ | ✓ |
| Change a patient's ward/care team | ✓ | | ✓ |
| Invite/edit/deactivate staff, hospital settings, audit log | | | ✓ |

## Testing

```bash
pnpm lint
pnpm build
```

`supabase/v2/04_isolation_tests.sql` (above) checks the database layer.
`scripts/e2e/flow.ts` drives the real app code (`src/lib/supabase/ward.ts`)
over the live Supabase API — sign-up, hospital creation, invites, every
clinical workflow, and cross-hospital isolation — using real logins rather
than simulated ones. Run it against a **scratch** project only:

1. Apply `01`–`03` (not `04`) to a scratch project.
2. Create confirmed test users for the emails the script expects — see the
   comment at the top of `scripts/e2e/flow.ts`.
3. Run:

   ```bash
   E2E_URL=https://<ref>.supabase.co \
   E2E_ANON_KEY=<anon key> \
   E2E_PASSWORD=<the test users' shared password> \
   pnpm test:e2e
   ```

Delete the scratch project when you're done; there's no cleanup script.

## Known limitations

- **One hospital per account.** A person who works at two hospitals needs two
  separate accounts.
- **Invites are manual.** No email is sent automatically; the admin copies a
  sign-up link to the invitee. See `src/components/admin/StaffFormDrawer.tsx`.
- **One open invite per email, across all hospitals.** A second hospital
  cannot invite an email that already has a pending invite elsewhere.
- **`output: "export"` (see `next.config.ts`).** The app is built as a static
  export so the Android shell in `mobile/` can bundle it, which means
  Next.js middleware does not run — `src/middleware.ts` is effectively dead
  code, and the redirect to `/login` happens client-side. RLS, not
  middleware, is what actually protects the data. Patient pages use a
  `/patient?id=…` query-param route rather than a dynamic segment for the
  same reason.
- No billing, plans are not enforced, and there is no platform-level
  super-admin across hospitals.

## Migrating from the old single-hospital setup

If you have a Supabase project running the old `supabase/schema.sql` /
`phase4_*` / `phase5*` files (the version that shipped from `main`), this
branch does **not** migrate it — the id types changed from text to UUID and
the write path moved from direct table access to database functions. Point
this branch at a new project instead. There is no automated data migration
from the old demo data.

## Before real patient data

This is still a demo/MVP. Before it holds anything real:

- Complete the Supabase Auth hardening above (confirm email, redirect URLs,
  CAPTCHA, real SMTP) and turn on MFA for admin accounts.
- Get a signed data-processing agreement with Supabase and confirm your
  hosting region meets your compliance needs (HIPAA, India's DPDP Act, or
  whatever applies to your hospitals).
- Remove or restrict the demo banner (`src/components/layout/DemoBanner.tsx`).
- Have a lawyer review the above — this is not legal advice.

## Android app (v1 remote shell)

The **`mobile/`** folder is a Capacitor Android project that opens the
production web app in a WebView. It has not been tested against this
multi-hospital branch's sign-up/invite flow.

```bash
cd mobile
npm install
npx cap sync android
npx cap open android
```

See **[mobile/README.md](./mobile/README.md)** for package id
(`meesam.wardflow`), URL config, and Play Store notes.

## Important

This is a demonstration MVP, not production clinical software. Do not enter
real patient data until the checklist above is done.
