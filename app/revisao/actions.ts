"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";

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

  revalidatePath("/revisao");
}
