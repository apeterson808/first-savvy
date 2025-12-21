import { createSupabaseClient } from './supabaseClient';

export const firstsavvy = createSupabaseClient();

if (typeof window !== 'undefined') {
  window.firstsavvy = firstsavvy;
  console.log('✅ FirstSavvy client loaded:', window.firstsavvy);
}
