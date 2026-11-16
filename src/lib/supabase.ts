import { createClient, SupabaseClient } from '@supabase/supabase-js';

function cleanEnvValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^["']|["']$/g, '');
}

function isValidHttpUrl(value: string): boolean {
  if (!value || value.includes('YOUR_PROJECT_ID')) return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

const metaEnv = (import.meta as { env?: Record<string, unknown> }).env;
const supabaseUrl = cleanEnvValue(metaEnv?.VITE_SUPABASE_URL);
const supabaseAnonKey = cleanEnvValue(metaEnv?.VITE_SUPABASE_ANON_KEY);

function initSupabaseClient(): SupabaseClient | null {
  if (!isValidHttpUrl(supabaseUrl) || !supabaseAnonKey || supabaseAnonKey.includes('YOUR_SUPABASE')) {
    return null;
  }
  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (err) {
    console.warn('Supabase initialization skipped due to invalid configuration:', err);
    return null;
  }
}

export const supabase: SupabaseClient | null = initSupabaseClient();
export const isSupabaseConfigured = supabase !== null;
