# WardFlow v2

Hospital ward portal demo (Next.js + TypeScript). Fictional patient data only.

The v1 static prototype lives one folder up and remains deployable on its own.

## Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## What works today

1. Switch role (Nurse / Doctor / Admin) in the top bar.
2. Open **Maya Patel** (or any patient).
3. **Record vitals** — abnormal values create alerts automatically.
4. Open **Alerts**, acknowledge / resolve as a doctor or nurse.
5. **Reset demo** restores the seed scenario.
6. Banner shows **Live Supabase** when `.env.local` is configured.

With Supabase configured, vitals, alerts, and timeline events persist in the database and reload after refresh.

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

Data layer: `src/lib/supabase/ward.ts` (load, record vitals, alert status, reset).

## Demo accounts (planned for Phase 4 auth)

- `doctor@wardflow.demo`
- `nurse@wardflow.demo`
- `admin@wardflow.demo`

## Important

This is a demonstration MVP, not production clinical software. Do not enter real patient data.
