"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { extractSheetId } from "@/lib/google/extractSheetId";
import { criarFormularioNativo, type CriarFormularioInput } from "@/lib/formularios/criarFormulario";

export async function createGoogleSheetsSource(formData: FormData) {
  const eventoId = String(formData.get("evento_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sheetUrl = String(formData.get("sheet_url") ?? "").trim();
  const tabName = String(formData.get("tab_name") ?? "").trim();

  if (!eventoId) throw new Error("Evento é obrigatório.");
  if (!name) throw new Error("Nome da fonte é obrigatório.");
  if (!sheetUrl) throw new Error("Link da planilha é obrigatório.");

  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) {
    throw new Error(
      "Não foi possível extrair o ID da planilha a partir do link informado.",
    );
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("sources")
    .insert({
      evento_id: eventoId,
      name,
      tipo: "google_sheets",
      sheet_id: sheetId,
      sheet_url: sheetUrl,
      tab_name: tabName || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  redirect(`/fontes/${data.id}/mapeamento`);
}

// Não usa redirect() aqui de propósito: esta action é chamada
// imperativamente por um Client Component (não via <form action>), e
// redirect() lançado nesse caminho seria capturado pelo try/catch de quem
// chamou em vez de navegar — devolve o id e deixa o client decidir a
// navegação (mesmo padrão de app/fontes/nova/NovaFonteArquivoForm.tsx).
export async function createFormularioSource(input: CriarFormularioInput) {
  return criarFormularioNativo(input);
}

export async function updateSourceMeta(sourceId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nome da fonte é obrigatório.");

  const supabase = createServiceRoleClient();

  const { data: source, error: sourceError } = await supabase
    .from("sources")
    .select("tipo")
    .eq("id", sourceId)
    .single();
  if (sourceError || !source) throw new Error("Fonte não encontrada.");

  const patch: { name: string; sheet_url?: string; sheet_id?: string; tab_name?: string | null } = {
    name,
  };

  if (source.tipo === "google_sheets") {
    const sheetUrl = String(formData.get("sheet_url") ?? "").trim();
    const tabName = String(formData.get("tab_name") ?? "").trim();

    if (!sheetUrl) throw new Error("Link da planilha é obrigatório.");

    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) {
      throw new Error(
        "Não foi possível extrair o ID da planilha a partir do link informado.",
      );
    }

    patch.sheet_url = sheetUrl;
    patch.sheet_id = sheetId;
    patch.tab_name = tabName || null;
  }

  const { error } = await supabase.from("sources").update(patch).eq("id", sourceId);
  if (error) throw new Error(error.message);

  revalidatePath("/fontes");
  revalidatePath(`/fontes/${sourceId}/mapeamento`);
}

export async function softDeleteSource(sourceId: string) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("sources")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", sourceId);
  if (error) throw new Error(error.message);

  revalidatePath("/fontes");
  revalidatePath("/fontes/excluidas");
}

export async function restoreSource(sourceId: string) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("sources")
    .update({ deleted_at: null })
    .eq("id", sourceId);
  if (error) throw new Error(error.message);

  revalidatePath("/fontes");
  revalidatePath("/fontes/excluidas");
}
