import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
  );
}

// Per-tab auth session.
//
// By default supabase-js persists the session in localStorage, which is shared
// across every tab of the same browser and broadcasts SIGNED_IN / SIGNED_OUT
// events to all of them. That made tabs log each other out and reload when a
// second person signed in on the same device. We store the session in
// sessionStorage instead, so each tab keeps an independent session: different
// family members can be signed in side by side, and signing out in one tab no
// longer affects the others. The "remembered family" hint (see deviceFamily.ts)
// stays in localStorage so PIN quick-login still works in fresh tabs.
const tabStorage = typeof window !== 'undefined' ? window.sessionStorage : undefined;

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: tabStorage,
    storageKey: 'familyapp.auth',
  },
});
