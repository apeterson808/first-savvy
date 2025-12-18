import { createSupabaseClient } from './supabaseClient';

export const base44 = createSupabaseClient();

if (typeof window !== 'undefined') {
  window.base44 = base44;
  console.log('✅ base44 client loaded:', window.base44);
}
