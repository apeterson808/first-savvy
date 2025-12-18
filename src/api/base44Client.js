import { createSupabaseClient, supabase } from './supabaseClient';

export const base44 = createSupabaseClient();

if (typeof window !== 'undefined') {
  window.base44 = base44;
  window.supabaseClient = supabase;
  console.log('✅ base44 client loaded:', window.base44);
  console.log('✅ supabaseClient available:', window.supabaseClient);
  console.log('Has auth?', !!window.supabaseClient?.auth);
}
