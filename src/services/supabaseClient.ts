import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://pznmptudgicrmljjafex.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6bm1wdHVkZ2ljcm1samphZmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMDE4ODUsImV4cCI6MjA3OTg3Nzg4NX0.syu1bbr9OJ5LxCnTrybLVgsjac4UOkFVdAHuvhKMY2g';

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
