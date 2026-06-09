import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Fallbacks keep deployed previews working if environment variables were not
// configured in the hosting provider yet. These values are public by design.
const defaultSupabaseUrl = "https://qjpijmlagnyyoubualol.supabase.co";
const defaultSupabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqcGlqbWxhZ255eW91YnVhbG9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTAzMDIsImV4cCI6MjA5NjQ4NjMwMn0.D2B7ijuMD3DzzcJtR6vmslV6FIp7fROK8sFSngdKHsI";

// .trim() is important: a stray trailing newline/space in the env var (easy to
// paste into Vercel by accident) ends up URL-encoded as %0A in the Realtime
// WebSocket apikey and breaks the connection with "HTTP Authentication failed".
const supabaseUrl = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? defaultSupabaseUrl
).trim();
const supabaseAnonKey = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? defaultSupabaseAnonKey
).trim();

/**
 * Browser Supabase client (singleton).
 *
 * We keep a single instance so the Realtime websocket connection is reused
 * across the app. Throws a clear error if the env vars are missing.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Copy .env.local.example to " +
        ".env.local and fill in NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: { params: { eventsPerSecond: 20 } },
      auth: { persistSession: false },
    });
  }
  return client;
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
