// Entry point Playwright runs to serve the stand-in Supabase (see fake-supabase.mjs).
import { startFakeSupabase } from "./fake-supabase.mjs";

await startFakeSupabase();
