import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { matchMunicipio } from "./matchMunicipio";
import { normalizeMunicipioName } from "./normalize";
import { LOCAL_CONFIANCA_MINIMA } from "./resolveGeografia";

// Tarefa de classificação/normalização em lote, não de raciocínio profundo —
// Haiku 4.5 é bem mais barato e rápido, e dá conta dos casos-alvo (apelidos,
// abreviações, erros de digitação). Se casos ambíguos passarem a ser
// aprovados incorretamente, considerar subir para um modelo mais capaz.
const MODELO_IA = "claude-haiku-4-5";

/**
 * Confiança mínima que a própria IA precisa reportar para uma sugestão ser
 * aplicada automaticamente (sem revisão humana). Combinada com
 * LOCAL_CONFIANCA_MINIMA (a mesma validação de similaridade contra
 * municipios_ref usada pelo passo determinístico) — as duas precisam passar
 * para evitar tanto sugestões vagas da IA quanto uma cidade "alucinada" que
 * não existe em municipios_ref.
 */
const CONFIANCA_IA_MINIMA_AUTO_APLICAR = 0.85;

const TAMANHO_LOTE = 30;

const UF_REGEX = /^[A-Za-z]{2}$/;

export interface PendenteRevisao {
  id: string;
  cidade_informada: string | null;
  estado_informada: string | null;
}

export interface ResultadoResolucaoIA {
  processados: number;
  resolvidosAutomaticamente: number;
  permanecemPendentes: number;
  erros: number;
}

interface SugestaoIA {
  cidade: string | null;
  estado: string | null;
  confianca: number;
  motivo: string;
}

const RESULTADO_SCHEMA = {
  type: "object",
  properties: {
    resultados: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          cidade: { anyOf: [{ type: "string" }, { type: "null" }] },
          estado: { anyOf: [{ type: "string" }, { type: "null" }] },
          confianca: { type: "number" },
          motivo: { type: "string" },
        },
        required: ["id", "cidade", "estado", "confianca", "motivo"],
        additionalProperties: false,
      },
    },
  },
  required: ["resultados"],
  additionalProperties: false,
} as const;

/**
 * Segunda camada de normalização geográfica, sobre os casos que o passo
 * determinístico (match_municipio, pg_trgm) deixou pendentes. Disparada
 * manualmente (botão "Resolver com IA" em /fontes/revisao) — não roda como parte
 * do motor de sincronização, para não acoplar uma dependência externa/custo
 * variável ao caminho crítico do sync (CLAUDE.md, princípio 6, cobre o
 * passo determinístico; este é um passo adicional e deliberado, no mesmo
 * espírito do hard-delete manual).
 *
 * Toda sugestão da IA é registrada em geo_ia_logs, aplicada ou não.
 */
export async function resolverPendentesComIA(
  supabase: SupabaseClient<Database>,
  pendentes: PendenteRevisao[],
): Promise<ResultadoResolucaoIA> {
  const comCidade = pendentes.filter((p) => p.cidade_informada?.trim());

  if (comCidade.length === 0) {
    return { processados: 0, resolvidosAutomaticamente: 0, permanecemPendentes: 0, erros: 0 };
  }

  const client = new Anthropic();

  let resolvidos = 0;
  let erros = 0;

  for (let i = 0; i < comCidade.length; i += TAMANHO_LOTE) {
    const lote = comCidade.slice(i, i + TAMANHO_LOTE);

    let sugestoes: Map<string, SugestaoIA>;
    try {
      sugestoes = await pedirSugestoesIA(client, lote);
    } catch (err) {
      console.error("Falha ao consultar IA para normalização geográfica:", err);
      erros += lote.length;
      continue;
    }

    for (const pendente of lote) {
      try {
        resolvidos += await resolverUmPendente(supabase, pendente, sugestoes.get(pendente.id));
      } catch (err) {
        console.error(`Falha ao processar sugestão de IA para ${pendente.id}:`, err);
        erros += 1;
      }
    }
  }

  return {
    processados: comCidade.length,
    resolvidosAutomaticamente: resolvidos,
    permanecemPendentes: comCidade.length - resolvidos - erros,
    erros,
  };
}

/** Retorna 1 se aplicou automaticamente, 0 caso contrário. */
async function resolverUmPendente(
  supabase: SupabaseClient<Database>,
  pendente: PendenteRevisao,
  sugestao: SugestaoIA | undefined,
): Promise<number> {
  if (!sugestao || !sugestao.cidade) {
    await registrarLog(supabase, {
      pendente,
      cidadeSugerida: null,
      estadoSugerido: null,
      confiancaIa: sugestao?.confianca ?? null,
      confiancaSimilaridade: null,
      aplicado: false,
      motivo: sugestao?.motivo ?? "IA não identificou uma única cidade para este texto.",
    });
    return 0;
  }

  const nomeNormalizado = normalizeMunicipioName(sugestao.cidade);
  const ufHint = UF_REGEX.test(sugestao.estado?.trim() ?? "")
    ? sugestao.estado!.trim().toUpperCase()
    : null;
  const match = await matchMunicipio(supabase, nomeNormalizado, ufHint);

  const aplicar =
    !!match &&
    match.similaridade >= LOCAL_CONFIANCA_MINIMA &&
    sugestao.confianca >= CONFIANCA_IA_MINIMA_AUTO_APLICAR;

  if (aplicar && match) {
    const { error } = await supabase
      .from("interessados")
      .update({
        cidade_normalizada: match.nome,
        estado_normalizado: match.uf,
        local_confianca: match.similaridade,
        local_revisao_pendente: false,
      })
      .eq("id", pendente.id);
    if (error) {
      throw new Error(`Falha ao aplicar sugestão de IA em interessados: ${error.message}`);
    }
  }

  await registrarLog(supabase, {
    pendente,
    cidadeSugerida: match?.nome ?? sugestao.cidade,
    estadoSugerido: match?.uf ?? sugestao.estado,
    confiancaIa: sugestao.confianca,
    confiancaSimilaridade: match?.similaridade ?? null,
    aplicado: aplicar,
    motivo: sugestao.motivo,
  });

  return aplicar ? 1 : 0;
}

async function registrarLog(
  supabase: SupabaseClient<Database>,
  args: {
    pendente: PendenteRevisao;
    cidadeSugerida: string | null;
    estadoSugerido: string | null;
    confiancaIa: number | null;
    confiancaSimilaridade: number | null;
    aplicado: boolean;
    motivo: string | null;
  },
) {
  const { error } = await supabase.from("geo_ia_logs").insert({
    interessado_id: args.pendente.id,
    cidade_informada: args.pendente.cidade_informada,
    estado_informada: args.pendente.estado_informada,
    cidade_sugerida: args.cidadeSugerida,
    estado_sugerido: args.estadoSugerido,
    confianca_ia: args.confiancaIa,
    confianca_similaridade: args.confiancaSimilaridade,
    aplicado: args.aplicado,
    modelo: MODELO_IA,
    motivo: args.motivo,
  });
  if (error) {
    throw new Error(`Falha ao registrar geo_ia_logs: ${error.message}`);
  }
}

async function pedirSugestoesIA(
  client: Anthropic,
  lote: PendenteRevisao[],
): Promise<Map<string, SugestaoIA>> {
  const itens = lote.map((p) => ({
    id: p.id,
    cidade_informada: p.cidade_informada,
    estado_informada: p.estado_informada,
  }));

  const response = await client.messages.create({
    model: MODELO_IA,
    max_tokens: 4096,
    output_config: { format: { type: "json_schema", schema: RESULTADO_SCHEMA } },
    messages: [{ role: "user", content: buildPrompt(itens) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Resposta da IA sem bloco de texto com o resultado.");
  }

  const parsed = JSON.parse(textBlock.text) as {
    resultados: Array<{
      id: string;
      cidade: string | null;
      estado: string | null;
      confianca: number;
      motivo: string;
    }>;
  };

  const mapa = new Map<string, SugestaoIA>();
  for (const r of parsed.resultados) {
    mapa.set(r.id, {
      cidade: r.cidade,
      estado: r.estado,
      confianca: Math.max(0, Math.min(1, r.confianca)),
      motivo: r.motivo,
    });
  }
  return mapa;
}

function buildPrompt(
  itens: Array<{ id: string; cidade_informada: string | null; estado_informada: string | null }>,
): string {
  return `Você normaliza cidade/UF que pessoas digitaram livremente em um formulário de interesse em eventos no Brasil.

Para cada item, identifique a cidade brasileira mais provável e sua UF (sigla de 2 letras), usando conhecimento de apelidos, abreviações e erros de digitação comuns no Brasil. Exemplos: "RJ" ou "Rio" = Rio de Janeiro/RJ; "SP" = São Paulo/SP; "BH" ou "Beaga" = Belo Horizonte/MG; "Poa" = Porto Alegre/RS.

Regras:
- Se o texto identifica claramente UMA cidade específica (mesmo com abreviação, apelido ou erro de digitação), responda "cidade" e "estado" preenchidos, com "confianca" alta (0.85 ou mais).
- Se o texto lista múltiplas cidades/regiões possíveis (ex: "Itu / Salto / Campinas"), é vago demais (ex: só o nome de um estado, ou "aqui perto"), ou não é uma cidade real, responda "cidade" e "estado" como null, com "confianca" baixa, e explique em "motivo" por que não dá para escolher uma única cidade.
- "estado" é sempre a sigla de 2 letras (UF), nunca o nome do estado por extenso.
- "motivo" é sempre preenchido, com uma frase curta explicando a decisão.
- Responda para TODOS os ids da lista, na mesma ordem, sem pular nenhum.

Itens:
${JSON.stringify(itens)}`;
}
