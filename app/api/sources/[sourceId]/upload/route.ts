import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getStorageBucket, uploadArquivoFonte } from "@/lib/storage/uploadArquivoFonte";
import { syncSource } from "@/lib/sync/syncSource";

/**
 * Reenvia um arquivo para uma fonte arquivo_upload existente: substitui o
 * arquivo anterior no Storage e roda o sync sobre a fonte (PLANO.md, Fase 4).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  const { sourceId } = await params;
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file é obrigatório." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: source, error: fetchError } = await supabase
    .from("sources")
    .select("*")
    .eq("id", sourceId)
    .is("deleted_at", null)
    .single();

  if (fetchError || !source) {
    return NextResponse.json({ error: "Fonte não encontrada." }, { status: 404 });
  }
  if (source.tipo !== "arquivo_upload") {
    return NextResponse.json(
      { error: "Reenvio de arquivo só é válido para fontes do tipo arquivo_upload." },
      { status: 400 },
    );
  }

  const previousPath = source.arquivo_path;

  let uploaded;
  try {
    uploaded = await uploadArquivoFonte(supabase, sourceId, file);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("sources")
    .update({
      arquivo_path: uploaded.path,
      arquivo_nome_original: uploaded.originalName,
      arquivo_enviado_em: new Date().toISOString(),
    })
    .eq("id", sourceId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Se a extensão mudou (ex: csv -> xlsx), o caminho determinístico muda
  // junto — remove o arquivo antigo para não deixar órfão no bucket.
  if (previousPath && previousPath !== uploaded.path) {
    await supabase.storage.from(getStorageBucket()).remove([previousPath]);
  }

  const result = await syncSource(sourceId);
  return NextResponse.json({ sync: result });
}
