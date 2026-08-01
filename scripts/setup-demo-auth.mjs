#!/usr/bin/env node
/**
 * Create Phase 4 demo Auth users and link them to staff rows.
 *
 * Prerequisites:
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - Email confirmations disabled (Authentication → Providers → Email),
 *     OR confirm users manually in the dashboard after this script runs
 *   - Run BEFORE applying phase4_auth.sql (needs open write on staff),
 *     OR re-run with a service role key (not stored in this repo)
 *
 * Usage:
 *   node scripts/setup-demo-auth.mjs
 *   DEMO_PASSWORD='YourSecurePass1!' node scripts/setup-demo-auth.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const env = {};
  try {
    const text = readFileSync(resolve(root, ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* ignore */
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password = process.env.DEMO_PASSWORD || "WardFlow!demo1";

// Use example.com — Supabase rejects many fake TLDs (e.g. .demo).
const ACCOUNTS = [
  {
    email: "doctor@example.com",
    staffId: "doctor-1",
    name: "Dr. Sarah Khan",
  },
  {
    email: "nurse@example.com",
    staffId: "nurse-1",
    name: "Nurse Alex Morgan",
  },
  {
    email: "admin@example.com",
    staffId: "admin-1",
    name: "Jordan Lee",
  },
];

if (!url || !anon) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("Project:", new URL(url).host);
console.log("Password for all demo accounts:", password);
console.log("");

const results = [];

for (const account of ACCOUNTS) {
  const row = { email: account.email, staffId: account.staffId, steps: [] };

  // Prefer sign-in (user may already exist)
  let userId = null;
  const signIn = await sb.auth.signInWithPassword({
    email: account.email,
    password,
  });

  if (signIn.data?.user) {
    userId = signIn.data.user.id;
    row.steps.push("signed_in_existing");
  } else {
    const signUp = await sb.auth.signUp({
      email: account.email,
      password,
      options: {
        data: { full_name: account.name, staff_id: account.staffId },
      },
    });
    if (signUp.error) {
      row.error = `signUp/signIn failed: ${signUp.error.message} (signIn: ${signIn.error?.message ?? "n/a"})`;
      results.push(row);
      console.log(`FAIL ${account.email}: ${row.error}`);
      continue;
    }
    userId = signUp.data.user?.id ?? null;
    row.steps.push(signUp.data.session ? "signed_up" : "signed_up_needs_confirm");
    if (!signUp.data.session) {
      row.warning =
        "No session returned — enable “Confirm email” off in Auth settings, or confirm the user, then re-run.";
    }
  }

  if (!userId) {
    row.error = "No user id after sign-up/sign-in";
    results.push(row);
    console.log(`FAIL ${account.email}: ${row.error}`);
    continue;
  }

  row.userId = userId;

  // Link staff.auth_user_id (requires open demo policy or service role)
  const { data: updated, error: linkError } = await sb
    .from("staff")
    .update({ auth_user_id: userId })
    .eq("id", account.staffId)
    .select("id, name, role, auth_user_id")
    .maybeSingle();

  if (linkError) {
    row.error = `link staff failed: ${linkError.message}`;
    results.push(row);
    console.log(`FAIL ${account.email}: ${row.error}`);
    // still sign out
    await sb.auth.signOut();
    continue;
  }

  if (!updated) {
    row.error = `staff row ${account.staffId} not found or RLS blocked update`;
    results.push(row);
    console.log(`FAIL ${account.email}: ${row.error}`);
    await sb.auth.signOut();
    continue;
  }

  row.linked = updated;
  row.steps.push("linked_staff");
  results.push(row);
  console.log(`OK   ${account.email} → ${account.staffId} (${userId})`);

  await sb.auth.signOut();
}

console.log("\n=== Summary ===");
const ok = results.filter((r) => r.linked && !r.error).length;
console.log(`${ok}/${ACCOUNTS.length} accounts ready`);
for (const r of results) {
  if (r.warning) console.log(`WARN ${r.email}: ${r.warning}`);
}

if (ok === ACCOUNTS.length) {
  console.log(`
Next:
  1. In Supabase SQL editor, run supabase/phase4_auth.sql
  2. Sign in at /login with:
       doctor@example.com / ${password}
       nurse@example.com  / ${password}
       admin@example.com  / ${password}
`);
  process.exit(0);
}

console.log("\nSome accounts failed. Fix Auth settings or link auth_user_id manually, then re-run.");
process.exit(2);
