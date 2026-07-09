import "server-only";
import { createAdminClient } from "./createAdminClient";

/**
 * Client server-side, autenticado com a service role key (ignora RLS).
 * Nunca importar este módulo de código que roda no browser — a diretiva
 * "server-only" acima faz o build falhar caso isso aconteça.
 */
export function createServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidas (ver .env.example).",
    );
  }

  return createAdminClient(url, serviceRoleKey);
}
