"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";

export interface PerguntaEditavel {
  id: string | null; // null = pergunta nova, ainda não gravada
  tipo: "texto_curto" | "texto_longo" | "multipla_escolha" | "caixa_selecao";
  rotulo: string;
  obrigatorio: boolean;
  ativo: boolean;
  opcoes: string[] | null;
}

function gerarChave(rotulo: string, index: number): string {
  const base = rotulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base ? `${base}_${Date.now()}_${index}` : `pergunta_${Date.now()}_${index}`;
}

export async function updateFormularioMeta(
  formularioId: string,
  patch: {
    titulo: string;
    descricao: string | null;
    textoConsentimento: string;
    textoConfirmacao: string | null;
    metaPixelId: string | null;
  },
) {
  if (!patch.titulo.trim()) throw new Error("Título é obrigatório.");
  if (!patch.textoConsentimento.trim()) throw new Error("Texto de consentimento é obrigatório.");

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("formularios")
    .update({
      titulo: patch.titulo.trim(),
      descricao: patch.descricao?.trim() || null,
      texto_consentimento: patch.textoConsentimento.trim(),
      texto_confirmacao: patch.textoConfirmacao?.trim() || null,
      meta_pixel_id: patch.metaPixelId?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", formularioId);

  if (error) throw new Error(error.message);
  revalidatePath(`/fontes`);
}

export async function updateFormularioStatus(
  formularioId: string,
  status: "rascunho" | "publicado" | "pausado",
) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("formularios")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", formularioId);

  if (error) throw new Error(error.message);
  revalidatePath(`/fontes`);
}

/**
 * Salva a lista completa de perguntas de uma vez (mesmo padrão de
 * FieldMappingsForm/saveFieldMappings: estado em array no client, replace
 * no servidor). `tipo`, `opcoes` e `chave` de uma pergunta já existente
 * nunca mudam aqui — só rótulo/obrigatório/ativo (política de edição
 * pós-publicação do PRD, aplicada uniformemente independente do status
 * atual do formulário, pra manter a regra simples). Perguntas novas
 * (id null) são inseridas com `chave` gerada agora.
 */
export async function savePerguntas(formularioId: string, perguntas: PerguntaEditavel[]) {
  const supabase = createServiceRoleClient();

  const { data: existentes, error: existentesError } = await supabase
    .from("formulario_perguntas")
    .select("id, ordem")
    .eq("formulario_id", formularioId);
  if (existentesError) throw new Error(existentesError.message);

  const maxOrdemExistente = (existentes ?? []).reduce((max, p) => Math.max(max, p.ordem), -1);

  const existentesIds = new Set((existentes ?? []).map((p) => p.id));

  for (const [index, pergunta] of perguntas.entries()) {
    if (!pergunta.rotulo.trim()) throw new Error("Toda pergunta precisa de um rótulo.");
    if (
      (pergunta.tipo === "multipla_escolha" || pergunta.tipo === "caixa_selecao") &&
      (!pergunta.opcoes || pergunta.opcoes.filter((o) => o.trim()).length < 2)
    ) {
      throw new Error(`"${pergunta.rotulo}" precisa de ao menos 2 opções.`);
    }

    if (pergunta.id && existentesIds.has(pergunta.id)) {
      const { error } = await supabase
        .from("formulario_perguntas")
        .update({
          rotulo: pergunta.rotulo.trim(),
          obrigatorio: pergunta.obrigatorio,
          ativo: pergunta.ativo,
        })
        .eq("id", pergunta.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("formulario_perguntas").insert({
        formulario_id: formularioId,
        ordem: maxOrdemExistente + 1 + index,
        tipo: pergunta.tipo,
        rotulo: pergunta.rotulo.trim(),
        obrigatorio: pergunta.obrigatorio,
        opcoes:
          pergunta.tipo === "multipla_escolha" || pergunta.tipo === "caixa_selecao"
            ? pergunta.opcoes?.filter((o) => o.trim())
            : null,
        chave: gerarChave(pergunta.rotulo, index),
        ativo: pergunta.ativo,
      });
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath(`/fontes`);
}
