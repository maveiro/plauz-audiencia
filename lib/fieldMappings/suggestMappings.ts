import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { FieldMappingInput } from "@/app/fontes/[sourceId]/mapeamento/actions";

/**
 * Sugere field_mappings para colunas ainda não configuradas, olhando como
 * essas mesmas colunas (texto igual) já foram mapeadas em outras fontes.
 * Fontes que compartilham o mesmo template de formulário (ex: "Lista
 * Padrão") repetem os mesmos cabeçalhos ("Nome:", "Telefone:", "Carimbo de
 * data/hora"...), então o mapeamento de uma vira sugestão pronta pra
 * próxima — sem depender de nenhum if por fonte (CLAUDE.md, princípio 3).
 */
export async function suggestFieldMappings(
  supabase: SupabaseClient<Database>,
  columns: string[],
): Promise<FieldMappingInput[]> {
  if (columns.length === 0) return [];

  const { data, error } = await supabase
    .from("field_mappings")
    .select("source_field, canonical_field, transform")
    .in("source_field", columns);

  if (error || !data || data.length === 0) return [];

  // Por coluna e campo canônico, guarda qual transform foi usado com mais
  // frequência historicamente (mapas aninhados, não chave-string composta,
  // pra não confundir colunas onde uma é prefixo da outra, ex: "Nome" e
  // "Nome:").
  const byColumn = new Map<
    string,
    Map<FieldMappingInput["canonical_field"], Map<string, number>>
  >();

  for (const row of data) {
    let byCanonicalField = byColumn.get(row.source_field);
    if (!byCanonicalField) {
      byCanonicalField = new Map();
      byColumn.set(row.source_field, byCanonicalField);
    }
    let transformCounts = byCanonicalField.get(row.canonical_field);
    if (!transformCounts) {
      transformCounts = new Map();
      byCanonicalField.set(row.canonical_field, transformCounts);
    }
    const transformKey = row.transform ?? "";
    transformCounts.set(transformKey, (transformCounts.get(transformKey) ?? 0) + 1);
  }

  const suggestions: FieldMappingInput[] = [];
  for (const column of columns) {
    const byCanonicalField = byColumn.get(column);
    if (!byCanonicalField) continue;
    for (const [canonicalField, transformCounts] of byCanonicalField) {
      let bestTransform = "";
      let bestCount = -1;
      for (const [transformKey, count] of transformCounts) {
        if (count > bestCount) {
          bestTransform = transformKey;
          bestCount = count;
        }
      }
      suggestions.push({
        source_field: column,
        canonical_field: canonicalField,
        transform: bestTransform || null,
      });
    }
  }

  return suggestions;
}
