import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { uploadArquivoFonte } from "@/lib/storage/uploadArquivoFonte";

/**
 * Cria uma nova fonte do tipo arquivo_upload: recebe o arquivo, salva no
 * Storage e cria a linha em sources (PLANO.md, Fase 2).
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const eventoId = formData.get("evento_id");
  const name = formData.get("name");
  const file = formData.get("file");

  if (typeof eventoId !== "string" || !eventoId) {
    return NextResponse.json({ error: "evento_id é obrigatório." }, { status: 400 });
  }
  if (typeof name !== "string" || !name) {
    return NextResponse.json({ error: "name é obrigatório." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file é obrigatório." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Gerado aqui (em vez de deixar o default do banco) para que o caminho no
  // Storage já nasça determinístico: `${sourceId}.${extensao}`.
  const sourceId = randomUUID();

  let uploaded;
  try {
    uploaded = await uploadArquivoFonte(supabase, sourceId, file);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("sources")
    .insert({
      id: sourceId,
      evento_id: eventoId,
      name,
      tipo: "arquivo_upload",
      arquivo_path: uploaded.path,
      arquivo_nome_original: uploaded.originalName,
      arquivo_enviado_em: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET ?? "uploads-fontes").remove([uploaded.path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ source: data }, { status: 201 });
}
