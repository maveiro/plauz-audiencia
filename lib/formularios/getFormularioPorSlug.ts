import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

export interface FormularioPublico {
  sourceId: string;
  formularioId: string;
  status: "rascunho" | "publicado" | "pausado";
  titulo: string;
  descricao: string | null;
  textoConsentimento: string;
  textoConfirmacao: string | null;
  corDestaque: string | null;
  logoUrl: string | null;
  metaPixelId: string | null;
  perguntas: {
    id: string;
    tipo: "texto_curto" | "texto_longo" | "multipla_escolha" | "caixa_selecao";
    rotulo: string;
    obrigatorio: boolean;
    opcoes: string[] | null;
    chave: string;
  }[];
}

/**
 * Busca um formulário pelo slug via `sources_ativas` (fonte soft-deletada
 * já some daqui de graça — CLAUDE.md, princípio 11). Devolve mesmo se
 * `rascunho`/`pausado`: quem chama (a página pública) decide o que fazer
 * com cada status — 404 para rascunho sem sessão, "encerrado" para pausado.
 */
export async function getFormularioPorSlug(slug: string): Promise<FormularioPublico | null> {
  const supabase = createServiceRoleClient();

  const { data: formulario, error } = await supabase
    .from("formularios")
    .select(
      "id, source_id, status, titulo, descricao, texto_consentimento, texto_confirmacao, cor_destaque, logo_url, meta_pixel_id",
    )
    .eq("slug", slug)
    .single();

  if (error || !formulario) return null;

  // Fonte soft-deletada = formulário some do ar (princípio 11: nunca ler
  // sources cru pra decidir o que está "ativo"). Duas queries em vez de
  // embed porque `sources_ativas` é view, não tem FK declarada para o
  // PostgREST resolver `!inner` automaticamente.
  const { data: sourceAtiva } = await supabase
    .from("sources_ativas")
    .select("id")
    .eq("id", formulario.source_id)
    .maybeSingle();

  if (!sourceAtiva) return null;

  const { data: perguntas, error: perguntasError } = await supabase
    .from("formulario_perguntas")
    .select("id, tipo, rotulo, obrigatorio, opcoes, chave")
    .eq("formulario_id", formulario.id)
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (perguntasError) {
    throw new Error(`Falha ao buscar perguntas do formulário: ${perguntasError.message}`);
  }

  return {
    sourceId: formulario.source_id,
    formularioId: formulario.id,
    status: formulario.status,
    titulo: formulario.titulo,
    descricao: formulario.descricao,
    textoConsentimento: formulario.texto_consentimento,
    textoConfirmacao: formulario.texto_confirmacao,
    corDestaque: formulario.cor_destaque,
    logoUrl: formulario.logo_url,
    metaPixelId: formulario.meta_pixel_id,
    perguntas: (perguntas ?? []).map((p) => ({
      id: p.id,
      tipo: p.tipo,
      rotulo: p.rotulo,
      obrigatorio: p.obrigatorio,
      opcoes: Array.isArray(p.opcoes) ? (p.opcoes as string[]) : null,
      chave: p.chave,
    })),
  };
}
