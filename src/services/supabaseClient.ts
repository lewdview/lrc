import { createClient } from '@supabase/supabase-js';
import { sharedAuthStorage } from './sharedAuthStorage';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://toemkhrfsbkfkutwcjkd.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZW1raHJmc2JrZmt1dHdjamtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MTQxNTQsImV4cCI6MjEwMzE5MDE1NH0.nAtlMU_ukqXMkIhKppwv1mxDKpxuwHa6ddQBBwK3Iu8';

// Older builds asked for a Supabase service-role key and kept it in localStorage. Writes now
// go through the shared th3scr1b3.art login instead, so wipe any key a browser still holds.
try {
  localStorage.removeItem('lrc_supabase_write_key');
} catch {
  // storage blocked: nothing to clean up
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'th3scr1b3-auth-token',
    // One session across every *.th3scr1b3.art site (see sharedAuthStorage.ts).
    storage: sharedAuthStorage(),
  },
});
