import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { createGeografiaResolver } from "@/lib/geo/resolveGeografia";
import { UTM_ROW_KEYS } from "@/lib/formularios/constants";
import { computeRowHash } from "./rowHash";
import { buildInteressadoRow } from "./buildInteressadoRow";
import type { RawRow } from "@/lib/readers/types";
import type { Database } from "@/lib/database.types";

type InteressadoInsert = Database["public"]["Tables"]["interessados"]["Insert"];

const UNIQUE_VIOLATION = "23505";

export interface SubmitFormResponseResult {
  interessadoId: string | null;
  duplicated: boolean;
}

/**
 * Ingestão em tempo real de uma resposta de formulário nativo — o
 * equivalente, para uma linha só, do loop em lote de `syncSource.ts`.
 * Reusa exatamente as mesmas peças (hash, mapeamento canônico, validação
 * leve, normalização geográfica via `buildInteressadoRow`) para não
 * duplicar lógica entre o motor de sync "pull" e este caminho "push"
 * (CLAUDE.md, princípio 4).
 *
 * `row` já deve conter os campos padrão com as chaves canônicas
 * (`nome`, `telefone`, `email`, `cidade`, `estado`) + respostas de
 * perguntas extras chaveadas por `formulario_perguntas.chave` + parâmetros
 * de campanha prefixados com `_` (`_utm_source` etc, ver plano — entram no
 * hash deliberadamente).
 *
 * Não faz pre-fetch de hashes existentes como `syncSource` (não vale a pena
 * para uma linha só): insere direto e trata violação da unique
 * (source_id, row_hash) como duplicata, nunca como erro 500 — protege
 * contra duplo clique/reenvio sem que o usuário público veja um erro.
 */
export async function submitFormResponse(
  sourceId: string,
  row: RawRow,
): Promise<SubmitFormResponseResult> {
  const supabase = createServiceRoleClient();

  const { data: source, error: sourceError } = await supabase
    .from("sources")
    .select("*, eventos(id, artista_id)")
    .eq("id", sourceId)
    .eq("tipo", "formulario_nativo")
    .is("deleted_at", null)
    .single();

  if (sourceError || !source) {
    throw new Error(`Fonte de formulário ${sourceId} não encontrada ou excluída.`);
  }

  const evento = source.eventos as unknown as { id: string; artista_id: string } | null;
  if (!evento) {
    throw new Error(`Fonte ${sourceId} não tem evento associado.`);
  }

  const { data: fieldMappings, error: mappingsError } = await supabase
    .from("field_mappings")
    .select("*")
    .eq("source_id", sourceId);

  if (mappingsError) {
    throw new Error(`Falha ao buscar field_mappings: ${mappingsError.message}`);
  }
  if (!fieldMappings || fieldMappings.length === 0) {
    throw new Error(
      `Formulário ${sourceId} não tem field_mappings — algo deu errado na criação do formulário.`,
    );
  }

  const hash = computeRowHash(row);

  const { data: insertedRaw, error: rawInsertError } = await supabase
    .from("raw_responses")
    .insert({ source_id: sourceId, row_hash: hash, raw_data: row })
    .select("id")
    .single();

  if (rawInsertError) {
    if (rawInsertError.code === UNIQUE_VIOLATION) {
      return { interessadoId: null, duplicated: true };
    }
    throw new Error(`Falha ao gravar resposta: ${rawInsertError.message}`);
  }

  const resolveGeografia = createGeografiaResolver(supabase);
  const interessadoInsert: InteressadoInsert = await buildInteressadoRow({
    row,
    rawResponseId: insertedRaw.id,
    eventoId: evento.id,
    artistaId: evento.artista_id,
    sourceId,
    fieldMappings,
    resolveGeografia,
    submittedAtOverride: new Date().toISOString(),
  });

  // UTM/fbclid entram no row_hash via `row` (raw_data), mas viram colunas
  // dedicadas em `interessados` — dimensão de análise de primeira classe,
  // não campo solto em `extra` (ver migration 0012).
  for (const key of UTM_ROW_KEYS) {
    const value = row[key];
    if (!value) continue;
    if (key === "_fbclid") interessadoInsert.fbclid = value;
    else if (key === "_utm_source") interessadoInsert.utm_source = value;
    else if (key === "_utm_medium") interessadoInsert.utm_medium = value;
    else if (key === "_utm_campaign") interessadoInsert.utm_campaign = value;
    else if (key === "_utm_content") interessadoInsert.utm_content = value;
  }

  const { data: interessado, error: interessadoError } = await supabase
    .from("interessados")
    .insert(interessadoInsert)
    .select("id")
    .single();

  if (interessadoError || !interessado) {
    throw new Error(`Falha ao gravar interessado: ${interessadoError?.message}`);
  }

  return { interessadoId: interessado.id, duplicated: false };
}
