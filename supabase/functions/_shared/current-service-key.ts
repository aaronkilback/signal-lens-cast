/**
 * current-service-key — resolves the CURRENT (rotated) service-role
 * key from vault.decrypted_secrets via the
 * `get_current_service_role_key()` SECURITY DEFINER RPC.
 *
 * The Deno env var SUPABASE_SERVICE_ROLE_KEY on this Supabase project
 * still holds the legacy JWT format (missing `sub` claim); the new
 * auth layer rejects it with 401. The rotated `sb_secret_*` lives in
 * the vault and is the value PostgREST + inter-function fetches must
 * use post-rotation.
 *
 * Mirrors the helper of the same name in the Fortress repo
 * (silent-shield-signal/supabase/functions/_shared/current-service-key.ts)
 * because both apps share Supabase project kpuqukppbmwebiptqmog.
 */

export async function resolveServiceRoleKey(supabase: any): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('get_current_service_role_key');
    if (error) {
      console.warn('[resolveServiceRoleKey] RPC error, falling back to env:', error.message);
      return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    }
    if (typeof data === 'string' && data.length > 0) return data;
  } catch (e: any) {
    console.warn('[resolveServiceRoleKey] threw, falling back to env:', e?.message || e);
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}
