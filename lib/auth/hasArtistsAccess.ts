import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Checagem de acesso via schema `core` da plataforma Plauz (plauz-core).
 * Este app e o core compartilham o mesmo projeto Supabase (ver
 * plauz-core/docs/decisions/0002-projeto-supabase-do-core.md), então dá
 * pra chamar core.has_app_role diretamente por RPC — sem precisar de
 * nenhuma federação entre projetos.
 *
 * Tipagem solta de propósito (SupabaseClient sem o generic Database local):
 * o Database gerado deste repo só descreve o schema `public` dele mesmo,
 * não o schema `core`. Isso é aceitável para esta integração pontual;
 * quando o app for movido para dentro do monorepo (estágio 3 do plano de
 * corte), passa a usar os tipos gerados de @plauz/core-client.
 *
 * Defesa em profundidade, somada à checagem de domínio já existente em
 * middleware.ts e app/auth/callback/route.ts — não a substitui. Continua
 * "falha fechada": qualquer erro na consulta é tratado como sem acesso.
 */
export async function hasArtistsAccess(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase
    .schema("core")
    .rpc("has_app_role", { app_slug: "artists", role_key: "member" });

  if (error) {
    console.error("hasArtistsAccess: falha ao consultar core.has_app_role", error);
    return false;
  }

  return data ?? false;
}
