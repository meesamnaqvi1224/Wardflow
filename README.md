# WardFlow v2

Hospital ward portal demo (Next.js + TypeScript). Fictional patient data only.

The v1 static prototype lives one folder up and remains deployable on its own.

## Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## What works today (no database required)

1. Switch role (Nurse / Doctor / Admin) in the top bar.
2. Open **Maya Patel** (or any patient).
3. **Record vitals** — abnormal values create alerts automatically.
4. Open **Alerts**, acknowledge / resolve as a doctor or nurse.
5. **Reset demo** restores the seed scenario.

Data is held in browser session state until Supabase is connected.

## Phase 3: Supabase (optional next)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run:
   - `supabase/schema.sql`
   - `supabase/seed.sql`
3. Copy `.env.example` → `.env.local` and set:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Client stubs live in `src/lib/supabase/`. Wiring live queries is the next coding step after env vars exist.

## Demo accounts (planned for Phase 4 auth)

- `doctor@wardflow.demo`
- `nurse@wardflow.demo`
- `admin@wardflow.demo`

## Important

This is a demonstration MVP, not production clinical software. Do not enter real patient data.
