import { createServiceRoleClient } from "@/lib/supabase/server";
import { getReaderForSource } from "@/lib/readers/getReaderForSource";
import { suggestFieldMappings } from "@/lib/fieldMappings/suggestMappings";
import { FieldMappingsForm } from "./FieldMappingsForm";
import { EditSourceForm } from "./EditSourceForm";

export const dynamic = "force-dynamic";

export default async function MapeamentoPage({
  params,
}: {
  params: Promise<{ sourceId: string }>;
}) {
  const { sourceId } = await params;
  const supabase = createServiceRoleClient();

  const { data: source, error: sourceError } = await supabase
    .from("sources")
    .select("*")
    .eq("id", sourceId)
    .is("deleted_at", null)
    .single();

  if (sourceError || !source) {
    throw new Error("Fonte não encontrada.");
  }

  const { data: fieldMappings, error: mappingsError } = await supabase
    .from("field_mappings")
    .select("source_field, canonical_field, transform")
    .eq("source_id", sourceId);

  if (mappingsError) {
    throw new Error(`Falha ao carregar field_mappings: ${mappingsError.message}`);
  }

  let detectedColumns: string[] = [];
  let readError: string | null = null;
  try {
    const reader = getReaderForSource(source, supabase);
    const rows = await reader.getRows();
    detectedColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
    if (rows.length === 0) {
      readError =
        "A fonte não tem nenhuma linha ainda — não foi possível detectar colunas.";
    }
  } catch (err) {
    readError = (err as Error).message;
  }

  // Colunas já mapeadas mas que não vieram na leitura mais recente também
  // entram na lista, para não "sumir" com o mapeamento existente na UI.
  const allColumns = Array.from(
    new Set([...detectedColumns, ...(fieldMappings ?? []).map((m) => m.source_field)]),
  );

  // Fonte ainda sem mapeamento salvo: sugere um a partir de como essas
  // mesmas colunas já foram mapeadas em outras fontes (ex: mesmo template
  // de formulário reaplicado a cada "Lista Padrão").
  const hasExistingMappings = (fieldMappings ?? []).length > 0;
  const suggestedMappings = hasExistingMappings
    ? []
    : await suggestFieldMappings(supabase, allColumns);
  const initialMappings = hasExistingMappings ? (fieldMappings ?? []) : suggestedMappings;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Mapeamento — {source.name}</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Diga como cada coluna da fonte se traduz para os campos canônicos.
        </p>
      </div>

      <EditSourceForm
        sourceId={sourceId}
        tipo={source.tipo}
        name={source.name}
        sheetUrl={source.sheet_url}
        tabName={source.tab_name}
      />

      {readError && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          {readError}
        </p>
      )}

      {suggestedMappings.length > 0 && (
        <p className="rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
          Mapeamento pré-preenchido com base em outras fontes que usam essas
          mesmas colunas. Revise antes de salvar.
        </p>
      )}

      {allColumns.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Nenhuma coluna disponível para mapear ainda.
        </p>
      ) : (
        <FieldMappingsForm
          sourceId={sourceId}
          detectedColumns={allColumns}
          initialMappings={initialMappings}
        />
      )}
    </div>
  );
}
