// Registers the module hooks that let Node run the app's own TypeScript data
// layer (src/lib/supabase/ward.ts) unchanged: it resolves the "@/..." alias and
// extension-less relative imports, and swaps the browser Supabase client for a
// test client. Used only by scripts/e2e/flow.ts.
import { register } from "node:module";
register("./hooks.mjs", import.meta.url);
