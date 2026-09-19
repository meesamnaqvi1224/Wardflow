import type { SupabaseClient } from "@supabase/supabase-js";

// Stand-in for src/lib/supabase/client.ts. The e2e flow signs in as different
// users and switches which client the app's data layer (ward.ts) talks through.
let current: SupabaseClient | null = null;

export function setCurrentClient(client: SupabaseClient | null): void {
  current = client;
}

export function createSupabaseBrowserClient(): SupabaseClient | null {
  return current;
}

export function isSupabaseConfigured(): boolean {
  return true;
}
