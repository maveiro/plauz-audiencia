import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface MunicipioMatch {
  nome: string;
  uf: string;
  similaridade: number;
}

export async function matchMunicipio(
  supabase: SupabaseClient<Database>,
  nomeNormalizado: string,
  ufHint: string | null,
): Promise<MunicipioMatch | null> {
  const { data, error } = await supabase.rpc("match_municipio", {
    p_nome_normalizado: nomeNormalizado,
    p_uf: ufHint,
  });

  if (error) {
    throw new Error(`Falha ao buscar município correspondente: ${error.message}`);
  }

  return data?.[0] ?? null;
}
