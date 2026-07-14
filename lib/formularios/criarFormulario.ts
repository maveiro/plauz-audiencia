import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { buildFieldMappingsPadrao, TEXTO_CONSENTIMENTO_PADRAO } from "./camposPadrao";
import { isValidSlug } from "./slugify";

export interface NovaPerguntaInput {
  tipo: "texto_curto" | "texto_longo" | "multipla_escolha" | "caixa_selecao";
  rotulo: string;
  obrigatorio: boolean;
  opcoes: string[] | null;
}

export interface CriarFormularioInput {
  eventoId: string;
  name: string;
  slug: string;
  titulo: string;
  descricao: string | null;
  textoConsentimento: string;
  perguntas: NovaPerguntaInput[];
}

function gerarChave(rotulo: string, index: number): string {
  const base = rotulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base ? `${base}_${index}` : `pergunta_${index}`;
}

/**
 * Cria, em sequência, `sources` (tipo=formulario_nativo) + `formularios` +
 * `formulario_perguntas` + os `field_mappings` padrão. Não há transação
 * multi-tabela via PostgREST — em caso de falha em qualquer passo depois do
 * insert de `sources`, a fonte criada é removida (mesmo padrão de
 * compensação já usado em app/api/sources/upload/route.ts para o Storage).
 */
export async function criarFormularioNativo(input: CriarFormularioInput): Promise<{ sourceId: string }> {
  if (!input.eventoId) throw new Error("Evento é obrigatório.");
  if (!input.name.trim()) throw new Error("Nome da fonte é obrigatório.");
  if (!input.titulo.trim()) throw new Error("Título do formulário é obrigatório.");
  if (!isValidSlug(input.slug)) {
    throw new Error("Slug inválido — use apenas letras minúsculas, números e hífen (3 a 60 caracteres).");
  }
  if (!input.textoConsentimento.trim()) {
    throw new Error("Texto de consentimento é obrigatório.");
  }

  const supabase = createServiceRoleClient();

  const { data: source, error: sourceError } = await supabase
    .from("sources")
    .insert({
      evento_id: input.eventoId,
      name: input.name.trim(),
      tipo: "formulario_nativo",
    })
    .select("id")
    .single();

  if (sourceError || !source) {
    throw new Error(`Falha ao criar fonte: ${sourceError?.message}`);
  }

  try {
    const { data: formulario, error: formularioError } = await supabase
      .from("formularios")
      .insert({
        source_id: source.id,
        slug: input.slug,
        titulo: input.titulo.trim(),
        descricao: input.descricao?.trim() || null,
        texto_consentimento: input.textoConsentimento.trim() || TEXTO_CONSENTIMENTO_PADRAO,
        status: "rascunho",
      })
      .select("id")
      .single();

    if (formularioError || !formulario) {
      throw new Error(`Falha ao criar formulário: ${formularioError?.message}`);
    }

    if (input.perguntas.length > 0) {
      const perguntasInsert = input.perguntas.map((p, index) => ({
        formulario_id: formulario.id,
        ordem: index,
        tipo: p.tipo,
        rotulo: p.rotulo.trim(),
        obrigatorio: p.obrigatorio,
        opcoes: p.tipo === "multipla_escolha" || p.tipo === "caixa_selecao" ? p.opcoes : null,
        chave: gerarChave(p.rotulo, index),
      }));

      const { error: perguntasError } = await supabase
        .from("formulario_perguntas")
        .insert(perguntasInsert);

      if (perguntasError) {
        throw new Error(`Falha ao criar perguntas: ${perguntasError.message}`);
      }
    }

    const { error: mappingsError } = await supabase
      .from("field_mappings")
      .insert(buildFieldMappingsPadrao(source.id));

    if (mappingsError) {
      throw new Error(`Falha ao criar mapeamento padrão: ${mappingsError.message}`);
    }
  } catch (err) {
    // Compensação: sem a fonte criada não sobra formulário nativo órfão
    // (formularios/formulario_perguntas cascateiam por on delete cascade).
    await supabase.from("sources").delete().eq("id", source.id);
    throw err;
  }

  return { sourceId: source.id };
}
