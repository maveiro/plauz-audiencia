import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import WebSocket from "ws";
import type { Database } from "@/lib/database.types";

/**
 * Client Supabase ciente de sessão (cookie de auth) — usado em Server
 * Components, Route Handlers e Server Actions do fluxo de login. Distinto
 * de lib/supabase/server.ts (service role, ignora RLS, usado por todo o
 * motor de sync/dashboard) — este aqui só fala com a API de Auth em nome
 * do usuário logado.
 *
 * Roda em runtime Node.js (não Edge), então precisa do mesmo shim de
 * WebSocket que lib/supabase/createAdminClient.ts já usa — sem ele, o
 * construtor do supabase-js quebra em Node < 22 ao instanciar o
 * RealtimeClient interno (mesmo sem uso de realtime aqui).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      realtime: { transport: WebSocket as unknown as never },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // cookies() é somente-leitura durante a renderização de um
            // Server Component — só falha aqui, nunca em Route Handlers ou
            // Server Actions (onde a escrita realmente precisa acontecer,
            // ex: app/auth/callback/route.ts). middleware.ts já cuida de
            // manter a sessão atualizada a cada requisição de qualquer forma.
          }
        },
      },
    },
  );
}
