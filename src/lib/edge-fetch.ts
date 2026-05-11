import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export async function edgeFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? PUBLISHABLE_KEY;
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('apikey', PUBLISHABLE_KEY);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${SUPABASE_URL}/functions/v1/${path.replace(/^\//, '')}`, { ...init, headers });
}
