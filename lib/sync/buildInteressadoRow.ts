import { createGeografiaResolver } from "@/lib/geo/resolveGeografia";
import { isValidEmail, isValidTelefone } from "@/lib/validation";
import { mapRowToCanonical, parseSubmittedAt } from "./mapRowToCanonical";
import type { Database } from "@/lib/database.types";
import type { RawRow } from "@/lib/readers/types";

type FieldMappingRow = Database["public"]["Tables"]["field_mappings"]["Row"];
type InteressadoInsert = Database["public"]["Tables"]["interessados"]["Insert"];

/**
 * Traduz uma linha bruta (de qualquer fonte) para o insert de `interessados`:
 * mapeamento canônico + validação leve + normalização geográfica. Único
 * lugar que faz essa tradução — usado tanto pelo motor de sync em lote
 * (`syncSource.ts`, fontes google_sheets/arquivo_upload) quanto pela
 * ingestão em tempo real de formulário nativo (`submitFormResponse.ts`),
 * preservando o princípio de "motor único" mesmo com dois pontos de entrada
 * (CLAUDE.md, princípio 4).
 */
export async function buildInteressadoRow(args: {
  row: RawRow;
  rawResponseId: string;
  eventoId: string;
  artistaId: string;
  sourceId: string;
  fieldMappings: FieldMappingRow[];
  resolveGeografia: ReturnType<typeof createGeografiaResolver>;
  submittedAtOverride?: string;
}): Promise<InteressadoInsert> {
  const canonical = mapRowToCanonical(args.row, args.fieldMappings);

  const emailValido = canonical.email ? isValidEmail(canonical.email) : null;
  const telefoneValido = canonical.telefone
    ? isValidTelefone(canonical.telefone)
    : null;

  const geo = canonical.cidade
    ? await args.resolveGeografia(canonical.cidade, canonical.estado)
    : {
        cidadeNormalizada: null,
        estadoNormalizado: null,
        confianca: null,
        revisaoPendente: true,
      };

  return {
    evento_id: args.eventoId,
    artista_id: args.artistaId,
    source_id: args.sourceId,
    raw_response_id: args.rawResponseId,
    nome_completo: canonical.nome_completo || null,
    telefone: canonical.telefone || null,
    telefone_valido: telefoneValido,
    email: canonical.email || null,
    email_valido: emailValido,
    cidade_informada: canonical.cidade || null,
    estado_informada: canonical.estado || null,
    cidade_normalizada: geo.cidadeNormalizada,
    estado_normalizado: geo.estadoNormalizado,
    local_confianca: geo.confianca,
    local_revisao_pendente: geo.revisaoPendente,
    submitted_at: args.submittedAtOverride ?? parseSubmittedAt(canonical.submitted_at),
    extra: canonical.extra,
  };
}
