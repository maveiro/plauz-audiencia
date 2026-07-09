import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getReaderForSource } from "@/lib/readers/getReaderForSource";
import { createGeografiaResolver } from "@/lib/geo/resolveGeografia";
import { isValidEmail, isValidTelefone } from "@/lib/validation";
import { computeRowHash } from "./rowHash";
import { mapRowToCanonical, parseSubmittedAt } from "./mapRowToCanonical";
import type { Database } from "@/lib/database.types";
import type { RawRow } from "@/lib/readers/types";

type SupabaseServiceClient = ReturnType<typeof createServiceRoleClient>;

const RAW_RESPONSES_BATCH_SIZE = 500;

export interface SyncResult {
  sourceId: string;
  status: "success" | "error";
  rowsFound: number;
  rowsInserted: number;
  errorMessage?: string;
}

/**
 * Motor de sincronização agnóstico ao tipo de fonte (CLAUDE.md, princípio 4).
 * Usado tanto pelo botão manual (POST /api/sync/[sourceId]) quanto pelo
 * Cron (Fase 5), sempre com o mesmo comportamento e as mesmas garantias de
 * idempotência.
 */
export async function syncSource(sourceId: string): Promise<SyncResult> {
  const supabase = createServiceRoleClient();

  const { data: logRow, error: logError } = await supabase
    .from("sync_logs")
    .insert({ source_id: sourceId, status: "running" })
    .select()
    .single();

  if (logError || !logRow) {
    throw new Error(`Falha ao criar sync_log para ${sourceId}: ${logError?.message}`);
  }

  try {
    const { rowsFound, rowsInserted } = await runSync(supabase, sourceId);

    await supabase
      .from("sync_logs")
      .update({
        finished_at: new Date().toISOString(),
        rows_found: rowsFound,
        rows_inserted: rowsInserted,
        status: "success",
      })
      .eq("id", logRow.id);

    await supabase
      .from("sources")
      .update({ last_synced_at: new Date().toISOString(), status: "active" })
      .eq("id", sourceId);

    return { sourceId, status: "success", rowsFound, rowsInserted };
  } catch (err) {
    const errorMessage = (err as Error).message;

    await supabase
      .from("sync_logs")
      .update({
        finished_at: new Date().toISOString(),
        status: "error",
        error_message: errorMessage,
      })
      .eq("id", logRow.id);

    await supabase.from("sources").update({ status: "error" }).eq("id", sourceId);

    return { sourceId, status: "error", rowsFound: 0, rowsInserted: 0, errorMessage };
  }
}

async function runSync(
  supabase: SupabaseServiceClient,
  sourceId: string,
): Promise<{ rowsFound: number; rowsInserted: number }> {
  const { data: source, error: sourceError } = await supabase
    .from("sources")
    .select("*, eventos(id, artista_id)")
    .eq("id", sourceId)
    .is("deleted_at", null)
    .single();

  if (sourceError || !source) {
    throw new Error(`Fonte ${sourceId} não encontrada ou excluída.`);
  }

  const evento = source.eventos as unknown as
    | { id: string; artista_id: string }
    | null;
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
      `Fonte ${sourceId} não tem field_mappings configurados — configure o mapeamento antes de sincronizar.`,
    );
  }

  const reader = getReaderForSource(source, supabase);
  const rows = await reader.getRows();

  const rowsWithHash = rows.map((row) => ({ row, hash: computeRowHash(row) }));

  const newRowsByHash = dedupeNewRows(rowsWithHash, await fetchExistingHashes(supabase, sourceId));
  if (newRowsByHash.length === 0) {
    return { rowsFound: rows.length, rowsInserted: 0 };
  }

  const resolveGeografia = createGeografiaResolver(supabase);
  let rowsInserted = 0;

  for (let i = 0; i < newRowsByHash.length; i += RAW_RESPONSES_BATCH_SIZE) {
    const batch = newRowsByHash.slice(i, i + RAW_RESPONSES_BATCH_SIZE);

    const { data: insertedRaw, error: rawInsertError } = await supabase
      .from("raw_responses")
      .insert(
        batch.map(({ row, hash }) => ({
          source_id: sourceId,
          row_hash: hash,
          raw_data: row,
        })),
      )
      .select("id, row_hash");

    if (rawInsertError || !insertedRaw) {
      throw new Error(`Falha ao inserir raw_responses: ${rawInsertError?.message}`);
    }

    const rawResponseIdByHash = new Map(
      insertedRaw.map((r) => [r.row_hash, r.id]),
    );

    const interessadosBatch = await Promise.all(
      batch.map(async ({ row, hash }) => {
        const rawResponseId = rawResponseIdByHash.get(hash);
        if (!rawResponseId) {
          throw new Error(`raw_response não encontrado para hash ${hash} após insert.`);
        }
        return buildInteressadoRow({
          row,
          rawResponseId,
          eventoId: evento.id,
          artistaId: evento.artista_id,
          sourceId,
          fieldMappings,
          resolveGeografia,
        });
      }),
    );

    const { error: interessadosError } = await supabase
      .from("interessados")
      .insert(interessadosBatch);

    if (interessadosError) {
      throw new Error(`Falha ao inserir interessados: ${interessadosError.message}`);
    }

    rowsInserted += batch.length;
  }

  return { rowsFound: rows.length, rowsInserted };
}

async function fetchExistingHashes(
  supabase: SupabaseServiceClient,
  sourceId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("raw_responses")
    .select("row_hash")
    .eq("source_id", sourceId);

  if (error) {
    throw new Error(`Falha ao buscar row_hash existentes: ${error.message}`);
  }
  return new Set(data?.map((r) => r.row_hash) ?? []);
}

function dedupeNewRows(
  rowsWithHash: { row: RawRow; hash: string }[],
  existingHashes: Set<string>,
): { row: RawRow; hash: string }[] {
  const seenInBatch = new Set<string>();
  const newRows: { row: RawRow; hash: string }[] = [];

  for (const entry of rowsWithHash) {
    if (existingHashes.has(entry.hash) || seenInBatch.has(entry.hash)) continue;
    seenInBatch.add(entry.hash);
    newRows.push(entry);
  }
  return newRows;
}

type FieldMappingRow = Database["public"]["Tables"]["field_mappings"]["Row"];
type InteressadoInsert = Database["public"]["Tables"]["interessados"]["Insert"];

async function buildInteressadoRow(args: {
  row: RawRow;
  rawResponseId: string;
  eventoId: string;
  artistaId: string;
  sourceId: string;
  fieldMappings: FieldMappingRow[];
  resolveGeografia: ReturnType<typeof createGeografiaResolver>;
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
    submitted_at: parseSubmittedAt(canonical.submitted_at),
    extra: canonical.extra,
  };
}
