// Admin Supabase client using service role key
// This client bypasses RLS policies for admin dashboard access
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const isPlaceholderKey = (key) => {
  if (!key) return true;
  if (key === "service-role-key" || key.includes("your_service_role_key")) return true;
  // A valid Supabase service_role key is a signed JWT with 3 parts separated by dots
  const parts = key.split('.');
  if (parts.length < 3) return true;
  return false;
};

let activeKey = SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("[admin-supabase] Missing VITE_SUPABASE_URL");
}

if (isPlaceholderKey(SUPABASE_SERVICE_ROLE_KEY)) {
  console.warn(
    "[admin-supabase] VITE_SUPABASE_SERVICE_ROLE_KEY is missing or invalid. " +
      "Falling back to VITE_SUPABASE_PUBLISHABLE_KEY for read-only preview access."
  );
  activeKey = SUPABASE_PUBLISHABLE_KEY;
}

export const isUsingAdminFallback = isPlaceholderKey(SUPABASE_SERVICE_ROLE_KEY);

// Service role client bypasses RLS - use only for admin operations
export const adminSupabase = createClient(
  SUPABASE_URL || "https://example.supabase.co",
  activeKey || "service-role-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);
