"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type CanonicalField =
  Database["public"]["Tables"]["field_mappings"]["Row"]["canonical_field"];

export interface FieldMappingInput {
  source_field: string;
  canonical_field: CanonicalField;
  transform: string | null;
}

/**
 * Substitui integralmente os field_mappings de uma fonte pelo conjunto
 * enviado. Configuração declarativa (CLAUDE.md, princípio 3) — seguro
 * sobrescrever por completo a cada salvamento, não há histórico a preservar
 * aqui (diferente de raw_responses/interessados).
 */
export async function saveFieldMappings(
  sourceId: string,
  mappings: FieldMappingInput[],
) {
  const supabase = createServiceRoleClient();

  const cleaned = mappings.filter((m) => m.source_field.trim() !== "");

  const { error: deleteError } = await supabase
    .from("field_mappings")
    .delete()
    .eq("source_id", sourceId);
  if (deleteError) throw new Error(deleteError.message);

  if (cleaned.length > 0) {
    const { error: insertError } = await supabase.from("field_mappings").insert(
      cleaned.map((m) => ({
        source_id: sourceId,
        source_field: m.source_field,
        canonical_field: m.canonical_field,
        transform: m.transform || null,
      })),
    );
    if (insertError) throw new Error(insertError.message);
  }

  revalidatePath(`/fontes/${sourceId}/mapeamento`);
}
