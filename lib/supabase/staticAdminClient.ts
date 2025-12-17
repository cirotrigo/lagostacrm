import { createClient } from '@supabase/supabase-js';

/**
 * Static admin client (service role) for non-Next runtimes.
 *
 * - Não depende de `next/headers` nem de `server-only`
 * - Seguro para uso em scripts/CLI e em agentes (sem cookies)
 */
export function createStaticAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
