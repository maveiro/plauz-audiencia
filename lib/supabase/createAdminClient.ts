import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { Database } from "@/lib/database.types";

/**
 * Fábrica pura, sem "server-only" — importada tanto por lib/supabase/server.ts
 * (guardado, usado pelo app Next.js) quanto pelos scripts standalone
 * (scripts/*.ts, rodados via tsx, fora do bundler do Next.js onde o guard
 * "server-only" simplesmente lança erro incondicionalmente).
 *
 * Passa `ws` como transport do Realtime porque o construtor do supabase-js
 * sempre instancia um RealtimeClient internamente (mesmo sem uso de
 * realtime neste projeto), o que exige um WebSocket global — ausente em
 * Node < 22. Ver lib/supabase/server.ts para o contexto completo.
 */
export function createAdminClient(url: string, serviceRoleKey: string) {
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false },
    realtime: { transport: WebSocket as unknown as never },
  });
}
