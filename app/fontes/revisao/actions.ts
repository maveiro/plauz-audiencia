"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { resolverPendentesComIA } from "@/lib/geo/aiResolveGeografia";

// Mesmo valor de LIMIT usado em page.tsx — processa exatamente o que está
// sendo exibido na tela. Não é possível compartilhar a constante entre os
// dois arquivos porque um módulo "use server" só pode exportar funções.
const LIMIT = 200;

/**
 * Resolve manualmente um caso de local_revisao_pendente = true. Confiança
 * 1 porque foi confirmada por um humano, não por similaridade automática
 * (CLAUDE.md, princípio 6).
 */
export async function resolveRevisao(
  interessadoId: string,
  cidadeNormalizada: string,
  estadoNormalizado: string,
) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("interessados")
    .update({
      cidade_normalizada: cidadeNormalizada.trim() || null,
      estado_normalizado: estadoNormalizado.trim().toUpperCase() || null,
      local_confianca: 1,
      local_revisao_pendente: false,
    })
    .eq("id", interessadoId);

  if (error) throw new Error(error.message);

  revalidatePath("/fontes/revisao");
}

/**
 * Segunda camada de normalização geográfica, via IA (ver lib/geo/aiResolveGeografia.ts):
 * trata automaticamente os casos que a normalização determinística (trigram)
 * deixou pendentes — apelidos, abreviações, erros de digitação — e deixa
 * pendentes só os casos realmente ambíguos (ex: múltiplas cidades listadas).
 * Toda sugestão da IA fica registrada em geo_ia_logs, aplicada ou não.
 */
export async function resolverComIA() {
  const supabase = createServiceRoleClient();

  const { data: pendentes, error } = await supabase
    .from("interessados_ativos")
    .select("id, cidade_informada, estado_informada")
    .eq("local_revisao_pendente", true)
    .order("synced_at", { ascending: false })
    .limit(LIMIT);

  if (error) throw new Error(error.message);

  if (!pendentes || pendentes.length === 0) {
    return { processados: 0, resolvidosAutomaticamente: 0, permanecemPendentes: 0, erros: 0 };
  }

  const resultado = await resolverPendentesComIA(supabase, pendentes);

  revalidatePath("/fontes/revisao");
  return resultado;
}
