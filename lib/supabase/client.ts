import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Client Supabase pro browser — usado só pelo fluxo de login
 * (GoogleSignInButton). Nunca usar este client pra ler/escrever nas
 * tabelas de negócio: RLS está habilitado sem nenhuma policy, então a anon
 * key não enxerga nada além da API de Auth. Toda leitura/escrita de dado
 * continua exclusivamente via lib/supabase/server.ts (service role).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
