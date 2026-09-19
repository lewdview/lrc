import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://toemkhrfsbkfkutwcjkd.supabase.co';
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZW1raHJmc2JrZmt1dHdjamtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MTQxNTQsImV4cCI6MjEwMzE5MDE1NH0.nAtlMU_ukqXMkIhKppwv1mxDKpxuwHa6ddQBBwK3Iu8';

export function getStoredSupabaseKey(): string {
  return localStorage.getItem('lrc_supabase_write_key') || SUPABASE_ANON_KEY;
}

export function setStoredSupabaseKey(key: string) {
  if (!key.trim()) {
    localStorage.removeItem('lrc_supabase_write_key');
  } else {
    localStorage.setItem('lrc_supabase_write_key', key.trim());
  }
}

export function getSupabaseClient(customKey?: string) {
  const activeKey = customKey || getStoredSupabaseKey();
  return createClient(SUPABASE_URL, activeKey);
}

export const supabase = getSupabaseClient();
