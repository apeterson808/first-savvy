import { createSupabaseClient, supabase } from './supabaseClient';

export const base44 = createSupabaseClient();

if (typeof window !== 'undefined') {
  window.base44 = base44;
  window.supabase = supabase;
}
