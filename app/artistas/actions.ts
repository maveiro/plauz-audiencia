"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function createArtista(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) throw new Error("Nome do artista é obrigatório.");

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("artistas").insert({ nome });
  if (error) throw new Error(error.message);

  revalidatePath("/artistas");
}

export async function createEvento(formData: FormData) {
  const artistaId = String(formData.get("artista_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const dataEvento = String(formData.get("data_evento") ?? "");

  if (!artistaId) throw new Error("Artista é obrigatório.");
  if (!nome) throw new Error("Nome do evento é obrigatório.");

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("eventos").insert({
    artista_id: artistaId,
    nome,
    data_evento: dataEvento || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/artistas");
}
